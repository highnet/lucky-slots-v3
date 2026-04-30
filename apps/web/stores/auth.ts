/**
 * @fileoverview stores/auth.ts
 *
 * Pinia store for authentication state.
 *
 * Holds the currently logged-in user and a derived `isAuthenticated` flag.
 * The `useAuth()` composable (see `composables/useAuth.ts`) is responsible
 * for performing the actual GraphQL mutations; this store only manages UI state.
 */

import { defineStore } from 'pinia';

/** Shape of a user returned by the GraphQL API. */
export interface User {
  id: string;
  username: string;
  balance: number;
  currentBet: number;
}

export const useAuthStore = defineStore('auth', {
  state: () => ({
    user: null as User | null,
    isAuthenticated: false,
  }),
  actions: {
    setUser(user: User | null) {
      this.user = user;
      this.isAuthenticated = !!user;
    },
    logout() {
      this.user = null;
      this.isAuthenticated = false;
    },
  },
});
