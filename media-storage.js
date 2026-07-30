(() => {
  'use strict';

  const MAX_SOURCE_BYTES = 10 * 1024 * 1024;
  const DEFAULT_MAX_DIMENSION = 1600;
  const DEFAULT_QUALITY = 0.82;

  const auth = window.ArenaBDAAuth;
  const storage = window.firebase?.storage?.();

  function slug(value, fallback = 'arquivo') {
    const normalized = String(value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
    return normalized || fallback;
  }

  function assertReady() {
    if (!storage) throw new Error('O armazenamento de imagens não carregou');
    if (!auth?.isAdmin?.()) throw new Error('Entre como administrador para enviar imagens');
  }

  async function imageSource(file) {
    if ('createImageBitmap' in window) return createImageBitmap(file);
    const url = URL.createObjectURL(file);
    try {
      const image = new Image();
      await new Promise((resolve, reject) => {
        image.onload = resolve;
        image.onerror = () => reject(new Error('Imagem inválida'));
        image.src = url;
      });
      return image;
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  function canvasBlob(canvas, type = 'image/webp', quality = DEFAULT_QUALITY) {
    return new Promise((resolve, reject) => {
      canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Não foi possível comprimir a imagem')), type, quality);
    });
  }

  async function optimize(file, options = {}) {
    if (!(file instanceof Blob) || !String(file.type || '').startsWith('image/')) throw new Error('Escolha uma imagem válida');
    if (file.size > (options.maxSourceBytes || MAX_SOURCE_BYTES)) throw new Error('A imagem deve ter no máximo 10 MB');

    const source = await imageSource(file);
    const sourceWidth = Number(source.width || source.naturalWidth || 1);
    const sourceHeight = Number(source.height || source.naturalHeight || 1);
    const maxDimension = Number(options.maxDimension || DEFAULT_MAX_DIMENSION);
    const scale = Math.min(1, maxDimension / Math.max(sourceWidth, sourceHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(sourceWidth * scale));
    canvas.height = Math.max(1, Math.round(sourceHeight * scale));
    const context = canvas.getContext('2d', { alpha: false });
    if (!context) throw new Error('Não foi possível processar a imagem');
    context.drawImage(source, 0, 0, canvas.width, canvas.height);
    source.close?.();

    return canvasBlob(canvas, 'image/webp', Number(options.quality || DEFAULT_QUALITY));
  }

  async function upload(file, options = {}) {
    assertReady();
    const optimized = await optimize(file, options);
    const folder = slug(options.folder || 'media');
    const name = slug(options.name || file.name || `imagem-${Date.now()}`);
    const path = `${folder}/${name}-${Date.now().toString(36)}.webp`;
    const reference = storage.ref().child(path);
    const task = await reference.put(optimized, {
      contentType: 'image/webp',
      cacheControl: 'public,max-age=31536000,immutable',
      customMetadata: {
        uploadedBy: auth.currentEmail?.() || '',
        originalName: String(file.name || '').slice(0, 120)
      }
    });
    const url = await task.ref.getDownloadURL();
    return Object.freeze({ url, path, bytes: optimized.size, widthLimit: Number(options.maxDimension || DEFAULT_MAX_DIMENSION) });
  }

  async function uploadTournamentBanner(file, tournamentId) {
    return upload(file, {
      folder: `tournaments/${slug(tournamentId, 'campeonato')}`,
      name: 'banner',
      maxDimension: 1600,
      quality: 0.84
    });
  }

  async function deletePath(path) {
    assertReady();
    if (!path) return;
    await storage.ref().child(String(path)).delete();
  }

  window.ArenaBDAMedia = Object.freeze({
    ready: () => Boolean(storage),
    optimize,
    upload,
    uploadTournamentBanner,
    deletePath,
    slug
  });
})();
