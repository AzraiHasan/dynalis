export default defineNuxtConfig({
  devtools: { enabled: true },

  // Enable static generation for demo deployment
  ssr: process.env.DEMO_MODE === 'true' ? false : true,

  nitro: {
    experimental: {
      database: true
    },
    database: {
      default: {
        connector: "sqlite",
        options: {
          name: "dynalis_db",
          file: ".data/dynalis.sqlite3",
        },
      },
    },
    // For demo deployment with static hosting
    prerender: process.env.DEMO_MODE === 'true' ? {
      routes: ['/']
    } : undefined,
  },

  modules: ["@nuxt/ui", "@nuxt/eslint", "nuxt-auth-utils"],


  css: ["~/assets/css/main.css"],

  future: {
    compatibilityVersion: 4,
  },

  compatibilityDate: "2024-11-27",
});