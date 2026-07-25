(() => {
  'use strict';

  const LOCAL_KEY = 'bda-v4-history-gallery';
  const COLLECTION = 'arenaData';
  const DATASET = 'clan-gallery';
  const DOC_PREFIX = 'clan-gallery-';
  const MAX_ITEMS = 60;
  const ADMIN_EMAILS = new Set([
    'claboleirosdeatitude@gmail.com',
    'miniamikaren@gmail.com'
  ]);
  const CATEGORIES = {
    foto: { label: 'Foto antiga', icon: '📷' },
    campeao: { label: 'Banner de campeão', icon: '🏆' },
    homenagem: { label: 'Homenagem', icon: '🕊️' },
    momento: { label: 'Momento marcante', icon: '🔥' }
  };

  let items = loadLocal();
  let currentUser = null;
  let db = null;
  let unsubscribe = null;
  let categoryFilter = 'todos';
  let yearFilter = 'todos';
  let editingId = '';
  let pendingImage = null;
  let saving = false;
  let structureTimer = 0;

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const esc = value => String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
  const norm = value => String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
  const isAdmin = () => Boolean(currentUser && ADMIN_EMAILS.has(String(currentUser.email || '').toLowerCase()));
  const notify = message => typeof toast === 'function' ? toast(message) : console.info(message);

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function id() {
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  }

  function validCategory(value) {
    return CATEGORIES[value] ? value : 'momento';
  }

  function yearFrom(item) {
    const dateYear = String(item?.date || '').match(/^(\d{4})/i)?.[1];
    const explicit = String(item?.year || '').match(/\d{4}/)?.[0];
    return dateYear || explicit || 'Sem data';
  }

  function sanitize(item = {}) {
    const clean = {
      id: String(item.id || id()).slice(0, 80),
      dataset: DATASET,
      category: validCategory(item.category),
      title: String(item.title || 'Memória do Clã BDA').trim().slice(0, 120),
      caption: String(item.caption || '').trim().slice(0, 900),
      date: /^\d{4}-\d{2}-\d{2}$/.test(String(item.date || '')) ? String(item.date) : '',
      year: String(item.year || '').match(/\d{4}/)?.[0] || '',
      author: String(item.author || '').trim().slice(0, 90),
      image: typeof item.image === 'string' ? item.image : '',
      featured: Boolean(item.featured),
      sourceChampionKey: String(item.sourceChampionKey || '').slice(0, 180),
      createdAtMs: Number(item.createdAtMs) || Date.now(),
      updatedAtMs: Number(item.updatedAtMs) || Date.now()
    };
    clean.year = yearFrom(clean) === 'Sem data' ? '' : yearFrom(clean);
    return clean;
  }

  function loadLocal() {
    try {
      const stored = JSON.parse(localStorage.getItem(LOCAL_KEY));
      return Array.isArray(stored) ? stored.map(sanitize).slice(0, MAX_ITEMS) : [];
    } catch {
      return [];
    }
  }

  function saveLocal() {
    try {
      localStorage.setItem(LOCAL_KEY, JSON.stringify(items.slice(0, MAX_ITEMS)));
    } catch (error) {
      console.error(error);
      notify('A galeria ficou grande demais para este navegador');
    }
  }

  function sortItems(list) {
    return [...list].sort((a, b) => {
      const yearA = yearFrom(a) === 'Sem data' ? 0 : Number(yearFrom(a));
      const yearB = yearFrom(b) === 'Sem data' ? 0 : Number(yearFrom(b));
      return Number(b.featured) - Number(a.featured)
        || yearB - yearA
        || String(b.date || '').localeCompare(String(a.date || ''))
        || b.createdAtMs - a.createdAtMs;
    });
  }

  function filteredItems() {
    return sortItems(items).filter(item => {
      const categoryOk = categoryFilter === 'todos' || item.category === categoryFilter;
      const yearOk = yearFilter === 'todos' || yearFrom(item) === yearFilter;
      return categoryOk && yearOk;
    });
  }

  function availableYears() {
    return [...new Set(items.map(yearFrom))].sort((a, b) => {
      if (a === 'Sem data') return 1;
      if (b === 'Sem data') return -1;
      return Number(b) - Number(a);
    });
  }

  function formatDate(value) {
    if (!value) return 'Data não registrada';
    const [year, month, day] = value.split('-').map(Number);
    if (!year || !month || !day) return value;
    return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })
      .format(new Date(year, month - 1, day));
  }

  function categoryOptions(selected = 'momento') {
    return Object.entries(CATEGORIES).map(([value, meta]) =>
      `<option value="${value}" ${selected === value ? 'selected' : ''}>${meta.icon} ${meta.label}</option>`
    ).join('');
  }

  function filterHtml() {
    const categories = [
      ['todos', 'Todos'],
      ...Object.entries(CATEGORIES).map(([key, meta]) => [key, `${meta.icon} ${meta.label}`])
    ];
    const years = availableYears();
    return `<div class="history-gallery-toolbar">
      <div class="history-gallery-filters">
        ${categories.map(([value, label]) => `<button type="button" data-gallery-category="${value}" class="${categoryFilter === value ? 'active' : ''}">${label}</button>`).join('')}
      </div>
      <select id="historyGalleryYear" aria-label="Filtrar galeria por ano">
        <option value="todos">Todos os anos</option>
        ${years.map(year => `<option value="${esc(year)}" ${yearFilter === year ? 'selected' : ''}>${esc(year)}</option>`).join('')}
      </select>
    </div>`;
  }

  function cardHtml(item) {
    const meta = CATEGORIES[item.category];
    return `<article class="history-gallery-card ${item.featured ? 'featured' : ''}" data-gallery-card="${esc(item.id)}">
      <button class="history-gallery-media" type="button" data-open-gallery="${esc(item.id)}" aria-label="Ampliar ${esc(item.title)}">
        <img src="${esc(item.image)}" alt="${esc(item.title)}" loading="lazy">
        <span>${meta.icon} ${esc(meta.label)}</span>
        ${item.featured ? '<em>DESTAQUE</em>' : ''}
      </button>
      <div class="history-gallery-copy">
        <small>${esc(formatDate(item.date))}${item.author ? ` • ${esc(item.author)}` : ''}</small>
        <h3>${esc(item.title)}</h3>
        ${item.caption ? `<p>${esc(item.caption)}</p>` : ''}
        <footer>
          <button class="ghost" type="button" data-open-gallery="${esc(item.id)}">Ampliar</button>
          <button class="ghost" type="button" data-share-gallery="${esc(item.id)}">Compartilhar</button>
          ${isAdmin() ? `<button class="secondary" type="button" data-edit-gallery="${esc(item.id)}">Editar</button><button class="danger" type="button" data-delete-gallery="${esc(item.id)}">Excluir</button>` : ''}
        </footer>
      </div>
    </article>`;
  }

  function groupedGalleryHtml() {
    const list = filteredItems();
    if (!list.length) {
      return `<div class="history-gallery-empty"><span>🖼️</span><b>Nenhuma memória neste filtro</b><p>${isAdmin() ? 'Use “Adicionar memória” para começar a galeria histórica.' : 'A galeria histórica está sendo preparada.'}</p></div>`;
    }

    const groups = new Map();
    list.forEach(item => {
      const year = yearFrom(item);
      if (!groups.has(year)) groups.set(year, []);
      groups.get(year).push(item);
    });

    return [...groups].map(([year, group]) => `<section class="history-gallery-year">
      <header><span>${esc(year)}</span><div></div><small>${group.length} ${group.length === 1 ? 'memória' : 'memórias'}</small></header>
      <div class="history-gallery-grid">${group.map(cardHtml).join('')}</div>
    </section>`).join('');
  }

  function sectionHtml() {
    return `<section id="clanHistoryGallerySection">
      <div class="section-head history-gallery-head">
        <div><span class="eyebrow">Arquivo visual do clã</span><h2>Galeria histórica</h2><p>Fotos antigas, campeões, homenagens e momentos que merecem atravessar o tempo.</p></div>
        <div class="history-gallery-head-actions">
          <button class="ghost" type="button" data-photo-gallery>📸 Foto da galeria</button>
          ${isAdmin() ? '<button class="ghost" type="button" data-import-champion-banners>Importar campeões</button><button class="primary" type="button" data-add-gallery>+ Adicionar memória</button>' : ''}
        </div>
      </div>
      ${filterHtml()}
      <div id="historyGalleryContent">${groupedGalleryHtml()}</div>
    </section>`;
  }

  function ensureSection() {
    const capture = $('#historyCapture');
    if (!capture) return;
    let section = $('#clanHistoryGallerySection');
    if (!section) {
      section = document.createElement('section');
      section.id = 'clanHistoryGallerySection';
      const quote = $('.history-quote', capture);
      quote ? capture.insertBefore(section, quote) : capture.append(section);
    }
    section.outerHTML = sectionHtml();
  }

  function editorModalHtml(item = null) {
    const value = item || sanitize({ category: 'momento', title: '', date: new Date().toISOString().slice(0, 10) });
    return `<div class="modal-backdrop show" id="historyGalleryEditorModal">
      <div class="modal history-gallery-modal">
        <header><div><span class="eyebrow">Arquivo visual</span><h2>${item ? 'Editar memória' : 'Adicionar memória'}</h2><p>Registre uma imagem e conte por que este momento é importante.</p></div><button type="button" class="history-gallery-close" data-close-gallery-editor>×</button></header>
        <form id="historyGalleryForm">
          <div class="form-grid two">
            <label>Categoria<select id="galleryCategory">${categoryOptions(value.category)}</select></label>
            <label>Data<input id="galleryDate" type="date" value="${esc(value.date)}"></label>
            <label>Título<input id="galleryTitle" maxlength="120" required value="${esc(item?.title || '')}" placeholder="Ex.: Primeiro título do Clã BDA"></label>
            <label>Autor ou responsável<input id="galleryAuthor" maxlength="90" value="${esc(value.author)}" placeholder="Nome de quem enviou a imagem"></label>
          </div>
          <label>Legenda<textarea id="galleryCaption" maxlength="900" rows="5" placeholder="Conte o que aconteceu neste momento.">${esc(value.caption)}</textarea></label>
          <label>Imagem<input id="galleryImageInput" type="file" accept="image/png,image/jpeg,image/webp" ${item ? '' : 'required'}><small>A imagem será reduzida para carregar mais rápido e caber com segurança na nuvem.</small></label>
          <div class="history-gallery-preview" id="historyGalleryPreview"></div>
          <label class="history-gallery-feature"><input id="galleryFeatured" type="checkbox" ${value.featured ? 'checked' : ''}><span><b>Destacar esta memória</b><small>O cartão ficará maior e aparecerá primeiro no ano.</small></span></label>
          <footer><button class="secondary" type="button" data-close-gallery-editor>Cancelar</button><button class="primary" type="submit">Salvar memória</button></footer>
        </form>
      </div>
    </div>`;
  }

  function openEditor(itemId = '') {
    if (!isAdmin()) return;
    editingId = itemId;
    pendingImage = null;
    const item = items.find(entry => entry.id === itemId) || null;
    document.body.insertAdjacentHTML('beforeend', editorModalHtml(item));
    updatePreview();
    $('#galleryImageInput')?.addEventListener('change', handleImage);
    $('#historyGalleryForm')?.addEventListener('submit', saveItem);
    $$('[data-close-gallery-editor]').forEach(button => button.addEventListener('click', closeEditor));
    $('#historyGalleryEditorModal')?.addEventListener('click', event => {
      if (event.target.id === 'historyGalleryEditorModal') closeEditor();
    });
    $('#galleryTitle')?.focus();
  }

  function closeEditor() {
    $('#historyGalleryEditorModal')?.remove();
    editingId = '';
    pendingImage = null;
  }

  function updatePreview() {
    const root = $('#historyGalleryPreview');
    if (!root) return;
    const current = items.find(entry => entry.id === editingId)?.image || '';
    const image = pendingImage === null ? current : pendingImage;
    root.innerHTML = image
      ? `<img src="${esc(image)}" alt="Prévia da memória"><span>Prévia da imagem selecionada</span>`
      : '<div><span>🖼️</span><b>Escolha uma imagem</b><small>PNG, JPG ou WebP</small></div>';
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
    let scale = Math.min(1, 1200 / Math.max(image.width, image.height));
    let quality = 0.8;
    let result = '';

    for (let attempt = 0; attempt < 7; attempt += 1) {
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(image.width * scale));
      canvas.height = Math.max(1, Math.round(image.height * scale));
      const context = canvas.getContext('2d');
      if (!context) throw new Error('Falha ao preparar a imagem');
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      result = canvas.toDataURL('image/webp', quality);
      if (result.length <= 700000) break;
      scale *= 0.82;
      quality = Math.max(0.52, quality - 0.07);
    }

    if (result.length > 850000) throw new Error('A imagem ficou grande demais. Escolha outra imagem');
    return result;
  }

  async function handleImage(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      notify('Preparando a imagem...');
      pendingImage = await prepareImage(file);
      updatePreview();
      notify('Imagem pronta');
    } catch (error) {
      console.error(error);
      event.target.value = '';
      notify(error.message || 'Não foi possível processar a imagem');
    }
  }

  async function saveCloud(item) {
    if (!db || !isAdmin()) return;
    await db.collection(COLLECTION).doc(`${DOC_PREFIX}${item.id}`).set({
      ...item,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      updatedBy: String(currentUser.email || '').toLowerCase()
    });
  }

  async function saveItem(event) {
    event.preventDefault();
    if (!isAdmin() || saving) return;
    const previous = items.find(entry => entry.id === editingId) || null;
    const image = pendingImage === null ? previous?.image || '' : pendingImage;
    if (!image) {
      notify('Escolha uma imagem para a memória');
      return;
    }

    const next = sanitize({
      ...previous,
      id: previous?.id || id(),
      category: $('#galleryCategory')?.value,
      date: $('#galleryDate')?.value,
      title: $('#galleryTitle')?.value.trim(),
      author: $('#galleryAuthor')?.value.trim(),
      caption: $('#galleryCaption')?.value.trim(),
      featured: Boolean($('#galleryFeatured')?.checked),
      image,
      createdAtMs: previous?.createdAtMs || Date.now(),
      updatedAtMs: Date.now()
    });

    if (!next.title) {
      notify('Digite um título para a memória');
      return;
    }

    saving = true;
    const submit = $('#historyGalleryForm button[type="submit"]');
    if (submit) { submit.disabled = true; submit.textContent = 'Salvando...'; }

    try {
      const index = items.findIndex(entry => entry.id === next.id);
      if (index >= 0) items[index] = next;
      else items.unshift(next);
      items = items.slice(0, MAX_ITEMS);
      saveLocal();
      await saveCloud(next);
      closeEditor();
      ensureSection();
      notify(previous ? 'Memória atualizada' : 'Memória adicionada à história');
    } catch (error) {
      console.error(error);
      notify(String(error?.code || '').includes('permission-denied')
        ? 'Publique as regras do Firestore e entre novamente'
        : 'A memória foi salva localmente, mas a nuvem falhou');
    } finally {
      saving = false;
      if (submit) { submit.disabled = false; submit.textContent = 'Salvar memória'; }
    }
  }

  async function deleteItem(itemId) {
    if (!isAdmin()) return;
    const item = items.find(entry => entry.id === itemId);
    if (!item || !confirm(`Excluir “${item.title}” da galeria histórica?`)) return;
    items = items.filter(entry => entry.id !== itemId);
    saveLocal();
    ensureSection();
    try {
      if (db) await db.collection(COLLECTION).doc(`${DOC_PREFIX}${itemId}`).delete();
      notify('Memória removida da galeria');
    } catch (error) {
      console.error(error);
      notify('A memória saiu deste aparelho, mas não foi removida da nuvem');
    }
  }

  function lightboxHtml(item) {
    const meta = CATEGORIES[item.category];
    return `<div class="history-gallery-lightbox" id="historyGalleryLightbox">
      <section>
        <header><span>${meta.icon} ${esc(meta.label)}</span><button type="button" data-close-gallery-lightbox>×</button></header>
        <div class="history-gallery-lightbox-media"><img src="${esc(item.image)}" alt="${esc(item.title)}"></div>
        <div class="history-gallery-lightbox-copy"><small>${esc(formatDate(item.date))}${item.author ? ` • ${esc(item.author)}` : ''}</small><h2>${esc(item.title)}</h2>${item.caption ? `<p>${esc(item.caption)}</p>` : ''}<footer><button class="primary" type="button" data-share-gallery="${esc(item.id)}">Compartilhar memória</button></footer></div>
      </section>
    </div>`;
  }

  function openLightbox(itemId) {
    const item = items.find(entry => entry.id === itemId);
    if (!item) return;
    $('#historyGalleryLightbox')?.remove();
    document.body.insertAdjacentHTML('beforeend', lightboxHtml(item));
    document.body.classList.add('history-gallery-open');
    $$('[data-close-gallery-lightbox]').forEach(button => button.addEventListener('click', closeLightbox));
    $('#historyGalleryLightbox')?.addEventListener('click', event => {
      if (event.target.id === 'historyGalleryLightbox') closeLightbox();
    });
  }

  function closeLightbox() {
    $('#historyGalleryLightbox')?.remove();
    document.body.classList.remove('history-gallery-open');
  }

  function dataUrlFile(dataUrl, filename) {
    const [header, body] = dataUrl.split(',');
    const mime = header.match(/data:([^;]+)/)?.[1] || 'image/webp';
    const bytes = atob(body);
    const array = new Uint8Array(bytes.length);
    for (let index = 0; index < bytes.length; index += 1) array[index] = bytes.charCodeAt(index);
    return new File([array], filename, { type: mime });
  }

  async function shareItem(itemId) {
    const item = items.find(entry => entry.id === itemId);
    if (!item) return;
    const text = `${item.title}${item.caption ? `\n${item.caption}` : ''}\nHistória do Clã BDA`;
    try {
      if (navigator.share) {
        const file = dataUrlFile(item.image, `bda-${item.id}.webp`);
        const payload = { title: item.title, text, url: location.href };
        if (navigator.canShare?.({ files: [file] })) payload.files = [file];
        await navigator.share(payload);
        return;
      }
      await navigator.clipboard.writeText(`${text}\n${location.href}`);
      notify('Texto da memória copiado para compartilhar');
    } catch (error) {
      if (error?.name !== 'AbortError') notify('Não foi possível compartilhar esta memória');
    }
  }

  async function importChampionBanners() {
    if (!isAdmin()) return;
    let champions = [];
    try {
      champions = JSON.parse(localStorage.getItem('bda-v2-champions')) || [];
    } catch {
      champions = [];
    }
    const existing = new Set(items.map(item => item.sourceChampionKey).filter(Boolean));
    const source = champions.filter(champion => champion?.banner).filter(champion => {
      const key = norm(`${champion.name}|${champion.edition}`);
      return key && !existing.has(key);
    });

    if (!source.length) {
      notify('Nenhum banner novo de campeão foi encontrado');
      return;
    }

    const now = Date.now();
    const imported = source.map((champion, index) => sanitize({
      id: id(),
      category: 'campeao',
      title: champion.name || 'Campeão BDA',
      caption: `${champion.edition || 'Campeão da Arena BDA'}${champion.master ? ` • Mestre ${champion.master}` : ''}`,
      author: 'Arena BDA',
      image: champion.banner,
      year: String(new Date().getFullYear()),
      featured: false,
      sourceChampionKey: norm(`${champion.name}|${champion.edition}`),
      createdAtMs: now + index,
      updatedAtMs: now + index
    }));

    items = [...imported, ...items].slice(0, MAX_ITEMS);
    saveLocal();
    ensureSection();

    try {
      if (db) {
        const batch = db.batch();
        imported.forEach(item => batch.set(db.collection(COLLECTION).doc(`${DOC_PREFIX}${item.id}`), {
          ...item,
          updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
          updatedBy: String(currentUser.email || '').toLowerCase()
        }));
        await batch.commit();
      }
      notify(`${imported.length} ${imported.length === 1 ? 'banner importado' : 'banners importados'} para a história`);
    } catch (error) {
      console.error(error);
      notify('Os banners foram importados localmente, mas a nuvem falhou');
    }
  }

  function bindSection() {
    $$('[data-gallery-category]').forEach(button => button.addEventListener('click', () => {
      categoryFilter = button.dataset.galleryCategory;
      ensureSection();
    }));
    $('#historyGalleryYear')?.addEventListener('change', event => {
      yearFilter = event.target.value;
      ensureSection();
    });
    $('[data-add-gallery]')?.addEventListener('click', () => openEditor());
    $('[data-import-champion-banners]')?.addEventListener('click', importChampionBanners);
    $('[data-photo-gallery]')?.addEventListener('click', () => {
      const target = $('#clanHistoryGallerySection');
      if (window.ArenaBDACapture?.element && target) window.ArenaBDACapture.element(target, 'Galeria Histórica BDA', 'galeria-historica-bda');
      else notify('A ferramenta de imagem ainda está carregando');
    });
    $$('[data-open-gallery]').forEach(button => button.addEventListener('click', () => openLightbox(button.dataset.openGallery)));
    $$('[data-share-gallery]').forEach(button => button.addEventListener('click', () => shareItem(button.dataset.shareGallery)));
    $$('[data-edit-gallery]').forEach(button => button.addEventListener('click', () => openEditor(button.dataset.editGallery)));
    $$('[data-delete-gallery]').forEach(button => button.addEventListener('click', () => deleteItem(button.dataset.deleteGallery)));
  }

  const originalEnsure = ensureSection;
  ensureSection = function ensureAndBind() {
    originalEnsure();
    bindSection();
  };

  const style = document.createElement('style');
  style.textContent = `
    #clanHistoryGallerySection{margin-top:22px;text-align:left}.history-gallery-head{align-items:end}.history-gallery-head-actions{display:flex;flex-wrap:wrap;justify-content:flex-end;gap:7px}
    .history-gallery-toolbar{display:flex;align-items:center;justify-content:space-between;gap:10px;margin:10px 0 14px}.history-gallery-filters{display:flex;gap:6px;overflow-x:auto;padding-bottom:3px;scrollbar-width:none}.history-gallery-filters::-webkit-scrollbar{display:none}.history-gallery-filters button{min-height:35px;padding:0 11px;border:1px solid var(--line);border-radius:999px;color:var(--muted);background:#ffffff08;white-space:nowrap;font-size:8px;font-weight:900;text-transform:uppercase}.history-gallery-filters button.active{color:#171107;border-color:var(--gold);background:linear-gradient(135deg,var(--gold-soft),var(--gold))}.history-gallery-toolbar select{width:auto;min-width:135px}
    .history-gallery-year{margin-top:18px}.history-gallery-year>header{display:grid;grid-template-columns:auto 1fr auto;align-items:center;gap:10px;margin-bottom:9px}.history-gallery-year>header span{color:var(--gold-soft);font:900 25px "Barlow Condensed",sans-serif}.history-gallery-year>header div{height:1px;background:linear-gradient(90deg,var(--line-strong),transparent)}.history-gallery-year>header small{color:var(--muted);font-size:8px;text-transform:uppercase}
    .history-gallery-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}.history-gallery-card{overflow:hidden;border:1px solid var(--line);border-radius:20px;background:linear-gradient(150deg,var(--surface-2),var(--surface));box-shadow:0 13px 30px rgba(0,0,0,.22)}.history-gallery-card.featured{grid-column:span 2}.history-gallery-media{position:relative;display:block;width:100%;aspect-ratio:4/3;overflow:hidden;padding:0;border:0;border-radius:0;background:#020503}.history-gallery-card.featured .history-gallery-media{aspect-ratio:16/8}.history-gallery-media img{display:block;width:100%;height:100%;object-fit:cover;transition:transform .28s ease}.history-gallery-media:hover img{transform:scale(1.035)}.history-gallery-media:after{content:"";position:absolute;inset:0;background:linear-gradient(180deg,transparent 58%,rgba(2,7,5,.88))}.history-gallery-media>span{position:absolute;left:10px;bottom:9px;z-index:2;padding:6px 8px;border:1px solid #ffffff2e;border-radius:999px;color:#fff;background:#030806a8;font-size:7px;font-weight:900;text-transform:uppercase}.history-gallery-media>em{position:absolute;right:9px;top:9px;z-index:2;padding:6px 8px;border-radius:999px;color:#171107;background:linear-gradient(135deg,var(--gold-soft),var(--gold));font-size:7px;font-style:normal;font-weight:900}
    .history-gallery-copy{padding:13px}.history-gallery-copy>small{color:var(--gold-soft);font-size:7px;font-weight:800;text-transform:uppercase}.history-gallery-copy h3{margin:6px 0;font-size:21px;line-height:1;text-transform:uppercase}.history-gallery-copy p{display:-webkit-box;overflow:hidden;margin:0;color:var(--muted);font-size:9px;line-height:1.55;-webkit-line-clamp:3;-webkit-box-orient:vertical}.history-gallery-copy footer{display:flex;flex-wrap:wrap;gap:6px;margin-top:11px}.history-gallery-copy footer button{min-height:32px;padding:0 9px;font-size:8px}
    .history-gallery-empty{display:grid;place-items:center;min-height:220px;padding:24px;border:1px dashed var(--line-strong);border-radius:20px;color:var(--muted);text-align:center}.history-gallery-empty>span{font-size:42px}.history-gallery-empty b{margin-top:8px;color:var(--text);font-size:12px}.history-gallery-empty p{margin:5px 0 0;font-size:9px}
    .history-gallery-modal{max-width:720px}.history-gallery-modal>header{display:flex;align-items:start;justify-content:space-between;gap:12px;padding-bottom:13px;border-bottom:1px solid var(--line)}.history-gallery-modal h2{margin:5px 0;font-size:34px;text-transform:uppercase}.history-gallery-modal header p{margin:0;color:var(--muted);font-size:9px}.history-gallery-close{width:42px;height:42px;border:1px solid var(--line);border-radius:13px;color:var(--text);background:#ffffff08;font-size:24px}.history-gallery-modal form{display:grid;gap:12px;margin-top:14px}.history-gallery-modal form>footer{display:flex;justify-content:flex-end;gap:8px;padding-top:13px;border-top:1px solid var(--line)}.history-gallery-preview{overflow:hidden;display:grid;place-items:center;min-height:170px;border:1px dashed var(--line-strong);border-radius:18px;background:#020503}.history-gallery-preview img{display:block;width:100%;max-height:360px;object-fit:contain}.history-gallery-preview>span{display:block;width:100%;padding:8px;color:var(--muted);background:#07100c;text-align:center;font-size:8px}.history-gallery-preview>div{display:grid;place-items:center;gap:4px;color:var(--muted)}.history-gallery-preview>div span{font-size:36px}.history-gallery-preview>div b{color:var(--text)}.history-gallery-preview>div small{font-size:8px}.history-gallery-feature{display:flex!important;align-items:center;gap:10px;padding:11px;border:1px solid var(--line);border-radius:15px;background:#ffffff06}.history-gallery-feature input{width:auto;margin:0}.history-gallery-feature b,.history-gallery-feature small{display:block}.history-gallery-feature b{font-size:9px}.history-gallery-feature small{margin-top:3px;color:var(--muted);font-size:8px}
    .history-gallery-lightbox{position:fixed;inset:0;z-index:120;display:grid;place-items:center;padding:16px;background:rgba(0,0,0,.84);backdrop-filter:blur(10px)}.history-gallery-lightbox>section{overflow:hidden;width:min(960px,100%);max-height:94vh;border:1px solid rgba(242,215,125,.34);border-radius:24px;background:linear-gradient(150deg,#112a1c,#040a07);box-shadow:0 30px 90px #000}.history-gallery-lightbox header{display:flex;align-items:center;justify-content:space-between;padding:10px 13px;border-bottom:1px solid var(--line)}.history-gallery-lightbox header span{color:var(--gold-soft);font-size:8px;font-weight:900;text-transform:uppercase}.history-gallery-lightbox header button{width:38px;height:38px;border:1px solid var(--line);border-radius:12px;color:var(--text);background:#ffffff08;font-size:22px}.history-gallery-lightbox-media{display:grid;place-items:center;max-height:66vh;background:#020503}.history-gallery-lightbox-media img{display:block;max-width:100%;max-height:66vh;object-fit:contain}.history-gallery-lightbox-copy{padding:16px}.history-gallery-lightbox-copy small{color:var(--gold-soft);font-size:8px;text-transform:uppercase}.history-gallery-lightbox-copy h2{margin:6px 0;font-size:32px;text-transform:uppercase}.history-gallery-lightbox-copy p{margin:0;color:var(--muted);font-size:10px;line-height:1.6}.history-gallery-lightbox-copy footer{display:flex;justify-content:flex-end;margin-top:12px}.history-gallery-open{overflow:hidden}
    @media(max-width:850px){.history-gallery-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.history-gallery-card.featured{grid-column:span 2}}
    @media(max-width:600px){.history-gallery-head,.history-gallery-toolbar{display:grid}.history-gallery-head-actions{justify-content:stretch}.history-gallery-head-actions button{width:100%}.history-gallery-toolbar select{width:100%}.history-gallery-grid{grid-template-columns:1fr}.history-gallery-card.featured{grid-column:auto}.history-gallery-card.featured .history-gallery-media{aspect-ratio:4/3}.history-gallery-modal form>footer{display:grid}.history-gallery-modal form>footer button{width:100%}.history-gallery-lightbox-copy h2{font-size:26px}}
  `;
  document.head.append(style);

  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') {
      closeLightbox();
      closeEditor();
    }
  });

  if (window.firebase && typeof firebase.auth === 'function' && typeof firebase.firestore === 'function') {
    db = firebase.firestore();
    firebase.auth().onAuthStateChanged(user => {
      currentUser = user;
      ensureSection();
    });

    unsubscribe = db.collection(COLLECTION).where('dataset', '==', DATASET).onSnapshot(snapshot => {
      const remote = snapshot.docs.map(doc => sanitize({ ...doc.data(), id: doc.data()?.id || doc.id.replace(DOC_PREFIX, '') }));
      if (!snapshot.metadata.fromCache || remote.length) {
        items = sortItems(remote).slice(0, MAX_ITEMS);
        saveLocal();
        ensureSection();
      }
    }, error => console.error('Falha ao carregar a galeria histórica', error));
  }

  const observer = new MutationObserver(() => {
    clearTimeout(structureTimer);
    structureTimer = setTimeout(ensureSection, 110);
  });
  observer.observe(document.body, { childList: true, subtree: true });

  ensureSection();
})();
