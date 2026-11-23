import { fold } from './films.js';

export const knowledgeAreas = {
  technical: 'Assistência técnica',
  sales: 'Venda de acessórios',
  operation: 'Operação da loja'
};

export const knowledgeTopics = {
  moisture: { area: 'technical', label: 'Líquido e alerta de umidade', pattern: /umidade|molhad|caiu na agua|contato com liquido|entrou agua/ },
  charging: { area: 'technical', label: 'Triagem de problemas de carga', pattern: /nao (?:(?:esta|ta|quer|consegue) )?carreg|carrega (?:devagar|lentamente)|falha de carga|porta de carga|conector de carga|carregamento (?:intermitente|lento)|problema de carga|descarga rapida/ },
  power: { area: 'technical', label: 'Aparelho que não liga', pattern: /nao (?:(?:esta|ta|quer|consegue) )?(?:lig|inici)|tela preta|sem ligar|sem sinal de vida|reinicia sozinho/ },
  display: { area: 'technical', label: 'Tela e toque', pattern: /tela (?:pisc|risc|trinc|quebr|manch|falh|sem imagem)|toque falh|touch|toque nao|display|troca de tela/ },
  audio: { area: 'technical', label: 'Áudio e microfone', pattern: /sem som|microfone|alto falante|audio baix|falha de audio/ },
  camera: { area: 'technical', label: 'Câmera e imagem', pattern: /camera nao|camera desfoc|falha de camera|camera trem/ },
  battery: { area: 'technical', label: 'Bateria, autonomia e aquecimento', pattern: /bateria (?:estuf|inch|descarreg|dura)|superaquec|aquecimento/ },
  network: { area: 'technical', label: 'Rede móvel e conectividade', pattern: /wifi|wi-fi|bluetooth|sem sinal|nao reconhece o chip|rede movel/ },
  intake: { area: 'technical', label: 'Recebimento e triagem na bancada', pattern: /checklist de entrada|recebimento (?:de|do) aparelho|receber (?:o |um )?(?:aparelho|celular)|entrada na bancada|[óo]r[cç]amento de reparo|triagem|check-in|para reparo|modo manutencao|modo de manutencao|backup/ },
  delivery: { area: 'technical', label: 'Testes de entrega e retorno', pattern: /testes? (?:de entrega|fina(?:l|is)|apos|antes da entrega)|entrega (?:do aparelho|ao cliente)|retrabalho|retorno de garantia|checklist de entrega/ },
  'technical-general': { area: 'technical', label: 'Outros assuntos de assistência técnica', pattern: /assistencia tecnica|reparo|conserto|bateria estuf|bancada|tecnico|procedimento/ },
  films: { area: 'sales', label: 'Películas e compatibilidade', pattern: /pelicul|hidrogel|vidro temperado/ },
  charger: { area: 'sales', label: 'Cabos e carregadores', pattern: /carregador|cabo (?:usb|lightning|tipo c)|potencia|usb p[ds]|pps|usb c|cabo de carga/ },
  cases: { area: 'sales', label: 'Capas e proteção do aparelho', pattern: /capinha|capa de celular|capa para|capa compativel|capas|case/ },
  warranty: { area: 'sales', label: 'Trocas, garantias e pós-venda', pattern: /garantia|troca de acessorio|devolucao|pos-venda/ },
  sale: { area: 'sales', label: 'Atendimento e venda de acessórios', pattern: /vender|venda (?:de acessorio|no balcao)|oferecer|kit de|kit com|venda casada|conversao de venda|balcao|acessorio/ },
  pricing: { area: 'sales', label: 'Preço, custo e margem', pattern: /precificar|precificacao|margem|markup|formar preco|preco de venda|calcular preco|lucro bruto/ },
  stock: { area: 'operation', label: 'Estoque e reposição', pattern: /estoque|reposicao|fornecedor|mercadoria/ },
  orders: { area: 'operation', label: 'Ordens de serviço e prazos', pattern: /ordem|ordens|\b(?:uma|abrir|editar|consultar|numero da|a) o\.?s\b|atraso|prazo/ },
  cash: { area: 'operation', label: 'Caixa e pagamentos', pattern: /caixa|pagamento|saldo|recebimento|estorno/ },
  general: { area: 'operation', label: 'Outras dúvidas da loja' }
};

const reference = (id, topic, title, body, evidence = 'Rotina sugerida para a equipe', source_url = '') => ({
  id, topic, title, body, evidence, source_url, status: 'published', starter: true
});

export const starterGuides = [
  reference('ref-charging', 'charging', 'Celular que não carrega ou carrega devagar',
    'Comece perguntando quando a falha aparece e se houve queda, contato com líquido ou uso de outro carregador. Em aparelho seco e sem sinais de dano, teste uma tomada, um cabo e um adaptador compatíveis que já funcionem. Troque um item de cada vez e anote o resultado.\n\nSe houver alerta de umidade, cheiro de queimado, deformação ou aquecimento anormal, interrompa o teste de carga e encaminhe para avaliação técnica.',
    'Suporte da Samsung sobre falhas de carga', 'https://www.samsung.com/br/support/mobile-devices/samsung-galaxy-nao-carrega-ou-carrega-lentamente/'),
  reference('ref-moisture', 'moisture', 'Alerta de umidade ou contato com líquido',
    'Desconecte o cabo se puder fazê-lo com segurança e siga as orientações do fabricante do modelo. Evite testar a carga enquanto houver umidade ou alerta ativo. Em iPhone, a Apple orienta deixar secar em local ventilado e evitar fonte de calor, ar comprimido, arroz ou objetos no conector. Se o alerta persistir, recomende avaliação técnica.',
    'Suporte da Apple sobre detecção de líquido', 'https://support.apple.com/pt-br/102643'),
  reference('ref-power', 'power', 'Aparelho apagado ou sem resposta',
    'Confirme o modelo exato e anote os sinais observados: vibração, som, imagem ou indicador de bateria. Em aparelho sem sinais de líquido ou dano, verifique a alimentação com um acessório compatível e siga a rotina de reinicialização do fabricante para o modelo. Registre o que aconteceu após cada etapa para orientar o próximo teste. A tela preta, sozinha, não identifica a peça com defeito.',
    'Suporte da Apple sobre aparelhos sem resposta', 'https://support.apple.com/pt-br/116940'),
  reference('ref-display', 'display', 'Tela ou toque intermitente',
    'Registre se a falha aparece em toda a tela ou em uma faixa, e se ocorre com o carregador conectado. Em aparelho íntegro, verifique se a tela está limpa e seca e confira se capa, película ou acessório interfere. Em caso de trinca, queda ou líquido, registre a condição antes de continuar e encaminhe para diagnóstico.',
    'Suporte da Apple sobre tela e toque', 'https://support.apple.com/pt-br/102567'),
  reference('ref-intake', 'intake', 'Checklist de recebimento do aparelho',
    'Confirme marca, modelo e sintoma relatado. Registre estado externo, acessórios entregues, testes autorizados e prazo de retorno. Oriente o cliente sobre backup e, quando disponível, modo de reparo ou manutenção do próprio aparelho. Use a ordem de serviço para acompanhar o atendimento. Evite registrar senhas ou códigos de desbloqueio.'),
  reference('ref-delivery', 'delivery', 'Checklist para entrega de um reparo',
    'Compare os testes finais com o que foi registrado na entrada. Demonstre ao cliente a função reparada e, quando pertinente, verifique carregamento, toque, áudio, câmera e conectividade com autorização. Registre o resultado, a peça utilizada, a orientação de garantia aplicável e a data de entrega.'),
  reference('ref-chargers', 'charger', 'Escolher cabo e carregador para o cliente',
    'Confirme o conector nas duas pontas, o modelo do aparelho e o uso do cabo: carga, dados ou vídeo. Confira a potência indicada no carregador e no cabo. Para prometer carregamento rápido, veja se aparelho, carregador e cabo suportam o padrão exigido pelo modelo, como USB Power Delivery ou PPS.',
    'USB-IF sobre USB Power Delivery', 'https://usb.org/usb-charger-pd'),
  reference('ref-films', 'films', 'Conferir película antes de abrir a embalagem',
    'Confirme o modelo e a variante do celular. Na aba Películas, compare as referências pela linha do fornecedor. Confira recortes, bordas, curvatura, área útil da tela e o encaixe com a capa. Quando a equipe testar uma referência da loja, registre a embalagem ou o SKU, os aparelhos exatos e o resultado.'),
  reference('ref-case', 'cases', 'Conferir capinha pelo modelo e pelos recortes',
    'Confirme o modelo completo, incluindo sufixos como Plus, Pro, 4G e 5G. Compare a posição e o tamanho do conjunto de câmeras, botões, encaixe do conector e altura das bordas. Registre no estoque o modelo testado e a referência da embalagem para facilitar a próxima venda.'),
  reference('ref-sale', 'sale', 'Oferecer acessórios a partir do uso do cliente',
    'Pergunte como a pessoa usa o aparelho e qual problema quer resolver. Para proteção, apresente capa e película compatíveis com preços separados. Para carga, confirme conector e potência. Mostre duas opções quando houver diferença clara de preço ou função e anote pedidos sem estoque para orientar a reposição.'),
  reference('ref-pricing', 'pricing', 'Calcular margem antes de definir o preço',
    'Some custo de compra, frete rateado e despesas variáveis atribuíveis à venda. Calcule margem sobre a venda dividindo (preço de venda menos custos variáveis) pelo preço de venda. Exemplo: venda de R$ 50 com custos variáveis de R$ 30 deixa R$ 20, ou 40% de margem de contribuição antes de despesas fixas.'),
  reference('ref-stock', 'stock', 'Priorizar a reposição de acessórios',
    'Use o estoque mínimo para descobrir o que precisa de reposição. Compare a saída recente, o prazo do fornecedor e a frequência com que o cliente pede o modelo. Registre referências distintas para versões 4G, 5G, Pro e Plus quando o encaixe for diferente.')
];

export function topicForRequest(text, action = '') {
  const value = fold(text);
  const hints = { films: 'films', 'film-draft': 'films', 'stock-move': 'stock', 'cash-draft': 'cash',
    stock: 'stock', orders: 'orders', cash: 'cash' };
  const detected = Object.entries(knowledgeTopics).find(([, topic]) => topic.pattern?.test(value))?.[0];
  return hints[action] || detected || 'general';
}

export function prefersKnowledge(text, action, mode) {
  if (mode === 'knowledge') return true;
  if (mode !== 'auto' && mode !== 'lookup') return false;
  const value = fold(text);
  if (/\b(?:guia|base de conhecimento|manual|dica|checklist|procedimento)\b/.test(value) &&
      !['draft', 'film-draft', 'cash-draft', 'stock-move'].includes(action)) return true;
  if (action === 'guide' && /\b(?:onde|como)\b/.test(value) &&
      /\b(?:cadastr\w*|export\w*|estorn\w*|lan[cç]\w*|edit\w*)\b/.test(value)) return false;
  if (action === 'guide') return true;
  const detected = topicForRequest(text);
  return !['draft', 'film-draft', 'cash-draft', 'stock-move'].includes(action) &&
    ['moisture', 'charging', 'power', 'display', 'audio', 'camera', 'battery', 'network', 'intake', 'delivery', 'charger', 'cases', 'warranty', 'sale', 'pricing', 'technical-general'].includes(detected) &&
    !/\b(?:quant[oa]s?|estoque de|disponivel|temos|saldo|quanto entrou)\b/.test(value);
}

const stopWords = new Set('qual quais quando posso como fazer saber me da de do dos das para por em na no o a e um uma guia base conhecimento checklist sobre procedimento ajuda celular aparelho'.split(' '));
const words = (value) => [...new Set(fold(value).split(/[^a-z0-9]+/).filter((word) => word.length > 2 && !stopWords.has(word)))];

export function relevantGuides(text, topic, guides) {
  const requested = words(text);
  return [...guides.filter((guide) => guide.status === 'published'), ...starterGuides].map((guide) => {
    const label = words(guide.title);
    const body = words(guide.body);
    const hits = requested.filter((word) => label.includes(word)).length;
    const details = requested.filter((word) => body.includes(word)).length;
    const sameTopic = topic !== 'general' && guide.topic === topic;
    const score = (sameTopic ? 8 : 0) + hits * 3 + Math.min(details, 3);
    return { guide, score: (sameTopic || hits >= 2) ? score + (guide.starter ? 0 : 2) : 0 };
  }).filter((entry) => entry.score > 0).sort((a, b) => b.score - a.score).slice(0, 3).map((entry) => entry.guide);
}

export function guideIdeas(stats, guides) {
  const drafts = new Set(guides.filter((guide) => guide.status === 'draft').map((guide) => guide.topic));
  return stats.filter((stat) => !drafts.has(stat.topic))
    .map((stat) => ({ ...stat, pending: stat.pending ?? 0 }))
    .filter((stat) => stat.pending >= 2 || stat.improvement > 0)
    .sort((a, b) => b.pending - a.pending || b.total - a.total)
    .slice(0, 6);
}

export const featureIdeas = [
  { title: 'Entrada com fotos e termo', detail: 'Anexar fotos, estado do aparelho e acessórios entregues à ordem de serviço.' },
  { title: 'Orçamento e avisos ao cliente', detail: 'Enviar aprovação, prazo e aviso de retirada a partir da ordem de serviço.' },
  { title: 'Venda rápida no balcão', detail: 'Registrar o pagamento e baixar o estoque na mesma venda, com recibo.' },
  { title: 'Garantias e retornos', detail: 'Ligar o retorno à ordem original e consultar peça, data de entrega e cobertura.' },
  { title: 'Lista de compras', detail: 'Agrupar itens no mínimo por fornecedor e comparar custo e prazo de reposição.' }
];
