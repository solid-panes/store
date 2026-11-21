// The catalogue is well formed: every entry is complete and safe to copy into an index.
//   node tests/catalogue.mjs          checks the file
//   node tests/catalogue.mjs --live   also fetches every pane file and expects JavaScript
import { readFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
let failures = 0
const check = (name, ok, detail = '') => { if (!ok) failures++; console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ` (${detail})` : ''}`) }
const one = (value) => Array.isArray(value) ? value[0] : value
const ref = (value) => { const v = one(value); return v && typeof v === 'object' ? v['@id'] : v }
const types = (node) => [].concat((node && node['@type']) || [])
const https = (address) => { try { const u = new URL(address); return u.protocol === 'https:' && !u.username && !u.password } catch { return false } }

const text = readFileSync(path.join(ROOT, 'catalogue.jsonld'), 'utf8')
const doc = JSON.parse(text)
const nodes = new Map(doc['@graph'].map(node => [node['@id'], node]))
check('no node is defined twice', nodes.size === doc['@graph'].length)
const index = doc['@graph'].find(node => types(node).includes('tools:ToolIndex'))
check('there is one index', !!index)
const links = [].concat(index['tools:registration'] || []).map(link => link['@id'])
check('the index lists entries', links.length > 0, links.length + ' entries')

const bad = []
const names = new Set()
const addresses = new Set()
const panes = []
for (const id of links) {
  const entry = nodes.get(id)
  const say = (what) => bad.push((entry && entry['schema:name'] ? entry['schema:name'] : id) + ': ' + what)
  if (!entry) { say('listed but not defined'); continue }
  const name = entry['schema:name']
  if (!name) say('no name')
  if (names.has(name)) say('name used twice')
  names.add(name)
  if (!entry['schema:description']) say('no description')
  const capability = nodes.get(ref(entry['ac:capability']))
  if (!capability) { say('no capability'); continue }
  if (ref(capability['ac:action']) !== 'odrl:display') say('action is not odrl:display')
  const invocation = nodes.get(ref(capability['ac:invocation']))
  if (!invocation) { say('no invocation'); continue }
  const kind = types(invocation)
  let address = ''
  if (kind.includes('panes:PaneModuleInvocation')) {
    address = invocation['schema:url']
    if (!https(address)) say('pane address is not https')
    else if (!/\.m?js$/.test(new URL(address).pathname)) say('pane address is not a .js file')
    if (!entry['schema:author']) say('pane has no author')
    if (!entry['schema:license']) say('pane has no licence')
    panes.push(address)
  } else if (kind.includes('ac:UriTemplateInvocation')) {
    address = invocation['hydra:template']
    if (!https(String(address).split('{url}').join('x'))) say('app link pattern is not https')
    if (!String(address).includes('{url}')) say('app link pattern has no {url}')
    if (/\{(?!url\})/.test(String(address))) say('app link pattern uses a form the reader does not understand')
    const mapping = nodes.get(ref(invocation['hydra:mapping']))
    if (!mapping || mapping['hydra:variable'] !== 'url') say('app mapping does not name the variable url')
    const forType = ref(capability['ac:resourceType'])
    if (forType && !/^https?:\/\//.test(forType)) say('type is not a full address')
  } else say('unknown kind of invocation')
  if (addresses.has(address)) say('address used twice')
  addresses.add(address)
  const home = ref(entry['schema:mainEntityOfPage'])
  if (home && !https(home)) say('home page is not https')
}
check('every entry is complete', bad.length === 0, bad.join(' ; '))
check('nothing is defined but left out of the index', doc['@graph'].filter(node => types(node).some(t => /Registration$/.test(t))).every(node => links.includes(node['@id'])))

// The file is what build.mjs writes: nobody edited it by hand.
const built = execFileSync(process.execPath, ['-e', `
  const fs = require('node:fs'); const write = fs.writeFileSync
  fs.writeFileSync = (file, data) => { if (String(file).includes('catalogue.jsonld')) process.stdout.write(data); else write(file, data) }
  console.log = () => {}
  import(${JSON.stringify(path.join(ROOT, 'build.mjs'))})
`], { encoding: 'utf8' })
check('catalogue.jsonld is what build.mjs writes', built === text)

if (process.argv.includes('--live')) {
  for (const address of panes) {
    const response = await fetch(address).catch(() => null)
    const type = response ? response.headers.get('content-type') || '' : ''
    check('live: ' + address, !!response && response.ok && /javascript/.test(type), response ? response.status + ' ' + type : 'not reached')
  }
}
console.log(failures ? `\n${failures} failure(s)` : '\nall passed')
process.exit(failures ? 1 : 0)
