<?php
declare(strict_types=1);

function precos(PDO $db, string $method, array $config, string $actor): void {
    $categories = ['Telas', 'Baterias', 'Conectores', 'Outras peças'];
    if ($method === 'GET') {
        resposta(['prices'=>linhas($db, 'SELECT part_key,name,category,supplier,cost,service_price,revision FROM part_prices'), 'categories'=>$categories]);
        return;
    }
    if ($method !== 'POST') throw new Entrada('Método inválido.', 405);
    $data = payload($config, 4096);
    $key = campo($data, 'part_key', 'peça', 500, true);
    $manual = preg_match('/\Amanual:[a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12}\z/i', $key) === 1;
    $vendors = catalogo('parts-catalog.json');
    $name = $category = $supplier = null;
    if ($manual) {
        $name = campo($data, 'name', 'nome da peça', 160, true);
        $category = opcao($data['category'] ?? null, $categories, 'Escolha uma categoria.');
        $supplier = opcao($data['supplier'] ?? null, array_column($vendors, 'name'), 'Escolha um fornecedor.');
    } else {
        $exists = false;
        foreach ($vendors as $vendor) {
            if (in_array($key, array_column($vendor['products'], 'href'), true)) $exists = true;
        }
        if (!$exists) throw new Entrada('Peça não encontrada no catálogo.', 404);
    }
    $rev = inteiro($data, 'revision', 'versão do preço', 2147483646);
    $cost = array_key_exists('cost', $data) && $data['cost'] === null ? null : inteiro($data, 'cost', 'custo', LIMITE_MOEDA);
    $price = array_key_exists('service_price', $data) && $data['service_price'] === null ? null : inteiro($data, 'service_price', 'valor da troca', LIMITE_MOEDA);
    $values = [$name,$category,$supplier,$cost,$price,$rev + 1,$actor,timestamp()];
    transacao($db, function () use ($db, $key, $rev, $values) {
        $latest = unico($db, 'SELECT revision FROM part_prices WHERE part_key=?', [$key]);
        if ((int)($latest['revision'] ?? 0) !== $rev) throw new Entrada('Os valores desta peça mudaram. Reabra o preço para ver a última versão.', 409);
        if ($latest) sql($db, 'UPDATE part_prices SET name=?,category=?,supplier=?,cost=?,service_price=?,revision=?,updated_by=?,updated_at=? WHERE part_key=?', [...$values, $key]);
        else sql($db, 'INSERT INTO part_prices (name,category,supplier,cost,service_price,revision,updated_by,updated_at,part_key) VALUES (?,?,?,?,?,?,?,?,?)', [...$values, $key]);
    }, true);
    resposta(['part_key'=>$key,'name'=>$name,'category'=>$category,'supplier'=>$supplier,'cost'=>$cost,'service_price'=>$price,'revision'=>$rev + 1], $rev ? 200 : 201);
}
