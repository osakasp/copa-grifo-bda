(() => {
  'use strict';

  const KEY = 'bda-v4-news';
  const PREFIX = 'news-';
  const CATEGORIES = ['Campeonatos', 'Resultados', 'Clubes', 'Comunidade', 'Avisos'];
  const auth = window.ArenaBDAAuth;
  const seed = [{
    id: 'central-noticias-arena-bda',
    title: 'Arena BDA ganha uma central de notícias',
    summary: 'Comunicados, resultados e novidades do clã agora têm um espaço próprio.',
    content: 'A nova Central de Notícias reúne as informações importantes da Arena BDA em um só lugar.\n\nA administração poderá publicar resultados, anúncios de campeonatos, novidades dos clubes e comunicados para toda a comunidade.',
    category: 'Comunidade',
    image: '',
    featured: true,
    published: true,
    author: 'Admin BDA',
    createdAt: Date.now(),
    publishedAt: Date.now(),
    cloud: false,
    pending: false
  }];

  let news = load();
  let category = 'Todas';
  let editingId = '';
  let db = null;
  let busy = false;
  let deepLink = new URLSearchParams(location.search).get('news') || '';

  const $ = (selector, root = document) => root.querySelector(selector);
  const escapeHtml = value => String(value ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  const notify = message => typeof toast === 'function' ? toast(message) : console.info(message);
  const clone = value => JSON.parse(JSON.stringify(value));

  function load() {
    try {
      const value = JSON.parse(localStorage.getItem(KEY) || 'null');
      return Array.isArray(value) ? value : clone(seed);
    } catch {
      return clone(seed);
    }
  }

  function saveLocal() {
    localStorage.setItem(KEY, JSON.stringify(news));
  }

  function isAdmin() {
    if (auth?.isAdmin) return auth.isAdmin();
    const user = window.firebase?.auth?.()?.currentUser;
    const email = String(user?.email || '').toLowerCase();
    return Boolean(user && (window.ARENA_ADMIN_EMAILS || []).includes(email));
  }

  function currentEmail() {
    if (auth?.currentEmail) return auth.currentEmail();
    return String(window.firebase?.auth?.()?.currentUser?.email || '').toLowerCase();
  }

  function timeOf(item) {
    return Number(item.publishedAt || item.createdAt || 0);
  }

  function sorted(list = news) {
    return [...list].sort((a, b) => Number(Boolean(b.featured)) - Number(Boolean(a.featured)) || timeOf(b) - timeOf(a));
  }

  function visible() {
    const list = isAdmin() ? sorted() : sorted(news.filter(item => item.published !== false));
    return category === 'Todas' ? list : list.filter(item => item.category === category);
  }

  function dateText(value) {
    return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
      .format(new Date(Number(value) || Date.now()));
  }

  function readingTime(text) {
    const words = String(text || '').trim().split(/\s+/).filter(Boolean).length;
    return `${Math.max(1, Math.ceil(words / 180))} min`;
  }

  function cover(item) {
    return item.image ? ` style="background-image:linear-gradient(180deg,rgba(3,8,6,.08),rgba(3,8,6,.92)),url('${escapeHtml(item.image)}')"` : '';
  }

  function card(item, compact = false) {
    return `<article class="card news-card${compact ? ' compact' : ''}" data-news-open="${escapeHtml(item.id)}">
      <div class="news-cover"${cover(item)}>
        <span class="news-category">${escapeHtml(item.category || 'Notícias')}</span>
        ${item.featured ? '<span class="news-featured">Destaque</span>' : ''}
        ${item.published === false ? '<span class="news-draft">Rascunho</span>' : ''}
        ${item.image ? '' : '<b class="news-mark">BDA</b>'}
      </div>
      <div class="news-body">
        <time>${dateText(item.publishedAt)}</time>
        <h3>${escapeHtml(item.title)}</h3>
        <p>${escapeHtml(item.summary)}</p>
        <div class="news-meta"><span>${escapeHtml(item.author || 'Admin BDA')}</span><span>${readingTime(item.content)}</span></div>
        ${isAdmin() && !compact ? `<div class="news-admin"><button data-news-edit="${escapeHtml(item.id)}">Editar</button><button class="danger" data-news-delete="${escapeHtml(item.id)}">Excluir</button></div>` : ''}
      </div>
    </article>`;
  }

  function build() {
    const main = $('.app-shell > main') || $('main');
    const nav = $('.bottom-nav');
    if (!main || !nav) return false;

    if (!$('[data-page="news"]')) {
      const page = document.createElement('section');
      page.className = 'page news-page';
      page.dataset.page = 'news';
      page.innerHTML = `<div class="news-page-head"><div><span class="eyebrow">Central de informação</span><h1>Notícias BDA</h1><p>Resultados, comunicados, campeonatos e histórias dos clubes.</p></div><button class="primary" id="newsCreateBtn" hidden>+ Publicar notícia</button></div><div id="newsLead"></div><div class="news-filters" id="newsFilters"></div><div class="news-grid" id="newsGrid"></div>`;
      main.append(page);
    }

    if (!nav.querySelector('[data-go="news"]')) {
      const button = document.createElement('button');
      button.className = 'nav-btn';
      button.dataset.go = 'news';
      button.innerHTML = '<i>📰</i><span>Notícias</span>';
      nav.append(button);
    }
    nav.classList.add('has-news');

    const home = $('[data-page="home"]');
    if (home && !$('#newsHome')) {
      const block = document.createElement('section');
      block.id = 'newsHome';
      block.className = 'news-home';
      block.innerHTML = '<div class="section-head"><div><h2>Últimas notícias</h2><p>O que está acontecendo na Arena BDA</p></div><button data-go="news">Ver todas</button></div><div class="news-home-track" id="newsHomeTrack"></div>';
      home.append(block);
    }

    ensureModals();
    return true;
  }

  function renderFilters() {
    $('#newsFilters').innerHTML = ['Todas', ...CATEGORIES].map(name => `<button class="${category === name ? 'active' : ''}" data-news-filter="${name}">${name}</button>`).join('');
  }

  function renderLead() {
    const list = isAdmin() ? sorted() : sorted(news.filter(item => item.published !== false));
    const item = list.find(entry => entry.featured) || list[0];
    $('#newsLead').innerHTML = item ? `<article class="news-lead" data-news-open="${escapeHtml(item.id)}"${cover(item)}><div><div class="news-labels"><span class="news-category">${escapeHtml(item.category)}</span>${item.published === false ? '<span class="news-draft">Rascunho</span>' : ''}</div><time>${dateText(item.publishedAt)}</time><h2>${escapeHtml(item.title)}</h2><p>${escapeHtml(item.summary)}</p><button class="primary" data-news-open="${escapeHtml(item.id)}">Ler notícia</button></div>${item.image ? '' : '<b class="news-lead-mark">BDA<small>NEWS</small></b>'}</article>` : '<div class="empty">A primeira notícia publicada aparecerá aqui.</div>';
  }

  function renderGrid() {
    const list = visible();
    $('#newsGrid').innerHTML = list.length ? list.map(item => card(item)).join('') : '<div class="empty news-empty">Nenhuma notícia nesta categoria.</div>';
  }

  function renderHome() {
    const list = sorted(news.filter(item => item.published !== false)).slice(0, 3);
    $('#newsHomeTrack').innerHTML = list.length ? list.map(item => card(item, true)).join('') : '<div class="empty">As notícias aparecerão aqui.</div>';
  }

  function render() {
    if (!build()) return;
    $('#newsCreateBtn').hidden = !isAdmin();
    renderFilters();
    renderLead();
    renderGrid();
    renderHome();
    window.ArenaBDAMotion?.refresh?.();
  }

  function ensureModals() {
    if (!$('#newsArticleModal')) {
      const modal = document.createElement('div');
      modal.id = 'newsArticleModal';
      modal.className = 'modal-backdrop';
      modal.innerHTML = '<article class="modal news-article" id="newsArticleContent"></article>';
      modal.addEventListener('click', event => { if (event.target === modal) closeArticle(); });
      document.body.append(modal);
    }

    if (!$('#newsEditorModal')) {
      const modal = document.createElement('div');
      modal.id = 'newsEditorModal';
      modal.className = 'modal-backdrop';
      modal.innerHTML = `<div class="modal news-editor"><div class="news-editor-head"><div><span class="eyebrow">Redação BDA</span><h2 id="newsEditorTitle">Publicar notícia</h2></div><button class="news-close" data-news-editor-close>×</button></div><form id="newsForm"><div class="news-form-grid"><label class="wide">Título<input name="title" maxlength="100" required></label><label class="wide">Resumo<textarea name="summary" maxlength="240" required></textarea></label><label>Categoria<select name="category">${CATEGORIES.map(name => `<option>${name}</option>`).join('')}</select></label><label>Data<input name="date" type="date"></label><label class="wide">Imagem de capa por URL<input name="image" type="url" placeholder="https://..."></label><label class="wide">Texto da notícia<textarea class="news-text" name="content" required></textarea></label><label class="news-check"><input name="published" type="checkbox" checked><span>Publicar para todos</span></label><label class="news-check"><input name="featured" type="checkbox"><span>Marcar como destaque</span></label></div><div class="news-editor-actions"><button type="button" class="secondary" data-news-editor-close>Cancelar</button><button class="primary" id="newsSaveBtn">Salvar notícia</button></div></form></div>`;
      modal.addEventListener('click', event => { if (event.target === modal) closeEditor(); });
      document.body.append(modal);
      $('#newsForm').addEventListener('submit', saveArticle);
    }
  }

  function paragraphs(text) {
    return String(text || '').split(/\n{2,}/).map(p => `<p>${escapeHtml(p).replace(/\n/g, '<br>')}</p>`).join('');
  }

  function openArticle(id) {
    const item = news.find(entry => String(entry.id) === String(id));
    if (!item || (!isAdmin() && item.published === false)) return;
    $('#newsArticleContent').innerHTML = `<button class="news-close" data-news-close>×</button>${item.image ? `<img src="${escapeHtml(item.image)}" alt="Capa de ${escapeHtml(item.title)}">` : ''}<div class="news-article-copy"><div class="news-article-top"><span class="news-category">${escapeHtml(item.category)}</span><time>${dateText(item.publishedAt)} • ${readingTime(item.content)}</time></div><h2>${escapeHtml(item.title)}</h2><p class="news-summary">${escapeHtml(item.summary)}</p><div class="news-author">Publicado por <strong>${escapeHtml(item.author || 'Admin BDA')}</strong></div><div class="news-article-text">${paragraphs(item.content)}</div><div class="news-article-actions"><button class="secondary" data-news-share="${escapeHtml(item.id)}">Compartilhar</button>${isAdmin() ? `<button class="ghost" data-news-edit="${escapeHtml(item.id)}">Editar notícia</button>` : ''}</div></div>`;
    $('#newsArticleModal').classList.add('show');
  }

  function closeArticle() { $('#newsArticleModal')?.classList.remove('show'); }

  function dateInput(value) {
    const date = new Date(Number(value) || Date.now());
    return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  }

  function openEditor(id = '') {
    if (!isAdmin()) return;
    closeArticle();
    const item = news.find(entry => String(entry.id) === String(id));
    editingId = item?.id || '';
    const form = $('#newsForm');
    form.reset();
    form.elements.title.value = item?.title || '';
    form.elements.summary.value = item?.summary || '';
    form.elements.category.value = item?.category || CATEGORIES[0];
    form.elements.date.value = dateInput(item?.publishedAt);
    form.elements.image.value = item?.image || '';
    form.elements.content.value = item?.content || '';
    form.elements.published.checked = item?.published !== false;
    form.elements.featured.checked = Boolean(item?.featured);
    $('#newsEditorTitle').textContent = item ? 'Editar notícia' : 'Publicar notícia';
    $('#newsEditorModal').classList.add('show');
    form.elements.title.focus();
  }

  function closeEditor() {
    $('#newsEditorModal')?.classList.remove('show');
    editingId = '';
  }

  function slug(title) {
    const base = String(title).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 45);
    return `${base || 'noticia'}-${Date.now().toString(36)}`;
  }

  function payload(item) {
    return {
      dataset: 'news', schemaVersion: 1, id: item.id, title: item.title,
      summary: item.summary, content: item.content, category: item.category,
      image: item.image, featured: item.featured, published: item.published,
      author: item.author, createdAt: item.createdAt, publishedAt: item.publishedAt,
      updatedAt: Date.now(), updatedBy: currentEmail(),
      serverUpdatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };
  }

  async function saveArticle(event) {
    event.preventDefault();
    if (busy || !isAdmin()) return;
    const form = event.currentTarget;
    const old = news.find(item => String(item.id) === String(editingId));
    const now = Date.now();
    const item = {
      id: old?.id || slug(form.elements.title.value),
      title: form.elements.title.value.trim(), summary: form.elements.summary.value.trim(),
      content: form.elements.content.value.trim(), category: form.elements.category.value,
      image: form.elements.image.value.trim(), featured: form.elements.featured.checked,
      published: form.elements.published.checked, author: old?.author || currentEmail() || 'Admin BDA',
      createdAt: old?.createdAt || now,
      publishedAt: form.elements.date.value ? new Date(`${form.elements.date.value}T12:00:00`).getTime() : now,
      cloud: false, pending: true
    };
    if (!item.title || !item.summary || !item.content) return;

    const index = news.findIndex(entry => entry.id === item.id);
    if (index >= 0) news[index] = item; else news.unshift(item);
    saveLocal(); render();

    busy = true;
    const button = $('#newsSaveBtn');
    button.disabled = true; button.textContent = 'Salvando...';
    try {
      if (!db) throw new Error('offline');
      await db.collection('arenaData').doc(`${PREFIX}${item.id}`).set(payload(item));
      const saved = news.find(entry => entry.id === item.id);
      if (saved) { saved.cloud = true; saved.pending = false; saveLocal(); }
      notify(item.published ? 'Notícia publicada' : 'Rascunho salvo');
    } catch (error) {
      console.error(error);
      notify('Notícia salva neste aparelho. A nuvem não respondeu');
    } finally {
      busy = false; button.disabled = false; button.textContent = 'Salvar notícia';
      closeEditor(); render();
    }
  }

  async function removeArticle(id) {
    if (!isAdmin()) return;
    const item = news.find(entry => String(entry.id) === String(id));
    if (!item || !confirm(`Excluir a notícia “${item.title}”?`)) return;
    news = news.filter(entry => String(entry.id) !== String(id));
    saveLocal(); render();
    try { if (db) await db.collection('arenaData').doc(`${PREFIX}${id}`).delete(); notify('Notícia excluída'); }
    catch (error) { console.error(error); notify('A nuvem não confirmou a exclusão'); }
  }

  async function shareArticle(id) {
    const item = news.find(entry => String(entry.id) === String(id));
    if (!item) return;
    const url = new URL(location.href); url.search = ''; url.searchParams.set('news', item.id);
    try {
      if (navigator.share) await navigator.share({ title: item.title, text: item.summary, url: url.toString() });
      else { await navigator.clipboard.writeText(url.toString()); notify('Link copiado'); }
    } catch (error) { if (error.name !== 'AbortError') notify('Não foi possível compartilhar'); }
  }

  function cloud() {
    if (!window.firebase || typeof firebase.firestore !== 'function') return;
    db = firebase.firestore();
    db.collection('arenaData').where('dataset', '==', 'news').onSnapshot(snapshot => {
      const remote = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.data().id || doc.id.replace(/^news-/, ''), cloud: true, pending: false }));
      const hadCloud = news.some(item => item.cloud);
      if (remote.length || hadCloud) {
        const pending = news.filter(item => item.pending && !item.cloud);
        const map = new Map(pending.map(item => [String(item.id), item]));
        remote.forEach(item => map.set(String(item.id), item));
        news = [...map.values()]; saveLocal(); render();
      }
      openDeepLink();
    }, error => { console.error(error); openDeepLink(); });
  }

  function openDeepLink() {
    if (!deepLink) return;
    const id = deepLink; deepLink = '';
    if (typeof navigate === 'function') navigate('news');
    setTimeout(() => openArticle(id), 100);
  }

  function events() {
    document.addEventListener('click', event => {
      const filter = event.target.closest('[data-news-filter]');
      if (filter) { category = filter.dataset.newsFilter; renderFilters(); renderGrid(); return; }
      const edit = event.target.closest('[data-news-edit]');
      if (edit) { event.preventDefault(); event.stopPropagation(); openEditor(edit.dataset.newsEdit); return; }
      const remove = event.target.closest('[data-news-delete]');
      if (remove) { event.preventDefault(); event.stopPropagation(); removeArticle(remove.dataset.newsDelete); return; }
      const share = event.target.closest('[data-news-share]');
      if (share) { event.preventDefault(); shareArticle(share.dataset.newsShare); return; }
      if (event.target.closest('[data-news-close]')) { closeArticle(); return; }
      if (event.target.closest('[data-news-editor-close]')) { closeEditor(); return; }
      const open = event.target.closest('[data-news-open]');
      if (open) { event.preventDefault(); openArticle(open.dataset.newsOpen); }
    });
    $('#newsCreateBtn')?.addEventListener('click', () => openEditor());
    document.addEventListener('keydown', event => {
      if (event.key !== 'Escape') return;
      if ($('#newsEditorModal')?.classList.contains('show')) closeEditor();
      else closeArticle();
    });
  }

  function styles() {
    if ($('#newsBdaStyles')) return;
    const style = document.createElement('style');
    style.id = 'newsBdaStyles';
    style.textContent = `
      .bottom-nav.has-news{grid-template-columns:repeat(6,minmax(0,1fr))}.news-page-head{display:flex;align-items:flex-end;justify-content:space-between;gap:16px;margin:4px 2px 18px}.news-page-head h1{margin:6px 0 4px;font-size:clamp(38px,8vw,62px)}.news-page-head p{margin:0;color:var(--muted);font-size:12px}
      .news-lead{position:relative;overflow:hidden;min-height:350px;display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:end;padding:28px;border:1px solid var(--line-strong);border-radius:28px;background:radial-gradient(circle at 82% 20%,rgba(242,215,125,.34),transparent 24%),linear-gradient(145deg,#183a26,#07100c);background-position:center;background-size:cover;box-shadow:var(--shadow);cursor:pointer}.news-lead:after{content:"";position:absolute;inset:0;background:linear-gradient(180deg,transparent 10%,rgba(3,8,6,.12) 38%,rgba(3,8,6,.92))}.news-lead>div,.news-lead-mark{position:relative;z-index:2}.news-lead>div{max-width:720px}.news-labels{display:flex;gap:7px}.news-lead time{display:block;margin-top:14px;color:#bdc9c0;font-size:10px}.news-lead h2{margin:8px 0 7px;font-size:clamp(34px,7vw,58px);line-height:.92;text-transform:uppercase}.news-lead p{max-width:650px;margin:0;color:#d4ddd7;font-size:12px;line-height:1.55}.news-lead button{margin-top:17px}.news-lead-mark{color:rgba(255,255,255,.13);font:900 76px/.7 "Barlow Condensed",sans-serif;text-align:center}.news-lead-mark small{display:block;font-size:23px;letter-spacing:.18em}
      .news-category,.news-featured,.news-draft{display:inline-flex;align-items:center;min-height:25px;padding:0 9px;border-radius:999px;font-size:7px;font-weight:900;letter-spacing:.09em;text-transform:uppercase}.news-category{color:#171107;background:linear-gradient(135deg,var(--gold-soft),var(--gold))}.news-featured{color:#a8f1c4;background:rgba(79,223,143,.13);border:1px solid rgba(79,223,143,.24)}.news-draft{color:#ffcf78;background:rgba(255,188,65,.13);border:1px solid rgba(255,188,65,.22)}
      .news-filters{display:flex;gap:7px;overflow-x:auto;margin:18px 0 12px;padding-bottom:4px;scrollbar-width:none}.news-filters button{flex:0 0 auto;min-height:36px;padding:0 12px;border:1px solid var(--line);border-radius:999px;color:var(--muted);background:rgba(255,255,255,.035);font-size:8px;font-weight:900;text-transform:uppercase}.news-filters button.active{color:#171107;border-color:var(--gold);background:linear-gradient(135deg,var(--gold-soft),var(--gold))}
      .news-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}.news-card{overflow:hidden;padding:0;cursor:pointer}.news-cover{position:relative;height:150px;padding:11px;display:flex;gap:7px;background:radial-gradient(circle at 76% 25%,rgba(242,215,125,.34),transparent 25%),linear-gradient(145deg,#173923,#07100c);background-position:center;background-size:cover}.news-mark{position:absolute;right:13px;bottom:5px;color:rgba(255,255,255,.13);font:900 58px "Barlow Condensed",sans-serif}.news-body{padding:14px}.news-body time{color:var(--muted);font-size:8px}.news-card h3{margin:7px 0 6px;font-size:23px;line-height:.98;text-transform:uppercase}.news-card p{display:-webkit-box;overflow:hidden;margin:0;color:#b9c7be;font-size:10px;line-height:1.5;-webkit-line-clamp:3;-webkit-box-orient:vertical}.news-meta{display:flex;justify-content:space-between;gap:8px;margin-top:13px;padding-top:10px;border-top:1px solid var(--line);color:var(--muted);font-size:8px}.news-admin{display:flex;gap:7px;margin-top:11px}.news-admin button{flex:1;min-height:35px;border:1px solid var(--line);border-radius:10px;color:var(--text);background:rgba(255,255,255,.045);font-size:8px;font-weight:900;text-transform:uppercase}.news-home{margin-top:25px}.news-home-track{display:grid;grid-auto-flow:column;grid-auto-columns:minmax(240px,32%);gap:11px;overflow-x:auto;padding:2px 2px 10px}.news-card.compact .news-cover{height:112px}.news-card.compact h3{font-size:20px}.news-card.compact p{display:none}.news-empty{grid-column:1/-1}
      #newsArticleModal,#newsEditorModal{z-index:92000;place-items:center}.news-article{position:relative;width:min(100%,820px);max-height:calc(100dvh - 24px);padding:0;overflow:auto}.news-close{width:43px;height:43px;padding:0;border:1px solid rgba(255,255,255,.16);border-radius:13px;color:#fff;background:rgba(3,8,6,.82);font-size:24px}.news-article>.news-close{position:absolute;right:13px;top:13px;z-index:3}.news-article>img{display:block;width:100%;aspect-ratio:16/9;object-fit:cover}.news-article-copy{padding:22px}.news-article-top{display:flex;justify-content:space-between;gap:10px}.news-article-top time{color:var(--muted);font-size:9px}.news-article h2{margin:13px 0 8px;font-size:clamp(34px,7vw,54px);line-height:.92;text-transform:uppercase}.news-summary{color:#d8e1db;font-size:14px;line-height:1.55}.news-author{padding:0 0 14px;border-bottom:1px solid var(--line);color:var(--muted);font-size:10px}.news-article-text p{margin:16px 0;color:#d8e1db;font-size:13px;line-height:1.75}.news-article-actions{display:flex;justify-content:flex-end;gap:8px;padding-top:15px;border-top:1px solid var(--line)}
      .news-editor{width:min(100%,760px);max-height:calc(100dvh - 24px);overflow:auto}.news-editor-head{display:flex;justify-content:space-between;gap:13px;margin-bottom:16px}.news-editor-head h2{margin:4px 0 0;font-size:34px;text-transform:uppercase}.news-form-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:11px}.news-form-grid .wide{grid-column:1/-1}.news-form-grid textarea{min-height:82px}.news-form-grid .news-text{min-height:210px}.news-check{display:flex;grid-template-columns:auto 1fr;align-items:center;gap:9px;min-height:45px;padding:10px;border:1px solid var(--line);border-radius:12px;background:rgba(255,255,255,.03)}.news-check input{width:20px;height:20px;margin:0}.news-check span{color:var(--text);font-size:10px;text-transform:none}.news-editor-actions{position:sticky;bottom:-20px;display:flex;justify-content:flex-end;gap:8px;margin:16px -20px -20px;padding:13px 20px calc(13px + env(safe-area-inset-bottom));border-top:1px solid var(--line);background:rgba(16,29,22,.96)}
      @media(max-width:820px){.news-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.news-home-track{grid-auto-columns:minmax(230px,60%)}}@media(max-width:560px){:root{--nav-h:82px}.bottom-nav.has-news{width:calc(100% - 12px);bottom:6px;padding:6px;grid-template-columns:repeat(6,minmax(45px,1fr))}.bottom-nav.has-news .nav-btn{font-size:7px}.bottom-nav.has-news .nav-btn i{font-size:18px}.news-page-head{display:grid;align-items:start}.news-page-head button{width:100%}.news-lead{min-height:330px;padding:20px;grid-template-columns:1fr}.news-lead-mark{display:none}.news-grid{grid-template-columns:1fr}.news-cover{height:170px}.news-home-track{grid-auto-columns:minmax(250px,84%)}.news-form-grid{grid-template-columns:1fr}.news-form-grid .wide{grid-column:auto}.news-article-top{display:grid}.news-article-actions,.news-editor-actions{display:grid}.news-article-actions button,.news-editor-actions button{width:100%}}@media(max-width:360px){.bottom-nav.has-news .nav-btn span{font-size:6px}.bottom-nav.has-news .nav-btn i{font-size:16px}}
    `;
    document.head.append(style);
  }

  function init() {
    styles();
    if (!build()) return;
    events(); render(); cloud();
    if (auth?.subscribe) auth.subscribe(render);
    else window.addEventListener('arena:permissions-updated', render);
    if (deepLink && !window.firebase?.firestore) openDeepLink();
    window.ArenaBDANews = Object.freeze({ render, open: openArticle, create: () => openEditor(), list: () => clone(news) });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();