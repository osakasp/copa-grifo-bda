(() => {
  'use strict';

  if (window.ArenaBDAFlashDraw?.version >= 1) return;

  const norm = value => String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();

  function uniqueNames(values) {
    const names = new Map();
    (Array.isArray(values) ? values : []).forEach(value => {
      const name = String(value || '').trim();
      const key = norm(name);
      if (key && !names.has(key)) names.set(key, name);
    });
    return [...names.values()];
  }

  function randomSeed() {
    if (window.crypto?.getRandomValues) {
      const data = new Uint32Array(4);
      window.crypto.getRandomValues(data);
      return [...data].map(value => value.toString(16).padStart(8, '0')).join('-');
    }
    return `${Date.now().toString(16)}-${Math.random().toString(16).slice(2)}`;
  }

  function seedHash(seed) {
    let hash = 2166136261;
    for (const character of String(seed || '')) {
      hash ^= character.charCodeAt(0);
      hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
  }

  function seededRandom(seed) {
    let state = seedHash(seed);
    return () => {
      state += 0x6D2B79F5;
      let value = state;
      value = Math.imul(value ^ (value >>> 15), value | 1);
      value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
      return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
    };
  }

  function shuffle(values, seed) {
    const result = [...values];
    const random = seededRandom(seed);
    for (let index = result.length - 1; index > 0; index -= 1) {
      const target = Math.floor(random() * (index + 1));
      [result[index], result[target]] = [result[target], result[index]];
    }
    return result;
  }

  function largestPowerOfTwoAtMost(number) {
    let power = 1;
    while (power * 2 <= number) power *= 2;
    return power;
  }

  function phaseForSize(size) {
    if (size <= 2) return 'Final';
    if (size <= 4) return 'Semifinal';
    if (size <= 8) return 'Quartas de final';
    if (size <= 16) return 'Oitavas de final';
    if (size <= 32) return '16 avos de final';
    return 'Preliminar';
  }

  function build(values, suppliedSeed = '') {
    const participants = uniqueNames(values);
    if (participants.length < 2) throw new Error('Selecione pelo menos 2 times para o sorteio');
    if (participants.length > 64) throw new Error('O sorteio aceita no máximo 64 times');

    const seed = String(suppliedSeed || randomSeed());
    const shuffled = shuffle(participants, seed);
    const power = largestPowerOfTwoAtMost(shuffled.length);
    const preliminaryMatches = shuffled.length === power ? 0 : shuffled.length - power;
    const playingCount = preliminaryMatches ? preliminaryMatches * 2 : shuffled.length;
    const playing = shuffled.slice(0, playingCount);
    const byes = preliminaryMatches ? shuffled.slice(playingCount) : [];
    const phase = preliminaryMatches ? 'Preliminar' : phaseForSize(shuffled.length);
    const nextPhase = preliminaryMatches ? phaseForSize(power) : phaseForSize(Math.max(2, shuffled.length / 2));
    const pairs = [];

    for (let index = 0; index < playing.length; index += 2) {
      pairs.push({ position: pairs.length + 1, teamA: playing[index], teamB: playing[index + 1] });
    }

    return Object.freeze({
      seed,
      phase,
      nextPhase,
      participants: Object.freeze([...participants]),
      pairs: Object.freeze(pairs.map(pair => Object.freeze({ ...pair }))),
      byes: Object.freeze([...byes])
    });
  }

  window.ArenaBDAFlashDraw = Object.freeze({
    version: 1,
    build,
    phaseForSize,
    shuffle: (values, seed) => shuffle(uniqueNames(values), seed)
  });
})();
