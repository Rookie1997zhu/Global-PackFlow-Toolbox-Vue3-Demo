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
