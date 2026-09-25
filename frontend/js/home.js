
/* =========================================
   CAPAS LOCAIS DOS CONTEÚDOS DEMO
========================================= */


const homeState = {
  user: null,

  catalog: [],
  filteredCatalog: [],

  currentPage: 1,
  limit: 8,
  totalPages: 1,

  heroIndex: 0,

  objectUrls: [],
};

/* =========================================
   ELEMENTOS
========================================= */

const profileMenu = document.querySelector('.profile-menu');
const profileTrigger = document.getElementById('profile-trigger');
const profileDropdown = document.getElementById('profile-dropdown');

const profileAvatar = document.getElementById('profile-avatar');
const profileAvatarMenu = document.getElementById('profile-avatar-menu');

const profileName = document.getElementById('profile-name');
const profileNameMenu = document.getElementById('profile-name-menu');

const profileRole = document.getElementById('profile-role');
const profileEmail = document.getElementById('profile-email');

const logoutButton = document.getElementById('logout-button');
const profileRefresh = document.getElementById('profile-refresh');

const searchButton = document.getElementById('search-button');

const heroBackdrop = document.getElementById('hero-backdrop');
const heroType = document.getElementById('hero-type');
const heroYear = document.getElementById('hero-year');
const heroTitle = document.getElementById('hero-title');
const heroSynopsis = document.getElementById('hero-synopsis');
const heroDuration = document.getElementById('hero-duration');
const heroRating = document.getElementById('hero-rating');

const heroDetails = document.getElementById('hero-details');
const heroRefresh = document.getElementById('hero-refresh');

const continueList = document.getElementById('continue-list');
const continueEmpty = document.getElementById('continue-empty');
const refreshHistory = document.getElementById('refresh-history');

const catalogList = document.getElementById('catalog-list');
const catalogEmpty = document.getElementById('catalog-empty');

const catalogSearch = document.getElementById('catalog-search');
const catalogType = document.getElementById('catalog-type');

const catalogPagination = document.getElementById('catalog-pagination');
const catalogPrev = document.getElementById('catalog-prev');
const catalogNext = document.getElementById('catalog-next');
const catalogPageLabel = document.getElementById('catalog-page-label');

/* =========================================
   INICIALIZAÇÃO
========================================= */

document.addEventListener('DOMContentLoaded', async () => {
  try {
    homeState.user = await Auth.requireAuth(['SUBSCRIBER']);

    if (!homeState.user) {
      return;
    }

    renderProfile(homeState.user);
    setupEvents();

    await Promise.all([
      loadCatalog(),
      loadWatchHistory(),
    ]);
  } catch (error) {
    handlePageError(error);
  }
});

window.addEventListener('beforeunload', () => {
  releaseObjectUrls();
});

/* =========================================
   EVENTOS
========================================= */

function setupEvents() {
  profileTrigger.addEventListener('click', (event) => {
    event.stopPropagation();

    const isOpen = profileMenu.classList.toggle('open');

    profileTrigger.setAttribute(
      'aria-expanded',
      String(isOpen),
    );
  });

  document.addEventListener('click', (event) => {
    if (!profileMenu.contains(event.target)) {
      closeProfileMenu();
    }
  });

  logoutButton.addEventListener('click', handleLogout);

  profileRefresh.addEventListener(
    'click',
    handleSessionRefresh,
  );

  searchButton.addEventListener('click', () => {
    document
      .getElementById('catalogo')
      .scrollIntoView({
        behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
      });

    window.setTimeout(() => {
      catalogSearch.focus();
    }, 450);
  });

  catalogSearch.addEventListener('input', applyCatalogFilters);

  catalogType.addEventListener('change', applyCatalogFilters);

  catalogPrev.addEventListener('click', async () => {
    if (homeState.currentPage <= 1) {
      return;
    }

    homeState.currentPage -= 1;

    await loadCatalog();

    scrollToCatalog();
  });

  catalogNext.addEventListener('click', async () => {
    if (homeState.currentPage >= homeState.totalPages) {
      return;
    }

    homeState.currentPage += 1;

    await loadCatalog();

    scrollToCatalog();
  });

  heroRefresh.addEventListener('click', () => {
    if (homeState.catalog.length <= 1) {
      return;
    }

    homeState.heroIndex =
      (homeState.heroIndex + 1) %
      homeState.catalog.length;

    renderHero(homeState.catalog[homeState.heroIndex]);
  });

  heroDetails.addEventListener('click', () => {
    const content =
      homeState.catalog[homeState.heroIndex];

    if (content) {
      openContent(content.id);
    }
  });

  refreshHistory.addEventListener(
    'click',
    async () => {
      await loadWatchHistory(true);
    },
  );
}

/* =========================================
   PERFIL
========================================= */

function renderProfile(user) {
  const initials = Auth.getInitials(Auth.getDisplayName(user));
  const roleLabel = Auth.getRoleLabel(user.role);

  profileAvatar.textContent = initials;
  profileAvatarMenu.textContent = initials;

  profileName.textContent = Auth.getDisplayName(user);
  profileNameMenu.textContent = Auth.getDisplayName(user);

  profileRole.textContent = roleLabel;
  profileEmail.textContent = user.email;
}

async function handleSessionRefresh() {
  closeProfileMenu();

  try {
    const user = await Auth.fetchCurrentUser();

    homeState.user = user;

    renderProfile(user);

    await Swal.fire({
      icon: 'success',
      title: 'Sessão atualizada',
      text: 'Seus dados foram sincronizados com a API.',
      timer: 1400,
      showConfirmButton: false,
    });
  } catch (error) {
    handlePageError(error);
  }
}

async function handleLogout() {
  closeProfileMenu();

  const result = await Swal.fire({
    icon: 'question',
    title: 'Sair da plataforma?',
    text: 'Sua sessão atual será encerrada.',
    showCancelButton: true,
    confirmButtonText: 'Sim, sair',
    cancelButtonText: 'Continuar assistindo',
    reverseButtons: true,
  });

  if (result.isConfirmed) {
    Auth.logout();
  }
}

function closeProfileMenu() {
  profileMenu.classList.remove('open');

  profileTrigger.setAttribute(
    'aria-expanded',
    'false',
  );
}

/* =========================================
   CATÁLOGO
========================================= */

let catalogLoadVersion = 0;
async function loadCatalog(showFeedback = false) {
  const version = ++catalogLoadVersion;
  renderCatalogSkeleton();

  try {
    const response = await Api.get(
      `/contents?page=${homeState.currentPage}&limit=${homeState.limit}`,
    );
    if (version !== catalogLoadVersion) return;
    if (homeState.currentPage > Math.max(1, response.meta.totalPages)) {
      homeState.currentPage = Math.max(1, response.meta.totalPages);
      return loadCatalog(showFeedback);
    }

    homeState.catalog = response?.data ?? [];

    homeState.totalPages =
      response?.meta?.totalPages || 1;

    if (
      homeState.heroIndex >=
      homeState.catalog.length
    ) {
      homeState.heroIndex = 0;
    }

    await applyCatalogFilters();
    renderPagination(response?.meta);

    if (homeState.catalog.length > 0) {
      await renderHero(
        homeState.catalog[homeState.heroIndex],
      );
    } else {
      renderEmptyHero();
    }

    if (showFeedback) {
      await Swal.fire({
        icon: 'success',
        title: 'Catálogo atualizado',
        timer: 1100,
        showConfirmButton: false,
      });
    }
  } catch (error) {
    if (version !== catalogLoadVersion) return;
    catalogList.innerHTML = '';

    catalogEmpty.classList.remove('hidden');

    handlePageError(error);
  }
}

async function applyCatalogFilters() {
  const search = catalogSearch.value
    .trim()
    .toLowerCase();

  const type = catalogType.value;

  homeState.filteredCatalog =
    homeState.catalog.filter((content) => {
      const matchesSearch =
        !search ||
        Presentation.contentTitle(content.title)
          ?.toLowerCase()
          .includes(search) ||
        content.synopsis
          ?.toLowerCase()
          .includes(search);

      const matchesType =
        !type || content.type === type;

      return matchesSearch && matchesType;
    });

  await renderCatalog(homeState.filteredCatalog);
}

let catalogRenderVersion = 0;
async function renderCatalog(contents) {
  const version = ++catalogRenderVersion;
  catalogList.innerHTML = '';

  if (contents.length === 0) {
    catalogEmpty.classList.remove('hidden');
    return;
  }

  catalogEmpty.classList.add('hidden');

  const cards = await Promise.all(
    contents.map(async (content) => {
      const thumbnail = await getThumbnailUrl(content);

      return createCatalogCard(
        content,
        thumbnail,
      );
    }),
  );

  if (version !== catalogRenderVersion) return;
  cards.forEach((card) => {
    catalogList.appendChild(card);
  });
}

function createCatalogCard(content, thumbnailUrl) {
  const article = document.createElement('article');

  article.className = 'catalog-card';
  article.tabIndex = 0;

  article.innerHTML = `
    <div
      class="catalog-card-media"
      ${
        thumbnailUrl
          ? `style="background-image:
              linear-gradient(
                to top,
                rgba(10, 11, 16, 0.35),
                rgba(10, 11, 16, 0.05)
              ),
              url('${thumbnailUrl}')"`
          : ''
      }
    >
      <span class="badge badge-primary catalog-card-type">
        ${escapeHtml(getContentTypeLabel(content.type))}
      </span>
    </div>

    <div class="catalog-card-content">
      <h3>${escapeHtml(Presentation.contentTitle(content.title))}</h3>

      <div class="catalog-card-meta">
        <span>
          <i class="fa-regular fa-calendar"></i>
          ${content.releaseYear ?? '—'}
        </span>

        <span>
          <i class="fa-regular fa-clock"></i>
          ${formatDuration(content.durationMinutes)}
        </span>
      </div>
    </div>
  `;

  Presentation.paintCover(article.querySelector('[class$="-card-media"]'), thumbnailUrl);
  article.addEventListener('click', () => {
    openContent(content.id);
  });

  article.addEventListener('keydown', (event) => {
    if (
      event.key === 'Enter' ||
      event.key === ' '
    ) {
      event.preventDefault();
      openContent(content.id);
    }
  });

  return article;
}

function renderCatalogSkeleton() {
  catalogEmpty.classList.add('hidden');

  catalogList.innerHTML = `
    <div class="skeleton-card"></div>
    <div class="skeleton-card"></div>
    <div class="skeleton-card"></div>
    <div class="skeleton-card"></div>
  `;
}

function renderPagination(meta) {
  const totalPages = meta?.totalPages ?? 0;

  if (totalPages <= 1) {
    catalogPagination.classList.add('hidden');
    return;
  }

  catalogPagination.classList.remove('hidden');

  catalogPageLabel.textContent =
    `Página ${meta.page} de ${totalPages}`;

  catalogPrev.disabled = meta.page <= 1;

  catalogNext.disabled =
    meta.page >= totalPages;
}

/* =========================================
   HERO
========================================= */

let heroRenderVersion = 0;
async function renderHero(content) {
  const version = ++heroRenderVersion;
  if (!content) {
    renderEmptyHero();
    return;
  }

  heroType.textContent =
    getContentTypeLabel(content.type);

  heroYear.textContent =
    content.releaseYear ?? '—';

  heroTitle.textContent =
    Presentation.contentTitle(content.title) ?? 'Conteúdo em destaque';

  heroSynopsis.textContent =
    content.synopsis ||
    'Descubra este conteúdo disponível na sua assinatura.';

  heroDuration.innerHTML = `
    <i class="fa-regular fa-clock"></i>
    ${formatDuration(content.durationMinutes)}
  `;

  const thumbnail = await getThumbnailUrl(content);
  if (version !== heroRenderVersion) return;

  Presentation.paintCover(heroBackdrop, thumbnail);

  await renderHeroRating(content.id, version);
}

async function renderHeroRating(contentId, version) {
  heroRating.innerHTML = `
    <i class="fa-solid fa-star"></i>
    Carregando avaliações...
  `;

  try {
    const rating = await Api.get(
      `/ratings/content/${contentId}`,
    );
    if (version !== heroRenderVersion) return;

    if (
      !rating ||
      rating.count === 0 ||
      rating.average === null
    ) {
      heroRating.innerHTML = `
        <i class="fa-regular fa-star"></i>
        Ainda sem avaliações
      `;

      return;
    }

    heroRating.innerHTML = `
      <i class="fa-solid fa-star"></i>
      ${Number(rating.average).toFixed(1)} ·
      ${rating.count}
      ${rating.count === 1 ? 'avaliação' : 'avaliações'}
    `;
  } catch {
    if (version !== heroRenderVersion) return;
    heroRating.innerHTML = `
      <i class="fa-regular fa-star"></i>
      Avaliação indisponível
    `;
  }
}

function renderEmptyHero() {
  heroRenderVersion++;
  heroType.textContent = 'Catálogo';
  heroYear.textContent = 'StreamOne';

  heroTitle.textContent =
    'Nenhum conteúdo disponível no momento.';

  heroSynopsis.textContent =
    'Quando houver títulos disponíveis para sua assinatura, eles aparecerão aqui.';

  heroDuration.innerHTML = `
    <i class="fa-regular fa-clock"></i>
    Aguardando novos conteúdos
  `;

  heroRating.innerHTML = `
    <i class="fa-regular fa-star"></i>
    Sem avaliações
  `;

  Presentation.paintCover(heroBackdrop, null);
}

/* =========================================
   HISTÓRICO
========================================= */

async function loadWatchHistory(showFeedback = false) {
  renderHistorySkeleton();

  try {
    const response = await Api.get(
      '/watch-history/me?page=1&limit=10',
    );

    const history = response?.data ?? [];

    if (history.length === 0) {
      continueList.innerHTML = '';
      continueEmpty.classList.remove('hidden');

      return;
    }

    continueEmpty.classList.add('hidden');

    const enrichedHistory =
      await Promise.all(
        history.map(async (item) => {
          try {
            const content = await Api.get(
              `/contents/${item.contentId}`,
            );

            return {
              ...item,
              content,
            };
          } catch {
            return {
              ...item,
              content: null,
            };
          }
        }),
      );

    await renderWatchHistory(
      enrichedHistory.filter(
        (item) => item.content,
      ),
    );

    if (showFeedback) {
      await Swal.fire({
        icon: 'success',
        title: 'Histórico atualizado',
        timer: 1100,
        showConfirmButton: false,
      });
    }
  } catch (error) {
    continueList.innerHTML = '';

    continueEmpty.classList.remove('hidden');

    handlePageError(error);
  }
}

async function renderWatchHistory(history) {
  continueList.innerHTML = '';

  if (history.length === 0) {
    continueEmpty.classList.remove('hidden');
    return;
  }

  const cards = await Promise.all(
    history.map(async (item) => {
      const thumbnail =
        await getThumbnailUrl(item.content);

      return createContinueCard(
        item,
        thumbnail,
      );
    }),
  );

  cards.forEach((card) => {
    continueList.appendChild(card);
  });
}

function createContinueCard(item, thumbnailUrl) {
  const content = item.content;

  const totalSeconds =
    content.durationMinutes
      ? content.durationMinutes * 60
      : 0;

  const progress =
    totalSeconds > 0
      ? Math.min(
          100,
          Math.round(
            (item.progressSeconds / totalSeconds) *
              100,
          ),
        )
      : item.completed
        ? 100
        : 0;

  const article = document.createElement('article');

  article.className = 'continue-card';
  article.tabIndex = 0;

  article.innerHTML = `
    <div
      class="continue-card-media"
      ${
        thumbnailUrl
          ? `style="background-image:
              url('${thumbnailUrl}')"`
          : ''
      }
    ></div>

    <div class="continue-card-overlay"></div>

    <div class="continue-card-content">
      <h3>${escapeHtml(Presentation.contentTitle(content.title))}</h3>

      <p>
        ${
          item.completed
            ? 'Concluído'
            : `${progress}% assistido`
        }
      </p>

      <div
        class="progress-track"
        aria-label="${progress}% concluído"
      >
        <div
          class="progress-value"
          style="width: ${progress}%"
        ></div>
      </div>
    </div>
  `;

  Presentation.paintCover(article.querySelector('.continue-card-media'), thumbnailUrl);
  article.addEventListener('click', () => {
    openContent(content.id);
  });

  article.addEventListener('keydown', (event) => {
    if (
      event.key === 'Enter' ||
      event.key === ' '
    ) {
      event.preventDefault();
      openContent(content.id);
    }
  });

  return article;
}

function renderHistorySkeleton() {
  continueEmpty.classList.add('hidden');

  continueList.innerHTML = `
    <div class="skeleton-card wide"></div>
    <div class="skeleton-card wide"></div>
  `;
}

/* =========================================
   THUMBNAILS PROTEGIDAS
========================================= */


const homeCoverCache = new Map();
async function getThumbnailUrl(content) {
  const key = content.thumbnailUrl || content.externalId || content.id;
  if (!homeCoverCache.has(key)) homeCoverCache.set(key, downloadHomeCover(content));
  return homeCoverCache.get(key);
}

async function downloadHomeCover(content) {
  // Se a API possui uma thumbnail, prioriza a imagem protegida.
  if (content?.thumbnailUrl) {
    try {
      const blob = await Api.download(content.thumbnailUrl);

      const objectUrl = URL.createObjectURL(blob);

      homeState.objectUrls.push(objectUrl);

      return objectUrl;
    } catch {
      console.warn('Não foi possível carregar a thumbnail da API; usando a capa alternativa.');
    }
  }

  // Para os conteúdos demo, utiliza a capa local como alternativa.
  const localCover = await Presentation.localCover(content);
  // Resolva pela página antes de passar a URL para as variáveis dos arquivos CSS.
  return localCover ? new URL(localCover, document.baseURI).href : null;
}

function releaseObjectUrls() {
  homeCoverCache.clear();
  homeState.objectUrls.forEach((url) => {
    URL.revokeObjectURL(url);
  });

  homeState.objectUrls = [];
}

/* =========================================
   NAVEGAÇÃO
========================================= */

function openContent(contentId) {
  window.location.href =
    `${APP_CONFIG.ROUTES.CONTENT}?id=${contentId}`;
}

function scrollToCatalog() {
  document
    .getElementById('catalogo')
    .scrollIntoView({
      behavior: 'smooth',
      block: 'start',
    });
}

/* =========================================
   HELPERS
========================================= */

function getContentTypeLabel(type) {
  const labels = {
    MOVIE: 'Filme',
    SERIES: 'Série',
    DOCUMENTARY: 'Documentário',
    OTHER: 'Outro',
  };

  return labels[type] ?? type ?? 'Conteúdo';
}

function formatDuration(minutes) {
  if (!minutes) {
    return 'Duração não informada';
  }

  if (minutes < 60) {
    return `${minutes} min`;
  }

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  if (remainingMinutes === 0) {
    return `${hours}h`;
  }

  return `${hours}h ${remainingMinutes}min`;
}

function escapeHtml(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

/* =========================================
   ERROS
========================================= */

function handlePageError(error) {
  const message =
    Array.isArray(error?.data?.message)
      ? error.data.message.join(' ')
      : error?.data?.message;

  if (error?.status === 401) {
    Auth.clearSession();

    Swal.fire({
      icon: 'warning',
      title: 'Sessão expirada',
      text:
        'Sua sessão não é mais válida. Entre novamente para continuar.',
      confirmButtonText: 'Ir para o login',
      allowOutsideClick: false,
    }).then(() => {
      window.location.href =
        APP_CONFIG.ROUTES.LOGIN;
    });

    return;
  }

  if (error?.status === 403) {
    Swal.fire({
      icon: 'warning',
      title: 'Acesso indisponível',
      text:
        message ||
        'Sua assinatura não permite acessar este recurso.',
      confirmButtonText: 'Entendi',
    });

    return;
  }

  if (error?.status === 0) {
    Swal.fire({
      icon: 'error',
      title: 'Servidor indisponível',
      text:
        message ||
        'Não foi possível conectar à API.',
      confirmButtonText: 'Entendi',
    });

    return;
  }

  Swal.fire({
    icon: 'error',
    title: 'Não foi possível carregar os dados',
    text:
      message ||
      'Ocorreu um erro inesperado ao consultar a API.',
    confirmButtonText: 'Entendi',
  });
}
