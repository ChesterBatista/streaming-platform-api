/* Operações do Studio, conforme controllers e DTOs existentes. */
const studioPages = {};
const studioBusy = new Set();
const studioAdminResources = ['plans', 'subscriptions', 'users'];

function studioAllowed(resource) {
  return ['ADMIN', 'CONTENT_MANAGER'].includes(adminState.user?.role) &&
    (!studioAdminResources.includes(resource) || adminState.user.role === 'ADMIN');
}

async function studioAll(resource) {
  const rows = [];
  let page = 1;
  let response;
  do {
    response = await Api.get(`/${resource}?page=${page}&limit=100`);
    rows.push(...response.data);
    page++;
  } while (page <= response.meta.totalPages);
  return rows;
}

async function studioPage(resource, render) {
  if (!studioAllowed(resource) || studioBusy.has(resource)) return;
  studioBusy.add(resource);
  const pagination = document.getElementById(`admin-${resource}-pagination`);
  const section = document.getElementById(`section-${resource}`);
  section.setAttribute('aria-busy', 'true');
  pagination.querySelectorAll('button').forEach(button => { button.disabled = true; });
  try {
    let page = studioPages[resource] || 1;
    let response = await Api.get(`/${resource}?page=${page}&limit=10`);
    const last = Math.max(1, response.meta.totalPages);
    if (page > last) {
      page = last;
      response = await Api.get(`/${resource}?page=${page}&limit=10`);
    }
    studioPages[resource] = page;
    adminState[resource] = response.data;
    await render(response.data, response.meta);
    pagination.classList.remove('hidden');
    pagination.replaceChildren();
    const previous = studioButton('Anterior', () => navigate(-1));
    const next = studioButton('Próxima', () => navigate(1));
    previous.disabled = page <= 1;
    next.disabled = page >= last;
    const label = document.createElement('span');
    label.setAttribute('aria-live', 'polite');
    label.textContent = `Página ${page} de ${last} · ${response.meta.total} registro(s)`;
    pagination.append(previous, label, next);
    function navigate(delta) {
      studioPages[resource] = page + delta;
      return loadSectionData(resource);
    }
  } catch (error) {
    adminState[resource] = [];
    const body = document.getElementById(`admin-${resource}-body`);
    if (body) {
      const row = document.createElement('tr');
      const cell = document.createElement('td');
      cell.colSpan = { contents: 5, categories: 3, subscriptions: 6, users: 4 }[resource];
      cell.className = 'table-empty';
      cell.textContent = 'Não foi possível carregar esta página. Tente novamente.';
      row.append(cell);
      body.replaceChildren(row);
    } else {
      document.getElementById('admin-plans-list').textContent = 'Não foi possível carregar os planos. Tente novamente.';
    }
    pagination.replaceChildren(studioButton('Tentar novamente', () => loadSectionData(resource)));
    pagination.classList.remove('hidden');
    await handleAdminError(error);
  } finally {
    studioBusy.delete(resource);
    section.setAttribute('aria-busy', 'false');
  }
}

function studioButton(text, action) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'admin-action-button';
  button.textContent = text;
  button.addEventListener('click', async () => {
    button.disabled = true;
    try { await action(); } catch (error) { await handleAdminError(error); }
    finally { button.disabled = false; }
  });
  return button;
}

function studioField(name, label, value = '', attributes = '', tag = 'input') {
  const escaped = escapeAdminHtml(value ?? '');
  return `<label for="studio-${name}">${label}</label>` + (tag === 'textarea'
    ? `<textarea id="studio-${name}" name="${name}" ${attributes}>${escaped}</textarea>`
    : `<input id="studio-${name}" name="${name}" value="${escaped}" ${attributes}>`);
}

function studioSelect(name, label, options, selected = '') {
  return `<label for="studio-${name}">${label}</label><select id="studio-${name}" name="${name}" required>` +
    options.map(([value, text]) => `<option value="${escapeAdminHtml(value)}" ${String(value) === String(selected) ? 'selected' : ''}>${escapeAdminHtml(text)}</option>`).join('') + '</select>';
}

function studioErrorMessage(error) {
  const message = error?.data?.message;
  return (Array.isArray(message) ? message.join(' ') : message) || 'Não foi possível concluir a operação.';
}

async function studioForm(title, fields, save) {
  return Swal.fire({
    titleText: title,
    html: `<form id="studio-form" class="studio-form">${fields}</form>`,
    showCancelButton: true,
    confirmButtonText: 'Salvar', cancelButtonText: 'Cancelar',
    showLoaderOnConfirm: true,
    allowOutsideClick: () => !Swal.isLoading(),
    allowEscapeKey: () => !Swal.isLoading(),
    didOpen: () => {
      document.getElementById('studio-form').addEventListener('submit', event => {
        event.preventDefault();
        if (!Swal.isLoading()) Swal.clickConfirm();
      });
    },
    preConfirm: async () => {
      const form = document.getElementById('studio-form');
      if (!form.reportValidity()) return false;
      try { return await save(Object.fromEntries(new FormData(form))); }
      catch (error) {
        if (error?.status === 401) {
          Swal.close();
          await handleAdminError(error);
        } else {
          const prefix = error?.status === 409 ? 'Conflito: ' : error?.status === 403 ? 'Acesso restrito: ' : '';
          Swal.showValidationMessage(escapeAdminHtml(prefix + studioErrorMessage(error)));
        }
        return false;
      }
    },
  });
}

async function studioSaved(resource) {
  await Swal.fire({ icon: 'success', titleText: 'Alteração salva!', timer: 1200, showConfirmButton: false });
  await loadSectionData(resource);
  if (!document.getElementById('section-overview').classList.contains('hidden')) await loadOverview();
}

async function editStudioContent(id) {
  if (!studioAllowed('contents')) return;
  const item = id ? await Api.get(`/contents/${id}`) : {};
  const fields = studioField('title', 'Título', Presentation.contentTitle(item.title), 'required maxlength="180"') +
    studioSelect('type', 'Tipo', ['MOVIE', 'SERIES', 'DOCUMENTARY', 'OTHER'].map(value => [value, getContentTypeLabel(value)]), item.type) +
    studioField('synopsis', 'Sinopse', item.synopsis, '', 'textarea') +
    studioField('releaseYear', 'Ano', item.releaseYear, `type="number" min="1800" max="${new Date().getUTCFullYear() + 5}" step="1"`) +
    studioField('durationMinutes', 'Duração em minutos', item.durationMinutes, 'type="number" min="1" max="2147483647" step="1"') +
    studioField('externalId', 'Identificador externo', item.externalId, 'maxlength="120"');
  const result = await studioForm(id ? 'Editar conteúdo' : 'Novo conteúdo', fields, async values => {
    values.title = values.title.trim();
    if (!values.title) throw { data: { message: 'Informe o título.' } };
    // Preserva o prefixo original no banco, inclusive ao editar outros campos.
    const prefix = item.title?.match(/^\[DEMO\]\s*/i)?.[0];
    if (prefix) values.title = prefix + values.title;
    for (const key of ['releaseYear', 'durationMinutes']) values[key] = values[key] === '' ? null : Number(values[key]);
    for (const key of ['synopsis', 'externalId']) values[key] = values[key] || null;
    return id ? Api.patch(`/contents/${id}`, values) : Api.post('/contents', values);
  });
  if (result.isConfirmed) await studioSaved('contents');
}

async function editStudioResource(resource, id) {
  if (!studioAllowed(resource)) return;
  const item = id ? await Api.get(`/${resource}/${id}`) : {};
  const isPlan = resource === 'plans';
  const displayName = Presentation.contentTitle(item.name);
  const originalPrefix = item.name ? item.name.slice(0, item.name.length - displayName.length) : '';
  const fields = studioField('name', 'Nome', displayName, `required maxlength="${100 - originalPrefix.length}"`) +
    studioField('description', 'Descrição', item.description, `maxlength="${isPlan ? 500 : 300}"`, 'textarea') +
    (isPlan ? studioField('price', 'Preço (R$)', item.price, 'type="number" min="0" max="99999999.99" step="0.01" required') : '');
  const result = await studioForm(`${id ? 'Editar' : 'Novo cadastro de'} ${isPlan ? 'plano' : 'categoria'}`, fields, values => {
    values.name = values.name.trim();
    if (!values.name) throw { data: { message: 'Informe o nome.' } };
    // A limpeza é apenas visual: mantenha o nome original ao editar outros campos.
    values.name = values.name === displayName ? item.name : originalPrefix + values.name;
    if (isPlan) values.price = Number(values.price);
    else values.description = values.description || null;
    return id ? Api.patch(`/${resource}/${id}`, values) : Api.post(`/${resource}`, values);
  });
  if (result.isConfirmed) await studioSaved(resource);
}

function studioTransitions(resource, item) {
  if (resource === 'contents') return { DRAFT: ['PUBLISHED', 'ARCHIVED'], PUBLISHED: ['ARCHIVED'], ARCHIVED: ['DRAFT'] }[item.status] || [];
  if (resource === 'plans') return [item.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE'];
  if (!['ACTIVE', 'INACTIVE'].includes(item.status)) return [];
  const expired = item.expiresAt && new Date(item.expiresAt) <= new Date();
  if (expired) return ['CANCELLED', 'EXPIRED'];
  return [...(item.status === 'ACTIVE' ? ['INACTIVE'] : new Date(item.startsAt) <= new Date() ? ['ACTIVE'] : []), 'CANCELLED'];
}

async function changeStudioStatus(resource, id) {
  if (!studioAllowed(resource)) return;
  const item = await Api.get(`/${resource}/${id}`);
  let statuses = studioTransitions(resource, item);
  let note = '';
  if (resource === 'contents' && item.status === 'DRAFT') {
    const plans = await Api.get(`/contents/${id}/plans`);
    note = '<p>Para publicar, vincule pelo menos um plano.</p>';
    if (!plans.length) statuses = statuses.filter(status => status !== 'PUBLISHED');
  }
  if (!statuses.length) return Swal.fire({ icon: 'info', titleText: 'Estado terminal', text: 'Esta assinatura não aceita novas transições.' });
  const result = await studioForm('Alterar status', note + studioSelect('status', 'Novo status', statuses.map(status => [status, getStatusLabel(status)])), values => Api.patch(`/${resource}/${id}/status`, values));
  if (result.isConfirmed) await studioSaved(resource);
}

async function createStudioSubscription() {
  if (!studioAllowed('subscriptions')) return;
  const [users, plans] = await Promise.all([studioAll('users'), studioAll('plans')]);
  const fields = studioSelect('userId', 'Usuário ativo', users.filter(user => user.status === 'ACTIVE').map(user => [user.id, `${Auth.getDisplayName(user)} · ${user.email}`])) +
    studioSelect('planId', 'Plano ativo', plans.filter(plan => plan.status === 'ACTIVE').map(plan => [plan.id, Presentation.contentTitle(plan.name)])) +
    studioField('expiresAt', 'Expiração opcional (horário local)', '', 'type="datetime-local" step="1"');
  const result = await studioForm('Nova assinatura', fields, values => {
    const body = { userId: Number(values.userId), planId: Number(values.planId) };
    if (values.expiresAt) {
      const date = new Date(values.expiresAt);
      if (!Number.isFinite(date.getTime()) || date <= new Date()) throw { data: { message: 'A expiração deve estar no futuro.' } };
      body.expiresAt = date.toISOString();
    }
    return Api.post('/subscriptions', body);
  });
  if (result.isConfirmed) await studioSaved('subscriptions');
}

async function studioLinks(id, resource) {
  if (!studioAllowed('contents')) return;
  const [content, linked, available] = await Promise.all([
    Api.get(`/contents/${id}`), Api.get(`/contents/${id}/${resource}`), studioAll(resource),
  ]);
  const name = resource === 'plans' ? 'planos' : 'categorias';
  const choices = available.filter(item => !linked.some(link => link.id === item.id));
  const result = await Swal.fire({
    titleText: `${Presentation.contentTitle(content.title)} · ${name}`,
    html: '<div id="studio-links" class="studio-links"></div>',
    showCancelButton: true, cancelButtonText: 'Fechar', confirmButtonText: 'Vincular',
    showConfirmButton: choices.length > 0,
    input: choices.length ? 'select' : undefined,
    inputOptions: Object.fromEntries(choices.map(item => [item.id, Presentation.contentTitle(item.name)])),
    inputLabel: choices.length ? `Selecionar ${name}` : undefined,
    showLoaderOnConfirm: true,
    allowOutsideClick: () => !Swal.isLoading(),
    preConfirm: async value => {
      try { return await Api.post(`/contents/${id}/${resource}/${Number(value)}`); }
      catch (error) {
        if (error.status === 401) { Swal.close(); await handleAdminError(error); }
        else Swal.showValidationMessage(escapeAdminHtml(studioErrorMessage(error)));
        return false;
      }
    },
    didOpen: () => {
      const list = document.getElementById('studio-links');
      if (!linked.length) list.textContent = `Nenhum vínculo de ${name}.`;
      linked.forEach(item => {
        const row = document.createElement('p');
        const label = document.createElement('span');
        label.textContent = Presentation.contentTitle(item.name);
        const button = studioButton('Desvincular', async () => {
          const confirm = await Swal.fire({ icon: 'question', titleText: 'Remover vínculo?', text: Presentation.contentTitle(item.name), showCancelButton: true, confirmButtonText: 'Desvincular', cancelButtonText: 'Cancelar' });
          if (confirm.isConfirmed) {
            await Api.delete(`/contents/${id}/${resource}/${item.id}`);
            await studioSaved('contents');
          }
          await studioLinks(id, resource);
        });
        if (resource === 'plans' && content.status === 'PUBLISHED' && linked.length === 1) {
          button.disabled = true;
          button.title = 'Um conteúdo publicado precisa manter pelo menos um plano.';
        }
        row.append(label, button);
        list.append(row);
      });
    },
  });
  if (result.isConfirmed) {
    await studioSaved('contents');
    await studioLinks(id, resource);
  }
}

async function uploadStudioThumbnail(id) {
  if (!studioAllowed('contents')) return;
  const result = await studioForm('Enviar capa', studioField('file', 'JPEG ou PNG · até 5 MiB', '', 'type="file" accept="image/jpeg,image/png,.jpg,.jpeg,.png" required'), async values => {
    const file = values.file;
    const valid = (file.type === 'image/png' && /\.png$/i.test(file.name)) || (file.type === 'image/jpeg' && /\.jpe?g$/i.test(file.name));
    if (!valid || !file.size || file.size > 5 * 1024 * 1024) throw { data: { message: 'Selecione uma imagem JPEG ou PNG de até 5 MiB.' } };
    const body = new FormData();
    body.append('file', file);
    return Api.post(`/contents/${id}/thumbnail`, body);
  });
  if (result.isConfirmed) {
    releaseAdminObjectUrls();
    await studioSaved('contents');
    await showAdminContentDetails(id);
  }
}

function setupStudioForms() {
  const actions = {
    'create-content-button': () => editStudioContent(),
    'create-category-button': () => editStudioResource('categories'),
    'create-plan-button': () => editStudioResource('plans'),
    'create-subscription-button': createStudioSubscription,
  };
  Object.entries(actions).forEach(([id, action]) => {
    const button = document.getElementById(id);
    button.addEventListener('click', async () => {
      button.disabled = true;
      try { await action(); } catch (error) { await handleAdminError(error); }
      finally { button.disabled = false; }
    });
  });
}
