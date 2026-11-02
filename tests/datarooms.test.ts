import { describe, expect, it } from 'vitest'
import { existsSync } from 'node:fs'
import { runAll } from '../src/lab/scenarios'
import { runCarrier } from '../src/lab/traeger'

// E16 step 1: an OpenVTC Data Room as the blind carrier of an RLTP group. Needs
// the local VTI stack (rltp/design/openvtc-local-stack/provision-e16.sh) and a
// pool of admitted members; skipped where /tmp/vdr/e16/room.json is absent.
const ROOM = process.env.E16_ROOM ?? '/tmp/vdr/e16/room.json'
const d = describe.skipIf(!existsSync(ROOM))

d('E16: RLTP über BeeKEM auf einem OpenVTC Data Room', () => {
  it('Basislinie je Szenario', async () => {
    const { rltpBeekemDatarooms } = await import('../src/candidates/datarooms')
    const results = await runAll(rltpBeekemDatarooms)
    const byId = Object.fromEntries(results.map((r) => [r.scenario, r.outcome]))
    expect(byId, JSON.stringify(results, null, 1)).toEqual({
      S1: 'bestanden',
      S2: 'bestanden',
      S3: 'bestanden',
      S4a: 'bestanden',
      S4b: 'bestanden',
      S4c: 'bestanden',
      S4c2: 'bestanden',
      S4d: 'bestanden',
      S4e: 'bestanden',
      S4f: 'bestanden',
      S4j: 'bestanden',
      S5: 'bestanden',
      S5b: 'nicht abbildbar',
      S5c: 'bestanden',
      S6: 'bestanden',
      S6b: 'bestanden',
      S7: 'nicht abbildbar',
      S8: 'bestanden',
      S11: 'nicht abbildbar',
      S10a: 'nicht abbildbar',
      S10b: 'nicht abbildbar',
      S10c: 'nicht abbildbar',
    })
  }, 1_800_000)

  it('Träger-Prüfstand: T-Szenarien über den echten Host', async () => {
    const { rltpBeekemDatarooms } = await import('../src/candidates/datarooms')
    const results = await runCarrier(rltpBeekemDatarooms)
    const byId = Object.fromEntries(results.map((r) => [r.scenario, r.outcome]))
    expect(byId, JSON.stringify(results, null, 1)).toEqual({
      T1: 'bestanden',
      T2: 'bestanden',
      T3: 'bestanden',
      T4: 'bestanden',
      T5: 'bestanden',
      T6: 'bestanden',
      T6b: 'nicht bestanden',
      T7: 'bestanden',
      T8: 'nicht abbildbar',
      T11: 'nicht abbildbar',
      T12: 'bestanden',
    })
  }, 1_800_000)
})
