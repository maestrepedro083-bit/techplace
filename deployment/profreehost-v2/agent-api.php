<?php
declare(strict_types=1);
require __DIR__ . '/_tecnologia/base.php';
require protegido('acesso.php');

/* Isolated, owner-only read-only connectors. Never update sales, cash or stock. */
function agOwner(PDO $db): ?array {
    $t=tokenAtual();
    if ($t===null) return null;
    return unico($db,'SELECT a.id,a.name FROM staff_sessions s JOIN staff_accounts a ON a.id=s.staff_id WHERE s.token_hash=? AND s.expires_at>? AND a.disabled_at IS NULL',[hash('sha256',$t),timestamp()]);
}
function agValue(mixed $v,string $label,int $max=160): string {
    if(!is_string($v)||strlen($v)>$max||preg_match('/[\x00-\x1f\x7f]/',$v)) throw new Entrada('Confira '.$label.'.');
    return trim($v);
}
function agKey(array $config): string {
    if(!is_string($config['pepper']??null)||strlen($config['pepper'])<32||!function_exists('openssl_encrypt')) throw new Entrada('Armazenamento criptografado indisponível na hospedagem.',503);
    return hash_hkdf('sha256',$config['pepper'],32,'techplace-agent-connections-v2');
}
function agLoad(array $config): array {
    $path=protegido('agent-connections.enc');
    if(!is_file($path))return [];
    $raw=file_get_contents($path);
    if($raw===false||strlen($raw)<29||strlen($raw)>32768)throw new Entrada('Configuração de integrações inválida.',503);
    $plain=openssl_decrypt(substr($raw,28),'aes-256-gcm',agKey($config),OPENSSL_RAW_DATA,substr($raw,0,12),substr($raw,12,16),'techplace-agent-v2');
    if($plain===false)throw new Entrada('Não foi possível ler as integrações protegidas.',503);
    $decoded=json_decode($plain,true,16,JSON_THROW_ON_ERROR);
    return is_array($decoded)?$decoded:[];
}
function agSave(array $config,array $connections): void {
    $nonce=random_bytes(12);
    $cipher=openssl_encrypt(json_encode($connections,JSON_FLAGS),'aes-256-gcm',agKey($config),OPENSSL_RAW_DATA,$nonce,$tag,'techplace-agent-v2',16);
    if($cipher===false)throw new Entrada('Falha ao proteger credenciais.',503);
    $dest=protegido('agent-connections.enc');
    $tmp=tempnam(__DIR__.'/_tecnologia','agent-');
    if($tmp===false)throw new Entrada('Armazenamento indisponível.',503);
    try{
        if(!chmod($tmp,0600)||file_put_contents($tmp,$nonce.$tag.$cipher,LOCK_EX)!==strlen($nonce.$tag.$cipher)||!rename($tmp,$dest))throw new Entrada('Não foi possível guardar a configuração.',503);
    } finally {if(is_file($tmp))unlink($tmp);}
}
function agStatus(array $c): array {
    return ['owner'=>true,'stone'=>['configured'=>isset($c['stone']['code'],$c['stone']['key']),'verified'=>!empty($c['stone']['verified'])],
        'infinite'=>['configured'=>isset($c['infinite']['handle']),'verified'=>!empty($c['infinite']['verified'])]];
}
function agRemote(string $url,array $headers,?array $json=null): array {
    if(!function_exists('curl_init'))throw new Entrada('A hospedagem não oferece cURL para integrações.',503);
    $ch=curl_init($url);$body='';
    $options=[CURLOPT_RETURNTRANSFER=>false,CURLOPT_FOLLOWLOCATION=>false,CURLOPT_CONNECTTIMEOUT=>8,CURLOPT_TIMEOUT=>30,
        CURLOPT_SSL_VERIFYPEER=>true,CURLOPT_SSL_VERIFYHOST=>2,CURLOPT_HTTPHEADER=>$headers,CURLOPT_ENCODING=>'gzip',
        CURLOPT_WRITEFUNCTION=>function($ch,$part)use(&$body){if(strlen($body)+strlen($part)>8*1024*1024)return 0;$body.=$part;return strlen($part);}];
    if($json!==null){$options[CURLOPT_POST]=true;$options[CURLOPT_POSTFIELDS]=json_encode($json,JSON_FLAGS);}
    curl_setopt_array($ch,$options);
    $ok=curl_exec($ch);$status=(int)curl_getinfo($ch,CURLINFO_RESPONSE_CODE);curl_close($ch);
    if($ok===false)throw new Entrada('Falha de comunicação com a API oficial. Verifique se a hospedagem permite conexões externas.',502);
    if($status!==200)throw new Entrada('A API oficial retornou HTTP '.$status.'. Confira credenciais, data e disponibilidade.',502);
    return ['body'=>$body];
}
function agStoneSummary(string $xml,string $date,string $code): array {
    if(substr($xml,0,2)==="\x1f\x8b"){
        $xml=gzdecode($xml,8*1024*1024);
        if($xml===false)throw new Entrada('Extrato compactado inválido.',502);
    }
    if(!function_exists('simplexml_load_string')||stripos($xml,'<!DOCTYPE')!==false||stripos($xml,'<!ENTITY')!==false)throw new Entrada('Formato de extrato indisponível.',502);
    $prev=libxml_use_internal_errors(true);
    try{$doc=simplexml_load_string($xml,'SimpleXMLElement',LIBXML_NONET|LIBXML_NOCDATA);}
    finally{libxml_clear_errors();libxml_use_internal_errors($prev);}
    if($doc===false||$doc->getName()!=='Conciliation'||(string)$doc->Header->ReferenceDate!==$date||(string)$doc->Header->StoneCode!==$code)throw new Entrada('Extrato não corresponde à conta e data solicitadas.',502);
    $counts=['captures'=>0,'cancellations'=>0,'chargebacks'=>0,'payments'=>0,'records'=>0];
    foreach($doc->FinancialTransactions->Transaction??[] as $t){
        $counts['records']++;
        foreach(['Captures'=>'captures','Cancellations'=>'cancellations','Chargebacks'=>'chargebacks','Payments'=>'payments'] as $k=>$v){
            $raw=(string)$t->Events->$k;
            if($raw!==''&&!ctype_digit($raw))throw new Entrada('Evento não reconhecido no extrato.',502);
            $counts[$v]+=(int)$raw;
        }
    }
    return ['referenceDate'=>$date,'counts'=>$counts,'mode'=>'reconciliation-preview','imported'=>false];
}
try{
    $config=require protegido('config.php');
    if(!is_string($config['origem']??null)||!str_starts_with($config['origem'],'https://'))throw new Entrada('HTTPS obrigatório.',503);
    $db=new PDO('mysql:host='.$config['mysql_host'].';dbname='.$config['mysql_database'].';charset=utf8mb4',$config['mysql_user'],$config['mysql_password'],[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION,PDO::ATTR_DEFAULT_FETCH_MODE=>PDO::FETCH_ASSOC,PDO::ATTR_EMULATE_PREPARES=>false,PDO::ATTR_STRINGIFY_FETCHES=>false]);
    $account=agOwner($db);
    if(!$account)throw new Entrada('Entre com sua conta.',401);
    $ownerFile=protegido('agent-owner.php');
    $ownerId=is_file($ownerFile)?require $ownerFile:null;
    $method=$_SERVER['REQUEST_METHOD']??'GET';
    if(!is_string($ownerId)||!hash_equals($ownerId,(string)$account['id'])){
        if($method==='GET'){resposta(['owner'=>false,'setupRequired'=>!is_string($ownerId)]);return;}
        throw new Entrada('Somente o titular autorizado pode configurar e consultar provedores.',403);
    }
    if($method==='GET'){resposta(agStatus(agLoad($config)));return;}
    if($method!=='POST')throw new Entrada('Método inválido.',405);
    $p=payload($config,4096);
    $lock=fopen(protegido('agent-connections.lock'),'c');
    if(!$lock||!flock($lock,LOCK_EX))throw new Entrada('Integrações temporariamente ocupadas.',503);
    try{
        $connections=agLoad($config);
        $action=$p['action']??'';
        if($action==='configure'){
            $provider=$p['provider']??'';
            if($provider==='stone'){
                $code=agValue($p['code']??null,'o StoneCode',20);
                $key=agValue($p['key']??null,'a chave da Stone',512);
                if(!preg_match('/\A[0-9]{1,20}\z/',$code)||strlen($key)<8||str_contains($key,':'))throw new Entrada('Confira o StoneCode e a chave.');
                $connections['stone']=['code'=>$code,'key'=>$key,'verified'=>false];
            }elseif($provider==='infinite'){
                $handle=ltrim(agValue($p['handle']??null,'a InfiniteTag',80),'$');
                if(!preg_match('/\A[A-Za-z0-9_.-]{1,80}\z/',$handle))throw new Entrada('Confira a InfiniteTag.');
                $connections['infinite']=['handle'=>$handle,'verified'=>false];
            }else throw new Entrada('Provedor inválido.');
            agSave($config,$connections);resposta(agStatus($connections));return;
        }
        if($action==='disconnect'){
            $provider=$p['provider']??'';
            if(!in_array($provider,['stone','infinite'],true))throw new Entrada('Provedor inválido.');
            unset($connections[$provider]);agSave($config,$connections);resposta(agStatus($connections));return;
        }
        if($action==='stone-preview'){
            $s=$connections['stone']??null;
            if(!$s)throw new Entrada('Configure sua Stone primeiro.',409);
            $d=agValue($p['date']??null,'a data',10);
            $zone=new DateTimeZone('America/Sao_Paulo');
            $day=DateTimeImmutable::createFromFormat('!Y-m-d',$d,$zone);
            $now=new DateTimeImmutable('now',$zone);
            if(!$day||$day->format('Y-m-d')!==$d||$now<$day->modify('+1 day')->setTime(5,0)||$day<$now->modify('-365 days')->setTime(0,0))throw new Entrada('Escolha uma data dos últimos 365 dias, disponível após 5h do dia seguinte.');
            $date=$day->format('Ymd');
            $response=agRemote('https://conciliation.stone.com.br/v2/merchant/'.$s['code'].'/conciliation-file/'.$date,['Authorization: Basic '.base64_encode($s['key'].':'),'x-user-type: client','Accept: application/xml','X-Accept-Redirect: false']);
            $result=agStoneSummary($response['body'],$date,$s['code']);
            $connections['stone']['verified']=true;agSave($config,$connections);
            resposta($result);return;
        }
        if($action==='infinite-check'){
            $s=$connections['infinite']??null;
            if(!$s)throw new Entrada('Configure sua InfiniteTag primeiro.',409);
            $q=['handle'=>$s['handle']];
            foreach(['order_nsu','transaction_nsu','slug'] as $field){
                $value=agValue($p[$field]??null,$field,180);
                if($value==='')throw new Entrada('Informe '.$field.'.');
                $q[$field]=$value;
            }
            $r=agRemote('https://api.checkout.infinitepay.io/payment_check',['Content-Type: application/json','Accept: application/json'],$q);
            $v=json_decode($r['body'],true,32,JSON_THROW_ON_ERROR);
            $paid=($v['success']??false)===true&&($v['paid']??false)===true;
            if($paid){
                if(!is_int($v['amount']??null)||$v['amount']<=0||!is_int($v['paid_amount']??null)||$v['paid_amount']<=0)throw new Entrada('Resposta de pagamento inválida.',502);
                $connections['infinite']['verified']=true;agSave($config,$connections);
            }
            resposta(['paid'=>$paid,'amount'=>$paid?$v['amount']:null,'paidAmount'=>$paid?$v['paid_amount']:null,'captureMethod'=>$paid?(string)($v['capture_method']??''):null,'imported'=>false]);return;
        }
        throw new Entrada('Comando inválido.');
    }finally{flock($lock,LOCK_UN);fclose($lock);}
}catch(Entrada $e){resposta(['error'=>$e->getMessage()],$e->status);}
catch(Throwable $e){error_log('TechPlace agent: '.get_class($e));resposta(['error'=>'Não foi possível concluir a integração. Nenhum lançamento financeiro foi criado.'],500);}
