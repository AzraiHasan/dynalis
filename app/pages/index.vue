<!-- pages/index.vue -->
<script setup lang="ts">
import { useAuth } from "~/composables/useAuth";

definePageMeta({
  layout: 'auth',
  ssr: false,
});

const router = useRouter();
const auth = useAuth();

// Redirect authenticated users to dashboard
watch(auth.user, (user) => {
  if (user) {
    router.push("/dashboard");
  }
}, { immediate: true });

// Functions for navigation
function goToLogin() {
  router.push("/login");
}

function goToSignup() {
  router.push("/signup");
}
</script>

<template>
  <!-- Landing page for unauthenticated users -->
  <div class="min-h-screen bg-gradient-to-br from-emerald-50 to-blue-50">
    <div class="flex items-center justify-center min-h-screen p-4">
      <div class="max-w-4xl w-full">
        <!-- Header Section -->
        <div class="text-center mb-12">
          <div class="flex justify-center mb-6">
            <UIcon name="i-lucide-building-2" class="text-emerald-500 w-20 h-20" />
          </div>
          <h1 class="text-4xl font-bold text-gray-800 mb-4">Welcome to Dynalis</h1>
          <p class="text-xl text-gray-600 mb-6">Your Data Analytics Assistant for Property Management</p>
          <p class="text-gray-500 max-w-2xl mx-auto">
            Streamline your property rental data processing with our batch upload system. 
            Upload, validate, and process large datasets efficiently with real-time tracking and comprehensive analytics.
          </p>
        </div>

        <div class="grid lg:grid-cols-2 gap-12 items-center">
          <!-- Getting Started Section -->
          <UCard class="p-8 shadow-lg">
            <h2 class="text-2xl font-semibold text-gray-800 mb-6">Getting Started</h2>
            <div class="space-y-4">
              <div class="flex items-start space-x-3">
                <div class="flex-shrink-0 w-8 h-8 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center font-semibold text-sm">1</div>
                <div>
                  <h3 class="font-medium text-gray-800">Download the sample template from the sidebar</h3>
                  <p class="text-gray-600 text-sm">Get our standardized Excel template with sample Malaysian property data</p>
                </div>
              </div>
              <div class="flex items-start space-x-3">
                <div class="flex-shrink-0 w-8 h-8 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center font-semibold text-sm">2</div>
                <div>
                  <h3 class="font-medium text-gray-800">Fill in your property data</h3>
                  <p class="text-gray-600 text-sm">Use the template format: Site ID, rental amounts, deposits, and expiration dates</p>
                </div>
              </div>
              <div class="flex items-start space-x-3">
                <div class="flex-shrink-0 w-8 h-8 bg-purple-100 text-purple-600 rounded-full flex items-center justify-center font-semibold text-sm">3</div>
                <div>
                  <h3 class="font-medium text-gray-800">Upload and analyze your data</h3>
                  <p class="text-gray-600 text-sm">Batch process thousands of records with real-time progress tracking</p>
                </div>
              </div>
            </div>

            <!-- CTA Buttons -->
            <div class="mt-8 flex flex-col sm:flex-row gap-4">
              <UButton 
                color="primary" 
                size="lg"
                icon="i-lucide-log-in"
                class="flex-1 sm:flex-none"
                @click="goToLogin"
              >
                Sign In
              </UButton>
              <UButton 
                variant="outline" 
                size="lg"
                icon="i-lucide-user-plus"
                class="flex-1 sm:flex-none"
                @click="goToSignup"
              >
                Create Account
              </UButton>
            </div>
          </UCard>

          <!-- Features Section -->
          <div class="space-y-6">
            <div class="bg-white p-6 rounded-lg shadow-md">
              <div class="flex items-center space-x-3 mb-3">
                <UIcon name="i-lucide-upload-cloud" class="text-emerald-500 w-8 h-8" />
                <h3 class="text-xl font-semibold text-gray-800">Batch Processing</h3>
              </div>
              <p class="text-gray-600">Upload and process thousands of property records simultaneously with background job management and progress tracking.</p>
            </div>

            <div class="bg-white p-6 rounded-lg shadow-md">
              <div class="flex items-center space-x-3 mb-3">
                <UIcon name="i-lucide-shield-check" class="text-blue-500 w-8 h-8" />
                <h3 class="text-xl font-semibold text-gray-800">Data Validation</h3>
              </div>
              <p class="text-gray-600">Built-in validation ensures data quality with currency parsing, date validation, and duplicate detection.</p>
            </div>

            <div class="bg-white p-6 rounded-lg shadow-md">
              <div class="flex items-center space-x-3 mb-3">
                <UIcon name="i-lucide-activity" class="text-purple-500 w-8 h-8" />
                <h3 class="text-xl font-semibold text-gray-800">Real-time Tracking</h3>
              </div>
              <p class="text-gray-600">Monitor upload progress in real-time with cancellation support and comprehensive job status updates.</p>
            </div>
          </div>
        </div>

        <!-- Template Download Call-to-Action -->
        <div class="mt-12 text-center">
          <UCard class="p-6 bg-gradient-to-r from-emerald-500 to-blue-600 text-white">
            <h3 class="text-xl font-semibold mb-3">Ready to get started?</h3>
            <p class="mb-4">Download our sample template to see the expected data format</p>
            <a
              href="/templates/dynalis-sample-data.xlsx"
              download
              class="inline-flex items-center gap-2 bg-white text-emerald-600 font-medium px-6 py-3 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <UIcon name="i-lucide-download" class="w-5 h-5" />
              Download Sample Template
            </a>
          </UCard>
        </div>
      </div>
    </div>
  </div>
</template>
