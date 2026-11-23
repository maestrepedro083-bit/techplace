<?php
declare(strict_types=1);

function adicionar(PDO $db, string $table, array $values): void {
    $keys = array_keys($values);
    $columns = implode(',', array_map(fn ($key) => '`' . $key . '`', $keys));
    sql($db, 'INSERT INTO ' . $table . ' (' . $columns . ') VALUES (' . implode(',', array_fill(0, count($keys), '?')) . ')', array_values($values));
}

function existente(PDO $db, string $table, string $id): ?array {
    return unico($db, 'SELECT * FROM ' . $table . ' WHERE id=?', [$id]);
}

function editar(PDO $db, array $data, string $table, string $id, array $changes, string $flag = 'deleted_at'): void {
    $previous = id($data['revision'] ?? null);
    $revision = id($data['operation'] ?? null);
    $changes['revision'] = $revision;
    $set = implode(',', array_map(fn ($key) => '`' . $key . '`=?', array_keys($changes)));
    $result = sql($db, 'UPDATE ' . $table . ' SET ' . $set . ' WHERE id=? AND revision=? AND ' . $flag . ' IS NULL',
        [...array_values($changes), $id, $previous]);
    if (!$result->rowCount() && (existente($db,$table,$id)['revision'] ?? null) !== $revision) {
        throw new Entrada('O registro mudou. Atualize o painel e tente novamente.',409);
    }
}

function camposProduto(array $d): array {
    return [
        'code'=>campo($d,'code','código',45,true), 'name'=>campo($d,'name','nome',100,true),
        'category'=>campo($d,'category','categoria',60,true), 'supplier'=>campo($d,'supplier','fornecedor',100),
        'unit'=>campo($d,'unit','unidade',20,true), 'min_qty'=>inteiro($d,'min_qty','estoque mínimo',100000000),
        'cost'=>inteiro($d,'cost','custo unitário',LIMITE_MOEDA), 'price'=>inteiro($d,'price','preço de venda',LIMITE_MOEDA),
        'notes'=>campo($d,'notes','observações',500)
    ];
}

function camposCaixa(array $d): array {
    return [
        'kind'=>opcao($d['kind'] ?? null,['in','out'],'Escolha entrada ou saída.'),
        'amount'=>inteiro($d,'amount','valor',LIMITE_MOEDA,1), 'day'=>dia($d['day'] ?? null),
        'description'=>campo($d,'description','descrição',120,true), 'category'=>campo($d,'category','categoria',60,true),
        'payment'=>campo($d,'payment','forma de pagamento',40,true), 'contact'=>campo($d,'contact','cliente ou fornecedor',100),
        'reference'=>campo($d,'reference','número do documento',70), 'notes'=>campo($d,'notes','observações',500)
    ];
}

function camposServico(array $d): array {
    return [
        'title'=>campo($d,'title','serviço',120,true), 'customer'=>campo($d,'customer','cliente',100,true),
        'phone'=>campo($d,'phone','telefone',32),
        'status'=>opcao($d['status'] ?? null,['open','working','done','canceled'],'Escolha a situação da ordem de serviço.'),
        'due_day'=>empty($d['due_day']) ? null : dia($d['due_day']),
        'amount'=>array_key_exists('amount',$d) && $d['amount'] === null ? null : inteiro($d,'amount','valor',LIMITE_MOEDA),
        'notes'=>campo($d,'notes','observações',500)
    ];
}

function topico(array $d): string {
    return opcao($d['topic'] ?? null,catalogo('topics.json'),'Escolha um assunto da base de conhecimento.');
}

function camposGuia(array $d): array {
    $status = opcao($d['status'] ?? null,['draft','published'],'Escolha a situação do guia.');
    return [
        'topic'=>topico($d), 'title'=>campo($d,'title','título',120,true),
        'body'=>campo($d,'body','conteúdo',3000,$status === 'published'),
        'evidence'=>campo($d,'evidence','origem ou confirmação',220,$status === 'published'),
        'source_url'=>urlFonte($d), 'status'=>$status
    ];
}

function camposPelicula(array $d): array {
    $types = ['Vidro temperado','Vidro 3D','Vidro 3D de privacidade','Cerâmica','Cerâmica de privacidade','Hidrogel','Filme UV','TPU','Outro'];
    $models = preg_split('/\r?\n/', campo($d,'models','modelos',2800,true));
    $models = array_values(array_unique(array_filter(array_map('trim',$models),fn ($m) => $m !== '')));
    if (!$models || count($models) > 40) throw new Entrada('Informe até 40 modelos, um por linha.');
    foreach ($models as $model) if (comprimento($model) > 75) throw new Entrada('Cada modelo pode ter até 75 caracteres.');
    return [
        'label'=>campo($d,'label','nome da película',120,true), 'type'=>opcao($d['type'] ?? null,$types,'Escolha o tipo de película.'),
        'models'=>json_encode($models,JSON_FLAGS), 'product_id'=>empty($d['product_id']) ? null : id($d['product_id']),
        'source_url'=>urlFonte($d), 'notes'=>campo($d,'notes','observações',500)
    ];
}

function resumo(PDO $db, array $query): array {
    $range = periodo($query);
    return transacao($db, function () use ($db,$range) {
        $films = linhas($db,'SELECT * FROM film_families WHERE deleted_at IS NULL ORDER BY label');
        foreach ($films as &$film) $film['models'] = json_decode($film['models'],true,512,JSON_THROW_ON_ERROR);
        unset($film);
        $sales = unico($db,"SELECT COUNT(*) AS count,COALESCE(SUM(amount),0) AS amount,COALESCE(SUM(cost),0) AS cost
            FROM sales WHERE finalized=1 AND voided_at IS NULL AND day BETWEEN ? AND ?",$range);
        return [
            'version'=>(int)unico($db,'SELECT version FROM shop_revision WHERE id=1')['version'],
            'products'=>linhas($db,'SELECT * FROM products WHERE deleted_at IS NULL ORDER BY name,code'),
            'movements'=>linhas($db,'SELECT m.*,p.name,p.code,p.unit FROM stock_moves m JOIN products p ON p.id=m.product_id ORDER BY m.created_at DESC LIMIT 300'),
            'cash'=>linhas($db,'SELECT * FROM cash_entries WHERE day BETWEEN ? AND ? ORDER BY day DESC,created_at DESC',$range),
            'orders'=>linhas($db,"SELECT o.*, (SELECT COUNT(*) FROM service_media m WHERE m.order_id=o.id AND m.status='ready'
                AND m.deleted_at IS NULL) AS media_count FROM service_orders o WHERE o.deleted_at IS NULL ORDER BY o.number DESC"),
            'salesSummary'=>array_map('intval',$sales),'films'=>$films
        ];
    });
}

function conhecimento(PDO $db): array {
    return transacao($db, function () use ($db) {
        $guides = linhas($db,'SELECT * FROM knowledge_guides WHERE deleted_at IS NULL ORDER BY updated_at DESC');
        $stats = linhas($db,"SELECT e.topic, COUNT(*) total,
          SUM(CASE WHEN e.feedback='helpful' THEN 1 ELSE 0 END) helpful,
          SUM(CASE WHEN e.feedback='improve' AND COALESCE(e.feedback_at,e.created_at)>COALESCE(a.reviewed_at,'') THEN 1 ELSE 0 END) improvement,
          SUM(CASE WHEN (e.feedback='improve' OR (e.outcome='unanswered' AND COALESCE(e.feedback,'')<>'helpful'))
          AND COALESCE(e.feedback_at,e.created_at)>COALESCE(a.reviewed_at,'') THEN 1 ELSE 0 END) pending
          FROM knowledge_events e LEFT JOIN (
            SELECT topic,MAX(updated_at) AS reviewed_at FROM knowledge_guides WHERE status='published' AND deleted_at IS NULL GROUP BY topic
          ) a ON a.topic=e.topic WHERE e.created_at>=? GROUP BY e.topic",[timestamp(time() - 30 * 86400)]);
        foreach ($stats as &$row) foreach (['total','helpful','improvement','pending'] as $key) $row[$key] = (int)$row[$key];
        unset($row);
        return ['guides'=>$guides,'stats'=>$stats];
    });
}

function consultaVendas(PDO $db, array $query): array {
    $single = !empty($query['id']);
    $args = $single ? [id($query['id'])] : periodo($query);
    $condition = $single ? 's.id=?' : 's.day BETWEEN ? AND ?';
    return transacao($db, function () use ($db,$single,$args,$condition) {
        $sales = linhas($db,'SELECT s.* FROM sales s WHERE s.finalized=1 AND ' . $condition . ' ORDER BY s.day DESC,s.number DESC',$args);
        if ($single && !$sales) throw new Entrada('Venda não encontrada.',404);
        $items = linhas($db,'SELECT i.* FROM sale_items i JOIN sales s ON i.sale_id=s.id WHERE s.finalized=1 AND ' . $condition . ' ORDER BY i.name,i.code',$args);
        return ['sales'=>$sales,'items'=>$items];
    });
}

function movimento(PDO $db, string $moveId, string $product, int $delta, string $reason, string $notes, string $actor, string $stamp): void {
    $row = existente($db,'products',$product);
    if (!$row) throw new Entrada('Produto não encontrado.',404);
    $quantity = (int)$row['qty'] + $delta;
    if ($quantity < 0 || $quantity > 100000000) throw new Entrada('Quantidade indisponível ou acima do limite de estoque.',409);
    sql($db,'UPDATE products SET qty=?,updated_at=? WHERE id=?',[$quantity,$stamp,$product]);
    adicionar($db,'stock_moves',['id'=>$moveId,'product_id'=>$product,'delta'=>$delta,'reason'=>$reason,'notes'=>$notes,'actor'=>$actor,'created_at'=>$stamp]);
}

function criarVenda(PDO $db, array $d, string $id, string $actor, string $stamp): void {
    if (existente($db,'sales',$id)) return;
    $items = $d['items'] ?? null;
    if (!is_array($items) || !array_is_list($items) || count($items) < 1 || count($items) > 20) throw new Entrada('Selecione de 1 a 20 produtos na venda.');
    $day = dia($d['day'] ?? null);
    $payment = opcao($d['payment'] ?? null,['Pix','Dinheiro','Cartão de débito','Cartão de crédito','Transferência','Boleto','Outro'],'Escolha a forma de pagamento.');
    $customer = campo($d,'customer','cliente',100);
    $notes = campo($d,'notes','observações',500);
    $lines = [];
    $amount = $cost = 0;
    foreach ($items as $item) {
        if (!is_array($item)) throw new Entrada('Confira os produtos da venda.');
        $pid = id($item['product_id'] ?? null);
        if (isset($lines[$pid])) throw new Entrada('Some as quantidades de cada produto em uma única linha.');
        $p = existente($db,'products',$pid);
        if (!$p || $p['deleted_at']) throw new Entrada('Um dos produtos não está disponível.',404);
        $qty = inteiro($item,'qty','quantidade',100000000,1);
        $unitCost = inteiro($item,'unit_cost','custo unitário da venda',LIMITE_MOEDA);
        $unitPrice = inteiro($item,'unit_price','preço unitário da venda',LIMITE_MOEDA);
        $amount += $qty * $unitPrice;
        $cost += $qty * $unitCost;
        if ($amount > LIMITE_MOEDA || $cost > LIMITE_MOEDA) throw new Entrada('Confira o limite dos valores da venda.');
        $lines[$pid] = ['sale_id'=>$id,'product_id'=>$pid,'code'=>$p['code'],'name'=>$p['name'],
            'unit'=>$p['unit'],'qty'=>$qty,'unit_cost'=>$unitCost,'unit_price'=>$unitPrice];
    }
    if ($amount < 1) throw new Entrada('Informe um total de venda positivo.');
    adicionar($db,'sales',['id'=>$id,'day'=>$day,'payment'=>$payment,'customer'=>$customer,'notes'=>$notes,
        'amount'=>$amount,'cost'=>$cost,'actor'=>$actor,'created_at'=>$stamp,'finalized'=>1]);
    $number = sprintf('%04d',(int)$db->lastInsertId());
    foreach ($lines as $pid => $line) {
        adicionar($db,'sale_items',$line);
        movimento($db,$id . ':' . $pid,$pid,-$line['qty'],'Venda','Venda #' . $number,$actor,$stamp);
    }
    $description = count($lines) === 1 ? reset($lines)['name'] : count($lines) . ' produtos';
    $cashDescription = 'Venda #' . $number . ' · ' . $description;
    adicionar($db,'cash_entries',['id'=>$id,'kind'=>'in','amount'=>$amount,'day'=>$day,'description'=>function_exists('mb_substr')
        ? mb_substr($cashDescription,0,120,'UTF-8') : $cashDescription,'category'=>'Venda de produto','payment'=>$payment,
        'contact'=>$customer,'reference'=>'Venda #' . $number,'notes'=>$notes,'actor'=>$actor,'created_at'=>$stamp,
        'updated_by'=>$actor,'updated_at'=>$stamp,'revision'=>$id,'sale_id'=>$id]);
}

function estornarVenda(PDO $db, array $d, string $id, string $actor, string $stamp): void {
    $sale = existente($db,'sales',$id);
    if (!$sale || (int)$sale['finalized'] !== 1) throw new Entrada('Venda não encontrada.',404);
    if ($sale['voided_at']) return;
    $reason = campo($d,'reason','motivo do estorno',120,true);
    foreach (linhas($db,'SELECT product_id,qty FROM sale_items WHERE sale_id=?',[$id]) as $line) {
        $pid = $line['product_id'];
        movimento($db,$id . ':void:' . $pid,$pid,(int)$line['qty'],'Estorno de venda',
            'Venda #' . sprintf('%04d',$sale['number']) . ' · ' . $reason,$actor,$stamp);
    }
    sql($db,'UPDATE cash_entries SET voided_at=?,updated_by=?,updated_at=?,revision=? WHERE sale_id=? AND voided_at IS NULL',[$stamp,$actor,$stamp,uid(),$id]);
    sql($db,'UPDATE sales SET voided_at=?,voided_by=?,void_reason=? WHERE id=?',[$stamp,$actor,$reason,$id]);
}

function salvar(PDO $db, array $d, string $actor): void {
    $id = id($d['id'] ?? null);
    $action = $d['action'] ?? '';
    if (!is_string($action)) throw new Entrada('Operação inválida.');
    $stamp = timestamp();
    transacao($db, function () use ($db,$d,$id,$action,$actor,$stamp) {
        $groups = [
            'product'=>['products','camposProduto',[]],
            'cash'=>['cash_entries','camposCaixa',['updated_by'=>$actor]],
            'service'=>['service_orders','camposServico',['updated_by'=>$actor]],
            'guide'=>['knowledge_guides','camposGuia',['actor'=>$actor]],
            'film'=>['film_families','camposPelicula',['actor'=>$actor]]
        ];
        [$group,$operation] = array_pad(explode('-', $action, 2), 2, '');
        if (isset($groups[$group]) && in_array($operation,['add','edit','delete','void'],true)) {
            [$table,$fields,$updated] = $groups[$group];
            if (($group === 'cash' && $operation === 'delete') || ($group !== 'cash' && $operation === 'void')) throw new Entrada('Operação inválida.');
            $existing = existente($db,$table,$id);
            if ($group === 'cash' && !empty($existing['sale_id'])) throw new Entrada('Use a aba Vendas para estornar este lançamento vinculado.',409);
            $common = ['updated_at'=>$stamp,...$updated];
            if ($operation === 'add') {
                if ($existing) return;
                $row = ['id'=>$id,'revision'=>$id,...$fields($d),...$common];
                if (in_array($group,['cash','service'],true)) $row += ['actor'=>$actor,'created_at'=>$stamp];
                if ($group === 'product') $row['qty'] = 0;
                adicionar($db,$table,$row);
                if ($group === 'product' && ($qty = inteiro($d,'qty','estoque inicial',100000000))) {
                    movimento($db,$id,$id,$qty,'Saldo inicial','',$actor,$stamp);
                }
            } elseif ($operation === 'edit') {
                editar($db,$d,$table,$id,[...$fields($d),...$common],$group === 'cash' ? 'voided_at' : 'deleted_at');
            } elseif ($operation === 'void') {
                editar($db,$d,$table,$id,['voided_at'=>$stamp,...$common],'voided_at');
            } else {
                editar($db,$d,$table,$id,['deleted_at'=>$stamp,'updated_at'=>$stamp]);
            }
            return;
        }
        switch ($action) {
            case 'sale-add': criarVenda($db,$d,$id,$actor,$stamp); return;
            case 'sale-void': estornarVenda($db,$d,$id,$actor,$stamp); return;
            case 'stock-move':
                $product = id($d['product_id'] ?? null);
                $previous = existente($db,'stock_moves',$id);
                if ($previous && $previous['product_id'] === $product) return;
                if ($previous) throw new Entrada('O identificador já foi utilizado.',409);
                $p = existente($db,'products',$product);
                if (!$p || $p['deleted_at']) throw new Entrada('Produto não encontrado.',404);
                $kind = opcao($d['kind'] ?? null,['in','out'],'Escolha entrada ou saída.');
                $qty = inteiro($d,'qty','quantidade',100000000,1);
                movimento($db,$id,$product,$kind === 'out' ? -$qty : $qty,campo($d,'reason','motivo',80,true),campo($d,'notes','observações',500),$actor,$stamp);
                return;
            case 'knowledge-event':
                if (existente($db,'knowledge_events',$id)) return;
                $outcome = opcao($d['outcome'] ?? null,['guide','records','draft','unanswered'],'Resultado inválido.');
                adicionar($db,'knowledge_events',['id'=>$id,'topic'=>topico($d),'outcome'=>$outcome,'created_at'=>$stamp]);
                return;
            case 'knowledge-feedback':
                $feedback = opcao($d['feedback'] ?? null,['helpful','improve'],'Avaliação inválida.');
                if (!existente($db,'knowledge_events',$id)) throw new Entrada('Consulta não encontrada.',404);
                sql($db,'UPDATE knowledge_events SET feedback=?,feedback_at=? WHERE id=?',[$feedback,$stamp,$id]);
                return;
            default: throw new Entrada('Operação inválida.');
        }
    }, true);
}
