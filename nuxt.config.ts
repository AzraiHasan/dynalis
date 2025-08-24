export default defineNuxtConfig({
  devtools: { enabled: true },

  // Static generation for demo deployment
  ssr: false,

  nitro: {
    prerender: {
      routes: ['/']
    },
  },

  modules: ["@nuxt/ui", "@nuxt/eslint"],

  css: ["~/assets/css/main.css"],

  future: {
    compatibilityVersion: 4,
  },

  compatibilityDate: "2024-11-27",
});