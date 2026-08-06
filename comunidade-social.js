(() => {
  'use strict';

  const page = document.querySelector('[data-page="community"]');
  if (!page) return;

  const POST_LIMIT = 24;
  const MESSAGE_LIMIT = 100;
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const esc = value => String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
  const norm = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
  const notify = message => typeof toast === 'function' ? toast(message) : console.info(message);

  let auth = null;
  let db = null;
  let user = null;
  let ownProfile = null;
  let members = [];
  let posts = [];
  let threads = [];
  let messages = [];
  let following = new Set();
  let postMeta = new Map();
  let activeView = 'feed';
  let selectedProfileId = '';
  let activeThreadId = '';
  let postDraft = '';
  let postImage = '';
  let avatarDraft = '';
  const messageDrafts = new Map();
  let connected = false;
  let connectionError = '';
  let authUnsubscribe = null;
  let membersUnsubscribe = null;
  let postsUnsubscribe = null;
  let followingUnsubscribe = null;
  let threadsUnsubscribe = null;
  let messagesUnsubscribe = null;

  function serverTime() {
    return window.firebase?.firestore?.FieldValue?.serverTimestamp?.() || new Date();
  }

  function member(id) {
    return members.find(item => item.id === id) || (ownProfile?.id === id ? ownProfile : null);
  }

  function displayName(id, fallback = 'Membro BDA') {
    return member(id)?.displayName || fallback;
  }

  function initials(name) {
    return String(name || 'BDA').split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join('').toUpperCase();
  }

  function avatar(profile, className = '') {
    const name = profile?.displayName || 'Membro BDA';
    const content = profile?.avatar
      ? `<img src="${esc(profile.avatar)}" alt="Foto de ${esc(name)}" width="48" height="48" decoding="async">`
      : `<span>${esc(initials(name))}</span>`;
    return `<span class="social-avatar ${className}">${content}</span>`;
  }

  function fallbackProfile(currentUser) {
    return {
      id: currentUser.uid,
      uid: currentUser.uid,
      displayName: String(currentUser.displayName || currentUser.email?.split('@')[0] || 'Membro BDA').slice(0, 40),
      team: '',
      bio: '',
      avatar: '',
      role: auth?.isAdmin?.() ? 'admin' : 'member',
      status: 'active'
    };
  }

  function dateValue(value, fallback = 0) {
    if (value?.toDate) return value.toDate().getTime();
    if (value instanceof Date) return value.getTime();
    return Number(value) || fallback;
  }

  function relativeTime(value, fallback = 0) {
    const time = dateValue(value, fallback);
    if (!time) return 'agora';
    const seconds = Math.max(0, Math.round((Date.now() - time) / 1000));
    if (seconds < 60) return 'agora';
    if (seconds < 3600) return `${Math.floor(seconds / 60)} min`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)} h`;
    if (seconds < 604800) return `${Math.floor(seconds / 86400)} d`;
    return new Date(time).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
  }

  function openLogin(mode = 'login') {
    window.ArenaBDAAuthUI?.open?.(mode);
  }

  function setView(view) {
    if (view === 'messages' && !user) {
      openLogin('login');
      return;
    }
    activeView = ['feed', 'members', 'messages', 'profile'].includes(view) ? view : 'feed';
    if (activeView === 'profile' && !selectedProfileId) selectedProfileId = user?.uid || members[0]?.id || '';
    renderActive();
  }

  function shell() {
    const account = user ? (ownProfile || member(user.uid) || { displayName: user.displayName || 'Membro BDA' }) : null;
    page.innerHTML = `<section class="social-hero">
      <div><span class="eyebrow">Rede oficial do Clã BDA</span><h1>Comunidade</h1><p>Perfis, publicações, futebol e conversas em um espaço exclusivo para os membros.</p><div class="social-connection ${connectionError ? 'error' : ''}"><i></i>${esc(connectionError || (connected ? 'Comunidade online' : 'Preparando conexão...'))}</div></div>
      <aside>${user ? `${avatar(account, 'large')}<div><b>${esc(account.displayName || 'Membro BDA')}</b><span>${esc(account.team || 'Time não informado')}</span></div><button type="button" data-social-own-profile>Meu perfil</button>` : `<span>⚽</span><div><b>Faça parte da comunidade</b><small>Crie sua conta gratuita com e-mail e senha.</small></div><button type="button" class="primary" data-social-login>Criar conta</button>`}</aside>
    </section>
    <nav class="social-nav" aria-label="Navegação da comunidade">
      <button type="button" data-social-view="feed"><i>▦</i><span>Feed</span></button>
      <button type="button" data-social-view="members"><i>♟</i><span>Membros</span></button>
      <button type="button" data-social-view="messages"><i>✉</i><span>Mensagens</span></button>
      <button type="button" data-social-view="profile"><i>●</i><span>${user ? 'Meu perfil' : 'Perfis'}</span></button>
    </nav>
    <div id="socialContent" class="social-content"></div>`;
    renderActive();
  }

  function syncNav() {
    $$('.social-nav [data-social-view]').forEach(button => button.classList.toggle('active', button.dataset.socialView === activeView));
  }

  function composer() {
    if (!user) {
      return `<article class="social-login-card"><span>⚽</span><div><b>Entre para participar</b><p>Publique novidades, curta resultados e converse com outros membros.</p></div><button type="button" class="primary" data-social-login>Entrar ou criar conta</button></article>`;
    }
    const profile = ownProfile || member(user.uid) || { displayName: user.displayName || 'Membro BDA' };
    return `<form class="social-composer" id="socialPostForm">
      <header>${avatar(profile)}<div><b>${esc(profile.displayName)}</b><span>Compartilhe com o Clã BDA</span></div></header>
      <textarea id="socialPostText" maxlength="500" rows="3" placeholder="No que você está pensando?">${esc(postDraft)}</textarea>
      <div class="social-post-preview" id="socialPostPreview" ${postImage ? '' : 'hidden'}>${postImage ? `<img src="${esc(postImage)}" alt="Prévia da publicação"><button type="button" data-social-remove-post-image>×</button>` : ''}</div>
      <footer><label><input id="socialPostImage" type="file" accept="image/png,image/jpeg,image/webp" hidden><span>▧ Foto</span></label><small>Imagens são comprimidas automaticamente</small><button type="submit" class="primary">Publicar</button></footer>
    </form>`;
  }

  function commentHtml(comment) {
    const author = member(comment.authorId) || { displayName: comment.authorName || 'Membro BDA', avatar: comment.authorAvatar || '' };
    const canDelete = user && (user.uid === comment.authorId || auth?.isAdmin?.());
    return `<article class="social-comment">${avatar(author, 'small')}<div><header><b>${esc(author.displayName)}</b><time>${relativeTime(comment.createdAt, comment.createdAtClient)}</time></header><p>${esc(comment.text)}</p></div>${canDelete ? `<button type="button" data-social-delete-comment="${esc(comment.id)}" aria-label="Excluir comentário">×</button>` : ''}</article>`;
  }

  function postHtml(post) {
    const author = member(post.authorId) || { displayName: post.authorName || 'Membro BDA', avatar: post.authorAvatar || '', team: post.authorTeam || '' };
    const meta = postMeta.get(post.id) || { likes: 0, liked: false, comments: [] };
    const canDelete = user && (user.uid === post.authorId || auth?.isAdmin?.());
    return `<article class="social-post" data-social-post="${esc(post.id)}">
      <header><button type="button" data-social-profile="${esc(post.authorId)}">${avatar(author)}<span><b>${esc(author.displayName)}</b><small>${esc(author.team || 'Clã BDA')} • ${relativeTime(post.createdAt, post.createdAtClient)}</small></span></button>${canDelete ? `<button type="button" class="social-post-menu" data-social-delete-post="${esc(post.id)}" aria-label="Excluir publicação">•••</button>` : ''}</header>
      ${post.text ? `<p class="social-post-text">${esc(post.text)}</p>` : ''}
      ${post.image ? `<img class="social-post-image" src="${esc(post.image)}" alt="Imagem publicada por ${esc(author.displayName)}" loading="lazy" decoding="async">` : ''}
      <div class="social-post-stats"><span>${meta.likes} ${meta.likes === 1 ? 'curtida' : 'curtidas'}</span><span>${meta.comments.length} ${meta.comments.length === 1 ? 'comentário' : 'comentários recentes'}</span></div>
      <div class="social-post-actions"><button type="button" class="${meta.liked ? 'active' : ''}" data-social-like="${esc(post.id)}"><i>♥</i>${meta.liked ? 'Curtido' : 'Curtir'}</button><button type="button" data-social-focus-comment="${esc(post.id)}"><i>▤</i>Comentar</button><button type="button" data-social-profile="${esc(post.authorId)}"><i>●</i>Perfil</button></div>
      <section class="social-comments" data-social-comments="${esc(post.id)}">${meta.comments.slice(-3).map(commentHtml).join('')}</section>
      ${user ? `<form class="social-comment-form" data-social-comment-form="${esc(post.id)}">${avatar(ownProfile || member(user.uid), 'small')}<input maxlength="220" placeholder="Escreva um comentário..." required><button type="submit" aria-label="Enviar comentário">➤</button></form>` : ''}
    </article>`;
  }

  function memberCard(profile) {
    const own = user?.uid === profile.id;
    const isFollowing = following.has(profile.id);
    return `<article class="social-member-card">
      <button type="button" class="social-member-main" data-social-profile="${esc(profile.id)}">${avatar(profile, 'member')}<span><b>${esc(profile.displayName || 'Membro BDA')}</b><small>${esc(profile.team || 'Time não informado')}</small><p>${esc(profile.bio || 'Membro da Comunidade BDA.')}</p></span></button>
      <footer>${own ? '<button type="button" data-social-edit-profile>Editar perfil</button>' : `${user ? `<button type="button" class="${isFollowing ? 'following' : ''}" data-social-follow="${esc(profile.id)}">${isFollowing ? 'Seguindo' : 'Seguir'}</button><button type="button" data-social-message="${esc(profile.id)}">Mensagem</button>` : `<button type="button" data-social-login>Entrar para seguir</button>`}`}</footer>
    </article>`;
  }

  function suggestions() {
    const list = members.filter(item => item.id !== user?.uid && !following.has(item.id)).slice(0, 5);
    return `<aside class="social-suggestions"><header><b>Membros para conhecer</b><button type="button" data-social-view="members">Ver todos</button></header>${list.length ? list.map(profile => `<div>${avatar(profile, 'small')}<button type="button" data-social-profile="${esc(profile.id)}"><b>${esc(profile.displayName)}</b><span>${esc(profile.team || 'Clã BDA')}</span></button>${user ? `<button type="button" data-social-follow="${esc(profile.id)}">Seguir</button>` : ''}</div>`).join('') : '<p>Os novos membros aparecerão aqui.</p>'}</aside>`;
  }

  function renderFeed() {
    const content = $('#socialContent');
    if (!content) return;
    content.innerHTML = `<div class="social-feed-layout"><section class="social-feed">${composer()}<div id="socialPostList">${posts.length ? posts.map(postHtml).join('') : '<div class="social-empty"><span>▦</span><b>O feed está começando</b><p>Seja o primeiro membro a publicar.</p></div>'}</div></section>${suggestions()}</div>`;
  }

  function renderMembers() {
    const content = $('#socialContent');
    if (!content) return;
    content.innerHTML = `<section class="social-members-page"><header><div><span class="eyebrow">Pessoas do clã</span><h2>Membros da comunidade</h2><p>${members.length} perfis cadastrados</p></div><input id="socialMemberSearch" type="search" placeholder="Buscar membro ou time"></header><div class="social-members-grid" id="socialMembersGrid">${members.length ? members.map(memberCard).join('') : '<div class="social-empty"><b>Nenhum perfil disponível</b></div>'}</div></section>`;
  }

  function profilePosts(id) {
    return posts.filter(post => post.authorId === id);
  }

  function renderProfile() {
    const content = $('#socialContent');
    if (!content) return;
    const id = selectedProfileId || user?.uid || members[0]?.id;
    const profile = member(id);
    if (!profile) {
      const ownProfileMissing = Boolean(user && id === user.uid);
      content.innerHTML = ownProfileMissing
        ? `<div class="social-empty"><b>Perfil não encontrado</b><p>Sua conta continua conectada, mas os dados do perfil não carregaram.</p><button type="button" class="primary" data-social-logout>Sair da conta</button></div>`
        : `<div class="social-empty"><b>Perfil não encontrado</b><button type="button" data-social-view="members">Ver membros</button></div>`;
      return;
    }
    const own = user?.uid === profile.id;
    const isFollowing = following.has(profile.id);
    const memberPosts = profilePosts(profile.id);
    content.innerHTML = `<section class="social-profile-page">
      <header class="social-profile-cover"><div>${avatar(profile, 'profile')}<span><b>${esc(profile.displayName)}</b><small>${esc(profile.team || 'Time não informado')}</small></span></div><p>${esc(profile.bio || 'Membro da Comunidade BDA.')}</p><section><span><b>${memberPosts.length}</b> publicações</span>${own ? `<span><b>${following.size}</b> seguindo</span>` : ''}</section><footer>${own ? '<button type="button" class="primary" data-social-edit-profile>Editar perfil</button><button type="button" data-social-logout>Sair da conta</button>' : `${user ? `<button type="button" class="primary ${isFollowing ? 'following' : ''}" data-social-follow="${esc(profile.id)}">${isFollowing ? 'Seguindo' : 'Seguir'}</button><button type="button" data-social-message="${esc(profile.id)}">Enviar mensagem</button>` : '<button type="button" class="primary" data-social-login>Entrar para interagir</button>'}`}</footer></header>
      <div class="social-profile-posts"><header><span class="eyebrow">Publicações</span><h2>Feed de ${esc(profile.displayName.split(/\s+/)[0])}</h2></header>${memberPosts.length ? memberPosts.map(postHtml).join('') : '<div class="social-empty"><b>Nenhuma publicação ainda</b></div>'}</div>
    </section>`;
  }

  function otherParticipant(thread) {
    return thread.participants?.find(id => id !== user?.uid) || user?.uid || '';
  }

  function threadHtml(thread) {
    const contact = member(otherParticipant(thread)) || { displayName: 'Membro BDA' };
    return `<button type="button" class="social-thread ${thread.id === activeThreadId ? 'active' : ''}" data-social-thread="${esc(thread.id)}">${avatar(contact)}<span><b>${esc(contact.displayName)}</b><small>${esc(thread.lastText || 'Conversa iniciada')}</small></span><time>${relativeTime(thread.updatedAt, thread.updatedAtClient)}</time></button>`;
  }

  function renderConversation() {
    if (!activeThreadId) return '<div class="social-empty social-conversation-empty"><span>✉</span><b>Escolha uma conversa</b><p>Ou abra o perfil de um membro para enviar uma mensagem.</p></div>';
    const thread = threads.find(item => item.id === activeThreadId);
    const contact = member(otherParticipant(thread || { participants: activeThreadId.split('__') })) || { displayName: 'Membro BDA' };
    return `<section class="social-conversation"><header>${avatar(contact)}<button type="button" data-social-profile="${esc(contact.id || '')}"><b>${esc(contact.displayName)}</b><span>${esc(contact.team || 'Clã BDA')}</span></button></header><div class="social-message-list" id="socialMessageList">${messages.length ? messages.map(message => `<article class="social-message ${message.senderId === user?.uid ? 'mine' : ''}"><p>${esc(message.text)}</p><time>${relativeTime(message.createdAt, message.createdAtClient)}</time></article>`).join('') : '<div class="social-empty compact"><b>Envie a primeira mensagem</b></div>'}</div><form id="socialMessageForm"><input id="socialMessageInput" maxlength="500" value="${esc(messageDrafts.get(activeThreadId) || '')}" placeholder="Escreva uma mensagem..." required autocomplete="off"><button type="submit" class="primary" aria-label="Enviar mensagem">➤</button></form></section>`;
  }

  function renderMessages() {
    const content = $('#socialContent');
    if (!content) return;
    if (!user) {
      content.innerHTML = '<div class="social-empty"><span>✉</span><b>Entre para acessar suas mensagens</b><button type="button" class="primary" data-social-login>Entrar</button></div>';
      return;
    }
    content.innerHTML = `<section class="social-messages-page"><aside><header><span class="eyebrow">Conversas privadas</span><h2>Mensagens</h2></header><div>${threads.length ? threads.map(threadHtml).join('') : '<div class="social-empty compact"><b>Nenhuma conversa</b><p>Abra um perfil para começar.</p></div>'}</div></aside>${renderConversation()}</section>`;
    requestAnimationFrame(() => { const list = $('#socialMessageList'); if (list) list.scrollTop = list.scrollHeight; });
  }

  function renderActive() {
    syncNav();
    if (activeView === 'members') renderMembers();
    else if (activeView === 'messages') renderMessages();
    else if (activeView === 'profile') renderProfile();
    else renderFeed();
  }

  async function ensureProfile(currentUser) {
    const reference = db.collection('members').doc(currentUser.uid);
    const snapshot = await reference.get();
    if (snapshot.exists) {
      ownProfile = { id: snapshot.id, ...snapshot.data() };
      return;
    }
    const data = {
      uid: currentUser.uid,
      displayName: String(currentUser.displayName || currentUser.email?.split('@')[0] || 'Membro BDA').slice(0, 40),
      team: '',
      bio: '',
      avatar: '',
      role: auth.isAdmin() ? 'admin' : 'member',
      status: 'active',
      createdAt: serverTime(),
      updatedAt: serverTime()
    };
    await reference.set(data);
    ownProfile = { id: currentUser.uid, ...data };
  }

  function loadMembers() {
    membersUnsubscribe?.();
    membersUnsubscribe = db.collection('members').limit(150).onSnapshot(snapshot => {
      members = snapshot.docs.map(document => ({ id: document.id, ...document.data() })).filter(item => item.status !== 'blocked').sort((a, b) => String(a.displayName).localeCompare(String(b.displayName), 'pt-BR'));
      if (user) ownProfile = member(user.uid) || ownProfile;
      if ($('#socialContent')) renderActive();
      else shell();
    }, error => {
      console.error(error);
      connectionError = 'Perfis indisponíveis';
      shell();
    });
  }

  function loadPosts() {
    postsUnsubscribe?.();
    postsUnsubscribe = db.collection('communityPosts').orderBy('createdAtClient', 'desc').limit(POST_LIMIT).onSnapshot(snapshot => {
      posts = snapshot.docs.map(document => ({ id: document.id, ...document.data() })).filter(item => item.status === 'visible');
      renderActive();
      hydratePostMeta(posts);
    }, error => {
      console.error(error);
      connectionError = 'Feed indisponível';
      shell();
    });
  }

  async function hydratePostMeta(list) {
    await Promise.all(list.map(async post => {
      try {
        const [likesSnapshot, commentsSnapshot] = await Promise.all([
          db.collection('communityPosts').doc(post.id).collection('likes').limit(250).get(),
          db.collection('communityPosts').doc(post.id).collection('comments').orderBy('createdAtClient', 'asc').limit(20).get()
        ]);
        postMeta.set(post.id, {
          likes: likesSnapshot.size,
          liked: Boolean(user && likesSnapshot.docs.some(document => document.id === user.uid)),
          comments: commentsSnapshot.docs.map(document => ({ id: document.id, ...document.data() }))
        });
        refreshPost(post.id);
      } catch (error) {
        console.error('Falha ao carregar interações', error);
      }
    }));
  }

  function refreshPost(id) {
    const element = $(`[data-social-post="${CSS.escape(id)}"]`);
    const post = posts.find(item => item.id === id);
    if (!element || !post) return;
    const replacement = document.createElement('div');
    replacement.innerHTML = postHtml(post);
    element.replaceWith(replacement.firstElementChild);
  }

  function loadFollowing() {
    followingUnsubscribe?.();
    following = new Set();
    if (!user) return;
    followingUnsubscribe = db.collection('memberFollowing').doc(user.uid).collection('users').onSnapshot(snapshot => {
      following = new Set(snapshot.docs.map(document => document.id));
      renderActive();
    }, error => console.error(error));
  }

  function loadThreads() {
    threadsUnsubscribe?.();
    threads = [];
    if (!user) return;
    threadsUnsubscribe = db.collection('memberThreads').where('participants', 'array-contains', user.uid).limit(60).onSnapshot(snapshot => {
      threads = snapshot.docs.map(document => ({ id: document.id, ...document.data() })).sort((a, b) => dateValue(b.updatedAt, b.updatedAtClient) - dateValue(a.updatedAt, a.updatedAtClient));
      if (activeView === 'messages') renderMessages();
    }, error => {
      console.error(error);
      notify('Não foi possível carregar as mensagens');
    });
  }

  async function handleAuth(state) {
    user = state?.user || null;
    ownProfile = null;
    followingUnsubscribe?.(); followingUnsubscribe = null;
    threadsUnsubscribe?.(); threadsUnsubscribe = null;
    messagesUnsubscribe?.(); messagesUnsubscribe = null;
    following = new Set(); threads = []; messages = []; activeThreadId = '';
    if (user && db) {
      ownProfile = fallbackProfile(user);
      try { await ensureProfile(user); }
      catch (error) { console.error(error); notify('Seu perfil ainda não pôde ser preparado'); }
      loadFollowing();
      loadThreads();
      selectedProfileId = user.uid;
    }
    shell();
    if (posts.length) hydratePostMeta(posts);
  }

  async function createPost(event) {
    event.preventDefault();
    if (!user) return openLogin();
    const input = $('#socialPostText');
    const button = $('#socialPostForm button[type="submit"]');
    const text = postDraft.trim();
    if (!text && !postImage) return notify('Escreva algo ou escolha uma foto');
    button.disabled = true;
    button.textContent = postImage ? 'Enviando foto...' : 'Publicando...';
    try {
      const image = postImage
        ? await uploadImage(postImage, `community/${user.uid}/posts/${Date.now()}-${Math.random().toString(36).slice(2, 9)}.webp`)
        : '';
      await db.collection('communityPosts').add({
        authorId: user.uid,
        authorName: ownProfile?.displayName || user.displayName || 'Membro BDA',
        authorAvatar: ownProfile?.avatar || '',
        authorTeam: ownProfile?.team || '',
        text: text.slice(0, 500),
        image,
        status: 'visible',
        createdAtClient: Date.now(),
        createdAt: serverTime(),
        updatedAt: serverTime()
      });
      postImage = '';
      postDraft = '';
      input.value = '';
      notify('Publicação enviada');
    } catch (error) {
      console.error(error);
      notify('Não foi possível publicar');
    } finally {
      button.disabled = false;
      button.textContent = 'Publicar';
    }
  }

  async function toggleLike(postId) {
    if (!user) return openLogin();
    const reference = db.collection('communityPosts').doc(postId).collection('likes').doc(user.uid);
    const meta = postMeta.get(postId) || { likes: 0, liked: false, comments: [] };
    try {
      if (meta.liked) {
        await reference.delete();
        meta.liked = false;
        meta.likes = Math.max(0, meta.likes - 1);
      } else {
        await reference.set({ userId: user.uid, createdAt: serverTime() });
        meta.liked = true;
        meta.likes += 1;
      }
      postMeta.set(postId, meta);
      refreshPost(postId);
    } catch (error) {
      console.error(error);
      notify('Não foi possível atualizar a curtida');
    }
  }

  async function addComment(event, postId) {
    event.preventDefault();
    if (!user) return openLogin();
    const input = $('input', event.target);
    const text = input?.value.trim() || '';
    if (!text) return;
    input.disabled = true;
    try {
      const reference = await db.collection('communityPosts').doc(postId).collection('comments').add({
        authorId: user.uid,
        authorName: ownProfile?.displayName || user.displayName || 'Membro BDA',
        authorAvatar: ownProfile?.avatar || '',
        text: text.slice(0, 220),
        status: 'visible',
        createdAtClient: Date.now(),
        createdAt: serverTime()
      });
      const meta = postMeta.get(postId) || { likes: 0, liked: false, comments: [] };
      meta.comments.push({ id: reference.id, authorId: user.uid, text, createdAtClient: Date.now() });
      postMeta.set(postId, meta);
      input.value = '';
      refreshPost(postId);
    } catch (error) {
      console.error(error);
      notify('Não foi possível comentar');
    } finally {
      input.disabled = false;
    }
  }

  async function deletePost(id) {
    const post = posts.find(item => item.id === id);
    if (!post || !user || (post.authorId !== user.uid && !auth.isAdmin())) return;
    if (!confirm('Excluir esta publicação?')) return;
    try {
      await db.collection('communityPosts').doc(id).delete();
      if (post.image?.startsWith('https://') && typeof window.firebase?.storage === 'function') {
        firebase.storage().refFromURL(post.image).delete().catch(() => {});
      }
      notify('Publicação excluída');
    }
    catch (error) { console.error(error); notify('Não foi possível excluir'); }
  }

  async function deleteComment(postId, commentId) {
    const meta = postMeta.get(postId);
    const comment = meta?.comments.find(item => item.id === commentId);
    if (!comment || !user || (comment.authorId !== user.uid && !auth.isAdmin())) return;
    try {
      await db.collection('communityPosts').doc(postId).collection('comments').doc(commentId).delete();
      meta.comments = meta.comments.filter(item => item.id !== commentId);
      refreshPost(postId);
    } catch (error) { console.error(error); notify('Não foi possível excluir o comentário'); }
  }

  async function toggleFollow(targetId) {
    if (!user) return openLogin();
    if (!targetId || targetId === user.uid) return;
    const reference = db.collection('memberFollowing').doc(user.uid).collection('users').doc(targetId);
    try {
      if (following.has(targetId)) await reference.delete();
      else await reference.set({ targetId, createdAt: serverTime() });
    } catch (error) { console.error(error); notify('Não foi possível atualizar o perfil seguido'); }
  }

  function threadId(a, b) {
    return [String(a), String(b)].sort().join('__');
  }

  async function openThread(targetId) {
    if (!user) return openLogin();
    if (!targetId || targetId === user.uid) return;
    const id = threadId(user.uid, targetId);
    try {
      const reference = db.collection('memberThreads').doc(id);
      const snapshot = await reference.get();
      if (!snapshot.exists) {
        await reference.set({
          participants: [user.uid, targetId],
          createdBy: user.uid,
          lastText: '',
          lastSenderId: '',
          createdAt: serverTime(),
          updatedAt: serverTime(),
          updatedAtClient: Date.now()
        });
      }
      activeThreadId = id;
      activeView = 'messages';
      subscribeMessages(id);
      shell();
    } catch (error) { console.error(error); notify('Não foi possível iniciar a conversa'); }
  }

  function subscribeMessages(id) {
    messagesUnsubscribe?.();
    messages = [];
    messagesUnsubscribe = db.collection('memberThreads').doc(id).collection('messages').orderBy('createdAtClient', 'asc').limit(MESSAGE_LIMIT).onSnapshot(snapshot => {
      messages = snapshot.docs.map(document => ({ id: document.id, ...document.data() })).filter(item => item.status === 'visible');
      if (activeView === 'messages') renderMessages();
    }, error => { console.error(error); notify('Não foi possível abrir a conversa'); });
  }

  async function sendMessage(event) {
    event.preventDefault();
    if (!user || !activeThreadId) return;
    const input = $('input', event.target);
    const text = input?.value.trim() || '';
    if (!text) return;
    input.disabled = true;
    try {
      const now = Date.now();
      const threadReference = db.collection('memberThreads').doc(activeThreadId);
      await threadReference.collection('messages').add({ senderId: user.uid, text: text.slice(0, 500), status: 'visible', createdAtClient: now, createdAt: serverTime() });
      await threadReference.update({ lastText: text.slice(0, 120), lastSenderId: user.uid, updatedAtClient: now, updatedAt: serverTime() });
      messageDrafts.delete(activeThreadId);
      input.value = '';
    } catch (error) { console.error(error); notify('Não foi possível enviar a mensagem'); }
    finally { input.disabled = false; input.focus(); }
  }

  function readFile(file) {
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

  async function compressImage(file, maxDimension, maxLength) {
    if (!file?.type?.startsWith('image/')) throw new Error('Escolha uma imagem válida');
    if (file.size > 12 * 1024 * 1024) throw new Error('A imagem deve ter no máximo 12 MB');
    const source = await readFile(file);
    const image = await loadImage(source);
    let scale = Math.min(1, maxDimension / Math.max(image.width, image.height));
    let quality = .82;
    let output = '';
    for (let attempt = 0; attempt < 7; attempt += 1) {
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(image.width * scale));
      canvas.height = Math.max(1, Math.round(image.height * scale));
      const context = canvas.getContext('2d');
      if (!context) throw new Error('Seu navegador não conseguiu processar a imagem');
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      output = canvas.toDataURL('image/webp', quality);
      if (output.length <= maxLength) return output;
      quality = Math.max(.5, quality - .08);
      scale *= .86;
    }
    if (output.length > maxLength) throw new Error('A imagem continuou muito pesada após a compressão');
    return output;
  }

  async function uploadImage(source, path) {
    if (!source?.startsWith('data:image/')) return source || '';
    if (!window.firebase || typeof firebase.storage !== 'function') return source;
    const snapshot = await firebase.storage().ref(path).putString(source, 'data_url', {
      contentType: 'image/webp',
      cacheControl: 'public,max-age=31536000,immutable'
    });
    return snapshot.ref.getDownloadURL();
  }

  function ensureModals() {
    if (!$('#socialProfileModal')) {
      const modal = document.createElement('div');
      modal.className = 'modal-backdrop social-modal-backdrop';
      modal.id = 'socialProfileModal';
      modal.innerHTML = `<section class="modal social-profile-modal"><header><div><span class="eyebrow">Seu espaço no clã</span><h2>Editar perfil</h2></div><button type="button" data-social-close-profile>×</button></header><form id="socialProfileForm"><div class="social-avatar-editor"><div id="socialAvatarPreview"></div><label><input id="socialAvatarInput" type="file" accept="image/png,image/jpeg,image/webp" hidden><span>Escolher foto</span></label></div><div class="form-grid"><label>Nome no clã<input id="socialProfileName" maxlength="40" required></label><label>Time<input id="socialProfileTeam" maxlength="55" placeholder="Seu time BDA"></label><label>Biografia<textarea id="socialProfileBio" maxlength="180" rows="4" placeholder="Conte um pouco sobre você"></textarea></label></div><footer><button type="button" class="secondary" data-social-close-profile>Cancelar</button><button type="submit" class="primary">Salvar perfil</button></footer></form></section>`;
      document.body.append(modal);
    }
  }

  function openProfileEditor() {
    if (!user) return openLogin();
    ensureModals();
    const profile = ownProfile || member(user.uid) || {};
    avatarDraft = profile.avatar || '';
    $('#socialProfileName').value = profile.displayName || user.displayName || '';
    $('#socialProfileTeam').value = profile.team || '';
    $('#socialProfileBio').value = profile.bio || '';
    renderAvatarPreview();
    $('#socialProfileModal').classList.add('show');
    document.body.classList.add('social-modal-open');
  }

  function closeProfileEditor() {
    $('#socialProfileModal')?.classList.remove('show');
    document.body.classList.remove('social-modal-open');
    avatarDraft = '';
  }

  function renderAvatarPreview() {
    const root = $('#socialAvatarPreview');
    if (!root) return;
    root.innerHTML = avatarDraft ? `<img src="${esc(avatarDraft)}" alt="Prévia da foto">` : `<span>${esc(initials($('#socialProfileName')?.value || ownProfile?.displayName))}</span>`;
  }

  async function saveProfile(event) {
    event.preventDefault();
    if (!user) return;
    const name = $('#socialProfileName').value.trim();
    if (name.length < 2) return notify('Digite seu nome no clã');
    const button = $('#socialProfileForm button[type="submit"]');
    button.disabled = true;
    try {
      const data = {
        displayName: name.slice(0, 40),
        team: $('#socialProfileTeam').value.trim().slice(0, 55),
        bio: $('#socialProfileBio').value.trim().slice(0, 180),
        avatar: await uploadImage(avatarDraft, `community/${user.uid}/profile/avatar.webp`),
        updatedAt: serverTime()
      };
      await db.collection('members').doc(user.uid).update(data);
      await user.updateProfile({ displayName: data.displayName });
      ownProfile = { ...(ownProfile || {}), id: user.uid, ...data };
      closeProfileEditor();
      shell();
      notify('Perfil atualizado');
    } catch (error) { console.error(error); notify('Não foi possível atualizar o perfil'); }
    finally { button.disabled = false; }
  }

  async function logout() {
    try { await auth.signOut(); activeView = 'feed'; notify('Você saiu da comunidade'); }
    catch { notify('Não foi possível sair da conta'); }
  }

  function filterMembers(value) {
    const query = norm(value);
    const list = query ? members.filter(item => norm(`${item.displayName} ${item.team}`).includes(query)) : members;
    const grid = $('#socialMembersGrid');
    if (grid) grid.innerHTML = list.length ? list.map(memberCard).join('') : '<div class="social-empty"><b>Nenhum membro encontrado</b></div>';
  }

  async function connect() {
    if (connected) return;
    auth = window.ArenaBDAAuth;
    if (!auth || !window.firebase || typeof firebase.firestore !== 'function') {
      shell();
      window.ArenaBDAEnsureCloud?.('community');
      return;
    }
    connected = true;
    db = firebase.firestore();
    connectionError = '';
    loadMembers();
    loadPosts();
    authUnsubscribe?.();
    authUnsubscribe = auth.subscribe(handleAuth);
    shell();
  }

  function installStyles() {
    if ($('#comunidadeSocialStyles')) return;
    const style = document.createElement('style');
    style.id = 'comunidadeSocialStyles';
    style.textContent = `
      [data-page="community"]{display:none;gap:13px;--social-blue:#64a9ff;--social-green:#58e19a}[data-page="community"].active{display:grid}.social-hero{position:relative;overflow:hidden;display:grid;grid-template-columns:minmax(0,1.25fr) minmax(310px,.75fr);gap:20px;align-items:end;min-height:290px;padding:31px;border:1px solid rgba(100,169,255,.25);border-radius:29px;background:radial-gradient(circle at 88% 12%,rgba(100,169,255,.22),transparent 28%),radial-gradient(circle at 8% 90%,rgba(88,225,154,.11),transparent 34%),linear-gradient(140deg,#102b22,#07130f 56%,#050806);box-shadow:0 25px 65px rgba(0,0,0,.4)}.social-hero:after{content:"BDA";position:absolute;right:-2%;bottom:-19%;color:rgba(255,255,255,.028);font:900 210px/.8 "Barlow Condensed",sans-serif}.social-hero>div,.social-hero>aside{position:relative;z-index:1}.social-hero h1{margin:7px 0 10px;font:900 clamp(58px,10vw,105px)/.78 "Barlow Condensed",sans-serif;letter-spacing:-.035em;text-transform:uppercase}.social-hero p{max-width:650px;margin:0;color:#cbdad0;font-size:12px;line-height:1.65}.social-connection{display:inline-flex;align-items:center;gap:7px;margin-top:17px;padding:7px 9px;border:1px solid rgba(88,225,154,.22);border-radius:999px;color:var(--social-green);background:rgba(88,225,154,.065);font-size:7px;font-weight:900;text-transform:uppercase}.social-connection i{width:7px;height:7px;border-radius:50%;background:currentColor;box-shadow:0 0 10px currentColor}.social-connection.error{color:#ff9fac;border-color:rgba(255,105,120,.22);background:rgba(255,105,120,.065)}.social-hero>aside{display:grid;grid-template-columns:auto minmax(0,1fr) auto;align-items:center;gap:11px;padding:15px;border:1px solid var(--line);border-radius:18px;background:rgba(255,255,255,.045);backdrop-filter:blur(12px)}.social-hero>aside>span:not(.social-avatar){font-size:31px}.social-hero>aside b,.social-hero>aside span,.social-hero>aside small{display:block}.social-hero>aside b{font-size:11px}.social-hero>aside span,.social-hero>aside small{margin-top:4px;color:var(--muted);font-size:8px}.social-hero>aside>button{min-height:39px;padding:0 11px;border:1px solid rgba(100,169,255,.25);border-radius:11px;color:#cce2ff;background:rgba(100,169,255,.07);font-size:8px;font-weight:900;text-transform:uppercase}
      .social-avatar{overflow:hidden;display:grid!important;place-items:center;width:46px;height:46px;flex:0 0 auto;border:1px solid rgba(255,255,255,.14);border-radius:50%;color:#07100c;background:linear-gradient(145deg,#d7f1e2,#6ebf91);font-size:10px;font-weight:900}.social-avatar img{width:100%;height:100%;object-fit:cover}.social-avatar.small{width:31px;height:31px;font-size:7px}.social-avatar.large{width:65px;height:65px;font-size:13px}.social-avatar.member{width:72px;height:72px;font-size:14px}.social-avatar.profile{width:104px;height:104px;border:4px solid rgba(255,255,255,.15);font-size:20px;box-shadow:0 14px 32px rgba(0,0,0,.35)}
      .social-nav{position:sticky;top:72px;z-index:12;display:grid;grid-template-columns:repeat(4,1fr);gap:5px;padding:5px;border:1px solid var(--line);border-radius:16px;background:rgba(5,12,8,.9);backdrop-filter:blur(14px)}.social-nav button{display:flex;align-items:center;justify-content:center;gap:7px;min-height:43px;border:0;border-radius:11px;color:var(--muted);background:transparent;font-size:8px;font-weight:900;text-transform:uppercase}.social-nav button i{font-style:normal;font-size:14px}.social-nav button.active{color:#07100c;background:linear-gradient(135deg,#a9d2ff,var(--social-blue))}.social-content{min-width:0}.social-feed-layout{display:grid;grid-template-columns:minmax(0,1.35fr) minmax(270px,.65fr);gap:12px;align-items:start}.social-feed{display:grid;gap:10px;min-width:0}.social-composer,.social-post,.social-login-card,.social-suggestions,.social-members-page,.social-profile-cover,.social-profile-posts,.social-messages-page{border:1px solid var(--line);border-radius:20px;background:linear-gradient(150deg,rgba(18,35,25,.97),rgba(5,12,8,.98));box-shadow:0 13px 36px rgba(0,0,0,.22)}.social-composer{padding:13px}.social-composer>header{display:flex;align-items:center;gap:9px}.social-composer>header b,.social-composer>header span{display:block}.social-composer>header b{font-size:10px}.social-composer>header span{margin-top:3px;color:var(--muted);font-size:7px}.social-composer textarea{width:100%;margin-top:10px;padding:12px;border:1px solid var(--line);border-radius:13px;color:var(--text);background:#07100c;font-size:11px;line-height:1.5;resize:vertical}.social-composer>footer{display:flex;align-items:center;gap:9px;margin-top:8px}.social-composer>footer label span{display:inline-flex;align-items:center;min-height:37px;padding:0 10px;border:1px solid var(--line);border-radius:10px;color:#cce2ff;background:rgba(100,169,255,.06);font-size:8px;font-weight:900}.social-composer>footer small{color:var(--muted);font-size:7px}.social-composer>footer>button{margin-left:auto}.social-post-preview{position:relative;overflow:hidden;margin-top:9px;border-radius:13px;background:#020403}.social-post-preview img{display:block;width:100%;max-height:390px;object-fit:contain}.social-post-preview button{position:absolute;right:8px;top:8px;width:35px;height:35px;border:1px solid rgba(255,255,255,.2);border-radius:50%;color:white;background:rgba(0,0,0,.72);font-size:18px}
      .social-login-card{display:grid;grid-template-columns:auto 1fr auto;align-items:center;gap:11px;padding:15px}.social-login-card>span{font-size:28px}.social-login-card b{font-size:11px}.social-login-card p{margin:4px 0 0;color:var(--muted);font-size:8px}.social-post{overflow:hidden}.social-post>header{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:12px 13px}.social-post>header>button:first-child{display:flex;align-items:center;gap:9px;min-width:0;padding:0;border:0;color:var(--text);background:transparent;text-align:left}.social-post>header>button span:not(.social-avatar){min-width:0}.social-post>header b,.social-post>header small{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.social-post>header b{font-size:10px}.social-post>header small{margin-top:3px;color:var(--muted);font-size:7px}.social-post-menu{padding:7px;border:0;color:var(--muted);background:transparent}.social-post-text{margin:0;padding:3px 14px 13px;color:#edf5ef;font-size:11px;line-height:1.62;white-space:pre-wrap}.social-post-image{display:block;width:100%;max-height:680px;object-fit:contain;background:#020403}.social-post-stats{display:flex;justify-content:space-between;gap:10px;padding:9px 13px;color:var(--muted);font-size:7px}.social-post-actions{display:grid;grid-template-columns:repeat(3,1fr);border-top:1px solid var(--line);border-bottom:1px solid var(--line)}.social-post-actions button{min-height:41px;border:0;color:var(--muted);background:transparent;font-size:8px;font-weight:850}.social-post-actions button+button{border-left:1px solid var(--line)}.social-post-actions button i{margin-right:5px;font-style:normal}.social-post-actions button.active{color:#ff8d9a;background:rgba(255,105,120,.06)}.social-comments{display:grid;gap:7px;padding:10px 13px 3px}.social-comment{display:grid;grid-template-columns:auto 1fr auto;align-items:start;gap:7px}.social-comment>div{padding:8px 9px;border-radius:4px 12px 12px 12px;background:rgba(255,255,255,.045)}.social-comment header{display:flex;justify-content:space-between;gap:9px}.social-comment header b{font-size:8px}.social-comment time{color:var(--muted);font-size:6px}.social-comment p{margin:4px 0 0;color:#dce7df;font-size:8px;line-height:1.4}.social-comment>button{border:0;color:#ff9fac;background:transparent}.social-comment-form{display:grid;grid-template-columns:auto 1fr 34px;align-items:center;gap:7px;padding:8px 13px 12px}.social-comment-form input{height:36px;padding:0 10px;border:1px solid var(--line);border-radius:999px;color:var(--text);background:#07100c;font-size:8px}.social-comment-form button{height:34px;border:0;border-radius:50%;color:#07100c;background:var(--social-blue)}
      .social-suggestions{position:sticky;top:132px;padding:13px}.social-suggestions>header{display:flex;justify-content:space-between;gap:8px;margin-bottom:8px}.social-suggestions>header b{font-size:9px;text-transform:uppercase}.social-suggestions>header button{padding:0;border:0;color:var(--social-blue);background:transparent;font-size:7px}.social-suggestions>div{display:grid;grid-template-columns:auto 1fr auto;align-items:center;gap:7px;padding:8px 0;border-top:1px solid var(--line)}.social-suggestions>div>button:nth-child(2){min-width:0;padding:0;border:0;color:var(--text);background:transparent;text-align:left}.social-suggestions>div b,.social-suggestions>div span{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.social-suggestions>div b{font-size:8px}.social-suggestions>div span{margin-top:3px;color:var(--muted);font-size:6px}.social-suggestions>div>button:last-child{padding:6px;border:0;color:var(--social-blue);background:transparent;font-size:7px;font-weight:900}.social-suggestions>p{color:var(--muted);font-size:8px}
      .social-members-page,.social-profile-cover,.social-profile-posts{padding:17px}.social-members-page>header{display:flex;align-items:end;justify-content:space-between;gap:12px;margin-bottom:12px}.social-members-page h2,.social-profile-posts h2,.social-messages-page h2{margin:4px 0 0;font-size:clamp(27px,4vw,39px);text-transform:uppercase}.social-members-page>header p{margin:3px 0 0;color:var(--muted);font-size:8px}.social-members-page>header input{width:min(280px,100%);height:42px;padding:0 12px;border:1px solid var(--line);border-radius:12px;color:var(--text);background:#07100c;font-size:9px}.social-members-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}.social-member-card{overflow:hidden;border:1px solid var(--line);border-radius:15px;background:rgba(255,255,255,.025)}.social-member-main{display:grid;justify-items:center;width:100%;min-height:205px;padding:15px;border:0;color:var(--text);background:transparent;text-align:center}.social-member-main>span:not(.social-avatar){min-width:0;width:100%}.social-member-main b,.social-member-main small{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.social-member-main b{margin-top:9px;font-size:10px}.social-member-main small{margin-top:4px;color:var(--social-blue);font-size:7px}.social-member-main p{display:-webkit-box;overflow:hidden;margin:9px auto 0;color:var(--muted);font-size:7px;line-height:1.45;-webkit-box-orient:vertical;-webkit-line-clamp:2}.social-member-card footer{display:flex;border-top:1px solid var(--line)}.social-member-card footer button{flex:1;min-height:39px;border:0;color:#cce2ff;background:rgba(100,169,255,.045);font-size:7px;font-weight:900;text-transform:uppercase}.social-member-card footer button+button{border-left:1px solid var(--line)}.social-member-card footer button.following{color:var(--social-green)}
      .social-profile-page{display:grid;gap:11px}.social-profile-cover{text-align:center;background:radial-gradient(circle at 50% 0,rgba(100,169,255,.18),transparent 34%),linear-gradient(150deg,rgba(18,35,25,.97),rgba(5,12,8,.98))}.social-profile-cover>div{display:grid;justify-items:center}.social-profile-cover>div b,.social-profile-cover>div small{display:block}.social-profile-cover>div b{margin-top:10px;font-size:23px}.social-profile-cover>div small{margin-top:5px;color:var(--social-blue);font-size:8px}.social-profile-cover>p{max-width:600px;margin:12px auto;color:#cbd8cf;font-size:9px;line-height:1.55}.social-profile-cover>section{display:flex;justify-content:center;gap:20px}.social-profile-cover>section span{color:var(--muted);font-size:7px;text-transform:uppercase}.social-profile-cover>section b{display:block;margin-bottom:3px;color:var(--text);font-size:12px}.social-profile-cover>footer{display:flex;justify-content:center;gap:8px;margin-top:15px}.social-profile-cover>footer button{min-height:39px;padding:0 13px;border:1px solid var(--line);border-radius:11px;color:var(--text);background:rgba(255,255,255,.04);font-size:8px;font-weight:900}.social-profile-cover>footer button.following{color:var(--social-green)}.social-profile-posts>header{margin-bottom:10px}.social-profile-posts>.social-post{margin-top:9px}
      .social-messages-page{display:grid;grid-template-columns:minmax(250px,.7fr) minmax(0,1.3fr);min-height:620px;overflow:hidden}.social-messages-page>aside{border-right:1px solid var(--line)}.social-messages-page>aside>header{padding:15px;border-bottom:1px solid var(--line)}.social-messages-page>aside>div{max-height:555px;overflow-y:auto}.social-thread{display:grid;grid-template-columns:auto 1fr auto;align-items:center;gap:8px;width:100%;padding:10px;border:0;border-bottom:1px solid var(--line);color:var(--text);background:transparent;text-align:left}.social-thread.active{background:rgba(100,169,255,.09)}.social-thread>span{min-width:0}.social-thread b,.social-thread small{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.social-thread b{font-size:9px}.social-thread small{margin-top:4px;color:var(--muted);font-size:7px}.social-thread time{color:var(--muted);font-size:6px}.social-conversation{display:grid;grid-template-rows:auto 1fr auto;min-width:0;max-height:620px}.social-conversation>header{display:flex;align-items:center;gap:9px;padding:11px 13px;border-bottom:1px solid var(--line)}.social-conversation>header button{padding:0;border:0;color:var(--text);background:transparent;text-align:left}.social-conversation>header b,.social-conversation>header span{display:block}.social-conversation>header b{font-size:9px}.social-conversation>header span{margin-top:3px;color:var(--muted);font-size:7px}.social-message-list{display:flex;flex-direction:column;gap:6px;overflow-y:auto;padding:13px;background:rgba(0,0,0,.12)}.social-message{align-self:flex-start;max-width:78%;padding:8px 10px;border:1px solid var(--line);border-radius:5px 14px 14px 14px;background:rgba(255,255,255,.05)}.social-message.mine{align-self:flex-end;border-color:rgba(100,169,255,.18);border-radius:14px 5px 14px 14px;background:rgba(100,169,255,.11)}.social-message p{margin:0;color:#eef6f0;font-size:9px;line-height:1.45;white-space:pre-wrap}.social-message time{display:block;margin-top:4px;color:var(--muted);font-size:6px;text-align:right}.social-conversation>form{display:grid;grid-template-columns:1fr 43px;gap:7px;padding:10px;border-top:1px solid var(--line)}.social-conversation>form input{height:43px;padding:0 12px;border:1px solid var(--line);border-radius:13px;color:var(--text);background:#07100c;font-size:9px}.social-conversation>form button{width:43px;padding:0}.social-conversation-empty{border:0!important;border-radius:0!important}
      .social-empty{display:grid;place-items:center;gap:6px;min-height:230px;padding:25px;border:1px dashed var(--line);border-radius:17px;color:var(--muted);text-align:center}.social-empty.compact{min-height:130px}.social-empty>span{font-size:36px}.social-empty b{color:var(--text);font-size:11px}.social-empty p{max-width:360px;margin:0;font-size:8px;line-height:1.5}.social-empty button{margin-top:5px}.social-modal-open{overflow:hidden}.social-modal-backdrop{z-index:98}.social-profile-modal{width:min(520px,100%);padding:0!important}.social-profile-modal>header{display:flex;align-items:center;justify-content:space-between;padding:16px 18px;border-bottom:1px solid var(--line)}.social-profile-modal>header h2{margin:4px 0 0}.social-profile-modal>header button{width:39px;height:39px;border:1px solid var(--line);border-radius:11px;color:var(--text);background:rgba(255,255,255,.04);font-size:21px}.social-profile-modal form{padding:16px 18px}.social-profile-modal textarea{width:100%;margin-top:5px;padding:10px;border:1px solid var(--line);border-radius:10px;color:var(--text);background:#07100c;font-size:10px}.social-profile-modal form>footer{display:flex;justify-content:flex-end;gap:8px;margin-top:13px}.social-avatar-editor{display:grid;justify-items:center;gap:8px;margin-bottom:13px}.social-avatar-editor>div{overflow:hidden;display:grid;place-items:center;width:96px;height:96px;border:3px solid rgba(255,255,255,.14);border-radius:50%;color:#07100c;background:linear-gradient(145deg,#d7f1e2,#6ebf91);font-size:19px;font-weight:900}.social-avatar-editor img{width:100%;height:100%;object-fit:cover}.social-avatar-editor label span{display:inline-flex;align-items:center;min-height:36px;padding:0 10px;border:1px solid var(--line);border-radius:10px;color:#cce2ff;background:rgba(100,169,255,.06);font-size:8px;font-weight:900}
      @media(max-width:900px){.social-hero,.social-feed-layout{grid-template-columns:1fr}.social-suggestions{position:static}.social-members-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.social-messages-page{grid-template-columns:1fr}.social-messages-page>aside{border-right:0;border-bottom:1px solid var(--line)}.social-messages-page>aside>div{max-height:240px}.social-conversation{min-height:540px}}
      @media(max-width:620px){[data-page="community"]{gap:10px}.social-hero{min-height:390px;padding:22px 17px;border-radius:24px}.social-hero h1{font-size:65px}.social-hero>aside{grid-template-columns:auto 1fr}.social-hero>aside>button{grid-column:1/-1;width:100%}.social-nav{top:61px}.social-nav button{gap:3px;font-size:7px}.social-nav button i{font-size:12px}.social-login-card{grid-template-columns:auto 1fr}.social-login-card button{grid-column:1/-1;width:100%}.social-composer>footer{flex-wrap:wrap}.social-composer>footer small{display:none}.social-members-page>header{align-items:stretch;flex-direction:column}.social-members-page>header input{width:100%}.social-members-grid{grid-template-columns:1fr}.social-profile-cover>footer{display:grid;grid-template-columns:1fr 1fr}.social-profile-cover>footer button{width:100%}.social-message{max-width:88%}}
      @media(max-width:420px){.social-nav button span{display:none}.social-nav button i{font-size:17px}.social-post-actions button{font-size:7px}.social-profile-cover>footer{grid-template-columns:1fr}.social-hero>aside .social-avatar{width:50px;height:50px}.social-members-page,.social-profile-cover,.social-profile-posts{padding:13px}}
      @media(prefers-reduced-motion:reduce){.social-post-image{scroll-behavior:auto}}
    `;
    document.head.append(style);
  }

  document.addEventListener('click', event => {
    if (event.target.id === 'socialProfileModal') { closeProfileEditor(); return; }
    if (event.target.closest('[data-social-login]')) { openLogin(event.target.closest('[data-social-login]').textContent.includes('Criar') ? 'register' : 'login'); return; }
    const view = event.target.closest('[data-social-view]');
    if (view) { setView(view.dataset.socialView); return; }
    if (event.target.closest('[data-social-own-profile]')) { selectedProfileId = user?.uid || ''; setView('profile'); return; }
    const profileButton = event.target.closest('[data-social-profile]');
    if (profileButton) { selectedProfileId = profileButton.dataset.socialProfile; setView('profile'); return; }
    if (event.target.closest('[data-social-edit-profile]')) { openProfileEditor(); return; }
    if (event.target.closest('[data-social-close-profile]')) { closeProfileEditor(); return; }
    if (event.target.closest('[data-social-logout]')) { logout(); return; }
    const follow = event.target.closest('[data-social-follow]');
    if (follow) { toggleFollow(follow.dataset.socialFollow); return; }
    const message = event.target.closest('[data-social-message]');
    if (message) { openThread(message.dataset.socialMessage); return; }
    const thread = event.target.closest('[data-social-thread]');
    if (thread) { activeThreadId = thread.dataset.socialThread; subscribeMessages(activeThreadId); renderMessages(); return; }
    const like = event.target.closest('[data-social-like]');
    if (like) { toggleLike(like.dataset.socialLike); return; }
    const focus = event.target.closest('[data-social-focus-comment]');
    if (focus) { $(`[data-social-comment-form="${CSS.escape(focus.dataset.socialFocusComment)}"] input`)?.focus(); return; }
    const deletePostButton = event.target.closest('[data-social-delete-post]');
    if (deletePostButton) { deletePost(deletePostButton.dataset.socialDeletePost); return; }
    const deleteCommentButton = event.target.closest('[data-social-delete-comment]');
    if (deleteCommentButton) { const post = deleteCommentButton.closest('[data-social-post]'); deleteComment(post?.dataset.socialPost, deleteCommentButton.dataset.socialDeleteComment); return; }
    if (event.target.closest('[data-social-remove-post-image]')) { postImage = ''; renderFeed(); }
  });

  document.addEventListener('submit', event => {
    if (event.target.id === 'socialPostForm') { createPost(event); return; }
    if (event.target.id === 'socialProfileForm') { saveProfile(event); return; }
    if (event.target.id === 'socialMessageForm') { sendMessage(event); return; }
    const commentForm = event.target.closest('[data-social-comment-form]');
    if (commentForm) addComment(event, commentForm.dataset.socialCommentForm);
  });

  document.addEventListener('input', event => {
    if (event.target.id === 'socialPostText') postDraft = event.target.value;
    if (event.target.id === 'socialMessageInput' && activeThreadId) messageDrafts.set(activeThreadId, event.target.value);
    if (event.target.id === 'socialMemberSearch') filterMembers(event.target.value);
    if (event.target.id === 'socialProfileName' && !avatarDraft) renderAvatarPreview();
  });

  document.addEventListener('change', async event => {
    if (event.target.id === 'socialPostImage') {
      const file = event.target.files?.[0];
      if (!file) return;
      try { notify('Comprimindo a imagem...'); postImage = await compressImage(file, 1000, 240000); renderFeed(); }
      catch (error) { console.error(error); notify(error.message || 'Não foi possível preparar a imagem'); }
      return;
    }
    if (event.target.id === 'socialAvatarInput') {
      const file = event.target.files?.[0];
      if (!file) return;
      try { notify('Preparando a foto...'); avatarDraft = await compressImage(file, 320, 80000); renderAvatarPreview(); }
      catch (error) { console.error(error); notify(error.message || 'Não foi possível preparar a foto'); }
    }
  });

  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && $('#socialProfileModal')?.classList.contains('show')) closeProfileEditor();
  });

  window.addEventListener('arena:cloud-ready', connect);
  installStyles();
  ensureModals();
  shell();
  connect();

  window.ArenaBDACommunity = Object.freeze({
    refresh: renderActive,
    openOwnProfile() { selectedProfileId = user?.uid || ''; activeView = 'profile'; if (typeof navigate === 'function') navigate('community'); shell(); },
    openProfile(id) { selectedProfileId = String(id || ''); activeView = 'profile'; if (typeof navigate === 'function') navigate('community'); shell(); },
    state: () => ({ connected, userId: user?.uid || '', view: activeView, members: members.length, posts: posts.length, threads: threads.length })
  });
})();
