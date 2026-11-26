# WhatsApp no agente TechPlace

A atualização usa o chat flutuante do painel e os cadastros existentes no MySQL. O serviço Node mantém o dispositivo vinculado na nuvem. Os envios começam em **Confirmar envio pelo WhatsApp**, após a revisão. O serviço não guarda conversas, não implementa respostas e não retenta envios com resultado incerto. A integração é não oficial. O WhatsApp pode suspender ou banir o número e mudar o protocolo a qualquer momento. Consulte [Aparelhos conectados no WhatsApp](https://faq.whatsapp.com/378279804439436/).

## Serviço persistente

O plano PHP da ProFreeHost hospeda a interface e a API. O conector usa Node.js 24 em um único contêiner, com HTTPS público para a API PHP e acesso de saída ao WhatsApp. A sessão fica criptografada em PostgreSQL privado. Uma instalação em VPS com disco persistente também é compatível.

### Northflank Sandbox

O Sandbox informa que inclui um banco e serviços de execução contínua dentro dos limites gratuitos. A conta TechPlace recebeu uma exigência de verificação por cartão antes de criar os recursos. Confirme que ambos os recursos estão marcados como **Sandbox** antes de criá-los.

1. Crie um projeto Sandbox e um addon PostgreSQL privado com TLS. Para a conexão do serviço, use um usuário do banco dedicado que tenha acesso ao schema do conector. Não exponha o addon publicamente.
2. Crie um serviço Docker no mesmo projeto e configure o Dockerfile em `deployment/profreehost-whatsapp/cloud/Dockerfile` com o contexto `deployment/profreehost-whatsapp/cloud`. Use uma única instância e a porta HTTP `8080` com HTTPS gerenciado pelo Northflank. Configure `GET /health` como teste de saúde.
3. Injete `TECHPLACE_DATABASE_URL` com a URL privada do addon no formato `postgresql://...`. Se o addon usar uma CA própria, injete o certificado CA PEM em `TECHPLACE_DATABASE_CA`. Remova opções `sslmode` do endereço. O serviço exige TLS com validação de certificado. O PostgreSQL guarda somente a sessão criptografada e identificadores dos envios iniciados pelo painel.
4. Injete `TECHPLACE_TOKEN` e `TECHPLACE_SESSION_KEY`, duas chaves diferentes geradas separadamente com `openssl rand -hex 32`. Mantenha as duas fora do repositório. O token é compartilhado com PHP. A chave da sessão fica exclusivamente no ambiente do serviço. Perder a chave da sessão exige desvincular o aparelho antigo e vincular novamente.
5. Desative logs de cabeçalhos e corpos das requisições. O banco impede que duas instâncias operem a mesma sessão. Se o modo de atualização do serviço exigir que duas versões coexistam, pare a instância anterior antes de colocar a nova em execução.

Para usar SQLite em outro provedor, omita `TECHPLACE_DATABASE_URL` e monte um volume persistente em `/data`, gravável pelo UID 1000. Não use armazenamento temporário para a sessão.

Em caso de interrupção, consulte o histórico de mensagens. `Recebido pelo conector` indica que o conector terminou a solicitação. `Envio confirmado pelo WhatsApp`, `Entregue` e `Lido` dependem de confirmações recebidas do WhatsApp. Se o resultado for incerto, confira a conversa no aplicativo antes de qualquer novo envio. O painel não repete a mesma ocorrência.

## Atualização do painel

1. Baixe para um diretório local os arquivos atuais `app.js`, `index.html`, `techplace-plus.js`, `warranty-pdf.js` e `crm-api.php` da loja. Guarde uma cópia para rollback. Aplique a atualização incremental com Python 3.

   ```bash
   python3 preparar-atualizacao.py /copia/htdocs /novo/htdocs-whatsapp
   ```

2. Configure uma cópia de `_tecnologia/whatsapp-config.example.php` chamada `_tecnologia/whatsapp-config.php` no servidor PHP. Use a origem HTTPS do serviço e o valor de `TECHPLACE_TOKEN`. Cadastre em `admins` e `senders` os IDs das contas existentes e ativas, consultados privadamente no phpMyAdmin com `SELECT id,name FROM staff_accounts WHERE disabled_at IS NULL`. Administração, resgate e consentimento ficam restritos a `admins`. A geração de mensagens exige uma conta explicitamente autorizada. Mantenha a proteção de acesso HTTP à pasta `_tecnologia`.
3. Publique o conteúdo de `htdocs-whatsapp` no `htdocs` existente, incluindo os arquivos novos dentro de `_tecnologia`. Mantenha as demais configurações e arquivos. Para evitar uma publicação incompleta, envie o módulo, folhas de estilo e PHP novos primeiro, os arquivos atualizados depois e `index.html` por último. O PHP precisa de PDO MySQL e cURL com saída HTTPS para o serviço.
4. Entre com a conta administradora e abra **Assistente → WhatsApp → Ativar armazenamento WhatsApp**. Essa ação cria tabelas próprias `tp_wa_*` no banco atual. Nenhum registro de base é migrado. Para reverter o código, restaure os quatro arquivos substituídos. Mantenha as tabelas para preservar o histórico.
5. Se estiver rodando o conector local antigo, encerre-o e retire seu dispositivo vinculado pelo celular. Ative primeiro **WhatsApp pessoal · teste**. Na ficha de cada contato de teste, registre o consentimento para o telefone atual e marque **Contato selecionado para teste**. Envie somente após selecionar e revisar a mensagem. Depois desconecte o número pessoal e vincule o da loja.
6. Os benefícios contabilizam somente vendas finalizadas e não estornadas, e ordens concluídas, vinculadas ao cliente no CRM. Em andamento, registre a etapa específica na ordem antes de enviar o status. Os estados Aberta e Concluída exibem Recebido e Pronto para retirada conforme o fluxo pré-existente da TechPlace. A autorização promocional do CRM é exigida também para fidelidade e aniversários. O resgate fica registrado separadamente de uma notificação de oferta.

## Verificação local

Execute `npm ci && npm test` dentro de `cloud`. Os testes cobrem autenticação do serviço, falha com sessão desconectada, persistência criptografada, deduplicação, confirmação e o PDF existente. Depois da publicação, teste o QR Code e o código pelo número se oferecido, desligue e reinicie uma vez o serviço para verificar a sessão, e use um único contato selecionado para confirmar o fluxo até a entrega.


### Publicação antes de vincular o conector

Use `--preparar-conexao` no script para instalar a revisão incremental sobre os arquivos existentes. Publique os arquivos auxiliares primeiro e o `index.html` por último. Até a configuração do serviço HTTPS e a ativação do armazenamento, o painel original continua operando e a seção WhatsApp do assistente exibe o estado de configuração retornado pelo servidor. Depois de ativar o armazenamento pelo painel, recarregue a página para entrar na versão com os fluxos integrados.
