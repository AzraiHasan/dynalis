<template>
  <div>
    <UContainer>
      <h1>Redirecting...</h1>
    </UContainer>
  </div>
</template>

<script setup>
onMounted(() => {
  navigateTo('/dataupload')
})
</script>