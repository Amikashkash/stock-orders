import { createVuetify } from 'vuetify'
import { he } from 'vuetify/locale'
import '@mdi/font/css/materialdesignicons.css'
import 'vuetify/styles'

export default createVuetify({
  locale: {
    locale: 'he',
    messages: { he },
  },
  display: {
    mobileBreakpoint: 'sm',
  },
  theme: {
    defaultTheme: 'warehouse',
    themes: {
      warehouse: {
        dark: false,
        colors: {
          primary: '#4f46e5',
          secondary: '#10b981',
          warning: '#f59e0b',
          error: '#ef4444',
          info: '#3b82f6',
          success: '#10b981',
          surface: '#ffffff',
          background: '#f3f4f6',
        },
      },
    },
  },
  defaults: {
    VBtn: { style: 'font-family: Heebo, sans-serif;' },
    VCard: { rounded: 'lg' },
    VTextField: { variant: 'outlined', density: 'comfortable' },
    VSelect: { variant: 'outlined', density: 'comfortable' },
    VTextarea: { variant: 'outlined', density: 'comfortable' },
  },
})
