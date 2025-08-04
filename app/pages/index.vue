<!-- pages/index.vue -->
<script setup lang="ts">
definePageMeta({
  ssr: false,
});

import * as z from "zod";
import type { FormSubmitEvent } from "@nuxt/ui";

const router = useRouter();
const supabase = useSupabaseClient();
const user = useSupabaseUser();

// Redirect if already logged in
watchEffect(() => {
  if (user.value) {
    router.push('/dataupload');
  }
});

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
const isSignUp = ref(false);

if (typeof window !== 'undefined') {
  localStorage.removeItem("uploadedFileData");
}

async function onSubmit(event: FormSubmitEvent<Schema>) {
  isLoading.value = true;

  try {
    if (isSignUp.value) {
      // Sign up with Supabase
      const { data, error } = await supabase.auth.signUp({
        email: event.data.email,
        password: event.data.password,
      });

      if (error) throw error;

      // Create profile after successful signup
      if (data.user) {
        const { error: profileError } = await supabase
          .from('profiles')
          .insert({
            id: data.user.id,
            email: data.user.email!,
            name: null,
          });

        if (profileError) {
          console.error('Profile creation error:', profileError);
        }
      }

      toast.add({
        title: "Success",
        description: "Account created! Please check your email to verify your account.",
        color: "success",
      });
    } else {
      // Sign in with Supabase
      const { error } = await supabase.auth.signInWithPassword({
        email: event.data.email,
        password: event.data.password,
      });

      if (error) throw error;

      toast.add({
        title: "Success",
        description: "You have been logged in successfully.",
        color: "success",
      });

      // Redirect will happen automatically via watchEffect
    }
  } catch (error: any) {
    toast.add({
      title: "Error",
      description: error.message || "Authentication failed. Please try again.",
      color: "error",
    });
  } finally {
    isLoading.value = false;
  }
}

async function signInWithMagicLink() {
  if (!state.email) {
    toast.add({
      title: "Error",
      description: "Please enter your email address first.",
      color: "error",
    });
    return;
  }

  try {
    const { error } = await supabase.auth.signInWithOtp({
      email: state.email,
    });

    if (error) throw error;

    toast.add({
      title: "Magic link sent!",
      description: "Check your email for the sign-in link.",
      color: "success",
    });
  } catch (error: any) {
    toast.add({
      title: "Error",
      description: error.message || "Failed to send magic link.",
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
            {{ isSignUp ? 'Sign up' : 'Sign in' }}
          </UButton>

          <div class="text-center mt-4">
            <UButton
              variant="outline"
              color="gray"
              block
              @click="signInWithMagicLink"
              :disabled="isLoading"
            >
              Send Magic Link
            </UButton>
          </div>

          <div class="text-center mt-4 text-sm text-gray-600">
            {{ isSignUp ? 'Already have an account?' : "Don't have an account?" }}
            <UButton 
              variant="link" 
              color="primary" 
              size="xs"
              @click="isSignUp = !isSignUp"
            >
              {{ isSignUp ? 'Sign in' : 'Sign up' }}
            </UButton>
          </div>
        </UForm>
      </UCard>
    </div>
  </ClientOnly>
</template>
