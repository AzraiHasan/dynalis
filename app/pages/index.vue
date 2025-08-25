<!-- pages/index.vue -->
<script setup lang="ts">
import { useDemoMode } from '~/composables/useDemoMode';

definePageMeta({
  ssr: false,
  layout: 'default'
});

const router = useRouter();
const { loadSampleData } = useDemoMode();

const startDemo = () => {
  if (typeof window !== 'undefined') {
    localStorage.setItem('dynalis-demo-mode', 'true')
    // Clear any previous reset flag so sample data loads
    localStorage.removeItem('demo-was-reset')
    // Pre-load sample data for immediate demo experience
    loadSampleData()
  }
  router.push('/dashboard')
}

const downloadSample = () => {
  const link = document.createElement('a')
  link.href = '/templates/dynalis-sample-data.xlsx'
  link.download = 'dynalis-sample-data.xlsx'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

if (typeof window !== 'undefined') {
  localStorage.removeItem("uploadedFileData");
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
        <p class="text-gray-600 mt-2">Try our data analytics platform</p>
      </div>

      <!-- Demo Actions -->
      <UCard class="shadow-lg mb-6">
        <div class="space-y-4">
          <UButton
            size="lg"
            color="primary"
            block
            class="text-lg py-4"
            @click="startDemo"
          >
            🚀 Try Demo (No Signup Required)
          </UButton>
          
          <UButton
            variant="outline"
            block
            @click="downloadSample"
          >
            📥 Download Sample Data
          </UButton>
        </div>
      </UCard>

      <!-- Demo Instructions -->
      <UCard class="mb-6 bg-blue-50 border-blue-200">
        <div class="text-sm text-blue-800">
          <p class="font-medium mb-2">💡 Demo Instructions</p>
          <ul class="space-y-1 text-xs text-blue-700">
            <li>• Download the sample template</li>
            <li>• Add more data rows (optional)</li>
            <li>• Experience the full data processing workflow</li>
          </ul>
        </div>
      </UCard>
    </div>
  </ClientOnly>
</template>
