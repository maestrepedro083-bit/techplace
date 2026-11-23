<?php
declare(strict_types=1);

const ANEXO_MAX = 8 * 1048576;
const ANEXO_TIPOS = ['image/jpeg','image/png','image/webp','image/heic','image/heif','video/mp4','video/webm','video/quicktime'];

function tipoAnexo(string $data, string $type): bool {
    return match ($type) {
        'image/jpeg' => str_starts_with($data, "\xff\xd8\xff"),
        'image/png' => str_starts_with($data, "\x89PNG\r\n\x1a\n"),
        'image/webp' => str_starts_with($data,'RIFF') && substr($data,8,4) === 'WEBP',
        'video/webm' => str_starts_with($data, "\x1a\x45\xdf\xa3"),
        default => substr($data,4,4) === 'ftyp',
    };
}

function arquivoAnexo(string $order, string $id): string {
    return protegido('anexos/' . $order . '/' . $id . '.bin');
}

function recebeAnexo(PDO $db, string $order, string $id, string $actor): void {
    $type = strtolower(trim(explode(';',$_SERVER['CONTENT_TYPE'] ?? '')[0]));
    if (!in_array($type,ANEXO_TIPOS,true)) throw new Entrada('Escolha uma foto ou vídeo em formato compatível.',415);
    $length = $_SERVER['CONTENT_LENGTH'] ?? null;
    $stated = $_SERVER['HTTP_X_FILE_SIZE'] ?? null;
    $size = filter_var($length ?? $stated,FILTER_VALIDATE_INT);
    if ($length !== null && $stated !== null && (int)$length !== (int)$stated) throw new Entrada('O tamanho do arquivo não confere.');
    if (!$size || $size < 1 || $size > ANEXO_MAX) throw new Entrada('Use um arquivo de até 8 MB nesta hospedagem.',413);
    $name = trim(rawurldecode($_SERVER['HTTP_X_FILE_NAME'] ?? ''));
    if ($name === '' || !preg_match('//u',$name) || comprimento($name) > 180 ||
        preg_match('/[\x00-\x1f\x7f\/\\\\]/',$name)) throw new Entrada('Informe um nome de arquivo válido.');
    $bytes = file_get_contents('php://input',false,null,0,$size + 1);
    if ($bytes === false || strlen($bytes) !== $size) throw new Entrada('O arquivo chegou incompleto.');
    if (!tipoAnexo($bytes,$type)) throw new Entrada('O conteúdo do arquivo não corresponde ao formato selecionado.',415);
    $path = arquivoAnexo($order,$id);
    $wrote = false;
    try {
        $status = transacao($db,function () use ($db,$order,$id,$actor,$type,$size,$name,$bytes,$path,&$wrote) {
            if (!unico($db,'SELECT id FROM service_orders WHERE id=? AND deleted_at IS NULL',[$order])) throw new Entrada('Ordem de serviço não encontrada.',404);
            $row = existente($db,'service_media',$id);
            if ($row) {
                if ($row['order_id'] !== $order || $row['name'] !== $name || $row['type'] !== $type || (int)$row['size'] !== $size || $row['deleted_at']) {
                    throw new Entrada('Selecione o arquivo novamente.',409);
                }
                if ($row['status'] === 'ready' && is_file($path)) return 200;
            } else {
                $count = (int)unico($db,"SELECT COUNT(*) AS total FROM service_media WHERE order_id=? AND deleted_at IS NULL AND status='ready'",[$order])['total'];
                if ($count >= 20) throw new Entrada('Cada ordem pode ter até 20 anexos.',409);
            }
            $dir = dirname($path);
            if (!is_dir($dir) && !mkdir($dir,0700,true) && !is_dir($dir)) throw new Entrada('O armazenamento de anexos está indisponível.',503);
            $temporary = tempnam($dir,'tmp-');
            if ($temporary === false) throw new Entrada('O armazenamento de anexos está indisponível.',503);
            try {
                if (file_put_contents($temporary,$bytes,LOCK_EX) !== $size || !rename($temporary,$path)) throw new Entrada('Não foi possível salvar o arquivo.',503);
                $wrote = true;
            } finally {
                if (is_file($temporary)) unlink($temporary);
            }
            if ($row) sql($db,"UPDATE service_media SET status='ready' WHERE id=?",[$id]);
            else adicionar($db,'service_media',['id'=>$id,'order_id'=>$order,'name'=>$name,'type'=>$type,'size'=>$size,
                'actor'=>$actor,'created_at'=>timestamp(),'status'=>'ready']);
            return 201;
        },true);
    } catch (Throwable $e) {
        if ($wrote && is_file($path)) unlink($path);
        throw $e;
    }
    resposta(['ok'=>true],$status);
}

function faixaAnexo(int $size): ?array {
    $header = $_SERVER['HTTP_RANGE'] ?? null;
    if ($header === null) return [0,$size,false];
    if (!preg_match('/\Abytes=(\d*)-(\d*)\z/',$header,$m) || ($m[1] === '' && $m[2] === '')) return null;
    if ($m[1] === '') {
        $sizeSent = min($size,(int)$m[2]);
        return $sizeSent > 0 ? [$size - $sizeSent,$sizeSent,true] : null;
    }
    $start = (int)$m[1];
    $end = $m[2] === '' ? $size - 1 : min($size - 1,(int)$m[2]);
    return $start <= $end ? [$start,$end - $start + 1,true] : null;
}

function anexos(PDO $db, string $method, array $config, string $order, ?string $id, string $actor): void {
    $read = $method === 'GET' || $method === 'HEAD';
    if (!$read) verificaOrigem($config);
    if (!unico($db,'SELECT id FROM service_orders WHERE id=? AND deleted_at IS NULL',[$order])) throw new Entrada('Ordem de serviço não encontrada.',404);
    if ($id === null) {
        if ($method !== 'GET') throw new Entrada('Método inválido.',405);
        resposta(['media'=>linhas($db,"SELECT id,name,type,size,actor,created_at FROM service_media WHERE order_id=?
            AND status='ready' AND deleted_at IS NULL ORDER BY created_at DESC,id",[$order])]);
        return;
    }
    if ($method === 'PUT') { recebeAnexo($db,$order,$id,$actor); return; }
    if ($method === 'DELETE') {
        transacao($db,fn () => sql($db,'UPDATE service_media SET deleted_at=? WHERE id=? AND order_id=? AND deleted_at IS NULL',[timestamp(),$id,$order]),true);
        resposta(['ok'=>true]);
        return;
    }
    if (!$read) throw new Entrada('Método inválido.',405);
    $row = unico($db,"SELECT * FROM service_media WHERE id=? AND order_id=? AND status='ready' AND deleted_at IS NULL",[$id,$order]);
    $file = arquivoAnexo($order,$id);
    if (!$row || !is_file($file) || filesize($file) !== (int)$row['size']) throw new Entrada('Anexo não encontrado.',404);
    $range = faixaAnexo((int)$row['size']);
    header('Cache-Control: private, no-store');
    header('X-Content-Type-Options: nosniff');
    if ($range === null) {
        http_response_code(416);
        header('Content-Range: bytes */' . $row['size']);
        return;
    }
    [$offset,$count,$partial] = $range;
    $stream = $method === 'HEAD' ? null : fopen($file,'rb');
    if ($method !== 'HEAD' && $stream === false) throw new Entrada('Anexo não encontrado.',404);
    http_response_code($partial ? 206 : 200);
    header('Content-Type: ' . $row['type']);
    header('Content-Length: ' . $count);
    header('Accept-Ranges: bytes');
    header('Content-Disposition: ' . (isset($_GET['download']) ? 'attachment' : 'inline') . "; filename*=UTF-8''" . rawurlencode($row['name']));
    if ($partial) header('Content-Range: bytes ' . $offset . '-' . ($offset + $count - 1) . '/' . $row['size']);
    if ($stream) {
        fseek($stream,$offset);
        while ($count > 0 && !feof($stream)) {
            $bytes = fread($stream,min($count,65536));
            if ($bytes === false || $bytes === '') break;
            echo $bytes;
            $count -= strlen($bytes);
        }
        fclose($stream);
    }
}
