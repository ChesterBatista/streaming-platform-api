/* Helpers de apresentação: nunca modificam os objetos recebidos da API. */
const Presentation = {
  paintCover(element, url) {
    element.classList.toggle('cinematic-cover', Boolean(url));
    element.style.setProperty('--cover-image', url ? `url("${url}")` : 'none');
    element.style.backgroundImage = '';
  },
  contentTitle(value) {
    return String(value ?? '').replace(/^\[DEMO\]\s*/i, '');
  },

  async localCover(content) {
    const covers = {
      'demo-orbita-azul': 'orbita-azul',
      'demo-caminhos-do-vale': 'caminhos-do-vale',
      'demo-memorias-do-futuro': 'memorias-do-futuro',
      'demo-projeto-aurora': 'projeto-aurora',
      'demo-ultimo-farol': 'ultimo-farol',
    };
    const slug = covers[content?.externalId];
    if (slug) return `./assets/images/covers/${slug}.png`;
    if (this.contentTitle(content?.title).trim().toLowerCase() !== 'horizonte final') return null;
    const path = './assets/images/covers/horizonte-final.png';
    return new Promise((resolve) => {
      const image = new Image();
      image.onload = () => resolve(path);
      image.onerror = () => resolve(null);
      image.src = path;
    });
  },
};
