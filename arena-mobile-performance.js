(() => {
  'use strict';

  // Reduz o custo de composição no celular somente durante a rolagem.
  // A interface volta ao visual completo assim que o usuário para.
  const root = document.documentElement;
  let timer = 0;

  const enableLightScroll = () => {
    root.classList.add('arena-mobile-scrolling');
    clearTimeout(timer);
    timer = window.setTimeout(() => {
      root.classList.remove('arena-mobile-scrolling');
    }, 180);
  };

  const css = document.createElement('style');
  css.id = 'arenaMobilePerformanceStyles';
  css.textContent = `
    @media (max-width: 768px) {
      html.arena-mobile-scrolling *,
      html.arena-mobile-scrolling *::before,
      html.arena-mobile-scrolling *::after {
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
      html.arena-mobile-scrolling .desktop-nav {
        box-shadow: none !important;
      }

      html.arena-mobile-scrolling * {
        scroll-behavior: auto !important;
      }
    }
  `;
  document.head.appendChild(css);

  window.addEventListener('scroll', enableLightScroll, { passive: true });
  window.addEventListener('touchmove', enableLightScroll, { passive: true });
})();
