# Agente Universal — etapa 1
A central agrega apenas informações do TechPlace com as APIs autenticadas existentes, sem novas tabelas nem alterações no banco. O assistente original continua disponível para consultas e rascunhos. A central distingue vendas registradas de confirmações externas, omite entradas vinculadas às vendas no feed para não duplicá-las e mostra estornos e estoque baixo. Alertas locais opcionais dependem de uma aba aberta e autorização do navegador; não são notificações push de servidor.

A Iris Videomaker, Stone e InfinitePay estão identificadas como conexões pendentes, não como integrações ativas. Próximas etapas: adaptador Iris após acesso ao código, credenciais oficiais por empresa, webhooks autenticados, reconciliação idempotente, fila de notificações e serviço Web Push com teste real em cada dispositivo. Não incluir segredos no GitHub.

Testes de unidade: node --test tests/universal-agent.test.mjs. Build: npm run build. Validar login, dados e ausência de alteração no ambiente de teste antes do deploy. Não publicar automaticamente; preservar banco e registros.
