export default defineAppConfig({
  // https://ui3.nuxt.dev/getting-started/theme#design-system
  ui: {
    colors: {
      primary: 'emerald',
      neutral: 'slate',
    },
    button: {
      defaultVariants: {
        // Set default button color to neutral
        // color: 'neutral'
      }
    },
    // Force light mode for entire app
    colorMode: {
      preference: 'light',
      fallback: 'light',
      storageKey: 'nuxt-color-mode'
    }
  }
})
