(() => {
  'use strict';

  const KEY = 'bda-v4-news';

  function seed() {
    const now = Date.now();
    return [{
      id: 'central-noticias-arena-bda',
      title: 'Arena BDA ganha uma central de notícias',
      summary: 'Comunicados, resultados e novidades do clã agora têm um espaço próprio.',
      content: 'A nova Central de Notícias reúne as informações importantes da Arena BDA em um só lugar.\n\nA administração poderá publicar resultados, anúncios de campeonatos, novidades dos clubes e comunicados para toda a comunidade.',
      category: 'Comunidade',
      image: '',
      featured: true,
      published: true,
      author: 'Admin BDA',
      createdAt: now,
      publishedAt: now,
      cloud: false,
      pending: false
    }];
  }

  try {
    const current = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (!Array.isArray(current)) localStorage.setItem(KEY, JSON.stringify(seed()));
  } catch {
    localStorage.setItem(KEY, JSON.stringify(seed()));
  }
})();