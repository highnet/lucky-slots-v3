/**
 * @fileoverview composables/useAuth.ts
 *
 * Vue composable for authentication-related GraphQL operations.
 *
 * Wraps `register`, `login`, `logout`, and `me` queries and automatically
 * updates the Pinia auth store so the UI stays in sync.
 */

import { useAuthStore } from '~/stores/auth';
import type { User } from '~/stores/auth';

/** GraphQL endpoint shared across all composables. */
const API_URL = 'http://localhost:4000/graphql';

/**
 * Generic GraphQL POST helper with credentials included.
 *
 * @throws Error when the GraphQL response contains errors
 */
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

/**
 * Provides reactive auth helpers and syncs server state with the Pinia store.
 */
export function useAuth() {
  const authStore = useAuthStore();

  /** Fetch the current user from the server and update the store. */
  async function me() {
    const data = await graphqlRequest<{ me: User | null }>(`
      query { me { id username balance currentBet } }
    `);
    if (data.me) {
      authStore.setUser(data.me);
    }
    return data.me;
  }

  /** Register a new account and immediately log the user in. */
  async function register(username: string, password: string) {
    const data = await graphqlRequest<{ register: User }>(`
      mutation Register($username: String!, $password: String!) {
        register(username: $username, password: $password) {
          id username balance currentBet
        }
      }
    `, { username, password });
    authStore.setUser(data.register);
    return data.register;
  }

  /** Log in an existing user and update the store. */
  async function login(username: string, password: string) {
    const data = await graphqlRequest<{ login: User }>(`
      mutation Login($username: String!, $password: String!) {
        login(username: $username, password: $password) {
          id username balance currentBet
        }
      }
    `, { username, password });
    authStore.setUser(data.login);
    return data.login;
  }

  /** Log out the current user on the server and clear the store. */
  async function logout() {
    await graphqlRequest<{ logout: boolean }>(`mutation { logout }`);
    authStore.logout();
  }

  return { me, register, login, logout };
}
