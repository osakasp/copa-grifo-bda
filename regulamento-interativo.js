(() => {
  'use strict';

  const TOURNAMENT_KEY = 'bda-v3-tournaments';
  const REGULATION_KEY = 'bda-v4-regulations';
  const auth = window.ArenaBDAAuth;
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const esc = value => String(value ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  const notify = message => typeof toast === 'function' ? toast(message) : console.info(message);
  const clone = value => JSON.parse(JSON.stringify(value));

  let db = null;
  let activeTid = '';
  let sections = [];
  let unsubscribe = null;
  let observer = null;
  let frame = 0;

  function read(key, fallback) {
    try {
      const value = JSON.parse(localStorage.getItem(key));
      return value ?? fallback;
    } catch {
      return fallback;
    }
  }

  function write(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch {
      return false;
    }
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

  function tournaments() {
    const value = read(TOURNAMENT_KEY, []);
    return Array.isArray(value) ? value : [];
  }

  function tournament(tid) {
    return tournaments().find(item => String(item.id) === String(tid)) || null;
  }

  function currentTid() {
    return $('#giManager')?.dataset?.tid || window.ArenaBDAMatchManager?.tournamentId?.() || 'copa-grifo';
  }

  function defaults(tid) {
    const item = tournament(tid) || {};
    const config = item.matchSettings || {};
    const legs = Number(config.knockoutLegs) === 2 ? 'ida e volta' : 'jogo único';
    const finalLegs = Number(config.finalLegs) === 2 ? 'ida e volta' : Number(config.finalLegs) === 1 ? 'jogo único' : `o mesmo padrão do mata-mata (${legs})`;
    return [
      {
        id: 'formato',
        title: 'Formato da competição',
        icon: '🏆',
        content: `${item.name || 'O campeonato'} será disputado no formato ${item.format || 'definido pela organização'}. O limite cadastrado é de ${Number(item.maxTeams) || 0} clubes. Nos confrontos eliminatórios, o padrão atual é ${legs}; a final utiliza ${finalLegs}.`
      },
      {
        id: 'prazos',
        title: 'Prazos e agendamento',
        icon: '⏱️',
        content: `${item.deadline || 'O prazo de cada fase será informado pela administração'}. Os responsáveis pelos clubes devem combinar o horário dentro do período oficial e comunicar qualquer dificuldade antes do encerramento do prazo.`
      },
      {
        id: 'resultado',
        title: 'Resultado e desempate',
        icon: '⚽',
        content: 'O resultado registrado na Arena BDA é considerado oficial após a confirmação da administração. Em mata-mata, um empate pode ser decidido por pênaltis quando aplicável. Em confrontos de ida e volta, a classificação considera o placar agregado.'
      },
      {
        id: 'wo',
        title: 'W.O., atraso e conduta',
        icon: '🛡️',
        content: 'A ausência sem justificativa dentro do prazo pode resultar em W.O. A tolerância recomendada é de 30 minutos, salvo orientação diferente publicada pela organização. Respeito entre os participantes é obrigatório no chat, nas negociações e durante as partidas.'
      },
      {
        id: 'transmissao',
        title: 'Placar e transmissão',
        icon: '📡',
        content: 'A Central do Jogo utiliza os resultados e eventos registrados pela administração. Quando não houver integração externa com o aplicativo de placar, posse, chutes, cartões e lances serão atualizados manualmente. O placar oficial continua sendo o valor salvo no confronto.'
      }
    ];
  }

  function localSections(tid) {
    const store = read(REGULATION_KEY, {});
    const value = store[tid];
    return Array.isArray(value) && value.length ? value : defaults(tid);
  }

  function saveLocal(tid, value) {
    const store = read(REGULATION_KEY, {});
    store[tid] = value;
    write(REGULATION_KEY, store);
  }

  function documentId(tid) {
    return `regulation-${String(tid || 'campeonato').replace(/[^a-zA-Z0-9_-]+/g, '-').slice(0, 90)}`;
  }

  function ensureModal() {
    if ($('#regulationModal')) return;
    const modal = document.createElement('div');
    modal.id = 'regulationModal';
    modal.className = 'modal-backdrop regulation-backdrop';
    modal.innerHTML = '<section class="modal regulation-dialog" id="regulationContent"></section>';
    modal.addEventListener('click', event => { if (event.target === modal) close(); });
    document.body.append(modal);

    const editor = document.createElement('div');
    editor.id = 'regulationEditorModal';
    editor.className = 'modal-backdrop regulation-backdrop';
    editor.innerHTML = '<section class="modal regulation-editor"><button type="button" class="regulation-close" data-regulation-editor-close>×</button><header><span class="eyebrow">Administração</span><h2>Editar regulamento</h2><p>Organize as regras em seções curtas e fáceis de consultar.</p></header><form id="regulationForm"><div id="regulationFields"></div><div class="regulation-editor-actions"><button type="button" class="secondary" data-regulation-add-section>+ Adicionar seção</button><button type="submit" class="primary">Salvar regulamento</button></div></form></section>';
    editor.addEventListener('click', event => { if (event.target === editor) closeEditor(); });
    document.body.append(editor);
  }

  function ensureButton() {
    const manager = $('#giManager');
    const head = $('#giManager .gi-head');
    if (!manager || !head) return;
    let tools = $('#giExperienceTools', manager);
    if (!tools) {
      tools = document.createElement('div');
      tools.id = 'giExperienceTools';
      tools.className = 'mc-tools regulation-tools';
      head.after(tools);
    }
    if (!tools.querySelector('[data-regulation-open]')) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'secondary';
      button.dataset.regulationOpen = 'true';
      button.textContent = '📜 Regulamento';
      tools.append(button);
    }
  }

  function schedule() {
    if (frame) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      ensureModal();
      ensureButton();
    });
  }

  function render() {
    const item = tournament(activeTid) || {};
    const root = $('#regulationContent');
    if (!root) return;
    root.innerHTML = `<button type="button" class="regulation-close" data-regulation-close>×</button>
      <header class="regulation-head"><span class="eyebrow">Regras oficiais</span><h2>Regulamento</h2><p>${esc(item.name || 'Campeonato BDA')} • ${esc(item.edition || item.phase || 'Edição atual')}</p></header>
      <div class="regulation-summary"><article><span>Formato</span><b>${esc(item.format || 'A definir')}</b></article><article><span>Clubes</span><b>${Number(item.maxTeams) || 0}</b></article><article><span>Fase atual</span><b>${esc(item.phase || 'Preparação')}</b></article></div>
      <div class="regulation-accordion">${sections.map((section, index) => `<details ${index === 0 ? 'open' : ''}><summary><i>${esc(section.icon || '📌')}</i><span>${esc(section.title || `Regra ${index + 1}`)}</span><em>+</em></summary><div>${String(section.content || '').split(/\n{2,}/).map(paragraph => `<p>${esc(paragraph).replace(/\n/g, '<br>')}</p>`).join('')}</div></details>`).join('')}</div>
      ${isAdmin() ? '<footer><button type="button" class="ghost" data-regulation-edit>✎ Editar regulamento</button></footer>' : ''}`;
  }

  async function open(tid = currentTid()) {
    activeTid = tid;
    sections = localSections(tid);
    ensureModal();
    render();
    $('#regulationModal').classList.add('show');
    document.body.classList.add('regulation-open');
    listen();
  }

  function close() {
    unsubscribe?.(); unsubscribe = null;
    $('#regulationModal')?.classList.remove('show');
    document.body.classList.remove('regulation-open');
  }

  function field(section, index) {
    return `<article class="regulation-field" data-regulation-field="${index}"><div><label>Ícone<input name="icon" maxlength="4" value="${esc(section.icon || '📌')}"></label><label>Título<input name="title" maxlength="80" required value="${esc(section.title || '')}"></label><button type="button" class="danger" data-regulation-remove="${index}">Excluir</button></div><label>Conteúdo<textarea name="content" maxlength="1600" required>${esc(section.content || '')}</textarea></label></article>`;
  }

  function renderEditorFields() {
    $('#regulationFields').innerHTML = sections.map(field).join('');
  }

  function openEditor() {
    if (!isAdmin()) return;
    renderEditorFields();
    $('#regulationEditorModal').classList.add('show');
  }

  function closeEditor() {
    $('#regulationEditorModal')?.classList.remove('show');
  }

  function collectEditor() {
    return $$('.regulation-field').map((article, index) => ({
      id: sections[index]?.id || `secao-${Date.now().toString(36)}-${index}`,
      icon: $('[name="icon"]', article)?.value.trim() || '📌',
      title: $('[name="title"]', article)?.value.trim() || `Regra ${index + 1}`,
      content: $('[name="content"]', article)?.value.trim() || ''
    })).filter(section => section.content);
  }

  async function save(event) {
    event.preventDefault();
    if (!isAdmin() || !activeTid) return;
    sections = collectEditor();
    if (!sections.length) {
      notify('Adicione pelo menos uma regra');
      return;
    }
    saveLocal(activeTid, sections);
    render();
    closeEditor();
    if (!db) {
      notify('Regulamento salvo neste aparelho');
      return;
    }
    try {
      await db.collection('arenaData').doc(documentId(activeTid)).set({
        dataset: 'regulation',
        tournamentId: activeTid,
        sections: clone(sections),
        updatedAtClient: Date.now(),
        updatedBy: currentEmail(),
        serverUpdatedAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      notify('Regulamento publicado');
    } catch (error) {
      console.error(error);
      notify('Regulamento salvo no aparelho; a nuvem não respondeu');
    }
  }

  function listen() {
    unsubscribe?.(); unsubscribe = null;
    if (!db || !activeTid) return;
    unsubscribe = db.collection('arenaData').doc(documentId(activeTid)).onSnapshot(snapshot => {
      const remote = snapshot.data()?.sections;
      if (!Array.isArray(remote) || !remote.length) return;
      sections = remote;
      saveLocal(activeTid, sections);
      render();
    }, error => console.warn('Regulamento em modo local', error));
  }

  function installEvents() {
    document.addEventListener('click', event => {
      if (!(event.target instanceof Element)) return;
      if (event.target.closest('[data-regulation-open]')) { open(); return; }
      if (event.target.closest('[data-regulation-close]')) { close(); return; }
      if (event.target.closest('[data-regulation-edit]')) { openEditor(); return; }
      if (event.target.closest('[data-regulation-editor-close]')) { closeEditor(); return; }
      if (event.target.closest('[data-regulation-add-section]')) {
        sections.push({ id: `secao-${Date.now().toString(36)}`, icon: '📌', title: 'Nova regra', content: '' });
        renderEditorFields();
        return;
      }
      const remove = event.target.closest('[data-regulation-remove]');
      if (remove) {
        sections.splice(Number(remove.dataset.regulationRemove), 1);
        renderEditorFields();
      }
    });
    document.addEventListener('submit', event => {
      if (event.target.id === 'regulationForm') save(event);
    });
    document.addEventListener('keydown', event => {
      if (event.key !== 'Escape') return;
      if ($('#regulationEditorModal')?.classList.contains('show')) closeEditor();
      else if ($('#regulationModal')?.classList.contains('show')) close();
    });
  }

  function installStyles() {
    if ($('#regulationInteractiveStyles')) return;
    const style = document.createElement('style');
    style.id = 'regulationInteractiveStyles';
    style.textContent = `
      .regulation-backdrop{z-index:96000;place-items:center}.regulation-dialog,.regulation-editor{position:relative;width:min(100%,820px);max-height:calc(100dvh - 24px);overflow:auto;padding:22px}body.regulation-open{overflow:hidden}.regulation-close{position:absolute;right:13px;top:13px;width:42px;height:42px;padding:0;border:1px solid var(--line);border-radius:13px;color:#fff;background:rgba(3,8,6,.82);font-size:24px}.regulation-head{padding-right:50px}.regulation-head h2,.regulation-editor h2{margin:5px 0;font-size:clamp(38px,8vw,58px);line-height:.9;text-transform:uppercase}.regulation-head p,.regulation-editor header p{margin:0;color:var(--muted);font-size:10px}
      .regulation-summary{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin:16px 0}.regulation-summary article{padding:12px;border:1px solid var(--line);border-radius:13px;background:rgba(255,255,255,.025)}.regulation-summary span,.regulation-summary b{display:block}.regulation-summary span{color:var(--muted);font-size:7px;text-transform:uppercase}.regulation-summary b{margin-top:5px;color:var(--gold-soft);font-size:12px;text-transform:uppercase}
      .regulation-accordion{display:grid;gap:9px}.regulation-accordion details{overflow:hidden;border:1px solid var(--line);border-radius:15px;background:linear-gradient(150deg,var(--surface-2),var(--surface))}.regulation-accordion summary{display:grid;grid-template-columns:40px 1fr auto;align-items:center;gap:10px;min-height:62px;padding:9px 13px;cursor:pointer;list-style:none}.regulation-accordion summary::-webkit-details-marker{display:none}.regulation-accordion summary i{display:grid;place-items:center;width:40px;height:40px;border:1px solid rgba(216,178,72,.25);border-radius:12px;background:rgba(216,178,72,.08);font-style:normal;font-size:19px}.regulation-accordion summary span{font-size:11px;font-weight:900;text-transform:uppercase}.regulation-accordion summary em{color:var(--gold-soft);font-size:22px;font-style:normal;transition:transform .2s}.regulation-accordion details[open] summary em{transform:rotate(45deg)}.regulation-accordion details>div{padding:0 16px 15px;border-top:1px solid var(--line)}.regulation-accordion p{margin:14px 0 0;color:#d4ddd7;font-size:11px;line-height:1.75}.regulation-dialog>footer{display:flex;justify-content:flex-end;margin-top:14px}
      #regulationFields{display:grid;gap:10px;margin-top:16px}.regulation-field{padding:13px;border:1px solid var(--line);border-radius:15px;background:rgba(255,255,255,.025)}.regulation-field>div{display:grid;grid-template-columns:80px 1fr auto;gap:8px;align-items:end}.regulation-field textarea{min-height:120px}.regulation-field .danger{min-height:43px}.regulation-editor-actions{position:sticky;bottom:-22px;display:flex;justify-content:space-between;gap:8px;margin:16px -22px -22px;padding:13px 22px calc(13px + env(safe-area-inset-bottom));border-top:1px solid var(--line);background:rgba(16,29,22,.97)}
      @media(max-width:560px){.regulation-dialog,.regulation-editor{padding:17px}.regulation-summary{grid-template-columns:1fr}.regulation-field>div{grid-template-columns:70px 1fr}.regulation-field .danger{grid-column:1/-1}.regulation-editor-actions{display:grid;margin-inline:-17px;padding-inline:17px}.regulation-editor-actions button{width:100%}}
    `;
    document.head.append(style);
  }

  function init() {
    db = window.firebase && typeof firebase.firestore === 'function' ? firebase.firestore() : null;
    installStyles();
    ensureModal();
    installEvents();
    const root = $('#arenaDetail') || $('[data-page="tournament"]') || document.body;
    observer = new MutationObserver(schedule);
    observer.observe(root, { childList: true, subtree: true });
    auth?.subscribe?.(() => { schedule(); if ($('#regulationModal')?.classList.contains('show')) render(); });
    schedule();
  }

  window.ArenaBDARegulation = Object.freeze({ open, close, refresh: schedule });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();