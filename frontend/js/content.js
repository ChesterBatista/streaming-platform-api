
/* =========================================
   STREAMONE — DETALHES DO CONTEÚDO
========================================= */


const contentState = {
  user: null,
  content: null,
  history: null,
  rating: null,
  averageRating: null,
  thumbnailObjectUrl: null,
  saving: false,
};

/* =========================================
   ELEMENTOS DA PÁGINA
========================================= */

const contentElements = {
  loading: document.getElementById('content-loading'),
  error: document.getElementById('content-error'),
  errorMessage: document.getElementById('content-error-message'),

  hero: document.getElementById('content-hero'),
  details: document.getElementById('content-details'),

  profileAvatar: document.getElementById('content-profile-avatar'),
  profileName: document.getElementById('content-profile-name'),

  backdrop: document.getElementById('content-hero-backdrop'),
  poster: document.getElementById('content-poster-art'),

  type: document.getElementById('content-type'),
  year: document.getElementById('content-year'),
  title: document.getElementById('content-title'),
  synopsis: document.getElementById('content-synopsis'),
  duration: document.getElementById('content-duration'),
  averageRating: document.getElementById('content-average-rating'),

  infoType: document.getElementById('info-type'),
  infoYear: document.getElementById('info-year'),
  infoDuration: document.getElementById('info-duration'),

  progressPercentage: document.getElementById('progress-percentage'),
  progressStatus: document.getElementById('progress-status'),
  progressTrack: document.getElementById('content-progress-track'),
  progressFill: document.getElementById('content-progress-fill'),
  progressWatched: document.getElementById('progress-watched'),
  progressTotal: document.getElementById('progress-total'),

  personalStars: document.getElementById('personal-rating-stars'),
  personalRatingMessage: document.getElementById('personal-rating-message'),
  personalRatingComment: document.getElementById('personal-rating-comment'),

  watchButton: document.getElementById('watch-button'),
  updateProgressButton: document.getElementById('update-progress-button'),

  rateButton: document.getElementById('rate-button'),
  updateRatingButton: document.getElementById('update-rating-button'),
};

/* =========================================
   INICIALIZAÇÃO
========================================= */

document.addEventListener('DOMContentLoaded', initializeContentPage);

window.addEventListener('pagehide', releaseContentThumbnail);

async function initializeContentPage() {
  const params = new URLSearchParams(window.location.search);
  const contentId = params.get('id');

  if (!contentId || !/^[1-9]\d*$/.test(contentId)) {
    showContentError(
      'O endereço não contém um identificador de conteúdo válido.',
    );

    return;
  }

  try {
    const user = await Auth.requireAuth(['SUBSCRIBER']);

    if (!user) {
      return;
    }

    contentState.user = user;

    renderContentProfile(user);
    setupContentEvents();

    await loadContent(Number(contentId));
  } catch (error) {
    handleContentError(error);
  }
}

/* =========================================
   PERFIL
========================================= */

function renderContentProfile(user) {
  contentElements.profileAvatar.textContent =
    Auth.getInitials(Auth.getDisplayName(user));

  contentElements.profileName.textContent =
    Auth.getDisplayName(user) || 'Assinante';
}

/* =========================================
   CARREGAMENTO DO CONTEÚDO
========================================= */

async function loadContent(contentId) {
  showContentLoading();

  try {
    const content = await Api.get(`/contents/${contentId}`);

    contentState.content = content;

    renderContentInformation(content);

    await loadContentThumbnail(content);

    contentElements.loading.classList.add('hidden');
    contentElements.hero.classList.remove('hidden');
    contentElements.details.classList.remove('hidden');

    await Promise.all([
      loadPersonalProgress(),
      loadPersonalRating(),
      loadAverageRating(),
    ]);
  } catch (error) {
    handleContentError(error);
  }
}

function showContentLoading() {
  contentElements.loading.classList.remove('hidden');

  contentElements.error.classList.add('hidden');
  contentElements.hero.classList.add('hidden');
  contentElements.details.classList.add('hidden');
}

function showContentError(message) {
  contentElements.loading.classList.add('hidden');

  contentElements.hero.classList.add('hidden');
  contentElements.details.classList.add('hidden');

  contentElements.errorMessage.textContent = message;
  contentElements.error.classList.remove('hidden');
}

/* =========================================
   INFORMAÇÕES DO CONTEÚDO
========================================= */

function renderContentInformation(content) {
  const typeLabel = getContentTypeLabel(content.type);
  const year = content.releaseYear ?? '—';
  const duration = formatContentDuration(content.durationMinutes);

  document.title = `${Presentation.contentTitle(content.title)} | StreamOne`;

  contentElements.type.textContent = typeLabel;
  contentElements.year.textContent = String(year);
  contentElements.title.textContent = Presentation.contentTitle(content.title);

  contentElements.synopsis.textContent =
    content.synopsis ||
    'Sinopse não disponível para este conteúdo.';

  contentElements.duration.innerHTML =
    '<i class="fa-regular fa-clock"></i>';

  contentElements.duration.append(
    document.createTextNode(` ${duration}`),
  );

  contentElements.infoType.textContent = typeLabel;
  contentElements.infoYear.textContent = String(year);
  contentElements.infoDuration.textContent = duration;

  contentElements.progressTotal.textContent =
    `Duração total: ${duration}`;
}

/* =========================================
   CAPAS DOS CONTEÚDOS
========================================= */

async function loadContentThumbnail(content) {
  releaseContentThumbnail();

  let imageUrl =
    await Presentation.localCover(content);

  if (content.thumbnailUrl) {
    try {
      const blob = await Api.download(content.thumbnailUrl);

      contentState.thumbnailObjectUrl =
        URL.createObjectURL(blob);

      imageUrl = contentState.thumbnailObjectUrl;
    } catch {
      console.warn('Não foi possível carregar a thumbnail protegida; usando a capa alternativa.');
    }
  }

  if (!imageUrl) {
    contentElements.poster.style.backgroundImage = '';
    contentElements.backdrop.style.backgroundImage = '';

    return;
  }

  // Pôster vertical: preserva a imagem inteira.
  contentElements.poster.style.backgroundImage =
    `url("${imageUrl}")`;

  // Banner: utiliza a mesma imagem como atmosfera de fundo.
  contentElements.backdrop.style.backgroundImage =
    `url("${imageUrl}")`;
}

function releaseContentThumbnail() {
  if (contentState.thumbnailObjectUrl) {
    URL.revokeObjectURL(contentState.thumbnailObjectUrl);

    contentState.thumbnailObjectUrl = null;
  }
}

/* =========================================
   PROGRESSO PESSOAL
========================================= */

async function loadPersonalProgress() {
  const content = contentState.content;

  try {
    const history = await Api.get(
      `/watch-history/me/${content.id}`,
    );

    contentState.history = history;
  } catch (error) {
    if (error?.status === 404) {
      contentState.history = null;
    } else {
      throw error;
    }
  }

  renderPersonalProgress();
}

function renderPersonalProgress() {
  const content = contentState.content;
  const history = contentState.history;

  const totalSeconds =
    Number(content.durationMinutes || 0) * 60;

  const watchedSeconds =
    Number(history?.progressSeconds || 0);

  const completed = history?.completed === true;

  const percentage =
    totalSeconds > 0
      ? Math.min(
          100,
          Math.max(
            0,
            Math.round(
              (watchedSeconds / totalSeconds) * 100,
            ),
          ),
        )
      : completed
        ? 100
        : 0;

  contentElements.progressPercentage.textContent =
    `${percentage}%`;

  contentElements.progressFill.style.width =
    `${percentage}%`;

  contentElements.progressTrack.setAttribute(
    'aria-valuenow',
    String(percentage),
  );

  if (!history) {
    contentElements.progressStatus.textContent =
      'Você ainda não iniciou este conteúdo.';
  } else if (completed) {
    contentElements.progressStatus.textContent =
      'Conteúdo marcado como concluído.';
  } else {
    contentElements.progressStatus.textContent =
      'Seu progresso está salvo na plataforma.';
  }

  contentElements.progressWatched.textContent =
    `${formatWatchedTime(watchedSeconds)} registrados`;

  contentElements.updateProgressButton.innerHTML = history
    ? '<i class="fa-solid fa-pen-to-square"></i> Atualizar meu progresso'
    : '<i class="fa-solid fa-circle-play"></i> Registrar meu progresso';
}

function formatWatchedTime(seconds) {
  const safeSeconds = Math.max(0, Number(seconds) || 0);

  const minutes = Math.floor(safeSeconds / 60);
  const remainingSeconds = safeSeconds % 60;

  return `${minutes}min ${remainingSeconds}s`;
}

/* =========================================
   AVALIAÇÃO PESSOAL
========================================= */

async function loadPersonalRating() {
  const content = contentState.content;

  try {
    const rating = await Api.get(
      `/ratings/me/${content.id}`,
    );

    contentState.rating = rating;
  } catch (error) {
    if (error?.status === 404) {
      contentState.rating = null;
    } else {
      throw error;
    }
  }

  renderPersonalRating();
}

function renderPersonalRating() {
  const rating = contentState.rating;

  const score = Number(rating?.score || 0);

  contentElements.personalStars.replaceChildren();

  for (let star = 1; star <= 5; star += 1) {
    const icon = document.createElement('i');

    icon.className =
      star <= score
        ? 'fa-solid fa-star'
        : 'fa-regular fa-star';

    contentElements.personalStars.appendChild(icon);
  }

  contentElements.personalStars.setAttribute(
    'aria-label',
    rating
      ? `Sua avaliação: ${score} de 5 estrelas`
      : 'Nenhuma avaliação registrada',
  );

  if (!rating) {
    contentElements.personalRatingMessage.textContent =
      'Você ainda não avaliou este conteúdo.';

    contentElements.personalRatingComment.textContent = '';
    contentElements.personalRatingComment.classList.add('hidden');

    contentElements.updateRatingButton.innerHTML =
      '<i class="fa-solid fa-star"></i> Registrar minha avaliação';

    return;
  }

  contentElements.personalRatingMessage.textContent =
    `Você avaliou este conteúdo com ${score} de 5 estrelas.`;

  if (rating.comment) {
    contentElements.personalRatingComment.textContent =
      rating.comment;

    contentElements.personalRatingComment.classList.remove(
      'hidden',
    );
  } else {
    contentElements.personalRatingComment.textContent = '';

    contentElements.personalRatingComment.classList.add(
      'hidden',
    );
  }

  contentElements.updateRatingButton.innerHTML =
    '<i class="fa-solid fa-pen-to-square"></i> Editar minha avaliação';
}

/* =========================================
   MÉDIA DE AVALIAÇÕES
========================================= */

async function loadAverageRating() {
  const content = contentState.content;

  try {
    const result = await Api.get(
      `/ratings/content/${content.id}`,
    );

    contentState.averageRating = result;

    renderAverageRating();
  } catch (error) {
    if (error?.status === 401) {
      throw error;
    }

    contentElements.averageRating.innerHTML =
      '<i class="fa-regular fa-star"></i> Avaliação indisponível';
  }
}

function renderAverageRating() {
  const rating = contentState.averageRating;

  if (!rating || rating.count === 0 || rating.average === null) {
    contentElements.averageRating.innerHTML =
      '<i class="fa-regular fa-star"></i> Ainda sem avaliações';

    return;
  }

  const average = Number(rating.average).toFixed(1);

  const count = Number(rating.count);

  contentElements.averageRating.innerHTML =
    '<i class="fa-solid fa-star"></i>';

  contentElements.averageRating.append(
    document.createTextNode(
      ` ${average} de 5 · ${count} ${
        count === 1 ? 'avaliação' : 'avaliações'
      }`,
    ),
  );
}

/* =========================================
   EVENTOS
========================================= */

function setupContentEvents() {
  contentElements.watchButton.addEventListener(
    'click',
    openProgressDialog,
  );

  contentElements.updateProgressButton.addEventListener(
    'click',
    openProgressDialog,
  );

  contentElements.rateButton.addEventListener(
    'click',
    openRatingDialog,
  );

  contentElements.updateRatingButton.addEventListener(
    'click',
    openRatingDialog,
  );
}

/* =========================================
   SWEETALERT — REGISTRAR PROGRESSO
========================================= */

async function openProgressDialog() {
  if (contentState.saving || !contentState.content) {
    return;
  }

  const content = contentState.content;

  const durationMinutes =
    content.durationMinutes == null ? null : Number(content.durationMinutes);
  const maxMinutes = Math.min(durationMinutes ?? Infinity, Math.floor(2147483647 / 60));

  const currentSeconds =
    Number(contentState.history?.progressSeconds || 0);

  const currentMinutes =
    Math.floor(currentSeconds / 60);

  const result = await Swal.fire({
    title: 'Meu progresso',

    text:
      `Registre quantos minutos você assistiu de "${Presentation.contentTitle(content.title)}".`,

    html: `
      <div style="text-align: left; margin-top: 18px;">
        <label
          for="swal-progress-minutes"
          style="display: block; margin-bottom: 8px;"
        >
          Minutos assistidos
        </label>

        <input
          id="swal-progress-minutes"
          class="swal2-input"
          type="number"
          min="0"
          max="${maxMinutes}"
          step="1"
          value="${currentMinutes}"
          style="width: 100%; margin: 0;"
        />

        <p
          style="font-size: 0.78rem; margin: 12px 0 18px;"
        >
          ${durationMinutes === null ? 'Duração não informada.' : `Duração total: ${durationMinutes} minutos.`}
        </p>

        <label
          for="swal-progress-completed"
          style="display: flex; align-items: center; gap: 10px;"
        >
          <input
            id="swal-progress-completed"
            type="checkbox"
            ${
              contentState.history?.completed
                ? 'checked'
                : ''
            }
            style="width: auto; flex-shrink: 0;"
          />

          Marcar conteúdo como concluído
        </label>
      </div>
    `,

    showCancelButton: true,
    confirmButtonText: 'Salvar progresso',
    cancelButtonText: 'Cancelar',
    reverseButtons: true,
    showLoaderOnConfirm: true,

    preConfirm: () => {
      const minutesInput =
        document.getElementById('swal-progress-minutes');

      const completedInput =
        document.getElementById('swal-progress-completed');

      const rawMinutes = minutesInput.value.trim();
      const minutes = Number(rawMinutes);

      if (
        rawMinutes === '' ||
        !Number.isInteger(minutes) ||
        minutes < 0 ||
        minutes > maxMinutes
      ) {
        Swal.showValidationMessage(
          durationMinutes === null
            ? 'Informe um número inteiro de minutos válido.'
            : `Informe um número inteiro entre 0 e ${maxMinutes} minutos.`,
        );

        return false;
      }

      return {
        progressSeconds: minutes * 60,
        completed: completedInput.checked,
      };
    },
  });

  if (!result.isConfirmed) {
    return;
  }

  contentState.saving = true;
  setContentActionButtonsDisabled(true);

  try {
    const history = await Api.put(
      `/watch-history/${content.id}`,
      result.value,
    );

    contentState.history = history;

    // Atualiza a barra imediatamente, sem recarregar a página.
    renderPersonalProgress();

    await Swal.fire({
      icon: 'success',
      title: 'Progresso salvo!',
      text: 'Seu histórico foi atualizado na plataforma.',
      timer: 1600,
      showConfirmButton: false,
    });
  } catch (error) {
    handleContentError(error, true);
  } finally {
    contentState.saving = false;
    setContentActionButtonsDisabled(false);
  }
}

/* =========================================
   SWEETALERT — AVALIAR CONTEÚDO
========================================= */

async function openRatingDialog() {
  if (contentState.saving || !contentState.content) {
    return;
  }

  const content = contentState.content;

  const currentScore = contentState.rating?.score ?? 4;
  const currentComment = contentState.rating?.comment ?? '';

  const result = await Swal.fire({
    title: 'Avaliar conteúdo',

    text: `Como você avalia "${Presentation.contentTitle(content.title)}"?`,

    html: `
      <div style="text-align: left; margin-top: 18px;">
        <label
          for="swal-rating-score"
          style="display: block; margin-bottom: 8px;"
        >
          Sua nota
        </label>

        <select
          id="swal-rating-score"
          class="swal2-select"
          style="width: 100%; margin: 0;"
        >
          <option value="1">1 estrela</option>
          <option value="2">2 estrelas</option>
          <option value="3">3 estrelas</option>
          <option value="4">4 estrelas</option>
          <option value="5">5 estrelas</option>
        </select>

        <label
          for="swal-rating-comment"
          style="display: block; margin: 20px 0 8px;"
        >
          Comentário (opcional)
        </label>

        <textarea
          id="swal-rating-comment"
          class="swal2-textarea"
          maxlength="1000"
          placeholder="Conte o que achou deste conteúdo..."
          style="width: 100%; margin: 0; resize: vertical;"
        ></textarea>

        <p
          style="font-size: 0.75rem; margin-top: 8px;"
        >
          Até 1000 caracteres.
        </p>
      </div>
    `,

    didOpen: () => {
      document.getElementById('swal-rating-score').value =
        String(currentScore);

      document.getElementById('swal-rating-comment').value =
        currentComment;
    },

    showCancelButton: true,
    confirmButtonText: 'Salvar avaliação',
    cancelButtonText: 'Cancelar',
    reverseButtons: true,

    preConfirm: () => {
      const score = Number(
        document.getElementById('swal-rating-score').value,
      );

      const comment =
        document.getElementById('swal-rating-comment').value.trim();

      if (!Number.isInteger(score) || score < 1 || score > 5) {
        Swal.showValidationMessage(
          'Selecione uma nota entre 1 e 5.',
        );

        return false;
      }

      if (comment.length > 1000) {
        Swal.showValidationMessage(
          'O comentário deve ter no máximo 1000 caracteres.',
        );

        return false;
      }

      return {
        score,
        comment: comment || null,
      };
    },
  });

  if (!result.isConfirmed) {
    return;
  }

  contentState.saving = true;
  setContentActionButtonsDisabled(true);

  try {
    const rating = await Api.put(
      `/ratings/${content.id}`,
      result.value,
    );

    contentState.rating = rating;

    renderPersonalRating();

    // A nova nota também pode alterar a média do conteúdo.
    await loadAverageRating();

    await Swal.fire({
      icon: 'success',
      title: 'Avaliação salva!',
      text: 'Sua opinião foi registrada com sucesso.',
      timer: 1600,
      showConfirmButton: false,
    });
  } catch (error) {
    handleContentError(error, true);
  } finally {
    contentState.saving = false;
    setContentActionButtonsDisabled(false);
  }
}

function setContentActionButtonsDisabled(disabled) {
  contentElements.watchButton.disabled = disabled;
  contentElements.updateProgressButton.disabled = disabled;

  contentElements.rateButton.disabled = disabled;
  contentElements.updateRatingButton.disabled = disabled;
}

/* =========================================
   FUNÇÕES AUXILIARES
========================================= */

function getContentTypeLabel(type) {
  const labels = {
    MOVIE: 'Filme',
    SERIES: 'Série',
    DOCUMENTARY: 'Documentário',
    OTHER: 'Outro',
  };

  return labels[type] ?? 'Conteúdo';
}

function formatContentDuration(minutes) {
  const totalMinutes = Number(minutes);

  if (!Number.isFinite(totalMinutes) || totalMinutes <= 0) {
    return 'Duração não informada';
  }

  if (totalMinutes < 60) {
    return `${totalMinutes} min`;
  }

  const hours = Math.floor(totalMinutes / 60);
  const remainingMinutes = totalMinutes % 60;

  return remainingMinutes === 0
    ? `${hours}h`
    : `${hours}h ${remainingMinutes}min`;
}

/* =========================================
   TRATAMENTO DE ERROS
========================================= */

function handleContentError(error, keepPage = false) {
  const apiMessage = Array.isArray(error?.data?.message)
    ? error.data.message.join(' ')
    : error?.data?.message;

  if (error?.status === 401) {
    Auth.clearSession();

    Swal.fire({
      icon: 'warning',
      title: 'Sessão expirada',
      text: 'Entre novamente para continuar.',
      confirmButtonText: 'Ir para o login',
      allowOutsideClick: false,
    }).then(() => {
      window.location.href = APP_CONFIG.ROUTES.LOGIN;
    });

    return;
  }

  let message =
    apiMessage ||
    'Não foi possível concluir a operação. Tente novamente.';

  if (error?.status === 403) {
    message =
      apiMessage ||
      'Sua assinatura não permite acessar este conteúdo.';
  } else if (error?.status === 404) {
    message =
      apiMessage ||
      'Este conteúdo não foi encontrado ou não está disponível.';
  } else if (error?.status === 0) {
    message =
      'Não foi possível conectar à API. Verifique se o backend está em execução.';
  }

  if (!keepPage) {
    showContentError(message);
  }

  Swal.fire({
    icon: error?.status === 403 ? 'warning' : 'error',
    title: 'Não foi possível continuar',
    text: message,
    confirmButtonText: 'Entendi',
  });
}
