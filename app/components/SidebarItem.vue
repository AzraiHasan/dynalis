<script setup lang="ts">
interface Props {
  label: string
  icon: string
  to: string
  isActive: boolean
  isCollapsed: boolean
}

const _props = defineProps<Props>()
</script>

<template>
  <NuxtLink
    :to="to"
    :class="[
      'flex items-center px-3 py-2.5 rounded-lg transition-all duration-200 ease-in-out group',
      'hover:bg-gray-100',
      isActive 
        ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' 
        : 'text-gray-700 hover:text-gray-900',
      isCollapsed ? 'justify-center' : 'justify-start space-x-3'
    ]"
  >
    <UIcon 
      :name="icon" 
      :class="[
        'flex-shrink-0 transition-colors duration-200',
        isActive ? 'text-emerald-600' : 'text-gray-500 group-hover:text-gray-700',
        isCollapsed ? 'w-5 h-5' : 'w-5 h-5'
      ]" 
    />
    <span 
      v-if="!isCollapsed"
      :class="[
        'font-medium text-sm transition-colors duration-200',
        isActive ? 'text-emerald-700' : 'text-gray-700 group-hover:text-gray-900'
      ]"
    >
      {{ label }}
    </span>
    
    <!-- Tooltip for collapsed state -->
    <UTooltip 
      v-if="isCollapsed" 
      :text="label" 
      :popper="{ placement: 'right' }"
    >
      <div class="absolute inset-0" />
    </UTooltip>
  </NuxtLink>
</template>