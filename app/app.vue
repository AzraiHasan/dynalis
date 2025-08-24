<template>
  <div class="light">
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
  </div>
</template>

<script setup>
// Force light mode on app mount
onMounted(() => {
  if (typeof window !== 'undefined') {
    const colorMode = useColorMode()
    colorMode.preference = 'light'
    colorMode.value = 'light'
    
    // Also set HTML class directly
    document.documentElement.classList.remove('dark')
    document.documentElement.classList.add('light')
    document.documentElement.setAttribute('data-theme', 'light')
  }
})
</script>
