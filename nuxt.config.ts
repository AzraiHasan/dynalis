export default defineNuxtConfig({
  devtools: { enabled: true },

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
  },

  modules: ["@nuxt/ui", "@nuxt/eslint", "nuxt-auth-utils"],


  css: ["~/assets/css/main.css"],

  future: {
    compatibilityVersion: 4,
  },

  compatibilityDate: "2024-11-27",
});