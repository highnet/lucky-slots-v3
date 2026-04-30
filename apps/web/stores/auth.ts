import { defineStore } from 'pinia';

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
