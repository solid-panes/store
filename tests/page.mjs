// The store page: it shows every pane and app in the catalogue, at desktop and phone width.
// Serves this folder itself on a spare port, so nothing else needs to be running.
import { launch } from './cdp.mjs'
import { serve, ROOT } from './serve.mjs'
import { readFileSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const server = await serve()
const base = server.base

let failures = 0
const check = (name, ok, detail = '') => { if (!ok) failures++; console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ` (${detail})` : ''}`) }
const doc = JSON.parse(readFileSync(path.join(ROOT, 'catalogue.jsonld'), 'utf8'))
const invocations = doc['@graph'].filter(node => /Invocation$/.test([].concat(node['@type'] || []).join(' ')))
const wantPanes = invocations.filter(node => [].concat(node['@type']).includes('panes:PaneModuleInvocation')).length
const wantApps = invocations.length - wantPanes
mkdirSync(path.join(HERE, 'shots'), { recursive: true })

for (const width of [1300, 400]) {
  const page = await launch({ port: 9349, width, height: 900 })
  try {
    await page.goto(base)
    await page.waitFor(() => document.querySelectorAll('#panes .card, #apps .card').length > 0, { timeout: 20000 })
    const seen = await page.evaluate(() => ({ panes: document.querySelectorAll('#panes .card').length, apps: document.querySelectorAll('#apps .card').length, overflow: document.documentElement.scrollWidth > innerWidth, names: [...document.querySelectorAll('.card .name')].every(n => n.firstChild && n.firstChild.textContent.trim()), dark: getComputedStyle(document.body).backgroundColor }))
    check(`${width} px: every pane is shown`, seen.panes === wantPanes, seen.panes + ' of ' + wantPanes)
    check(`${width} px: every app is shown`, seen.apps === wantApps, seen.apps + ' of ' + wantApps)
    check(`${width} px: every card has a name`, seen.names)
    check(`${width} px: no sideways scroll`, !seen.overflow)
    await page.screenshot(path.join(HERE, 'shots', `page-${width}.png`))
  } catch (error) { failures++; console.log('FAIL ' + (error && error.message ? error.message : error)) } finally { await page.close() }
}
server.close()
console.log(failures ? `\n${failures} failure(s)` : '\nall passed')
process.exit(failures ? 1 : 0)
