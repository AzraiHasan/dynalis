<!-- pages/signup.vue -->
<script setup lang="ts">
definePageMeta({
  layout: 'auth',
  ssr: false,
});

import * as z from "zod";
import type { FormSubmitEvent } from "@nuxt/ui";
import { useAuth } from "~/composables/useAuth";

const router = useRouter();

const signUpSchema = z.object({
  email: z.string().email("Invalid email"),
  password: z.string().min(8, "Must be at least 8 characters"),
  confirmPassword: z.string().min(8, "Must be at least 8 characters"),
  firstName: z.string().min(2, "First name must be at least 2 characters"),
  lastName: z.string().min(2, "Last name must be at least 2 characters"),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

type SignUpSchema = z.output<typeof signUpSchema>;

const state = reactive<Partial<SignUpSchema>>({
  email: "",
  password: "",
  confirmPassword: "",
  firstName: "",
  lastName: "",
});

const toast = useToast();
const isLoading = ref(false);
const auth = useAuth();

// Redirect if already authenticated
watch(auth.user, (user) => {
  if (user) {
    router.push("/dashboard");
  }
}, { immediate: true });

async function onSubmit(event: FormSubmitEvent<SignUpSchema>) {
  isLoading.value = true;

  try {
    await new Promise((r) => setTimeout(r, 800));
    await handleSignUp(event.data);
  } finally {
    isLoading.value = false;
  }
}

async function handleSignUp(data: SignUpSchema) {
  try {
    const result = await auth.signUp(data.email, data.password, data.firstName!, data.lastName!);
    
    toast.add({
      title: "Success",
      description: "Account created successfully! Please check your email to verify your account.",
      color: "success",
    });

    // Redirect to login after successful registration
    setTimeout(() => {
      router.push("/login");
    }, 2000);
  } catch (error: any) {
    console.error("Sign up error:", error);
    toast.add({
      title: "Sign Up Failed",
      description: error.message || "Failed to create account",
      color: "error",
    });
  }
}
</script>

<template>
  <ClientOnly>
    <div class="flex items-center justify-center min-h-screen">
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
          <p class="text-sm text-gray-500 mt-1">Create your account</p>
        </div>

        <!-- Form -->
        <UForm
          :schema="signUpSchema"
          :state="state"
          class="space-y-4"
          @submit="onSubmit"
        >
          <div class="grid grid-cols-2 gap-3">
            <UFormField label="First Name" name="firstName">
              <UInput
                v-model="state.firstName"
                icon="i-lucide-user"
                placeholder="First name"
                autocomplete="given-name"
                class="w-full"
              />
            </UFormField>

            <UFormField label="Last Name" name="lastName">
              <UInput
                v-model="state.lastName"
                icon="i-lucide-user"
                placeholder="Last name"
                autocomplete="family-name"
                class="w-full"
              />
            </UFormField>
          </div>

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
              autocomplete="new-password"
              class="w-full"
            />
          </UFormField>

          <UFormField label="Confirm Password" name="confirmPassword">
            <UInput
              v-model="state.confirmPassword"
              type="password"
              icon="i-lucide-lock"
              placeholder="••••••••"
              autocomplete="new-password"
              class="w-full"
            />
          </UFormField>

          <UButton
            type="submit"
            color="primary"
            block
            :loading="isLoading"
            class="mt-6"
          >
            Create Account
          </UButton>

          <!-- Link to Sign In -->
          <div class="text-center mt-4 text-sm text-gray-600">
            Already have an account?
            <NuxtLink 
              to="/login"
              class="text-primary-600 hover:text-primary-500 font-medium"
            >
              Sign in
            </NuxtLink>
          </div>
        </UForm>
      </UCard>
    </div>
  </ClientOnly>
</template>