import { useAuthStore } from '~/stores/auth';

const API_URL = 'http://localhost:4000/graphql';

async function graphqlRequest<T>(query: string, variables?: Record<string, unknown>): Promise<T> {
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ query, variables }),
  });
  const json = await res.json();
  if (json.errors) {
    throw new Error(json.errors[0].message);
  }
  return json.data as T;
}

export function useAuth() {
  const authStore = useAuthStore();

  async function me() {
    const data = await graphqlRequest<{ me: unknown }>(`
      query { me { id username balance currentBet } }
    `);
    if (data.me) {
      authStore.setUser(data.me);
    }
    return data.me;
  }

  async function register(username: string, password: string) {
    const data = await graphqlRequest<{ register: unknown }>(`
      mutation Register($username: String!, $password: String!) {
        register(username: $username, password: $password) {
          id username balance currentBet
        }
      }
    `, { username, password });
    authStore.setUser(data.register);
    return data.register;
  }

  async function login(username: string, password: string) {
    const data = await graphqlRequest<{ login: unknown }>(`
      mutation Login($username: String!, $password: String!) {
        login(username: $username, password: $password) {
          id username balance currentBet
        }
      }
    `, { username, password });
    authStore.setUser(data.login);
    return data.login;
  }

  async function logout() {
    await graphqlRequest<{ logout: boolean }>(`mutation { logout }`);
    authStore.logout();
  }

  return { me, register, login, logout };
}
