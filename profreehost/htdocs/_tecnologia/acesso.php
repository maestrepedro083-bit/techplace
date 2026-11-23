<?php
declare(strict_types=1);

const COOKIE_LOJA = '__Host-tp_session';
const ACESSO_SEGUNDOS = 1209600;

function token(): string {
    return rtrim(strtr(base64_encode(random_bytes(32)), '+/', '-_'), '=');
}

function tokenAtual(): ?string {
    $token = $_COOKIE[COOKIE_LOJA] ?? null;
    return is_string($token) && preg_match('/\A[A-Za-z0-9_-]{43}\z/', $token) === 1 ? $token : null;
}

function cookieLoja(string $value, int $expires): void {
    setcookie(COOKIE_LOJA, $value, ['expires'=>$expires, 'path'=>'/', 'secure'=>true, 'httponly'=>true, 'samesite'=>'Lax']);
}

function contaAtual(PDO $db): ?array {
    $token = tokenAtual();
    if ($token === null) return null;
    return unico($db, 'SELECT a.name FROM staff_sessions s JOIN staff_accounts a ON a.id=s.staff_id
        WHERE s.token_hash=? AND s.expires_at>? AND a.disabled_at IS NULL', [hash('sha256', $token), timestamp()]);
}

function nomeDaConta(mixed $raw): array {
    $name = is_string($raw) ? preg_replace('/\s+/u', ' ', trim($raw)) : '';
    if ($name === null || comprimento($name) < 2 || comprimento($name) > 70 ||
        preg_match('/[\p{Cc}\p{Cf}]/u', $name) || !preg_match('/[\p{L}\p{N}]/u', $name)) {
        throw new Entrada('Informe um nome de 2 a 70 caracteres.');
    }
    $normalized = class_exists(Normalizer::class) ? Normalizer::normalize($name, Normalizer::FORM_KC) : $name;
    $normalized = $normalized ?: $name;
    $key = function_exists('mb_strtolower') ? mb_strtolower($normalized, 'UTF-8') : strtolower(strtr($normalized, array_combine(
        preg_split('//u', 'ÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑ', -1, PREG_SPLIT_NO_EMPTY),
        preg_split('//u', 'áàâãäéèêëíìîïóòôõöúùûüçñ', -1, PREG_SPLIT_NO_EMPTY)
    )));
    return [$name, $key];
}

function hashDaSenha(string $password, string $salt, array $config): string {
    $pepper = $config['pepper'];
    if (!is_string($pepper) || strlen($pepper) < 32) throw new Entrada('Confira a configuração do pacote de migração.', 503);
    $keyed = hash_hmac('sha256', $password, $pepper, true);
    return hash_pbkdf2('sha256', $keyed, $salt, 100000, 64);
}

function limitaAcesso(PDO $db, string $action, string $key): void {
    $window = intdiv(time(), 900);
    $ip = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
    foreach ([['ip:' . $ip, 35], ['name:' . $key, 10]] as [$subject, $limit]) {
        $attemptKey = hash('sha256', $action . ':' . $subject);
        $count = transacao($db, function () use ($db, $attemptKey, $window) {
            sql($db, 'INSERT INTO staff_login_attempts (`key`,`window`,`count`) VALUES (?,?,1)
                ON DUPLICATE KEY UPDATE `count`=IF(`window`=VALUES(`window`),`count`+1,1),`window`=VALUES(`window`)', [$attemptKey, $window]);
            return (int)unico($db, 'SELECT `count` FROM staff_login_attempts WHERE `key`=?', [$attemptKey])['count'];
        });
        if ($count > $limit) throw new Entrada('Muitas tentativas. Aguarde até 15 minutos e tente novamente.', 429);
    }
    if (random_int(1, 30) === 1) sql($db, 'DELETE FROM staff_login_attempts WHERE `window`<?', [$window - 2]);
}

function acesso(PDO $db, string $method, array $config): void {
    if ($method === 'GET') {
        resposta(['name'=>contaAtual($db)['name'] ?? null]);
        return;
    }
    if ($method !== 'POST') throw new Entrada('Método inválido.', 405);
    $data = payload($config, 4096);
    $action = $data['action'] ?? '';
    if ($action === 'logout') {
        $token = tokenAtual();
        if ($token !== null) sql($db, 'DELETE FROM staff_sessions WHERE token_hash=?', [hash('sha256', $token)]);
        cookieLoja('', time() - 3600);
        resposta(['ok'=>true]);
        return;
    }
    if ($action !== 'register' && $action !== 'login') throw new Entrada('Operação inválida.');
    [$name, $key] = nomeDaConta($data['name'] ?? null);
    $password = $data['password'] ?? null;
    $register = $action === 'register';
    if (!is_string($password) || comprimento($password) < ($register ? 10 : 1) || comprimento($password) > 128) {
        throw new Entrada($register ? 'Use uma senha de 10 a 128 caracteres.' : 'Confira o nome e a senha.');
    }
    limitaAcesso($db, $action, $key);
    $token = token();
    $expires = time() + ACESSO_SEGUNDOS;
    $name = transacao($db, function () use ($db, $config, $key, $name, $password, $register, $token, $expires) {
        $account = unico($db, 'SELECT id,name,salt,password_hash,disabled_at FROM staff_accounts WHERE name_key=? FOR UPDATE', [$key]);
        if ($register) {
            if ($account) throw new Entrada('Este nome já está em uso. Escolha um nome diferente.', 409);
            $id = uid();
            $salt = token();
            sql($db, 'INSERT INTO staff_accounts (id,name,name_key,salt,password_hash,created_at) VALUES (?,?,?,?,?,?)',
                [$id, $name, $key, $salt, hashDaSenha($password, $salt, $config), timestamp()]);
        } else {
            $hash = hashDaSenha($password, $account['salt'] ?? 'tech-place-default-comparison', $config);
            if (!hash_equals($account['password_hash'] ?? str_repeat('0', 64), $hash) || !$account || $account['disabled_at']) {
                throw new Entrada('Nome ou senha inválidos.', 401);
            }
            $id = $account['id'];
            $name = $account['name'];
        }
        sql($db, 'INSERT INTO staff_sessions (token_hash,staff_id,expires_at) VALUES (?,?,?)', [hash('sha256', $token), $id, timestamp($expires)]);
        sql($db, 'DELETE FROM staff_sessions WHERE expires_at<=?', [timestamp()]);
        return $name;
    });
    cookieLoja($token, $expires);
    resposta(['name'=>$name], $register ? 201 : 200);
}
