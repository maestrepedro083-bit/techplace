<?php
declare(strict_types=1);

function waInstall(PDO $db): void {
    $definitions = [
        "tp_wa_clients (client_id CHAR(36) PRIMARY KEY, phone VARCHAR(16) NOT NULL, consent TINYINT NOT NULL, test_allowed TINYINT NOT NULL, actor CHAR(36) NOT NULL, updated_at VARCHAR(24) NOT NULL)",
        "tp_wa_stage (order_id CHAR(36) PRIMARY KEY, stage VARCHAR(24) NOT NULL, source_version VARCHAR(24) NOT NULL)",
        "tp_wa_rewards (id CHAR(36) PRIMARY KEY, client_id CHAR(36) NOT NULL, kind VARCHAR(12) NOT NULL, reward_year CHAR(4) NULL, label VARCHAR(160) NOT NULL, granted_at VARCHAR(24) NOT NULL, used_at VARCHAR(24) NULL, used_by CHAR(36) NULL, revoked_at VARCHAR(24) NULL, UNIQUE KEY(client_id,kind,reward_year))",
        "tp_wa_credits (kind VARCHAR(12) NOT NULL, record_id VARCHAR(90) CHARACTER SET ascii COLLATE ascii_bin NOT NULL, reward_id CHAR(36) NOT NULL, PRIMARY KEY(kind,record_id))",
        "tp_wa_messages (id CHAR(36) PRIMARY KEY, event_key CHAR(64) NOT NULL UNIQUE, day DATE NOT NULL, client_id CHAR(36) NOT NULL, actor CHAR(36) NOT NULL, mode VARCHAR(8) NOT NULL, phone VARCHAR(16) NOT NULL, kind VARCHAR(16) NOT NULL, body TEXT NOT NULL, state VARCHAR(20) NOT NULL, provider_id VARCHAR(120) NULL, created_at VARCHAR(24) NOT NULL, updated_at VARCHAR(24) NOT NULL, KEY(day), KEY(client_id,created_at))",
        "tp_wa_lock (id INT PRIMARY KEY)",
    ];
    foreach ($definitions as $definition) $db->exec('CREATE TABLE IF NOT EXISTS '.$definition.' ENGINE=InnoDB DEFAULT CHARSET=utf8mb4');
    $db->exec('INSERT IGNORE INTO tp_wa_lock(id) VALUES(1)');
}

function waPhone(mixed $phone): string {
    $digits = preg_replace('/\D/', '', is_string($phone) ? $phone : '');
    if (in_array(strlen($digits), [10, 11], true)) $digits = '55'.$digits;
    return preg_match('/^55[1-9]\d{9,10}$/D', $digits) ? $digits : '';
}

function waToday(): DateTimeImmutable {
    return new DateTimeImmutable('now', new DateTimeZone('America/Sao_Paulo'));
}

function waRules(PDO $db, bool $lock = false): array {
    $row = unico($db, 'SELECT purchase_target,service_target,purchase_reward,service_reward,birthday_reward FROM tp_crm_rules_v1 WHERE id=1'.($lock?' FOR UPDATE':''));
    if (!$row) throw new Entrada('Ative as regras da fidelidade no CRM.', 409);
    return $row;
}

function waClient(PDO $db, string $id): array {
    $row = unico($db, 'SELECT c.id,c.name,c.phone,c.birthday,c.marketing,w.phone consent_phone,w.consent,w.test_allowed
      FROM tp_crm_clients_v1 c LEFT JOIN tp_wa_clients w ON w.client_id=c.id WHERE c.id=?', [$id]);
    if (!$row) throw new Entrada('Cliente não encontrado.', 404);
    $row['phone'] = waPhone($row['phone']);
    $same = $row['phone'] !== '' && $row['phone'] === $row['consent_phone'];
    $row['consent'] = $same && (bool)$row['consent'];
    $row['test_allowed'] = $same && (bool)$row['test_allowed'];
    return $row;
}

function waReconcile(PDO $db, string $client): void {
    $rows=linhas($db,"SELECT DISTINCT r.id FROM tp_wa_rewards r JOIN tp_wa_credits u ON u.reward_id=r.id
      LEFT JOIN sales s ON u.kind='purchase' AND s.id=u.record_id
      LEFT JOIN service_orders o ON u.kind='service' AND o.id=u.record_id
      WHERE r.client_id=? AND r.used_at IS NULL AND r.revoked_at IS NULL AND
        ((u.kind='purchase' AND (s.id IS NULL OR s.finalized<>1 OR s.voided_at IS NOT NULL))
          OR (u.kind='service' AND (o.id IS NULL OR o.status<>'done' OR o.deleted_at IS NOT NULL)))", [$client]);
    foreach ($rows as $row) {
        sql($db,'UPDATE tp_wa_rewards SET revoked_at=? WHERE id=?',[timestamp(),$row['id']]);
        sql($db,'DELETE FROM tp_wa_credits WHERE reward_id=?',[$row['id']]);
    }
}

function waBirthdayReward(PDO $db, array $client, array $rules): ?array {
    $today=waToday();
    if (!$client['birthday'] || substr($client['birthday'],5,2)!==$today->format('m')) return null;
    $period=$today->format('Y');
    $existing=unico($db,"SELECT id,label,used_at FROM tp_wa_rewards WHERE client_id=? AND kind='birthday' AND reward_year=?",[$client['id'],$period]);
    if ($existing) return $existing;
    $id=uid();
    $label=$rules['birthday_reward'];
    sql($db,"INSERT INTO tp_wa_rewards(id,client_id,kind,reward_year,label,granted_at) VALUES(?,?,'birthday',?,?,?)",
       [$id,$client['id'],$period,$label,timestamp()]);
    return ['id'=>$id,'label'=>$label,'used_at'=>null];
}

// Each eligible record can fund one earned reward. The original reward wording is saved.
function waLoyalty(PDO $db, string $client, array $rules): array {
    waReconcile($db,$client);
    $sources = [
        'purchase' => ["sales s", "s.finalized=1 AND s.voided_at IS NULL", "s.day,s.number"],
        'service' => ["service_orders s", "s.status='done' AND s.deleted_at IS NULL", "s.updated_at,s.number"],
    ];
    $progress = [];
    foreach ($sources as $kind => [$table, $filter, $order]) {
        $records = linhas($db, "SELECT s.id FROM $table JOIN tp_crm_links_v1 l ON l.record_id=s.id
            LEFT JOIN tp_wa_credits u ON u.kind=? AND u.record_id=s.id
            WHERE l.kind=? AND l.client_id=? AND $filter AND u.record_id IS NULL ORDER BY $order", [$kind,$kind==='purchase'?'sale':'service',$client]);
        $target = (int)$rules[$kind.'_target'];
        if ($target < 1) throw new Entrada('Confira as metas cadastradas.', 409);
        $label = $rules[$kind.'_reward'];
        $count = count($records);
        for ($offset = 0; $offset + $target <= $count; $offset += $target) {
            $reward = uid();
            sql($db, 'INSERT INTO tp_wa_rewards(id,client_id,kind,label,granted_at) VALUES(?,?,?,?,?)', [$reward,$client,$kind,$label,timestamp()]);
            foreach (array_slice($records,$offset,$target) as $record) {
                sql($db, 'INSERT INTO tp_wa_credits(kind,record_id,reward_id) VALUES(?,?,?)', [$kind,$record['id'],$reward]);
            }
        }
        $left = $count % $target;
        $progress[$kind] = ['count'=>$left,'target'=>$target,'missing'=>$target-$left,'label'=>$label];
    }
    return $progress;
}

// Runs inside the existing CRM rules transaction before changing the goal.
function waFreezeEarned(PDO $db): void {
    $rules = waRules($db, true);
    $rows = linhas($db, "SELECT DISTINCT client_id FROM tp_crm_links_v1 WHERE kind IN ('sale','service') ORDER BY client_id");
    foreach ($rows as $row) waLoyalty($db, $row['client_id'], $rules);
    $month=waToday()->format('m');
    foreach (linhas($db,'SELECT id,birthday FROM tp_crm_clients_v1 WHERE MONTH(birthday)=?',[(int)$month]) as $client) waBirthdayReward($db,$client,$rules);
}

function waOrder(PDO $db, string $id): array {
    $row = unico($db, "SELECT o.id,o.number,o.title,o.status,o.updated_at,l.client_id,l.warranty_start,l.warranty_days,l.warranty_terms,
      CASE WHEN st.source_version=o.updated_at THEN st.stage END custom_stage
      FROM service_orders o LEFT JOIN tp_crm_links_v1 l ON l.kind='service' AND l.record_id=o.id
      LEFT JOIN tp_wa_stage st ON st.order_id=o.id WHERE o.deleted_at IS NULL AND o.id=?", [$id]);
    if (!$row) throw new Entrada('Ordem de serviço não encontrada.', 404);
    $row['stage'] = match ($row['status']) {
        'open'=>'received', 'working'=>$row['custom_stage'], 'done'=>'ready', default=>null,
    };
    return $row;
}

function waStages(): array {
    return ['received'=>'Recebido','analysis'=>'Em análise','part'=>'Aguardando peça','repair'=>'Em manutenção','ready'=>'Pronto para retirada'];
}

function waRewards(PDO $db, string $client): array {
    return linhas($db,'SELECT id,kind,reward_year,label,granted_at,used_at FROM tp_wa_rewards WHERE client_id=? AND revoked_at IS NULL ORDER BY granted_at DESC,id',[$client]);
}

function waProfile(PDO $db, string $id): array {
    $client = waClient($db,$id);
    $progress = transacao($db,function() use ($db,$id,$client) {
        $rules=waRules($db,true);
        waBirthdayReward($db,$client,$rules);
        return waLoyalty($db,$id,$rules);
    });
    $last = unico($db,"SELECT MAX(s.day) last_purchase FROM sales s JOIN tp_crm_links_v1 l ON l.kind='sale' AND l.record_id=s.id
       WHERE l.client_id=? AND s.finalized=1 AND s.voided_at IS NULL",[$id]);
    return ['client'=>$client,'progress'=>$progress,'rewards'=>waRewards($db,$id),'last_purchase'=>$last['last_purchase']];
}

function waOverview(PDO $db, array $data): array {
    $offset = inteiro($data,'offset','página',1000000);
    $filter = opcao($data['filter']??null,['met','near','today','month'],'Filtro inválido.');
    $date = waToday()->format('m-d');
    if ($filter==='today' || $filter==='month') {
        $pattern = $filter==='today' ? $date : substr($date,0,2).'-%';
        $rows=linhas($db,"SELECT id,name,birthday FROM tp_crm_clients_v1 WHERE DATE_FORMAT(birthday,'%m-%d') LIKE ?
          ORDER BY DAY(birthday),name,id LIMIT 26 OFFSET ".$offset,[$pattern]);
        return ['rows'=>array_slice($rows,0,25),'next'=>count($rows)>25?$offset+25:null];
    }
    // Count current eligible records once per customer. Earned reward text is assigned
    // on opening the profile and before changing existing rules.
    $rules=waRules($db);
    $sql = "SELECT c.id,c.name,c.birthday,COALESCE(p.available,0) purchases,COALESCE(s.available,0) services,
          EXISTS(SELECT 1 FROM tp_wa_rewards r WHERE r.client_id=c.id AND r.kind<>'birthday' AND r.revoked_at IS NULL AND r.used_at IS NULL) earned
        FROM tp_crm_clients_v1 c
        LEFT JOIN (SELECT l.client_id,COUNT(*) available FROM tp_crm_links_v1 l JOIN sales x ON x.id=l.record_id
          LEFT JOIN tp_wa_credits u ON u.kind='purchase' AND u.record_id=x.id WHERE l.kind='sale'
          AND x.finalized=1 AND x.voided_at IS NULL AND u.record_id IS NULL GROUP BY l.client_id) p ON p.client_id=c.id
        LEFT JOIN (SELECT l.client_id,COUNT(*) available FROM tp_crm_links_v1 l JOIN service_orders x ON x.id=l.record_id
          LEFT JOIN tp_wa_credits u ON u.kind='service' AND u.record_id=x.id WHERE l.kind='service'
          AND x.status='done' AND x.deleted_at IS NULL AND u.record_id IS NULL GROUP BY l.client_id) s ON s.client_id=c.id";
    $condition = $filter==='met'
        ? 'earned=1 OR purchases>=? OR services>=?'
        : 'earned=0 AND purchases<? AND services<? AND (purchases>=? OR services>=?)';
    $p=(int)$rules['purchase_target']; $s=(int)$rules['service_target'];
    $args=$filter==='met'?[$p,$s]:[$p,$s,max(1,$p-1),max(1,$s-1)];
    $rows = linhas($db,"SELECT * FROM ($sql) x WHERE $condition ORDER BY name,id LIMIT 26 OFFSET ".$offset,$args);
    return ['rows'=>array_slice($rows,0,25),'next'=>count($rows)>25?$offset+25:null];
}
