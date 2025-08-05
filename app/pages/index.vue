<!-- pages/index.vue -->
<script setup lang="ts">
definePageMeta({
  ssr: false,
});

import * as z from "zod";
import type { FormSubmitEvent } from "@nuxt/ui";
import { useAuth } from "~/composables/useAuth";

const router = useRouter();
const isSignUp = ref(false);

const signInSchema = z.object({
  email: z.string().email("Invalid email"),
  password: z.string().min(8, "Must be at least 8 characters"),
});

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

const schema = computed(() => isSignUp.value ? signUpSchema : signInSchema);
type SignInSchema = z.output<typeof signInSchema>;
type SignUpSchema = z.output<typeof signUpSchema>;
type Schema = SignInSchema | SignUpSchema;

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

if (typeof window !== 'undefined') {
  localStorage.removeItem("uploadedFileData");
}

// Redirect if already authenticated
watch(auth.user, (user) => {
  console.log("Auth user changed:", user?.email || 'null');
  if (user) {
    console.log("User authenticated, redirecting to dataupload");
    router.push("/dataupload");
  }
}, { immediate: true });

// Clear form when switching modes
watch(isSignUp, () => {
  state.email = "";
  state.password = "";
  state.confirmPassword = "";
  state.firstName = "";
  state.lastName = "";
});

async function onSubmit(event: FormSubmitEvent<Schema>) {
  isLoading.value = true;

  try {
    // Simulate a slight delay for better UX
    await new Promise((r) => setTimeout(r, 800));

    if (isSignUp.value) {
      await handleSignUp(event.data as SignUpSchema);
    } else {
      await handleSignIn(event.data as SignInSchema);
    }
  } finally {
    isLoading.value = false;
  }
}

async function handleSignIn(data: SignInSchema) {
  try {
    const result = await auth.signIn(data.email, data.password);
    
    toast.add({
      title: "Success",
      description: "Successfully signed in.",
      color: "success",
    });

    // Add a small delay to show the toast before redirecting
    setTimeout(() => {
      router.push("/dataupload");
    }, 500);
  } catch (error: any) {
    console.error("Sign in error:", error);
    toast.add({
      title: "Sign In Failed",
      description: error.message || "Invalid email or password",
      color: "error",
    });
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

    // Switch to sign in mode after successful registration
    setTimeout(() => {
      isSignUp.value = false;
      state.email = data.email; // Pre-fill email for convenience
      state.password = "";
      state.confirmPassword = "";
      state.firstName = "";
      state.lastName = "";
    }, 1000);
  } catch (error: any) {
    console.error("Sign up error:", error);
    toast.add({
      title: "Sign Up Failed",
      description: error.message || "Failed to create account",
      color: "error",
    });
  }
}

async function handleForgotPassword() {
  if (!state.email) {
    toast.add({
      title: "Email Required",
      description: "Please enter your email address first.",
      color: "warning",
    });
    return;
  }

  try {
    await auth.resetPassword(state.email);
    toast.add({
      title: "Password Reset Sent",
      description: "Please check your email for password reset instructions.",
      color: "success",
    });
  } catch (error: any) {
    console.error("Password reset error:", error);
    toast.add({
      title: "Reset Failed",
      description: error.message || "Failed to send password reset email",
      color: "error",
    });
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
          <p class="text-sm text-gray-500 mt-1">
            {{ isSignUp ? 'Create your account' : 'Sign in to continue' }}
          </p>
        </div>

        <!-- Form -->
        <UForm
          :schema="schema"
          :state="state"
          class="space-y-4"
          @submit="onSubmit"
        >
          <!-- Sign Up Only Fields -->
          <template v-if="isSignUp">
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
          </template>

          <!-- Common Fields -->
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
              :autocomplete="isSignUp ? 'new-password' : 'current-password'"
              class="w-full"
            />
          </UFormField>

          <!-- Sign Up Only Fields -->
          <template v-if="isSignUp">
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
          </template>

          <!-- Sign In Only Options -->
          <div v-if="!isSignUp" class="flex items-center justify-between mt-2">
            <UCheckbox label="Remember me" name="remember" />
            <UButton 
              variant="link" 
              color="primary" 
              size="xs"
              @click="handleForgotPassword"
            >
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
            {{ isSignUp ? 'Create Account' : 'Sign in' }}
          </UButton>

          <!-- Toggle between Sign In and Sign Up -->
          <div class="text-center mt-4 text-sm text-gray-600">
            {{ isSignUp ? 'Already have an account?' : "Don't have an account?" }}
            <UButton 
              variant="link" 
              color="primary" 
              size="xs"
              @click="isSignUp = !isSignUp"
            >
              {{ isSignUp ? 'Sign in' : 'Create account' }}
            </UButton>
          </div>
        </UForm>
      </UCard>
    </div>
  </ClientOnly>
</template>
