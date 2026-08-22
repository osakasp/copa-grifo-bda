(() => {
  'use strict';

  if (window.ArenaBDAMobileBracketV4?.version >= 4) return;

  const TID = 'bda-super-league';
  const MATCH_KEY = 'bda-v3-confrontos';
  const STYLE_ID = 'arenaMobileBracketV4Styles';
  const phases = ['Repescagem','Play-in','Quartas de final','Semifinal','Final'];
  let activePhase = 'Repescagem';
  let frame = 0;

  const norm = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toLowerCase();
  const esc = value => String(value ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  const has = value => value !== '' && value != null && !Number.isNaN(Number(value));
  const read = (key,fallback) => { try{return JSON.parse(localStorage.getItem(key)) ?? fallback;}catch{return fallback;} };

  function games(){
    const store = read(MATCH_KEY,{});
    const list = store && typeof store === 'object' ? store[TID] : [];
    return Array.isArray(list) ? list : [];
  }
  function knockoutGames(){
    return games().filter(game => String(game?.id || '').startsWith('mata-') || /repescagem|play-in|quartas|semifinal|semi-final|\bfinal\b/i.test(String(game?.phase || '')));
  }
  function phaseFor(game){
    const phase = norm(game?.phase);
    if(phase.includes('repesc')) return 'Repescagem';
    if(phase.includes('play-in') || phase.includes('play in')) return 'Play-in';
    if(phase.includes('quart')) return 'Quartas de final';
    if(phase.includes('semi')) return 'Semifinal';
    if(phase === 'final' || phase.includes('grande final')) return 'Final';
    return '';
  }
  function phaseGames(phase){
    return knockoutGames().filter(game => phaseFor(game) === phase).sort((a,b)=>Number(a?.pos||0)-Number(b?.pos||0)||Number(a?.created||0)-Number(b?.created||0));
  }
  function byId(reference){
    const needle = norm(reference).replace(/\s+/g,'');
    return knockoutGames().find(game => {
      const id = norm(game?.id).replace(/-(volta|ida|v)$/i,'').replace(/\s+/g,'');
      const tie = norm(game?.tieId).replace(/\s+/g,'');
      return id === needle || tie === needle;
    }) || null;
  }
  function score(game,side){
    if(game?.wo === 'a') return side === 'a' ? 3 : 0;
    if(game?.wo === 'b') return side === 'b' ? 3 : 0;
    const value = side === 'a' ? game?.a : game?.b;
    return has(value) ? Number(value) : null;
  }
  function resolve(slot,seen=new Set()){
    const value = String(slot || '');
    const match = value.match(/^Vencedor\s+(.+)$/i);
    if(!match) return value;
    const source = byId(match[1]);
    return winner(source,new Set(seen)) || 'Aguardando vencedor';
  }
  function winner(game,seen=new Set()){
    if(!game || seen.has(String(game.id))) return '';
    seen.add(String(game.id));
    const home = resolve(game.ta,seen);
    const away = resolve(game.tb,seen);
    const a = score(game,'a'), b = score(game,'b');
    if(a == null || b == null) return '';
    if(a > b) return home;
    if(b > a) return away;
    if(has(game.pa) && has(game.pb) && Number(game.pa) !== Number(game.pb)) return Number(game.pa) > Number(game.pb) ? home : away;
    return '';
  }
  function done(game){ return ['a','b'].includes(game?.wo) || (has(game?.a) && has(game?.b)); }
  function scoreText(game,side){ const value=score(game,side); return value == null ? '–' : String(value); }
  function badgeLabel(game,side){
    const name = resolve(side === 'a' ? game?.ta : game?.tb);
    if(/aguardando vencedor/i.test(name)) return 'AG';
    return String(name || 'BDA').split(/\s+/).filter(Boolean).slice(0,2).map(part=>part[0]).join('').toUpperCase();
  }
  function matchCard(game){
    const home = resolve(game.ta), away = resolve(game.tb), decided = winner(game);
    return `<article class="arena-v4-bracket-card" data-game-id="${esc(game.id)}"><span class="arena-v4-match-note">${esc(game.note || 'Jogo único')}</span><div class="${decided&&norm(decided)===norm(home)?'winner':''}"><i>${esc(badgeLabel(game,'a'))}</i><b>${esc(home)}</b><strong>${esc(scoreText(game,'a'))}</strong></div><div class="${decided&&norm(decided)===norm(away)?'winner':''}"><i>${esc(badgeLabel(game,'b'))}</i><b>${esc(away)}</b><strong>${esc(scoreText(game,'b'))}</strong></div><small>${done(game)?'Resultado definido':'Jogo único'}</small></article>`;
  }
  function structureExists(){ return knockoutGames().some(game => phaseFor(game) === 'Play-in'); }
  function groupComplete(){ return Boolean(window.ArenaBDASuperLeagueRuleV3?.groupsComplete?.()); }
  function phasePanel(phase){
    const list = phaseGames(phase);
    if(list.length) return `<div class="arena-v4-bracket-list">${list.map(matchCard).join('')}</div>`;
    if(phase === 'Repescagem'){
      const ready = groupComplete();
      const button = ready ? '<button type="button" class="primary arena-v4-generate-final">Gerar fase final</button>' : '';
      return `<div class="arena-v4-bracket-empty"><span>🏆</span><b>${ready?'Fase final pronta para gerar':'Aguardando fase de grupos'}</b><p>${ready?'Serão criadas 2 repescagens, 2 play-ins, 4 quartas, 2 semifinais e a final.':'1º e 2º se classificam. Os terceiros aguardam o fim dos grupos para disputar a repescagem.'}</p>${button}</div>`;
    }
    return `<div class="arena-v4-bracket-empty"><span>🏆</span><b>${esc(phase)} ainda não definida</b><p>Esta fase será preenchida pelos vencedores da etapa anterior.</p></div>`;
  }
  function preferredPhase(){
    if(!structureExists()) return 'Repescagem';
    for(const phase of phases){ const list=phaseGames(phase); if(list.length && list.some(game=>!done(game))) return phase; }
    return 'Final';
  }

  function render(){
    const manager = document.querySelector(`#giManager[data-tid="${TID}"]`);
    if(!manager) return;
    const anchor = manager.querySelector('.gi-bracket-progress,.gi-bracket-scroll,.arena-v3-bracket-shell');
    if(!anchor) return;
    manager.classList.add('arena-sl-v4-bracket-mode');
    let shell = manager.querySelector('.arena-v4-bracket-shell');
    if(!shell){ shell=document.createElement('section');shell.className='arena-v4-bracket-shell';anchor.before(shell);activePhase=preferredPhase(); }
    if(!phases.includes(activePhase)) activePhase=preferredPhase();
    const list = phaseGames(activePhase);
    const sig = JSON.stringify([activePhase,groupComplete(),structureExists(),list.map(game=>[game.id,game.ta,game.tb,game.a,game.b,game.pa,game.pb,game.wo,game.updated])]);
    if(shell.dataset.signature === sig) return;
    shell.dataset.signature = sig;
    shell.innerHTML = `<header class="arena-v4-bracket-head"><div><span class="eyebrow">Mata-mata</span><h2>Fase final</h2></div><small>Repescagem → Play-in → Quartas → Semifinal → Final</small></header><nav class="arena-v4-bracket-tabs" aria-label="Fases do mata-mata">${phases.map(phase=>`<button type="button" data-arena-v4-phase="${esc(phase)}" class="${phase===activePhase?'active':''}">${esc(phase==='Quartas de final'?'Quartas':phase)}</button>`).join('')}</nav><div class="arena-v4-bracket-stage">${phasePanel(activePhase)}</div>`;
  }

  function patchGenerator(){
    const manager=document.querySelector(`#giManager[data-tid="${TID}"]`);
    const legacy=manager?.querySelector('.league-knockout-card [data-generate-knockout]');
    if(!legacy) return;
    legacy.hidden=true;legacy.setAttribute('aria-hidden','true');
    let button=legacy.parentElement?.querySelector('.arena-v4-generate-final');
    if(!button){button=document.createElement('button');button.type='button';button.className=`${legacy.className||'primary'} arena-v4-generate-final`;legacy.after(button);}
    const generated=structureExists();
    button.disabled=!groupComplete()||generated;
    button.textContent=generated?'Fase final gerada':groupComplete()?'Gerar fase final':'Aguardando fase de grupos';
  }

  function installStyles(){
    if(document.getElementById(STYLE_ID)) return;
    const style=document.createElement('style');style.id=STYLE_ID;style.textContent=`
      #giManager[data-tid="bda-super-league"].arena-sl-v4-bracket-mode :is(.gi-bracket-progress,.gi-bracket-scroll,.arena-v3-bracket-shell){display:none!important}
      .arena-v4-bracket-shell{margin-top:10px}.arena-v4-bracket-head{display:flex;align-items:end;justify-content:space-between;gap:12px;margin-bottom:10px}.arena-v4-bracket-head h2{margin:3px 0 0;font-size:26px;text-transform:none}.arena-v4-bracket-head small{color:var(--muted);font-size:8px;text-align:right}.arena-v4-bracket-tabs{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:5px;padding:5px;border:1px solid var(--line);border-radius:12px;background:#06100a}.arena-v4-bracket-tabs button{min-height:38px;padding:0 8px;border:0;border-radius:8px;color:#84958b;background:transparent;font-size:9px;font-weight:850}.arena-v4-bracket-tabs button.active{color:#14130c;background:#d8b248}.arena-v4-bracket-stage{margin-top:8px}.arena-v4-bracket-list{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.arena-v4-bracket-card{padding:10px;border:1px solid rgba(255,255,255,.075);border-radius:13px;background:#09150d}.arena-v4-match-note{display:block;margin-bottom:7px;color:#82958a;font-size:7px}.arena-v4-bracket-card>div{display:grid;grid-template-columns:28px minmax(0,1fr) 26px;align-items:center;gap:7px;min-height:42px;padding:5px;border-top:1px solid rgba(255,255,255,.055)}.arena-v4-bracket-card>div.winner{color:#69e69b;background:rgba(79,223,143,.045)}.arena-v4-bracket-card i{display:grid;place-items:center;width:28px;height:28px;border-radius:9px;color:#171207;background:#d8b248;font-size:7px;font-style:normal;font-weight:900}.arena-v4-bracket-card b{overflow:hidden;font-size:10px;text-overflow:ellipsis;white-space:nowrap}.arena-v4-bracket-card strong{text-align:center;font:900 19px 'Barlow Condensed',sans-serif}.arena-v4-bracket-card>small{display:block;margin-top:6px;color:#718279;font-size:7px;text-align:center}.arena-v4-bracket-empty{display:grid;place-items:center;min-height:180px;padding:22px;border:1px dashed rgba(216,178,72,.26);border-radius:14px;color:#91a197;background:#06100a;text-align:center}.arena-v4-bracket-empty>span{font-size:26px}.arena-v4-bracket-empty>b{margin-top:7px;color:#eef4ef;font-size:15px}.arena-v4-bracket-empty>p{max-width:500px;margin:6px 0 12px;font-size:9px;line-height:1.5}
      @media(max-width:760px){.arena-v4-bracket-head{display:block}.arena-v4-bracket-head small{display:block;margin-top:5px;text-align:left}.arena-v4-bracket-tabs{position:sticky;top:66px;z-index:22;grid-template-columns:repeat(5,max-content);overflow-x:auto;justify-content:start;scrollbar-width:none}.arena-v4-bracket-tabs::-webkit-scrollbar{display:none}.arena-v4-bracket-tabs button{min-width:82px}.arena-v4-bracket-list{grid-template-columns:1fr}}
    `;document.head.append(style);
  }

  function refresh(){frame=0;installStyles();patchGenerator();render();}
  function schedule(){if(frame)return;frame=requestAnimationFrame(refresh);}
  document.addEventListener('click',event=>{
    const phase=event.target.closest?.('[data-arena-v4-phase]');
    if(phase){activePhase=phase.dataset.arenaV4Phase||'Repescagem';render();return;}
  });
  ['arena:bundle-loaded','arena:matches-updated','arena:tournaments-updated','arena:auth-changed','arena:cloud-ready','arena:quick-score-saved'].forEach(type=>window.addEventListener(type,schedule));
  const observer=new MutationObserver(schedule);observer.observe(document.documentElement,{childList:true,subtree:true});
  window.ArenaBDAMobileBracketV4=Object.freeze({version:4,refresh,render,preferredPhase});
  refresh();
})();
