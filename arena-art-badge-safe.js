(() => {
  'use strict';

  if (window.ArenaBDAArtBadgeSafe?.version >= 1) return;
  const VERSION = 1;

  document.getElementById('arenaArtBadgeSafeStyles')?.remove();
  const style = document.createElement('style');
  style.id = 'arenaArtBadgeSafeStyles';
  style.textContent = `
    .bda-art-stage .bda-art-shield,
    .bda-art-stage .bda-v32-shield{
      display:grid!important;
      place-items:center!important;
      flex:0 0 auto!important;
      box-sizing:border-box!important;
      overflow:hidden!important;
      padding:7px!important;
      background:rgba(255,255,255,.035)!important;
      border-radius:12px!important;
    }

    .bda-art-stage .bda-art-shield img,
    .bda-art-stage .bda-v32-shield img{
      display:block!important;
      width:100%!important;
      height:100%!important;
      max-width:100%!important;
      max-height:100%!important;
      object-fit:contain!important;
      object-position:center center!important;
      margin:0!important;
      padding:0!important;
      transform:none!important;
    }

    .bda-art-stage .bda-art-team>.bda-art-shield{
      padding:16px!important;
      border-radius:24px!important;
    }

    .bda-art-stage .bda-art-shield.mini{
      width:54px!important;
      height:54px!important;
      min-width:54px!important;
      min-height:54px!important;
      padding:6px!important;
      border-radius:11px!important;
    }

    .bda-art-stage .bda-art-shield.champion{
      padding:20px!important;
      border-radius:28px!important;
    }

    .bda-art-stage .bda-pro-head>div{
      min-width:0!important;
      align-items:center!important;
    }

    .bda-art-stage .bda-pro-head b{
      min-width:0!important;
      overflow:hidden!important;
      text-overflow:ellipsis!important;
      white-space:nowrap!important;
    }

    .bda-art-wide .bda-pro-head>div{
      grid-template-columns:66px minmax(0,1fr)!important;
      gap:12px!important;
    }

    .bda-art-wide .bda-pro-head>div:last-child{
      grid-template-columns:minmax(0,1fr) 66px!important;
    }

    .bda-art-wide .bda-art-shield.mini{
      width:62px!important;
      height:62px!important;
      min-width:62px!important;
      min-height:62px!important;
      padding:7px!important;
    }

    .bda-art-story .bda-art-shield.mini{
      width:58px!important;
      height:58px!important;
      min-width:58px!important;
      min-height:58px!important;
      padding:7px!important;
    }

    .bda-v32-shield{
      padding:4px!important;
    }
  `;
  document.head.appendChild(style);

  window.ArenaBDAArtBadgeSafe = Object.freeze({
    version:VERSION,
    fit:'contain',
    centered:true,
    protected:true
  });
})();
