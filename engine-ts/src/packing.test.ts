import assert from 'node:assert/strict'
import { test } from 'node:test'
import { packContainer } from './packing.js'
import { getPreset } from './containers.js'

test('packs a single SKU into 40HQ', () => {
  const c = getPreset('40HQ')
  const result = packContainer({
    container: { length: c.length, width: c.width, height: c.height, maxPayload: c.maxPayload },
    skus: [
      {
        id: 'a',
        name: 'SKU-A',
        length: 420,
        width: 320,
        height: 280,
        weight: 7.5,
        qty: 10,
        allowRotate: true,
        stackable: true,
        color: '#0e7490',
      },
    ],
  })
  assert.equal(result.packedCount, 10)
  assert.equal(result.unplaced.length, 0)
  assert.ok(result.volumeUtilPct > 0)
})

test('PF-003 mixed constraints: non-stackable top must not receive stacked box', async () => {
  const fs = await import('node:fs')
  const path = await import('node:path')
  const { fileURLToPath } = await import('node:url')
  const here = path.dirname(fileURLToPath(import.meta.url))
  const fx = JSON.parse(
    fs.readFileSync(path.join(here, '../fixtures/container-mixed-constraints.json'), 'utf8'),
  )
  const c = getPreset(fx.containerPreset)
  const result = packContainer({
    container: { length: c.length, width: c.width, height: c.height, maxPayload: c.maxPayload },
    skus: fx.skus,
  })
  const aPlaced = result.placements.filter((p) => p.skuId === 'A')
  const bPlaced = result.placements.filter((p) => p.skuId === 'B')
  for (const a of aPlaced) {
    assert.ok(String(a.unitId).endsWith('!'), 'non-stackable A unitId must end with !')
    for (const b of bPlaced) {
      const overlapX = b.x < a.x + a.l && b.x + b.l > a.x
      const overlapY = b.y < a.y + a.w && b.y + b.w > a.y
      const onTop = Math.abs(b.z - (a.z + a.h)) < 1e-6
      assert.equal(overlapX && overlapY && onTop, false, 'B must not stack on non-stackable A')
    }
  }
})

test('PF-003 allowRotate false never swaps L/W', () => {
  const c = getPreset('40HQ')
  const result = packContainer({
    container: { length: c.length, width: c.width, height: c.height, maxPayload: c.maxPayload },
    skus: [
      {
        id: 'nr',
        name: 'NoRotate',
        length: 800,
        width: 400,
        height: 300,
        weight: 5,
        qty: 4,
        allowRotate: false,
        stackable: true,
        color: '#111',
      },
    ],
  })
  for (const p of result.placements) {
    assert.equal(p.rotated, false)
    assert.equal(p.l, 800)
    assert.equal(p.w, 400)
  }
})

test('PF-003 only-fits-rotated with allowRotate false goes unplaced', () => {
  // Container 500x500x500; box 600x400x300 only fits if rotated to 400x600 ¡ª still too wide unless rotate to 400 along length.
  // Use a tight container: L=500 W=450 H=400; box L=480 W=460 H=300 ¡ª without rotate cannot fit (460>450), with rotate L=460 W=480 still 480>450.
  // Better: container 1000x500x500; box 900x600x400 ¡ª without rotate W=600>500; with rotate L=600 W=900 fits in L.
  const result = packContainer({
    container: { length: 1000, width: 500, height: 500, maxPayload: 5000 },
    skus: [
      {
        id: 'tight',
        name: 'NeedsRotate',
        length: 900,
        width: 600,
        height: 400,
        weight: 10,
        qty: 1,
        allowRotate: false,
        stackable: true,
        color: '#222',
      },
    ],
  })
  assert.equal(result.packedCount, 0)
  assert.equal(result.unplaced.length, 1)
  assert.ok(
    result.unplaced[0].reason === 'errContainerPartTooLarge' ||
      String(result.unplaced[0].reason || '').includes('TooLarge') ||
      result.unplaced[0].qty === 1,
  )
})
