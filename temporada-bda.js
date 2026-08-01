(() => {
  'use strict';
  if (window.ArenaBDASeason) return;

  const stages = [
    {
      number: 1,
      title: 'Ligas BDA',
      subtitle: 'A base competitiva da temporada',
      competitions: [
        { icon: '🥇', name: 'Liga A BDA', mode: 'Full Razz', format: 'Liga principal', audience: '12 melhores da BDA', rule: 'Os 4 últimos são rebaixados para a Liga B.', tone: 'elite' },
        { icon: '🥈', name: 'Liga B BDA', mode: 'Full Razz', format: 'Liga de acesso', audience: 'Jogadores fora da Liga A e novatos', rule: 'Os 4 primeiros conquistam o acesso para a Liga A.', tone: 'access' }
      ]
    },
    { number: 2, title: 'Supercopa BDA', subtitle: 'Encontro dos melhores das duas divisões', competitions: [{ icon: '⚡', name: 'Supercopa BDA', mode: 'Full Razz', format: 'Formato a confirmar', audience: '4 melhores da Liga A + 4 melhores da Liga B', rule: 'Oito classificados disputam o título da Supercopa.', tone: 'super' }] },
    { number: 3, title: 'Copa Grifo', subtitle: 'A competição eliminatória aberta', competitions: [{ icon: '🦅', name: 'Copa Grifo', mode: 'Full Livre', format: 'Mata-mata', audience: 'Todos os jogadores', rule: 'Os 6 melhores garantem vaga na Copa BDA.', tone: 'griffin' }] },
    { number: 4, title: 'Copa Águia', subtitle: 'Regularidade ao longo de toda a disputa', competitions: [{ icon: '🦅', name: 'Copa Águia', mode: 'Full Livre', format: 'Pontos corridos', audience: 'Todos os jogadores', rule: 'Os 6 melhores garantem vaga na Copa BDA.', tone: 'eagle' }] },
    { number: 5, title: 'Copa BDA', subtitle: 'A copa dos melhores classificados', competitions: [{ icon: '🏆', name: 'Copa BDA', mode: 'Full Livre', format: 'Formato a confirmar', audience: '6 melhores da Copa Grifo + 6 melhores da Copa Águia', rule: 'Doze classificados disputam a competição.', tone: 'cup' }] },
    { number: 6, title: 'BDA Super League', subtitle: 'O encerramento de elite da temporada', competitions: [{ icon: '🌟', name: 'BDA Super League', mode: 'Full Razz', format: 'Grupos + mata-mata', audience: 'Participantes definidos pela organização', rule: 'Os 2 melhores de cada grupo avançam para o mata-mata.', tone: 'finale' }] }
  ];

  const esc = value => String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  function competitionCard(item) {
    return `<article class="season-competition ${esc(item.tone)}">
      <header><span>${item.icon}</span><div><small>${esc(item.mode)}</small><h3>${esc(item.name)}</h3></div></header>
      <dl><div><dt>Formato</dt><dd>${esc(item.format)}</dd></div><div><dt>Participantes</dt><dd>${esc(item.audience)}</dd></div></dl>
      <p>${esc(item.rule)}</p>
    </article>`;
  }

  function stageCard(stage) {
    return `<section class="season-stage" id="seasonStage${stage.number}">
      <aside><b>${String(stage.number).padStart(2, '0')}</b><span>Etapa</span></aside>
      <div><header class="season-stage-head"><div><span>Campeonato ${stage.number}</span><h2>${esc(stage.title)}</h2><p>${esc(stage.subtitle)}</p></div><em>${stage.competitions.length > 1 ? `${stage.competitions.length} divisões` : 'Competição'}</em></header><div class="season-competition-grid">${stage.competitions.map(competitionCard).join('')}</div></div>
    </section>`;
  }

  function build() {
    const main = document.querySelector('.app-shell > main') || document.querySelector('main');
    if (!main) return false;
    let page = document.querySelector('[data-page="season"]');
    if (!page) {
      page = document.createElement('section');
      page.className = 'page season-page';
      page.dataset.page = 'season';
      main.append(page);
    }
    page.className = `page season-page${page.classList.contains('active') ? ' active' : ''}`;
    page.innerHTML = `<header class="season-hero"><div><span class="eyebrow">Calendário competitivo oficial</span><h1>Temporada BDA</h1><p>Seis etapas conectadas. Acesso, rebaixamento, classificação e títulos formam uma única jornada competitiva.</p><div class="season-hero-actions"><button class="primary" type="button" data-season-start>Ver primeira etapa</button><button class="secondary" type="button" data-go="tournament">Campeonatos atuais</button></div></div><aside><strong>6</strong><span>etapas</span><b>7 competições</b><small>Full Razz e Full Livre</small></aside></header>
      <section class="season-flow" aria-label="Fluxo da temporada"><span>Ligas A/B</span><i>→</i><span>Supercopa</span><i>→</i><span>Grifo</span><i>→</i><span>Águia</span><i>→</i><span>Copa BDA</span><i>→</i><span>Super League</span></section>
      <div class="season-stages">${stages.map(stageCard).join('')}</div>
      <section class="season-rules"><div><span class="eyebrow">Regras estruturais</span><h2>Como a temporada se conecta</h2></div><ul><li><b>Promoção:</b> quatro jogadores sobem da Liga B para a Liga A.</li><li><b>Rebaixamento:</b> quatro jogadores descem da Liga A para a Liga B.</li><li><b>Supercopa:</b> reúne os quatro melhores de cada divisão.</li><li><b>Copa BDA:</b> recebe seis classificados da Grifo e seis da Águia.</li><li><b>Super League:</b> dois classificados por grupo avançam ao mata-mata.</li></ul><p>Quantidade de grupos e participantes da Super League, além dos formatos da Supercopa e da Copa BDA, aguardam confirmação da organização.</p></section>`;
    return true;
  }

  function styles() {
    if (document.getElementById('arenaSeasonStyles')) return;
    const style = document.createElement('style');
    style.id = 'arenaSeasonStyles';
    style.textContent = `
      .season-page{gap:18px}.season-hero{position:relative;overflow:hidden;display:grid;grid-template-columns:minmax(0,1.35fr) minmax(220px,.65fr);align-items:end;gap:20px;min-height:390px;padding:34px;border:1px solid var(--line-strong);border-radius:30px;background:radial-gradient(circle at 84% 18%,rgba(242,215,125,.3),transparent 25%),linear-gradient(135deg,#174329,#07120c 62%,#020604);box-shadow:var(--shadow)}.season-hero:after{content:'BDA';position:absolute;right:-15px;bottom:-55px;color:#fff1;font:900 180px/1 'Barlow Condensed',sans-serif}.season-hero>div,.season-hero>aside{position:relative;z-index:1}.season-hero h1{max-width:730px;margin:8px 0;font-size:clamp(58px,10vw,96px);line-height:.84;text-transform:uppercase}.season-hero p{max-width:650px;margin:0;color:#d2ded6;font-size:13px;line-height:1.65}.season-hero-actions{display:flex;flex-wrap:wrap;gap:9px;margin-top:22px}.season-hero aside{display:grid;align-content:end;min-height:230px;padding:20px;border:1px solid rgba(242,215,125,.34);border-radius:23px;background:rgba(3,8,5,.62);backdrop-filter:blur(12px)}.season-hero aside strong,.season-hero aside span,.season-hero aside b,.season-hero aside small{display:block}.season-hero aside strong{color:var(--gold-soft);font:900 92px/.75 'Barlow Condensed',sans-serif}.season-hero aside span{margin-top:9px;color:var(--gold-soft);font-size:10px;font-weight:900;letter-spacing:.14em;text-transform:uppercase}.season-hero aside b{margin-top:18px;font-size:17px;text-transform:uppercase}.season-hero aside small{margin-top:5px;color:var(--muted);font-size:9px}.season-flow{display:flex;align-items:center;gap:7px;overflow-x:auto;padding:12px;border:1px solid var(--line);border-radius:18px;background:rgba(255,255,255,.025);scrollbar-width:none}.season-flow span{flex:0 0 auto;padding:9px 11px;border:1px solid rgba(242,215,125,.2);border-radius:999px;color:var(--gold-soft);background:rgba(216,178,72,.07);font-size:8px;font-weight:900;text-transform:uppercase}.season-flow i{color:var(--muted);font-style:normal}.season-stages{display:grid;gap:13px}.season-stage{display:grid;grid-template-columns:92px minmax(0,1fr);gap:17px;padding:20px;border:1px solid var(--line);border-radius:25px;background:linear-gradient(150deg,var(--surface-2),var(--surface));box-shadow:0 14px 34px rgba(0,0,0,.2)}.season-stage>aside{display:grid;place-items:center;align-content:center;min-height:150px;border:1px solid rgba(242,215,125,.24);border-radius:19px;background:radial-gradient(circle,rgba(216,178,72,.15),transparent 68%),#050b07}.season-stage>aside b{color:var(--gold-soft);font:900 48px/1 'Barlow Condensed',sans-serif}.season-stage>aside span{margin-top:4px;color:var(--muted);font-size:7px;font-weight:900;letter-spacing:.14em;text-transform:uppercase}.season-stage-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:12px}.season-stage-head span{color:var(--gold-soft);font-size:7px;font-weight:900;letter-spacing:.12em;text-transform:uppercase}.season-stage-head h2{margin:4px 0 2px;font-size:30px;text-transform:uppercase}.season-stage-head p{margin:0;color:var(--muted);font-size:9px}.season-stage-head em{padding:7px 9px;border-radius:999px;color:var(--green);background:rgba(79,223,143,.09);font-size:7px;font-style:normal;font-weight:900;text-transform:uppercase}.season-competition-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px}.season-competition-grid:has(.season-competition:only-child){grid-template-columns:1fr}.season-competition{overflow:hidden;border:1px solid var(--line);border-radius:18px;background:rgba(3,9,6,.55)}.season-competition>header{display:flex;align-items:center;gap:11px;padding:13px;border-bottom:1px solid var(--line)}.season-competition>header>span{display:grid;place-items:center;width:43px;height:43px;border:1px solid rgba(242,215,125,.3);border-radius:13px;background:rgba(216,178,72,.09);font-size:22px}.season-competition small{color:var(--gold-soft);font-size:7px;font-weight:900;text-transform:uppercase}.season-competition h3{margin:3px 0 0;font-size:21px;text-transform:uppercase}.season-competition dl{display:grid;grid-template-columns:.7fr 1.3fr;margin:0}.season-competition dl div{padding:11px;border-right:1px solid var(--line);border-bottom:1px solid var(--line)}.season-competition dl div:last-child{border-right:0}.season-competition dt{color:var(--muted);font-size:7px;text-transform:uppercase}.season-competition dd{margin:5px 0 0;font-size:9px;font-weight:800;line-height:1.4}.season-competition>p{margin:0;padding:12px;color:#d5e0d8;font-size:9px;line-height:1.55}.season-rules{display:grid;grid-template-columns:.8fr 1.2fr;gap:20px;padding:25px;border:1px solid var(--line-strong);border-radius:26px;background:radial-gradient(circle at 0 0,rgba(216,178,72,.13),transparent 29%),linear-gradient(145deg,#112a1c,#050c08)}.season-rules h2{margin:7px 0;font-size:38px;text-transform:uppercase}.season-rules ul{display:grid;gap:8px;margin:0;padding:0;list-style:none}.season-rules li{padding:10px;border:1px solid var(--line);border-radius:12px;color:#d8e2dc;background:rgba(255,255,255,.03);font-size:9px;line-height:1.5}.season-rules li b{color:var(--gold-soft)}.season-rules>p{grid-column:1/-1;margin:0;padding:11px;border-left:3px solid var(--gold);color:var(--muted);background:rgba(216,178,72,.06);font-size:8px;line-height:1.55}
      @media(max-width:720px){.season-hero{grid-template-columns:1fr;min-height:0;padding:23px 17px}.season-hero h1{font-size:clamp(58px,18vw,82px)}.season-hero aside{grid-template-columns:auto 1fr;align-items:end;gap:4px 13px;min-height:0}.season-hero aside strong{grid-row:1/3;font-size:72px}.season-hero aside b{margin-top:0}.season-stage{grid-template-columns:1fr;padding:13px}.season-stage>aside{grid-template-columns:auto auto;gap:8px;min-height:58px}.season-stage>aside b{font-size:32px}.season-stage>aside span{margin:0}.season-competition-grid,.season-rules{grid-template-columns:1fr}.season-stage-head{align-items:flex-start}.season-rules{padding:18px}.season-rules h2{font-size:31px}}@media(max-width:430px){.season-competition dl{grid-template-columns:1fr}.season-competition dl div{border-right:0}.season-hero-actions{display:grid}.season-hero-actions button{width:100%}}
    `;
    document.head.append(style);
  }

  function init() {
    styles();
    if (!build()) return;
    document.querySelector('[data-season-start]')?.addEventListener('click', () => document.getElementById('seasonStage1')?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
    window.ArenaBDASeason = Object.freeze({ stages, render: build });
    window.ArenaBDAMotion?.refresh?.();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
