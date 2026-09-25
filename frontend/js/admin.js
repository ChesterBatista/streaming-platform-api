/* =========================================
   STREAMONE STUDIO — PAINEL DE GESTÃO
========================================= */


const adminState = {
  user: null,

  contents: [],
  categories: [],
  plans: [],
  subscriptions: [],
  users: [],

objectUrls: [],
};

/* =========================================
   ELEMENTOS
========================================= */

const adminSidebar = document.getElementById('admin-sidebar');
const sidebarBackdrop = document.getElementById('sidebar-backdrop');
const sidebarToggle = document.getElementById('sidebar-toggle');
const sidebarClose = document.getElementById('sidebar-close');

const adminAvatar = document.getElementById('admin-avatar');
const adminUserName = document.getElementById('admin-user-name');
const adminUserRole = document.getElementById('admin-user-role');
const adminGreetingName = document.getElementById('admin-greeting-name');

const adminLogout = document.getElementById('admin-logout');

const sidebarLinks = document.querySelectorAll('.sidebar-link');
const adminSections = document.querySelectorAll('.admin-section');

const statTotalContents =
  document.getElementById('stat-total-contents');

const statPublished =
  document.getElementById('stat-published');

const statDrafts =
  document.getElementById('stat-drafts');

const statCategories =
  document.getElementById('stat-categories');

const overviewContentList =
  document.getElementById('overview-content-list');

const overviewCreateContent =
  document.getElementById('overview-create-content');

const overviewOpenCatalog =
  document.getElementById('overview-open-catalog');

const overviewViewAll =
  document.getElementById('overview-view-all');

const adminContentsBody =
  document.getElementById('admin-contents-body');

const contentsCountLabel =
  document.getElementById('contents-count-label');

const adminContentSearch =
  document.getElementById('admin-content-search');

const adminContentStatus =
  document.getElementById('admin-content-status');

const adminContentType =
  document.getElementById('admin-content-type');

/* =========================================
   INICIALIZAÇÃO
========================================= */

document.addEventListener('DOMContentLoaded', async () => {
  try {
    const user = await Auth.requireAuth([
      'ADMIN',
      'CONTENT_MANAGER',
    ]);

    if (!user) {
      return;
    }

    adminState.user = user;

    renderAdminUser(user);
    applyRoleVisibility(user);
    setupAdminEvents();
    setupStudioForms();

    await loadOverview();
  } catch (error) {
    handleAdminError(error);
  }
});

window.addEventListener('beforeunload', releaseAdminObjectUrls);

/* =========================================
   PERFIL / PAPEL
========================================= */

function renderAdminUser(user) {
  const initials = Auth.getInitials(Auth.getDisplayName(user));
  const roleLabel = Auth.getRoleLabel(user.role);

  adminAvatar.textContent = initials;
  adminUserName.textContent = Auth.getDisplayName(user);
  adminUserRole.textContent = roleLabel;

  const firstName =
    Auth.getDisplayName(user)?.trim().split(/\s+/)[0] || 'equipe';

  adminGreetingName.textContent = firstName;
}

function applyRoleVisibility(user) {
  const adminOnlyElements =
    document.querySelectorAll('.sidebar-link.admin-only');

  if (user.role === 'ADMIN') {
    adminOnlyElements.forEach((element) => {
      element.classList.remove('hidden');
    });

    return;
  }

  adminOnlyElements.forEach((element) => {
    element.classList.add('hidden');
  });
}

/* =========================================
   EVENTOS GERAIS
========================================= */

function setupAdminEvents() {
  sidebarLinks.forEach((button) => {
    button.addEventListener('click', () => {
      const section = button.dataset.section;

      if (!section) {
        return;
      }

      openAdminSection(section);

      closeSidebar();
    });
  });

  sidebarToggle.addEventListener('click', openSidebar);
  sidebarClose.addEventListener('click', closeSidebar);
  sidebarBackdrop.addEventListener('click', closeSidebar);
  document.addEventListener('keydown', event => {
    if (!adminSidebar.classList.contains('open') || Swal.isVisible()) return;
    if (event.key === 'Escape') closeSidebar();
    if (event.key === 'Tab') {
      const buttons = [...adminSidebar.querySelectorAll('a, button')].filter(element => element.getClientRects().length && !element.disabled);
      const first = buttons[0];
      const last = buttons.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
  });
  window.matchMedia('(max-width: 950px)').addEventListener('change', closeSidebar);

  adminLogout.addEventListener('click', handleAdminLogout);

  overviewCreateContent.addEventListener('click', async () => {
    try { await editStudioContent(); } catch (error) { await handleAdminError(error); }
  });

  overviewOpenCatalog.addEventListener('click', () => {
    openAdminSection('contents');
  });

  overviewViewAll.addEventListener('click', () => {
    openAdminSection('contents');
  });

  adminContentSearch.addEventListener(
    'input',
    renderAdminContentsFiltered,
  );

  adminContentStatus.addEventListener(
    'change',
    renderAdminContentsFiltered,
  );

  adminContentType.addEventListener(
    'change',
    renderAdminContentsFiltered,
  );
}

/* =========================================
   NAVEGAÇÃO ENTRE SEÇÕES
========================================= */

async function openAdminSection(sectionName) {
  const targetSection = document.getElementById(
    `section-${sectionName}`,
  );

  if (!targetSection) {
    return;
  }

  if (
    targetSection.classList.contains('admin-only') &&
    adminState.user?.role !== 'ADMIN'
  ) {
    await Swal.fire({
      icon: 'warning',
      title: 'Acesso restrito',
      text: 'Este recurso está disponível apenas para administradores.',
      confirmButtonText: 'Entendi',
    });

    return;
  }

  adminSections.forEach((section) => {
    section.classList.add('hidden');
  });

  targetSection.classList.remove('hidden');

  sidebarLinks.forEach((button) => {
    const isActive =
      button.dataset.section === sectionName;

    button.classList.toggle('active', isActive);

    if (isActive) {
      button.setAttribute('aria-current', 'page');
    } else {
      button.removeAttribute('aria-current');
    }
  });

  window.scrollTo({
    top: 0,
    behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
  });

  await loadSectionData(sectionName);
}

async function loadSectionData(sectionName) {
  switch (sectionName) {
    case 'overview':
      await loadOverview();
      break;

    case 'contents':
      await loadAdminContents();
      break;

    case 'categories':
      await loadAdminCategories();
      break;

    case 'plans':
      await loadAdminPlans();
      break;

    case 'subscriptions':
      await loadAdminSubscriptions();
      break;

    case 'users':
      await loadAdminUsers();
      break;
  }
}

/* =========================================
   SIDEBAR MOBILE
========================================= */

function openSidebar() {
  adminSidebar.classList.add('open');
  sidebarBackdrop.classList.add('open');

  sidebarToggle.setAttribute(
    'aria-expanded',
    'true',
  );
  document.querySelector('.admin-workspace').inert = true;
  sidebarClose.focus();
}

function closeSidebar() {
  const wasOpen = adminSidebar.classList.contains('open');
  adminSidebar.classList.remove('open');
  sidebarBackdrop.classList.remove('open');

  sidebarToggle.setAttribute(
    'aria-expanded',
    'false',
  );
  document.querySelector('.admin-workspace').inert = false;
  if (wasOpen) sidebarToggle.focus();
}

/* =========================================
   LOGOUT
========================================= */

async function handleAdminLogout() {
  const result = await Swal.fire({
    icon: 'question',
    title: 'Encerrar sessão?',
    text: 'Você será direcionado para a tela de login.',
    showCancelButton: true,
    confirmButtonText: 'Sim, sair',
    cancelButtonText: 'Continuar no Studio',
    reverseButtons: true,
  });

  if (result.isConfirmed) {
    Auth.logout();
  }
}

/* =========================================
   VISÃO GERAL
========================================= */

async function loadOverview() {
  try {
    const [contents, categoriesResponse] = await Promise.all([studioAll('contents'), Api.get('/categories?page=1&limit=1')]);
    renderOverviewStats(contents, []);
    statCategories.textContent = String(categoriesResponse.meta.total);
    await renderOverviewContents(contents.slice(0, 4));
  } catch (error) {
    [statTotalContents, statPublished, statDrafts, statCategories].forEach(element => { element.textContent = '—'; });
    await handleAdminError(error);
  }
}

function renderOverviewStats(contents, categories) {
  const total = contents.length;

  const published = contents.filter(
    (content) => content.status === 'PUBLISHED',
  ).length;

  const drafts = contents.filter(
    (content) => content.status === 'DRAFT',
  ).length;

  statTotalContents.textContent = String(total);
  statPublished.textContent = String(published);
  statDrafts.textContent = String(drafts);
  statCategories.textContent = String(categories.length);
}

/* =========================================
   DESTAQUES DA VISÃO GERAL
========================================= */

async function renderOverviewContents(contents) {
  overviewContentList.innerHTML = '';

  if (contents.length === 0) {
    overviewContentList.innerHTML = `
      <p class="admin-muted">
        Nenhum conteúdo cadastrado.
      </p>
    `;

    return;
  }

  const cards = await Promise.all(
    contents.map(async (content) => {
      const image = await getAdminCover(content);

      const card = document.createElement('article');

      card.className = 'overview-content-card';

      card.innerHTML = `
        <div
          class="overview-content-cover"
          ${
            image
              ? `style="background-image:url('${image}')"`
              : ''
          }
        ></div>

        <div class="overview-content-info">
          <h3>${escapeAdminHtml(Presentation.contentTitle(content.title))}</h3>

          <p>
            ${getContentTypeLabel(content.type)}
            ·
            ${getStatusLabel(content.status)}
          </p>
        </div>
      `;

      Presentation.paintCover(card.querySelector('.overview-content-cover'), image);
      return card;
    }),
  );

  cards.forEach((card) => {
    overviewContentList.appendChild(card);
  });
}

/* =========================================
   CONTEÚDOS
========================================= */

async function loadAdminContents() {
  await studioPage('contents', async (contents, meta) => {
    contentsCountLabel.textContent = `${meta.total} conteúdo(s) · Os filtros se aplicam à página atual.`;
    await renderAdminContentsFiltered();
  });
}

async function renderAdminContentsFiltered() {
  const search = adminContentSearch.value
    .trim()
    .toLowerCase();

  const status = adminContentStatus.value;
  const type = adminContentType.value;

  const filtered = adminState.contents.filter(
    (content) => {
      const matchesSearch =
        !search ||
        Presentation.contentTitle(content.title)
          ?.toLowerCase()
          .includes(search);

      const matchesStatus =
        !status ||
        content.status === status;

      const matchesType =
        !type ||
        content.type === type;

      return (
        matchesSearch &&
        matchesStatus &&
        matchesType
      );
    },
  );

  await renderAdminContents(filtered);
}

let adminRenderVersion = 0;
async function renderAdminContents(contents) {
  const version = ++adminRenderVersion;
  adminContentsBody.innerHTML = '';

  if (contents.length === 0) {
    adminContentsBody.innerHTML = `
      <tr>
        <td colspan="5" class="table-empty">
          Nenhum conteúdo encontrado.
        </td>
      </tr>
    `;

    return;
  }

  for (const content of contents) {
    const cover = await getAdminCover(content);
    if (version !== adminRenderVersion) return;

    const row = document.createElement('tr');

    row.innerHTML = `
      <td>
        <div class="admin-table-content">
          <div
            class="admin-table-cover"
            ${
              cover
                ? `style="background-image:url('${cover}')"`
                : ''
            }
          ></div>

          <div class="admin-table-content-info">
            <strong>
              ${escapeAdminHtml(Presentation.contentTitle(content.title))}
            </strong>

            <small>
              ${escapeAdminHtml(content.externalId ?? 'Sem identificador externo')}
            </small>
          </div>
        </div>
      </td>

      <td>
        ${getContentTypeLabel(content.type)}
      </td>

      <td>
        ${content.releaseYear ?? '—'}
      </td>

      <td>
        <span
          class="admin-status ${String(content.status).toLowerCase()}"
        >
          ${getStatusLabel(content.status)}
        </span>
      </td>

      <td>
        <div class="admin-table-actions">
          <button
            type="button"
            class="admin-action-button"
            data-action="details"
            data-id="${content.id}"
          >
            <i class="fa-solid fa-eye"></i>
            Ver
          </button>

          <button
            type="button"
            class="admin-action-button"
            data-action="edit"
            data-id="${content.id}"
          >
            <i class="fa-solid fa-pen"></i>
            Editar
          </button>
        </div>
      </td>
    `;

    Presentation.paintCover(row.querySelector('.admin-table-cover'), cover);
    adminContentsBody.appendChild(row);
  }

  setupContentTableActions();
}

function setupContentTableActions() {
  adminContentsBody.querySelectorAll('.admin-action-button').forEach(button => {
    button.addEventListener('click', async () => {
      button.disabled = true;
      try {
        const id = Number(button.dataset.id);
        if (button.dataset.action === 'details') await showAdminContentDetails(id);
        else await editStudioContent(id);
      } catch (error) { await handleAdminError(error); }
      finally { button.disabled = false; }
    });
  });
}



/* =========================================
   DETALHES ADMINISTRATIVOS DO CONTEÚDO
========================================= */

async function showAdminContentDetails(contentId) {
  const [content, plans, categories] = await Promise.all([
    Api.get(`/contents/${contentId}`), Api.get(`/contents/${contentId}/plans`), Api.get(`/contents/${contentId}/categories`),
  ]);
  const cover = await getAdminCover(content);
  await Swal.fire({
    titleText: Presentation.contentTitle(content.title),
    html: `<div class="studio-details">
      ${cover ? '<img class="studio-preview" alt="Capa do conteúdo" src="' + escapeAdminHtml(cover) + '">' : ''}
      <p>${escapeAdminHtml(getContentTypeLabel(content.type))} · ${escapeAdminHtml(getStatusLabel(content.status))}</p>
      <p>${escapeAdminHtml(content.releaseYear ?? '—')} · ${formatAdminDuration(content.durationMinutes)}</p>
      <p>${escapeAdminHtml(content.synopsis || 'Sinopse não informada.')}</p>
      <p><strong>Planos:</strong> ${escapeAdminHtml(plans.map(plan => Presentation.contentTitle(plan.name)).join(', ') || 'Nenhum')}</p>
      <p><strong>Categorias:</strong> ${escapeAdminHtml(categories.map(category => Presentation.contentTitle(category.name)).join(', ') || 'Nenhuma')}</p>
      <div id="studio-detail-actions" class="studio-actions"></div></div>`,
    confirmButtonText: 'Fechar',
    didOpen: () => {
      const actions = document.getElementById('studio-detail-actions');
      actions.append(
        studioButton('Editar', () => editStudioContent(contentId)),
        studioButton('Alterar status', () => changeStudioStatus('contents', contentId)),
        studioButton('Gerenciar planos', () => studioLinks(contentId, 'plans')),
        studioButton('Gerenciar categorias', () => studioLinks(contentId, 'categories')),
        studioButton('Enviar capa', () => uploadStudioThumbnail(contentId)),
      );
    },
  });
}

/* =========================================
   CATEGORIAS
========================================= */

async function loadAdminCategories() {
  await studioPage('categories', (categories, meta) => {
    document.getElementById('categories-count-label').textContent = `${meta.total} categoria(s) cadastrada(s)`;
    const body = document.getElementById('admin-categories-body');
    body.innerHTML = '';
    categories.forEach(category => {
      const row = document.createElement('tr');
      row.innerHTML = `<td><strong>${escapeAdminHtml(Presentation.contentTitle(category.name))}</strong></td><td>${escapeAdminHtml(category.description || 'Sem descrição.')}</td><td></td>`;
      row.lastElementChild.append(studioButton('Editar', () => editStudioResource('categories', category.id)));
      body.append(row);
    });
    if (!categories.length) body.innerHTML = '<tr><td colspan="3" class="table-empty">Nenhuma categoria cadastrada.</td></tr>';
  });
}

/* =========================================
   PLANOS
========================================= */

async function loadAdminPlans() {
  await studioPage('plans', plans => {
    const list = document.getElementById('admin-plans-list');
    list.innerHTML = '';
    plans.forEach(plan => {
      const card = document.createElement('article');
      card.className = 'admin-plan-card';
      card.innerHTML = `<span class="admin-status ${escapeAdminHtml(plan.status.toLowerCase())}">${escapeAdminHtml(getStatusLabel(plan.status))}</span><h3>${escapeAdminHtml(Presentation.contentTitle(plan.name))}</h3><strong class="admin-plan-price">${formatCurrency(plan.price)}</strong><p>${escapeAdminHtml(plan.description || 'Sem descrição.')}</p><div class="admin-plan-actions"></div>`;
      card.lastElementChild.append(studioButton('Editar', () => editStudioResource('plans', plan.id)), studioButton('Alterar status', () => changeStudioStatus('plans', plan.id)));
      list.append(card);
    });
    if (!plans.length) list.textContent = 'Nenhum plano cadastrado.';
  });
}

/* =========================================
   ASSINATURAS
========================================= */

async function loadAdminSubscriptions() {
  await studioPage('subscriptions', async subscriptions => {
    const references = await Promise.allSettled([studioAll('users'), studioAll('plans')]);
    const expiredSession = references.find(result => result.status === 'rejected' && result.reason?.status === 401);
    if (expiredSession) throw expiredSession.reason;
    const users = new Map((references[0].status === 'fulfilled' ? references[0].value : adminState.users).map(user => [user.id, user]));
    const plans = new Map((references[1].status === 'fulfilled' ? references[1].value : adminState.plans).map(plan => [plan.id, plan]));
    const body = document.getElementById('admin-subscriptions-body');
    body.innerHTML = '';
    subscriptions.forEach(item => {
      const user = users.get(item.userId);
      const plan = plans.get(item.planId);
      const userLabel = user ? `${Auth.getDisplayName(user)} (#${Number(item.userId)})` : `Usuário #${Number(item.userId)}`;
      const planLabel = plan ? `${Presentation.contentTitle(plan.name)} (#${Number(item.planId)})` : `Plano #${Number(item.planId)}`;
      const row = document.createElement('tr');
      row.innerHTML = `<td>#${Number(item.id)}</td><td>${escapeAdminHtml(userLabel)}</td><td>${escapeAdminHtml(planLabel)}</td><td><span class="admin-status ${escapeAdminHtml(item.status.toLowerCase())}">${escapeAdminHtml(getStatusLabel(item.status))}</span></td><td>${formatSubscriptionPeriod(item)}</td><td></td>`;
      if (studioTransitions('subscriptions', item).length) row.lastElementChild.append(studioButton('Alterar status', () => changeStudioStatus('subscriptions', item.id)));
      else row.lastElementChild.textContent = 'Encerrada';
      body.append(row);
    });
    if (!subscriptions.length) body.innerHTML = '<tr><td colspan="6" class="table-empty">Nenhuma assinatura cadastrada.</td></tr>';
  });
}

/* =========================================
   USUÁRIOS
========================================= */

async function loadAdminUsers() {
  await studioPage('users', users => {
    const body = document.getElementById('admin-users-body');
    body.innerHTML = '';
    users.forEach(user => {
      const row = document.createElement('tr');
      row.innerHTML = `<td><div class="admin-table-content"><span class="admin-user-avatar">${escapeAdminHtml(Auth.getInitials(Auth.getDisplayName(user)))}</span><strong>${escapeAdminHtml(Auth.getDisplayName(user))}</strong></div></td><td>${escapeAdminHtml(user.email)}</td><td>${escapeAdminHtml(Auth.getRoleLabel(user.role))}</td><td>${escapeAdminHtml(getStatusLabel(user.status))}</td>`;
      body.append(row);
    });
    if (!users.length) body.innerHTML = '<tr><td colspan="4" class="table-empty">Nenhum usuário cadastrado.</td></tr>';
  });
}

/* =========================================
   CAPAS
========================================= */

const adminCoverCache = new Map();
async function getAdminCover(content) {
  const key = content.thumbnailUrl || content.externalId || content.id;
  if (!adminCoverCache.has(key)) adminCoverCache.set(key, downloadAdminCover(content));
  return adminCoverCache.get(key);
}

async function downloadAdminCover(content) {
  if (content.thumbnailUrl) {
    try {
      const blob = await Api.download(
        content.thumbnailUrl,
      );

      const url = URL.createObjectURL(blob);

      adminState.objectUrls.push(url);

      return url;
    } catch {
      // Fallback para capa demo local.
    }
  }

  const localCover = await Presentation.localCover(content);
  // A variável CSS é consumida em base.css: evite resolver assets relativos a /css/.
  return localCover ? new URL(localCover, document.baseURI).href : null;
}

function releaseAdminObjectUrls() {
  adminCoverCache.clear();
  adminState.objectUrls.forEach((url) => {
    URL.revokeObjectURL(url);
  });

  adminState.objectUrls = [];
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

function getStatusLabel(status) {
  const labels = {
    DRAFT: 'Rascunho',
    PUBLISHED: 'Publicado',
    ARCHIVED: 'Arquivado',

    ACTIVE: 'Ativo',
    INACTIVE: 'Inativo',
    CANCELLED: 'Cancelado',
    EXPIRED: 'Expirado',
  };

  return labels[status] ?? status ?? '—';
}

function formatAdminDuration(minutes) {
  const value = Number(minutes);

  if (!value || value <= 0) {
    return 'Não informada';
  }

  if (value < 60) {
    return `${value} min`;
  }

  const hours = Math.floor(value / 60);
  const rest = value % 60;

  return rest
    ? `${hours}h ${rest}min`
    : `${hours}h`;
}

function formatCurrency(value) {
  const number = Number(value);

  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(
    Number.isFinite(number) ? number : 0,
  );
}

function formatSubscriptionPeriod(subscription) {
  const start = subscription.startsAt
    ? new Date(subscription.startsAt)
        .toLocaleDateString('pt-BR')
    : '—';

  const end = subscription.expiresAt
    ? new Date(subscription.expiresAt)
        .toLocaleDateString('pt-BR')
    : 'Sem expiração';

  return `${start} · ${end}`;
}

function escapeAdminHtml(value = '') {
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

async function handleAdminError(error) {
  const message =
    Array.isArray(error?.data?.message)
      ? error.data.message.join(' ')
      : error?.data?.message;

  if (error?.status === 401) {
    Auth.clearSession();

    await Swal.fire({
      icon: 'warning',
      title: 'Sessão expirada',
      text: 'Entre novamente para continuar.',
      confirmButtonText: 'Ir para o login',
      allowOutsideClick: false,
    }).then(() => {
      window.location.href =
        APP_CONFIG.ROUTES.LOGIN;
    });

    return;
  }

  if (error?.status === 403) {
    await Swal.fire({
      icon: 'warning',
      title: 'Acesso restrito',
      text:
        message ||
        'Seu perfil não possui permissão para acessar este recurso.',
      confirmButtonText: 'Entendi',
    });

    return;
  }

  await Swal.fire({
    icon: 'error',
    title: error?.status === 409 ? 'Conflito na operação' : 'Não foi possível concluir a operação',
    text:
      message ||
      'Ocorreu um erro ao consultar a API.',
    confirmButtonText: 'Entendi',
  });
}
