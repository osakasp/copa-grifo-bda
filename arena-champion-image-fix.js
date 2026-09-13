(() => {
  'use strict';

  if (window.ArenaBDAChampionImageFix?.version >= 1) return;

  const VERSION = 1;
  const FILE_ID = 'championBannerFile';
  const FIELD_CLASS = 'champion-banner-field';
  const toast = message => typeof window.toast === 'function' ? window.toast(message) : console.info(message);
  const escapeAttr = value => String(value || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;');

  function install() {
    const form = document.getElementById('championForm');
    if (!form || document.getElementById(FILE_ID) || form.querySelector(`.${FIELD_CLASS}`)) return false;
    const grid = form.querySelector('.form-grid');
    if (!grid) return false;
    const field = document.createElement('label');
    field.className = FIELD_CLASS;
    field.innerHTML = `Banner do campeão<input id="${FILE_ID}" type="file" accept="image/png,image/jpeg,image/webp"><small>Opcional. PNG, JPG e WebP. A imagem será otimizada antes de ser salva.</small><div class="champion-banner-preview" id="championBannerPreview"><div class="champion-banner-preview-media">Prévia do banner</div></div>`;
    grid.appendChild(field);
    const input = field.querySelector(`#${FILE_ID}`);
    input.addEventListener('change', async () => {
      const file = input.files?.[0];
      if (!file) return;
      if (!file.type.startsWith('image/')) { input.value = ''; toast('Escolha uma imagem válida'); return; }
      if (file.size > 8 * 1024 * 1024) { input.value = ''; toast('O banner deve ter no máximo 8 MB'); return; }
      try {
        const source = await new Promise((resolve, reject) => { const r = new FileReader(); r.onload = () => resolve(r.result); r.onerror = () => reject(new Error('Falha ao ler a imagem')); r.readAsDataURL(file); });
        const image = await new Promise((resolve, reject) => { const img = new Image(); img.onload = () => resolve(img); img.onerror = () => reject(new Error('Imagem inválida')); img.src = source; });
        const scale = Math.min(1, 1000 / Math.max(image.width, image.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(image.width * scale)); canvas.height = Math.max(1, Math.round(image.height * scale));
        const ctx = canvas.getContext('2d'); if (!ctx) throw new Error('O navegador não conseguiu processar o banner');
        ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
        const data = canvas.toDataURL('image/webp', 0.86);
        input.dataset.arenaBannerData = data;
        const preview = document.getElementById('championBannerPreview');
        if (preview) preview.innerHTML = `<div class="champion-banner-preview-media"><img src="${escapeAttr(data)}" alt="Prévia do banner"></div><span class="champion-banner-preview-copy">Banner pronto para salvar.</span>`;
        toast('Banner carregado');
      } catch (error) { input.value = ''; delete input.dataset.arenaBannerData; toast(error.message || 'Não foi possível carregar o banner'); }
    });
    return true;
  }

  const observer = new MutationObserver(install);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  [0, 100, 400, 1000, 2200].forEach(delay => setTimeout(install, delay));
  window.ArenaBDAChampionImageFix = Object.freeze({ version: VERSION, install });
})();
