(() => {
  'use strict';

  if (window.ArenaBDAMobilePerformance?.version >= 2) return;

  // Reduz o custo de composição no celular somente durante a rolagem.
  // A interface volta ao visual completo assim que o usuário para.
  const root = document.documentElement;
  let timer = 0;
  let scrolling = false;

  const enableLightScroll = () => {
    if (!scrolling) {
      scrolling = true;
      root.classList.add('arena-mobile-scrolling');
    }
    clearTimeout(timer);
    timer = window.setTimeout(() => {
      scrolling = false;
      root.classList.remove('arena-mobile-scrolling');
    }, 160);
  };

  const css = document.createElement('style');
  css.id = 'arenaMobilePerformanceStyles';
  css.textContent = `
    @media (max-width: 768px) {
      html.arena-mobile-scrolling {
        scroll-behavior: auto !important;
      }

      html.arena-mobile-scrolling .topbar,
      html.arena-mobile-scrolling .bottom-nav,
      html.arena-mobile-scrolling .arena-side-nav,
      html.arena-mobile-scrolling .arena-mobile-nav,
      html.arena-mobile-scrolling .arena-detail-nav,
      html.arena-mobile-scrolling .modal-backdrop,
      html.arena-mobile-scrolling .sheet,
      html.arena-mobile-scrolling .nav-sheet {
        -webkit-backdrop-filter: none !important;
        backdrop-filter: none !important;
      }

      html.arena-mobile-scrolling .card,
      html.arena-mobile-scrolling .arena-card,
      html.arena-mobile-scrolling .arena-detail,
      html.arena-mobile-scrolling .arena-home-card,
      html.arena-mobile-scrolling .modal,
      html.arena-mobile-scrolling .sheet,
      html.arena-mobile-scrolling .nav-sheet,
      html.arena-mobile-scrolling .mobile-nav,
      html.arena-mobile-scrolling .desktop-nav,
      html.arena-mobile-scrolling .gi-game,
      html.arena-mobile-scrolling .fixture {
        box-shadow: none !important;
      }
    }
  `;
  document.head.appendChild(css);

  window.addEventListener('scroll', enableLightScroll, { passive: true });

  window.ArenaBDAMobilePerformance = Object.freeze({ version: 2 });
})();
