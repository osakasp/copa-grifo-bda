(() => {
  'use strict';

  const COLLECTION = 'arenaData';
  const META_ID = 'meta';
  const MAX_ITEM_BYTES = 800 * 1024;
  const WRITE_BATCH_SIZE = 350;

  const DEFAULT_TOURNAMENTS = [
    {id:'copa-grifo',name:'Copa Grifo BDA',edition:'8ª edição',format:'Mata-mata',status:'Finalizado',phase:'Campeão definido',maxTeams:19,badge:'🦅',participants:['Zombie FC BDA','JOGOBUGADO BDA','Inter Brasil BDA','Vasco da Gama BDA'],description:'Competição tradicional do Clã BDA em formato eliminatório e jogo único.',legacy:true,locked:true},
    {id:'copa-francos',name:'Copa Francos',edition:'Próxima edição',format:'Mata-mata',status:'Planejado',phase:'Preparação',maxTeams:16,badge:'🕊️',participants:[],description:'Competição especial em homenagem à história do Francos FC BDA.'},
    {id:'supercopa',name:'Supercopa BDA',edition:'Nova edição',format:'Grupos + mata-mata',status:'Inscrições abertas',phase:'Preparação',maxTeams:25,badge:'🏆',participants:['Esperança BDA','Boca Juniors','HELLYEAH BDA','SPORT RECIFE BDA','NACIONAL AC BDA','SANTOS RB BDA','BDA URDLS','CV CRUZ BDA','INDEPENDENTE FC APOSENTADO BDA','FLAMESTRE FC DF BDA','IMORTAIS FC BDA','BDA GOLDEN','Zombie FC BDA','JOGOBUGADO BDA','Vasco da Gama BDA','São Paulo BDA'],deadline:'24h por rodada',description:'Campeonato oficial do Clã BDA.'},
    {id:'liga-a',name:'Liga A BDA',edition:'Temporada encerrada',format:'Pontos corridos',status:'Finalizado',phase:'Campeão: Inter Brasil BDA',maxTeams:20,badge:'🥇',participants:['Inter Brasil BDA'],description:'A divisão de elite do Clã BDA.'},
    {id:'liga-b',name:'Liga B BDA',edition:'Temporada encerrada',format:'Pontos corridos',status:'Finalizado',phase:'Campeão: Vasco da Gama BDA',maxTeams:20,badge:'🛡️',participants:['Vasco da Gama BDA'],description:'A divisão de acesso para a Liga A BDA.'}
  ];

  const DATASETS = {
    teams: { key: 'bda-v2-teams', prefix: 'team' },
    champions: { key: 'bda-v2-champions', prefix: 'champion' },
    championRanking: { key: 'bda-champion-ranking', prefix: 'champion-ranking' },
    tournaments: { key: 'bda-v3-tournaments', prefix: 'tournament' }
  };

  const authCore = window.ArenaBDAAuth;

  function notify(message) {
    if (typeof toast === 'function') toast(message);
    else console.info(message);
  }

  if (!authCore?.subscribe || !window.firebase || typeof firebase.firestore !== 'function') {
    notify('A sincronização com a nuvem não carregou');
    return;
  }

  const db = firebase.firestore();
  const root = db.collection(COLLECTION);
  const metaRef = root.doc(META_ID);
  const serverTimestamp = firebase.firestore.FieldValue.serverTimestamp;
  const nativeSetItem = Storage.prototype.setItem;
  const nativeRemoveItem = Storage.prototype.removeItem;

  const timers = new Map();
  const seenRevisions = {};
  const knownCounts = {};
  let applyingRemote = false;
  let cloudInitialized = false;
  let currentMeta = null;
  let syncBusy = false;
  let statusElement = null;
  let uploadButton = null;
  let downloadButton = null;

  const clone = value => JSON.parse(JSON.stringify(value));
  const isSupercopa = item => {
    const id = String(item?.id || '').toLowerCase();
    const name = String(item?.name || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '');
    return id === 'supercopa' || id.startsWith('super-copa-bda-') || name.includes('supercopabda');
  };
  const restoreSupercopa = values => {
    if (!Array.isArray(values) || values.some(isSupercopa)) return values;
    return [clone(DEFAULT_TOURNAMENTS.find(isSupercopa)), ...values];
  };

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

  const stableStringify = value => JSON.stringify(stable(value));
  const documentId = (prefix, index) => `${prefix}-${String(index).padStart(4, '0')}`;

  function encodeRemoteValue(name, value) {
    if (name !== 'championRanking' || !value || typeof value !== 'object') return value;
    return {
      ...value,
      achievements: Array.isArray(value.achievements)
        ? value.achievements.map(item => ({
          competition: String(Array.isArray(item) ? item[0] || '' : item?.competition || ''),
          editions: String(Array.isArray(item) ? item[1] || '' : item?.editions || '')
        }))
        : []
    };
  }

  function decodeRemoteValue(name, value) {
    if (name !== 'championRanking' || !value || typeof value !== 'object') return value;
    return {
      ...value,
      achievements: Array.isArray(value.achievements)
        ? value.achievements.map(item => Array.isArray(item)
          ? [String(item[0] || ''), String(item[1] || '')]
          : [String(item?.competition || ''), String(item?.editions || '')])
        : []
    };
  }

  function itemBytes(value) {
    return new Blob([JSON.stringify(value)]).size;
  }

  function validateDataset(name, values) {
    if (!Array.isArray(values)) throw new Error(`Dados inválidos em ${name}`);
    values.forEach((value, index) => {
      if (itemBytes(value) > MAX_ITEM_BYTES) {
        throw new Error(`O item ${index + 1} de ${name} está grande demais para a nuvem`);
      }
    });
  }

  function readStored(key, fallback = []) {
    try {
      const value = JSON.parse(localStorage.getItem(key));
      return Array.isArray(value) ? value : fallback;
    } catch {
      return fallback;
    }
  }

  function readLocal(name) {
    if (name === 'teams' && Array.isArray(window.teams)) return clone(window.teams);
    if (name === 'champions' && Array.isArray(window.champions)) return clone(window.champions);
    if (name === 'championRanking' && Array.isArray(window.ArenaBDAChampionRanking?.champions)) {
      return clone(window.ArenaBDAChampionRanking.champions);
    }
    const config = DATASETS[name];
    if (name === 'tournaments') return restoreSupercopa(readStored(config.key, clone(DEFAULT_TOURNAMENTS)));
    return readStored(config.key, []);
  }

  function setStatus(text, state = '', detail = '') {
    if (!statusElement) return;
    statusElement.textContent = text;
    statusElement.dataset.state = state;
    statusElement.title = detail;
    window.dispatchEvent(new CustomEvent('arena:cloud-status', { detail: { text, state, detail } }));
  }

  function updateControls() {
    const admin = authCore.isAdmin();
    if (uploadButton) uploadButton.hidden = !admin;
    if (downloadButton) downloadButton.hidden = !admin || !cloudInitialized;
  }

  function buildInterface() {
    if (!document.getElementById('arenaCloudSyncStyles')) {
      const styles = document.createElement('style');
      styles.id = 'arenaCloudSyncStyles';
      styles.textContent = `
        .cloud-status{display:inline-flex;align-items:center;min-height:30px;padding:0 9px;border:1px solid var(--line);border-radius:999px;color:var(--muted);background:rgba(255,255,255,.035);font-size:9px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;white-space:nowrap}
        .cloud-status[data-state="ok"]{color:var(--green);border-color:rgba(79,223,143,.28);background:rgba(79,223,143,.08)}
        .cloud-status[data-state="warn"]{color:var(--gold-soft);border-color:var(--line-strong);background:rgba(216,178,72,.08)}
        .cloud-status[data-state="error"]{color:#ff9aa4;border-color:rgba(255,105,120,.34);background:rgba(255,105,120,.08)}
        .cloud-tools{display:flex;flex-wrap:wrap;gap:8px;margin-top:10px}.cloud-tools button{min-height:40px}
        @media(max-width:430px){.cloud-status{max-width:92px;overflow:hidden;text-overflow:ellipsis}.top-actions{gap:6px}}
      `;
      document.head.append(styles);
    }

    const actions = document.querySelector('.top-actions');
    statusElement = document.querySelector('.cloud-status');
    if (!statusElement && actions) {
      statusElement = document.createElement('span');
      statusElement.className = 'cloud-status';
      statusElement.textContent = 'Conectando';
      actions.prepend(statusElement);
    }

    const adminPanel = document.getElementById('adminPanel');
    if (adminPanel && !document.getElementById('cloudUploadBtn')) {
      const tools = document.createElement('div');
      tools.className = 'cloud-tools';
      tools.innerHTML = `
        <button class="primary" id="cloudUploadBtn" type="button">Enviar este aparelho para a nuvem</button>
        <button class="ghost" id="cloudDownloadBtn" type="button">Baixar dados da nuvem</button>
      `;
      adminPanel.append(tools);
    }

    uploadButton = document.getElementById('cloudUploadBtn');
    downloadButton = document.getElementById('cloudDownloadBtn');

    uploadButton?.addEventListener('click', async () => {
      const message = cloudInitialized
        ? 'Substituir os dados da nuvem pelos dados deste aparelho?'
        : 'Usar os dados deste aparelho como primeira versão da nuvem?';
      if (confirm(message)) await uploadAll();
    });
    downloadButton?.addEventListener('click', () => downloadAll(true));
    updateControls();
  }

  async function runBatches(operations) {
    for (let start = 0; start < operations.length; start += WRITE_BATCH_SIZE) {
      const batch = db.batch();
      operations.slice(start, start + WRITE_BATCH_SIZE).forEach(operation => {
        if (operation.type === 'delete') batch.delete(operation.ref);
        else batch.set(operation.ref, operation.data);
      });
      await batch.commit();
    }
  }

  async function writeDataset(name, values, previousCount, revision) {
    validateDataset(name, values);
    const config = DATASETS[name];
    const operations = values.map((value, index) => ({
      type: 'set',
      ref: root.doc(documentId(config.prefix, index)),
      data: { dataset: name, position: index, revision, value: encodeRemoteValue(name, value) }
    }));

    for (let index = values.length; index < previousCount; index += 1) {
      operations.push({ type: 'delete', ref: root.doc(documentId(config.prefix, index)) });
    }

    await runBatches(operations);
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
      .map(snapshot => decodeRemoteValue(name, snapshot.data().value));
  }

  function applyRemoteDatasets(remote) {
    let changed = false;
    applyingRemote = true;
    try {
      Object.entries(remote).forEach(([name, values]) => {
        const config = DATASETS[name];
        const nextValues = name === 'tournaments' ? restoreSupercopa(values) : values;
        const localValues = readLocal(name);
        if (stableStringify(localValues) === stableStringify(nextValues)) return;
        nativeSetItem.call(localStorage, config.key, JSON.stringify(nextValues));
        changed = true;
      });
    } finally {
      applyingRemote = false;
    }
    return changed;
  }

  function errorMessage(error) {
    const code = String(error?.code || '');
    const message = String(error?.message || '');
    if (code.includes('permission-denied')) return 'As regras do Firestore não liberaram esta conta';
    if (code.includes('unavailable')) return 'Sem conexão com a nuvem no momento';
    if (code.includes('resource-exhausted')) return 'O limite temporário do Firestore foi atingido';
    if (message.includes('Nested arrays are not supported')) return 'O formato do ranking não é compatível com a nuvem';
    if (code.includes('invalid-argument')) return 'Uma imagem está grande demais para a nuvem';
    return message || 'Falha ao sincronizar com o Firestore';
  }

  async function prepareTeams() {
    if (!window.ArenaBDACloudRecovery?.prepare) return;
    const result = await window.ArenaBDACloudRecovery.prepare({ force: true });
    if (result?.error) throw result.error;
  }

  async function uploadAll() {
    if (syncBusy || !authCore.isAdmin()) return;
    syncBusy = true;
    setStatus('Enviando', 'warn');
    try {
      await prepareTeams();
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
        const previousCount = Number(knownCounts[name] ?? currentMeta?.counts?.[name] ?? 0);
        await writeDataset(name, values[name], previousCount, revisions[name]);
      }

      await metaRef.set({
        initialized: true,
        schemaVersion: 3,
        counts,
        revisions,
        updatedAt: serverTimestamp(),
        updatedBy: authCore.currentEmail()
      }, { merge: true });

      cloudInitialized = true;
      currentMeta = { ...(currentMeta || {}), initialized: true, counts, revisions };
      Object.assign(seenRevisions, revisions);
      Object.assign(knownCounts, counts);
      setStatus('Sincronizado', 'ok');
      updateControls();
      notify('Dados enviados para a nuvem');
    } catch (error) {
      console.error(error);
      setStatus('Erro na nuvem', 'error', errorMessage(error));
      notify(errorMessage(error));
    } finally {
      syncBusy = false;
    }
  }

  async function uploadDataset(name) {
    if (syncBusy || applyingRemote || !cloudInitialized || !authCore.isAdmin()) return;
    syncBusy = true;
    setStatus('Salvando', 'warn');
    try {
      if (name === 'teams') await prepareTeams();
      const values = readLocal(name);
      validateDataset(name, values);
      const revision = `${Date.now()}-${name}-${Math.random().toString(36).slice(2, 8)}`;
      const previousCount = Number(knownCounts[name] ?? currentMeta?.counts?.[name] ?? 0);
      await writeDataset(name, values, previousCount, revision);
      await metaRef.set({
        initialized: true,
        schemaVersion: 3,
        counts: { ...(currentMeta?.counts || {}), [name]: values.length },
        revisions: { ...(currentMeta?.revisions || {}), [name]: revision },
        updatedAt: serverTimestamp(),
        updatedBy: authCore.currentEmail()
      }, { merge: true });
      seenRevisions[name] = revision;
      knownCounts[name] = values.length;
      currentMeta = {
        ...(currentMeta || {}),
        counts: { ...(currentMeta?.counts || {}), [name]: values.length },
        revisions: { ...(currentMeta?.revisions || {}), [name]: revision }
      };
      setStatus('Sincronizado', 'ok');
    } catch (error) {
      console.error(error);
      setStatus('Erro na nuvem', 'error', errorMessage(error));
      notify(errorMessage(error));
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
        currentMeta = null;
        setStatus('Nuvem vazia', 'warn');
        updateControls();
        if (forceNotice) notify('A nuvem ainda não possui dados');
        return;
      }

      const meta = metaSnapshot.data();
      const remote = {};
      for (const name of Object.keys(DATASETS)) {
        const hasRemoteDataset = Object.prototype.hasOwnProperty.call(meta.counts || {}, name)
          || Object.prototype.hasOwnProperty.call(meta.revisions || {}, name);
        if (!hasRemoteDataset) {
          knownCounts[name] = 0;
          continue;
        }
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
      setStatus('Sem acesso', 'error', errorMessage(error));
      notify(errorMessage(error));
    } finally {
      syncBusy = false;
    }
  }

  function scheduleUploadByKey(key, delay = 700) {
    const name = Object.keys(DATASETS).find(dataset => DATASETS[dataset].key === key);
    if (!name || applyingRemote || !cloudInitialized || !authCore.isAdmin()) return;
    clearTimeout(timers.get(name));
    timers.set(name, setTimeout(() => uploadDataset(name), delay));
  }

  function installStorageHooks() {
    if (Storage.prototype.setItem.__arenaCloudSyncV2) return;

    function setItemWithCloud(key, value) {
      nativeSetItem.call(this, key, value);
      if (this === localStorage) scheduleUploadByKey(key, key === DATASETS.teams.key ? 1000 : 700);
    }
    setItemWithCloud.__arenaCloudSyncV2 = true;

    function removeItemWithCloud(key) {
      nativeRemoveItem.call(this, key);
      if (this === localStorage) scheduleUploadByKey(key, 750);
    }
    removeItemWithCloud.__arenaCloudSyncV2 = true;

    Storage.prototype.setItem = setItemWithCloud;
    Storage.prototype.removeItem = removeItemWithCloud;
  }

  buildInterface();
  installStorageHooks();

  const reloadMessage = sessionStorage.getItem('arena-cloud-message');
  if (reloadMessage) {
    sessionStorage.removeItem('arena-cloud-message');
    setTimeout(() => notify(reloadMessage), 300);
  }

  authCore.subscribe(() => {
    updateControls();
    if (!authCore.isAdmin()) setStatus(cloudInitialized ? 'Sincronizado' : 'Conectando', cloudInitialized ? 'ok' : '');
  });

  window.addEventListener('arena:teams-prepared-for-cloud', () => scheduleUploadByKey(DATASETS.teams.key, 200));

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
      setStatus('Erro na nuvem', 'error', errorMessage(error));
      notify(errorMessage(error));
    }
  }, error => {
    console.error(error);
    setStatus('Sem acesso', 'error', errorMessage(error));
    notify(errorMessage(error));
  });

  window.ArenaBDACloudSync = Object.freeze({
    uploadAll,
    downloadAll,
    uploadDataset,
    isReady: () => cloudInitialized,
    isBusy: () => syncBusy,
    meta: () => currentMeta ? clone(currentMeta) : null
  });
})();
