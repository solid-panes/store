// Serve this repo's folder on a spare local port, for the tests that need a page.
import { createServer } from 'node:http'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

export const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const TYPES = { '.html': 'text/html; charset=utf-8', '.jsonld': 'application/ld+json', '.js': 'text/javascript', '.mjs': 'text/javascript' }

export async function serve () {
  const server = createServer((request, response) => {
    const name = decodeURIComponent(new URL(request.url, 'http://x').pathname).replace(/^\/+/, '') || 'index.html'
    try {
      if (name.includes('..')) throw new Error('no')
      const body = readFileSync(path.join(ROOT, name))
      response.writeHead(200, { 'content-type': TYPES[path.extname(name)] || 'application/octet-stream' }); response.end(body)
    } catch { response.writeHead(404); response.end('not found') }
  })
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  return { base: `http://127.0.0.1:${server.address().port}/`, close: () => server.close() }
}
