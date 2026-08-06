(() => {
  'use strict';

  const champions = Object.freeze([
    {
      position: 1,
      club: 'Flamestre',
      aliases: ['Flamestre BDA', 'Flamestre FC', 'Flamestre DF'],
      titles: 6,
      points: 60,
      achievements: [
        ['Liga A', '1ª Ed'],
        ['Imagem 2', '3ª e 6ª Ed'],
        ['Imagem 3', '1ª e 3ª Ed'],
        ['Imagem 4', '4ª Ed']
      ]
    },
    {
      position: 2,
      club: 'Internacional',
      aliases: ['Internacional BDA', 'Inter BDA', 'Inter Brasil BDA'],
      titles: 5,
      points: 50,
      achievements: [
        ['Liga A', '2ª Ed'],
        ['Imagem 2', '5ª Ed'],
        ['Imagem 3', '4ª Ed'],
        ['Imagem 4', '1ª e 3ª Ed']
      ]
    },
    {
      position: 3,
      club: 'Zombie FC BDA',
      aliases: [],
      titles: 2,
      points: 20,
      achievements: [
        ['Imagem 2', '8ª Ed'],
        ['Imagem 3', '5ª Ed']
      ]
    },
    {
      position: 4,
      club: 'Bahia City BDA',
      aliases: [],
      titles: 1,
      points: 10,
      achievements: [['Imagem 2', '1ª Ed']]
    },
    {
      position: 4,
      club: 'Leeds United BDA',
      aliases: [],
      titles: 1,
      points: 10,
      achievements: [['Imagem 2', '2ª Ed']]
    },
    {
      position: 4,
      club: 'Barcelona City BDA',
      aliases: [],
      titles: 1,
      points: 10,
      achievements: [['Imagem 2', '4ª Ed']]
    },
    {
      position: 4,
      club: 'Santos RB BDA',
      aliases: [],
      titles: 1,
      points: 10,
      achievements: [['Imagem 2', '7ª Ed']]
    },
    {
      position: 4,
      club: 'Vasco BDA',
      aliases: [],
      titles: 1,
      points: 10,
      achievements: [['Imagem 3', '2ª Ed']]
    },
    {
      position: 4,
      club: 'AC Milan BDA',
      aliases: [],
      titles: 1,
      points: 10,
      achievements: [['Imagem 4', '2ª Ed']]
    },
    {
      position: 4,
      club: 'Hellyeah BDA',
      aliases: [],
      titles: 1,
      points: 10,
      achievements: [['Imagem 4', '5ª Ed']]
    }
  ]);

  const escapeHtml = value => String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

  function titleLabel(amount) {
    return `${amount} ${amount === 1 ? 'título' : 'títulos'}`;
  }

  function achievementText(achievements) {
    return achievements.map(([competition, editions]) => `${competition} (${editions})`).join(', ');
  }

  function podiumCard(champion, placeClass) {
    return `
      <article class="champion-ranking-podium-card ${placeClass}">
        <span class="champion-ranking-medal" aria-hidden="true">${champion.position}º</span>
        <div>
          <small>${champion.position === 1 ? 'Maior campeão' : `${champion.position}º lugar`}</small>
          <h3>${escapeHtml(champion.club)}</h3>
          <p>${titleLabel(champion.titles)} · ${champion.points} pontos</p>
        </div>
      </article>
    `;
  }

  function rankingRow(champion) {
    const aliases = champion.aliases.length
      ? `<small class="champion-ranking-aliases">Também: ${champion.aliases.map(escapeHtml).join(' · ')}</small>`
      : '';

    return `
      <article class="champion-ranking-row" role="listitem">
        <span class="champion-ranking-position" aria-label="${champion.position}º lugar">${champion.position}º</span>
        <div class="champion-ranking-club">
          <h3>${escapeHtml(champion.club)}</h3>
          ${aliases}
          <p><strong>Títulos:</strong> ${escapeHtml(achievementText(champion.achievements))}.</p>
        </div>
        <div class="champion-ranking-score">
          <strong>${champion.titles}</strong>
          <span>${champion.titles === 1 ? 'título' : 'títulos'}</span>
        </div>
        <div class="champion-ranking-points">
          <strong>${champion.points}</strong>
          <span>pontos</span>
        </div>
      </article>
    `;
  }

  function installStyles() {
    if (document.getElementById('championRankingStyles')) return;

    const styles = document.createElement('style');
    styles.id = 'championRankingStyles';
    styles.textContent = `
      .champion-ranking{position:relative;overflow:hidden;margin:10px 0 28px;padding:clamp(17px,4vw,28px);border:1px solid var(--line-strong);border-radius:28px;background:radial-gradient(circle at 88% 5%,rgba(242,215,125,.18),transparent 27%),linear-gradient(145deg,rgba(19,43,29,.96),rgba(5,12,8,.96));box-shadow:var(--shadow)}
      .champion-ranking:after{content:'🏆';position:absolute;right:-22px;top:-43px;font-size:150px;opacity:.055;transform:rotate(11deg);pointer-events:none}
      .champion-ranking-header,.champion-ranking-podium,.champion-ranking-list{position:relative;z-index:1}
      .champion-ranking-header{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:end;gap:20px}
      .champion-ranking-header h2{margin:5px 0 4px;font-size:clamp(31px,6vw,48px);line-height:.9;text-transform:uppercase}
      .champion-ranking-header p{margin:0;color:#cad6ce;font-size:11px;line-height:1.5}
      .champion-ranking-summary{display:grid;grid-template-columns:repeat(3,minmax(82px,1fr));gap:7px}
      .champion-ranking-summary div{min-width:82px;padding:10px;border:1px solid var(--line);border-radius:14px;background:rgba(255,255,255,.035)}
      .champion-ranking-summary strong,.champion-ranking-summary span{display:block}
      .champion-ranking-summary strong{color:var(--gold-soft);font:800 24px/1 'Barlow Condensed',sans-serif}
      .champion-ranking-summary span{margin-top:4px;color:var(--muted);font-size:7px;font-weight:800;letter-spacing:.08em;text-transform:uppercase}
      .champion-ranking-podium{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));align-items:end;gap:9px;margin:20px 0}
      .champion-ranking-podium-card{display:flex;align-items:center;gap:11px;min-height:94px;padding:13px;border:1px solid var(--line);border-radius:18px;background:rgba(4,10,7,.6)}
      .champion-ranking-podium-card.first{min-height:110px;border-color:rgba(242,215,125,.48);background:linear-gradient(145deg,rgba(216,178,72,.16),rgba(4,10,7,.76));box-shadow:0 12px 30px rgba(0,0,0,.24)}
      .champion-ranking-medal{display:grid;place-items:center;flex:0 0 auto;width:48px;height:48px;border:1px solid rgba(242,215,125,.3);border-radius:50%;color:#171107;background:linear-gradient(145deg,#fff0aa,var(--gold) 58%,#89670e);font:900 23px/1 'Barlow Condensed',sans-serif;box-shadow:0 8px 20px rgba(216,178,72,.16)}
      .champion-ranking-podium-card.second .champion-ranking-medal{background:linear-gradient(145deg,#f3f6f4,#a9b5ae)}
      .champion-ranking-podium-card.second{order:-1}
      .champion-ranking-podium-card.third .champion-ranking-medal{background:linear-gradient(145deg,#e9b381,#9a5a2a)}
      .champion-ranking-podium-card small{color:var(--gold-soft);font-size:7px;font-weight:900;letter-spacing:.12em;text-transform:uppercase}
      .champion-ranking-podium-card h3{margin:4px 0 2px;font-size:23px;line-height:.95;text-transform:uppercase}
      .champion-ranking-podium-card p{margin:0;color:var(--muted);font-size:8px}
      .champion-ranking-list{display:grid;gap:7px}
      .champion-ranking-list-head,.champion-ranking-row{display:grid;grid-template-columns:48px minmax(0,1fr) 72px 72px;align-items:center;gap:10px}
      .champion-ranking-list-head{padding:0 12px;color:var(--muted);font-size:7px;font-weight:900;letter-spacing:.1em;text-align:center;text-transform:uppercase}
      .champion-ranking-list-head span:nth-child(2){text-align:left}
      .champion-ranking-row{padding:12px;border:1px solid var(--line);border-radius:16px;background:rgba(255,255,255,.027)}
      .champion-ranking-row:hover{border-color:rgba(242,215,125,.3);background:rgba(242,215,125,.045)}
      .champion-ranking-position{display:grid;place-items:center;width:40px;height:40px;border:1px solid var(--line);border-radius:12px;color:var(--gold-soft);background:rgba(216,178,72,.07);font:900 18px/1 'Barlow Condensed',sans-serif}
      .champion-ranking-club{min-width:0}
      .champion-ranking-club h3{margin:0;font-size:19px;line-height:1;text-transform:uppercase}
      .champion-ranking-aliases{display:block;overflow:hidden;margin-top:4px;color:var(--muted);font-size:7px;line-height:1.4;text-overflow:ellipsis;white-space:nowrap}
      .champion-ranking-club p{margin:7px 0 0;color:#c5d1c9;font-size:8px;line-height:1.45}
      .champion-ranking-club p strong{color:var(--gold-soft)}
      .champion-ranking-score,.champion-ranking-points{text-align:center}
      .champion-ranking-score strong,.champion-ranking-score span,.champion-ranking-points strong,.champion-ranking-points span{display:block}
      .champion-ranking-score strong,.champion-ranking-points strong{font:900 22px/1 'Barlow Condensed',sans-serif}
      .champion-ranking-points strong{color:var(--gold-soft)}
      .champion-ranking-score span,.champion-ranking-points span{margin-top:3px;color:var(--muted);font-size:7px;text-transform:uppercase}
      .champion-ranking-note{position:relative;z-index:1;margin:10px 2px 0;color:var(--muted);font-size:7px;line-height:1.45}
      @media(max-width:760px){
        .champion-ranking-header{grid-template-columns:1fr}
        .champion-ranking-summary{width:100%}
        .champion-ranking-podium{grid-template-columns:1fr}
        .champion-ranking-podium-card,.champion-ranking-podium-card.first{min-height:0}
        .champion-ranking-podium-card.second{order:initial}
      }
      @media(max-width:520px){
        .champion-ranking{padding:15px;border-radius:22px}
        .champion-ranking-summary div{min-width:0;padding:9px 7px}
        .champion-ranking-list-head{display:none}
        .champion-ranking-row{grid-template-columns:42px minmax(0,1fr) 45px 50px;padding:10px;gap:7px}
        .champion-ranking-position{width:37px;height:37px}
        .champion-ranking-club h3{font-size:17px}
        .champion-ranking-aliases{white-space:normal}
        .champion-ranking-score span,.champion-ranking-points span{font-size:6px}
      }
    `;
    document.head.appendChild(styles);
  }

  function render() {
    const page = document.querySelector('[data-page="champions"]');
    const championGrid = document.getElementById('championGrid');
    if (!page || !championGrid) return false;

    installStyles();

    let ranking = document.getElementById('championRanking');
    if (!ranking) {
      ranking = document.createElement('section');
      ranking.id = 'championRanking';
      ranking.className = 'champion-ranking';
      ranking.setAttribute('aria-labelledby', 'championRankingTitle');
      page.insertBefore(ranking, championGrid);
    }

    const totalTitles = champions.reduce((total, champion) => total + champion.titles, 0);
    ranking.innerHTML = `
      <header class="champion-ranking-header">
        <div>
          <span class="eyebrow">Hall da fama BDA</span>
          <h2 id="championRankingTitle">Ranking de Campeões</h2>
          <p>Classificação histórica com nomes consolidados e 10 pontos por título.</p>
        </div>
        <div class="champion-ranking-summary" aria-label="Resumo do ranking">
          <div><strong>${totalTitles}</strong><span>Títulos</span></div>
          <div><strong>${champions.length}</strong><span>Clubes</span></div>
          <div><strong>${champions[0].titles}</strong><span>Recorde</span></div>
        </div>
      </header>
      <div class="champion-ranking-podium" aria-label="Pódio dos campeões">
        ${podiumCard(champions[0], 'first')}
        ${podiumCard(champions[1], 'second')}
        ${podiumCard(champions[2], 'third')}
      </div>
      <div class="champion-ranking-list" role="list" aria-label="Classificação completa">
        <div class="champion-ranking-list-head" aria-hidden="true">
          <span>Pos.</span><span>Clube e conquistas</span><span>Títulos</span><span>Pontos</span>
        </div>
        ${champions.map(rankingRow).join('')}
      </div>
      <p class="champion-ranking-note">Em caso de igualdade no número de títulos e pontos, os clubes compartilham a mesma posição.</p>
    `;

    return true;
  }

  window.ArenaBDAChampionRanking = Object.freeze({ champions, render });
  render();
})();
