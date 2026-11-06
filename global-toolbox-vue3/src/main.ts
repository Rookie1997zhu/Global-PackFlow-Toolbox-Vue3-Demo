import { createApp } from 'vue'
import App from './App.vue'
import './style.css'
import { i18n as dielineI18n } from './integrations/dieline/i18n/index.js'

createApp(App).use(dielineI18n).mount('#app')
