import { readFileSync, writeFileSync } from 'fs'

/** Prefix every CSS selector with root, preserving @media/@keyframes. */
function scopeCss(raw, root) {
  let css = raw.replace(/@import\s+url\([^)]+\)\s*;?/g, '')

  const skipGlobals = new Set([':root', '*', 'body', 'html'])
  let out = ''
  let i = 0
  while (i < css.length) {
    // skip whitespace/comments
    if (css.startsWith('/*', i)) {
      const end = css.indexOf('*/', i + 2)
      i = end < 0 ? css.length : end + 2
      continue
    }
    if (/\s/.test(css[i])) {
      out += css[i++]
      continue
    }

    // @rule
    if (css[i] === '@') {
      const brace = css.indexOf('{', i)
      if (brace < 0) {
        out += css.slice(i)
        break
      }
      const header = css.slice(i, brace + 1)
      out += header
      i = brace + 1
      // find matching close
      let depth = 1
      const start = i
      while (i < css.length && depth > 0) {
        if (css[i] === '{') depth++
        else if (css[i] === '}') depth--
        i++
      }
      const inner = css.slice(start, i - 1)
      if (header.startsWith('@media') || header.startsWith('@supports')) {
        out += scopeCss(inner, root)
      } else {
        out += inner
      }
      out += '}'
      continue
    }

    // normal rule: selectors { body }
    const brace = css.indexOf('{', i)
    if (brace < 0) {
      out += css.slice(i)
      break
    }
    const selectors = css.slice(i, brace).trim()
    let depth = 1
    let j = brace + 1
    while (j < css.length && depth > 0) {
      if (css[j] === '{') depth++
      else if (css[j] === '}') depth--
      j++
    }
    const body = css.slice(brace + 1, j - 1)

    const scoped = selectors
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .map((s) => {
        if (skipGlobals.has(s.split(/\s+/)[0]) && (s === '*' || s === 'body' || s === ':root' || s === 'html')) {
          return null
        }
        if (s === 'button,input,select' || s.startsWith('button,input')) {
          return `${root} button,${root} input,${root} select`
        }
        if (s === 'button') return `${root} button`
        if (s.startsWith(root)) return s
        return `${root} ${s}`
      })
      .filter(Boolean)
      .join(',')

    if (scoped) out += `${scoped}{${body}}`
    i = j
  }

  // base box-sizing
  return `${root},${root} *{box-sizing:border-box}${out}\n`
}

for (const [src, dest, root] of [
  ['src/integrations/pallet/style.source.css', 'src/integrations/pallet/pallet.css', '.pallet-tool'],
  ['src/integrations/dieline/style.css', 'src/integrations/dieline/dieline.css', '.dieline-tool'],
]) {
  const result = scopeCss(readFileSync(src, 'utf8'), root)
  writeFileSync(dest, result)
  console.log(dest, result.length, 'visualbody=', result.includes(`${root} .visualbody`), 'broken=', result.includes('.visual.pallet') || result.includes('.adv-.dieline'))
}
