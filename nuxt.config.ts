// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  devtools: { enabled: true },

  modules: [
    '@nuxt/ui',
    '@nuxt/eslint',
    '@nuxtjs/supabase'
  ],

  supabase: {
    url: process.env.SUPABASE_URL,
    key: process.env.SUPABASE_ANON_KEY,
    redirect: false, // Keep manual control over redirects
    redirectOptions: {
      login: '/',
      callback: '/confirm',
      exclude: ['/'], // Only exclude the login page from redirect
    }
  },

  css: ['~/assets/css/main.css'],

  vite: {
    optimizeDeps: {
      include: ['xlsx', 'papaparse', 'date-fns']
    }
  },

  future: {
    compatibilityVersion: 4
  },

  compatibilityDate: '2024-11-27'
})