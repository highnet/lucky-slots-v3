<!-- Authentication page: toggles between login and registration forms. -->
<template>
  <div class="min-h-screen flex items-center justify-center bg-slate-900 text-white">
    <div class="w-full max-w-md p-8 bg-slate-800 rounded-2xl shadow-2xl">
      <h1 class="text-3xl font-bold mb-6 text-center">
        {{ isLogin ? 'Login' : 'Register' }}
      </h1>
      <form @submit.prevent="handleSubmit" class="space-y-4">
        <div>
          <label class="block text-sm font-medium mb-1">Username</label>
          <input
            v-model="username"
            type="text"
            class="w-full px-4 py-2 rounded-lg bg-slate-700 border border-slate-600 focus:border-blue-500 focus:outline-none"
            required
          />
        </div>
        <div>
          <label class="block text-sm font-medium mb-1">Password</label>
          <input
            v-model="password"
            type="password"
            class="w-full px-4 py-2 rounded-lg bg-slate-700 border border-slate-600 focus:border-blue-500 focus:outline-none"
            required
          />
        </div>
        <button
          type="submit"
          class="w-full py-2 px-4 bg-blue-600 hover:bg-blue-700 rounded-lg font-semibold transition-colors"
        >
          {{ isLogin ? 'Login' : 'Register' }}
        </button>
      </form>
      <p class="mt-4 text-center text-sm text-slate-400">
        {{ isLogin ? "Don't have an account?" : 'Already have an account?' }}
        <button
          @click="isLogin = !isLogin"
          class="text-blue-400 hover:text-blue-300 ml-1"
        >
          {{ isLogin ? 'Register' : 'Login' }}
        </button>
      </p>
      <p v-if="error" class="mt-4 text-center text-red-400 text-sm">{{ error }}</p>
    </div>
  </div>
</template>

<script setup lang="ts">
const { register, login } = useAuth();
const router = useRouter();

const isLogin = ref(true);
const username = ref('');
const password = ref('');
const error = ref('');

async function handleSubmit() {
  error.value = '';
  try {
    if (isLogin.value) {
      await login(username.value, password.value);
    } else {
      await register(username.value, password.value);
    }
    await navigateTo('/');
  } catch (e: any) {
    error.value = e.message || 'An error occurred';
  }
}
</script>
