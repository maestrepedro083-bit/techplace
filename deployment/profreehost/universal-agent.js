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

function createUniversalAgent({request,notify}){
  const el=document.createElement('section');el.className='universal-agent';
  const formatter=new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'});
  const dates=new Intl.DateTimeFormat('pt-BR',{timeZone:'America/Sao_Paulo',dateStyle:'short',timeStyle:'short'});
  let snapshot=null,busy=null,enabled=false,known=null,error='',opened=false,timer=null,notice='';
  const node=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;};
  const link=(label,href)=>{const n=node('a',label,'btn');n.href=href;return n;};
  const btn=(label,handler)=>{const n=node('button',label,'btn');n.type='button';n.addEventListener('click',handler);return n;};
  function display(){
    const head=node('div',undefined,'page-head');
    const intro=node('div');intro.append(node('h1','Agente Universal'),node('p','Central de acompanhamento do TechPlace · leitura segura','subtitle'));head.append(intro,btn('Atualizar eventos',()=>void refresh()));
    const panels=node('div',undefined,'agent-panels'),metrics=node('div',undefined,'metrics three');
    for(const [label,value] of [['Vendas registradas no mês',snapshot?formatter.format(snapshot.metrics.salesAmount/100):'—'],['Saldo do mês',snapshot?formatter.format(snapshot.metrics.cashBalance/100):'—'],['Ordens abertas',snapshot?String(snapshot.metrics.openOrders):'—'],['Estoque baixo',snapshot?String(snapshot.metrics.lowStock):'—']]){
      const m=node('article',undefined,'metric');m.append(node('small',label),node('strong',value));metrics.append(m);
    }
    const commands=node('section',undefined,'panel agent-panel');commands.append(node('h2','Consultas e comandos'),node('p','Use o assistente existente para consultas e rascunhos de cadastros. Alterações continuam sujeitas à confirmação no formulário.','subtitle'));
    const actions=node('div',undefined,'actions');actions.append(link('Abrir assistente de texto e voz','#assistente'),link('Vendas','#vendas'),link('Ordens de serviço','#servicos'),link('Estoque','#estoque'),link('Caixa','#caixa'));commands.append(actions);
    const connections=node('section',undefined,'panel agent-panel');connections.append(node('h2','Integrações por empresa'),node('p','Conexões futuras não compartilham credenciais ou registros.','subtitle'));
    for(const [name,status] of [['TechPlace','Leitura dos dados da loja autenticada'],['Íris Videomaker','Aguardando conexão segura do código e backend'],['Stone','Aguardando acesso oficial e conciliação'],['InfinitePay','Aguardando acesso oficial e conciliação']]){
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
    panels.append(commands,connections,alertPanel,feed);el.replaceChildren(head,metrics,panels);
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

export { agentMonth, buildAgentSnapshot, createUniversalAgent };
