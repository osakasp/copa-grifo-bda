(() => {
  'use strict';

  const COLLECTION = 'arenaData';
  const DATASET = 'notification';
  const DOC_PREFIX = 'notification-';
  const READ_KEY = 'arena-bda-notifications-read';
  const MAX_ITEMS = 60;
  const CATEGORIES = Object.freeze({
    campeonato: ['🏆', 'Campeonato'],
    resultado: ['⚽', 'Resultado'],
    inscricao: ['✍️', 'Inscrição'],
    noticia: ['📰', 'Notícia'],
    aviso: ['📣', 'Aviso']
  });
  const PAGES = new Set(['home', 'tournament', 'registrations', 'ranking', 'champions', 'teams', 'community', 'news', 'history']);

  let notifications = [];
  let filter = 'all';
  let panelOpen = false;
  let currentUser = null;
  let db = null;
  let unsubscribe = null;
  let initialCloudLoad = true;
  let knownCloudIds = new Set();

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const esc = value => String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
  const notify = message => typeof toast === 'function' ? toast(message) : console.info(message);
  const isAdmin = () => Boolean(window.ArenaBDAAuth?.isAdmin?.(currentUser));

  function makeId() {
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
  }

  function loadReadIds() {
    try {
      const value = JSON.parse(localStorage.getItem(READ_KEY) || '[]');
      return new Set(Array.isArray(value) ? value.map(String).slice(-500) : []);
    } catch {
      return new Set();
    }
  }

  function saveIds(ids) {
    try {
      localStorage.setItem(READ_KEY, JSON.stringify([...ids].slice(-500)));
    } catch {}
  }

  let readIds = loadReadIds();

  function clean(input = {}, id = '') {
    const category = CATEGORIES[input.category] ? input.category : 'aviso';
    const page = PAGES.has(String(input.page || '')) ? String(input.page) : '';
    return {
      id: String(id || input.id || makeId()).slice(0, 100),
      dataset: DATASET,
      title: String(input.title || 'Aviso da Arena BDA').trim().slice(0, 100),
      message: String(input.message || '').trim().slice(0, 500),
      category,
      priority: ['normal', 'important', 'urgent'].includes(input.priority) ? input.priority : 'normal',
      page,
      actionLabel: String(input.actionLabel || '').trim().slice(0, 35),
      createdAtClient: Number(input.createdAtClient) || Date.now(),
      expiresAtClient: Number(input.expiresAtClient) || 0,
      author: String(input.author || 'Admin BDA').trim().slice(0, 80),
      source: String(input.source || 'arena-bda').slice(0, 40)
    };
  }

  function visibleItems() {
    const now = Date.now();
    return notifications
      .filter(item => !item.expiresAtClient || item.expiresAtClient > now)
      .filter(item => filter !== 'unread' || !readIds.has(item.id))
      .sort((a, b) => {
        const weight = value => value === 'urgent' ? 2 : value === 'important' ? 1 : 0;
        return weight(b.priority) - weight(a.priority) || b.createdAtClient - a.createdAtClient;
      });
  }

  function unreadCount() {
    const now = Date.now();
    return notifications.filter(item => (!item.expiresAtClient || item.expiresAtClient > now) && !readIds.has(item.id)).length;
  }

  function relativeTime(timestamp) {
    const value = Number(timestamp) || Date.now();
    const seconds = Math.max(0, Math.floor((Date.now() - value) / 1000));
    if (seconds < 60) return 'Agora';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `Há ${minutes} min`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `Há ${hours} h`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `Há ${days} d`;
    return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short' }).format(new Date(value));
  }

  function ensureInterface() {
    const actions = $('.top-actions');
    if (!actions) return false;

    let button = $('#arenaNotificationsBtn');
    if (!button) {
      button = document.createElement('button');
      button.id = 'arenaNotificationsBtn';
      button.type = 'button';
      button.className = 'icon-btn arena-notification-button';
      button.setAttribute('aria-label', 'Abrir notificações');
      button.setAttribute('aria-haspopup', 'dialog');
      button.innerHTML = '<span aria-hidden="true">🔔</span><b id="arenaNotificationBadge" hidden>0</b>';
      const share = $('#shareBtn');
      share ? actions.insertBefore(button, share) : actions.prepend(button);
    }

    if (!$('#arenaNotificationsBackdrop')) {
      document.body.insertAdjacentHTML('beforeend', `
        <div class="arena-notification-backdrop" id="arenaNotificationsBackdrop" aria-hidden="true">
          <aside class="arena-notification-panel" role="dialog" aria-modal="true" aria-labelledby="arenaNotificationsTitle">
            <header>
              <div><span class="eyebrow">Central da Arena</span><h2 id="arenaNotificationsTitle">Notificações</h2></div>
              <button type="button" class="arena-notification-close" data-notification-close aria-label="Fechar">×</button>
            </header>
            <div class="arena-notification-tabs" role="tablist">
              <button type="button" data-notification-filter="all" class="active">Todas</button>
              <button type="button" data-notification-filter="unread">Não lidas</button>
            </div>
            <div class="arena-notification-list" id="arenaNotificationList"></div>
            <footer>
              <button type="button" class="ghost" data-notification-read-all>Marcar todas como lidas</button>
              <button type="button" class="ghost" data-browser-notifications hidden>Ativar no navegador</button>
              <button type="button" class="primary" data-notification-create hidden>+ Novo aviso</button>
            </footer>
          </aside>
        </div>`);
    }

    bindInterface();
    updatePermissionButton();
    render();
    return true;
  }

  function bindInterface() {
    const button = $('#arenaNotificationsBtn');
    if (button && !button.dataset.bound) {
      button.dataset.bound = 'true';
      button.addEventListener('click', openPanel);
    }

    const backdrop = $('#arenaNotificationsBackdrop');
    if (!backdrop || backdrop.dataset.bound) return;
    backdrop.dataset.bound = 'true';
    backdrop.addEventListener('click', event => {
      if (event.target === backdrop || event.target.closest('[data-notification-close]')) closePanel();
      const filterButton = event.target.closest('[data-notification-filter]');
      if (filterButton) {
        filter = filterButton.dataset.notificationFilter;
        render();
      }
      const itemButton = event.target.closest('[data-notification-open]');
      if (itemButton) openNotification(itemButton.dataset.notificationOpen);
      const deleteButton = event.target.closest('[data-notification-delete]');
      if (deleteButton) deleteNotification(deleteButton.dataset.notificationDelete);
      if (event.target.closest('[data-notification-read-all]')) markAllRead();
      if (event.target.closest('[data-notification-create]')) openEditor();
      if (event.target.closest('[data-browser-notifications]')) requestBrowserPermission();
    });
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape' && panelOpen) closePanel();
    });
  }

  function openPanel() {
    ensureInterface();
    panelOpen = true;
    const backdrop = $('#arenaNotificationsBackdrop');
    backdrop?.classList.add('show');
    backdrop?.setAttribute('aria-hidden', 'false');
    document.body.classList.add('arena-notifications-open');
    $('#arenaNotificationsBtn')?.setAttribute('aria-expanded', 'true');
    render();
    requestAnimationFrame(() => $('[data-notification-close]')?.focus());
  }

  function closePanel() {
    panelOpen = false;
    const backdrop = $('#arenaNotificationsBackdrop');
    backdrop?.classList.remove('show');
    backdrop?.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('arena-notifications-open');
    $('#arenaNotificationsBtn')?.setAttribute('aria-expanded', 'false');
  }

  function cardHtml(item) {
    const [icon, category] = CATEGORIES[item.category];
    const unread = !readIds.has(item.id);
    return `<article class="arena-notification-card ${unread ? 'unread' : ''} priority-${esc(item.priority)}">
      <button type="button" class="arena-notification-main" data-notification-open="${esc(item.id)}">
        <span class="arena-notification-icon">${icon}</span>
        <span class="arena-notification-copy">
          <small>${esc(category)} • ${esc(relativeTime(item.createdAtClient))}</small>
          <b>${esc(item.title)}</b>
          ${item.message ? `<p>${esc(item.message)}</p>` : ''}
          ${item.page ? `<em>${esc(item.actionLabel || 'Abrir na Arena')} ›</em>` : ''}
        </span>
        ${unread ? '<i aria-label="Não lida"></i>' : ''}
      </button>
      ${isAdmin() ? `<button type="button" class="arena-notification-delete" data-notification-delete="${esc(item.id)}" aria-label="Excluir notificação">Excluir</button>` : ''}
    </article>`;
  }

  function render() {
    const count = unreadCount();
    const badge = $('#arenaNotificationBadge');
    if (badge) {
      badge.textContent = count > 99 ? '99+' : String(count);
      badge.hidden = count === 0;
    }
    $('#arenaNotificationsBtn')?.classList.toggle('has-unread', count > 0);

    $$('[data-notification-filter]').forEach(button => button.classList.toggle('active', button.dataset.notificationFilter === filter));
    const createButton = $('[data-notification-create]');
    if (createButton) createButton.hidden = !isAdmin();

    const root = $('#arenaNotificationList');
    if (!root) return;
    const list = visibleItems();
    root.innerHTML = list.length
      ? list.map(cardHtml).join('')
      : `<div class="arena-notification-empty"><span>${filter === 'unread' ? '✅' : '🔔'}</span><b>${filter === 'unread' ? 'Tudo em dia' : 'Nenhuma notificação'}</b><p>${isAdmin() && filter === 'all' ? 'Use “Novo aviso” para publicar a primeira atualização.' : 'Os avisos da Arena BDA aparecerão aqui.'}</p></div>`;
  }

  function markRead(id) {
    if (!id) return;
    readIds.add(String(id));
    saveIds(readIds);
    render();
  }

  function markAllRead() {
    notifications.forEach(item => readIds.add(item.id));
    saveIds(readIds);
    render();
    notify('Todas as notificações foram lidas');
  }

  function openNotification(id) {
    const item = notifications.find(entry => entry.id === id);
    if (!item) return;
    markRead(id);
    if (!item.page) return;
    closePanel();
    if (typeof navigate === 'function') navigate(item.page);
    else {
      $$('.page').forEach(page => page.classList.toggle('active', page.dataset.page === item.page));
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  function editorHtml() {
    const categoryOptions = Object.entries(CATEGORIES).map(([key, value]) => `<option value="${key}">${value[0]} ${esc(value[1])}</option>`).join('');
    return `<div class="arena-notification-editor-backdrop" id="arenaNotificationEditor">
      <section class="arena-notification-editor" role="dialog" aria-modal="true" aria-labelledby="arenaNotificationEditorTitle">
        <header><div><span class="eyebrow">Área administrativa</span><h2 id="arenaNotificationEditorTitle">Publicar notificação</h2></div><button type="button" data-notification-editor-close aria-label="Fechar">×</button></header>
        <form id="arenaNotificationForm">
          <label>Título<input id="notificationTitle" maxlength="100" required placeholder="Ex.: Quartas de final definidas"></label>
          <label>Mensagem<textarea id="notificationMessage" maxlength="500" rows="5" required placeholder="Escreva o aviso para os membros do clã"></textarea></label>
          <div class="form-grid two">
            <label>Categoria<select id="notificationCategory">${categoryOptions}</select></label>
            <label>Prioridade<select id="notificationPriority"><option value="normal">Normal</option><option value="important">Importante</option><option value="urgent">Urgente</option></select></label>
            <label>Abrir página<select id="notificationPage"><option value="">Sem atalho</option><option value="tournament">Campeonatos</option><option value="registrations">Inscrições</option><option value="ranking">Ranking</option><option value="teams">Times</option><option value="champions">Campeões</option><option value="community">Comunidade</option><option value="news">Notícias</option></select></label>
            <label>Validade<input id="notificationExpires" type="date"></label>
          </div>
          <footer><button type="button" class="secondary" data-notification-editor-close>Cancelar</button><button type="submit" class="primary">Publicar aviso</button></footer>
        </form>
      </section>
    </div>`;
  }

  function openEditor() {
    if (!isAdmin()) return;
    $('#arenaNotificationEditor')?.remove();
    document.body.insertAdjacentHTML('beforeend', editorHtml());
    const editor = $('#arenaNotificationEditor');
    editor?.addEventListener('click', event => {
      if (event.target === editor || event.target.closest('[data-notification-editor-close]')) editor.remove();
    });
    $('#arenaNotificationForm')?.addEventListener('submit', publishNotification);
    $('#notificationTitle')?.focus();
  }

  async function publishNotification(event) {
    event.preventDefault();
    if (!isAdmin() || !db) return notify('Entre como administrador para publicar');
    const submit = event.submitter;
    if (submit) { submit.disabled = true; submit.textContent = 'Publicando...'; }
    try {
      const expiresValue = $('#notificationExpires')?.value || '';
      const expiresAtClient = expiresValue ? new Date(`${expiresValue}T23:59:59`).getTime() : 0;
      const item = clean({
        title: $('#notificationTitle')?.value,
        message: $('#notificationMessage')?.value,
        category: $('#notificationCategory')?.value,
        priority: $('#notificationPriority')?.value,
        page: $('#notificationPage')?.value,
        actionLabel: $('#notificationPage')?.value ? 'Ver agora' : '',
        createdAtClient: Date.now(),
        expiresAtClient,
        author: window.ArenaBDAAuth?.currentEmail?.() || 'Admin BDA',
        source: 'arena-bda-admin'
      });
      await db.collection(COLLECTION).doc(`${DOC_PREFIX}${item.id}`).set({
        ...item,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      $('#arenaNotificationEditor')?.remove();
      notify('Notificação publicada');
    } catch (error) {
      console.error('Falha ao publicar notificação', error);
      notify(String(error?.code || '').includes('permission-denied') ? 'Esta conta não possui permissão' : 'Não foi possível publicar o aviso');
    } finally {
      if (submit?.isConnected) { submit.disabled = false; submit.textContent = 'Publicar aviso'; }
    }
  }

  async function deleteNotification(id) {
    if (!isAdmin() || !db || !id) return;
    if (!confirm('Excluir esta notificação?')) return;
    try {
      await db.collection(COLLECTION).doc(`${DOC_PREFIX}${id}`).delete();
      notify('Notificação excluída');
    } catch (error) {
      console.error('Falha ao excluir notificação', error);
      notify('Não foi possível excluir a notificação');
    }
  }

  function updatePermissionButton() {
    const button = $('[data-browser-notifications]');
    if (!button || !('Notification' in window)) return;
    button.hidden = Notification.permission === 'granted';
    button.textContent = Notification.permission === 'denied' ? 'Avisos bloqueados no navegador' : 'Ativar no navegador';
    button.disabled = Notification.permission === 'denied';
  }

  async function requestBrowserPermission() {
    if (!('Notification' in window)) return notify('Este navegador não oferece notificações');
    try {
      const permission = await Notification.requestPermission();
      updatePermissionButton();
      notify(permission === 'granted' ? 'Avisos do navegador ativados' : 'Permissão de notificações não concedida');
    } catch {
      notify('Não foi possível solicitar a permissão');
    }
  }

  function showBrowserNotification(item) {
    if (!('Notification' in window) || Notification.permission !== 'granted' || document.visibilityState === 'visible') return;
    try {
      const alert = new Notification(item.title, {
        body: item.message,
        icon: './favicon.svg',
        badge: './favicon.svg',
        tag: `arena-bda-${item.id}`
      });
      alert.onclick = () => {
        window.focus();
        openNotification(item.id);
        alert.close();
      };
    } catch {}
  }

  function connectCloud() {
    if (!window.firebase || typeof firebase.firestore !== 'function') return;
    db = firebase.firestore();
    unsubscribe?.();
    unsubscribe = db.collection(COLLECTION)
      .where('dataset', '==', DATASET)
      .limit(MAX_ITEMS)
      .onSnapshot(snapshot => {
        const next = snapshot.docs.map(doc => clean(doc.data(), String(doc.id).replace(new RegExp(`^${DOC_PREFIX}`), '')));
        const nextIds = new Set(next.map(item => item.id));
        if (!initialCloudLoad) {
          next.filter(item => !knownCloudIds.has(item.id)).forEach(showBrowserNotification);
        }
        notifications = next;
        knownCloudIds = nextIds;
        initialCloudLoad = false;
        render();
      }, error => {
        console.error('Falha ao carregar notificações', error);
        render();
      });
  }

  function installStyles() {
    if ($('#arenaNotificationStyles')) return;
    const style = document.createElement('style');
    style.id = 'arenaNotificationStyles';
    style.textContent = `
      .arena-notification-button{position:relative;display:grid!important;place-items:center!important;flex:0 0 auto}.arena-notification-button>span{font-size:17px}.arena-notification-button.has-unread>span{animation:arenaBell 2.8s ease-in-out infinite}.arena-notification-button b{position:absolute;right:-4px;top:-5px;display:grid;place-items:center;min-width:18px;height:18px;padding:0 4px;border:2px solid #07100c;border-radius:999px;color:#fff;background:var(--red);font-size:8px;line-height:1}.arena-notification-button b[hidden]{display:none}@keyframes arenaBell{0%,88%,100%{transform:rotate(0)}91%{transform:rotate(13deg)}94%{transform:rotate(-11deg)}97%{transform:rotate(7deg)}}
      .arena-notification-backdrop{display:none;position:fixed;inset:0;z-index:65000;background:rgba(0,0,0,.66);backdrop-filter:blur(7px)}.arena-notification-backdrop.show{display:block}.arena-notification-panel{position:absolute;right:12px;top:12px;bottom:12px;display:grid;grid-template-rows:auto auto minmax(0,1fr) auto;width:min(430px,calc(100% - 24px));overflow:hidden;border:1px solid var(--line-strong);border-radius:25px;color:var(--text);background:linear-gradient(160deg,#12281c,#07100c 66%);box-shadow:0 30px 80px rgba(0,0,0,.58)}.arena-notification-panel>header{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:18px;border-bottom:1px solid var(--line)}.arena-notification-panel h2{margin:4px 0 0;font-size:30px;text-transform:uppercase}.arena-notification-close,.arena-notification-editor header button{width:40px;height:40px;padding:0;border:1px solid var(--line);border-radius:12px;color:var(--text);background:rgba(255,255,255,.05);font-size:25px}.arena-notification-tabs{display:grid;grid-template-columns:1fr 1fr;gap:6px;padding:10px 12px;border-bottom:1px solid var(--line)}.arena-notification-tabs button{min-height:37px;border:1px solid transparent;border-radius:11px;color:var(--muted);background:transparent;font-size:9px;font-weight:900;text-transform:uppercase}.arena-notification-tabs button.active{color:#171107;border-color:var(--gold);background:linear-gradient(135deg,var(--gold-soft),var(--gold))}.arena-notification-list{overflow:auto;padding:10px 12px;overscroll-behavior:contain}.arena-notification-card{position:relative;margin-bottom:8px;border:1px solid var(--line);border-radius:17px;background:rgba(255,255,255,.035)}.arena-notification-card.unread{border-color:rgba(242,215,125,.36);background:rgba(216,178,72,.075)}.arena-notification-card.priority-urgent{border-color:rgba(255,105,120,.48)}.arena-notification-main{display:grid;grid-template-columns:43px minmax(0,1fr) 9px;align-items:start;gap:9px;width:100%;padding:12px;border:0;color:var(--text);background:transparent;text-align:left}.arena-notification-icon{display:grid;place-items:center;width:43px;height:43px;border:1px solid var(--line);border-radius:13px;background:rgba(255,255,255,.045);font-size:20px}.arena-notification-copy{min-width:0}.arena-notification-copy small,.arena-notification-copy b,.arena-notification-copy p,.arena-notification-copy em{display:block}.arena-notification-copy small{color:var(--gold-soft);font-size:7px;font-weight:900;letter-spacing:.09em;text-transform:uppercase}.arena-notification-copy b{margin-top:5px;font-size:11px}.arena-notification-copy p{margin:5px 0 0;color:#c8d5cc;font-size:9px;line-height:1.5}.arena-notification-copy em{margin-top:7px;color:var(--gold-soft);font-size:8px;font-style:normal;font-weight:900}.arena-notification-main>i{width:7px;height:7px;margin-top:7px;border-radius:50%;background:var(--gold-soft);box-shadow:0 0 0 4px rgba(242,215,125,.11)}.arena-notification-delete{position:absolute;right:9px;bottom:7px;padding:3px 5px;border:0;color:#ff9aa4;background:transparent;font-size:7px;font-weight:900;text-transform:uppercase}.arena-notification-panel>footer{display:flex;flex-wrap:wrap;gap:7px;padding:11px 12px;border-top:1px solid var(--line)}.arena-notification-panel>footer button{min-height:38px;padding:0 11px;font-size:8px}.arena-notification-panel>footer [data-notification-create]{margin-left:auto}.arena-notification-empty{display:grid;place-items:center;gap:6px;min-height:240px;padding:24px;color:var(--muted);text-align:center}.arena-notification-empty span{font-size:36px}.arena-notification-empty b{color:var(--text);font-size:14px}.arena-notification-empty p{max-width:260px;margin:0;font-size:9px;line-height:1.5}
      .arena-notification-editor-backdrop{position:fixed;inset:0;z-index:66000;display:grid;place-items:center;padding:14px;background:rgba(0,0,0,.78);backdrop-filter:blur(8px)}.arena-notification-editor{width:min(590px,100%);max-height:92vh;overflow:auto;padding:18px;border:1px solid var(--line-strong);border-radius:24px;color:var(--text);background:#101d16;box-shadow:0 28px 80px rgba(0,0,0,.62)}.arena-notification-editor>header{display:flex;align-items:center;justify-content:space-between;gap:12px;padding-bottom:13px;border-bottom:1px solid var(--line)}.arena-notification-editor h2{margin:4px 0 0;font-size:29px;text-transform:uppercase}.arena-notification-editor form{display:grid;gap:11px;margin-top:13px}.arena-notification-editor textarea{resize:vertical}.arena-notification-editor form>footer{display:flex;justify-content:flex-end;gap:8px;padding-top:12px;border-top:1px solid var(--line)}
      @media(max-width:600px){.arena-notification-panel{left:8px;right:8px;top:auto;bottom:8px;width:auto;max-height:86vh;border-radius:24px}.arena-notification-panel>footer{display:grid;grid-template-columns:1fr 1fr}.arena-notification-panel>footer [data-notification-create]{grid-column:1/-1;margin-left:0}.arena-notification-copy p{font-size:10px}.arena-notification-editor form>footer{display:grid}.arena-notification-editor form>footer button{width:100%}}
      @media(prefers-reduced-motion:reduce){.arena-notification-button.has-unread>span{animation:none}}
    `;
    document.head.append(style);
  }

  function init() {
    installStyles();
    ensureInterface();
    window.ArenaBDAAuth?.subscribe?.(state => {
      currentUser = state.user;
      render();
    });
    connectCloud();
  }

  window.ArenaBDANotifications = Object.freeze({
    open: openPanel,
    close: closePanel,
    refresh: render,
    unread: unreadCount,
    markAllRead,
    requestBrowserPermission
  });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();