import { buildWarrantyPdf } from './warranty-pdf.mjs';
const LEGACY_WARRANTY_TERMS = 'TP-G01/2026 — Garantia do serviço executado e das peças fornecidas no reparo, conforme OS. Prazo informado contado da entrega efetiva ou conclusão do serviço. Danos ou defeitos sem relação comprovada com o reparo não são abrangidos. Solicite avaliação à TechPlace Store. A garantia legal, os direitos do consumidor e as regras aplicáveis aos vícios ocultos permanecem preservados.';
const PREVIOUS_WARRANTY_TERMS = 'TP-G02/2026 — Garantia de 90 dias do serviço realizado e das peças fornecidas no reparo. Não cobre danos ou defeitos sem relação comprovada com o serviço. Em caso de falha, solicite avaliação à TechPlace Store. Preservados os direitos legais do consumidor, inclusive em caso de vício oculto.';
export const WARRANTY_TERMS = 'TP-G03/2026 — Garantia de 90 dias do serviço realizado e das peças fornecidas no reparo. Não cobre arranhões ou outros danos posteriores sem relação comprovada com o serviço. O aparelho acompanha película protetora de cortesia para ajudar a prevenir arranhões. Solicite avaliação à TechPlace Store. Preservados os direitos legais do consumidor, inclusive em caso de vício oculto.';
export const WARRANTY_CNPJ = '48.917.899/0001-38';
const WARRANTY_EDITION = 'TP-G03/2026';
const warrantyEdition = terms => terms===WARRANTY_TERMS?WARRANTY_EDITION:terms===PREVIOUS_WARRANTY_TERMS?'TP-G02/2026':terms===LEGACY_WARRANTY_TERMS?'TP-G01/2026':'Emissão original';
export function warrantyExpiry(start,days){
  const d=new Date(start+'T12:00:00Z');
  if(!/^\d{4}-\d{2}-\d{2}$/.test(start)||!Number.isFinite(d.valueOf())||d.toISOString().slice(0,10)!==start||!Number.isInteger(Number(days))||Number(days)<1)throw Error('Data ou prazo de garantia inválido.');
  d.setUTCDate(d.getUTCDate()+Number(days));return d;
}
export function warrantyClauses(order){
  if([WARRANTY_TERMS,PREVIOUS_WARRANTY_TERMS].includes(order.warranty_terms))return [
    ['Cobertura','A garantia cobre exclusivamente o serviço realizado e as peças fornecidas e instaladas no reparo descrito nesta ordem de serviço.'],
    ['Prazo','90 dias a partir da entrega do aparelho ou conclusão do serviço, sem prejuízo de prazo superior informado e dos direitos legais, inclusive em caso de vício oculto.'],
    ['Exclusões',order.warranty_terms===WARRANTY_TERMS?'Não cobre arranhões, quedas, líquidos, mau uso ou intervenções de terceiros, quando comprovadamente sem relação com o reparo. O aparelho acompanha película protetora de cortesia para ajudar a prevenir arranhões.':'Não cobre danos por quedas, líquidos, mau uso, intervenções de terceiros ou outros defeitos, quando comprovadamente sem relação com o reparo.'],
    ['Atendimento','Em caso de falha, entre em contato com a TechPlace Store e informe a ordem de serviço para avaliação. Falhas cobertas serão tratadas sem custo adicional, conforme o Código de Defesa do Consumidor.']
  ];
  if(order.warranty_terms!==LEGACY_WARRANTY_TERMS)return [
    ['Condições registradas na emissão original',order.warranty_terms||'Condições não registradas.'],
    ['Solicitação de atendimento','Entre em contato com a TechPlace Store e informe a ordem de serviço para avaliação do aparelho.'],
    ['Preservação dos direitos','Este documento não limita os direitos previstos no Código de Defesa do Consumidor, inclusive o prazo aplicável a vícios ocultos.']
  ];
  return [
    ['Objeto e abrangência','A garantia refere-se ao serviço descrito nesta ordem e às peças fornecidas e instaladas pela TechPlace Store para sua execução. Abrange vícios de qualidade relacionados ao reparo efetuado, sem estender a cobertura a componentes ou defeitos independentes.'],
    ['Prazo e início da cobertura','Para o serviço durável, o prazo legal é de 90 dias, contados da entrega efetiva ou do término da execução do serviço, conforme aplicável. O prazo informado neste documento não reduz a garantia legal. Em caso de vício oculto, a contagem legal inicia-se quando o defeito se evidencia.'],
    ['Situações não abrangidas','Não são abrangidos danos posteriores por impacto, queda, contato com líquidos, oxidação, uso inadequado, instalação de componentes por terceiros ou outros eventos externos, quando demonstrada sua ausência de relação com o reparo. A ocorrência desses eventos não implica, por si só, perda automática de direitos.'],
    ['Procedimento de atendimento','Para solicitar atendimento, contate a TechPlace Store pelo mesmo canal utilizado na contratação ou compareça ao estabelecimento. Informe o número da OS ou outro comprovante do serviço. A equipe realizará avaliação técnica para verificar a origem da falha.'],
    ['Solução de falhas cobertas','Confirmado vício relacionado ao serviço, a solução será oferecida sem custo adicional ao consumidor, observadas as alternativas e demais direitos previstos na legislação aplicável. Eventual serviço não abrangido dependerá de orçamento e autorização prévia.'],
    ['Disposições finais','Nenhuma condição aqui prevista restringe os direitos assegurados pela Lei nº 8.078/1990, especialmente os arts. 20, 24 e 26.']
  ];
}
export function createWarrantyFile(client,order){
  const recorded=Boolean(order.warranty_start&&order.warranty_days);
  const record={...order,warranty_terms:recorded?order.warranty_terms:WARRANTY_TERMS,warranty_start:recorded?order.warranty_start:null,warranty_days:recorded?order.warranty_days:90};
  const expiry=recorded?warrantyExpiry(record.warranty_start,record.warranty_days).toISOString():null;
  const pdf=buildWarrantyPdf({client,order:record,clauses:warrantyClauses(record),expiry,cnpj:WARRANTY_CNPJ,edition:warrantyEdition(record.warranty_terms)});
  return new File([pdf],'TechPlace-Garantia-OS-'+String(order.number||'').replace(/[^a-zA-Z0-9-]/g,'')+'.pdf',{type:'application/pdf'});
}
