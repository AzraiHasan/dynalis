<template>
  <div class="container mx-auto p-4">
    <h1 class="text-2xl font-bold mb-4">AI Analysis Assistant</h1>

    <!-- Chat Interface -->
    <UCard class="mb-4">
      <template #header>
        <div class="flex items-center gap-2">
          <Icon name="i-lucide-message-square" class="text-gray-600" />
          <h2 class="text-lg font-semibold">Chat with AI Assistant</h2>
        </div>
      </template>

      <!-- Messages Display -->
      <div class=" overflow-y-auto mb-4 space-y-4" ref="chatContainer">
        <template v-for="(message, index) in messages" :key="index">
          <!-- User Message -->
          <div v-if="message.role === 'user'" class="flex justify-end">
            <div class="bg-primary-100 rounded-lg p-3 max-w-[80%]">
              <p class="text-sm">{{ message.content }}</p>
            </div>
          </div>
          <!-- AI Message -->
          <div v-else class="flex justify-start">
            <div class="bg-gray-100 rounded-lg p-3 max-w-[80%]">
              <p class="text-sm">{{ message.content }}</p>
            </div>
          </div>
        </template>
        <!-- Loading indicator -->
        <div v-if="isLoading" class="flex justify-start">
          <div class="bg-gray-100 rounded-lg p-3 w-full">
            <UProgress
              v-model="loadingStep"
              :max="[
                'Reading data...',
                'Analyzing context...',
                'Generating response...',
                'Done!'
              ]"
            />
          </div>
        </div>
      </div>

      <!-- Input Area -->
      <div class="flex gap-2">
        <UTextarea
          v-model="userInput"
          class="flex-1"
          :rows="1"
          placeholder="Ask about your data analysis..."
          @keydown.enter.prevent="handleSend"
        />
        <UButton
          icon="i-lucide-send"
          color="primary"
          :loading="isLoading"
          :disabled="!userInput.trim() || isLoading"
          @click="handleSend"
        />
      </div>

      <!-- Suggested Prompts -->
      <div class="mt-4 flex flex-wrap gap-2">
        <UButton
          v-for="prompt in suggestedPrompts"
          :key="prompt"
          size="xs"
          variant="soft"
          @click="userInput = prompt"
        >
          {{ prompt }}
        </UButton>
      </div>
    </UCard>
    
    <!-- File Info -->
    <UCard class="mb-4">
      <div class="flex items-center gap-2">
        <Icon name="i-lucide-file" class="text-gray-600" />
        <span class="text-gray-600">Selected file:</span>
        <span class="font-medium">{{ fileName }}</span>
      </div>
    </UCard>

    <!-- Debug Data Display -->
    <UCard class="mb-4">
      <template #header>
        <div class="flex items-center justify-between">
          <h2 class="text-lg font-semibold">Data Preview</h2>
          <UButton
            v-if="storedData"
            size="sm"
            icon="i-lucide-clipboard"
            @click="copyToClipboard"
          >
            Copy JSON
          </UButton>
        </div>
      </template>
      
      <div v-if="storedData" class="space-y-4">
        <!-- Summary -->
        <div class="text-sm text-gray-600">
          <p>Total Rows: {{ storedData.fileData.length }}</p>
          <p>Headers: {{ storedData.headers.join(', ') }}</p>
        </div>
        
        <!-- Data Preview -->
        <div class="overflow-auto max-h-96">
          <pre class="text-xs bg-gray-50 p-4 rounded">{{ formattedData }}</pre>
        </div>
      </div>
      <div v-else class="text-gray-500 italic">
        No data available
      </div>
    </UCard>

    <!-- Navigation Buttons -->
    <div class="flex justify-between mt-6">
      <UButton
        label="Back to Upload"
        icon="i-lucide-arrow-left"
        @click="handleBack"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
const router = useRouter()
const route = useRoute()

// Initialize data from localStorage
const storedData = ref<{
  fileData: any[];
  headers: string[];
  fileName: string;
} | null>(null)

onMounted(() => {
  try {
    const stored = localStorage.getItem('uploadedFileData')
    if (stored) {
      storedData.value = JSON.parse(stored)
    }
  } catch (error) {
    console.error('Error reading file data:', error)
  }
})

const fileName = computed(() => {
  return storedData.value?.fileName || route.query.fileName || 'No file selected'
})

// Format the data for display
const formattedData = computed(() => {
  if (!storedData.value) return ''
  return JSON.stringify(storedData.value, null, 2)
})

// Copy to clipboard function
const copyToClipboard = async () => {
  try {
    await navigator.clipboard.writeText(formattedData.value)
    // You could add a toast notification here if you want
  } catch (err) {
    console.error('Failed to copy:', err)
  }
}

const handleBack = () => {
  // Clean up stored data before navigating back
  localStorage.removeItem('uploadedFileData')
  router.push('/dashboard')
}

// Clean up on component unmount
onUnmounted(() => {
  localStorage.removeItem('uploadedFileData')
})

// Chat related state
const userInput = ref('')
const isLoading = ref(false)
const loadingStep = ref(0)
const messages = ref<{ role: 'user' | 'assistant'; content: string }[]>([])
const chatContainer = ref<HTMLElement | null>(null)

// Suggested prompts based on data analysis context
const suggestedPrompts = [
  'Analyze the distribution of values in my dataset',
  'Find any outliers in the data',
  'Summarize the key statistics',
  'Suggest visualizations for this data',
]

// Scroll to bottom of chat
const scrollToBottom = () => {
  nextTick(() => {
    if (chatContainer.value) {
      chatContainer.value.scrollTop = chatContainer.value.scrollHeight
    }
  })
}

// Handle sending messages
const handleSend = async () => {
  const message = userInput.value.trim()
  if (!message || isLoading.value) return

  messages.value.push({
    role: 'user',
    content: message
  })
  
  userInput.value = ''
  scrollToBottom()

  isLoading.value = true
  loadingStep.value = 0

  try {
    // Simulate different loading stages
    loadingStep.value = 1
    await new Promise(resolve => setTimeout(resolve, 500))
    
    loadingStep.value = 2
    await new Promise(resolve => setTimeout(resolve, 500))
    
    loadingStep.value = 3
    await new Promise(resolve => setTimeout(resolve, 500))
    
    // Simulate AI response
    messages.value.push({
      role: 'assistant',
      content: `This is a placeholder response. You should implement actual API calls to your LLM endpoint here. The user asked: "${message}"`
    })
  } catch (error) {
    console.error('Error sending message:', error)
  } finally {
    isLoading.value = false
    loadingStep.value = 0
    scrollToBottom()
  }
}

// Watch for new messages and scroll to bottom
watch(messages, scrollToBottom, { deep: true })
</script>

<style scoped>
/* Optional: Add custom scrollbar styling */
.overflow-y-auto {
  scrollbar-width: thin;
  scrollbar-color: #CBD5E1 transparent;
}

.overflow-y-auto::-webkit-scrollbar {
  width: 6px;
}

.overflow-y-auto::-webkit-scrollbar-track {
  background: transparent;
}

.overflow-y-auto::-webkit-scrollbar-thumb {
  background-color: #CBD5E1;
  border-radius: 3px;
}
</style>


