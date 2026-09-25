const Auth = {
  getDisplayName(user) {
    const names = {
      'subscriber.demo@streaming.local': 'Pedro',
      'manager.demo@streaming.local': 'Aline',
      'admin.demo@streaming.local': 'Chester',
    };
    return names[user?.email?.trim().toLowerCase()] || user?.name || 'Usuário';
  },

  getToken() {
    return localStorage.getItem(APP_CONFIG.STORAGE_KEYS.TOKEN);
  },

  getUser() {
    const rawUser = localStorage.getItem(APP_CONFIG.STORAGE_KEYS.USER);

    if (!rawUser) {
      return null;
    }

    try {
      return JSON.parse(rawUser);
    } catch {
      this.clearSession();
      return null;
    }
  },

  saveSession(token, user) {
    localStorage.setItem(APP_CONFIG.STORAGE_KEYS.TOKEN, token);
    localStorage.setItem(
      APP_CONFIG.STORAGE_KEYS.USER,
      JSON.stringify(user),
    );
  },

  clearSession() {
    localStorage.removeItem(APP_CONFIG.STORAGE_KEYS.TOKEN);
    localStorage.removeItem(APP_CONFIG.STORAGE_KEYS.USER);
  },

  isAuthenticated() {
    return Boolean(this.getToken());
  },

  async fetchCurrentUser() {
    const user = await Api.get('/users/me');

    localStorage.setItem(
      APP_CONFIG.STORAGE_KEYS.USER,
      JSON.stringify(user),
    );

    return user;
  },

  async login(email, password) {
    const response = await Api.post('/auth/login', {
      email,
      password,
    });

    const token = response?.accessToken;

    if (!token) {
      throw {
        status: 500,
        data: {
          message: 'A API não retornou um token de autenticação válido.',
        },
      };
    }

    localStorage.setItem(APP_CONFIG.STORAGE_KEYS.TOKEN, token);

    try {
      const user = await this.fetchCurrentUser();

      return {
        token,
        user,
      };
    } catch (error) {
      this.clearSession();
      throw error;
    }
  },

  logout() {
    this.clearSession();

    window.location.href = APP_CONFIG.ROUTES.LOGIN;
  },

  redirectAuthenticatedUser(user = this.getUser()) {
    if (!user) {
      window.location.href = APP_CONFIG.ROUTES.LOGIN;
      return;
    }

    switch (user.role) {
      case 'ADMIN':
      case 'CONTENT_MANAGER':
        window.location.href = APP_CONFIG.ROUTES.ADMIN;
        break;

      case 'SUBSCRIBER':
        window.location.href = APP_CONFIG.ROUTES.HOME;
        break;

      default:
        this.clearSession();
        window.location.href = APP_CONFIG.ROUTES.LOGIN;
    }
  },

  async requireAuth(allowedRoles = []) {
    if (!this.isAuthenticated()) {
      window.location.href = APP_CONFIG.ROUTES.LOGIN;
      return null;
    }

    let user = this.getUser();

    try {
      user = await this.fetchCurrentUser();
    } catch (error) {
      if (error?.status === 401 || error?.status === 403) {
        this.clearSession();
        await Swal.fire({
          icon: 'warning',
          titleText: error.status === 401 ? 'Sessão expirada' : 'Acesso restrito',
          text: (Array.isArray(error?.data?.message)
            ? error.data.message.join(' ')
            : error?.data?.message) || 'Entre novamente para continuar.',
          confirmButtonText: 'Ir para o login',
          allowOutsideClick: false,
        });
        window.location.href = APP_CONFIG.ROUTES.LOGIN;
        return null;
      }

      throw error;
    }

    if (
      allowedRoles.length > 0 &&
      !allowedRoles.includes(user.role)
    ) {
      await Swal.fire({
        icon: 'warning',
        titleText: 'Acesso restrito',
        text: 'Seu perfil não possui acesso a esta página.',
        confirmButtonText: 'Continuar',
      });
      this.redirectAuthenticatedUser(user);
      return null;
    }

    return user;
  },

  redirectIfAuthenticated() {
    if (!this.isAuthenticated()) {
      return;
    }

    const user = this.getUser();

    if (user) {
      this.redirectAuthenticatedUser(user);
    }
  },

  getInitials(name = '') {
    const parts = name
      .trim()
      .split(/\s+/)
      .filter(Boolean);

    if (parts.length === 0) {
      return 'U';
    }

    if (parts.length === 1) {
      return parts[0].slice(0, 2).toUpperCase();
    }

    return `${parts[0][0]}${parts.at(-1)[0]}`.toUpperCase();
  },

  getRoleLabel(role) {
    const labels = {
      SUBSCRIBER: 'Assinante',
      CONTENT_MANAGER: 'Gestor de Conteúdo',
      ADMIN: 'Administrador',
    };

    return labels[role] ?? role;
  },
};
