<!-- pages/index.vue -->
<script setup lang="ts">
import * as z from "zod";
import type { FormSubmitEvent } from "@nuxt/ui";

definePageMeta({
  ssr: false,
  layout: 'default'
});

const router = useRouter();

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

  // Demo version - no real authentication
  setTimeout(() => {
    toast.add({
      title: "Demo Version",
      description: "Login disabled in demo. Try the interactive demo instead!",
      color: "info",
    });
    isLoading.value = false;
  }, 1000);
}

// Start demo function
const startDemo = async () => {
  await router.push('/demo-sandbox');
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
        <p class="text-gray-600 mt-2">Property data management and analytics platform</p>
      </div>

      <!-- Demo CTA Card -->
      <UCard class="mb-6 bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
        <div class="text-center p-4">
          <div class="flex justify-center mb-3">
            <UIcon name="i-heroicons-play-circle" class="text-blue-600 w-12 h-12" />
          </div>
          <h2 class="text-xl font-bold text-gray-800 mb-2">Try Interactive Demo</h2>
          <p class="text-sm text-gray-600 mb-4">
            Experience Dynalis with pre-loaded Malaysian property data. 
            Upload files, track progress, and see analytics in action.
          </p>
          <UButton 
            color="primary" 
            size="lg" 
            block
            class="mb-3"
            @click="startDemo"
          >
            <UIcon name="i-heroicons-rocket-launch" class="mr-2" />
            Start 30-Minute Demo
          </UButton>
          <p class="text-xs text-gray-500">
            No signup required • Full feature access • Sample Malaysian data included
          </p>
        </div>
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
