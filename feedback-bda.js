(() => {
  'use strict';

  const page = document.querySelector('[data-page="feedback"]');
  if (!page) return;

  const $ = (selector, root = document) => root.querySelector(selector);
  const esc = value => String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
  const notify = message => typeof toast === 'function' ? toast(message) : console.info(message);
  const categories = Object.freeze({
    design: 'Design e navegação',
    performance: 'Velocidade ou lag',
    tournaments: 'Campeonatos e placares',
    community: 'Comunidade',
    bug: 'Erro no site',
    idea: 'Nova ideia'
  });
  const statuses = Object.freeze({
    new: ['Novo', '●'],
    reviewing: ['Em análise', '◔'],
    resolved: ['Resolvido', '✓']
  });

  let auth = null;
  let db = null;
  let user = null;
  let admin = false;
  let connected = false;
  let connectionError = '';
  let feedback = [];
  let rating = 5;
  let authUnsubscribe = null;
  let feedbackUnsubscribe = null;

  function serverTime() {
    return window.firebase?.firestore?.FieldValue?.serverTimestamp?.() || new Date();
  }

  function timeValue(value, fallback = 0) {
    if (value?.toDate) return value.toDate().getTime();
    if (value instanceof Date) return value.getTime();
    return Number(value) || fallback;
  }

  function dateLabel(item) {
    const time = timeValue(item.createdAt, item.createdAtClient);
    return time ? new Date(time).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Agora';
  }

  function stars(value, interactive = false) {
    return `<div class="feedback-stars ${interactive ? 'interactive' : ''}" ${interactive ? 'role="radiogroup" aria-label="Nota do feedback"' : `aria-label="Nota ${value} de 5"`}>${[1, 2, 3, 4, 5].map(number => interactive
      ? `<button type="button" class="${number <= value ? 'active' : ''}" data-feedback-rating="${number}" role="radio" aria-checked="${number === value}">★</button>`
      : `<i class="${number <= value ? 'active' : ''}">★</i>`).join('')}</div>`;
  }

  function statusBadge(status) {
    const meta = statuses[status] || statuses.new;
    return `<span class="feedback-status ${esc(status)}"><i>${meta[1]}</i>${meta[0]}</span>`;
  }

  function card(item) {
    return `<article class="feedback-item">
      <header><div><span>${esc(categories[item.category] || 'Feedback')}</span>${stars(Number(item.rating) || 0)}</div>${statusBadge(item.status)}</header>
      <p>${esc(item.message)}</p>
      <footer><span>${admin ? esc(item.authorName || item.authorEmail || 'Membro BDA') : 'Enviado por você'}</span><time>${dateLabel(item)}</time></footer>
      ${admin ? `<div class="feedback-admin-actions" aria-label="Atualizar andamento">${Object.entries(statuses).map(([status, meta]) => `<button type="button" class="${item.status === status ? 'active' : ''}" data-feedback-status="${status}" data-feedback-id="${esc(item.id)}">${meta[0]}</button>`).join('')}</div>` : ''}
    </article>`;
  }

  function form() {
    if (!user) {
      return `<section class="feedback-login"><span>🔐</span><div><b>Entre para enviar seu feedback</b><p>O login evita mensagens falsas e permite acompanhar o andamento da sua sugestão.</p></div><button type="button" class="primary" data-feedback-login>Entrar ou criar conta</button></section>`;
    }
    return `<form class="feedback-form" id="feedbackForm">
      <header><span class="eyebrow">Sua opinião importa</span><h2>Conte o que podemos melhorar</h2><p>A mensagem é privada e pode ser lida somente por você e pela administração.</p></header>
      <div class="feedback-fields">
        <label>Categoria<select id="feedbackCategory" required>${Object.entries(categories).map(([value, label]) => `<option value="${value}">${label}</option>`).join('')}</select></label>
        <fieldset><legend>Sua avaliação</legend>${stars(rating, true)}<input type="hidden" id="feedbackRating" value="${rating}"></fieldset>
        <label class="wide">Mensagem<textarea id="feedbackMessage" minlength="10" maxlength="600" rows="6" placeholder="Explique sua sugestão ou o problema encontrado..." required></textarea><small><span id="feedbackCounter">0</span>/600</small></label>
        <label class="feedback-contact wide"><input id="feedbackContact" type="checkbox"><span>Autorizo a administração a entrar em contato pelo e-mail da minha conta.</span></label>
      </div>
      <footer><small>Enviado como <b>${esc(user.displayName || user.email || 'Membro BDA')}</b></small><button type="submit" class="primary">Enviar feedback</button></footer>
    </form>`;
  }

  function render() {
    const listTitle = admin ? 'Caixa de feedback da administração' : 'Meus feedbacks';
    const listCopy = admin ? `${feedback.length} mensagens recentes dos membros` : 'Acompanhe o andamento do que você enviou';
    page.innerHTML = `<section class="feedback-hero">
      <div><span class="eyebrow">Arena em evolução</span><h1>Feedback</h1><p>Ajude a melhorar o design, o desempenho, os campeonatos e a comunidade BDA.</p><span class="feedback-privacy">🔒 Mensagens privadas</span></div>
      <aside><b>Resposta direta</b><p>Cada feedback entra em uma fila com andamento: novo, em análise e resolvido.</p><span class="${connectionError ? 'error' : ''}">${connectionError || (connected ? '● Sistema online' : '◔ Conectando...')}</span></aside>
    </section>
    <div class="feedback-layout"><section>${form()}</section><aside class="feedback-list"><header><span class="eyebrow">${admin ? 'Painel privado' : 'Histórico'}</span><h2>${listTitle}</h2><p>${listCopy}</p></header><div>${feedback.length ? feedback.map(card).join('') : `<div class="feedback-empty"><span>💬</span><b>Nenhum feedback ainda</b><p>${admin ? 'As mensagens dos membros aparecerão aqui.' : 'Quando você enviar uma mensagem, poderá acompanhar por aqui.'}</p></div>`}</div></aside></div>`;
  }

  function watchFeedback() {
    feedbackUnsubscribe?.();
    feedbackUnsubscribe = null;
    feedback = [];
    if (!user || !db) {
      render();
      return;
    }
    let query = db.collection('siteFeedback');
    query = admin ? query.orderBy('createdAtClient', 'desc').limit(100) : query.where('authorId', '==', user.uid).limit(30);
    feedbackUnsubscribe = query.onSnapshot(snapshot => {
      feedback = snapshot.docs.map(document => ({ id: document.id, ...document.data() }))
        .sort((a, b) => timeValue(b.createdAt, b.createdAtClient) - timeValue(a.createdAt, a.createdAtClient));
      connectionError = '';
      render();
    }, error => {
      console.error(error);
      connectionError = 'Histórico indisponível';
      render();
    });
  }

  async function handleAuth(state) {
    user = state?.user || null;
    admin = Boolean(state?.isAdmin);
    rating = 5;
    watchFeedback();
  }

  async function submitFeedback(event) {
    event.preventDefault();
    if (!user || !db) {
      window.ArenaBDAAuthUI?.open?.('login');
      return;
    }
    const message = $('#feedbackMessage')?.value.trim() || '';
    const category = $('#feedbackCategory')?.value || 'idea';
    const selectedRating = Number($('#feedbackRating')?.value) || rating;
    if (message.length < 10) return notify('Escreva pelo menos 10 caracteres');
    const button = $('#feedbackForm button[type="submit"]');
    button.disabled = true;
    button.textContent = 'Enviando...';
    try {
      const now = Date.now();
      await db.collection('siteFeedback').add({
        authorId: user.uid,
        authorName: String(user.displayName || 'Membro BDA').slice(0, 40),
        authorEmail: String(user.email || '').slice(0, 160),
        category,
        rating: Math.max(1, Math.min(5, selectedRating)),
        message: message.slice(0, 600),
        contactAllowed: Boolean($('#feedbackContact')?.checked),
        status: 'new',
        source: 'arena-bda-feedback',
        createdAtClient: now,
        createdAt: serverTime(),
        updatedAt: serverTime()
      });
      rating = 5;
      notify('Feedback enviado. Obrigado por ajudar!');
      render();
    } catch (error) {
      console.error(error);
      notify('Não foi possível enviar o feedback');
      button.disabled = false;
      button.textContent = 'Enviar feedback';
    }
  }

  async function updateStatus(id, status) {
    if (!admin || !statuses[status] || !id) return;
    try {
      await db.collection('siteFeedback').doc(id).update({ status, updatedAt: serverTime() });
      notify(`Feedback marcado como ${statuses[status][0].toLowerCase()}`);
    } catch (error) {
      console.error(error);
      notify('Não foi possível atualizar o feedback');
    }
  }

  function connect() {
    if (connected) return;
    auth = window.ArenaBDAAuth;
    if (!auth || !window.firebase || typeof firebase.firestore !== 'function') {
      render();
      window.ArenaBDAEnsureCloud?.('feedback');
      return;
    }
    connected = true;
    connectionError = '';
    db = firebase.firestore();
    authUnsubscribe?.();
    authUnsubscribe = auth.subscribe(handleAuth);
    render();
  }

  function installStyles() {
    if ($('#feedbackBdaStyles')) return;
    const style = document.createElement('style');
    style.id = 'feedbackBdaStyles';
    style.textContent = `
      [data-page="feedback"]{display:none;gap:13px;--feedback-blue:#70b7ff;--feedback-mint:#70e1af}[data-page="feedback"].active{display:grid}.feedback-hero{position:relative;overflow:hidden;display:grid;grid-template-columns:minmax(0,1.25fr) minmax(280px,.75fr);gap:24px;align-items:end;min-height:285px;padding:31px;border:1px solid rgba(112,183,255,.25);border-radius:29px;background:radial-gradient(circle at 87% 10%,rgba(112,183,255,.21),transparent 30%),radial-gradient(circle at 5% 95%,rgba(112,225,175,.12),transparent 32%),linear-gradient(140deg,#10291f,#07130f 58%,#050806);box-shadow:0 25px 65px rgba(0,0,0,.38)}.feedback-hero:after{content:"?";position:absolute;right:4%;bottom:-34%;color:rgba(255,255,255,.035);font:900 270px/1 "Barlow Condensed",sans-serif}.feedback-hero>div,.feedback-hero>aside{position:relative;z-index:1}.feedback-hero h1{margin:7px 0 10px;font:900 clamp(58px,10vw,102px)/.8 "Barlow Condensed",sans-serif;letter-spacing:-.035em;text-transform:uppercase}.feedback-hero>div>p{max-width:650px;margin:0;color:#cbdad1;font-size:12px;line-height:1.65}.feedback-privacy{display:inline-flex;margin-top:16px;padding:7px 10px;border:1px solid rgba(112,225,175,.25);border-radius:999px;color:var(--feedback-mint);background:rgba(112,225,175,.06);font-size:7px;font-weight:900;text-transform:uppercase}.feedback-hero>aside{padding:17px;border:1px solid var(--line);border-radius:18px;background:rgba(255,255,255,.045);backdrop-filter:blur(12px)}.feedback-hero>aside b{font-size:12px}.feedback-hero>aside p{margin:7px 0 12px;color:var(--muted);font-size:8px;line-height:1.55}.feedback-hero>aside span{color:var(--feedback-mint);font-size:7px;font-weight:900;text-transform:uppercase}.feedback-hero>aside span.error{color:#ff9fac}
      .feedback-layout{display:grid;grid-template-columns:minmax(0,1.15fr) minmax(300px,.85fr);gap:12px;align-items:start}.feedback-form,.feedback-login,.feedback-list{border:1px solid var(--line);border-radius:21px;background:linear-gradient(150deg,rgba(18,35,25,.97),rgba(5,12,8,.98));box-shadow:0 13px 36px rgba(0,0,0,.22)}.feedback-form{padding:20px}.feedback-form>header h2,.feedback-list>header h2{margin:5px 0 5px;font:900 clamp(28px,4vw,42px)/1 "Barlow Condensed",sans-serif;text-transform:uppercase}.feedback-form>header p,.feedback-list>header p{margin:0;color:var(--muted);font-size:8px;line-height:1.5}.feedback-fields{display:grid;grid-template-columns:1fr 1fr;gap:11px;margin-top:17px}.feedback-fields label,.feedback-fields fieldset{position:relative;display:grid;gap:6px;margin:0;padding:0;border:0;color:var(--muted);font-size:8px;font-weight:850;text-transform:uppercase}.feedback-fields .wide{grid-column:1/-1}.feedback-fields select,.feedback-fields textarea{width:100%;border:1px solid var(--line);border-radius:12px;color:var(--text);background:#07100c;font-size:10px;text-transform:none}.feedback-fields select{height:45px;padding:0 11px}.feedback-fields textarea{padding:12px;line-height:1.55;resize:vertical}.feedback-fields label>small{position:absolute;right:10px;bottom:9px;color:var(--muted);font-size:7px}.feedback-fields fieldset{padding:9px 11px;border:1px solid var(--line);border-radius:12px;background:#07100c}.feedback-fields legend{padding:0;color:var(--muted)}.feedback-stars{display:flex;gap:3px}.feedback-stars button,.feedback-stars i{padding:0;border:0;color:rgba(255,255,255,.16);background:transparent;font-size:19px;font-style:normal;line-height:1}.feedback-stars button.active,.feedback-stars i.active{color:var(--gold-soft);text-shadow:0 0 14px rgba(242,215,125,.2)}.feedback-stars.interactive button{cursor:pointer}.feedback-contact{display:flex!important;grid-template-columns:auto 1fr!important;align-items:center;gap:8px!important;padding:10px 11px!important;border:1px solid var(--line)!important;border-radius:12px;background:rgba(255,255,255,.025)}.feedback-contact input{width:18px;height:18px;accent-color:var(--feedback-mint)}.feedback-contact span{font-size:7px;line-height:1.45;text-transform:none}.feedback-form>footer{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-top:14px}.feedback-form>footer small{color:var(--muted);font-size:7px}.feedback-form>footer b{color:var(--text)}
      .feedback-login{display:grid;grid-template-columns:auto 1fr auto;align-items:center;gap:13px;min-height:180px;padding:21px}.feedback-login>span{font-size:38px}.feedback-login b{font-size:12px}.feedback-login p{margin:6px 0 0;color:var(--muted);font-size:8px;line-height:1.5}.feedback-list{overflow:hidden}.feedback-list>header{padding:18px;border-bottom:1px solid var(--line)}.feedback-list>div{max-height:680px;overflow-y:auto}.feedback-item{padding:13px 15px;border-bottom:1px solid var(--line)}.feedback-item>header{display:flex;align-items:start;justify-content:space-between;gap:10px}.feedback-item>header>div>span{display:block;margin-bottom:5px;color:var(--feedback-blue);font-size:7px;font-weight:900;text-transform:uppercase}.feedback-item .feedback-stars i{font-size:11px}.feedback-status{display:inline-flex;align-items:center;gap:5px;padding:6px 7px;border:1px solid var(--line);border-radius:999px;color:var(--muted);background:rgba(255,255,255,.03);font-size:6px;font-weight:900;text-transform:uppercase;white-space:nowrap}.feedback-status.new{color:#bddcff}.feedback-status.reviewing{color:var(--gold-soft)}.feedback-status.resolved{color:var(--feedback-mint)}.feedback-status i{font-style:normal}.feedback-item>p{margin:11px 0;color:#e4eee7;font-size:9px;line-height:1.55;white-space:pre-wrap}.feedback-item>footer{display:flex;justify-content:space-between;gap:8px;color:var(--muted);font-size:6px}.feedback-admin-actions{display:grid;grid-template-columns:repeat(3,1fr);gap:5px;margin-top:10px}.feedback-admin-actions button{min-height:31px;padding:0 5px;border:1px solid var(--line);border-radius:8px;color:var(--muted);background:rgba(255,255,255,.025);font-size:6px;font-weight:900;text-transform:uppercase}.feedback-admin-actions button.active{color:#07100c;border-color:var(--feedback-mint);background:var(--feedback-mint)}.feedback-empty{display:grid;place-items:center;gap:6px;min-height:250px;padding:25px;color:var(--muted);text-align:center}.feedback-empty>span{font-size:35px}.feedback-empty b{color:var(--text);font-size:10px}.feedback-empty p{max-width:310px;margin:0;font-size:7px;line-height:1.5}
      @media(max-width:900px){.feedback-hero,.feedback-layout{grid-template-columns:1fr}.feedback-list>div{max-height:none}}@media(max-width:600px){[data-page="feedback"]{gap:10px}.feedback-hero{min-height:380px;padding:22px 17px;border-radius:24px}.feedback-hero h1{font-size:65px}.feedback-fields{grid-template-columns:1fr}.feedback-fields .wide{grid-column:auto}.feedback-form{padding:16px}.feedback-form>footer{align-items:stretch;flex-direction:column}.feedback-form>footer button{width:100%}.feedback-login{grid-template-columns:auto 1fr}.feedback-login button{grid-column:1/-1;width:100%}}@media(prefers-reduced-transparency:reduce){.feedback-hero>aside{backdrop-filter:none}}
    `;
    document.head.append(style);
  }

  document.addEventListener('click', event => {
    const ratingButton = event.target.closest('[data-feedback-rating]');
    if (ratingButton) {
      rating = Number(ratingButton.dataset.feedbackRating) || 5;
      $('#feedbackRating').value = String(rating);
      document.querySelectorAll('[data-feedback-rating]').forEach(button => {
        const value = Number(button.dataset.feedbackRating);
        button.classList.toggle('active', value <= rating);
        button.setAttribute('aria-checked', String(value === rating));
      });
      return;
    }
    if (event.target.closest('[data-feedback-login]')) {
      window.ArenaBDAAuthUI?.open?.('login');
      return;
    }
    const statusButton = event.target.closest('[data-feedback-status]');
    if (statusButton) updateStatus(statusButton.dataset.feedbackId, statusButton.dataset.feedbackStatus);
  });

  document.addEventListener('input', event => {
    if (event.target.id === 'feedbackMessage') $('#feedbackCounter').textContent = String(event.target.value.length);
  });
  document.addEventListener('submit', event => {
    if (event.target.id === 'feedbackForm') submitFeedback(event);
  });
  window.addEventListener('arena:cloud-ready', connect);

  installStyles();
  render();
  connect();

  window.ArenaBDAFeedback = Object.freeze({
    refresh: render,
    state: () => ({ connected, userId: user?.uid || '', admin, items: feedback.length })
  });
})();
