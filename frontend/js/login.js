const loginForm = document.getElementById('login-form');

const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');

const emailError = document.getElementById('email-error');
const passwordError = document.getElementById('password-error');

const loginButton = document.getElementById('login-button');
const passwordToggle = document.getElementById('password-toggle');

const demoUsers = document.querySelectorAll('.demo-user');

document.addEventListener('DOMContentLoaded', () => {
  Auth.redirectIfAuthenticated();

  setupPasswordToggle();
  setupDemoUsers();
});

loginForm.addEventListener('submit', async (event) => {
  event.preventDefault();

  clearErrors();

  const email = emailInput.value.trim();
  const password = passwordInput.value;

  if (!validateForm(email, password)) {
    return;
  }

  setLoading(true);

  try {
    const { user } = await Auth.login(email, password);

    await Swal.fire({
      icon: 'success',
      title: 'Login realizado',
      text: `Bem-vindo, ${Auth.getDisplayName(user)}!`,
      timer: 1300,
      showConfirmButton: false,
    });

    Auth.redirectAuthenticatedUser(user);
  } catch (error) {
    handleLoginError(error);
  } finally {
    setLoading(false);
  }
});

function validateForm(email, password) {
  let isValid = true;

  if (!email) {
    setFieldError(
      emailInput,
      emailError,
      'Informe seu e-mail.',
    );

    isValid = false;
  } else if (!isValidEmail(email)) {
    setFieldError(
      emailInput,
      emailError,
      'Informe um e-mail válido.',
    );

    isValid = false;
  }

  if (!password) {
    setFieldError(
      passwordInput,
      passwordError,
      'Informe sua senha.',
    );

    isValid = false;
  } else if (password.length < 8) {
    setFieldError(
      passwordInput,
      passwordError,
      'A senha deve possuir pelo menos 8 caracteres.',
    );

    isValid = false;
  }

  return isValid;
}

function setFieldError(input, errorElement, message) {
  const formField = input.closest('.form-field');

  if (formField) {
    formField.classList.add('has-error');
  }

  errorElement.textContent = message;
}

function clearErrors() {
  document
    .querySelectorAll('.form-field')
    .forEach((field) => {
      field.classList.remove('has-error');
    });

  emailError.textContent = '';
  passwordError.textContent = '';
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function setLoading(isLoading) {
  loginButton.disabled = isLoading;
  loginButton.classList.toggle('is-loading', isLoading);

  const buttonLabel =
    loginButton.querySelector('.button-label');

  const buttonIcon =
    loginButton.querySelector('.button-icon i');

  if (isLoading) {
    buttonLabel.textContent = 'Entrando...';

    buttonIcon.className =
      'fa-solid fa-spinner fa-spin';

    return;
  }

  buttonLabel.textContent = 'Entrar na plataforma';

  buttonIcon.className =
    'fa-solid fa-arrow-right';
}

function handleLoginError(error) {
  const status = error?.status;

  const apiMessage =
    Array.isArray(error?.data?.message)
      ? error.data.message.join(' ')
      : error?.data?.message;

  if (status === 401) {
    Swal.fire({
      icon: 'error',
      title: 'Não foi possível entrar',
      text:
        apiMessage ||
        'E-mail ou senha inválidos. Confira suas credenciais e tente novamente.',
      confirmButtonText: 'Tentar novamente',
    });

    return;
  }

  if (status === 400) {
    Swal.fire({
      icon: 'warning',
      title: 'Dados inválidos',
      text:
        apiMessage ||
        'Confira os dados informados antes de continuar.',
      confirmButtonText: 'Entendi',
    });

    return;
  }

  if (status === 403) {
    Swal.fire({
      icon: 'warning',
      title: 'Acesso indisponível',
      text:
        apiMessage ||
        'Seu usuário não possui acesso a este recurso.',
      confirmButtonText: 'Entendi',
    });

    return;
  }

  if (status === 0) {
    Swal.fire({
      icon: 'error',
      title: 'Servidor indisponível',
      text:
        apiMessage ||
        'Não foi possível conectar à API. Verifique se o backend está em execução.',
      confirmButtonText: 'Entendi',
    });

    return;
  }

  Swal.fire({
    icon: 'error',
    title: 'Algo deu errado',
    text:
      apiMessage ||
      'Não foi possível concluir o login neste momento.',
    confirmButtonText: 'Entendi',
  });
}

function setupPasswordToggle() {
  passwordToggle.addEventListener('click', () => {
    const isPasswordVisible =
      passwordInput.type === 'text';

    passwordInput.type =
      isPasswordVisible ? 'password' : 'text';

    const icon = passwordToggle.querySelector('i');

    icon.className = isPasswordVisible
      ? 'fa-regular fa-eye'
      : 'fa-regular fa-eye-slash';

    passwordToggle.setAttribute(
      'aria-label',
      isPasswordVisible
        ? 'Mostrar senha'
        : 'Ocultar senha',
    );

    passwordToggle.setAttribute(
      'title',
      isPasswordVisible
        ? 'Mostrar senha'
        : 'Ocultar senha',
    );
  });
}

function setupDemoUsers() {
  demoUsers.forEach((button) => {
    const label = button.querySelector('strong');
    label.textContent = `${Auth.getDisplayName({ email: button.dataset.email })} · ${label.textContent}`;
    button.addEventListener('click', () => {
      const email = button.dataset.email;
      const password = button.dataset.password;

      emailInput.value = email;
      passwordInput.value = password;

      clearErrors();

      emailInput.focus();

      Swal.fire({
        icon: 'info',
        title: 'Credenciais preenchidas',
        text:
          'Os dados da conta de demonstração foram inseridos. Clique em entrar para continuar.',
        timer: 1700,
        showConfirmButton: false,
      });
    });
  });
}