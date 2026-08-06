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
  let pendingImage = '';
  let deepLink = new URLSearchParams(location.search).get('news') || '';
  let searchTerm = '';

  const $ = (selector, root = document) => root.querySelector(selector);
  const escapeHtml = value => String(value ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  const notify = message => typeof toast === 'function' ? toast(message) : console.info(message);
  function clone(value) { return JSON.parse(JSON.stringify(value)); }
  function normalize(value) {
    return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  }

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
    const filtered = category === 'Todas' ? list : list.filter(item => item.category === category);
    const query = normalize(searchTerm);
    if (!query) return filtered;
    return filtered.filter(item => normalize(`${item.title} ${item.summary} ${item.content} ${item.author} ${item.category}`).includes(query));
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
    const author = escapeHtml(item.author || 'Admin BDA');
    const initial = escapeHtml(String(item.author || 'BDA').trim().charAt(0).toUpperCase() || 'B');
    return `<article class="card news-card${compact ? ' compact' : ''}" data-news-open="${escapeHtml(item.id)}" tabindex="0" role="button" aria-label="Abrir notícia: ${escapeHtml(item.title)}">
      <div class="news-cover"${cover(item)}>
        <div class="news-cover-badges"><span class="news-category">${escapeHtml(item.category || 'Notícias')}</span>
        ${item.featured ? '<span class="news-featured">Destaque</span>' : ''}
        ${item.published === false ? '<span class="news-draft">Rascunho</span>' : ''}</div>
        ${item.image ? '' : '<b class="news-mark">BDA<small>NEWS</small></b>'}
      </div>
      <div class="news-body">
        <div class="news-kicker"><time>${dateText(item.publishedAt)}</time><span>${readingTime(item.content)} de leitura</span></div>
        <h3>${escapeHtml(item.title)}</h3>
        <p>${escapeHtml(item.summary)}</p>
        <div class="news-meta"><span class="news-byline"><i>${initial}</i><b>${author}</b></span><span class="news-card-arrow" aria-hidden="true">↗</span></div>
        ${isAdmin() && !compact ? `<div class="news-admin"><button data-news-edit="${escapeHtml(item.id)}">Editar</button><button class="danger" data-news-delete="${escapeHtml(item.id)}">Excluir</button></div>` : ''}
      </div>
    </article>`;
  }

  function build() {
    const main = $('.app-shell > main') || $('main');
    const nav = $('.bottom-nav');
    if (!main || !nav) return false;

    let page = $('[data-page="news"]');
    if (!page) {
      page = document.createElement('section');
      page.className = 'page news-page';
      page.dataset.page = 'news';
      main.append(page);
    }
    if (!$('#newsGrid', page)) {
      page.className = 'page news-page';
      page.innerHTML = `<section class="news-page-head"><div class="news-head-copy"><span class="eyebrow">Redação oficial do Clã BDA</span><h1>Central de notícias</h1><p>Resultados, decisões, bastidores e histórias que movimentam a Arena BDA.</p><div class="news-head-actions"><button class="primary" id="newsCreateBtn" hidden>+ Publicar notícia</button><span class="news-live"><i></i>Arquivo oficial atualizado</span></div></div><aside class="news-desk-stats" id="newsDeskStats"></aside></section><div id="newsLead"></div><section class="news-discovery"><header><div><span class="eyebrow">Acompanhe a Arena</span><h2>Últimas da BDA</h2></div><label class="news-search"><span>⌕</span><input id="newsSearch" type="search" placeholder="Buscar notícia, clube ou campeonato" autocomplete="off"></label></header><div class="news-filters" id="newsFilters"></div></section><div class="news-grid" id="newsGrid"></div>`;
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

  function renderStats() {
    const published = news.filter(item => item.published !== false);
    const categories = new Set(published.map(item => item.category).filter(Boolean));
    const latest = sorted(published)[0];
    const root = $('#newsDeskStats');
    if (!root) return;
    root.innerHTML = `<article><b>${published.length}</b><span>publicadas</span></article><article><b>${categories.size}</b><span>editorias</span></article><article><b>${latest ? dateText(latest.publishedAt).replace(/ de /g, ' ') : '—'}</b><span>última atualização</span></article>`;
  }

  function renderFilters() {
    $('#newsFilters').innerHTML = ['Todas', ...CATEGORIES].map(name => `<button class="${category === name ? 'active' : ''}" data-news-filter="${name}">${name}</button>`).join('');
  }

  function renderLead() {
    const list = isAdmin() ? sorted() : sorted(news.filter(item => item.published !== false));
    const item = list.find(entry => entry.featured) || list[0];
    $('#newsLead').innerHTML = item ? `<article class="news-lead ${item.image ? 'has-image' : 'no-image'}" data-news-open="${escapeHtml(item.id)}">
      <div class="news-lead-media"${cover(item)}>
        <div class="news-labels"><span class="news-category">${escapeHtml(item.category)}</span>${item.published === false ? '<span class="news-draft">Rascunho</span>' : ''}</div>
        ${item.image ? '' : '<b class="news-lead-mark">BDA<small>NEWS</small></b>'}
      </div>
      <div class="news-lead-copy">
        <span class="news-lead-kicker"><i></i>Notícia em destaque</span>
        <time>${dateText(item.publishedAt)} • ${readingTime(item.content)} de leitura</time>
        <h2>${escapeHtml(item.title)}</h2>
        <p>${escapeHtml(item.summary)}</p>
        <footer><span>Por <strong>${escapeHtml(item.author || 'Admin BDA')}</strong></span><button class="primary" data-news-open="${escapeHtml(item.id)}">Ler matéria <b>→</b></button></footer>
      </div>
    </article>` : '<div class="empty">A primeira notícia publicada aparecerá aqui.</div>';
  }

  function renderGrid() {
    const list = visible();
    const message = searchTerm
      ? `Nenhum resultado para “${escapeHtml(searchTerm)}”.`
      : 'Nenhuma notícia nesta categoria.';
    $('#newsGrid').innerHTML = list.length ? list.map(item => card(item)).join('') : `<div class="empty news-empty"><b>${message}</b><span>Tente outra categoria ou termo de busca.</span></div>`;
  }

  function renderHome() {
    const list = sorted(news.filter(item => item.published !== false)).slice(0, 3);
    $('#newsHomeTrack').innerHTML = list.length ? list.map(item => card(item, true)).join('') : '<div class="empty">As notícias aparecerão aqui.</div>';
  }

  function render() {
    if (!build()) return;
    $('#newsCreateBtn').hidden = !isAdmin();
    renderStats();
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
      modal.innerHTML = `<div class="modal news-editor"><div class="news-editor-head"><div><span class="eyebrow">Redação BDA</span><h2 id="newsEditorTitle">Publicar notícia</h2></div><button class="news-close" data-news-editor-close>×</button></div><form id="newsForm"><div class="news-form-grid"><label class="wide">Título<input name="title" maxlength="100" required></label><label class="wide">Resumo<textarea name="summary" maxlength="240" required></textarea></label><label>Categoria<select name="category">${CATEGORIES.map(name => `<option>${name}</option>`).join('')}</select></label><label>Data<input name="date" type="date"></label><section class="wide news-image-field"><span>Imagem de capa</span><div class="news-image-preview" id="newsImagePreview"><div><b>Nenhuma imagem</b><small>Escolha uma foto do celular</small></div></div><div class="news-image-actions"><label class="primary news-upload-button">Escolher imagem<input id="newsImageFile" type="file" accept="image/*"></label><button class="secondary" type="button" id="newsImageRemove">Remover</button></div><small id="newsImageStatus">JPG, PNG ou WebP. A imagem será otimizada automaticamente.</small><details class="news-image-url"><summary>Usar endereço de imagem</summary><input name="imageUrl" type="url" placeholder="https://..."></details></section><label class="wide">Texto da notícia<textarea class="news-text" name="content" required></textarea></label><label class="news-check"><input name="published" type="checkbox" checked><span>Publicar para todos</span></label><label class="news-check"><input name="featured" type="checkbox"><span>Marcar como destaque</span></label></div><div class="news-editor-actions"><button type="button" class="secondary" data-news-editor-close>Cancelar</button><button class="primary" id="newsSaveBtn">Salvar notícia</button></div></form></div>`;
      modal.addEventListener('click', event => { if (event.target === modal) closeEditor(); });
      document.body.append(modal);
      $('#newsForm').addEventListener('submit', saveArticle);
      $('#newsImageFile').addEventListener('change', handleImageUpload);
      $('#newsImageRemove').addEventListener('click', removePendingImage);
      $('#newsForm').elements.imageUrl.addEventListener('input', event => {
        if (!pendingImage) renderImagePreview(event.currentTarget.value.trim());
      });
    }
  }

  function imageBytes(dataUrl) {
    const encoded = String(dataUrl || '').split(',')[1] || '';
    return Math.ceil(encoded.length * 0.75);
  }

  function loadUploadImage(file) {
    return new Promise((resolve, reject) => {
      const source = URL.createObjectURL(file);
      const image = new Image();
      image.onload = () => { URL.revokeObjectURL(source); resolve(image); };
      image.onerror = () => { URL.revokeObjectURL(source); reject(new Error('Formato de imagem não suportado')); };
      image.src = source;
    });
  }

  async function optimizeUpload(file) {
    if (!file?.type?.startsWith('image/')) throw new Error('Escolha um arquivo de imagem');
    if (file.size > 12 * 1024 * 1024) throw new Error('A imagem original deve ter no máximo 12 MB');
    const image = await loadUploadImage(file);
    const scale = Math.min(1, 1280 / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    canvas.getContext('2d', { alpha: false }).drawImage(image, 0, 0, canvas.width, canvas.height);
    let output = '';
    for (const quality of [.82, .74, .66, .58, .5]) {
      output = canvas.toDataURL('image/webp', quality);
      if (imageBytes(output) <= 320 * 1024) break;
    }
    if (!output.startsWith('data:image/webp')) output = canvas.toDataURL('image/jpeg', .72);
    if (imageBytes(output) > 420 * 1024) throw new Error('A imagem continuou muito grande após a otimização');
    return output;
  }

  function renderImagePreview(source = '') {
    const preview = $('#newsImagePreview');
    if (!preview) return;
    preview.innerHTML = source
      ? `<img src="${escapeHtml(source)}" alt="Prévia da imagem de capa">`
      : '<div><b>Nenhuma imagem</b><small>Escolha uma foto do celular</small></div>';
    $('#newsImageRemove').disabled = !source;
  }

  async function handleImageUpload(event) {
    const file = event.currentTarget.files?.[0];
    if (!file) return;
    const status = $('#newsImageStatus');
    status.textContent = 'Otimizando imagem...';
    event.currentTarget.disabled = true;
    try {
      pendingImage = await optimizeUpload(file);
      $('#newsForm').elements.imageUrl.value = '';
      renderImagePreview(pendingImage);
      status.textContent = `Imagem pronta • ${Math.ceil(imageBytes(pendingImage) / 1024)} KB`;
    } catch (error) {
      pendingImage = '';
      event.currentTarget.value = '';
      renderImagePreview();
      status.textContent = error.message || 'Não foi possível processar a imagem';
      notify(status.textContent);
    } finally {
      event.currentTarget.disabled = false;
    }
  }

  function removePendingImage() {
    pendingImage = '';
    const form = $('#newsForm');
    form.elements.imageUrl.value = '';
    $('#newsImageFile').value = '';
    $('#newsImageStatus').textContent = 'JPG, PNG ou WebP. A imagem será otimizada automaticamente.';
    renderImagePreview();
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
    pendingImage = String(item?.image || '').startsWith('data:image/') ? item.image : '';
    form.elements.imageUrl.value = pendingImage ? '' : item?.image || '';
    $('#newsImageFile').value = '';
    $('#newsImageStatus').textContent = pendingImage ? `Imagem pronta • ${Math.ceil(imageBytes(pendingImage) / 1024)} KB` : 'JPG, PNG ou WebP. A imagem será otimizada automaticamente.';
    renderImagePreview(pendingImage || form.elements.imageUrl.value);
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
    pendingImage = '';
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
      image: pendingImage || form.elements.imageUrl.value.trim(), featured: form.elements.featured.checked,
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
    $('#newsSearch')?.addEventListener('input', event => {
      searchTerm = event.currentTarget.value;
      renderGrid();
    });
    document.addEventListener('keydown', event => {
      const card = event.target.closest?.('.news-card[data-news-open]');
      if (card && (event.key === 'Enter' || event.key === ' ')) {
        event.preventDefault();
        openArticle(card.dataset.newsOpen);
        return;
      }
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
      .bottom-nav.has-news{grid-template-columns:repeat(6,minmax(0,1fr))}
      .news-page{--news-blue:#7eb7ff;--news-ink:#07100c}.news-page-head{position:relative;overflow:hidden;display:grid;grid-template-columns:minmax(0,1.25fr) minmax(310px,.75fr);gap:20px;align-items:end;min-height:330px;margin:4px 0 18px;padding:clamp(24px,4vw,44px);border:1px solid rgba(126,183,255,.22);border-radius:30px;background:radial-gradient(circle at 78% 18%,rgba(126,183,255,.22),transparent 27%),radial-gradient(circle at 15% 100%,rgba(79,223,143,.13),transparent 31%),linear-gradient(140deg,#102d21 0%,#081711 52%,#07100c 100%);box-shadow:0 24px 70px rgba(0,0,0,.34)}
      .news-page-head:after{content:"BDA";position:absolute;right:-18px;top:-42px;color:rgba(255,255,255,.035);font:900 clamp(140px,20vw,260px)/1 "Barlow Condensed",sans-serif;letter-spacing:-.05em;pointer-events:none}.news-head-copy,.news-desk-stats{position:relative;z-index:1}.news-page-head h1{max-width:760px;margin:9px 0 10px;font-size:clamp(54px,8vw,92px);line-height:.82;letter-spacing:-.025em;text-transform:uppercase;text-wrap:balance}.news-page-head p{max-width:650px;margin:0;color:#cbd9d0;font-size:13px;line-height:1.6}.news-head-actions{display:flex;align-items:center;gap:13px;margin-top:21px}.news-live{display:inline-flex;align-items:center;gap:8px;color:#b8c8bd;font-size:8px;font-weight:850;letter-spacing:.08em;text-transform:uppercase}.news-live i{width:8px;height:8px;border-radius:50%;background:var(--green);box-shadow:0 0 0 5px rgba(79,223,143,.11)}
      .news-desk-stats{display:grid;gap:8px}.news-desk-stats article{display:grid;grid-template-columns:minmax(88px,auto) 1fr;align-items:center;gap:12px;min-height:78px;padding:13px 15px;border:1px solid rgba(255,255,255,.1);border-radius:17px;background:rgba(2,8,5,.34);backdrop-filter:blur(12px)}.news-desk-stats b{color:#f2f7f3;font:800 clamp(24px,3vw,38px)/1 "Barlow Condensed",sans-serif;text-transform:uppercase}.news-desk-stats span{color:#91a59a;font-size:8px;font-weight:800;letter-spacing:.09em;text-transform:uppercase}
      .news-lead{overflow:hidden;display:grid;grid-template-columns:minmax(0,1.08fr) minmax(330px,.92fr);min-height:440px;border:1px solid var(--line);border-radius:28px;background:linear-gradient(145deg,rgba(17,34,24,.98),rgba(5,12,8,.99));box-shadow:0 18px 55px rgba(0,0,0,.28)}.news-lead-media{position:relative;min-height:360px;padding:18px;background:radial-gradient(circle at 70% 25%,rgba(242,215,125,.28),transparent 27%),linear-gradient(145deg,#193b28,#08110c);background-position:center;background-size:cover}.news-lead-media:after{content:"";position:absolute;inset:0;background:linear-gradient(180deg,rgba(3,8,6,.04),rgba(3,8,6,.55))}.news-labels,.news-lead-mark{position:relative;z-index:1}.news-labels{display:flex;flex-wrap:wrap;gap:7px}.news-lead-mark{position:absolute;right:24px;bottom:14px;color:rgba(255,255,255,.14);font:900 clamp(72px,10vw,120px)/.7 "Barlow Condensed",sans-serif;text-align:center}.news-lead-mark small{display:block;font-size:.28em;letter-spacing:.22em}.news-lead-copy{display:grid;align-content:center;padding:clamp(24px,4vw,46px)}.news-lead-kicker{display:flex;align-items:center;gap:8px;color:var(--gold-soft);font-size:8px;font-weight:900;letter-spacing:.13em;text-transform:uppercase}.news-lead-kicker i{width:24px;height:2px;background:var(--gold)}.news-lead-copy time{display:block;margin-top:16px;color:var(--muted);font-size:9px}.news-lead h2{margin:10px 0 11px;font-size:clamp(39px,5vw,64px);line-height:.9;text-transform:uppercase;text-wrap:balance}.news-lead p{margin:0;color:#c7d4cc;font-size:12px;line-height:1.65}.news-lead footer{display:flex;align-items:center;justify-content:space-between;gap:13px;margin-top:24px;padding-top:16px;border-top:1px solid var(--line)}.news-lead footer>span{color:var(--muted);font-size:9px}.news-lead footer strong{color:var(--text)}.news-lead footer button b{margin-left:9px}
      .news-category,.news-featured,.news-draft{display:inline-flex;align-items:center;min-height:27px;padding:0 10px;border-radius:999px;font-size:7px;font-weight:900;letter-spacing:.09em;text-transform:uppercase}.news-category{color:#171107;background:linear-gradient(135deg,var(--gold-soft),var(--gold))}.news-featured{color:#b7f4cd;background:rgba(79,223,143,.14);border:1px solid rgba(79,223,143,.28)}.news-draft{color:#ffd482;background:rgba(255,188,65,.14);border:1px solid rgba(255,188,65,.25)}
      .news-discovery{margin:25px 0 12px}.news-discovery>header{display:flex;align-items:end;justify-content:space-between;gap:14px}.news-discovery h2{margin:5px 0 0;font-size:clamp(31px,4vw,45px);line-height:.95;text-transform:uppercase}.news-search{position:relative;display:block;width:min(350px,100%);font-size:0}.news-search>span{position:absolute;left:14px;top:50%;z-index:1;color:var(--muted);font-size:18px;transform:translateY(-50%)}.news-search input{height:47px;padding:0 14px 0 43px;border-color:rgba(126,183,255,.18);border-radius:15px;background:rgba(5,13,9,.82);font-size:9px;text-transform:none}
      .news-filters{display:flex;gap:7px;overflow-x:auto;margin:14px 0 0;padding-bottom:5px;scrollbar-width:none}.news-filters::-webkit-scrollbar{display:none}.news-filters button{flex:0 0 auto;min-height:38px;padding:0 13px;border:1px solid var(--line);border-radius:999px;color:var(--muted);background:rgba(255,255,255,.035);font-size:8px;font-weight:900;text-transform:uppercase;transition:.18s ease}.news-filters button:hover{color:var(--text);border-color:rgba(126,183,255,.32);transform:translateY(-1px)}.news-filters button.active{color:#08110c;border-color:var(--gold);background:linear-gradient(135deg,var(--gold-soft),var(--gold))}
      .news-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:13px}.news-card{overflow:hidden;display:grid;grid-template-rows:auto 1fr;min-height:100%;padding:0;cursor:pointer;transition:transform .2s ease,border-color .2s ease,box-shadow .2s ease}.news-card:hover,.news-card:focus-visible{transform:translateY(-5px);border-color:rgba(126,183,255,.32);box-shadow:0 19px 45px rgba(0,0,0,.31)}.news-card:focus-visible{outline:2px solid var(--gold-soft);outline-offset:3px}.news-cover{position:relative;overflow:hidden;height:178px;padding:12px;background:radial-gradient(circle at 76% 25%,rgba(242,215,125,.30),transparent 25%),linear-gradient(145deg,#173923,#07100c);background-position:center;background-size:cover}.news-cover:after{content:"";position:absolute;inset:0;background:linear-gradient(180deg,rgba(3,8,6,.02),rgba(3,8,6,.66))}.news-cover-badges,.news-mark{position:relative;z-index:1}.news-cover-badges{display:flex;flex-wrap:wrap;gap:6px}.news-mark{position:absolute;right:13px;bottom:10px;color:rgba(255,255,255,.16);font:900 55px/.72 "Barlow Condensed",sans-serif;text-align:center}.news-mark small{display:block;font-size:14px;letter-spacing:.18em}.news-body{display:flex;flex-direction:column;padding:16px}.news-kicker{display:flex;align-items:center;justify-content:space-between;gap:8px;color:var(--muted);font-size:7px;font-weight:800;text-transform:uppercase}.news-kicker span{color:#91b7df}.news-card h3{margin:9px 0 8px;font-size:26px;line-height:.94;text-transform:uppercase;text-wrap:balance}.news-card p{display:-webkit-box;overflow:hidden;margin:0;color:#b9c7be;font-size:10px;line-height:1.55;-webkit-line-clamp:3;-webkit-box-orient:vertical}.news-meta{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-top:auto;padding-top:15px;border-top:1px solid var(--line)}.news-byline{display:flex;align-items:center;gap:8px;min-width:0}.news-byline i{display:grid;place-items:center;width:28px;height:28px;border:1px solid rgba(126,183,255,.23);border-radius:50%;color:#bcd7f5;background:rgba(126,183,255,.08);font-style:normal;font-size:8px}.news-byline b{overflow:hidden;color:var(--muted);font-size:8px;text-overflow:ellipsis;white-space:nowrap}.news-card-arrow{display:grid;place-items:center;width:31px;height:31px;border:1px solid var(--line);border-radius:10px;color:var(--gold-soft);background:rgba(255,255,255,.03);font-size:13px}.news-admin{display:flex;gap:7px;margin-top:11px}.news-admin button{flex:1;min-height:35px;border:1px solid var(--line);border-radius:10px;color:var(--text);background:rgba(255,255,255,.045);font-size:8px;font-weight:900;text-transform:uppercase}.news-home{margin-top:27px}.news-home-track{display:grid;grid-auto-flow:column;grid-auto-columns:minmax(250px,32%);gap:11px;overflow-x:auto;padding:3px 2px 11px}.news-card.compact .news-cover{height:126px}.news-card.compact h3{font-size:21px}.news-card.compact p{display:none}.news-empty{grid-column:1/-1}.news-empty b,.news-empty span{display:block}.news-empty span{margin-top:7px;font-size:9px}
      #newsArticleModal,#newsEditorModal{z-index:92000;place-items:center}.news-article{position:relative;width:min(100%,860px);max-height:calc(100dvh - 24px);padding:0;overflow:auto;border-radius:26px}.news-close{width:43px;height:43px;padding:0;border:1px solid rgba(255,255,255,.16);border-radius:13px;color:#fff;background:rgba(3,8,6,.82);font-size:24px}.news-article>.news-close{position:absolute;right:13px;top:13px;z-index:3}.news-article>img{display:block;width:100%;aspect-ratio:16/8;object-fit:cover}.news-article-copy{max-width:760px;margin:0 auto;padding:clamp(22px,4vw,44px)}.news-article-top{display:flex;justify-content:space-between;gap:10px}.news-article-top time{color:var(--muted);font-size:9px}.news-article h2{margin:15px 0 11px;font-size:clamp(42px,7vw,68px);line-height:.88;text-transform:uppercase;text-wrap:balance}.news-summary{color:#d8e1db;font-size:15px;line-height:1.65}.news-author{padding:3px 0 17px;border-bottom:1px solid var(--line);color:var(--muted);font-size:10px}.news-article-text{max-width:700px}.news-article-text p{margin:20px 0;color:#d8e1db;font-size:14px;line-height:1.82}.news-article-actions{display:flex;justify-content:flex-end;gap:8px;padding-top:18px;border-top:1px solid var(--line)}
      .news-editor{width:min(100%,760px);max-height:calc(100dvh - 24px);overflow:auto}.news-editor-head{display:flex;justify-content:space-between;gap:13px;margin-bottom:16px}.news-editor-head h2{margin:4px 0 0;font-size:34px;text-transform:uppercase}.news-form-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:11px}.news-form-grid .wide{grid-column:1/-1}.news-form-grid textarea{min-height:82px}.news-form-grid .news-text{min-height:210px}.news-image-field{display:grid;gap:9px;padding:12px;border:1px solid var(--line);border-radius:16px;background:rgba(255,255,255,.025)}.news-image-field>span{color:var(--muted);font-size:9px;font-weight:900;letter-spacing:.08em;text-transform:uppercase}.news-image-preview{overflow:hidden;display:grid;place-items:center;aspect-ratio:16/8;border:1px dashed var(--line-strong);border-radius:13px;background:#020704}.news-image-preview img{display:block;width:100%;height:100%;object-fit:cover}.news-image-preview div{text-align:center}.news-image-preview b,.news-image-preview small{display:block}.news-image-preview b{font-size:11px}.news-image-preview small,.news-image-field>small{margin-top:4px;color:var(--muted);font-size:8px;text-transform:none;letter-spacing:0}.news-image-actions{display:grid;grid-template-columns:1fr auto;gap:8px}.news-upload-button{display:grid;place-items:center;min-height:44px;cursor:pointer}.news-upload-button input{position:absolute;width:1px;height:1px;overflow:hidden;opacity:0}.news-image-actions button{min-height:44px}.news-image-actions button:disabled{opacity:.4}.news-image-url summary{padding:8px 0;color:var(--gold-soft);cursor:pointer;font-size:8px;font-weight:900;text-transform:uppercase}.news-image-url input{margin-top:5px}.news-check{display:flex;grid-template-columns:auto 1fr;align-items:center;gap:9px;min-height:45px;padding:10px;border:1px solid var(--line);border-radius:12px;background:rgba(255,255,255,.03)}.news-check input{width:20px;height:20px;margin:0}.news-check span{color:var(--text);font-size:10px;text-transform:none}.news-editor-actions{position:sticky;bottom:-20px;display:flex;justify-content:flex-end;gap:8px;margin:16px -20px -20px;padding:13px 20px calc(13px + env(safe-area-inset-bottom));border-top:1px solid var(--line);background:rgba(16,29,22,.96)}
      @media(max-width:900px){.news-page-head{grid-template-columns:1fr}.news-desk-stats{grid-template-columns:repeat(3,minmax(0,1fr))}.news-desk-stats article{grid-template-columns:1fr;gap:4px}.news-lead{grid-template-columns:1fr}.news-lead-media{min-height:330px}.news-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.news-home-track{grid-auto-columns:minmax(230px,60%)}}
      @media(max-width:600px){:root{--nav-h:82px}.bottom-nav.has-news{width:calc(100% - 12px);bottom:6px;padding:6px;grid-template-columns:repeat(6,minmax(45px,1fr))}.bottom-nav.has-news .nav-btn{font-size:7px}.bottom-nav.has-news .nav-btn i{font-size:18px}.news-page-head{min-height:auto;padding:25px 19px;border-radius:24px}.news-page-head h1{font-size:58px}.news-head-actions{align-items:stretch;flex-direction:column}.news-head-actions button{width:100%}.news-desk-stats{grid-template-columns:1fr}.news-desk-stats article{grid-template-columns:92px 1fr;min-height:66px}.news-lead{border-radius:22px}.news-lead-media{min-height:235px}.news-lead-copy{padding:22px 18px}.news-lead h2{font-size:42px}.news-lead footer{align-items:stretch;flex-direction:column}.news-lead footer button{width:100%}.news-discovery>header{align-items:stretch;flex-direction:column}.news-search{width:100%}.news-grid{grid-template-columns:1fr}.news-cover{height:190px}.news-home-track{grid-auto-columns:minmax(255px,86%)}.news-form-grid{grid-template-columns:1fr}.news-form-grid .wide{grid-column:auto}.news-article-top{display:grid}.news-article-actions,.news-editor-actions{display:grid}.news-article-actions button,.news-editor-actions button{width:100%}}
      @media(max-width:360px){.bottom-nav.has-news .nav-btn span{font-size:6px}.bottom-nav.has-news .nav-btn i{font-size:16px}.news-page-head h1{font-size:49px}}
      @media(prefers-reduced-motion:reduce){.news-card,.news-filters button{transition:none}.news-card:hover,.news-card:focus-visible,.news-filters button:hover{transform:none}}
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
