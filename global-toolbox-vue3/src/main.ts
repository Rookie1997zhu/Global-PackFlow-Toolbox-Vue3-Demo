import { createApp } from 'vue'
import App from './App.vue'
import './style.css'
import { i18n as dielineI18n } from './integrations/dieline/i18n/index.js'
import { router } from './router'

createApp(App).use(router).use(dielineI18n).mount('#app')
