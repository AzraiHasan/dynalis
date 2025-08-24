export default defineNuxtConfig({
  devtools: { enabled: true },

  // Static generation for demo deployment
  ssr: false,

  nitro: {
    prerender: {
      routes: ['/']
    },
  },

  modules: ["@nuxt/ui", "@nuxt/eslint", "@nuxtjs/color-mode"],

  // Force light mode
  colorMode: {
    preference: 'light',
    fallback: 'light',
    hid: 'nuxt-color-mode-script',
    globalName: '__NUXT_COLOR_MODE__',
    componentName: 'ColorScheme',
    classPrefix: '',
    classSuffix: '',
    storageKey: 'nuxt-color-mode'
  },

  css: ["~/assets/css/main.css"],

  future: {
    compatibilityVersion: 4,
  },

  compatibilityDate: "2024-11-27",
});