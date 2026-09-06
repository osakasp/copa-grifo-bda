(() => {
  'use strict';

  if (window.ArenaBDAArtBroadcast?.version >= 2) return;
  const VERSION = 2;

  function relabel() {
    const button = document.getElementById('arenaArtProButton');
    if (button) button.textContent = '🎨 Artes Broadcast';
    const modal = document.getElementById('bdaProStudio');
    const title = modal?.querySelector('h2');
    const eyebrow = modal?.querySelector('header span');
    if (title) title.textContent = 'Estúdio Broadcast';
    if (eyebrow) eyebrow.textContent = 'CENTRAL DE ARTES BDA • V3.1';
  }

  document.getElementById('arenaArtBroadcastStyles')?.remove();
  const style = document.createElement('style');
  style.id = 'arenaArtBroadcastStyles';
  style.textContent = `
    .bda-art-stage{
      --broadcast-accent:#d8b248;
      --broadcast-accent-2:#5ee59b;
      --broadcast-glow:rgba(216,178,72,.24);
      --broadcast-edge:rgba(216,178,72,.42);
      --broadcast-soft:rgba(216,178,72,.11);
      --broadcast-ink:#f7faf8;
      --broadcast-muted:#9baaa2;
      --broadcast-line:rgba(255,255,255,.1);
      background:
        radial-gradient(circle at 76% 18%,var(--broadcast-glow),transparent 28%),
        linear-gradient(120deg,rgba(255,255,255,.025),transparent 28%),
        linear-gradient(145deg,#0b130f 0%,#050805 58%,#020302 100%)!important;
      color:var(--broadcast-ink)!important;
      padding:54px 64px 50px!important;
      isolation:isolate;
    }
    .bda-art-stage::before{
      content:"";
      position:absolute;
      inset:-12% 54% 38% -12%;
      z-index:0;
      transform:skewX(-15deg) rotate(-2deg);
      border-right:3px solid var(--broadcast-edge);
      background:linear-gradient(135deg,var(--broadcast-soft),transparent 62%);
      opacity:.8;
    }
    .bda-art-stage::after{
      content:"BDA";
      position:absolute;
      right:-40px;
      bottom:70px;
      z-index:0;
      color:rgba(255,255,255,.024);
      font:900 280px/1 "Barlow Condensed",Impact,sans-serif;
      letter-spacing:-.05em;
      pointer-events:none;
    }
    .bda-art-stage>.bda-art-glow{
      z-index:0!important;
      background:
        linear-gradient(90deg,transparent 0 48%,rgba(255,255,255,.02) 48% 49%,transparent 49%),
        repeating-linear-gradient(0deg,rgba(255,255,255,.014) 0 1px,transparent 1px 6px)!important;
      opacity:.72;
    }
    .bda-art-stage>header{
      position:relative;
      z-index:3;
      align-items:center!important;
      padding:0 0 18px!important;
      border-bottom:1px solid var(--broadcast-line)!important;
    }
    .bda-art-stage>header span{
      display:inline-flex;
      align-items:center;
      gap:8px;
      color:var(--broadcast-accent)!important;
      font-size:11px!important;
      letter-spacing:.22em!important;
    }
    .bda-art-stage>header span::before{
      content:"";
      width:28px;
      height:3px;
      border-radius:99px;
      background:var(--broadcast-accent);
    }
    .bda-art-stage>header h1{
      margin:7px 0 0!important;
      max-width:780px;
      font:900 34px/.95 "Barlow Condensed",Impact,sans-serif!important;
      letter-spacing:.02em;
    }
    .bda-art-stage>header p{
      margin-top:6px!important;
      color:var(--broadcast-muted)!important;
      font-size:11px!important;
      letter-spacing:.12em;
      text-transform:uppercase;
    }
    .bda-art-stage>header aside{
      width:72px!important;
      height:72px!important;
      border:0!important;
      border-radius:18px!important;
      background:rgba(0,0,0,.22)!important;
      box-shadow:inset 0 0 0 1px var(--broadcast-line)!important;
    }
    .bda-art-stage>header aside img{max-width:58px!important;max-height:58px!important;object-fit:contain}
    .bda-art-stage>main{
      position:relative;
      z-index:2;
      padding:22px 0 44px!important;
      justify-content:center!important;
    }
    .bda-art-stage>footer{
      right:64px!important;
      left:64px!important;
      bottom:26px!important;
      z-index:3!important;
      padding-top:10px!important;
      border-top:1px solid var(--broadcast-line)!important;
      color:var(--broadcast-muted)!important;
      font-size:10px!important;
      letter-spacing:.08em;
      text-transform:uppercase;
    }
    .bda-art-stage>footer b{color:var(--broadcast-accent)!important}

    .bda-art-result{
      grid-template-columns:minmax(0,1fr) 300px minmax(0,1fr)!important;
      gap:42px!important;
      align-items:center!important;
    }
    .bda-art-team .bda-art-shield{
      width:220px!important;
      height:220px!important;
    }
    .bda-art-team h2{
      max-width:350px!important;
      margin:20px 0 0!important;
      font:900 38px/.92 "Barlow Condensed",Impact,sans-serif!important;
      letter-spacing:.01em;
    }
    .bda-art-score{
      position:relative;
      display:grid;
      place-items:center;
      min-height:260px;
      padding:22px 18px;
      border:0!important;
      border-radius:28px;
      background:linear-gradient(180deg,rgba(255,255,255,.055),rgba(255,255,255,.018));
      box-shadow:inset 0 0 0 1px var(--broadcast-line),0 28px 60px rgba(0,0,0,.26);
    }
    .bda-art-score::before{
      content:"";
      position:absolute;
      top:0;
      width:56%;
      height:4px;
      border-radius:0 0 8px 8px;
      background:var(--broadcast-accent);
    }
    .bda-art-score small{
      color:var(--broadcast-accent)!important;
      font-size:11px!important;
      letter-spacing:.24em!important;
    }
    .bda-art-score>b{
      margin:10px 0 6px!important;
      font:900 94px/.88 "Barlow Condensed",Impact,sans-serif!important;
      letter-spacing:-.04em;
      text-shadow:0 10px 30px rgba(0,0,0,.38);
    }
    .bda-art-score span{color:var(--broadcast-muted)!important;font-size:11px!important;text-transform:uppercase;letter-spacing:.12em}
    .bda-art-score i{
      margin-top:13px;
      padding:7px 12px;
      border-radius:999px;
      color:#061008;
      background:var(--broadcast-accent);
      font-size:9px;
      font-style:normal;
      font-weight:900;
      letter-spacing:.08em;
      text-transform:uppercase;
    }
    .bda-art-leg-list{
      display:flex!important;
      justify-content:center;
      gap:8px!important;
      margin-top:24px!important;
    }
    .bda-art-leg,.bda-art-aggregate{
      min-width:0;
      flex:1 1 0;
      padding:10px 13px!important;
      border:0!important;
      border-radius:12px!important;
      background:rgba(0,0,0,.2)!important;
      box-shadow:inset 0 0 0 1px var(--broadcast-line);
    }
    .bda-art-leg>span,.bda-art-aggregate>span{color:var(--broadcast-accent)!important;font-size:8px!important;letter-spacing:.12em}
    .bda-art-leg div{text-align:right}
    .bda-art-leg b{font-size:10px!important;font-weight:800}
    .bda-art-leg small{display:block!important;margin-top:2px;color:var(--broadcast-muted)!important;font-size:7px!important}
    .bda-art-aggregate b{font:900 20px/1 "Barlow Condensed",sans-serif!important}

    .bda-pro-grid{gap:12px!important}
    .bda-pro-tie{
      position:relative;
      overflow:hidden;
      padding:15px 16px!important;
      border:0!important;
      border-radius:14px!important;
      background:linear-gradient(145deg,rgba(255,255,255,.045),rgba(255,255,255,.014))!important;
      box-shadow:inset 0 0 0 1px var(--broadcast-line)!important;
    }
    .bda-pro-tie::before{
      content:"";
      position:absolute;
      inset:0 auto 0 0;
      width:4px;
      background:var(--broadcast-accent);
    }
    .bda-pro-tie>header{margin-bottom:8px!important;color:var(--broadcast-muted)!important;font-size:8px!important;letter-spacing:.1em;text-transform:uppercase}
    .bda-pro-tie>header span{color:var(--broadcast-accent)!important}
    .bda-pro-head{gap:12px!important;padding-bottom:8px!important;border-bottom:1px solid var(--broadcast-line)!important}
    .bda-pro-head>div{grid-template-columns:58px 1fr!important;gap:10px!important}
    .bda-pro-head>div:last-child{grid-template-columns:1fr 58px!important}
    .bda-pro-head b{font:900 14px/.95 "Barlow Condensed",sans-serif!important;text-transform:uppercase}
    .bda-pro-head>strong{color:var(--broadcast-ink)!important;font:900 34px/1 "Barlow Condensed",sans-serif!important}
    .bda-art-shield.mini{width:56px!important;height:56px!important}
    .bda-pro-legs{margin-top:7px!important}
    .bda-pro-leg{padding-top:5px!important;border-color:rgba(255,255,255,.045)!important}
    .bda-pro-leg>span{color:var(--broadcast-accent)!important;font-size:7px!important}
    .bda-pro-leg b{font-size:8px!important;color:#dfe6e1!important}
    .bda-pro-leg small{font-size:7px!important;color:var(--broadcast-muted)!important}
    .bda-pro-tie>footer{margin-top:6px!important;padding-top:6px!important;border-color:var(--broadcast-line)!important;color:var(--broadcast-accent)!important}

    .bda-pro-champion>span{display:none!important}
    .bda-pro-champion .bda-art-shield.champion{width:270px!important;height:270px!important}
    .bda-pro-champion>small{margin-top:18px!important;color:var(--broadcast-accent)!important;font-size:14px!important;letter-spacing:.34em!important}
    .bda-pro-champion h2{
      max-width:900px!important;
      margin:8px 0 18px!important;
      font:900 78px/.88 "Barlow Condensed",Impact,sans-serif!important;
      letter-spacing:-.02em;
    }
    .bda-pro-champion>div{
      padding:10px 22px!important;
      border:0!important;
      border-radius:999px!important;
      background:rgba(0,0,0,.24)!important;
      box-shadow:inset 0 0 0 1px var(--broadcast-line);
    }
    .bda-pro-champion>div span{color:var(--broadcast-accent)!important;font-size:8px!important}
    .bda-pro-champion>div b{font:900 26px/1 "Barlow Condensed",sans-serif!important}
    .bda-pro-champion p{margin-top:12px!important;color:var(--broadcast-muted)!important;letter-spacing:.12em;text-transform:uppercase}

    .bda-art-standings-clone{padding:0!important;border:0!important;background:transparent!important;box-shadow:none!important}
    .bda-art-standings-clone table{overflow:hidden;border-collapse:separate!important;border-spacing:0 5px!important;font-size:12px!important}
    .bda-art-standings-clone th{padding:8px 10px!important;border:0!important;color:var(--broadcast-muted)!important;background:transparent!important;font-size:9px!important;letter-spacing:.1em!important;text-transform:uppercase}
    .bda-art-standings-clone td{padding:10px!important;border:0!important;background:rgba(255,255,255,.038)!important;color:#f6f9f7!important;font-weight:750!important}
    .bda-art-standings-clone tr td:first-child{border-radius:10px 0 0 10px!important;border-left:4px solid var(--broadcast-accent)!important}
    .bda-art-standings-clone tr td:last-child{border-radius:0 10px 10px 0!important}

    .bda-pro-theme-super{--broadcast-accent:#9d7cff;--broadcast-accent-2:#5bdcff;--broadcast-glow:rgba(157,124,255,.25);--broadcast-edge:rgba(157,124,255,.46);--broadcast-soft:rgba(157,124,255,.11)}
    .bda-pro-theme-francos{--broadcast-accent:#58c9ff;--broadcast-accent-2:#53f2ff;--broadcast-glow:rgba(88,201,255,.23);--broadcast-edge:rgba(88,201,255,.44);--broadcast-soft:rgba(88,201,255,.10)}
    .bda-pro-theme-grifo{--broadcast-accent:#e1bd58;--broadcast-accent-2:#69d99b;--broadcast-glow:rgba(225,189,88,.23);--broadcast-edge:rgba(225,189,88,.44);--broadcast-soft:rgba(225,189,88,.10)}
    .bda-pro-theme-ligaa{--broadcast-accent:#e7c15e;--broadcast-accent-2:#fff0a5;--broadcast-glow:rgba(231,193,94,.23);--broadcast-edge:rgba(231,193,94,.44);--broadcast-soft:rgba(231,193,94,.10)}
    .bda-pro-theme-ligab{--broadcast-accent:#c8d0d8;--broadcast-accent-2:#eef2f5;--broadcast-glow:rgba(200,208,216,.20);--broadcast-edge:rgba(200,208,216,.40);--broadcast-soft:rgba(200,208,216,.09)}
    .bda-pro-theme-livre{--broadcast-accent:#e1bb52;--broadcast-accent-2:#55dc91;--broadcast-glow:rgba(225,187,82,.23);--broadcast-edge:rgba(225,187,82,.44);--broadcast-soft:rgba(225,187,82,.10)}

    .bda-art-story{padding:70px 62px 60px!important}
    .bda-art-story .bda-art-result{grid-template-columns:1fr!important;gap:12px!important}
    .bda-art-story .bda-art-team .bda-art-shield{width:210px!important;height:210px!important}
    .bda-art-story .bda-art-team h2{font-size:38px!important;margin-top:12px!important}
    .bda-art-story .bda-art-score{min-height:220px!important;width:72%;justify-self:center}
    .bda-art-story .bda-art-score>b{font-size:104px!important}
    .bda-art-story .bda-art-leg-list{display:grid!important;grid-template-columns:1fr!important;width:86%;align-self:center}
    .bda-art-wide .bda-art-result{grid-template-columns:minmax(0,1fr) 360px minmax(0,1fr)!important;gap:70px!important}
    .bda-art-wide .bda-art-team .bda-art-shield{width:245px!important;height:245px!important}
    .bda-art-wide .bda-art-score>b{font-size:116px!important}
    .bda-art-wide .bda-pro-grid{grid-template-columns:repeat(3,minmax(0,1fr))!important}

    @media(max-width:700px){
      #arenaArtProButton{font-size:11px!important}
      .bda-art-modal>section>main{grid-template-columns:1fr!important}
    }
  `;
  document.head.append(style);

  ['arena:bundle-loaded','arena:tournaments-updated','arena:permissions-updated','arena:matches-updated']
    .forEach(name => window.addEventListener(name, () => setTimeout(relabel, 80)));
  [0,300,1000,2200].forEach(delay => setTimeout(relabel, delay));

  window.ArenaBDAArtBroadcast = Object.freeze({
    version:VERSION,
    refresh:relabel,
    html2canvasCompatible:true
  });
})();
