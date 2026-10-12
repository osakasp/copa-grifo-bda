/* Opt-in Firestore adapter. No seed upload, merge-all, offline write queue or deletes. */
(function (root) {
  'use strict';
  const C = typeof module === 'object' && module.exports ? require('./portal-core.js') : root.ArenaPortalCore;
  const ADMIN_EMAILS = ['claboleirosdeatitude@gmail.com','miniamikaren@gmail.com'];
  const isAdmin = user => Boolean(user?.emailVerified && ADMIN_EMAILS.includes(String(user.email).toLowerCase()));
  function createSync({transport, tournament, onState = () => {}}) {
    let current = null, user = null, online = false, busy = false, stopData, stopAuth;
    const emit = (status, message) => onState({status, message, revision:current?.revision ?? null, canWrite:online && isAdmin(user) && !!current && !busy, user, tournament:current ? {...C.clone(tournament), results:C.clone(current.results)} : null});
    return {
      start() {
        stopAuth = transport.onAuth(next => { user = next; emit(online ? 'ready' : 'loading', online ? 'Dados oficiais recebidos.' : 'Conectando…'); });
        stopData = transport.watch(tournament.id, data => {
          try {
            if (!data || data.calendar !== C.calendar(tournament) || !Number.isInteger(data.revision) || data.revision < 0) throw new Error('Migração ausente ou calendário remoto divergente. Escrita bloqueada.');
            C.validateResults(tournament, data.results);
            if (current && data.revision < current.revision) throw new Error('Versão remota antiga. Escrita bloqueada.');
            current = C.clone(data); online = true; emit('ready','Sincronizado com o servidor.');
          } catch (error) { online = false; emit('error',error.message); }
        }, error => { online = false; emit('error',error.message || 'Sem conexão. Escrita bloqueada.'); });
      },
      async save(patch, expectedRevision) {
        if (!online || !current || !isAdmin(user) || busy) throw new Error('Entre com uma conta administrativa verificada e aguarde a conexão.');
        if (expectedRevision !== current.revision) throw new Error('Conflito: os resultados mudaram durante a edição.');
        const next = C.patchResults({...tournament,results:current.results}, patch);
        if (!next) return;
        busy = true; emit('saving','Enviando resultados…');
        try {
          await transport.commit({id:tournament.id, calendar:C.calendar(tournament), revision:expectedRevision, patch:C.clone(patch), uid:user.uid});
          // Success is only reported after the transaction's server acknowledgement.
          emit('saved','Resultados confirmados pelo servidor.');
        } catch (error) { emit('error',error.message); throw error; }
        finally { busy = false; emit(online ? 'ready' : 'error', online ? 'Conexão disponível.' : 'Reconecte para salvar.'); }
      },
      signIn: (email,password) => transport.signIn(email,password),
      signOut: () => transport.signOut(),
      stop() { stopData?.(); stopAuth?.(); online = false; }
    };
  }
  function firebaseTransport(firebase, app) {
    const db = app.firestore(), auth = app.auth();
    const meta = id => db.collection('portalV2').doc(id);
    return {
      onAuth: listener => auth.onIdTokenChanged(listener),
      async signIn(email,password) {
        await auth.setPersistence(firebase.auth.Auth.Persistence.SESSION);
        const credential = await auth.signInWithEmailAndPassword(email.trim(),password);
        if (!isAdmin(credential.user)) { await auth.signOut(); throw new Error('Conta sem permissão administrativa ou e-mail não verificado.'); }
      },
      signOut: () => auth.signOut(),
      watch(id, listener, onError) {
        let generation = 0;
        const unsubscribe = meta(id).onSnapshot({includeMetadataChanges:true}, async snapshot => {
          const token = ++generation;
          if (snapshot.metadata.fromCache || snapshot.metadata.hasPendingWrites) { onError(new Error('Aguardando confirmação do servidor.')); return; }
          if (!snapshot.exists) { listener(null); return; }
          try {
            const data = snapshot.data();
            const games = await meta(id).collection('results').get({source:'server'});
            const latest = await meta(id).get({source:'server'});
            if (token !== generation) return;
            if (!latest.exists || latest.data().revision !== data.revision) { onError(new Error('Atualização em andamento. Aguarde a sincronização.')); return; }
            const results = {};
            games.forEach(doc => {
              const value = doc.data();
              if (!Number.isInteger(value.revision) || value.revision > data.revision || typeof value.cleared !== 'boolean' || !C.validScore(value)) throw new Error('Documento remoto inválido.');
              if (!value.cleared) results[doc.id] = {home:value.home,away:value.away};
            });
            listener({...data,results});
          } catch (error) { if (token === generation) onError(error); }
        },onError);
        return () => { generation++; unsubscribe(); };
      },
      commit({id,calendar,revision,patch,uid}) {
        return db.runTransaction(async transaction => {
          if (!isAdmin(auth.currentUser) || auth.currentUser.uid !== uid) throw new Error('Sessão administrativa expirada.');
          const ref = meta(id), snapshot = await transaction.get(ref);
          if (!snapshot.exists) throw new Error('Competição ainda não migrada. Nenhum dado foi criado.');
          const data = snapshot.data();
          if (data.calendar !== calendar || data.revision !== revision) throw new Error('Conflito remoto. Recarregue antes de salvar.');
          const now = firebase.firestore.FieldValue.serverTimestamp();
          transaction.update(ref,{revision:revision+1,updatedAt:now,updatedBy:uid});
          for (const [key,value] of Object.entries(patch)) {
            if (!data.allowedMatchKeys.includes(key)) throw new Error('Jogo inexistente.');
            transaction.set(ref.collection('results').doc(key),{home:value === null ? 0 : C.score(value.home),away:value === null ? 0 : C.score(value.away),cleared:value === null,revision:revision+1,updatedAt:now,updatedBy:uid});
          }
          transaction.set(ref.collection('events').doc(String(revision+1)),{revision:revision+1,updatedAt:now,updatedBy:uid,keys:Object.keys(patch)});
        });
      }
    };
  }
  const api = {isAdmin,createSync,firebaseTransport};
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.ArenaPortalSync = Object.freeze(api);
})(globalThis);
