<?php
declare(strict_types=1);

require __DIR__.'/_tecnologia/base.php';
require protegido('acesso.php');
require protegido('whatsapp-store.php');
require protegido('whatsapp-send.php');

try {
    $config=require protegido('config.php');
    if (($_SERVER['REQUEST_METHOD']??'')!=='POST') throw new Entrada('Método inválido.',405);
    $data=payload($config,4096);
    $session=tokenAtual();
    if (!$session) throw new Entrada('Entre com sua conta TechPlace.',401);
    $db=new PDO('mysql:host='.$config['mysql_host'].';dbname='.$config['mysql_database'].';charset=utf8mb4',
        $config['mysql_user'],$config['mysql_password'],[
            PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION,PDO::ATTR_DEFAULT_FETCH_MODE=>PDO::FETCH_ASSOC,PDO::ATTR_EMULATE_PREPARES=>false,
        ]);
    $actor=unico($db,'SELECT a.id FROM staff_sessions s JOIN staff_accounts a ON a.id=s.staff_id
        WHERE s.token_hash=? AND s.expires_at>? AND a.disabled_at IS NULL',[hash('sha256',$session),timestamp()])['id']??null;
    if (!$actor) throw new Entrada('Sessão inválida.',401);
    $action=$data['action']??null;
    $ownerFile=protegido('agent-owner.php');
    $ownerId=is_file($ownerFile)?require $ownerFile:null;
    $owner=is_string($ownerId) && hash_equals($ownerId,$actor);
    $cfg=waConfig($config);
    if ($action==='configure') {
        if (!$owner) throw new Entrada('Somente o titular da TechPlace pode configurar o conector.',403);
        if ($cfg!==null) throw new Entrada('Já existe uma configuração para este conector.',409);
        $url=rtrim(campo($data,'url','endereço HTTPS do conector',220,true),'/');
        $token=campo($data,'token','token do conector',64,true);
        if (!preg_match('#^https://(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+(?:[a-z]{2,63})$#iD',$url)
            || !preg_match('/^[a-f0-9]{64}$/D',$token)) throw new Entrada('Informe um endereço HTTPS público e o token de 64 caracteres.',400);
        $new=['url'=>$url,'token'=>$token,'admins'=>[$actor],'senders'=>[],'pin_public_host'=>true];
        $remote=waCloud($new,['action'=>'status']);
        if (!in_array($remote['status']??null,['disconnected','connecting','connected','pairing','pairing_error','error','disconnecting'],true)) {
            throw new Entrada('O servidor informado não retornou um status válido do conector TechPlace.',502);
        }
        waInstall($db);
        waSaveConfig($config,$new);
        resposta(['ok'=>true]); return;
    }
    if ($cfg===null) {
        if ($action==='status') { resposta(['status'=>'setup_required','admin'=>$owner,'owner_registered'=>is_string($ownerId)]); return; }
        if ($action==='availability') { resposta(['ready'=>false]); return; }
        throw new Entrada('O WhatsApp ainda não está vinculado. Abra WhatsApp no menu para configurar a conexão.',503);
    }
    $admin=in_array($actor,$cfg['admins']??[],true);
    if (!$admin && !in_array($actor,$cfg['senders']??[],true)) throw new Entrada('Sua conta não está autorizada a usar o WhatsApp TechPlace.',403);
    if ($action==='availability') {
        $ready=false;
        try { $db->query('SELECT id FROM tp_wa_lock LIMIT 1'); $ready=true; }
        catch (Entrada|PDOException $e) {}
        resposta(['ready'=>$ready]); return;
    }
    if (in_array($action,['install','connect','disconnect','forget_unlinked','stage','consent','redeem'],true) && !$admin) {
        throw new Entrada('Esta operação exige uma conta administradora autorizada.',403);
    }
    if ($action==='install') { waInstall($db); resposta(['ok'=>true]); return; }
    if ($action==='status') {
        $result=waCloud($cfg,['action'=>'status','pairing'=>$admin]);
        unset($result['connection']);
        resposta($result+['admin'=>$admin]);
        return;
    }
    if ($action==='connect') {
        $mode=opcao($data['mode']??null,['test','store'],'Escolha o modo.');
        $method=opcao($data['method']??null,['qr','code'],'Escolha a forma de vincular.');
        $number=$method==='code'?waPhone($data['phone']??null):null;
        if ($method==='code' && !$number) throw new Entrada('Informe o número brasileiro com DDD.');
        resposta(waCloud($cfg,['action'=>'connect','mode'=>$mode,'method'=>$method,'phone'=>$number,'pairing'=>true]));
        return;
    }
    if ($action==='disconnect' || $action==='forget_unlinked') {
        if ($action==='forget_unlinked' && ($data['confirmed']??null)!==true) throw new Entrada('Confirme que desvinculou o dispositivo pelo celular.',409);
        resposta(waCloud($cfg,['action'=>$action])); return;
    }
    if ($action==='profile') { resposta(waProfile($db,id($data['id']??null))+['admin'=>$admin]); return; }
    if ($action==='overview') { resposta(waOverview($db,$data)); return; }
    if ($action==='order' || $action==='stage') {
        $order=waOrder($db,id($data['id']??null));
        if ($action==='stage') {
            if ($order['status']!=='working' || ($data['version']??null)!==$order['updated_at']) throw new Entrada('A ordem mudou. Abra a ordem novamente.',409);
            $stage=opcao($data['stage']??null,['analysis','part','repair'],'Etapa inválida.');
            sql($db,'INSERT INTO tp_wa_stage(order_id,stage,source_version) VALUES(?,?,?)
                ON DUPLICATE KEY UPDATE stage=VALUES(stage),source_version=VALUES(source_version)',[$order['id'],$stage,$order['updated_at']]);
            $order=waOrder($db,$order['id']);
        }
        resposta(['stage'=>$order['stage'],'label'=>waStages()[$order['stage']]??null,'version'=>$order['updated_at'],
            'preparing'=>$order['status']==='open','working'=>$order['status']==='working','admin'=>$admin,'linked'=>(bool)$order['client_id']]);
        return;
    }
    if ($action==='consent') {
        $client=waClient($db,id($data['id']??null));
        if ($client['phone']==='' || ($data['phone']??null)!==$client['phone']) throw new Entrada('Confira o telefone cadastrado antes de salvar a autorização.',409);
        $consent=($data['consent']??false)===true;
        $test=$consent && ($data['test_allowed']??false)===true;
        sql($db,'INSERT INTO tp_wa_clients(client_id,phone,consent,test_allowed,actor,updated_at) VALUES(?,?,?,?,?,?)
          ON DUPLICATE KEY UPDATE phone=VALUES(phone),consent=VALUES(consent),test_allowed=VALUES(test_allowed),actor=VALUES(actor),updated_at=VALUES(updated_at)',
          [$client['id'],$client['phone'],(int)$consent,(int)$test,$actor,timestamp()]);
        resposta(['ok'=>true]);
        return;
    }
    if ($action==='redeem') {
        $client=id($data['id']??null);
        $reward=id($data['reward']??null);
        $changed=transacao($db,function() use ($db,$client,$reward,$actor) {
            waRules($db,true);
            waReconcile($db,$client);
            return sql($db,"UPDATE tp_wa_rewards SET used_at=?,used_by=? WHERE id=? AND client_id=?
                AND used_at IS NULL AND revoked_at IS NULL AND (kind<>'birthday' OR reward_year=?)",
                [timestamp(),$actor,$reward,$client,waToday()->format('Y')])->rowCount();
        });
        if (!$changed) throw new Entrada('Benefício indisponível ou já utilizado.',409);
        resposta(['ok'=>true]);
        return;
    }
    if ($action==='preview') {
        $connection=waCloud($cfg,['action'=>'status']);
        if (($connection['status']??null)!=='connected') throw new Entrada('Conecte o WhatsApp no agente para enviar.',409);
        $mode=opcao($connection['mode']??null,['test','store'],'Modo da conexão inválido.');
        $draft=transacao($db,fn()=>waDraft($db,$data,$mode));
        resposta(['text'=>$draft['body'],'phone'=>$draft['phone'],'file'=>$draft['file'],'mode'=>$mode,'from'=>$connection['number'],
            'signature'=>waPreviewSignature($draft,$mode.':'.$connection['connection'],$actor,$cfg['token'])]);
        return;
    }
    if ($action==='send-intake') { resposta(waSend($db,$cfg,$data,$actor,true)); return; }
    if ($action==='send') { resposta(waSend($db,$cfg,$data,$actor)); return; }
    if ($action==='receipt') { resposta(waMessage($db,$cfg,id($data['id']??null))); return; }
    if ($action==='history') {
        $offset=inteiro($data,'offset','página',1000000);
        $rows=linhas($db,'SELECT id,kind,mode,phone,state,created_at FROM tp_wa_messages ORDER BY created_at DESC,id LIMIT 26 OFFSET '.$offset);
        resposta(['rows'=>array_slice($rows,0,25),'next'=>count($rows)>25?$offset+25:null]);
        return;
    }
    throw new Entrada('Comando inválido.');
} catch (Entrada $e) {
    resposta(['error'=>$e->getMessage()],$e->status);
} catch (Throwable $e) {
    error_log('TechPlace WhatsApp: '.get_class($e).' '.$e->getCode());
    resposta(['error'=>'Falha ao consultar a integração. Confira a instalação e tente novamente.'],503);
}
