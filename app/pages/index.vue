<!-- pages/index.vue -->
<script setup lang="ts">
import { useAuth } from "~/composables/useAuth";

definePageMeta({
  layout: 'auth',
  ssr: false,
});

const router = useRouter();
const auth = useAuth();

// Redirect based on auth status
watch(auth.user, (user) => {
  if (user) {
    // User is authenticated, redirect to dashboard
    router.push("/dashboard");
  } else {
    // User is not authenticated, redirect to login
    router.push("/login");
  }
}, { immediate: true });
</script>

<template>
  <!-- Loading state while checking auth -->
  <div class="flex items-center justify-center min-h-screen">
    <div class="text-center">
      <UIcon name="i-lucide-loader-2" class="w-8 h-8 text-emerald-500 animate-spin mx-auto mb-4" />
      <p class="text-gray-600">Loading...</p>
    </div>
  </div>
</template>
