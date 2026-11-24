# Agente Universal v2 — TechPlace
A atualização acrescenta comandos de consulta (texto e voz quando o navegador suporta), conexões financeiras com autenticação exclusiva do titular, configuração criptografada no servidor, prévia de conciliação Stone e verificação de pagamentos de checkout InfinitePay. Nenhum lançamento é criado, alterado ou apagado por estes conectores. O agente atual não é um LLM autônomo; comandos são encaminhados por intenções conhecidas.

## Instalação ProFreeHost
Faça backup dos arquivos anteriores. Publique somente universal-agent.js, style.css e agent-api.php na raiz htdocs. Não substituir API original, banco, .htaccess ou configurações. O módulo usa a sessão existente e requer PHP 8.2, PDO, OpenSSL, cURL e SimpleXML. A integração depende de saída HTTPS permitida pela hospedagem.

## Titular
Se o pacote de instalação for personalizado com `_tecnologia/agent-owner-claim.php`, o titular poderá ativar seu login usando o código de ativação único fornecido separadamente. O arquivo privado contém apenas o hash SHA-256 do código; a ativação exige sessão autenticada e origem HTTPS válida, grava o ID dessa conta como titular e invalida a ativação. O código nunca deve entrar no GitHub. Não reative nem substitua um titular já configurado.

Alternativa manual:
A autenticação atual permite cadastros de contas; estar logado não comprova propriedade. Por isso o servidor exige uma autorização inicial feita pelo titular na hospedagem. Identifique o ID EXATO da sua conta já existente consultando APENAS id e name na tabela staff_accounts pelo phpMyAdmin (não exiba hashes, senhas ou tokens). Crie htdocs/_tecnologia/agent-owner.php com o conteúdo de exemplo abaixo, substituindo o marcador por esse ID. Confirme que o .htaccess da raiz bloqueia acesso web à pasta _tecnologia. Nunca coloque o ID real ou credenciais no GitHub.
```php
<?php
return 'ID-EXATO-DA-CONTA-TITULAR';
```
Depois de entrar nessa conta, acesse Agente Universal > Conexões financeiras > Verificar acesso. Informe StoneCode e chave de conciliação no formulário HTTPS do site; para InfinitePay, InfiniteTag. A chave é criptografada com chave derivada da configuração privada existente; não será exibida novamente. Remover conexão não altera dados da loja.

Stone: extrato oficial diário após 5h do dia seguinte, não tempo real. A prévia conta eventos do extrato, não soma capturas/parcelas ou importa valores. InfinitePay: o payment_check exige order_nsu, transaction_nsu e slug e só marca consulta confirmada quando success e paid forem true. Não cobre automaticamente vendas em maquininha. Referências: https://conciliacao.stone.com.br/reference/overview-da-api-cliente-stone e https://www.infinitepay.io/checkout-documentacao.

## Pendências reais
Mapeamento e reconciliação idempotente por venda, webhooks verificados e fila persistente, integração de maquininha com permissões comerciais, envio push em segundo plano, adaptação ao código original da Iris e autenticação/integrações de outros sites. Nenhuma delas está habilitada automaticamente por esta versão. Não publique o adaptador incompleto da Iris no lugar do site.
