(() => {
  'use strict';

  const STORAGE_KEY = 'bda-v4-clan-history';
  const COLLECTION = 'arenaData';
  const DOCUMENT_ID = 'clan-history';
  const ADMIN_EMAILS = new Set([
    'claboleirosdeatitude@gmail.com',
    'miniamikaren@gmail.com'
  ]);

  const DEFAULT_HISTORY = {
    dataset: 'clan-history',
    title: 'Nossa História',
    subtitle: 'Boleiros de Atitude',
    headline: 'Uma história construída dentro e fora dos gramados.',
    foundedAt: '2024-12-21',
    story: 'O Clã BDA, Boleiros de Atitude, foi fundado em 21 de dezembro de 2024. Este espaço foi criado para registrar a trajetória do clã, seus membros, campeonatos, conquistas e momentos inesquecíveis.\n\nA história continuará crescendo a cada competição, amizade e novo capítulo escrito pelos integrantes da família BDA.',
    quote: 'Mais que campeonatos, construímos uma história juntos.',
    values: ['União', 'Respeito', 'Competitividade', 'Amizade'],
    timeline: [
      {
        id: 'fundacao-bda',
        date: '21/12/2024',
        title: 'Fundação do Clã BDA',
        text: 'Nasce o Boleiros de Atitude, reunindo membros apaixonados por futebol, competição e amizade.'
      },
      {
        id: 'arena-bda',
        date: 'Arena BDA',
        title: 'A memória ganha uma casa',
        text: 'Os campeonatos, clubes, campeões e momentos do clã passam a ser preservados em uma plataforma própria.'
      }
    ],
    cover: ''
  };

  let history = loadLocal();
  let currentUser = null;
  let db = null;
  let unsubscribe = null;
  let editing = false;
  let saving = false;
  let pendingCover = null;
  let structureTimer = 0;

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const esc = value => String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
  const isAdmin = () => Boolean(currentUser && ADMIN_EMAILS.has(String(currentUser.email || '').toLowerCase()));
  const notify = message => typeof toast === 'function' ? toast(message) : console.info(message);

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function sanitize(input = {}) {
    const value = { ...clone(DEFAULT_HISTORY), ...input };
    value.dataset = 'clan-history';
    value.title = String(value.title || DEFAULT_HISTORY.title).slice(0, 70);
    value.subtitle = String(value.subtitle || DEFAULT_HISTORY.subtitle).slice(0, 90);
    value.headline = String(value.headline || '').slice(0, 180);
    value.foundedAt = /^\d{4}-\d{2}-\d{2}$/.test(String(value.foundedAt || '')) ? value.foundedAt : DEFAULT_HISTORY.foundedAt;
    value.story = String(value.story || '').slice(0, 15000);
    value.quote = String(value.quote || '').slice(0, 260);
    value.cover = typeof value.cover === 'string' ? value.cover : '';
    value.values = (Array.isArray(value.values) ? value.values : [])
      .map(item => String(item || '').trim().slice(0, 45))
      .filter(Boolean)
      .slice(0, 12);
    value.timeline = (Array.isArray(value.timeline) ? value.timeline : [])
      .map((item, index) => ({
        id: String(item?.id || `history-${Date.now().toString(36)}-${index}`),
        date: String(item?.date || '').trim().slice(0, 40),
        title: String(item?.title || '').trim().slice(0, 100),
        text: String(item?.text || '').trim().slice(0, 500)
      }))
      .filter(item => item.date || item.title || item.text)
      .slice(0, 40);
    return value;
  }

  function loadLocal() {
    try {
      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY));
      return sanitize(stored || DEFAULT_HISTORY);
    } catch {
      return sanitize(DEFAULT_HISTORY);
    }
  }

  function saveLocal(value) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
    } catch (error) {
      console.error(error);
      notify('Não foi possível salvar a história neste navegador');
    }
  }

  function formatFoundation(value) {
    const parts = String(value || '').split('-').map(Number);
    if (parts.length !== 3 || parts.some(Number.isNaN)) return '21 de dezembro de 2024';
    return new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' })
      .format(new Date(parts[0], parts[1] - 1, parts[2]));
  }

  function foundationYear() {
    return String(history.foundedAt || '').slice(0, 4) || '2024';
  }

  function paragraphs(text) {
    const blocks = String(text || '').trim().split(/\n{2,}/).filter(Boolean);
    if (!blocks.length) return '<p>A história do Clã BDA será escrita aqui.</p>';
    return blocks.map(block => `<p>${esc(block).replace(/\n/g, '<br>')}</p>`).join('');
  }

  function timelineHtml() {
    if (!history.timeline.length) {
      return '<div class="history-empty"><b>A linha do tempo está pronta</b><span>O administrador pode adicionar os principais momentos do clã.</span></div>';
    }

    return `<div class="history-timeline">${history.timeline.map((event, index) => `
      <article>
        <span class="history-timeline-dot">${index + 1}</span>
        <div class="history-timeline-date">${esc(event.date || 'Data a registrar')}</div>
        <div class="history-timeline-copy"><h3>${esc(event.title || 'Novo capítulo')}</h3><p>${esc(event.text || '')}</p></div>
      </article>`).join('')}</div>`;
  }

  function valuesHtml() {
    if (!history.values.length) return '';
    const icons = ['🤝', '🛡️', '🔥', '⚽', '🏆', '🦅'];
    return `<div class="history-values">${history.values.map((value, index) => `
      <article><span>${icons[index % icons.length]}</span><b>${esc(value)}</b></article>`).join('')}</div>`;
  }

  function publicHtml() {
    return `<div id="historyCapture">
      <section class="history-hero ${history.cover ? 'has-cover' : ''}">
        ${history.cover ? `<img src="${esc(history.cover)}" alt="Imagem da história do Clã BDA">` : ''}
        <div class="history-hero-overlay"></div>
        <div class="history-hero-copy">
          <span class="eyebrow">Memória oficial • Clã BDA</span>
          <h1>${esc(history.title)}</h1>
          <p>${esc(history.headline)}</p>
          <div class="history-hero-actions">
            ${isAdmin() ? '<button class="primary" type="button" data-edit-history>Editar história</button>' : ''}
            <button class="ghost" type="button" data-photo-history>📸 Foto da história</button>
          </div>
        </div>
        <aside><span>Fundado em</span><b>${esc(foundationYear())}</b><small>${esc(formatFoundation(history.foundedAt))}</small></aside>
      </section>

      <section class="history-intro">
        <div class="history-emblem"><img src="${$('link[rel~="icon"]')?.href || './favicon.svg'}" alt="Escudo da Arena BDA"></div>
        <div><span class="eyebrow">${esc(history.subtitle)}</span><h2>Onde cada membro deixa sua marca</h2><div class="history-story">${paragraphs(history.story)}</div></div>
      </section>

      ${history.values.length ? `<section><div class="section-head"><div><span class="eyebrow">Nossa identidade</span><h2>Valores que nos movem</h2><p>Os princípios que sustentam a caminhada do Boleiros de Atitude.</p></div></div>${valuesHtml()}</section>` : ''}

      <section><div class="section-head"><div><span class="eyebrow">Capítulo por capítulo</span><h2>Linha do tempo</h2><p>Momentos que ajudaram a construir o Clã BDA.</p></div></div>${timelineHtml()}</section>

      ${history.quote ? `<blockquote class="history-quote"><span>“</span><p>${esc(history.quote)}</p><footer>Clã BDA • Boleiros de Atitude</footer></blockquote>` : ''}
    </div>`;
  }

  function editorEventHtml(event = {}) {
    const id = event.id || `history-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
    return `<article class="history-event-editor" data-history-event="${esc(id)}">
      <header><b>Momento da história</b><button type="button" class="danger" data-remove-history-event>Remover</button></header>
      <div class="form-grid two">
        <label>Data ou período<input data-history-field="date" maxlength="40" value="${esc(event.date || '')}" placeholder="Ex.: 21/12/2024"></label>
        <label>Título<input data-history-field="title" maxlength="100" value="${esc(event.title || '')}" placeholder="Ex.: Fundação do clã"></label>
      </div>
      <label>Descrição<textarea data-history-field="text" maxlength="500" placeholder="Conte o que aconteceu neste momento.">${esc(event.text || '')}</textarea></label>
    </article>`;
  }

  function editorHtml() {
    return `<section class="history-editor-card">
      <header><div><span class="eyebrow">Área administrativa</span><h2>Editor da história</h2><p>Registre a origem, os valores e os momentos importantes do clã.</p></div><button class="ghost" type="button" data-cancel-history>Fechar editor</button></header>
      <form id="historyEditorForm">
        <div class="form-grid two">
          <label>Título principal<input id="historyTitle" maxlength="70" required value="${esc(history.title)}"></label>
          <label>Nome ou subtítulo<input id="historySubtitle" maxlength="90" value="${esc(history.subtitle)}"></label>
          <label>Data de fundação<input id="historyFoundedAt" type="date" value="${esc(history.foundedAt)}"></label>
          <label>Frase de abertura<input id="historyHeadline" maxlength="180" value="${esc(history.headline)}"></label>
        </div>
        <label>História completa<textarea id="historyStory" maxlength="15000" rows="12" placeholder="Escreva a história do Clã BDA...">${esc(history.story)}</textarea></label>
        <div class="form-grid two">
          <label>Frase de destaque<textarea id="historyQuote" maxlength="260" rows="4">${esc(history.quote)}</textarea></label>
          <label>Valores do clã<textarea id="historyValues" rows="4" placeholder="Um valor por linha">${esc(history.values.join('\n'))}</textarea></label>
        </div>
        <label>Imagem de capa<input id="historyCoverInput" type="file" accept="image/png,image/jpeg,image/webp"><small>Imagens horizontais ficam melhores. O arquivo será reduzido automaticamente.</small></label>
        <div class="history-cover-preview" id="historyCoverPreview"></div>
        <div class="history-editor-heading"><div><span class="eyebrow">Linha do tempo</span><h3>Momentos importantes</h3></div><button class="ghost" type="button" data-add-history-event>+ Adicionar momento</button></div>
        <div id="historyEventsEditor">${history.timeline.map(editorEventHtml).join('')}</div>
        <footer class="history-editor-actions"><button class="secondary" type="button" data-cancel-history>Cancelar</button><button class="primary" type="submit">Salvar história</button></footer>
      </form>
    </section>`;
  }

  function ensureStructure() {
    const main = $('main');
    if (!main) return;

    let page = $('[data-page="history"]');
    if (!page) {
      page = document.createElement('section');
      page.className = 'page';
      page.dataset.page = 'history';
      main.append(page);
    }

    const nav = $('.bottom-nav');
    if (nav && !$('[data-go="history"]', nav)) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'nav-btn';
      button.dataset.go = 'history';
      button.innerHTML = '<i>📜</i><span>História</span>';
      button.addEventListener('click', () => {
        if (typeof navigate === 'function') navigate('history');
        else {
          $$('.page').forEach(item => item.classList.toggle('active', item.dataset.page === 'history'));
          $$('.nav-btn').forEach(item => item.classList.toggle('active', item.dataset.go === 'history'));
        }
        render();
      });
      const tournamentButton = $('[data-go="tournament"]', nav);
      tournamentButton ? nav.insertBefore(button, tournamentButton) : nav.append(button);
    }

    const home = $('[data-page="home"]');
    const homeGrid = $('.home-grid', home);
    if (homeGrid && !$('#clanHistoryHome')) {
      const section = document.createElement('section');
      section.id = 'clanHistoryHome';
      section.className = 'history-home-card';
      section.innerHTML = `<div><span class="eyebrow">Desde ${esc(foundationYear())}</span><h2>A história por trás do Clã BDA</h2><p>Conheça a origem, os valores e os capítulos que transformaram o Boleiros de Atitude em uma grande família competitiva.</p><button class="primary" type="button" data-open-history>Conhecer nossa história</button></div><aside><img src="${$('link[rel~="icon"]')?.href || './favicon.svg'}" alt="Escudo BDA"><span>Memória oficial</span></aside>`;
      homeGrid.before(section);
    }
  }

  function coverPreview() {
    const root = $('#historyCoverPreview');
    if (!root) return;
    const cover = pendingCover === null ? history.cover : pendingCover;
    root.innerHTML = cover
      ? `<div><img src="${esc(cover)}" alt="Prévia da capa"></div><button type="button" class="danger" data-remove-history-cover>Remover imagem</button>`
      : '<div class="history-cover-empty">Nenhuma imagem de capa selecionada.</div>';
  }

  function bind() {
    $('[data-edit-history]')?.addEventListener('click', () => {
      if (!isAdmin()) return;
      editing = true;
      pendingCover = null;
      render();
    });

    $$('[data-cancel-history]').forEach(button => button.addEventListener('click', () => {
      editing = false;
      pendingCover = null;
      render();
    }));

    $('[data-photo-history]')?.addEventListener('click', () => {
      const target = $('#historyCapture');
      if (window.ArenaBDACapture?.element && target) {
        window.ArenaBDACapture.element(target, 'História do Clã BDA', 'historia-do-cla-bda');
      } else {
        notify('A ferramenta de imagem ainda está carregando');
      }
    });

    $('[data-add-history-event]')?.addEventListener('click', () => {
      $('#historyEventsEditor')?.insertAdjacentHTML('beforeend', editorEventHtml());
      const events = $$('.history-event-editor');
      events[events.length - 1]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });

    $$('[data-remove-history-event]').forEach(button => button.addEventListener('click', () => {
      button.closest('[data-history-event]')?.remove();
    }));

    $('#historyCoverInput')?.addEventListener('change', async event => {
      const file = event.target.files?.[0];
      if (!file) return;
      try {
        notify('Preparando a imagem...');
        pendingCover = await prepareImage(file);
        coverPreview();
        notify('Imagem preparada');
      } catch (error) {
        console.error(error);
        event.target.value = '';
        notify(error.message || 'Não foi possível processar a imagem');
      }
    });

    $('[data-remove-history-cover]')?.addEventListener('click', () => {
      pendingCover = '';
      coverPreview();
    });

    $('#historyEditorForm')?.addEventListener('submit', saveHistory);
    coverPreview();
  }

  function render() {
    ensureStructure();
    const page = $('[data-page="history"]');
    if (!page) return;
    if (editing && !isAdmin()) editing = false;
    page.innerHTML = editing ? editorHtml() : publicHtml();
    bind();
  }

  function fileData(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error('Falha ao ler a imagem'));
      reader.readAsDataURL(file);
    });
  }

  function loadImage(source) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error('Imagem inválida'));
      image.src = source;
    });
  }

  async function prepareImage(file) {
    if (!file.type.startsWith('image/')) throw new Error('Escolha uma imagem válida');
    if (file.size > 8 * 1024 * 1024) throw new Error('A imagem deve ter no máximo 8 MB');
    const source = await fileData(file);
    const image = await loadImage(source);
    const maxWidth = 1200;
    const scale = Math.min(1, maxWidth / image.width);
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(image.width * scale));
    canvas.height = Math.max(1, Math.round(image.height * scale));
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Falha ao preparar a imagem');
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/webp', 0.78);
  }

  function collectTimeline() {
    return $$('#historyEventsEditor [data-history-event]').map((card, index) => ({
      id: card.dataset.historyEvent || `history-${Date.now().toString(36)}-${index}`,
      date: $('[data-history-field="date"]', card)?.value.trim() || '',
      title: $('[data-history-field="title"]', card)?.value.trim() || '',
      text: $('[data-history-field="text"]', card)?.value.trim() || ''
    })).filter(item => item.date || item.title || item.text);
  }

  async function saveHistory(event) {
    event.preventDefault();
    if (!isAdmin() || saving) return;

    const next = sanitize({
      ...history,
      title: $('#historyTitle')?.value.trim(),
      subtitle: $('#historySubtitle')?.value.trim(),
      headline: $('#historyHeadline')?.value.trim(),
      foundedAt: $('#historyFoundedAt')?.value,
      story: $('#historyStory')?.value.trim(),
      quote: $('#historyQuote')?.value.trim(),
      values: ($('#historyValues')?.value || '').split(/\n|,/).map(value => value.trim()).filter(Boolean),
      timeline: collectTimeline(),
      cover: pendingCover === null ? history.cover : pendingCover
    });

    saving = true;
    const submit = $('#historyEditorForm button[type="submit"]');
    if (submit) {
      submit.disabled = true;
      submit.textContent = 'Salvando...';
    }

    try {
      history = next;
      saveLocal(history);

      if (db) {
        await db.collection(COLLECTION).doc(DOCUMENT_ID).set({
          ...history,
          updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
          updatedBy: String(currentUser.email || '').toLowerCase()
        });
      }

      editing = false;
      pendingCover = null;
      render();
      notify('História do Clã BDA atualizada');
    } catch (error) {
      console.error(error);
      notify(String(error?.code || '').includes('permission-denied')
        ? 'Publique as regras atualizadas do Firestore'
        : 'A história foi salva localmente, mas a nuvem falhou');
    } finally {
      saving = false;
      if (submit) {
        submit.disabled = false;
        submit.textContent = 'Salvar história';
      }
    }
  }

  document.addEventListener('click', event => {
    if (event.target.closest('[data-open-history]')) {
      if (typeof navigate === 'function') navigate('history');
      render();
    }
  });

  const style = document.createElement('style');
  style.textContent = `
    .history-hero{position:relative;overflow:hidden;display:grid;grid-template-columns:1.35fr .65fr;align-items:end;gap:18px;min-height:360px;padding:28px;border:1px solid var(--line-strong);border-radius:30px;background:radial-gradient(circle at 85% 10%,rgba(242,215,125,.34),transparent 28%),linear-gradient(135deg,#17432b,#07130d 62%,#030806);box-shadow:var(--shadow)}
    .history-hero>img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}.history-hero-overlay{position:absolute;inset:0;background:linear-gradient(90deg,rgba(3,8,6,.96),rgba(3,8,6,.76) 52%,rgba(3,8,6,.28)),linear-gradient(0deg,rgba(3,8,6,.85),transparent 65%)}.history-hero:not(.has-cover):after{content:"BDA";position:absolute;right:-18px;bottom:-54px;color:#fff1;font:900 190px/1 "Barlow Condensed",sans-serif}
    .history-hero-copy,.history-hero aside{position:relative;z-index:2}.history-hero h1{margin:8px 0;font-size:clamp(48px,10vw,86px);line-height:.86;text-transform:uppercase}.history-hero-copy>p{max-width:680px;margin:0;color:#d3ded6;font-size:12px;line-height:1.55}.history-hero-actions{display:flex;flex-wrap:wrap;gap:8px;margin-top:18px}.history-hero aside{padding:17px;border:1px solid rgba(242,215,125,.42);border-radius:20px;background:rgba(3,8,6,.76);backdrop-filter:blur(12px)}.history-hero aside span,.history-hero aside b,.history-hero aside small{display:block}.history-hero aside span{color:var(--gold-soft);font-size:8px;font-weight:900;letter-spacing:.14em;text-transform:uppercase}.history-hero aside b{margin:5px 0;color:var(--gold-soft);font:900 58px/1 "Barlow Condensed",sans-serif}.history-hero aside small{color:var(--muted);font-size:9px;text-transform:capitalize}
    .history-intro{display:grid;grid-template-columns:190px 1fr;gap:24px;align-items:start;margin:18px 0;padding:22px;border:1px solid var(--line);border-radius:24px;background:linear-gradient(150deg,var(--surface-2),var(--surface))}.history-emblem{overflow:hidden;aspect-ratio:1;border:1px solid rgba(242,215,125,.45);border-radius:28px;background:#020503;box-shadow:0 20px 45px rgba(0,0,0,.42)}.history-emblem img{display:block;width:100%;height:100%;object-fit:cover}.history-intro h2{margin:6px 0 13px;font-size:clamp(30px,6vw,48px);text-transform:uppercase}.history-story{display:grid;gap:12px}.history-story p{margin:0;color:#cfdbd3;font-size:11px;line-height:1.75}
    .history-values{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:9px}.history-values article{display:grid;place-items:center;min-height:115px;padding:13px;border:1px solid var(--line);border-radius:18px;background:linear-gradient(150deg,var(--surface-2),var(--surface));text-align:center}.history-values span{font-size:28px}.history-values b{margin-top:8px;color:var(--gold-soft);font-size:11px;text-transform:uppercase}
    .history-timeline{position:relative;display:grid;gap:10px}.history-timeline:before{content:"";position:absolute;left:25px;top:25px;bottom:25px;width:2px;background:linear-gradient(var(--gold-soft),var(--green))}.history-timeline article{position:relative;display:grid;grid-template-columns:52px 130px 1fr;gap:13px;align-items:start;padding:14px;border:1px solid var(--line);border-radius:18px;background:linear-gradient(150deg,var(--surface-2),var(--surface))}.history-timeline-dot{position:relative;z-index:1;display:grid;place-items:center;width:38px;height:38px;margin:1px auto;border:3px solid #07100c;border-radius:50%;color:#171107;background:linear-gradient(145deg,var(--gold-soft),var(--gold));font-size:9px;font-weight:900}.history-timeline-date{padding-top:9px;color:var(--gold-soft);font-size:9px;font-weight:900;text-transform:uppercase}.history-timeline-copy h3{margin:0;font-size:19px;text-transform:uppercase}.history-timeline-copy p{margin:7px 0 0;color:var(--muted);font-size:9px;line-height:1.55}
    .history-quote{position:relative;overflow:hidden;margin:20px 0 0;padding:28px;border:1px solid rgba(242,215,125,.37);border-radius:25px;background:radial-gradient(circle at 90% 0,rgba(242,215,125,.19),transparent 35%),linear-gradient(145deg,#12301f,#050c08);text-align:center}.history-quote>span{position:absolute;left:20px;top:-24px;color:#f2d77d25;font:900 140px Georgia,serif}.history-quote p{position:relative;max-width:760px;margin:0 auto;color:var(--gold-soft);font:800 clamp(24px,5vw,39px)/1.15 "Barlow Condensed",sans-serif}.history-quote footer{position:relative;margin-top:13px;color:var(--muted);font-size:8px;font-weight:900;text-transform:uppercase}
    .history-home-card{position:relative;overflow:hidden;display:grid;grid-template-columns:1fr 180px;gap:18px;align-items:center;margin:14px 0;padding:22px;border:1px solid rgba(242,215,125,.32);border-radius:24px;background:radial-gradient(circle at 90% 10%,rgba(242,215,125,.2),transparent 31%),linear-gradient(145deg,#133422,#050c08)}.history-home-card:after{content:"HISTÓRIA";position:absolute;right:-12px;bottom:-28px;color:#fff1;font:900 82px/1 "Barlow Condensed",sans-serif}.history-home-card>div,.history-home-card aside{position:relative;z-index:1}.history-home-card h2{margin:5px 0;font-size:31px;text-transform:uppercase}.history-home-card p{max-width:650px;margin:0;color:var(--muted);font-size:10px;line-height:1.55}.history-home-card button{margin-top:12px}.history-home-card aside{display:grid;justify-items:center;gap:7px}.history-home-card aside img{width:100px;height:100px;border:2px solid rgba(242,215,125,.45);border-radius:25px;object-fit:cover;box-shadow:0 14px 35px rgba(0,0,0,.42)}.history-home-card aside span{color:var(--gold-soft);font-size:8px;font-weight:900;text-transform:uppercase}
    .history-editor-card{padding:20px;border:1px solid var(--line-strong);border-radius:25px;background:radial-gradient(circle at 0 0,rgba(216,178,72,.13),transparent 28%),linear-gradient(145deg,#112a1c,#050c08)}.history-editor-card>header{display:flex;justify-content:space-between;align-items:end;gap:14px;padding-bottom:15px;border-bottom:1px solid var(--line)}.history-editor-card h2{margin:5px 0;font-size:34px;text-transform:uppercase}.history-editor-card>header p{margin:0;color:var(--muted);font-size:9px}.history-editor-card form{display:grid;gap:13px;margin-top:15px}.history-editor-card textarea{min-height:95px;resize:vertical}.history-cover-preview{display:flex;align-items:center;gap:10px;padding:9px;border:1px solid var(--line);border-radius:16px;background:#03080670}.history-cover-preview>div:not(.history-cover-empty){overflow:hidden;flex:1;aspect-ratio:16/5;border-radius:12px}.history-cover-preview img{width:100%;height:100%;object-fit:cover}.history-cover-empty{display:grid;place-items:center;min-height:80px;flex:1;color:var(--muted);font-size:9px}.history-editor-heading{display:flex;align-items:end;justify-content:space-between;gap:10px;margin-top:5px}.history-editor-heading h3{margin:4px 0 0;color:var(--gold-soft);font-size:25px;text-transform:uppercase}#historyEventsEditor{display:grid;gap:9px}.history-event-editor{padding:13px;border:1px solid var(--line);border-radius:17px;background:linear-gradient(150deg,var(--surface-2),var(--surface))}.history-event-editor>header{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:10px}.history-event-editor>header b{font-size:9px;text-transform:uppercase}.history-event-editor>header button{min-height:32px;padding:0 9px;font-size:8px}.history-editor-actions{display:flex;justify-content:flex-end;gap:8px;padding-top:14px;border-top:1px solid var(--line)}.history-empty{display:grid;place-items:center;gap:5px;min-height:150px;padding:22px;border:1px dashed var(--line-strong);border-radius:18px;color:var(--muted);text-align:center}.history-empty b{color:var(--text)}.history-empty span{font-size:9px}
    @media(max-width:800px){.history-hero,.history-intro,.history-home-card{grid-template-columns:1fr}.history-hero{min-height:420px}.history-hero aside{max-width:230px}.history-emblem{width:150px}.history-values{grid-template-columns:repeat(2,1fr)}.history-home-card aside{display:none}.history-timeline article{grid-template-columns:45px 1fr}.history-timeline-date{grid-column:2}.history-timeline-copy{grid-column:2}.history-timeline:before{left:22px}.history-editor-card>header,.history-editor-heading{display:grid}.history-editor-actions{display:grid}.history-editor-actions button{width:100%}}
    @media(max-width:480px){.history-hero{padding:20px}.history-values{grid-template-columns:1fr}.history-intro{padding:16px}.history-home-card{padding:17px}.history-editor-card{padding:14px}}
  `;
  document.head.append(style);

  ensureStructure();
  render();

  if (window.firebase && typeof firebase.firestore === 'function' && typeof firebase.auth === 'function') {
    db = firebase.firestore();
    firebase.auth().onAuthStateChanged(user => {
      currentUser = user;
      render();
    });

    unsubscribe = db.collection(COLLECTION).doc(DOCUMENT_ID).onSnapshot(snapshot => {
      if (!snapshot.exists) return;
      history = sanitize(snapshot.data());
      saveLocal(history);
      if (!editing) render();
    }, error => console.error('Falha ao carregar a história do clã', error));
  }

  const observer = new MutationObserver(() => {
    clearTimeout(structureTimer);
    structureTimer = setTimeout(ensureStructure, 100);
  });
  observer.observe(document.body, { childList: true, subtree: true });
})();
