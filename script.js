const API_BASE = 'http://localhost:5145/api';
// templates de endpoint por id
const API_HOTEIS_ID = id => `${API_BASE}/Hoteis/${id}`;
const API_QUARTOS_ID = id => `${API_BASE}/Quartos/${id}`;
const API_QUARTOS_POR_HOTEL = hotelId => `${API_BASE}/Quartos?hotelId=${hotelId}`;

// Estado local
let hoteis = [];
let quartos = [];

// Helpers para lidar com diferentes formatos de objeto (PT/EN)
function idHotelDe(h){ return h.id ?? h.hotelId ?? h.idHotel ?? null }
function nomeHotelDe(h){ return h.nome ?? h.name ?? h.nomeHotel ?? 'Sem nome' }
function idQuartoDe(r){ return r.id ?? r.quartoId ?? r.roomId ?? null }
function tipoQuartoDe(r){
  // procura pelo campo que representa o TIPO ou NOME do quarto
  return r.tipo ?? r.tipoQuarto ?? r.tipo_quarto ?? r.roomType ?? r.room_type ?? r.type ?? r.nome ?? r.name ?? r.titulo ?? r.title ?? (r.numero ? `Quarto ${r.numero}` : null) ?? 'Sem tipo';
}
function precoQuartoDe(r){
  return r.preco ?? r.preço ?? r.price ?? r.valor ?? r.valorDiaria ?? r.dailyPrice ?? r.valor_por_noite ?? null;
}

function formatarMoeda(v){
  if(v === null || v === undefined || v === '') return '—';
  const n = Number(v);
  if(isNaN(n)) return String(v);
  try{ return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); }catch(e){ return 'R$ '+n.toFixed(2) }
}

function idHotelDoQuarto(r){ return r.hotelId ?? r.idHotel ?? r.hoteisId ?? r.hotel?.id ?? null }

function nomeHotelFromRoom(r){
  return (r.nomeHotel ?? r.hotelNome ?? r.nome_hotel ?? r.hotel?.nome ?? r.hotel?.name ?? null);
}

function encontrarHotelPorNome(nome){
  if(!nome) return null;
  const n = String(nome).toLowerCase().trim();
  return hoteis.find(h => String(nomeHotelDe(h)).toLowerCase().trim() === n) ?? null;
}

async function buscarJson(url, opts){
  try{
    const res = await fetch(url, opts);
    if(!res.ok){
      const t = await res.text();
      throw new Error(`${res.status} - ${t}`);
    }
    const txt = await res.text();
    return txt ? JSON.parse(txt) : null;
  }catch(err){
    console.error('Erro de fetch', url, err);
    throw err;
  }
}

async function obterHoteis(){
  const data = await buscarJson(`${API_BASE}/Hoteis`);
  hoteis = Array.isArray(data) ? data : (data?.items ?? []);
  renderizarHoteis();
  popularSelectsHoteis();
  return hoteis;
}

async function postarHotel(payload){
  const body = {
    nome: payload.nome,
    cidade: payload.cidade ?? payload.city,
    localizacao: payload.localizacao,
    qtdEstrelas: payload.qtdEstrelas ? parseInt(payload.qtdEstrelas,10) : undefined,
    descricao: payload.descricao
  };
  return await buscarJson(`${API_BASE}/Hoteis`, {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(body)});
}

async function obterQuartos(){
  const data = await buscarJson(`${API_BASE}/Quartos`);
  quartos = Array.isArray(data) ? data : (data?.items ?? []);
  renderizarQuartos();
  popularSelectQuartos();
  return quartos;
}

async function postarQuarto(payload){
  const body = {
    tipo: payload.tipo,
    nome: payload.nome ?? payload.tipo,
    descricao: payload.descricao,
    preco: payload.preco ?? payload.price,
    hotelId: payload.hotelId
  };
  return await buscarJson(`${API_BASE}/Quartos`, {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(body)});
}

// Rendering
function renderizarHoteis(){
  const container = document.getElementById('hotelsList');
  container.innerHTML = '';
  if(hoteis.length === 0){ container.innerHTML = '<div class="muted">Nenhum hotel encontrado.</div>'; return }
  hoteis.forEach((h, idx) => {
    const id = idHotelDe(h);
    const name = nomeHotelDe(h);
    const cidade = h.cidade ?? h.city ?? '';
    const loc = h.localizacao ?? h.location ?? '';
    const estrelas = h.qtdEstrelas ?? h.stars ?? h.estrelas ?? '';
    const desc = h.descricao ?? h.description ?? '';

    const el = document.createElement('div'); el.className='hotel-item';
    el.innerHTML = `<div style="display:flex;justify-content:space-between;align-items:center"><strong>${escapeHtml(name)}</strong><span class="tag">${escapeHtml(String(estrelas))} ★</span></div><div class="meta muted small">ID: ${escapeHtml(String(id))} ${cidade? '• '+escapeHtml(cidade):''} ${loc? '• '+escapeHtml(loc):''}</div><div class="small" style="margin-top:8px">${escapeHtml(desc)}</div>`;

    // botão para mostrar/ocultar quartos do hotel
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'secondary';
    btn.style.marginTop = '10px';
    btn.textContent = 'Ver quartos';
  // se não houver id numérico, criamos uma chave local para evitar passar null para a API
  const dataKey = id ?? `noid-${idx}`;
  btn.addEventListener('click', ()=> alternarDetalhesHotel(dataKey));

  const detalhesDiv = document.createElement('div');
  detalhesDiv.id = `detalhes-${dataKey}`;
  // armazenar o nome para casos sem id numérico (fazer filtro local)
  detalhesDiv.dataset.hotelName = name;
    detalhesDiv.style.display = 'none';
    detalhesDiv.style.marginTop = '12px';

    el.appendChild(btn);
    el.appendChild(detalhesDiv);
    container.appendChild(el);
  });
}

// Alterna a exibição dos detalhes (quartos) de um hotel
async function alternarDetalhesHotel(hotelId){
  const detalhesDiv = document.getElementById(`detalhes-${hotelId}`);
  if(!detalhesDiv) return;
  if(detalhesDiv.style.display === 'block'){
    detalhesDiv.style.display = 'none';
    return;
  }
  // se já carregado, apenas mostra
  if(detalhesDiv.dataset.loaded === 'true'){
    detalhesDiv.style.display = 'block';
    return;
  }

  // preenche detalhes chamando função que busca e renderiza quartos deste hotel
  mostrarQuartos(hotelId, detalhesDiv);
}

// Busca quartos por hotel via API (ou fallback local) e renderiza dentro do detalhesDiv
async function mostrarQuartos(hotelId, detalhesDiv){
  if(!detalhesDiv) detalhesDiv = document.getElementById(`detalhes-${hotelId}`);
  if(!detalhesDiv) return;
  detalhesDiv.innerHTML = '<div class="muted">Carregando quartos...</div>';

  let quartosDoHotel = [];
  // obter nome do hotel alvo (prioriza hotelId quando possível)
  let hotelObj = null;
  if(hotelId && (/^[0-9]+$/.test(String(hotelId)))){
    hotelObj = hoteis.find(h => String(idHotelDe(h)) === String(hotelId));
  }
  // se não achou por id, tenta usar dataset.hotelName (caso de chave local)
  const hotelNomeAlvo = hotelObj ? nomeHotelDe(hotelObj) : (detalhesDiv.dataset.hotelName ?? null);

  // tenta buscar todos os quartos e filtrar por nome do hotel (API retorna nomeHotel nos objetos)
  try{
    const data = await buscarJson(`${API_BASE}/Quartos`);
    const todos = Array.isArray(data) ? data : (data?.items ?? []);
    quartosDoHotel = todos.filter(r => {
      const rn = nomeHotelFromRoom(r);
      return rn && hotelNomeAlvo && String(rn).toLowerCase().trim() === String(hotelNomeAlvo).toLowerCase().trim();
    });
  }catch(e){
    // fallback local
    quartosDoHotel = quartos.filter(r => {
      const rn = nomeHotelFromRoom(r);
      return rn && hotelNomeAlvo && String(rn).toLowerCase().trim() === String(hotelNomeAlvo).toLowerCase().trim();
    });
  }

  if(quartosDoHotel.length === 0){
    detalhesDiv.innerHTML = '<div class="muted">Nenhum quarto disponível neste hotel.</div>';
    detalhesDiv.dataset.loaded = 'true';
    detalhesDiv.style.display = 'block';
    return;
  }

  // construir HTML de quartos
  let quartosHTML = `<h4 style="margin:0 0 8px 0">Quartos:</h4>`;
  quartosDoHotel.forEach(q => {
    const rid = idQuartoDe(q);
    const rnome = tipoQuartoDe(q);
    const rpreco = formatarMoeda(precoQuartoDe(q));
    const rdesc = q.descricao ?? q.description ?? '';
    quartosHTML += `<div class="room-item" style="padding:10px;margin-bottom:8px;border-radius:8px">`;
    quartosHTML += `<div style="display:flex;justify-content:space-between;align-items:center"><strong>${escapeHtml(rnome)}</strong><span class="tag">${escapeHtml(rpreco)}</span></div>`;
    quartosHTML += `<div class="muted small">ID: ${escapeHtml(String(rid))}</div>`;
    quartosHTML += `<div class="small" style="margin-top:6px">${escapeHtml(rdesc)}</div>`;
    quartosHTML += `</div>`;
  });

  detalhesDiv.innerHTML = quartosHTML;
  detalhesDiv.dataset.loaded = 'true';
  detalhesDiv.style.display = 'block';

  // não há botões nos cards de quarto aqui (remoção por solicitação)
}



function renderizarQuartos(){
  const container = document.getElementById('roomsList');
  container.innerHTML = '';
  if(quartos.length === 0){ container.innerHTML = '<div class="muted">Nenhum quarto encontrado.</div>'; return }
  quartos.forEach(r => {
    const id = idQuartoDe(r);
    const name = tipoQuartoDe(r);
    const price = precoQuartoDe(r);
    const desc = r.descricao ?? r.description ?? '';
    const hotelId = idHotelDoQuarto(r);
    const hotel = hoteis.find(h=>String(idHotelDe(h)) === String(hotelId));
    const hotelName = hotel ? nomeHotelDe(hotel) : (r.hotelNome ?? r.nomeHotel ?? '—');
    const el = document.createElement('div'); el.className='room-item';
    el.innerHTML = `<div style="display:flex;justify-content:space-between;align-items:center"><strong>${escapeHtml(name)}</strong><span class="tag">${escapeHtml(formatarMoeda(price))}</span></div><div class="meta muted small">ID: ${escapeHtml(String(id))} • ${escapeHtml(hotelName)}</div><div class="small" style="margin-top:8px">${escapeHtml(desc)}</div>`;
    // botão removido: não exibir mais o botão "Ver hotel deste quarto" nos cards
    container.appendChild(el);
  });
}

function popularSelectsHoteis(){
  const sel = document.getElementById('hotelSelect');
  const sel2 = document.getElementById('roomHotelSelect');
  sel.innerHTML = '';
  sel2.innerHTML = '';
  if(hoteis.length === 0){
    sel.innerHTML = '<option value="">(nenhum hotel)</option>';
    sel2.innerHTML = '<option value="">(nenhum hotel)</option>';
    return;
  }

  hoteis.forEach(h => {
    const id = idHotelDe(h);
    const name = nomeHotelDe(h);
    const opt = document.createElement('option');
    opt.value = id ?? name;
    opt.textContent = name;
    sel.appendChild(opt);

    const opt2 = opt.cloneNode(true);
    sel2.appendChild(opt2);
  });
}

function popularSelectQuartos(){
  const sel = document.getElementById('roomSelect');
  sel.innerHTML = '';
  if(quartos.length === 0){ sel.innerHTML = '<option value="">(nenhum quarto)</option>'; return }
  quartos.forEach(r => {
    const id = idQuartoDe(r);
    const name = tipoQuartoDe(r);
    const hotelId = idHotelDoQuarto(r);
    const hotel = hoteis.find(h=>String(idHotelDe(h)) === String(hotelId));
    const hotelName = hotel ? nomeHotelDe(hotel) : (r.hotelNome ?? r.nomeHotel ?? '—');
    const opt = document.createElement('option');
    opt.value = id ?? name;
    opt.textContent = `${name} — ${hotelName} — ${formatarMoeda(precoQuartoDe(r))}`;
    sel.appendChild(opt);
  });
}

// Funções para buscar recursos por id
async function obterHotelPorId(id){
  try{
    return await buscarJson(API_HOTEIS_ID(id));
  }catch(e){
    console.warn('Não foi possível obter hotel por id via API, retornando null', id, e);
    return null;
  }
}

async function obterQuartoPorId(id){
  try{
    return await buscarJson(API_QUARTOS_ID(id));
  }catch(e){
    console.warn('Não foi possível obter quarto por id via API, retornando null', id, e);
    return null;
  }
}

// Mostra detalhes do hotel associado a um quarto (usa API para obter hotel via id do quarto)
async function mostrarHotelDoQuarto(quartoId){
  const detalheId = `detalhes-hotel-do-quarto-${quartoId}`;
  const container = document.getElementById(detalheId);
  if(!container) return;
  if(container.style.display === 'block'){
    container.style.display = 'none';
    return;
  }

  // obter quarto (tenta pela API primeiro, fallback para array local)
  let quarto = null;
  // só tenta obter via API se o id for numérico; isso evita 404s ao buscar por nomes
  const isNumeric = (/^[0-9]+$/.test(String(quartoId)));
  if(isNumeric){
    try{ quarto = await obterQuartoPorId(quartoId); }catch(e){}
  }
  if(!quarto){ quarto = quartos.find(q => String(idQuartoDe(q)) === String(quartoId)); }
  if(!quarto){ container.innerHTML = '<div class="muted">Quarto não encontrado.</div>'; container.style.display='block'; return; }

  // tentar obter hotel usando hotelId quando disponível, caso contrário usar nome do hotel presente no quarto
  let hotel = null;
  const hotelId = idHotelDoQuarto(quarto);
  if(hotelId){
    try{ hotel = await obterHotelPorId(hotelId); }catch(e){}
    if(!hotel) hotel = hoteis.find(h => String(idHotelDe(h)) === String(hotelId));
  }
  // se ainda não encontrou, tenta localizar pelo nome do hotel presente no objeto do quarto
  if(!hotel){
    const rn = nomeHotelFromRoom(quarto);
    hotel = encontrarHotelPorNome(rn);
  }
  if(!hotel){ container.innerHTML = '<div class="muted">Hotel não encontrado.</div>'; container.style.display='block'; return; }

  // renderizar informações do hotel dentro do card do quarto
  container.innerHTML = `
    <div style="padding:10px;border-radius:8px;border:1px solid rgba(255,255,255,0.03);background:rgba(255,255,255,0.01)">
      <strong>${escapeHtml(nomeHotelDe(hotel))}</strong>
      <div class="muted small">ID: ${escapeHtml(String(idHotelDe(hotel)))} ${escapeHtml(hotel.cidade ?? hotel.city ?? '')}</div>
      <div class="small" style="margin-top:6px">${escapeHtml(hotel.descricao ?? hotel.description ?? '')}</div>
    </div>`;
  container.style.display = 'block';
}

// Escapar para evitar XSS em conteúdo vindo da API
function escapeHtml(s){
  if(s === null || s === undefined) return '';
  return String(s).replace(/[&<>"']/g, function(c){
    return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]);
  });
}

// Eventos de formulários
document.getElementById('hotelForm').addEventListener('submit', async (e)=>{
  e.preventDefault();
  const nome = document.getElementById('hotelName').value.trim();
  const cidade = document.getElementById('hotelCity').value.trim();
  const localizacao = document.getElementById('hotelLocation').value.trim();
  const qtdEstrelas = document.getElementById('hotelStars').value.trim();
  const descricao = document.getElementById('hotelDesc').value.trim();
  if(!nome) return alert('Informe o nome do hotel');
  if(!cidade) return alert('Informe a cidade do hotel');
  if(!qtdEstrelas) return alert('Informe a quantidade de estrelas');
  try{
    await postarHotel({nome, cidade, localizacao, qtdEstrelas, descricao});
    alert('Hotel adicionado com sucesso');
    document.getElementById('hotelForm').reset();
    await obterHoteis();
  }catch(err){
    alert('Erro ao adicionar hotel: '+ err.message);
  }
});

document.getElementById('roomForm').addEventListener('submit', async (e)=>{
  e.preventDefault();
  const tipo = document.getElementById('roomType').value.trim();
  const descricao = document.getElementById('roomDesc').value.trim();
  const precoStr = document.getElementById('roomPrice').value.trim();
  const preco = precoStr ? parseFloat(precoStr.replace(',', '.')) : null;
  const hotelValue = document.getElementById('roomHotelSelect').value;
  if(!tipo) return alert('Informe o tipo do quarto');
  if(preco === null || isNaN(preco)) return alert('Informe o preço do quarto');
  if(!hotelValue) return alert('Selecione um hotel');
  let hotelId = hotelValue;
  if(!/^[0-9]+$/.test(String(hotelValue))){
    const found = hoteis.find(h => nomeHotelDe(h) === hotelValue);
    hotelId = found ? idHotelDe(found) : hotelValue;
  }
  try{
    await postarQuarto({tipo, nome: tipo, descricao, preco, hotelId});
    alert('Quarto adicionado com sucesso');
    document.getElementById('roomForm').reset();
    await obterQuartos();
  }catch(err){
    alert('Erro ao adicionar quarto: '+ err.message);
  }
});

document.getElementById('refreshHotels').addEventListener('click', ()=>obterHoteis());
document.getElementById('refreshRooms').addEventListener('click', ()=>obterQuartos());

// init
(async function init(){
  try{
    await Promise.all([obterHoteis(), obterQuartos()]);
  }catch(err){
    console.error('Erro ao inicializar: ', err);
    const footer = document.querySelector('footer');
    const m = document.createElement('div');
    m.style.color='var(--danger)';
    m.textContent = 'Erro ao conectar com a API. Verifique se o backend está rodando em http://localhost:5145 e habilitou CORS.';
    footer.appendChild(m);
  }
})();