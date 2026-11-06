/** Vite/GitHub Pages 公共资源路径（带 base） */
export function publicAssetUrl(path=''){
  const root=(import.meta.env.BASE_URL||'/').replace(/\/?$/,'/')
  return root+String(path).replace(/^\//,'')
}
