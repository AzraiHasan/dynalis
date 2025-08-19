<template>
  <UApp>
    <!-- Simple centered layout for auth pages -->
    <div class="min-h-screen bg-gradient-to-br from-emerald-50 to-blue-50 flex items-center justify-center p-4">
      <div class="w-full max-w-md">
        <!-- Brand Header -->
        <div class="text-center mb-8">
          <div class="flex items-center justify-center gap-3 mb-4">
            <UIcon name="i-lucide-building-2" class="text-emerald-500 w-12 h-12" />
            <div class="text-left">
              <h1 class="text-2xl font-bold text-gray-800">Dynalis</h1>
              <p class="text-sm text-gray-600">Data Interpreter</p>
            </div>
          </div>
        </div>

        <!-- Page Content -->
        <div class="bg-white rounded-xl shadow-lg p-8">
          <slot />
        </div>

        <!-- Footer -->
        <div class="text-center mt-6 text-sm text-gray-500">
          <p>&copy; 2024 Dynalis Data Interpreter</p>
        </div>
      </div>
    </div>
  </UApp>
</template>