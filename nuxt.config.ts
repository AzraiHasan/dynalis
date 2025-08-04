export default defineNuxtConfig({
  devtools: { enabled: true },

  modules: ["@nuxt/ui", "@nuxt/eslint", "@nuxtjs/supabase"],

  supabase: {
    redirectOptions: {
      login: '/',
      callback: '/dataupload',
      exclude: ['/']
    }
  },

  runtimeConfig: {
    // Private keys (only available on server-side)
    supabase: {
      serviceKey: process.env.SUPABASE_SERVICE_ROLE_KEY
    },
    // Public keys (exposed to client-side)
    public: {
      supabase: {
        url: process.env.SUPABASE_URL,
        anonKey: process.env.SUPABASE_ANON_KEY
      }
    }
  },

  css: ["~/assets/css/main.css"],

  future: {
    compatibilityVersion: 4,
  },

  compatibilityDate: "2024-11-27",
});