import http from 'node:http'
import { packContainer, type PackInput } from './packing.js'
import { getPreset } from './containers.js'

export const ENGINE_VERSION = 'container-1.0.0'
const PORT = Number(process.env.PORT || 3100)

function readBody(req: http.IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    req.on('data', (c) => chunks.push(c))
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    req.on('error', reject)
  })
}

function json(res: http.ServerResponse, status: number, body: unknown) {
  const raw = JSON.stringify(body)
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(raw),
  })
  res.end(raw)
}

const server = http.createServer(async (req, res) => {
  const url = req.url || '/'
  if (req.method === 'GET' && (url === '/health' || url === '/health/')) {
    json(res, 200, { ok: true, engineVersion: ENGINE_VERSION })
    return
  }
  if (req.method === 'POST' && (url === '/v1/pack/container' || url === '/v1/pack/container/')) {
    try {
      const raw = await readBody(req)
      const body = JSON.parse(raw || '{}') as {
        container?: PackInput['container'] & { presetId?: string }
        skus?: PackInput['skus']
        params?: { containerPreset?: string; allowRotate?: boolean }
      }
      let container = body.container
      const presetId = body.params?.containerPreset || body.container?.presetId
      if ((!container || !container.length) && presetId) {
        const p = getPreset(presetId)
        container = {
          length: p.length,
          width: p.width,
          height: p.height,
          maxPayload: p.maxPayload,
        }
      }
      if (!container || !Array.isArray(body.skus)) {
        json(res, 400, { ok: false, code: 'BAD_REQUEST', message: 'container and skus required' })
        return
      }
      const allowDefault = body.params?.allowRotate !== false
      const skus = body.skus.map((s, i) => ({
        ...s,
        allowRotate: s.allowRotate ?? allowDefault,
        stackable: s.stackable ?? true,
        color: s.color || `#${((i * 47) % 200) + 30}7490`,
      }))
      const result = packContainer({ container, skus })
      json(res, 200, {
        ok: true,
        engineVersion: ENGINE_VERSION,
        serverVerified: true,
        result,
      })
    } catch (err) {
      json(res, 500, {
        ok: false,
        code: 'ENGINE_ERROR',
        message: err instanceof Error ? err.message : String(err),
      })
    }
    return
  }
  json(res, 404, { ok: false, code: 'NOT_FOUND', message: 'Not found' })
})

server.listen(PORT, '0.0.0.0', () => {
  // eslint-disable-next-line no-console
  console.log(`engine-ts ${ENGINE_VERSION} listening on ${PORT}`)
})
