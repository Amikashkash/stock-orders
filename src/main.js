import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import pinia from './plugins/pinia'
import vuetify from './plugins/vuetify'

createApp(App)
  .use(pinia)
  .use(router)
  .use(vuetify)
  .mount('#app')
