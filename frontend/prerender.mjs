/**
 * Post-build prerender of the PUBLIC marketing pages to real HTML, so Google /
 * social crawlers get content instead of an empty SPA shell. The dashboard stays
 * a client-side SPA. Best-effort: if Chromium can't launch, it logs and exits 0
 * so the build still succeeds with the normal SPA output (no regression).
 *
 * Runs after `vite build` (see package.json). Serves dist/ locally, renders each
 * route in headless Chromium, and writes dist/<route>/index.html.
 */
import { createServer } from 'http'
import { readFile, mkdir, writeFile } from 'fs/promises'
import { join, extname, dirname } from 'path'

const DIST = 'dist'
const PORT = 5099
// Public, indexable pages only. NOT the dashboard/app or the (already-static) blog.
const ROUTES = ['/', '/pricing', '/about', '/security', '/contact', '/privacy', '/terms']

const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.woff': 'font/woff', '.woff2': 'font/woff2',
  '.webp': 'image/webp', '.txt': 'text/plain', '.xml': 'application/xml', '.map': 'application/json',
}

function startServer() {
  return new Promise((resolve) => {
    const server = createServer(async (req, res) => {
      const p = decodeURIComponent((req.url || '/').split('?')[0])
      let file = join(DIST, p)
      try {
        if (!extname(file)) file = join(DIST, 'index.html') // SPA route -> shell
        const data = await readFile(file)
        res.writeHead(200, { 'Content-Type': MIME[extname(file)] || 'application/octet-stream' })
        res.end(data)
      } catch {
        try {
          const data = await readFile(join(DIST, 'index.html'))
          res.writeHead(200, { 'Content-Type': 'text/html' }); res.end(data)
        } catch { res.writeHead(404); res.end() }
      }
    })
    server.listen(PORT, () => resolve(server))
  })
}

async function main() {
  let puppeteer
  try { puppeteer = (await import('puppeteer')).default }
  catch { console.warn('[prerender] puppeteer not installed — skipping'); return }

  const server = await startServer()
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu'] })
  let done = 0
  for (const route of ROUTES) {
    try {
      const page = await browser.newPage()
      await page.setViewport({ width: 1280, height: 900 })
      await page.goto(`http://localhost:${PORT}${route}`, { waitUntil: 'networkidle2', timeout: 30000 })
      await page.waitForSelector('#root > *', { timeout: 12000 }).catch(() => {})
      await new Promise(r => setTimeout(r, 400)) // let reveal/content settle
      const html = await page.content()
      const outFile = route === '/' ? join(DIST, 'index.html') : join(DIST, route, 'index.html')
      await mkdir(dirname(outFile), { recursive: true })
      await writeFile(outFile, html)
      console.log(`[prerender] ${route} -> ${outFile} (${(html.length / 1024).toFixed(1)} kB)`)
      done++
      await page.close()
    } catch (e) {
      console.warn(`[prerender] ${route} failed: ${e.message}`)
    }
  }
  await browser.close()
  server.close()
  console.log(`[prerender] done: ${done}/${ROUTES.length} pages`)
}

main().catch((e) => { console.warn('[prerender] skipped:', e.message) }).finally(() => process.exit(0))
