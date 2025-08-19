<!-- pages/index.vue -->
<script setup lang="ts">
import * as z from "zod";
import type { FormSubmitEvent } from "@nuxt/ui";

definePageMeta({
  ssr: false,
  layout: 'default'
});

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
    <div class="max-w-md mx-auto">
      <!-- Header -->
      <div class="text-center mb-8">
        <div class="flex justify-center mb-4">
          <UIcon
            name="i-lucide-building-2"
            class="text-emerald-500 w-16 h-16"
          />
        </div>
        <h1 class="text-3xl font-bold text-gray-800">Welcome to Dynalis</h1>
        <p class="text-gray-600 mt-2">Sign in to access your data analytics dashboard</p>
      </div>

      <!-- Login Card -->
      <UCard class="shadow-lg">
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
            <UButton variant="link" color="primary" size="xs">
              Forgot password?
            </UButton>
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
            <UButton variant="link" color="primary" size="xs">
              Contact admin
            </UButton>
          </div>
        </UForm>
      </UCard>

      <!-- Getting Started Tips -->
      <UCard class="mt-6 bg-blue-50 border-blue-200">
        <div class="text-sm text-blue-800">
          <p class="font-medium mb-2">💡 Getting Started</p>
          <ul class="space-y-1 text-xs text-blue-700">
            <li>• Download the sample template from the sidebar</li>
            <li>• Fill in your property data</li>
            <li>• Upload and analyze your data</li>
          </ul>
        </div>
      </UCard>
    </div>
  </ClientOnly>
</template>
