const Api = {
  async request(endpoint, options = {}) {
    const token = localStorage.getItem(APP_CONFIG.STORAGE_KEYS.TOKEN);

    const headers = {
      'x-api-key': APP_CONFIG.API_KEY,
      ...(options.body instanceof FormData
        ? {}
        : {
            'Content-Type': 'application/json',
          }),
      ...(token
        ? {
            Authorization: `Bearer ${token}`,
          }
        : {}),
      ...(options.headers || {}),
    };

    try {
      const response = await fetch(`${APP_CONFIG.API_URL}${endpoint}`, {
        ...options,
        headers,
      });

      const contentType = response.headers.get('content-type');

      let data = null;

      if (contentType?.includes('application/json')) {
        data = await response.json();
      } else if (response.status !== 204) {
        data = await response.text();
      }

      if (!response.ok) {
        throw {
          status: response.status,
          data,
        };
      }

      return data;
    } catch (error) {
      if (error?.status) {
        throw error;
      }

      throw {
        status: 0,
        data: {
          message:
            'Não foi possível conectar ao servidor. Verifique se a API está em execução.',
        },
      };
    }
  },

  get(endpoint, options = {}) {
    return this.request(endpoint, {
      method: 'GET',
      ...options,
    });
  },

  post(endpoint, body, options = {}) {
    return this.request(endpoint, {
      method: 'POST',
      body: body instanceof FormData ? body : JSON.stringify(body),
      ...options,
    });
  },

  put(endpoint, body, options = {}) {
    return this.request(endpoint, {
      method: 'PUT',
      body: body instanceof FormData ? body : JSON.stringify(body),
      ...options,
    });
  },

  patch(endpoint, body, options = {}) {
    return this.request(endpoint, {
      method: 'PATCH',
      body: body instanceof FormData ? body : JSON.stringify(body),
      ...options,
    });
  },

  delete(endpoint, options = {}) {
    return this.request(endpoint, {
      method: 'DELETE',
      ...options,
    });
  },

  async download(endpoint) {
    const token = localStorage.getItem(APP_CONFIG.STORAGE_KEYS.TOKEN);

    const response = await fetch(`${APP_CONFIG.API_URL}${endpoint}`, {
      method: 'GET',
      headers: {
        'x-api-key': APP_CONFIG.API_KEY,
        ...(token
          ? {
              Authorization: `Bearer ${token}`,
            }
          : {}),
      },
    });

    if (!response.ok) {
      let data = null;

      try {
        data = await response.json();
      } catch {
        data = null;
      }

      throw {
        status: response.status,
        data,
      };
    }

    return response.blob();
  },
};