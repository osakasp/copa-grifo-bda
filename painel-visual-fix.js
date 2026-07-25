(() => {
  'use strict';

  const style = document.createElement('style');
  style.textContent = `
    .top-actions #cloudPanelBtn.cloud-panel-trigger{
      opacity:1!important;
      visibility:visible;
      color:#171107!important;
      border:1px solid #f5dc86!important;
      background:linear-gradient(135deg,#fff2b5 0%,#f5dc86 42%,#d3a93a 100%)!important;
      box-shadow:0 10px 28px rgba(211,169,58,.34),inset 0 1px 0 rgba(255,255,255,.72)!important;
      filter:none!important;
      font-weight:900!important;
      letter-spacing:.055em!important;
      text-shadow:none!important;
    }

    .top-actions #cloudPanelBtn.cloud-panel-trigger:not([hidden]){
      display:inline-flex!important;
      align-items:center;
      justify-content:center;
      gap:6px;
    }

    .top-actions #cloudPanelBtn.cloud-panel-trigger:not([hidden])::before{
      content:"⚙";
      font-size:14px;
      line-height:1;
    }

    .top-actions #cloudPanelBtn.cloud-panel-trigger:hover{
      color:#100c04!important;
      border-color:#fff0a4!important;
      background:linear-gradient(135deg,#fff7d2 0%,#f9e394 44%,#dcb33f 100%)!important;
      box-shadow:0 14px 34px rgba(211,169,58,.44),0 0 0 3px rgba(245,220,134,.10)!important;
      transform:translateY(-2px)!important;
    }

    .top-actions #cloudPanelBtn.cloud-panel-trigger:focus-visible{
      outline:3px solid rgba(245,220,134,.34)!important;
      outline-offset:3px!important;
    }

    @media(max-width:520px){
      .top-actions #cloudPanelBtn.cloud-panel-trigger{
        min-height:38px!important;
        padding:0 10px!important;
        font-size:9px!important;
      }
      .top-actions #cloudPanelBtn.cloud-panel-trigger:not([hidden])::before{font-size:12px}
    }
  `;
  document.head.append(style);

  const reinforce = () => {
    const button = document.getElementById('cloudPanelBtn');
    if (!button) return;
    button.classList.add('cloud-panel-visible-fix');
    button.setAttribute('title', 'Abrir painel administrativo');
  };

  reinforce();
  new MutationObserver(reinforce).observe(document.body, { childList: true, subtree: true });
})();
