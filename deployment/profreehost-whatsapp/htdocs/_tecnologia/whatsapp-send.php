<?php
declare(strict_types=1);

function waCloud(array $cfg, array $data): array {
    $url = $cfg['url'] ?? '';
    $secret = $cfg['token'] ?? '';
    if (!is_string($secret) || !preg_match('/^[a-f0-9]{64}$/D',$secret)
        || !is_string($url) || !preg_match('#^https://[a-z0-9.-]+(?::[0-9]+)?/?$#iD',$url)
        || !function_exists('curl_init')) {
        throw new Entrada('Configure o serviço HTTPS do WhatsApp na hospedagem.',503);
    }
    $curl = curl_init(rtrim($url,'/').'/techplace');
    if (!empty($cfg['pin_public_host'])) {
        $host=parse_url($url,PHP_URL_HOST);
        $addresses=is_string($host)?gethostbynamel($host):false;
        $ip=false;
        foreach ($addresses?:[] as $address) {
            if (filter_var($address,FILTER_VALIDATE_IP,FILTER_FLAG_IPV4|FILTER_FLAG_GLOBAL_RANGE)!==false) { $ip=$address; break; }
        }
        if ($ip===false) throw new Entrada('O servidor precisa ter um endereço público válido.',400);
        curl_setopt($curl,CURLOPT_RESOLVE,[$host.':443:'.$ip]);
        curl_setopt($curl,CURLOPT_PROXY,'');
    }
    curl_setopt_array($curl, [
        CURLOPT_POST=>true, CURLOPT_POSTFIELDS=>json_encode($data,JSON_FLAGS), CURLOPT_RETURNTRANSFER=>true,
        CURLOPT_HTTPHEADER=>['Content-Type: application/json','Authorization: Bearer '.$secret],
        CURLOPT_FOLLOWLOCATION=>false, CURLOPT_CONNECTTIMEOUT=>4, CURLOPT_TIMEOUT=>12,
        CURLOPT_SSL_VERIFYPEER=>true, CURLOPT_SSL_VERIFYHOST=>2,
    ]);
    $raw = curl_exec($curl);
    $status = curl_getinfo($curl,CURLINFO_HTTP_CODE);
    curl_close($curl);
    $json = is_string($raw) && strlen($raw)<150000 ? json_decode($raw,true) : null;
    if ($status !== 200 || !is_array($json)) throw new Entrada('Serviço do WhatsApp indisponível. Consulte o status antes de tentar novamente.',502);
    return $json;
}

function waDraft(PDO $db, array $data, string $mode): array {
    $today=waToday();
    $kind=opcao($data['kind']??null,['status','warranty','intake','benefit','discount','progress','birthday'],'Mensagem inválida.');
    $order=null; $warranty=null; $intake=null; $file=null;
    if (in_array($kind,['status','warranty','intake'],true)) {
        $order=waOrder($db,id($data['id']??null));
        if (!$order['client_id']) throw new Entrada('Vincule a ordem ao cadastro do cliente antes de enviar.',409);
    }
    $client=waClient($db,$order['client_id']??id($data['id']??null));
    if (!$client['consent']) throw new Entrada('Registre a autorização do cliente para o telefone atual antes de enviar.',409);
    if ($mode==='test' && !$client['test_allowed']) throw new Entrada('Este cliente não foi selecionado para teste.',409);
    if (in_array($kind,['benefit','discount','progress','birthday'],true) && !$client['marketing']) {
        throw new Entrada('O cliente precisa autorizar mensagens promocionais no cadastro.',409);
    }
    $key = '';
    $greeting='Olá, '.$client['name'].'! Aqui é da TechPlace Store.';
    switch ($kind) {
        case 'status':
            if (!$order['stage']) throw new Entrada('Registre a etapa atual do aparelho antes de enviar.',409);
            $key=$order['id'].':'.$order['stage'];
            $body="$greeting A situação do seu aparelho na OS #".$order['number'].' é: '.waStages()[$order['stage']].'.';
            break;
        case 'intake':
            if ($order['status']!=='open') throw new Entrada('A ordem precisa estar em preparo para enviar este documento.',409);
            $key=$order['id'];
            $body="$greeting Recebemos seu aparelho. A OS #".$order['number'].' está em preparo para avaliação. Segue a via da ordem de serviço em PDF.';
            $notes=(string)$order['notes'];
            $meta=str_starts_with($notes,'[TP-OS-1]')?json_decode(substr($notes,9),true):null;
            $intake=['client'=>array_intersect_key($client,array_flip(['name','phone'])),
                'order'=>array_intersect_key($order,array_flip(['number','title','created_at','due_day','amount'])),
                'problem'=>is_string($meta[0]??null)?$meta[0]:'','technician'=>is_string($meta[1]??null)?$meta[1]:''];
            $file='TechPlace-OS-'.str_pad((string)$order['number'],4,'0',STR_PAD_LEFT).'.pdf';
            break;
        case 'warranty':
            if ($order['status']!=='done' || !$order['warranty_start'] || !$order['warranty_days'] || !$order['warranty_terms']) {
                throw new Entrada('Registre a garantia da ordem concluída antes de enviar.',409);
            }
            $key=$order['id'].':'.$order['warranty_start'].':'.$order['warranty_days'].':'.hash('sha256',$order['warranty_terms']);
            $body="$greeting Segue em anexo o termo de garantia do serviço registrado na OS #".$order['number'].'. Em caso de dúvidas, estamos à disposição.';
            $warranty=['client'=>array_intersect_key($client,array_flip(['name','phone'])),
                'order'=>array_intersect_key($order,array_flip(['number','title','warranty_start','warranty_days','warranty_terms']))];
            $file='TechPlace-Garantia-OS-'.(int)$order['number'].'.pdf';
            break;
        case 'birthday':
            if (!$client['birthday'] || substr($client['birthday'],5,2)!==$today->format('m')) throw new Entrada('O aniversário precisa ser neste mês.',409);
            $reward=waBirthdayReward($db,$client,waRules($db,true));
            if (!$reward || $reward['used_at']) throw new Entrada('O benefício de aniversário já foi utilizado.',409);
            $body='Parabéns, '.$client['name'].'! A equipe da TechPlace Store deseja um feliz aniversário. Seu benefício especial deste mês é: '.$reward['label'].'.';
            $key=$today->format('Y');
            break;
        case 'benefit':
        case 'discount':
            waRules($db,true);
            waReconcile($db,$client['id']);
            $reward=unico($db,"SELECT id,label FROM tp_wa_rewards WHERE id=? AND client_id=? AND kind<>'birthday' AND used_at IS NULL AND revoked_at IS NULL",[id($data['reward']??null),$client['id']]);
            if (!$reward) throw new Entrada('Este benefício já foi usado ou não está disponível.',409);
            $key=$reward['id'];
            $body="$greeting Você atingiu sua meta de fidelidade e ganhou: ".$reward['label'].'. Apresente esta mensagem na loja para resgatar seu benefício.';
            break;
        case 'progress':
            $progress=waLoyalty($db,$client['id'],waRules($db,true));
            $p=$progress['purchase']; $s=$progress['service'];
            $body="$greeting No seu ciclo de fidelidade, faltam ".$p['missing'].' compra(s) e '.$s['missing'].' manutenção(ões) para as próximas metas.';
            $key=$today->format('Y-m-d');
            break;
    }
    $group=$kind==='discount'?'benefit':$kind;
    return ['event'=>hash('sha256',implode('|',[$mode,$client['id'],$group,$key])),'kind'=>$kind,'client'=>$client['id'],
        'phone'=>$client['phone'],'body'=>$body,'warranty'=>$warranty,'intake'=>$intake,'file'=>$file];
}

function waPreviewSignature(array $draft, string $mode, string $actor, string $secret): string {
    return hash_hmac('sha256',json_encode([$draft,$mode,$actor],JSON_FLAGS),$secret);
}

function waMessage(PDO $db, array $cfg, string $message): array {
    $row=unico($db,'SELECT id,kind,mode,phone,body,state,provider_id,created_at,updated_at FROM tp_wa_messages WHERE id=?',[$message]);
    if (!$row) throw new Entrada('Envio não encontrado.',404);
    if (in_array($row['state'],['requested','uncertain','accepted','sent'],true)) {
        try { $result=waCloud($cfg,['action'=>'receipt','id'=>$message]); }
        catch (Entrada) { return $row; }
        $rank=['requested'=>0,'uncertain'=>1,'accepted'=>2,'sent'=>3,'delivered'=>4,'read'=>5,'failed'=>6];
        $state=$result['state']??null;
        if (is_string($state) && isset($rank[$state]) && $rank[$state]>$rank[$row['state']]) {
            $provider=is_string($result['provider_id']??null)?substr($result['provider_id'],0,120):null;
            sql($db,'UPDATE tp_wa_messages SET state=?,provider_id=?,updated_at=? WHERE id=? AND state=?',[$state,$provider,timestamp(),$message,$row['state']]);
            return unico($db,'SELECT id,kind,mode,phone,body,state,provider_id,created_at,updated_at FROM tp_wa_messages WHERE id=?',[$message]);
        }
    }
    return $row;
}

function waSend(PDO $db, array $cfg, array $data, string $actor, bool $confirmIntake = false): array {
    if ($confirmIntake) $data=['kind'=>'intake','id'=>$data['id']??null];
    $connection=waCloud($cfg,['action'=>'status']);
    if (($connection['status']??null)!=='connected') throw new Entrada('Conecte o WhatsApp antes de enviar.',409);
    $mode=opcao($connection['mode']??null,['test','store'],'Modo da conexão inválido.');
    $stamp=timestamp();
    [$message,$draft,$new]=transacao($db,function() use ($db,$cfg,$data,$actor,$mode,$stamp,$connection,$confirmIntake) {
        unico($db,'SELECT id FROM tp_wa_lock WHERE id=1 FOR UPDATE');
        $draft=waDraft($db,$data,$mode);
        $signature=$data['signature']??'';
        if (!$confirmIntake && (!is_string($signature) || !hash_equals(waPreviewSignature($draft,$mode.':'.$connection['connection'],$actor,$cfg['token']),$signature))) {
            throw new Entrada('A mensagem ou a conexão mudou. Revise a mensagem novamente.',409);
        }
        $old=unico($db,'SELECT id FROM tp_wa_messages WHERE event_key=?',[$draft['event']]);
        if ($old) return [$old['id'],$draft,false];
        $day=waToday()->format('Y-m-d');
        $count=unico($db,'SELECT COUNT(*) total FROM tp_wa_messages WHERE day=?',[$day]);
        if ((int)$count['total']>=8) throw new Entrada('O limite de oito solicitações de envio do dia foi atingido.',429);
        $message=uid();
        sql($db,'INSERT INTO tp_wa_messages(id,event_key,day,client_id,actor,mode,phone,kind,body,state,created_at,updated_at)
            VALUES(?,?,?,?,?,?,?,?,?,?,?,?)',[$message,$draft['event'],$day,$draft['client'],$actor,$mode,$draft['phone'],$draft['kind'],$draft['body'],'requested',$stamp,$stamp]);
        return [$message,$draft,true];
    });
    if ($new) {
        try {
            $result=waCloud($cfg,['action'=>'send','id'=>$message,'mode'=>$mode,'connection'=>$connection['connection'],
                'phone'=>$draft['phone'],'text'=>$draft['body'],'warranty'=>$draft['warranty'],'intake'=>$draft['intake']]);
            if (($result['state']??null)==='failed') sql($db,"UPDATE tp_wa_messages SET state='failed',updated_at=? WHERE id=? AND state='requested'",[timestamp(),$message]);
        } catch (Entrada) {
            sql($db,"UPDATE tp_wa_messages SET state='uncertain',updated_at=? WHERE id=? AND state='requested'",[timestamp(),$message]);
        }
    }
    return waMessage($db,$cfg,$message);
}
