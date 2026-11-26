const messageStates = {
  requested: 'Solicitado · aguardando confirmação',
  uncertain: 'Resultado incerto · confira no WhatsApp',
  accepted: 'Recebido pelo conector · aguardando confirmação do WhatsApp',
  sent: 'Envio confirmado pelo WhatsApp',
  delivered: 'Entregue ao contato',
  read: 'Lido pelo contato',
  failed: 'Falha no envio',
};
const connectionStates = {
  disconnected: 'Desconectado', connecting: 'Reconectando', connected: 'Conectado', pairing: 'Aguardando vinculação',
  pairing_error: 'A vinculação falhou ou expirou', error: 'Conexão interrompida',
  disconnecting: 'Desconectando', busy: 'Envio em andamento', unlink_first: 'Desvincule pelo celular',
};
const messageNames = { status: 'Status da OS', warranty: 'Garantia', benefit: 'Benefício', discount: 'Desconto', progress: 'Progresso de fidelidade', birthday: 'Aniversário' };
const stages = { analysis: 'Em análise', part: 'Aguardando peça', repair: 'Em manutenção' };

function el(tag, text, style) {
  const node = document.createElement(tag);
  if (text != null) node.textContent = text;
  if (style) node.className = style;
  return node;
}

function button(text, run, status, style = 'btn') {
  const node = el('button', text, style);
  node.type = 'button';
  node.addEventListener('click', async () => {
    if (node.disabled) return;
    node.disabled = true;
    try { await run(); }
    catch (error) { status.textContent = error.message; }
    finally { node.disabled = false; }
  });
  return node;
}

function choice(entries, label) {
  const select = el('select');
  select.setAttribute('aria-label', label);
  for (const [value, text] of entries) {
    const option = el('option', text);
    option.value = value;
    select.append(option);
  }
  return select;
}

function live(text) {
  const output = el('p', text, 'tp-caption');
  output.setAttribute('role','status');
  return output;
}

function call(action, data = {}) {
  return fetch('/techplace-whatsapp.php', {
    method: 'POST', cache: 'no-store', credentials: 'same-origin',
    headers: { 'Content-Type':'application/json' },
    body: JSON.stringify({ action, ...data }),
  }).then(async response => {
    const result = await response.json().catch(() => null);
    if (!response.ok || !result) throw new Error(result?.error || 'Não foi possível consultar a integração WhatsApp.');
    return result;
  });
}

function displayDate(date) {
  return new Intl.DateTimeFormat('pt-BR', {timeZone:'America/Sao_Paulo', dateStyle:'short', timeStyle:'short'}).format(new Date(date));
}

function showReceipt(host, message, detail = false) {
  host.replaceChildren();
  const stamp = displayDate(message.created_at);
  const state = live(messageStates[message.state] ?? message.state);
  const title = messageNames[message.kind] ?? message.kind;
  host.append(el('strong', title + ' · ' + stamp + (message.mode === 'test' ? ' · Teste' : '')), state);
  if (detail) host.append(el('p','+' + message.phone),el('p',message.body));
  if (['requested','uncertain','accepted','sent','delivered'].includes(message.state)) {
    host.append(button('Consultar confirmação', async () => {
      showReceipt(host, await call('receipt', {id:message.id}), true);
    }, state));
  }
}

export function whatsappAction(label, kind, id, reward) {
  const root = el('div',null,'tp-message');
  const result = live();
  const preview = el('div');
  const open = button(label, async () => {
    result.textContent = 'Consultando destinatário e mensagem…';
    preview.replaceChildren();
    const draft = await call('preview', { kind, id, reward });
    result.textContent = draft.mode === 'test' ? 'Modo de teste' : '';
    preview.append(el('strong','De +' + draft.from + ' para +' + draft.phone), el('p',draft.text));
    if (draft.file) preview.append(el('p','Anexo: ' + draft.file));
    preview.append(button('Confirmar envio pelo WhatsApp', async () => {
      result.textContent = 'Solicitando envio…';
      const message = await call('send',{kind,id,reward,signature:draft.signature});
      showReceipt(preview,message,true);
      result.textContent = '';
    }, result,'btn primary'));
  }, result);
  root.append(open, result, preview);
  return root;
}

export function whatsappConnection() {
  const section = el('details',null,'tp-record tp-wa-connection');
  const summary = el('summary','WhatsApp');
  const body = el('div');
  section.append(summary,body);
  let timer;
  async function refresh() {
    clearTimeout(timer);
    try { render(await call('status')); }
    catch (error) { body.replaceChildren(live(error.message)); }
  }
  function render(data) {
    const state = live((connectionStates[data.status] ?? data.status) + (data.number?' · +'+data.number:'') + (data.mode==='test'?' · Modo de teste':''));
    const controls = el('div', null, 'tp-wa-controls');
    const output = el('div');
    body.replaceChildren(state,controls,output);
    if (data.admin) {
      if (data.status === 'disconnected') {
        const mode = choice([['test','WhatsApp pessoal · teste'],['store','WhatsApp da loja']], 'Modo do WhatsApp');
        const method = choice([['qr','QR Code'],['code','Código pelo número']], 'Forma de vincular');
        const phone = el('input');
        phone.type = 'tel';
        phone.placeholder = 'Número com DDD';
        phone.setAttribute('aria-label', 'Número do WhatsApp com DDD');
        if (matchMedia('(pointer: coarse)').matches) method.value = 'code';
        phone.hidden = method.value !== 'code';
        method.addEventListener('change', () => { phone.hidden = method.value !== 'code'; });
        controls.append(mode,method,phone,button('Conectar WhatsApp',async () => {
          await call('connect',{mode:mode.value,method:method.value,phone:phone.value});
          await refresh();
        },state,'btn primary'));
        output.append(el('p','A conexão usa um dispositivo vinculado por serviço não oficial. Há risco de interrupção e de bloqueio da conta.'));
      } else {
        controls.append(button('Desconectar WhatsApp',async () => {
          if (!confirm('Desconectar o número atual da TechPlace?')) return;
          const result = await call('disconnect');
          if (result.status === 'unlink_first') {
            state.textContent = 'Remova a sessão em Aparelhos conectados no celular e confirme aqui.';
            controls.append(button('Já desvinculei pelo celular', async () => {
              await call('forget_unlinked', {confirmed:true});
              await refresh();
            },state));
          } else if (result.status === 'busy') state.textContent = connectionStates.busy;
          else await refresh();
        },state));
      }
      if (data.status === 'pairing') {
        output.append(el('p','Abra Aparelhos conectados no WhatsApp do celular e escolha Conectar um aparelho.'));
        if (data.qr) {
          output.append(el('p','Abra este QR Code em outra tela para escanear pelo celular.'));
          const img = el('img');
          img.alt = 'QR Code de vinculação do WhatsApp';
          img.src = data.qr;
          output.append(img);
        }
        if (data.code) output.append(el('p','Escolha conectar com número de telefone e digite o código: ' + data.code));
      }
      controls.append(button('Ativar armazenamento WhatsApp', async () => {
        await call('install');
        state.textContent = 'Armazenamento do WhatsApp disponível.';
      },state));
    }
    const records=el('div');
    controls.append(button('Histórico de mensagens', () => history(records,0), state));
    body.append(records);
    if (section.open && section.isConnected && ['pairing','connecting','disconnecting'].includes(data.status)) timer = setTimeout(refresh,2500);
  }
  section.addEventListener('toggle', () => {
    if (section.open) void refresh();
    else { clearTimeout(timer); body.replaceChildren(); }
  });
  return section;
}

async function history(host, offset) {
  const {rows,next} = await call('history',{offset});
  const status = live(rows.length?'':'Nenhum envio registrado.');
  host.replaceChildren(status);
  for (const row of rows) {
    const record=el('div',null,'tp-record');
    record.append(el('p','+' + row.phone));
    const receipt=el('div');
    showReceipt(receipt,row);
    record.append(receipt);
    host.append(record);
  }
  if (offset) host.append(button('Anterior',()=>history(host,offset-25),status));
  if (next !== null) host.append(button('Próxima',()=>history(host,next),status));
}

export function whatsappOrder(root,id) {
  const status = live('Consultando etapa do aparelho…');
  root.replaceChildren(status);
  async function render() {
    const order = await call('order',{id});
    status.textContent = order.label ? 'Etapa atual: ' + order.label : 'Etapa de WhatsApp ainda não registrada para esta ordem.';
    root.replaceChildren(status);
    if (!order.linked) root.append(el('p','Vincule a OS ao cadastro do cliente em Clientes.'));
    if (order.working && order.admin) {
      const select = choice([['','Selecione a etapa'], ...Object.entries(stages)], 'Etapa atual do aparelho');
      select.value = order.stage || '';
      root.append(select,button('Salvar etapa do aparelho',async () => {
        await call('stage',{id,stage:select.value,version:order.version});
        await render();
      },status));
    }
    if (order.stage && order.linked) root.append(whatsappAction('Enviar status pelo WhatsApp','status',id));
  }
  void render().catch(error => { status.textContent=error.message; });
}

export function whatsappClient(id) {
  const block = el('section',null,'tp-record');
  const status = live();
  async function render() {
    const data=await call('profile',{id});
    const {client,progress,rewards,admin}=data;
    status.textContent = '';
    block.replaceChildren(el('h3','Fidelidade e WhatsApp'), status);
    if (data.last_purchase) block.append(el('p','Última compra: '+data.last_purchase.split('-').reverse().join('/')));
    if (client.birthday) block.append(el('p','Aniversário: '+client.birthday.slice(5).split('-').reverse().join('/')));
    if (rewards.some(reward=>!reward.used_at && reward.kind!=='birthday')) block.append(el('strong','Meta atingida · benefício disponível'));
    for (const [key,label] of [['purchase','Compras'],['service','Manutenções']]) {
      const p=progress[key];
      const bar=el('progress');
      bar.max=p.target; bar.value=p.count;
      bar.setAttribute('aria-label',label);
      block.append(el('p',label+' · Faltam '+p.missing+' de '+p.target+' para '+p.label),bar);
    }
    const year = new Intl.DateTimeFormat('en',{timeZone:'America/Sao_Paulo',year:'numeric'}).format(new Date());
    for (const reward of rewards) {
      const row=el('div',null,'tp-record');
      const expired=reward.kind==='birthday' && reward.reward_year!==year;
      row.append(el('strong',reward.label),el('p',reward.used_at?'Utilizado em '+displayDate(reward.used_at):expired?'Expirado':'Disponível'));
      if (!reward.used_at && !expired) {
        if (reward.kind!=='birthday') {
          row.append(whatsappAction('Enviar benefício','benefit',id,reward.id));
          if (/desconto|%|abatimento/i.test(reward.label)) row.append(whatsappAction('Enviar desconto pelo WhatsApp','discount',id,reward.id));
        }
        if (admin) row.append(button('Registrar resgate',async () => {
          if (!confirm('Marcar este benefício como utilizado?')) return;
          await call('redeem',{id,reward:reward.id}); await render();
        },status));
      }
      block.append(row);
    }
    block.append(whatsappAction('Enviar progresso de fidelidade','progress',id));
    if (client.birthday && client.birthday.slice(5,7) === new Intl.DateTimeFormat('en',{timeZone:'America/Sao_Paulo',month:'2-digit'}).format(new Date())) {
      block.append(whatsappAction('Enviar mensagem de aniversário','birthday',id));
    }
    if (admin && client.phone) {
      const consent=el('input'); consent.type='checkbox'; consent.checked=client.consent;
      const test=el('input'); test.type='checkbox'; test.checked=client.test_allowed;
      const a=el('label'); a.append(consent,document.createTextNode(' Autorizou WhatsApp no +' + client.phone));
      const b=el('label'); b.append(test,document.createTextNode(' Contato selecionado para teste'));
      block.append(a, b, button('Salvar autorização de WhatsApp',async () => {
        await call('consent',{id,phone:client.phone,consent:consent.checked,test_allowed:test.checked});
        await render();
        status.textContent='Autorização registrada.';
      },status));
    }
  }
  block.append(status);
  void render().catch(error=>{status.textContent=error.message;});
  return block;
}

export function whatsappClients(openClient) {
  const block=el('section',null,'panel tp-panel');
  const status=live();
  const rows=el('div');
  const filters=choice([['met','Meta atingida'],['near','A uma compra ou manutenção da meta'],['today','Aniversariantes do dia'],['month','Aniversariantes do mês']], 'Filtros de fidelidade');
  let version=0;
  async function load(offset) {
    const current=++version;
    try {
      const {rows:list,next}=await call('overview',{filter:filters.value,offset});
      if (current!==version) return;
      rows.replaceChildren(...list.map(client=>button(client.name,()=>openClient(client.id),status)));
      if (offset) rows.append(button('Anterior',()=>load(offset-25),status));
      if (next!==null) rows.append(button('Próxima',()=>load(next),status));
      status.textContent=list.length?'':'Nenhum cliente neste filtro.';
    } catch (error) { if(current===version) status.textContent=error.message; }
  }
  filters.addEventListener('change',()=>void load(0));
  block.append(el('h3','Fidelidade e aniversários'), filters, status, rows);
  void load(0);
  return block;
}
