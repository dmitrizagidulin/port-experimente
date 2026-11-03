import { describe, expect, it } from 'vitest'
import { rltpBeekemDatarooms, type LiveMember, type RoomConfig } from '../src/candidates/datarooms'

// E16 transport logic without the VTI stack: a host of the test's own answers
// the `rooms/*` trust tasks the candidate sends, members are stand-ins whose
// seal is base64 of the plaintext. What is under test is the carrier hull:
// the listing cursor, the retry of a host that is away for a moment, and the
// room-wide version a seal is bound to (review #90 B1 and the CodeRabbit
// findings). The BeeKEM candidate underneath is the real one.

const HOST = 'did:test:host'
const ROOM = 'did:test:room'
const b64 = (b: Uint8Array) => Buffer.from(b).toString('base64')
const unb64 = (s: string) => new Uint8Array(Buffer.from(s, 'base64'))

function member(n: number): LiveMember {
  const did = `did:key:test${n}`
  const identity = {
    did,
    present: (_vac: string, _vmc: string, action: string) => JSON.stringify({ action, did }),
    signDocument: (doc: string) => doc,
    snapshot: () => '',
    free() {},
  }
  const roomMember = {
    epoch: 1,
    roomId: ROOM,
    sealRecord: (key: string, version: bigint, plain: Uint8Array) => JSON.stringify({ key, version: Number(version), epoch: 1, body: b64(plain) }),
    openRecord: (key: string, version: bigint, sealed: string) => {
      const o = JSON.parse(sealed) as { key: string; version: number; body: string }
      if (o.key !== key || o.version !== Number(version)) throw new Error('record did not open: it was sealed under a different key, epoch, or location')
      return unb64(o.body)
    },
    applyCommit: () => '',
    addLinks: () => {},
    earliestReadableEpoch: () => 1,
    snapshot: () => '',
    free() {},
  }
  return { identity, member: roomMember, vmc: '', vac: '' } as unknown as LiveMember
}

interface Rec { key: string; version: number; author: string; sealed: Record<string, unknown> }

/** A host with the room's semantics the candidate relies on: room-wide versions, pages of `limit`, a cursor, `prefix` and `sinceVersion`. */
function host(opts: { pageSize?: number; failGet?: (key: string, attempt: number) => number | undefined; storeAt?: (version: number) => number } = {}) {
  const records: Rec[] = []
  const getAttempts = new Map<string, number>()
  const calls = { list: 0, get: 0, put: 0 }
  const reply = (doc: { id: string }, status: number, payload: unknown) =>
    new Response(JSON.stringify(status === 200 ? { type: 'x#response', issuer: HOST, threadId: doc.id, payload } : { error: 'unavailable', status }), { status, headers: { 'content-type': 'application/json' } })
  const fetchImpl: typeof fetch = async (_url, init) => {
    const doc = JSON.parse(String(init?.body)) as { id: string; type: string; payload: Record<string, unknown> }
    const type = doc.type.replace('https://trusttasks.org/spec/rooms/', '')
    const p = doc.payload
    if (type === 'epoch/chain/0.1') return reply(doc, 200, { links: [] })
    if (type === 'epoch/commits/0.1') return reply(doc, 200, { commits: [], roomEpoch: 1 })
    if (type === 'records/list/0.1') {
      calls.list++
      const size = opts.pageSize ?? 500
      let rows = records.filter((r) => (!p.prefix || r.key.startsWith(p.prefix as string)) && (!p.sinceVersion || r.version > (p.sinceVersion as number))).sort((a, b) => a.version - b.version)
      const start = p.cursor ? Number(p.cursor) : 0
      const page = rows.slice(start, start + size)
      rows = page
      const next = start + size < records.filter((r) => (!p.prefix || r.key.startsWith(p.prefix as string)) && (!p.sinceVersion || r.version > (p.sinceVersion as number))).length ? String(start + size) : undefined
      return reply(doc, 200, { records: rows.map((r) => ({ key: r.key, version: r.version, author: r.author, sealed: { epoch: 1 } })), ...(next ? { cursor: next } : {}) })
    }
    if (type === 'records/get/0.1') {
      calls.get++
      const key = p.key as string
      const attempt = (getAttempts.get(key) ?? 0) + 1
      getAttempts.set(key, attempt)
      const fail = opts.failGet?.(key, attempt)
      if (fail) return reply(doc, fail, null)
      const r = records.find((x) => x.key === key)
      if (!r) return reply(doc, 404, null)
      return reply(doc, 200, { key: r.key, version: r.version, author: r.author, sealed: { ...r.sealed, version: r.version } })
    }
    if (type === 'records/put/0.1') {
      calls.put++
      const head = records.reduce((m, r) => Math.max(m, r.version), 0)
      const version = opts.storeAt ? opts.storeAt(head + 1) : head + 1
      records.push({ key: p.key as string, version, author: doc.payload.presentation ? (JSON.parse(JSON.stringify(p.presentation)) as { did: string }).did : '', sealed: p.sealed as Record<string, unknown> })
      return reply(doc, 200, { key: p.key, version, epoch: 1 })
    }
    return reply(doc, 400, null)
  }
  return { fetchImpl, records, getAttempts, calls }
}

const room: RoomConfig = { roomDid: ROOM, roomSigningKey: `${ROOM}#key-1`, roomKeyHex: '00', hostDid: HOST, hostUrl: 'http://host.test/v1/trust-tasks', owner: 'did:test:alice', pnmHome: '/nonexistent' }

async function group(h: ReturnType<typeof host>) {
  const c = await rltpBeekemDatarooms({ fetch: h.fetchImpl, pool: [member(1), member(2), member(3)], room })
  await c.addDevice('alice', 'alice')
  await c.addDevice('bob', 'bob')
  await c.createGroup('alice')
  await c.transport!.settle()
  await c.addMember('alice', 'bob', 'member')
  await c.transport!.settle()
  return c
}

describe('E16 transport hull against a host of its own', () => {
  it('delivers over pages of 2 and keeps the room-wide head', async () => {
    const h = host({ pageSize: 2 })
    const c = await group(h)
    await c.transport!.write('alice', 'eins')
    await c.transport!.write('alice', 'zwei')
    await c.transport!.settle()
    expect(c.transport!.read('bob')).toEqual(['eins', 'zwei'])
    expect(c.room.stats.versionMismatches).toBe(0)
  })

  it('a record whose fetch fails once is delivered on the next settle, not skipped (B1)', async () => {
    let target: string | undefined
    // Every get of the target fails four times (past the hull's own three retries), then the host is healthy.
    const h = host({ failGet: (key, attempt) => (key === target && attempt <= 4 ? 503 : undefined) })
    const c = await group(h)
    await c.transport!.write('alice', 'hallo')
    target = h.records[h.records.length - 1]!.key
    await expect(c.transport!.settle()).rejects.toThrow(/503/)
    expect(c.transport!.read('bob')).toEqual([])
    await c.transport!.settle()
    expect(c.transport!.read('bob')).toEqual(['hallo'])
    expect(h.getAttempts.get(target) ?? 0).toBeGreaterThanOrEqual(5)
  })

  it('the same with the carrier delivering in reverse order', async () => {
    let target: string | undefined
    const h = host({ failGet: (key, attempt) => (key === target && attempt <= 4 ? 503 : undefined) })
    const c = await group(h)
    await c.transport!.write('alice', 'eins')
    await c.transport!.settle()
    c.transport!.faults!.reverse(true)
    await c.transport!.write('alice', 'zwei')
    await c.transport!.write('alice', 'drei')
    target = h.records[h.records.length - 2]!.key // the lower of the two new records fails; the higher one is processed first
    await expect(c.transport!.settle()).rejects.toThrow(/503/)
    await c.transport!.settle()
    expect(c.transport!.read('bob')).toEqual(['drei', 'eins', 'zwei'])
  })

  it('a single 503 is retried by the hull without the caller noticing', async () => {
    let target: string | undefined
    const h = host({ failGet: (key, attempt) => (key === target && attempt === 1 ? 503 : undefined) })
    const c = await group(h)
    await c.transport!.write('alice', 'hallo')
    target = h.records[h.records.length - 1]!.key
    await c.transport!.settle()
    expect(c.transport!.read('bob')).toEqual(['hallo'])
    expect(c.room.stats.transientRetries).toBe(1)
  })

  it('a record the host stores under another version than the seal is sealed again', async () => {
    let skew = 0
    const h = host({ storeAt: (v) => v + skew })
    const c = await group(h)
    skew = 1 // a write by someone else landed in between: the host's head is one above what the device read
    await c.transport!.write('alice', 'hallo')
    skew = 0
    await c.transport!.settle()
    expect(c.transport!.read('bob')).toEqual(['hallo'])
    expect(c.room.stats.versionMismatches).toBeGreaterThanOrEqual(1)
  })
})
