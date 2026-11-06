import {createI18n} from 'vue-i18n'
import zhCN from './zh-CN.js'
import koKR from './ko-KR.js'

export const LOCALE_KEY='boxcraft.locale'
export const LOCALES=['zh-CN','ko-KR']

function readStoredLocale(){
  try{
    const v=localStorage.getItem(LOCALE_KEY)
    if(LOCALES.includes(v))return v
  }catch{/* ignore */}
  return 'zh-CN'
}

function syncHtmlLang(code){
  if(typeof document!=='undefined'){
    document.documentElement.lang=code==='ko-KR'?'ko':'zh-CN'
  }
}

const initial=readStoredLocale()
syncHtmlLang(initial)

export const i18n=createI18n({
  legacy:false,
  locale:initial,
  fallbackLocale:'zh-CN',
  messages:{
    'zh-CN':zhCN,
    'ko-KR':koKR
  }
})

export function setLocale(code){
  if(!LOCALES.includes(code))return
  i18n.global.locale.value=code
  try{localStorage.setItem(LOCALE_KEY,code)}catch{/* ignore */}
  syncHtmlLang(code)
}

export function getLocale(){
  return i18n.global.locale.value
}
