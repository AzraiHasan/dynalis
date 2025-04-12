// https://nuxt.com/docs/api/configuration/nuxt-config
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

  modules: ["@nuxt/ui", "@nuxt/eslint", "@nuxtjs/supabase", "nuxt-auth-utils"],

  supabase: {
    url: process.env.SUPABASE_URL,
    key: process.env.SUPABASE_KEY,
    redirect: false,
    redirectOptions: {
      login: "/login",
      callback: "/confirm",
      exclude: ["/*"],
    },
  },

  css: ["~/assets/css/main.css"],

  future: {
    compatibilityVersion: 4,
  },

  compatibilityDate: "2024-11-27",
});
