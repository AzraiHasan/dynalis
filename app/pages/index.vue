<!-- pages/index.vue -->
<script setup lang="ts">
definePageMeta({
  ssr: false,
});

import * as z from "zod";
import type { FormSubmitEvent } from "@nuxt/ui";

const router = useRouter();
const { fetch: fetchUserSession } = useUserSession();

const schema = z.object({
  email: z.string().email("Invalid email"),
  password: z.string().min(8, "Must be at least 8 characters"),
});

type Schema = z.output<typeof schema>;

const state = reactive<Partial<Schema>>({
  email: "",
  password: "",
});

const toast = useToast();
const isLoading = ref(false);

if (typeof window !== 'undefined') {
  localStorage.removeItem("uploadedFileData");
}

async function onSubmit(event: FormSubmitEvent<Schema>) {
  isLoading.value = true;

  try {
    // Call our new authentication endpoint
    const response = await $fetch('/api/auth/login', {
      method: 'POST',
      body: event.data
    });

    // Fetch the user session after successful login
    await fetchUserSession();

    toast.add({
      title: "Success",
      description: "You have been logged in successfully.",
      color: "success",
    });

    // Add a small delay to show the toast before redirecting
    setTimeout(() => {
      router.push("/dataupload");
    }, 500);
  } catch (error: any) {
    toast.add({
      title: "Error",
      description: error.message || "Login failed. Please check your credentials.",
      color: "error",
    });
  } finally {
    isLoading.value = false;
  }
}
</script>

<template>
  <ClientOnly>
    <div class="flex items-center justify-center min-h-screen bg-gray-50">
      <UCard class="w-full max-w-md shadow-lg">
        <!-- Header -->
        <div class="text-center mb-6">
          <div class="flex justify-center mb-4">
            <UIcon
              name="i-lucide-building-2"
              class="text-emerald-500 w-16 h-16"
            />
          </div>
          <h1 class="text-2xl font-bold text-gray-800">Dynalis Intepreter</h1>
          <p class="text-gray-600 mt-2">Your Data Analytics Asssistant</p>
        </div>

        <!-- Form -->
        <UForm
          :schema="schema"
          :state="state"
          class="space-y-4"
          @submit="onSubmit"
        >
          <UFormField label="Email" name="email">
            <UInput
              v-model="state.email"
              icon="i-lucide-mail"
              placeholder="you@example.com"
              autocomplete="email"
              class="w-full"
            />
          </UFormField>

          <UFormField label="Password" name="password">
            <UInput
              v-model="state.password"
              type="password"
              icon="i-lucide-lock"
              placeholder="••••••••"
              autocomplete="current-password"
              class="w-full"
            />
          </UFormField>

          <div class="flex items-center justify-between mt-2">
            <UCheckbox label="Remember me" name="remember" />
            <UButton variant="link" color="primary" size="xs"
              >Forgot password?</UButton
            >
          </div>

          <UButton
            type="submit"
            color="primary"
            block
            :loading="isLoading"
            class="mt-6"
          >
            Sign in
          </UButton>

          <div class="text-center mt-4 text-sm text-gray-600">
            Don't have an account?
            <UButton variant="link" color="primary" size="xs"
              >Contact admin</UButton
            >
          </div>
        </UForm>
      </UCard>
    </div>
  </ClientOnly>
</template>
