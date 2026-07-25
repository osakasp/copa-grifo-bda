(() => {
  'use strict';

  const ADMIN_EMAIL = 'miniamikaren@gmail.com';
  const COLLECTION = 'arenaData';
  const META_ID = 'meta';
  const MAX_ITEM_BYTES = 800 * 1024;

  const DEFAULT_TOURNAMENTS = [
    {id:'copa-grifo',name:'Copa Grifo BDA',edition:'8ª edição',format:'Mata-mata',status:'Finalizado',phase:'Campeão definido',maxTeams:19,badge:'🦅',participants:['Zombie FC BDA','JOGOBUGADO BDA','Inter Brasil BDA','Vasco da Gama BDA'],description:'Competição tradicional do Clã BDA em formato eliminatório e jogo único.',legacy:true,locked:true},
    {id:'copa-francos',name:'Copa Francos',edition:'Próxima edição',format:'Mata-mata',status:'Planejado',phase:'Preparação',maxTeams:16,badge:'🕊️',participants:[],description:'Competição especial em homenagem à história do Francos FC BDA.'},
    {id:'supercopa',name:'SuperCopa BDA',edition:'Temporada atual',format:'Mata-mata',status:'Em andamento',phase:'Semifinais',maxTeams:4,badge:'⚡',participants:['São Paulo BDA','Flamestre BDA','CR Flamengo BDA','CV Cruz BDA'],description:'Confronto entre grandes campeões das ligas e copas do Clã BDA.'},
    {id:'liga-a',name:'Liga A BDA',edition:'Temporada encerrada',format:'Pontos corridos',status:'Finalizado',phase:'Campeão: Inter Brasil BDA',maxTeams:20,badge:'🥇',participants:['Inter Brasil BDA'],description:'A divisão de elite do Clã BDA.'},
    {id:'liga-b',name:'Liga B BDA',edition:'Temporada encerrada',format:'Pontos corridos',status:'Finalizado',phase:'Campeão: Vasco da Gama BDA',maxTeams:20,badge:'🛡️',participants:['Vasco da Gama BDA'],description:'A divisão de acesso para a Liga A BDA.'},
    {id:'copa-aguia',name:'Copa Águia BDA',edition:'Projeto futuro',format:'Mata-mata',status:'Planejado',phase:'Aguardando lançamento',maxTeams:16,badge:'🦅',participants:[],description:'Nova competição preparada para futuras temporadas do Clã BDA.'}
  ];

  const DATASETS = {
    teams: { key: 'bda-v2-teams', prefix: 'team' },
    champions: { key: 'bda-v2-champions', prefix: 'champion' },
    tournaments: { key: 'bda-v3-tournaments', prefix: 'tournament' }
  };

  function notify(message) {
    if (typeof toast === 'function') toast(message);
    else console.info(message);
  }

  if (!window.firebase || typeof firebase.firestore !== 'function' || typeof firebase.auth !== 'function') {
    notify('A sincronização com a nuvem não carregou');
    return;
  }

  const db = firebase.firestore();
  const auth = firebase.auth();
  const root = db.collection(COLLECTION);
  const metaRef = root.doc(META_ID);
  const serverTimestamp = firebase.firestore.FieldValue.serverTimestamp;

  const nativeSetItem = Storage.prototype.setItem;
  const nativeRemoveItem = Storage.prototype.removeItem;
  const timers = {};
  const seenRevisions = {};
  const knownCounts = {};

  let applyingRemote = false;
  let cloudInitialized = false;
  let currentMeta = null;
  let currentUser = null;
  let statusElement = null;
  let uploadButton = null;
  let downloadButton = null;
  let syncBusy = false;

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function isAdminUser(user = currentUser) {
    return Boolean(user && String(user.email || '').toLowerCase() === ADMIN_EMAIL);
  }

  function stable(value) {
    if (Array.isArray(value)) return value.map(stable);
    if (value && typeof value === 'object') {
      return Object.keys(value).sort().reduce((result, key) => {
        result[key] = stable(value[key]);
        return result;
      }, {});
    }
    return value;
  }

  function stableStringify(value) {
    return JSON.stringify(stable(value));
  }

  function itemBytes(value) {
    return new Blob([JSON.stringify(value)]).size;
  }

  function validateDataset(name, values) {
    if (!Array.isArray(values)) throw new Error(`Dados inválidos em ${name}`);
    values.forEach((value, index) => {
      if (itemBytes(value) > MAX_ITEM_BYTES) {
        throw new Error(`A imagem do item ${index + 1} está grande demais para o Firestore`);
      }
    });
  }

  function documentId(prefix, index) {
    return `${prefix}-${String(index).padStart(4, '0')}`;
  }

  function readLocal(name) {
    if (name === 'teams' && typeof teams !== 'undefined' && Array.isArray(teams)) return clone(teams);
    if (name === 'champions' && typeof champions !== 'undefined' && Array.isArray(champions)) return clone(champions);

    const config = DATASETS[name];
    try {
      const stored = JSON.parse(localStorage.getItem(config.key));
      if (Array.isArray(stored)) return stored;
    } catch (error) {
      console.warn('Falha ao ler dados locais', name, error);
    }

    if (name === 'tournaments') return clone(DEFAULT_TOURNAMENTS);
    return [];
  }

  function setStatus(text, state = '') {
    if (!statusElement) return;
    statusElement.textContent = text;
    statusElement.dataset.state = state;
  }

  function updateControls() {
    const admin = isAdminUser();
    if (uploadButton) uploadButton.hidden = !admin;
    if (downloadButton) downloadButton.hidden = !admin || !cloudInitialized;
  }

  function buildInterface() {
    const styles = document.createElement('style');
    styles.textContent = `
      .cloud-status{display:inline-flex;align-items:center;min-height:30px;padding:0 9px;border:1px solid var(--line);border-radius:999px;color:var(--muted);background:rgba(255,255,255,.035);font-size:9px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;white-space:nowrap}
      .cloud-status[data-state="ok"]{color:var(--green);border-color:rgba(79,223,143,.28);background:rgba(79,223,143,.08)}
      .cloud-status[data-state="warn"]{color:var(--gold-soft);border-color:var(--line-strong);background:rgba(216,178,72,.08)}
      .cloud-status[data-state="error"]{color:#ff9aa4;border-color:rgba(255,105,120,.34);background:rgba(255,105,120,.08)}
      .cloud-tools{display:flex;flex-wrap:wrap;gap:8px;margin-top:10px}
      .cloud-tools button{min-height:40px}
      @media(max-width:430px){.cloud-status{max-width:92px;overflow:hidden;text-overflow:ellipsis}.top-actions{gap:6px}}
    `;
    document.head.appendChild(styles);

    const actions = document.querySelector('.top-actions');
    if (actions) {
      statusElement = document.createElement('span');
      statusElement.className = 'cloud-status';
      statusElement.textContent = 'Conectando';
      actions.prepend(statusElement);
    }

    const adminPanel = document.getElementById('adminPanel');
    if (adminPanel) {
      const paragraph = adminPanel.querySelector('p');
      if (paragraph) paragraph.textContent = 'Campeonatos, clubes, escudos e campeões podem ser sincronizados entre celular e computador.';

      const tools = document.createElement('div');
      tools.className = 'cloud-tools';
      tools.innerHTML = `
        <button class="primary" id="cloudUploadBtn" type="button">Enviar este aparelho para a nuvem</button>
        <button class="ghost" id="cloudDownloadBtn" type="button">Baixar dados da nuvem</button>
      `;
      adminPanel.appendChild(tools);
      uploadButton = document.getElementById('cloudUploadBtn');
      downloadButton = document.getElementById('cloudDownloadBtn');

      uploadButton.addEventListener('click', () => {
        const message = cloudInitialized
          ? 'Substituir os dados da nuvem pelos dados deste aparelho?'
          : 'Usar os dados deste aparelho como primeira versão da nuvem?';
        if (confirm(message)) uploadAll();
      });
      downloadButton.addEventListener('click', () => downloadAll(true));
    }
  }

  async function runSequential(tasks) {
    for (const task of tasks) await task();
  }

  async function writeRawDataset(name, values, previousCount, revision) {
    validateDataset(name, values);
    const config = DATASETS[name];
    const tasks = values.map((value, index) => () => root.doc(documentId(config.prefix, index)).set({
      dataset: name,
      position: index,
      revision,
      value
    }));

    for (let index = values.length; index < previousCount; index += 1) {
      tasks.push(() => root.doc(documentId(config.prefix, index)).delete());
    }

    await runSequential(tasks);
    knownCounts[name] = values.length;
  }

  async function readRemoteDataset(name, count) {
    const config = DATASETS[name];
    const reads = [];
    for (let index = 0; index < count; index += 1) {
      reads.push(root.doc(documentId(config.prefix, index)).get());
    }
    const snapshots = await Promise.all(reads);
    return snapshots
      .filter(snapshot => snapshot.exists)
      .sort((a, b) => Number(a.data().position) - Number(b.data().position))
      .map(snapshot => snapshot.data().value);
  }

  function applyRemoteDatasets(remote) {
    let changed = false;
    applyingRemote = true;
    try {
      Object.entries(remote).forEach(([name, values]) => {
        const config = DATASETS[name];
        const localValues = readLocal(name);
        if (stableStringify(localValues) === stableStringify(values)) return;
        nativeSetItem.call(localStorage, config.key, JSON.stringify(values));
        changed = true;
      });
    } finally {
      applyingRemote = false;
    }
    return changed;
  }

  function cloudErrorMessage(error) {
    const code = String(error?.code || '');
    if (code.includes('permission-denied')) return 'Publique as regras do Firestore para liberar a sincronização';
    if (code.includes('unavailable')) return 'Sem conexão com a nuvem no momento';
    if (code.includes('resource-exhausted') || code.includes('invalid-argument')) return 'Uma imagem está grande demais para a nuvem';
    return 'Falha ao sincronizar com o Firestore';
  }

  async function uploadAll() {
    if (syncBusy || !isAdminUser()) return;
    syncBusy = true;
    setStatus('Enviando', 'warn');
    try {
      const values = {};
      const counts = {};
      const revisions = {};

      Object.keys(DATASETS).forEach(name => {
        values[name] = readLocal(name);
        validateDataset(name, values[name]);
        counts[name] = values[name].length;
        revisions[name] = `${Date.now()}-${name}-${Math.random().toString(36).slice(2, 8)}`;
      });

      for (const name of Object.keys(DATASETS)) {
        const oldCount = Number(knownCounts[name] ?? currentMeta?.counts?.[name] ?? 0);
        await writeRawDataset(name, values[name], oldCount, revisions[name]);
      }

      await metaRef.set({
        initialized: true,
        schemaVersion: 1,
        counts,
        revisions,
        updatedAt: serverTimestamp(),
        updatedBy: String(currentUser.email || '').toLowerCase()
      });

      cloudInitialized = true;
      currentMeta = { initialized: true, counts, revisions };
      Object.assign(seenRevisions, revisions);
      Object.assign(knownCounts, counts);
      setStatus('Sincronizado', 'ok');
      updateControls();
      notify('Dados enviados para a nuvem');
    } catch (error) {
      console.error(error);
      setStatus('Erro na nuvem', 'error');
      notify(cloudErrorMessage(error));
    } finally {
      syncBusy = false;
    }
  }

  async function uploadDataset(name) {
    if (syncBusy || applyingRemote || !cloudInitialized || !isAdminUser()) return;
    syncBusy = true;
    setStatus('Salvando', 'warn');
    try {
      const values = readLocal(name);
      const revision = `${Date.now()}-${name}-${Math.random().toString(36).slice(2, 8)}`;
      const oldCount = Number(knownCounts[name] ?? currentMeta?.counts?.[name] ?? 0);
      await writeRawDataset(name, values, oldCount, revision);
      await metaRef.update({
        [`counts.${name}`]: values.length,
        [`revisions.${name}`]: revision,
        updatedAt: serverTimestamp(),
        updatedBy: String(currentUser.email || '').toLowerCase()
      });
      seenRevisions[name] = revision;
      knownCounts[name] = values.length;
      setStatus('Sincronizado', 'ok');
    } catch (error) {
      console.error(error);
      setStatus('Erro na nuvem', 'error');
      notify(cloudErrorMessage(error));
    } finally {
      syncBusy = false;
    }
  }

  async function downloadAll(forceNotice = false) {
    if (syncBusy) return;
    syncBusy = true;
    setStatus('Baixando', 'warn');
    try {
      const metaSnapshot = await metaRef.get();
      if (!metaSnapshot.exists || !metaSnapshot.data().initialized) {
        cloudInitialized = false;
        setStatus('Nuvem vazia', 'warn');
        updateControls();
        if (forceNotice) notify('A nuvem ainda não possui dados');
        return;
      }

      const meta = metaSnapshot.data();
      const remote = {};
      for (const name of Object.keys(DATASETS)) {
        remote[name] = await readRemoteDataset(name, Number(meta.counts?.[name] || 0));
        seenRevisions[name] = meta.revisions?.[name] || '';
        knownCounts[name] = Number(meta.counts?.[name] || 0);
      }

      currentMeta = meta;
      cloudInitialized = true;
      updateControls();
      const changed = applyRemoteDatasets(remote);
      setStatus('Sincronizado', 'ok');

      if (changed) {
        sessionStorage.setItem('arena-cloud-message', 'Dados atualizados pela nuvem');
        location.reload();
      } else if (forceNotice) {
        notify('Este aparelho já está atualizado');
      }
    } catch (error) {
      console.error(error);
      setStatus('Sem acesso', 'error');
      notify(cloudErrorMessage(error));
    } finally {
      syncBusy = false;
    }
  }

  function scheduleUploadByKey(key) {
    const name = Object.keys(DATASETS).find(dataset => DATASETS[dataset].key === key);
    if (!name || applyingRemote || !cloudInitialized || !isAdminUser()) return;
    clearTimeout(timers[name]);
    timers[name] = setTimeout(() => uploadDataset(name), 650);
  }

  function installStorageHooks() {
    try {
      Storage.prototype.setItem = function setItemWithCloud(key, value) {
        nativeSetItem.call(this, key, value);
        if (this === localStorage) scheduleUploadByKey(key);
      };

      Storage.prototype.removeItem = function removeItemWithCloud(key) {
        nativeRemoveItem.call(this, key);
        if (this === localStorage) {
          setTimeout(() => scheduleUploadByKey(key), 50);
        }
      };
    } catch (error) {
      console.warn('Não foi possível instalar o sincronizador local', error);
    }
  }

  buildInterface();
  installStorageHooks();

  const reloadMessage = sessionStorage.getItem('arena-cloud-message');
  if (reloadMessage) {
    sessionStorage.removeItem('arena-cloud-message');
    setTimeout(() => notify(reloadMessage), 300);
  }

  auth.onAuthStateChanged(user => {
    currentUser = user;
    updateControls();
  });

  metaRef.onSnapshot(async snapshot => {
    if (!snapshot.exists || !snapshot.data().initialized) {
      cloudInitialized = false;
      currentMeta = null;
      setStatus('Nuvem vazia', 'warn');
      updateControls();
      return;
    }

    const meta = snapshot.data();
    currentMeta = meta;
    cloudInitialized = true;
    Object.keys(DATASETS).forEach(name => {
      knownCounts[name] = Number(meta.counts?.[name] || 0);
    });
    updateControls();

    const changedNames = Object.keys(DATASETS).filter(name => {
      const revision = meta.revisions?.[name] || '';
      return revision && revision !== seenRevisions[name];
    });

    if (!changedNames.length) {
      setStatus('Sincronizado', 'ok');
      return;
    }

    setStatus('Atualizando', 'warn');
    try {
      const remote = {};
      for (const name of changedNames) {
        remote[name] = await readRemoteDataset(name, Number(meta.counts?.[name] || 0));
        seenRevisions[name] = meta.revisions?.[name] || '';
      }
      const changed = applyRemoteDatasets(remote);
      setStatus('Sincronizado', 'ok');
      if (changed) {
        sessionStorage.setItem('arena-cloud-message', 'Alterações sincronizadas entre os aparelhos');
        location.reload();
      }
    } catch (error) {
      console.error(error);
      setStatus('Erro na nuvem', 'error');
      notify(cloudErrorMessage(error));
    }
  }, error => {
    console.error(error);
    setStatus('Sem acesso', 'error');
    notify(cloudErrorMessage(error));
  });
})();
