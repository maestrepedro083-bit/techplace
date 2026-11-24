function agentMonth(now=new Date()){
  const p=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now).map(x=>[x.type,x.value]));
  const prefix=p.year+'-'+p.month;
  return {start:prefix+'-01',end:prefix+'-'+String(new Date(Date.UTC(Number(p.year),Number(p.month),0)).getUTCDate()).padStart(2,'0')};
}

function agentCents(value){
  const cents=typeof value==='string'&&/^\d+$/.test(value)?Number(value):value;
  if(!Number.isSafeInteger(cents)||cents<0)throw Error('Valor monetário inválido na resposta da loja.');
  return cents;
}

function buildAgentSnapshot(shop,salesData,now=new Date()){
  if(!Array.isArray(shop?.products)||!Array.isArray(shop?.orders)||!Array.isArray(shop?.cash)||!Array.isArray(salesData?.sales))throw Error('Dados inválidos da loja.');
  const period=agentMonth(now),events=[],keys=new Set();
  function add(type,id,title,detail,at,amount){
    if(typeof id!=='string'||!id||typeof at!=='string'||!Number.isFinite(Date.parse(at)))return;
    const local=new Intl.DateTimeFormat('sv-SE',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(at));
    if(local<period.start||local>period.end)return;
    const key=type+':'+id;
    if(keys.has(key))return;
    keys.add(key);events.push({key,type,title,detail,at,amount});
  }
  const activeSales=salesData.sales.filter(s=>!s.voided_at);
  for(const s of salesData.sales){
    add('sale',s.id,'Venda registrada','Venda no painel · '+String(s.payment||'Forma não informada'),s.created_at,agentCents(s.amount));
    if(s.voided_at)add('sale-void',s.id,'Venda estornada','Estorno registrado no painel',s.voided_at,agentCents(s.amount));
  }
  for(const o of shop.orders){
    if(o.deleted_at)continue;
    add('service',o.id,'Ordem de serviço criada',String(o.title||'Serviço'),o.created_at);
    if(o.status==='done')add('service-done',o.id,'Serviço concluído','Situação atual · última atualização',o.updated_at);
  }
  const activeCash=shop.cash.filter(x=>!x.voided_at);
  for(const c of shop.cash){
    if(c.sale_id||c.kind!=='in')continue;
    add('cash',c.id,'Entrada registrada','Lançamento no caixa · '+String(c.payment||'Forma não informada'),c.created_at,agentCents(c.amount));
    if(c.voided_at)add('cash-void',c.id,'Entrada estornada','Estorno registrado no caixa',c.voided_at,agentCents(c.amount));
  }
  const low=shop.products.filter(p=>!p.deleted_at&&Number.isFinite(Number(p.qty))&&Number.isFinite(Number(p.min_qty))&&Number(p.qty)<=Number(p.min_qty));
  for(const p of low){
    const key='stock-low:'+p.id;
    if(typeof p.id!=='string'||keys.has(key))continue;
    keys.add(key);events.push({key,type:'stock-low',title:'Estoque baixo',detail:String(p.name||'Produto')+' · '+String(p.qty)+' '+String(p.unit||''),at:typeof p.updated_at==='string'&&Number.isFinite(Date.parse(p.updated_at))?p.updated_at:null});
  }
  events.sort((a,b)=>(b.at||'').localeCompare(a.at||'')||a.key.localeCompare(b.key));
  return {company:'techplace',period,asOf:now.toISOString(),events,metrics:{
    salesCount:activeSales.length,salesAmount:activeSales.reduce((n,s)=>n+agentCents(s.amount),0),
    cashBalance:activeCash.reduce((n,c)=>n+(c.kind==='in'?1:c.kind==='out'?-1:0)*agentCents(c.amount),0),
    openOrders:shop.orders.filter(o=>!o.deleted_at&&['open','working'].includes(o.status)).length,
    lowStock:low.length
  }};
}


function agentDay(date=new Date()){
  return new Intl.DateTimeFormat('sv-SE',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(date);
}
function agentIntent(text){
  const s=String(text).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
  if(!s)return 'unknown';
  if(/iris|gravac|videomaker|edicao|filmagem/.test(s))return 'iris';
  if(/stone/.test(s))return 'stone';
  if(/infinite/.test(s))return 'infinite';
  if(/cadastr|criar ordem|registrar|excluir|apagar|alterar|estornar/.test(s))return 'draft';
  if(/estoque|repor|acabando/.test(s))return 'stock';
  if(/ordem|servico|reparo|conserto/.test(s))return 'orders';
  if(/saldo|caixa|financeiro|entrada|saida|despesa/.test(s))return 'cash';
  if(/vendi|venda|fatur|lucro|recebi/.test(s))return 'sales';
  return 'unknown';
}
function commandRange(text,now=new Date()){
  const p=String(text).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  const today=agentDay(now);
  if(/\bontem\b/.test(p)){const d=new Date(now.getTime()-86400000);return {start:agentDay(d),end:agentDay(d)};}
  if(/\bhoje\b/.test(p))return {start:today,end:today};
  if(/mes passado/.test(p)){const d=new Date(Date.UTC(Number(today.slice(0,4)),Number(today.slice(5,7))-2,15,12));return agentMonth(d);}
  return agentMonth(now);
}
async function executeAgentCommand(text,request){
  const intent=agentIntent(text),range=commandRange(text),qs=new URLSearchParams(range);
  const brl=new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'});
  if(intent==='iris')return 'A Iris ainda não está conectada a este painel. Abra o site da Iris; seus registros não são acessados nem misturados aqui.';
  if(intent==='stone'||intent==='infinite')return 'Abra a seção Conexões financeiras para consultar a API oficial. Nenhum pagamento será registrado automaticamente.';
  if(intent==='draft')return 'Use o assistente de cadastros para preparar a alteração. Confirme no formulário antes de salvar.';
  if(intent==='unknown')return 'Posso consultar vendas, lucro bruto, caixa, estoque e ordens de serviço. Para outras solicitações, abra o assistente de texto e voz.';
  const shop=await request('/api/loja?'+qs);
  if(intent==='sales'){
    const result=await request('/api/vendas?'+qs);
    if(!Array.isArray(result.sales))throw Error('Resposta de vendas inválida.');
    const active=result.sales.filter(x=>!x.voided_at);
    const revenue=active.reduce((v,s)=>v+agentCents(s.amount),0), cost=active.reduce((v,s)=>v+agentCents(s.cost),0);
    return range.start+' a '+range.end+': '+active.length+' vendas registradas, faturamento de '+brl.format(revenue/100)+', lucro bruto de '+brl.format((revenue-cost)/100)+' (antes das demais despesas). Não inclui vendas externas ainda não conciliadas.';
  }
  if(intent==='cash'){
    if(!Array.isArray(shop.cash))throw Error('Resposta de caixa inválida.');
    const active=shop.cash.filter(x=>!x.voided_at);
    const incoming=active.filter(x=>x.kind==='in').reduce((v,x)=>v+agentCents(x.amount),0),outgoing=active.filter(x=>x.kind==='out').reduce((v,x)=>v+agentCents(x.amount),0);
    return range.start+' a '+range.end+': entradas '+brl.format(incoming/100)+', saídas '+brl.format(outgoing/100)+', saldo '+brl.format((incoming-outgoing)/100)+'.';
  }
  if(intent==='stock'){
    if(!Array.isArray(shop.products))throw Error('Resposta de estoque inválida.');
    const low=shop.products.filter(x=>!x.deleted_at&&Number(x.qty)<=Number(x.min_qty));
    return low.length?low.length+' produtos com estoque baixo: '+low.slice(0,15).map(x=>x.name+' ('+x.qty+')').join('; ')+'.':'Nenhum produto com estoque baixo.';
  }
  if(!Array.isArray(shop.orders))throw Error('Resposta de ordens inválida.');
  const open=shop.orders.filter(x=>!x.deleted_at&&['open','working'].includes(x.status));
  const overdue=open.filter(x=>x.due_day&&x.due_day<agentDay());
  return open.length+' ordens abertas, '+overdue.length+' com prazo vencido. '+open.slice(0,12).map(x=>'#'+x.number+' '+x.title).join('; ');
}
function createFinanceTools({request, node, btn, link}){
  const root=node('section',undefined,'panel agent-panel');
  let config=null,loading=false,answer='',error='',busy=false;
  const post=(data)=>request('/agent-api.php',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});
  function input(form,label,name,type='text',placeholder=''){
    const wrapper=node('label',label),el=node('input');el.name=name;el.type=type;el.placeholder=placeholder;el.required=true;el.maxLength=type==='password'?512:180;el.autocomplete='off';wrapper.append(el);form.append(wrapper);return el;
  }
  function submit(form,label,fn){
    const button=node('button',label,'btn primary');button.type='submit';button.disabled=busy;form.append(button);
    form.addEventListener('submit',async e=>{e.preventDefault();if(busy)return;const values=Object.fromEntries(new FormData(form));busy=true;button.disabled=true;error='';answer='';
      try{await fn(values);form.reset();}catch(e){error=e.message||'Falha na consulta.';}finally{busy=false;render();}});
  }
  async function load(){
    if(loading)return;loading=true;
    try{config=await request('/agent-api.php');error='';}catch(e){config=null;error='Servidor de integrações indisponível. Confira a instalação do agente-api.php.';}finally{loading=false;render();}
  }
  function render(){
    root.replaceChildren(node('h2','Conexões financeiras'),node('p','Consultas reais às APIs oficiais; prévias não lançam vendas no caixa. Credenciais ficam no servidor, protegidas e exclusivas do titular.','subtitle'));
    if(error){const msg=node('p',error,'notice');msg.setAttribute('role','alert');root.append(msg);}
    if(answer)root.append(node('p',answer,'notice'));
    if(!config){root.append(btn(loading?'Consultando…':'Verificar acesso às integrações',()=>void load()));return;}
    if(!config.owner){
      if(config.claimAvailable){
        root.append(node('p','Ative somente na sua conta de titular. Use o código único entregue junto com o pacote de instalação. Depois de ativado, nenhum outro login poderá gerenciar estas integrações.','subtitle'));
        const form=node('form',undefined,'agent-form');input(form,'Código único de ativação','code','password');
        submit(form,'Ativar minha conta como titular',async values=>{config=await post({action:'claim',code:values.code});answer='Titular autorizado. Agora você pode configurar suas conexões.';});root.append(form);
      }else root.append(node('p',config.setupRequired?'Ativação inicial indisponível. Instale o arquivo privado de ativação do pacote ou configure o titular conforme o guia.':'Apenas o titular autorizado pode acessar credenciais e extratos.','subtitle'));
      root.append(btn('Verificar novamente',()=>void load()));return;
    }
    for(const provider of ['stone','infinite']){
      const info=config[provider],isStone=provider==='stone',section=node('div',undefined,'agent-connector');
      section.append(node('h3',isStone?'Stone · Conciliação':'InfinitePay · Checkout'),
        node('p',info.verified?'API consultada com sucesso':info.configured?'Configurada · ainda não validada':'Não configurada','subtitle'));
      if(!info.configured){
        const form=node('form',undefined,'agent-form');
        if(isStone){input(form,'StoneCode','code','text','Código numérico');input(form,'Chave de conciliação Stone','key','password');}
        else input(form,'InfiniteTag','handle','text','Sua tag comercial');
        submit(form,'Salvar conexão',async values=>{config=await post({action:'configure',provider,...values});answer='Configuração salva no servidor. Faça uma consulta para validar a API.';});section.append(form);
      }else{
        const form=node('form',undefined,'agent-form');
        if(isStone){const d=input(form,'Data do extrato (dia anterior ou mais antigo)','date','date');d.value=agentDay(new Date(Date.now()-86400000));}
        else {input(form,'NSU do pedido','order_nsu');input(form,'NSU da transação','transaction_nsu');input(form,'Slug da fatura','slug');}
        submit(form,isStone?'Consultar extrato Stone':'Verificar pagamento',async values=>{
          const res=await post({action:isStone?'stone-preview':'infinite-check',...values});
          if(isStone)answer='Extrato '+values.date+': '+res.counts.records+' registros, '+res.counts.captures+' capturas, '+res.counts.cancellations+' cancelamentos, '+res.counts.chargebacks+' chargebacks. Nenhuma venda importada.';
          else answer=res.paid?'Pagamento confirmado pela InfinitePay: '+new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(res.paidAmount/100)+'. Não vinculado automaticamente ao caixa.':'Pagamento não confirmado pela API. Nenhum lançamento efetuado.';
          config=await request('/agent-api.php');
        });section.append(form,btn('Desconectar',async()=>{if(!window.confirm('Remover somente a configuração desta integração? Nenhuma venda será apagada.'))return;try{config=await post({action:'disconnect',provider});answer='Conexão removida.';error='';}catch(e){error=e.message;}render();}));
      }
      const guide=link(isStone?'Portal Stone':'Documentação InfinitePay',isStone?'https://portal.stone.com.br/':'https://www.infinitepay.io/checkout-documentacao');guide.target='_blank';guide.rel='noopener noreferrer';section.append(guide);root.append(section);
    }
  }
  render();return {root,load};
}

function createUniversalAgent({request,notify}){
  const el=document.createElement('section');el.className='universal-agent';
  const formatter=new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'});
  const dates=new Intl.DateTimeFormat('pt-BR',{timeZone:'America/Sao_Paulo',dateStyle:'short',timeStyle:'short'});
  let snapshot=null,busy=null,enabled=false,known=null,error='',opened=false,timer=null,notice='',commandText='',commandAnswer='',commandBusy=false;
  const node=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;};
  const link=(label,href)=>{const n=node('a',label,'btn');n.href=href;return n;};
  const btn=(label,handler)=>{const n=node('button',label,'btn');n.type='button';n.addEventListener('click',handler);return n;};
  const financial=createFinanceTools({request,node,btn,link});
  function display(){
    if(el.contains(document.activeElement)&&document.activeElement?.closest('form'))return;
    const head=node('div',undefined,'page-head');
    const intro=node('div');intro.append(node('h1','Agente Universal'),node('p','Central de acompanhamento do TechPlace · leitura segura','subtitle'));head.append(intro,btn('Atualizar eventos',()=>void refresh()));
    const panels=node('div',undefined,'agent-panels'),metrics=node('div',undefined,'metrics');
    for(const [label,value] of [['Vendas registradas no mês',snapshot?formatter.format(snapshot.metrics.salesAmount/100):'—'],['Saldo do mês',snapshot?formatter.format(snapshot.metrics.cashBalance/100):'—'],['Ordens abertas',snapshot?String(snapshot.metrics.openOrders):'—'],['Estoque baixo',snapshot?String(snapshot.metrics.lowStock):'—']]){
      const m=node('article',undefined,'metric');m.append(node('small',label),node('strong',value));metrics.append(m);
    }
    const commands=node('section',undefined,'panel agent-panel');commands.append(node('h2','Consultas e comandos'),node('p','Use o assistente existente para consultas e rascunhos de cadastros. Alterações continuam sujeitas à confirmação no formulário.','subtitle'));
    const commandForm=node('form',undefined,'agent-form');
    const commandLabel=node('label','Peça algo ao agente'),commandInput=node('textarea');commandInput.name='command';commandInput.rows=3;commandInput.maxLength=500;commandInput.required=true;commandInput.value=commandText;commandInput.placeholder='Quanto vendi hoje? Qual o saldo?';
    commandInput.addEventListener('input',()=>{commandText=commandInput.value;});commandLabel.append(commandInput);commandForm.append(commandLabel);
    const send=node('button',commandBusy?'Consultando…':'Executar consulta','btn primary');send.type='submit';send.disabled=commandBusy;commandForm.append(send);
    commandForm.addEventListener('submit',async e=>{e.preventDefault();if(commandBusy)return;commandBusy=true;send.disabled=true;const answer=node('p','Consultando registros reais…','subtitle');commandForm.append(answer);
      try{commandAnswer=await executeAgentCommand(commandText,request);}catch(err){commandAnswer='Não foi possível consultar os dados: '+err.message;}finally{commandBusy=false;send.disabled=false;answer.textContent=commandAnswer;}});
    const speech=window.SpeechRecognition||window.webkitSpeechRecognition;
    if(speech)commandForm.append(btn('Ditar comando',()=>{try{const rec=new speech();rec.lang='pt-BR';rec.onresult=e=>{commandText=e.results[0][0].transcript;commandInput.value=commandText;};rec.onerror=()=>notify?.('Não foi possível usar o microfone.');rec.start();}catch{notify?.('Microfone indisponível.');}}));
    if(commandAnswer)commandForm.append(node('p',commandAnswer,'subtitle'));commands.append(commandForm);
    const actions=node('div',undefined,'actions');actions.append(link('Abrir assistente de texto e voz','#assistente'),link('Vendas','#vendas'),link('Ordens de serviço','#servicos'),link('Estoque','#estoque'),link('Caixa','#caixa'));commands.append(actions);
    const connections=node('section',undefined,'panel agent-panel');connections.append(node('h2','Integrações por empresa'),node('p','Conexões futuras não compartilham credenciais ou registros.','subtitle'));
    for(const [name,status] of [['TechPlace','Leitura dos dados da loja autenticada'],['Íris Videomaker','Aguardando conexão segura do código e backend'],['Stone','Configure e consulte em Conexões financeiras'],['InfinitePay','Configure e verifique em Conexões financeiras']]){
      const row=node('div',undefined,'agent-line');row.append(node('strong',name),node('span',status));connections.append(row);
    }
    const alertPanel=node('section',undefined,'panel agent-panel');alertPanel.append(node('h2','Notificações'),node('p','Alertas locais enquanto o painel da loja estiver aberto. Não é Web Push: ainda não envia com o navegador fechado.','subtitle'));
    const alertActions=node('div',undefined,'actions');
    alertActions.append(btn(enabled?'Desativar alertas neste acesso':'Ativar alertas neste acesso',async()=>{
      if(enabled){enabled=false;known=null;notice='Alertas locais desativados.';display();return;}
      if(!('Notification' in window)||!window.isSecureContext){notice='Este navegador não oferece notificações locais seguras.';display();return;}
      try{
        const permission=await Notification.requestPermission();
        if(permission!=='granted'){notice='Permissão de notificações não concedida.';display();return;}
        enabled=true;known=null;notice='Alertas ativados. O histórico existente não gerará notificações.';display();await refresh();
      }catch{notice='Não foi possível ativar notificações neste navegador.';display();}
    }));
    alertPanel.append(alertActions,node('p',notice||'Desativado por padrão. As notificações não contêm nomes de clientes nem valores.','subtitle'));
    const feed=node('section',undefined,'panel agent-panel');feed.append(node('h2','Eventos e alertas reais'),node('p','Registros do mês e situação atual do estoque. Pagamentos registrados não significam confirmação da Stone ou InfinitePay.','subtitle'));
    if(error){const msg=node('p',error,'notice');msg.setAttribute('role','alert');feed.append(msg);}
    else if(busy&&!snapshot)feed.append(node('p','Consultando registros existentes…','subtitle'));
    else if(!snapshot)feed.append(node('p','Nenhuma consulta realizada.','subtitle'));
    else if(!snapshot.events.length)feed.append(node('p','Nenhum evento ou alerta encontrado neste período.','subtitle'));
    else{
      feed.append(node('small','Atualizado em '+dates.format(new Date(snapshot.asOf))));
      for(const event of snapshot.events.slice(0,60)){
        const row=node('div',undefined,'agent-event'),description=node('div');description.append(node('strong',event.title),node('p',event.detail,'subtitle'));
        if(event.at)description.append(node('small',dates.format(new Date(event.at))));
        row.append(description);if(event.amount!==undefined)row.append(node('strong',formatter.format(event.amount/100)));feed.append(row);
      }
    }
    panels.append(commands,financial.root,connections,alertPanel,feed);el.replaceChildren(head,metrics,panels);
  }
  function localAlerts(data){
    if(!enabled)return;
    if(!known){known=new Set(data.events.map(e=>e.key));return;}
    const fresh=data.events.filter(e=>!known.has(e.key));
    for(const e of fresh)known.add(e.key);
    if(!fresh.length)return;
    try{
      if(Notification.permission!=='granted'){enabled=false;notice='Permissão de notificações revogada.';return;}
      new Notification('TechPlace · '+(fresh.length===1?fresh[0].title:'Novos eventos na loja'),{body:'Abra o painel para conferir os detalhes.',tag:'techplace-agent',icon:'/icons/tech-place-192.png'});
    }catch{enabled=false;notice='Notificações locais indisponíveis. Os eventos continuam no painel.';notify?.(notice);}
  }
  function refresh(){
    if(busy)return busy;
    const period=agentMonth(),query=new URLSearchParams(period).toString();
    busy=Promise.all([request('/api/loja?'+query),request('/api/vendas?'+query)])
      .then(([shop,sales])=>{const data=buildAgentSnapshot(shop,sales);snapshot=data;error='';localAlerts(data);})
      .catch(()=>{error='Não foi possível consultar os eventos. Nenhum registro foi alterado.';})
      .finally(()=>{busy=null;if(el.isConnected)display();});
    if(el.isConnected)display();
    return busy;
  }
  function start(){if(timer!==null)return;timer=window.setInterval(()=>{if(enabled||el.isConnected)void refresh();},45000);}
  function mount(){if(!opened){opened=true;display();void refresh();}return el;}
  return {mount,refresh,start};
}

export { agentMonth, buildAgentSnapshot, createUniversalAgent, agentIntent, commandRange, executeAgentCommand };
