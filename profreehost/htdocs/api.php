<?php
declare(strict_types=1);

require __DIR__ . '/_tecnologia/base.php';
require protegido('acesso.php');
require protegido('loja.php');
require protegido('precos.php');
require protegido('anexos.php');

try {
    $config = require protegido('config.php');
    if (filter_var($config['origem'], FILTER_VALIDATE_URL) === false || !str_starts_with($config['origem'], 'https://')) {
        throw new Entrada('Informe o endereço HTTPS na configuração do painel.', 503);
    }
    $db = new PDO('mysql:host=' . $config['mysql_host'] . ';dbname=' . $config['mysql_database'] . ';charset=utf8mb4',
        $config['mysql_user'], $config['mysql_password'], [
            PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE=>PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES=>false, PDO::ATTR_STRINGIFY_FETCHES=>false
        ]);
    $path = parse_url($_SERVER['REQUEST_URI'] ?? '', PHP_URL_PATH);
    $method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
    if ($path === '/api/acesso') { acesso($db, $method, $config); return; }
    $account = contaAtual($db);
    if (!$account) throw new Entrada('Entre com sua conta para acessar a loja.', 401);
    $actor = $account['name'];
    if ($path === '/parts-catalog.json' || $path === '/film-catalog.json') {
        if ($method !== 'GET' && $method !== 'HEAD') throw new Entrada('Método inválido.', 405);
        resposta(catalogo(basename($path)));
        return;
    }
    if (preg_match('#\A/api/ordens/([\da-f-]{36})/midia(?:/([\da-f-]{36}))?\z#i', $path ?? '', $match)) {
        anexos($db,$method,$config,id($match[1]),isset($match[2]) ? id($match[2]) : null,$actor);
        return;
    }
    if ($path === '/api/precos') { precos($db,$method,$config,$actor); return; }
    if ($method === 'GET') {
        match ($path) {
            '/api/alteracoes' => resposta(unico($db, 'SELECT version FROM shop_revision WHERE id=1')),
            '/api/loja' => resposta(resumo($db, $_GET)),
            '/api/vendas' => resposta(consultaVendas($db, $_GET)),
            '/api/conhecimento' => resposta(conhecimento($db)),
            default => throw new Entrada('Página não encontrada.', 404),
        };
        return;
    }
    if ($method === 'POST' && $path === '/api/loja') {
        salvar($db, payload($config), $actor);
        resposta(['ok'=>true]);
        return;
    }
    throw new Entrada('Método inválido.', 405);
} catch (Entrada $e) {
    resposta(['error'=>$e->getMessage()], $e->status);
} catch (PDOException $e) {
    $mysqlError = $e->errorInfo[1] ?? null;
    if ($mysqlError === 1062) {
        resposta(['error'=>'Este código ou nome já está em uso.'],409);
    } elseif ($mysqlError === 1452) {
        resposta(['error'=>'O registro vinculado não está disponível.'],409);
    } else {
        error_log('Tech Place MySQL: ' . $e->getCode());
        resposta(['error'=>'Não foi possível consultar o banco. Confira a configuração MySQL do painel.'],503);
    }
} catch (Throwable $e) {
    error_log('Tech Place: ' . get_class($e));
    resposta(['error'=>'Não foi possível concluir a operação.'],500);
}
