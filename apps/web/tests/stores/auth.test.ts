import { describe, it, expect, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useAuthStore } from '../../stores/auth';

describe('auth store', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('has default state', () => {
    const store = useAuthStore();
    expect(store.user).toBeNull();
    expect(store.isAuthenticated).toBe(false);
  });

  it('setUser updates user and isAuthenticated', () => {
    const store = useAuthStore();
    const user = { id: '1', username: 'test', balance: 100, currentBet: 0.1 };
    store.setUser(user);
    expect(store.user).toEqual(user);
    expect(store.isAuthenticated).toBe(true);
  });

  it('setUser with null clears user and isAuthenticated', () => {
    const store = useAuthStore();
    store.setUser({ id: '1', username: 'test', balance: 100, currentBet: 0.1 });
    store.setUser(null);
    expect(store.user).toBeNull();
    expect(store.isAuthenticated).toBe(false);
  });

  it('logout clears user and isAuthenticated', () => {
    const store = useAuthStore();
    store.setUser({ id: '1', username: 'test', balance: 100, currentBet: 0.1 });
    store.logout();
    expect(store.user).toBeNull();
    expect(store.isAuthenticated).toBe(false);
  });
});
