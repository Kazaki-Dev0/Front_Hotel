const API_BASE = 'http://localhost:5145/api';

    // Estado local
    let hotels = [];
    let rooms = [];

    // Helpers para lidar com diferentes shapes de objeto (nome/id são comuns em PT/EN)
    function hotelIdOf(h){ return h.id ?? h.hotelId ?? h.idHotel ?? null }
    function hotelNameOf(h){ return h.nome ?? h.name ?? h.nomeHotel ?? 'Sem nome' }
    function roomIdOf(r){ return r.id ?? r.quartoId ?? r.roomId ?? null }
    function roomNameOf(r){
      // agora procuramos pelo TIPO do quarto (campo em pt/pt-camelcase/pt_snake/engl/obj)
      return r.tipo ?? r.tipoQuarto ?? r.tipo_quarto ?? r.roomType ?? r.room_type ?? r.type ?? r.nome ?? r.name ?? r.titulo ?? r.title ?? (r.numero ? `Quarto ${r.numero}` : null) ?? 'Sem tipo';
    }
    function roomPriceOf(r){
      return r.preco ?? r.preço ?? r.price ?? r.valor ?? r.valorDiaria ?? r.dailyPrice ?? r.valor_por_noite ?? null;
    }

    function formatCurrency(v){
      if(v === null || v === undefined || v === '') return '—';
      const n = Number(v);
      if(isNaN(n)) return String(v);
      try{ return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); }catch(e){ return 'R$ '+n.toFixed(2) }
    }
    function roomHotelIdOf(r){ return r.hotelId ?? r.idHotel ?? r.hoteisId ?? r.hotel?.id ?? null }

    async function fetchJson(url, opts){
      try{
        const res = await fetch(url, opts);
        if(!res.ok){
          const t = await res.text();
          throw new Error(`${res.status} - ${t}`);
        }
        // tenta parsear json, se houver body
        const txt = await res.text();
        return txt ? JSON.parse(txt) : null;
      }catch(err){
        console.error('Fetch error', url, err);
        throw err;
      }
    }

    async function getHotels(){
      const data = await fetchJson(`${API_BASE}/Hoteis`);
      hotels = Array.isArray(data) ? data : (data?.items ?? []);
      renderHotels();
      populateHotelSelects();
      return hotels;
    }

    async function postHotel(payload){
      // envia em formato esperado: usamos 'nome' preferencial e adicionamos cidade e qtdEstrelas
      const body = {
        nome: payload.nome,
        cidade: payload.cidade ?? payload.city,
        localizacao: payload.localizacao,
        qtdEstrelas: payload.qtdEstrelas ? parseInt(payload.qtdEstrelas,10) : undefined,
        descricao: payload.descricao
      };
      return await fetchJson(`${API_BASE}/Hoteis`, {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(body)});
    }

    async function getRooms(){
      const data = await fetchJson(`${API_BASE}/Quartos`);
      rooms = Array.isArray(data) ? data : (data?.items ?? []);
      renderRooms();
      populateRoomSelect();
      return rooms;
    }

    async function postRoom(payload){
      // payload: { tipo, descricao, preco, hotelId }
      // Envia 'tipo' (pt), 'preco' e também 'nome' para compatibilidade com backends variados.
      const body = {
        tipo: payload.tipo,
        nome: payload.nome ?? payload.tipo,
        descricao: payload.descricao,
        preco: payload.preco ?? payload.price,
        hotelId: payload.hotelId
      };
      return await fetchJson(`${API_BASE}/Quartos`, {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(body)});
    }

    // Rendering
    function renderHotels(){
      const container = document.getElementById('hotelsList');
      container.innerHTML = '';
      if(hotels.length === 0){ container.innerHTML = '<div class="muted">Nenhum hotel encontrado.</div>'; return }
      hotels.forEach(h => {
        const id = hotelIdOf(h);
        const name = hotelNameOf(h);
        const cidade = h.cidade ?? h.city ?? '';
        const loc = h.localizacao ?? h.location ?? '';
        const estrelas = h.qtdEstrelas ?? h.stars ?? h.estrelas ?? '';
        const desc = h.descricao ?? h.description ?? '';
        const el = document.createElement('div'); el.className='hotel-item';
        el.innerHTML = `<div style="display:flex;justify-content:space-between;align-items:center"><strong>${escapeHtml(name)}</strong><span class="tag">${escapeHtml(String(estrelas))} ★</span></div><div class="meta muted small">ID: ${escapeHtml(String(id))} ${cidade? '• '+escapeHtml(cidade):''} ${loc? '• '+escapeHtml(loc):''}</div><div class="small" style="margin-top:8px">${escapeHtml(desc)}</div>`;
        container.appendChild(el);
      });
    }

    function renderRooms(){
      const container = document.getElementById('roomsList');
      container.innerHTML = '';
      if(rooms.length === 0){ container.innerHTML = '<div class="muted">Nenhum quarto encontrado.</div>'; return }
      rooms.forEach(r => {
        const id = roomIdOf(r);
        const name = roomNameOf(r);
        const price = roomPriceOf(r);
        const desc = r.descricao ?? r.description ?? '';
        const hotelId = roomHotelIdOf(r);
        const hotel = hotels.find(h=>String(hotelIdOf(h)) === String(hotelId));
        const hotelName = hotel ? hotelNameOf(hotel) : (r.hotelNome ?? r.nomeHotel ?? '—');
        const el = document.createElement('div'); el.className='room-item';
        el.innerHTML = `<div style="display:flex;justify-content:space-between;align-items:center"><strong>${escapeHtml(name)}</strong><span class="tag">${escapeHtml(formatCurrency(price))}</span></div><div class="meta muted small">ID: ${escapeHtml(String(id))} • ${escapeHtml(hotelName)}</div><div class="small" style="margin-top:8px">${escapeHtml(desc)}</div>`;
        container.appendChild(el);
      });
    }

    function populateHotelSelects(){
      const sel = document.getElementById('hotelSelect');
      const sel2 = document.getElementById('roomHotelSelect');
      sel.innerHTML = '';
      sel2.innerHTML = '';
      if(hotels.length === 0){
        sel.innerHTML = '<option value="">(nenhum hotel)</option>';
        sel2.innerHTML = '<option value="">(nenhum hotel)</option>';
        return;
      }

      hotels.forEach(h => {
        const id = hotelIdOf(h);
        const name = hotelNameOf(h);
        const opt = document.createElement('option');
        // mostramos o nome no texto (não id) — valor guardamos como id para operações POST/PUT
        opt.value = id ?? name;
        opt.textContent = name;
        sel.appendChild(opt);

        const opt2 = opt.cloneNode(true);
        sel2.appendChild(opt2);
      });
    }

    function populateRoomSelect(){
      const sel = document.getElementById('roomSelect');
      sel.innerHTML = '';
      if(rooms.length === 0){ sel.innerHTML = '<option value="">(nenhum quarto)</option>'; return }
      rooms.forEach(r => {
        const id = roomIdOf(r);
        const name = roomNameOf(r);
        const hotelId = roomHotelIdOf(r);
        const hotel = hotels.find(h=>String(hotelIdOf(h)) === String(hotelId));
        const hotelName = hotel ? hotelNameOf(hotel) : (r.hotelNome ?? r.nomeHotel ?? '—');
        const opt = document.createElement('option');
        opt.value = id ?? name;
        opt.textContent = `${name} — ${hotelName} — ${formatCurrency(roomPriceOf(r))}`; // mostra tipo do quarto, hotel e preço
        sel.appendChild(opt);
      });
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
        await postHotel({nome, cidade, localizacao, qtdEstrelas, descricao});
        alert('Hotel adicionado com sucesso');
        document.getElementById('hotelForm').reset();
        await getHotels();
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
      // hotelValue pode ser id ou nome (se o id não estiver disponível). Encontramos o id se possível
      let hotelId = hotelValue;
      // se valor for um nome, procuramos pelo hotel com aquele nome
      if(!/^[0-9]+$/.test(String(hotelValue))){
        const found = hotels.find(h => hotelNameOf(h) === hotelValue);
        hotelId = found ? hotelIdOf(found) : hotelValue;
      }
      try{
        // enviamos tipo, preco e também nome (fallback)
        await postRoom({tipo, nome: tipo, descricao, preco, hotelId});
        alert('Quarto adicionado com sucesso');
        document.getElementById('roomForm').reset();
        await getRooms();
      }catch(err){
        alert('Erro ao adicionar quarto: '+ err.message);
      }
    });

    document.getElementById('refreshHotels').addEventListener('click', ()=>getHotels());
    document.getElementById('refreshRooms').addEventListener('click', ()=>getRooms());

    // init
    (async function init(){
      try{
        await Promise.all([getHotels(), getRooms()]);
      }catch(err){
        console.error('Erro ao inicializar: ', err);
        const footer = document.querySelector('footer');
        const m = document.createElement('div');
        m.style.color='var(--danger)';
        m.textContent = 'Erro ao conectar com a API. Verifique se o backend está rodando em http://localhost:5145 e habilitou CORS.';
        footer.appendChild(m);
      }
    })();