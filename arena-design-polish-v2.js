(() => {
  'use strict';

  if (window.ArenaBDADesignPolishV2?.version >= 2) return;

  const STYLE_ID = 'arenaDesignPolishV2Styles';
  let frame = 0;

  function installStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      body.arena-design-polish-v2{
        --bda-bg:#030805;
        --bda-surface:#08120c;
        --bda-surface-2:#0b1710;
        --bda-surface-3:#0d1d14;
        --bda-line:rgba(255,255,255,.075);
        --bda-line-strong:rgba(216,178,72,.22);
        --bda-text:#f2f6f3;
        --bda-muted:#91a198;
        --bda-gold:#d8b248;
        --bda-gold-soft:#f1d97f;
        --bda-green:#4fdf8f;
        background:var(--bda-bg)!important;
      }

      body.arena-design-polish-v2 :is(.page,main,section,article){scroll-margin-top:76px}
      body.arena-design-polish-v2 main{max-width:1240px;margin-inline:auto}

      body.arena-design-polish-v2 .topbar{
        border-color:var(--bda-line)!important;
        background:rgba(3,10,6,.965)!important;
        box-shadow:0 10px 30px rgba(0,0,0,.16)!important;
        backdrop-filter:blur(14px)!important;
        -webkit-backdrop-filter:blur(14px)!important;
      }
      body.arena-design-polish-v2 .brand-mark{
        border-color:rgba(216,178,72,.30)!important;
        background-color:#020503!important;
      }
      body.arena-design-polish-v2 .brand-copy strong{letter-spacing:.01em!important}
      body.arena-design-polish-v2 .brand-copy span{color:var(--bda-muted)!important}

      body.arena-design-polish-v2 :is(.primary,.secondary,.ghost,.danger){
        min-height:40px;
        border-radius:10px!important;
        font-weight:850!important;
        letter-spacing:.01em!important;
        box-shadow:none!important;
        transition:transform .14s ease,border-color .14s ease,background .14s ease,color .14s ease!important;
      }
      body.arena-design-polish-v2 :is(.primary,.secondary,.ghost,.danger):active{transform:scale(.985)}
      body.arena-design-polish-v2 .primary{
        color:#151207!important;
        border-color:rgba(216,178,72,.92)!important;
        background:linear-gradient(180deg,#e4c35b,#d8b248)!important;
      }
      body.arena-design-polish-v2 .secondary{
        color:#dce7df!important;
        border-color:rgba(255,255,255,.10)!important;
        background:#0b1710!important;
      }
      body.arena-design-polish-v2 .ghost{
        color:#c7d2ca!important;
        border-color:rgba(255,255,255,.08)!important;
        background:rgba(255,255,255,.025)!important;
      }

      body.arena-design-polish-v2 .eyebrow{
        color:var(--bda-gold-soft)!important;
        font-size:9px!important;
        letter-spacing:.12em!important;
        font-weight:900!important;
      }

      body.arena-design-polish-v2 [data-page="home"] .now-feature,
      body.arena-design-polish-v2 .arena-detail .arena-hero,
      body.arena-design-polish-v2 #giManager .gi-game,
      body.arena-design-polish-v2 #autoStandings .stand-group,
      body.arena-design-polish-v2 .arena-v4-bracket-card,
      body.arena-design-polish-v2 .arena-provisional-card{
        border-color:var(--bda-line)!important;
        background:linear-gradient(180deg,var(--bda-surface-2),var(--bda-surface))!important;
        box-shadow:0 14px 34px rgba(0,0,0,.18)!important;
      }

      body.arena-design-polish-v2 [data-page="home"] .now-feature,
      body.arena-design-polish-v2 .arena-detail .arena-hero{
        position:relative!important;
        isolation:isolate;
      }
      body.arena-design-polish-v2 .arena-bda-watermark{
        position:absolute;
        z-index:0;
        width:min(240px,32vw);
        aspect-ratio:1;
        right:22px;
        top:50%;
        transform:translateY(-50%);
        background:url('./favicon.svg') center/contain no-repeat;
        opacity:.055;
        filter:saturate(.9) contrast(1.04);
        pointer-events:none;
      }
      body.arena-design-polish-v2 [data-page="home"] .now-feature > :not(.arena-bda-watermark),
      body.arena-design-polish-v2 .arena-detail .arena-hero > :not(.arena-bda-watermark){position:relative;z-index:1}

      body.arena-design-polish-v2 [data-page="home"] .now-head h2,
      body.arena-design-polish-v2 .arena-detail .arena-hero-copy h2,
      body.arena-design-polish-v2 #autoStandings .stand-head h2,
      body.arena-design-polish-v2 .arena-v4-bracket-head h2{
        color:var(--bda-text)!important;
        text-wrap:balance;
      }

      body.arena-design-polish-v2 [data-page="home"] .now-list{
        border-color:var(--bda-line)!important;
        background:var(--bda-surface)!important;
      }
      body.arena-design-polish-v2 [data-page="home"] .now-row{
        border-bottom-color:rgba(255,255,255,.05)!important;
      }
      body.arena-design-polish-v2 [data-page="home"] .now-row:hover{
        background:rgba(216,178,72,.035)!important;
      }

      body.arena-design-polish-v2 .arena-detail-nav,
      body.arena-design-polish-v2 #giManager>nav,
      body.arena-design-polish-v2 .arena-v4-bracket-tabs{
        border-color:var(--bda-line)!important;
        background:#06100a!important;
        box-shadow:0 8px 22px rgba(0,0,0,.12)!important;
      }
      body.arena-design-polish-v2 :is(.arena-detail-nav,#giManager>nav,.arena-v4-bracket-tabs) button{
        border-radius:9px!important;
        color:#8fa096!important;
        font-weight:850!important;
      }
      body.arena-design-polish-v2 :is(.arena-detail-nav,#giManager>nav,.arena-v4-bracket-tabs) button.active{
        color:#151207!important;
        background:var(--bda-gold)!important;
      }

      body.arena-design-polish-v2 #adminPanel,
      body.arena-design-polish-v2 .pro-admin-shell{
        border-color:rgba(79,223,143,.18)!important;
        background:linear-gradient(180deg,#07150c,#050d08)!important;
        box-shadow:none!important;
      }

      body.arena-design-polish-v2 #autoStandings .stand-group>header{
        border-bottom:1px solid rgba(216,178,72,.13)!important;
        background:linear-gradient(180deg,#0d2516,#0a1c12)!important;
      }
      body.arena-design-polish-v2 #autoStandings thead{
        background:#06100a!important;
      }
      body.arena-design-polish-v2 #autoStandings tbody tr{
        border-top-color:rgba(255,255,255,.045)!important;
        transition:background .12s ease!important;
      }
      body.arena-design-polish-v2 #autoStandings tbody tr:hover{
        background:rgba(255,255,255,.018)!important;
      }
      body.arena-design-polish-v2 #autoStandings .stand-badge{
        border-color:rgba(216,178,72,.24)!important;
        box-shadow:0 6px 14px rgba(0,0,0,.22)!important;
      }
      body.arena-design-polish-v2 #autoStandings .stand-points{
        color:var(--bda-gold-soft)!important;
        font-weight:950!important;
      }

      body.arena-design-polish-v2 .arena-v4-bracket-shell,
      body.arena-design-polish-v2 .arena-provisional-knockout{
        border-radius:16px;
      }
      body.arena-design-polish-v2 .arena-v4-bracket-card>div.winner{
        background:rgba(79,223,143,.055)!important;
      }

      body.arena-design-polish-v2 .bottom-nav,
      body.arena-design-polish-v2 .arena-mobile-nav{
        border-color:rgba(216,178,72,.14)!important;
        background:rgba(3,11,7,.965)!important;
        box-shadow:0 -12px 30px rgba(0,0,0,.28)!important;
      }
      body.arena-design-polish-v2 .bottom-nav .nav-btn.active,
      body.arena-design-polish-v2 .arena-mobile-nav button.active{
        color:var(--bda-gold-soft)!important;
        background:#0b2114!important;
        box-shadow:inset 0 2px 0 var(--bda-gold)!important;
      }

      @media(min-width:761px){
        body.arena-design-polish-v2 main{padding-inline:20px!important}
        body.arena-design-polish-v2 .arena-detail .arena-hero{min-height:230px!important}
      }

      @media(max-width:760px){
        body.arena-design-polish-v2 main{padding-inline:10px!important}
        body.arena-design-polish-v2 .topbar{
          min-height:56px!important;
          padding:7px 9px!important;
        }
        body.arena-design-polish-v2 .top-actions{gap:5px!important}
        body.arena-design-polish-v2 .top-actions>:is(button,a){
          width:35px!important;
          min-width:35px!important;
          height:35px!important;
          min-height:35px!important;
          border-radius:9px!important;
        }
        body.arena-design-polish-v2 [data-page="home"] .now-feature,
        body.arena-design-polish-v2 .arena-detail .arena-hero{
          border-radius:15px!important;
          box-shadow:0 10px 24px rgba(0,0,0,.16)!important;
        }
        body.arena-design-polish-v2 .arena-bda-watermark{
          width:148px;
          right:-18px;
          opacity:.042;
        }
        body.arena-design-polish-v2 #autoStandings .stand-group{
          margin-bottom:12px!important;
          border-radius:14px!important;
        }
        body.arena-design-polish-v2 #autoStandings th,
        body.arena-design-polish-v2 #autoStandings td{
          font-variant-numeric:tabular-nums;
        }
        body.arena-design-polish-v2 .arena-v4-bracket-tabs{
          padding:4px!important;
          border-radius:11px!important;
        }
        body.arena-design-polish-v2 .arena-v4-bracket-tabs button{
          min-height:36px!important;
          min-width:78px!important;
          font-size:8px!important;
        }
        body.arena-design-polish-v2 .bottom-nav,
        body.arena-design-polish-v2 .arena-mobile-nav{
          min-height:66px!important;
          border-radius:16px 16px 0 0!important;
        }
        body.arena-design-polish-v2 .bottom-nav .nav-btn,
        body.arena-design-polish-v2 .arena-mobile-nav button{
          min-height:50px!important;
          border-radius:9px!important;
        }
      }

      @media(prefers-reduced-motion:reduce){
        body.arena-design-polish-v2 *{transition:none!important;scroll-behavior:auto!important}
      }
    `;
    document.head.appendChild(style);
  }

  function ensureWatermark(target) {
    if (!target || target.querySelector(':scope > .arena-bda-watermark')) return;
    const watermark = document.createElement('span');
    watermark.className = 'arena-bda-watermark';
    watermark.setAttribute('aria-hidden', 'true');
    target.appendChild(watermark);
  }

  function decorate() {
    frame = 0;
    document.body?.classList.add('arena-design-polish-v2');
    installStyles();
    ensureWatermark(document.querySelector('[data-page="home"] .now-feature'));
    ensureWatermark(document.querySelector('.arena-detail .arena-hero'));
  }

  function schedule() {
    if (frame) return;
    frame = requestAnimationFrame(decorate);
  }

  ['arena:bundle-loaded','arena:tournaments-updated','arena:matches-updated','arena:auth-changed','arena:cloud-ready']
    .forEach(type => window.addEventListener(type, schedule));

  const observer = new MutationObserver(schedule);
  observer.observe(document.documentElement, { childList:true, subtree:true });

  window.ArenaBDADesignPolishV2 = Object.freeze({ version:2, refresh:decorate });
  decorate();
})();
