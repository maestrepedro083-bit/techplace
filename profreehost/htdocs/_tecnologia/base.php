<?php
declare(strict_types=1);

const LIMITE_MOEDA = 99999999999;
const JSON_FLAGS = JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR;

final class Entrada extends RuntimeException {
    public function __construct(string $message, public readonly int $status = 400) { parent::__construct($message); }
}

function resposta(mixed $data, int $status = 200): void {
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: private, no-store');
    header('X-Content-Type-Options: nosniff');
    if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'HEAD') echo json_encode($data, JSON_FLAGS);
}

function sql(PDO $db, string $query, array $args = []): PDOStatement {
    $stmt = $db->prepare($query);
    foreach ($args as $n => $value) {
        $stmt->bindValue($n + 1, $value, match (true) {
            $value === null => PDO::PARAM_NULL,
            is_int($value) => PDO::PARAM_INT,
            default => PDO::PARAM_STR,
        });
    }
    $stmt->execute();
    return $stmt;
}

function unico(PDO $db, string $query, array $args = []): ?array {
    return sql($db, $query, $args)->fetch() ?: null;
}

function linhas(PDO $db, string $query, array $args = []): array {
    return sql($db, $query, $args)->fetchAll();
}

function transacao(PDO $db, callable $action, bool $alterar = false): mixed {
    $db->beginTransaction();
    try {
        if ($alterar) {
            // Serialize stock, sales and revision updates in the same transaction.
            unico($db, 'SELECT version FROM shop_revision WHERE id=1 FOR UPDATE');
        }
        $result = $action();
        if ($alterar) sql($db, 'UPDATE shop_revision SET version=version+1 WHERE id=1');
        $db->commit();
        return $result;
    } catch (Throwable $e) {
        if ($db->inTransaction()) $db->rollBack();
        throw $e;
    }
}

function timestamp(?int $unix = null): string {
    if ($unix !== null) return gmdate('Y-m-d\TH:i:s.000\Z', $unix);
    return (new DateTimeImmutable('now', new DateTimeZone('UTC')))->format('Y-m-d\TH:i:s.v\Z');
}

function uid(): string {
    $b = random_bytes(16);
    $b[6] = chr((ord($b[6]) & 0x0f) | 0x40);
    $b[8] = chr((ord($b[8]) & 0x3f) | 0x80);
    $hex = bin2hex($b);
    return substr($hex, 0, 8) . '-' . substr($hex, 8, 4) . '-' . substr($hex, 12, 4) . '-' . substr($hex, 16, 4) . '-' . substr($hex, 20);
}

function id(mixed $value): string {
    if (!is_string($value) || preg_match('/\A[a-f0-9-]{36}\z/i', $value) !== 1) throw new Entrada('Identificador inválido.');
    return strtolower($value);
}

function comprimento(string $value): int {
    return function_exists('mb_strlen') ? mb_strlen($value, 'UTF-8') : preg_match_all('/./us', $value);
}

function campo(array $data, string $key, string $label, int $limit, bool $required = false): string {
    $value = is_string($data[$key] ?? null) ? trim($data[$key]) : '';
    if (($required && $value === '') || comprimento($value) > $limit) throw new Entrada('Confira o campo ' . $label . '.');
    return $value;
}

function inteiro(array $data, string $key, string $label, int $limit, int $min = 0): int {
    $value = $data[$key] ?? null;
    if (!is_int($value) || $value < $min || $value > $limit) throw new Entrada('Informe um valor válido para ' . $label . '.');
    return $value;
}

function opcao(mixed $value, array $values, string $message): string {
    if (!in_array($value, $values, true)) throw new Entrada($message);
    return $value;
}

function dia(mixed $value): string {
    if (!is_string($value) || preg_match('/\A(\d{4})-(\d{2})-(\d{2})\z/', $value, $m) !== 1 ||
        $m[1] < 1900 || !checkdate((int)$m[2], (int)$m[3], (int)$m[1])) throw new Entrada('Informe uma data válida.');
    return $value;
}

function periodo(array $query): array {
    $start = dia($query['start'] ?? null);
    $end = dia($query['end'] ?? null);
    if ($start > $end) throw new Entrada('A data final deve ser igual ou posterior à inicial.');
    return [$start, $end];
}

function urlFonte(array $data): string {
    $url = campo($data, 'source_url', 'link da fonte', 350);
    if ($url === '') return '';
    $parts = parse_url($url);
    if (($parts['scheme'] ?? '') !== 'https' || empty($parts['host']) || isset($parts['user']) || isset($parts['pass'])) throw new Entrada('Use um link HTTPS da fonte.');
    return $url;
}

function verificaOrigem(array $config): void {
    if (($_SERVER['HTTP_ORIGIN'] ?? '') !== $config['origem']) throw new Entrada('Origem inválida. Confira o endereço HTTPS na configuração.', 403);
}

function payload(array $config, int $limit = 12000): array {
    verificaOrigem($config);
    if (!str_starts_with(strtolower($_SERVER['CONTENT_TYPE'] ?? ''), 'application/json')) throw new Entrada('Formato de dados inválido.', 415);
    if ((int)($_SERVER['CONTENT_LENGTH'] ?? 0) > $limit) throw new Entrada('Dados muito longos.', 413);
    $raw = file_get_contents('php://input', false, null, 0, $limit + 1);
    if ($raw === false || strlen($raw) > $limit) throw new Entrada('Dados inválidos ou muito longos.', 413);
    try { $data = json_decode($raw, true, 48, JSON_THROW_ON_ERROR); }
    catch (JsonException) { throw new Entrada('Formato de dados inválido.'); }
    if (!is_array($data) || array_is_list($data)) throw new Entrada('Dados inválidos.');
    return $data;
}

function protegido(string $file): string {
    return __DIR__ . DIRECTORY_SEPARATOR . $file;
}

function catalogo(string $file): array {
    $data = file_get_contents(protegido($file));
    if ($data === false) throw new RuntimeException('Catálogo indisponível.');
    return json_decode($data, true, 512, JSON_THROW_ON_ERROR);
}
