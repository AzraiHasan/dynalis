<!-- pages/index.vue -->
<script setup lang="ts">
definePageMeta({
  layout: 'auth',
  ssr: false,
});

const router = useRouter();
const route = useRoute();
const toast = useToast();

// Handle demo completion/expiration messages
onMounted(() => {
  if (route.query.demo_completed === 'true') {
    toast.add({
      title: 'Demo Completed!',
      description: 'Ready to unlock the full power of Dynalis? Create your account now.',
      color: 'green',
      timeout: 5000
    })
  } else if (route.query.demo_expired === 'true') {
    toast.add({
      title: 'Demo Session Expired',
      description: 'Your demo session has ended. Sign up now to continue with unlimited access.',
      color: 'orange',
      timeout: 5000
    })
  }
})

// Functions for navigation
function startDemo() {
  router.push("/demo-sandbox");
}

// Removed login/signup functions for demo-only version
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
          <h1 class="text-4xl font-bold text-gray-800 mb-4">See Dynalis in Action in 60 Seconds</h1>
          <p class="text-xl text-gray-600 mb-6">Experience powerful property data management without any setup</p>
          <p class="text-gray-500 max-w-2xl mx-auto">
            Try our interactive demo with real Malaysian property data. Upload files, track progress, 
            and explore analytics - all without creating an account.
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
                size="xl"
                icon="i-heroicons-play"
                class="flex-1 sm:flex-none shadow-lg"
                @click="startDemo"
              >
                🚀 Try Interactive Demo
              </UButton>
            </div>
            
            <!-- Demo Benefits -->
            <div class="mt-6 p-4 bg-blue-50 rounded-lg">
              <div class="flex items-center space-x-2 mb-2">
                <UIcon name="i-heroicons-sparkles" class="text-blue-600 w-5 h-5" />
                <span class="text-sm font-medium text-blue-900">Demo includes:</span>
              </div>
              <ul class="text-sm text-blue-700 space-y-1">
                <li>• Pre-loaded Malaysian property data</li>
                <li>• File upload simulation</li>
                <li>• Real-time progress tracking</li>
                <li>• 30-minute session</li>
              </ul>
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

        <!-- Demo Call-to-Action -->
        <div class="mt-12 text-center">
          <UCard class="p-8 bg-gradient-to-r from-emerald-500 to-blue-600 text-white">
            <h3 class="text-2xl font-bold mb-4">Experience the Power of Dynalis</h3>
            <p class="text-lg mb-6 opacity-90">
              Join thousands of property managers who trust Dynalis for their data processing needs
            </p>
            <div class="flex flex-col sm:flex-row gap-4 justify-center items-center">
              <UButton 
                size="xl"
                variant="solid"
                class="bg-white text-blue-600 font-semibold px-8 py-4 hover:bg-gray-50"
                @click="startDemo"
              >
                🚀 Start Your Demo Now
              </UButton>
              <div class="text-sm opacity-75">
                No signup required • 30-minute demo
              </div>
            </div>
          </UCard>
        </div>
      </div>
    </div>
  </div>
</template>
