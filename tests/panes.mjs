// Check a pane before the store lists it. A pane runs as the person using it, so the store
// only lists panes that pass.
//
//   node tests/panes.mjs                          every pane in the catalogue
//   node tests/panes.mjs <pane address> [sample]  one candidate, with something for it to draw
//
// FAIL stops a pane being listed. NOTE is something a person should look at and decide.
//
// 1. The file: served over https as JavaScript, parses, is one module with a default export,
//    has no static imports, and never builds HTML from text (innerHTML and the like) or runs
//    text as code (eval, new Function).
// 2. In a real browser: it loads, and its default export is a pane (name, label, render).
// 3. With a sample: the SolidOS Browser adds it and the page does not scroll sideways at 400 px.
import { launch } from './cdp.mjs'
import { serve, ROOT } from './serve.mjs'
import { readFileSync, writeFileSync, mkdtempSync, rmSync, mkdirSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { tmpdir } from 'node:os'
import path from 'node:path'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const BROWSER = 'https://solidos.org/docs/browser/'
const LIMIT = 500 * 1024

// Something public for each listed pane to draw.
const SAMPLES = {
  'https://solid-panes.github.io/notes/notes-pane.js': 'https://solid-panes.github.io/notes/notes/',
  'https://solid-panes.github.io/chess/chess-pane.js': 'https://solid-panes.github.io/chess/games/opera.ttl',
  'https://solid-panes.github.io/profile/profile-pane.js': 'https://solid-panes.github.io/profile/samples/alice.ttl#me',
  'https://solid-panes.github.io/tool-index/tool-index-pane.js': 'https://solid-panes.github.io/tool-index/samples/tool-index.ttl'
}

let failures = 0
let notes = 0
const fail = (pane, what) => { failures++; console.log(`FAIL ${pane}: ${what}`) }
const pass = (pane, what) => console.log(`PASS ${pane}: ${what}`)
const note = (pane, what) => { notes++; console.log(`NOTE ${pane}: ${what}`) }
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms))

// The code without its comments, so a comment that mentions innerHTML is not a finding.
const code = (source) => source.replace(/("(?:\\.|[^"\\\n])*"|'(?:\\.|[^'\\\n])*'|`(?:\\.|[^`\\])*`)|\/\/[^\n]*|\/\*[\s\S]*?\*\//g, (match, text) => text || '')
const count = (source, pattern) => (source.match(pattern) || []).length

async function file (address) {
  const short = address.split('/').pop()
  let url
  try { url = new URL(address) } catch { fail(short, 'not an address'); return null }
  if (url.protocol !== 'https:' || url.username || url.password) { fail(short, 'address is not plain https'); return null }
  const response = await fetch(address, { cache: 'no-store' }).catch(() => null)
  if (!response || !response.ok) { fail(short, 'not served (' + (response ? response.status : 'not reached') + ')'); return null }
  const type = response.headers.get('content-type') || ''
  if (!/javascript/.test(type)) fail(short, 'not served as JavaScript (' + type + ')')
  if (response.headers.get('access-control-allow-origin') !== '*') fail(short, 'cannot be loaded from other sites (no access-control-allow-origin: *)')
  const source = await response.text()
  if (source.length > LIMIT) note(short, `large file: ${(source.length / 1024).toFixed(0)} KB`)

  const folder = mkdtempSync(path.join(tmpdir(), 'pane-check-'))
  try {
    writeFileSync(path.join(folder, 'pane.mjs'), source)
    execFileSync(process.execPath, ['--check', path.join(folder, 'pane.mjs')], { stdio: 'pipe' })
  } catch (error) { fail(short, 'does not parse: ' + String(error.stderr || error.message).split('\n').find(line => /Error/.test(line))) } finally { rmSync(folder, { recursive: true, force: true }) }

  const bare = code(source)
  const before = failures
  if (!/\bexport\s+default\b/.test(bare)) fail(short, 'no default export')
  if (/^\s*import\s[^(]/m.test(bare)) fail(short, 'has a static import: a pane is one file')
  const html = count(bare, /\b(innerHTML|outerHTML|insertAdjacentHTML)\b|document\.write\s*\(/g)
  if (html) fail(short, `builds HTML from text ${html} time(s) (innerHTML, outerHTML, insertAdjacentHTML or document.write)`)
  const run = count(bare, /\beval\s*\(|\bnew\s+Function\b|setTimeout\s*\(\s*['"`]/g)
  if (run) fail(short, `runs text as code ${run} time(s) (eval, new Function)`)
  if (failures === before) pass(short, `the file is one clean module, ${(source.length / 1024).toFixed(0)} KB`)
  const more = count(bare, /\bimport\s*\(/g)
  if (more) note(short, `loads ${more} further file(s) with import(): check they come from the pane's own site`)
  if (/\b(localStorage|sessionStorage)\b|document\.cookie/.test(bare)) note(short, 'keeps something in the browser (localStorage, sessionStorage or cookies)')
  if (count(bare, /\bfetch\s*\(|XMLHttpRequest|WebSocket|sendBeacon/g)) note(short, 'makes its own requests: check where to')
  if (/\.(putBack|webOperation|update)\s*\(|method:\s*['"`](PUT|POST|PATCH|DELETE)/.test(bare)) note(short, 'can write to a pod')
  return short
}

async function contract (page, base, address, short) {
  await page.goto(base + 'tests/blank.html')
  await page.evaluate((url) => { window.__pane = null; import(url).then(m => { const p = m.default; window.__pane = p ? { name: p.name, label: typeof p.label, render: typeof p.render, icon: typeof p.icon === 'string' ? p.icon.slice(0, 5) : typeof p.icon } : { missing: true } }, e => { window.__pane = { error: String(e && e.message ? e.message : e) } }) }, address)
  await page.waitFor(() => !!window.__pane, { timeout: 30000 }).catch(() => {})
  const got = await page.evaluate(() => window.__pane)
  if (!got) { fail(short, 'did not load in the browser in time'); return '' }
  if (got.error) { fail(short, 'does not load in the browser: ' + got.error); return '' }
  if (got.missing || typeof got.name !== 'string' || !got.name || got.label !== 'function' || got.render !== 'function') { fail(short, 'default export is not a pane (name, label, render)'); return '' }
  pass(short, `loads in the browser as the pane "${got.name}"`)
  if (got.icon !== 'data:') note(short, 'icon is not a data: address, so the pane is not quite one file')
  return got.name
}

async function draws (address, sample, short, name) {
  const profile = path.join(HERE, 'shots', 'profile-' + name)
  rmSync(profile, { recursive: true, force: true })
  const page = await launch({ profile, port: 9348, width: 400, height: 900 })
  try {
    await page.goto(`${BROWSER}?pane=${encodeURIComponent(address)}&uri=${encodeURIComponent(sample)}`)
    const asked = await page.waitFor(() => { const box = document.getElementById('browseAsk'); return !!box && !box.hidden }, { timeout: 60000 }).catch(() => false)
    if (!asked) { fail(short, 'the SolidOS Browser did not ask about it'); return }
    await page.evaluate(() => document.getElementById('browseAskYes').click())
    const added = await page.waitFor(`!!(window.panes && window.panes.byName(${JSON.stringify(name)}))`, { timeout: 40000 }).catch(() => false)
    if (!added) { fail(short, 'the SolidOS Browser did not add it'); return }
    await sleep(6000)
    const seen = await page.evaluate(() => ({ wide: document.documentElement.scrollWidth > innerWidth, drawn: document.getElementById('OutlineView')?.childElementCount > 0 }))
    await page.screenshot(path.join(HERE, 'shots', `pane-${name}-400.png`))
    if (!seen.drawn) fail(short, 'nothing is drawn for its sample')
    else if (seen.wide) fail(short, 'the page scrolls sideways at 400 px with its sample')
    else pass(short, 'added by the SolidOS Browser and fits at 400 px with its sample')
  } catch (error) { fail(short, 'sample check: ' + (error && error.message ? error.message : error)) } finally { await page.close(); rmSync(profile, { recursive: true, force: true }) }
}

let targets
if (process.argv[2]) targets = [[process.argv[2], process.argv[3] || '']]
else {
  const doc = JSON.parse(readFileSync(path.join(ROOT, 'catalogue.jsonld'), 'utf8'))
  targets = doc['@graph'].filter(node => [].concat(node['@type'] || []).includes('panes:PaneModuleInvocation')).map(node => [node['schema:url'], SAMPLES[node['schema:url']] || ''])
}
mkdirSync(path.join(HERE, 'shots'), { recursive: true })
const server = await serve()
for (const [address, sample] of targets) {
  const short = await file(address)
  if (!short) continue
  const page = await launch({ port: 9349, width: 1300, height: 900 })
  let name = ''
  try { name = await contract(page, server.base, address, short) } catch (error) { fail(short, 'browser check: ' + (error && error.message ? error.message : error)) } finally { await page.close() }
  if (!name) continue
  if (sample) await draws(address, sample, short, name)
  else note(short, 'no sample given, so it was not tried in the SolidOS Browser')
}
server.close()
console.log(`\n${targets.length} pane(s): ${failures} failure(s), ${notes} note(s)`)
process.exit(failures ? 1 : 0)
