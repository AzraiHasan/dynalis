<template>
  <div class="flex flex-col items-center justify-center gap-4 h-screen">
    <h1 class="font-bold text-2xl text-(--ui-primary)">
      Dynalis Excel Sheet Interpreter
    </h1>

    <div class="flex items-center gap-2">
      <UButton
        label="Enter"
        icon="i-lucide-square-play"
        to="/dataupload"
      />

      <UButton
        label="GitHub"
        color="neutral"
        variant="outline"
        icon="i-simple-icons-github"
        to="https://github.com/AzraiHasan/dynalis/tree/master"
        target="_blank"
      />
    </div>
  </div>
</template>
