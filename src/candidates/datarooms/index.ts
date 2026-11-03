import * as Y from 'yjs'
import { readFileSync, readdirSync, existsSync, writeFileSync, mkdirSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import type { Candidate, Capability, CarrierFaults, Device, Msg, Person } from '../../lab/types'
import { rltpBeekem } from '../rltp-beekem'

// E16 step 1: an OpenVTC Data Room as the BLIND carrier of an RLTP group. The
// BeeKEM candidate (E6–E9) is unchanged; only the transport changes, as in E12
// (PWS): every device seals each of its frames as a room record and reads the
// others' records back. The room's host (a VTC) stores ciphertext, answers
// `rooms/*` trust tasks and holds no key; the room's owner (a bench VTA,
// "Alice") admitted every device as a member once. Membership of the room is
// only access to the store. Authority stays in the RLTP log; removal from the
// group acts through the key epoch (KV1), never at the room.
//
// Devices are `vti-rooms-wasm` members running in Node (no VTA, no browser):
// `Identity` signs the trust-task documents, `RoomMember` holds the MLS leaf,
// seals and opens records and applies the room's commits. Admitting a member
// needs the owner's VTA (`pnm rooms owner invite|group-add|issue-*`), so a
// pool of admitted identities is prepared once (`/tmp/vdr/e16/pool`) and the
// bench hands them to devices; when the pool runs dry, the candidate admits a
// fresh identity through `pnm`, which is slow and rate-limited at the VTA.
//
// Records are keyed `<run>/<device>/<seq>`; one run = one candidate instance,
// so several groups share one room without seeing each other's keys (the
// `prefix` filter of `rooms/records/list`). Versions are room-wide (head + 1,
// the seal is bound to the number), so two devices writing at once collide
// and one of them retries: that is measured (`stats.versionRetries`). The
// host sees record keys, authors (did:key), versions, epochs, sizes and
// times; never a frame. Port notes: NOTES.md.

import type { Identity, RoomMember } from './pkg/vti_rooms_wasm.js'

type Wasm = typeof import('./pkg/vti_rooms_wasm.js')
let wasm: Wasm | undefined
async function loadWasm(): Promise<Wasm> {
  return (wasm ??= await import('./pkg/vti_rooms_wasm.js'))
}

interface RoomConfig {
  roomDid: string
  roomSigningKey: string
  roomKeyHex: string
  hostDid: string
  hostUrl: string
  owner: string
  pnmHome: string
}

interface PoolMember {
  did: string
  identity: string
  member: string
  epoch: number
  vmc: string
  vac: string
}

const ROOM_FILE = process.env.E16_ROOM ?? '/tmp/vdr/e16/room.json'
const POOL_DIR = process.env.E16_POOL ?? '/tmp/vdr/e16/pool'
const PNM_PATH = process.env.E16_PNM_PATH ?? '/home/fritz/workspace/workspace/openvtc-stack/vti/target/release'

export function dataroomsAvailable(): boolean {
  return existsSync(ROOM_FILE)
}

const enc = new TextEncoder()
const dec = new TextDecoder()
const b64 = (b: Uint8Array) => Buffer.from(b).toString('base64')
const unb64 = (s: string) => new Uint8Array(Buffer.from(s, 'base64'))
const b64url = (s: string) => {
  s = s.replace(/-/g, '+').replace(/_/g, '/')
  while (s.length % 4) s += '='
  return new Uint8Array(Buffer.from(s, 'base64'))
}
const hex = (h: string) => Uint8Array.from(h.match(/../g)!.map((x) => parseInt(x, 16)))
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/**
 * The pool of admitted identities. Live member objects are handed to devices and
 * taken back when a candidate instance is disposed: membership of the room is
 * permanent, the MLS state moves on with every commit, and runs never read each
 * other's records (the key prefix). So one admitted identity serves many scenarios.
 */
type LiveMember = { identity: Identity; member: RoomMember; vmc: string; vac: string }
let poolLive: LiveMember[] | undefined
function pool(W: Wasm): LiveMember[] {
  if (!poolLive) {
    poolLive = existsSync(POOL_DIR)
      ? readdirSync(POOL_DIR)
          .filter((f) => /^m\d+\.json$/.test(f))
          .sort()
          .map((f) => JSON.parse(readFileSync(`${POOL_DIR}/${f}`, 'utf8')) as PoolMember)
          .map((m) => ({ identity: W.Identity.restore(m.identity), member: W.RoomMember.restore(m.member), vmc: m.vmc, vac: m.vac }))
      : []
  }
  return poolLive
}

interface Frame {
  from: Device
  label: string
  b: string
}

interface DeviceState {
  person: Person
  online: boolean
  doc: Y.Doc
  identity: Identity
  member: RoomMember
  vmc: string
  vac: string
  synced: boolean
  outbox: Array<{ label: string; body: Uint8Array }>
  seq: number
  /** Highest room version this device has listed; the next list starts above it. */
  sinceVersion: number
  lastError?: string
  seen: Set<string>
  held: Map<string, Msg>
  /** Records listed for this device and not yet processed: the listing cursor moves past them, this map holds them until they are delivered, withheld or given up. */
  pending: Map<string, Listed>
}

type Listed = { key: string; version: number; author: string; sealed?: { epoch?: number; version?: number } }

const LOCAL = Symbol('local')

export interface DataroomsOptions {
  readonly label?: string
  /** Test seams: a host (HTTP) of the test's own, members of the test's own, a room config instead of the file. */
  readonly fetch?: typeof fetch
  readonly pool?: LiveMember[]
  readonly room?: RoomConfig
}

export type { LiveMember, RoomConfig }

export async function rltpBeekemDatarooms(options: DataroomsOptions = {}): Promise<Candidate & { room: DataroomsHandle }> {
  const W = options.pool ? undefined : await loadWasm()
  const cfg = options.room ?? (JSON.parse(readFileSync(ROOM_FILE, 'utf8')) as RoomConfig)
  const doFetch = options.fetch ?? fetch
  const roomKey = hex(cfg.roomKeyHex)
  const inner = rltpBeekem()
  const run = randomUUID().slice(0, 8)
  const devices = new Map<Device, DeviceState>()
  let idle = 0
  const stats = { puts: 0, lists: 0, gets: 0, commitsApplied: 0, versionRetries: 0, versionMismatches: 0, bytesUp: 0, admittedFresh: 0, rateLimited: 0, rateLimitWaitMs: 0, transientRetries: 0 }
  const limiters = new Set<string>()
  const notes: string[] = []

  const faultState = { drop: [] as Array<(m: Msg) => boolean>, withhold: [] as Array<{ device: Device; match: (m: Msg) => boolean }>, reverse: false, duplicate: false, tamper: [] as Array<{ match: (m: Msg) => boolean; mutate: (b: Uint8Array) => Uint8Array }> }
  let carriedId = 0
  let replaySeq = 0
  /** What the host holds: the sealed record as bytes (T12 reads this). */
  const carriedLog: Msg[] = []
  /** The frames behind the sealed records, for `visible()` and for replay. */
  const sealedByKey = new Map<string, { sealed: string; frame: Frame }>()

  const dev = (d: Device) => {
    const s = devices.get(d)
    if (!s) throw new Error(`unknown device ${d}`)
    return s
  }

  async function timed<T>(f: () => Promise<T>): Promise<T> {
    const t = performance.now()
    try {
      return await f()
    } finally {
      idle += performance.now() - t
    }
  }

  // ── Trust tasks to the host ───────────────────────────────────────────────
  async function task<T = Record<string, unknown>>(s: DeviceState, type: string, payload: Record<string, unknown>): Promise<T> {
    const doc = { id: 'urn:uuid:' + randomUUID(), type: `https://trusttasks.org/spec/rooms/${type}`, issuer: s.identity.did, recipient: cfg.hostDid, issuedAt: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'), payload }
    const signed = s.identity.signDocument(JSON.stringify(doc))
    return timed(async () => {
      for (let attempt = 0; ; attempt++) {
        let res: Response
        try {
          res = await doFetch(cfg.hostUrl, { method: 'POST', headers: { 'content-type': 'application/json' }, body: signed })
        } catch (e) {
          // No answer at all (connection refused, reset): a few tries, then the caller sees the error and the frame stays pending.
          if (attempt >= 3) throw new HostError(0, 'network', String(e))
          stats.transientRetries++
          await sleep(250 * (attempt + 1))
          continue
        }
        if ((res.status === 502 || res.status === 503 || res.status === 504) && attempt < 3) {
          await res.text().catch(() => '')
          stats.transientRetries++
          await sleep(250 * (attempt + 1))
          continue
        }
        const text = await res.text()
        let reply: { type?: string; issuer?: string; threadId?: string; payload?: { code?: string } & Record<string, unknown>; error?: string; limiter?: string; retryAfterSecs?: number } = {}
        try {
          reply = JSON.parse(text)
        } catch {
          /* not JSON: handled below */
        }
        if (res.status === 429 && attempt < 20) {
          // The host's budget (VTI rate limits, per address and per presenter): wait as told, then the same document again.
          const wait = Number(res.headers.get('retry-after') ?? reply.retryAfterSecs ?? 1)
          stats.rateLimited++
          stats.rateLimitWaitMs += wait * 1000
          limiters.add(reply.limiter ?? 'unknown')
          await sleep(Math.max(250, wait * 1000))
          continue
        }
        if (!res.ok || String(reply.type ?? '').includes('trust-task-error')) throw new HostError(res.status, reply.payload?.code ?? reply.error ?? '', JSON.stringify(reply.payload ?? reply))
        if (reply.issuer !== cfg.hostDid || reply.threadId !== doc.id) throw new Error('reply not from host or wrong thread')
        return reply.payload as T
      }
    })
  }
  const present = (s: DeviceState, action: 'read' | 'write') => JSON.parse(s.identity.present(s.vac, s.vmc, action, null)) as Record<string, unknown>

  /** Bring a member to the room's current epoch (commits above its own) and let it read earlier epochs (the chain). */
  async function sync(s: DeviceState) {
    const chain = await task<{ links: unknown[] }>(s, 'epoch/chain/0.1', { roomId: cfg.roomDid, presentation: present(s, 'read') })
    s.member.addLinks(JSON.stringify(chain.links))
    for (;;) {
      const c = await task<{ commits: Array<{ epoch: number; commit: string }>; roomEpoch: number }>(s, 'epoch/commits/0.1', { roomId: cfg.roomDid, sinceEpoch: s.member.epoch, presentation: present(s, 'read') })
      for (const x of c.commits) {
        s.member.applyCommit(b64url(x.commit))
        stats.commitsApplied++
      }
      if (c.commits.length === 0 || s.member.epoch >= c.roomEpoch) break
    }
    s.synced = true
  }

  // ── Admission: from the pool, or fresh through the owner's VTA ────────────
  const claimed: LiveMember[] = []
  function claimIdentity(d: Device): LiveMember {
    const live = (options.pool ?? pool(W!)).shift() ?? admitFresh(d)
    claimed.push(live)
    return live
  }
  function admitFresh(d: Device) {
    if (!W) throw new Error('no member left in the test pool')
    const env = { ...process.env, VTA_ALLOW_PRIVATE_ENDPOINTS: '1', PNM_HOME: cfg.pnmHome, PATH: `${PNM_PATH}:${process.env.PATH}` }
    const pnm = (...a: string[]) => {
      for (let t = 0; ; t++) {
        try {
          return execFileSync('pnm', a, { env, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
        } catch (e) {
          if (t >= 5) throw e
          const until = Date.now() + 3000
          while (Date.now() < until) { /* the VTA's did-log rate limit: wait, synchronously */ }
        }
      }
    }
    const identity = W.Identity.mint()
    const tmp = `/tmp/vdr/e16/fresh/${run}-${d}`
    mkdirSync(tmp, { recursive: true })
    pnm('rooms', 'owner', 'invite', '--room', cfg.roomDid, '--signing-key', cfg.roomSigningKey, '--subject', identity.did, '--valid-for', '30d', '--out', `${tmp}/invite.json`)
    const invitation = readFileSync(`${tmp}/invite.json`, 'utf8')
    const minted = W.mintKeyPackage(identity.did, cfg.roomDid, invitation, '[]', roomKey)
    writeFileSync(`${tmp}/kp.b64`, (JSON.parse(minted) as { keyPackage: string }).keyPackage)
    pnm('rooms', 'owner', 'group-add', '--room', cfg.roomDid, '--host-did', cfg.hostDid, '--member', identity.did, '--key-package', `${tmp}/kp.b64`, '--out', `${tmp}/welcome.json`)
    const w = JSON.parse(readFileSync(`${tmp}/welcome.json`, 'utf8')) as { welcome: string }
    const member = W.RoomMember.join(cfg.roomDid, minted, b64url(w.welcome), invitation, '[]', roomKey)
    pnm('rooms', 'owner', 'issue-membership', '--room', cfg.roomDid, '--signing-key', cfg.roomSigningKey, '--subject', identity.did, '--valid-for', '365d', '--out', `${tmp}/vmc.json`)
    pnm('rooms', 'owner', 'issue-authority', '--room', cfg.roomDid, '--signing-key', cfg.roomSigningKey, '--subject', identity.did, '--action', 'read,write', '--valid-for', '90d', '--out', `${tmp}/vac.json`)
    stats.admittedFresh++
    notes.push(`${d}: admitted fresh through the owner's VTA`)
    return { identity, member, vmc: readFileSync(`${tmp}/vmc.json`, 'utf8'), vac: readFileSync(`${tmp}/vac.json`, 'utf8') } as LiveMember
  }

  // ── Encounter channel: cards go device to device, not through the room ───
  const direct: Array<{ msg: Msg; delivered: Set<Device> }> = []
  async function deliverDirect(s: DeviceState, d: Device): Promise<number> {
    if (!s.online) return 0
    let n = 0
    for (const e of direct) {
      if (e.msg.from === d || e.delivered.has(d)) continue
      e.delivered.add(d)
      const { content } = await inner.receive(d, e.msg)
      for (const u of content) Y.applyUpdate(s.doc, u, 'remote')
      n++
    }
    return n
  }

  // ── Push: every pending frame of a device becomes a sealed record ─────────
  /** The room's head version as far as this run has seen it: advanced by every listing and every put. */
  let roomHead = 0
  /** List records above `since` (and under `prefix`), following the host's cursor to its absence (the only end-of-listing signal). */
  async function listAbove(s: DeviceState, since: number, prefix?: string): Promise<Listed[]> {
    const out: Listed[] = []
    let cursor: string | undefined
    for (;;) {
      const page = await task<{ records: Listed[]; cursor?: string }>(s, 'records/list/0.1', { roomId: cfg.roomDid, presentation: present(s, 'read'), ...(prefix ? { prefix } : {}), ...(since ? { sinceVersion: since } : {}), ...(cursor ? { cursor } : {}), limit: 500 })
      stats.lists++
      out.push(...page.records)
      for (const r of page.records) roomHead = Math.max(roomHead, r.version)
      if (!page.cursor) break
      cursor = page.cursor
    }
    return out
  }
  async function headVersion(s: DeviceState): Promise<number> {
    await listAbove(s, roomHead)
    return roomHead
  }

  async function push(s: DeviceState, d: Device): Promise<number> {
    for (const o of inner.takeOutgoing(d)) {
      if (o.direct) direct.push({ msg: { id: ++carriedId, from: d, label: o.label, body: o.body }, delivered: new Set() })
      else s.outbox.push(o)
    }
    if (!s.online) return 0
    if (!s.synced) await sync(s)
    let n = 0
    let head: number | undefined
    while (s.outbox.length) {
      const { label, body: original } = s.outbox[0]!
      const key = `${run}/${d}/${String(s.seq).padStart(6, '0')}`
      const probe: Msg = { id: carriedId + 1, from: d, label, body: original }
      if (faultState.drop.some((r) => r(probe))) {
        notes.push(`carrier swallows ${d}:${label}`)
        s.seq++
        s.outbox.shift()
        s.seen.add(key)
        n++
        continue
      }
      let body = original
      for (const r of faultState.tamper) if (r.match(probe)) body = r.mutate(body)
      const frame: Frame = { from: d, label, b: b64(body) }
      const plain = enc.encode(JSON.stringify(frame))
      // Room-wide version: head + 1, read once per push and advanced locally; re-read on a collision (measured).
      head ??= await headVersion(s)
      let version = head + 1
      let putKey = key
      let stored: { version: number } | undefined
      for (let attempt = 0; attempt < 8 && !stored; attempt++) {
        const sealed = s.member.sealRecord(putKey, BigInt(version), plain)
        try {
          const put = await task<{ version: number }>(s, 'records/put/0.1', { roomId: cfg.roomDid, key: putKey, presentation: present(s, 'write'), expectedVersion: 0, sealed: JSON.parse(sealed) })
          head = put.version
          roomHead = Math.max(roomHead, put.version)
          if (put.version !== version) {
            // The host stored the record under a version other than the one the seal is bound to (a write landed in
            // between): nobody can open it. It stays as garbage under its key; the frame goes again under a fresh key.
            stats.versionMismatches++
            notes.push(`${d}: ${putKey} sealed v${version}, stored v${put.version}; sealed again`)
            version = put.version + 1
            putKey = `${key}.${attempt + 1}`
            continue
          }
          stored = put
          sealedByKey.set(putKey, { sealed, frame })
          carriedLog.push({ id: ++carriedId, from: d, label, body: enc.encode(sealed) })
        } catch (e) {
          if (e instanceof HostError && /epoch|commit/i.test(e.detail)) {
            // The room moved on (a membership change): take the commits, then seal again.
            await sync(s)
            continue
          }
          if (e instanceof HostError && /version/i.test(e.detail)) {
            stats.versionRetries++
            head = await headVersion(s)
            version = head + 1
            continue
          }
          s.lastError = `awaiting-transport: ${(e as Error).message}`
          notes.push(`${d}: ${s.lastError}`)
          return n
        }
      }
      if (!stored) {
        s.lastError = 'awaiting-transport: version race not settled after 8 attempts'
        notes.push(`${d}: ${s.lastError}`)
        return n
      }
      s.lastError = undefined
      s.seq++
      s.outbox.shift()
      s.seen.add(key)
      n++
      stats.puts++
      stats.bytesUp += plain.length
    }
    return n
  }

  // ── Pull: list the run's records above the device's version, open the others' ─
  async function openRecord(s: DeviceState, key: string, version: number, sealed: unknown): Promise<Uint8Array> {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        return s.member.openRecord(key, BigInt(version), JSON.stringify(sealed))
      } catch (e) {
        if (attempt < 2 && /epoch|commit/i.test(String(e))) {
          await sync(s)
          continue
        }
        throw e
      }
    }
    throw new Error('unreachable')
  }

  async function pull(s: DeviceState, d: Device): Promise<number> {
    let n = await deliverDirect(s, d)
    if (!s.online) return n
    if (!s.synced) await sync(s)
    const withheld = (msg: Msg) => faultState.withhold.some((r) => r.device === d && r.match(msg))
    const deliver = async (key: string, msg: Msg) => {
      s.seen.add(key)
      for (let k = 0; k < (faultState.duplicate ? 2 : 1); k++) {
        const { content } = await inner.receive(d, msg)
        for (const u of content) Y.applyUpdate(s.doc, u, 'remote')
      }
      n++
    }
    for (const [key, msg] of [...s.held]) {
      if (withheld(msg)) continue
      s.held.delete(key)
      if (!s.seen.has(key)) await deliver(key, msg)
    }
    // List above the cursor and remember every new record before the cursor moves: a failed fetch or a
    // host that is away for a moment must not skip a record for good (review #90 B1).
    const listed = await listAbove(s, s.sinceVersion, `${run}/`)
    for (const r of listed) {
      if (r.version > s.sinceVersion && !s.seen.has(r.key) && !s.pending.has(r.key)) s.pending.set(r.key, r)
      s.sinceVersion = Math.max(s.sinceVersion, r.version)
    }
    const todo = [...s.pending.values()].sort((a, b) => a.version - b.version)
    for (const r of faultState.reverse ? todo.reverse() : todo) {
      if (s.seen.has(r.key)) {
        s.pending.delete(r.key)
        continue
      }
      if (r.key.startsWith(`${run}/${d}/`)) {
        s.seen.add(r.key)
        s.pending.delete(r.key)
        continue
      }
      // A host error here propagates: the record stays pending and the next pull takes it again.
      const got = await task<{ version: number; sealed: { version?: number } & Record<string, unknown> }>(s, 'records/get/0.1', { roomId: cfg.roomDid, key: r.key, presentation: present(s, 'read') })
      stats.gets++
      let plain: Uint8Array
      try {
        plain = await openRecord(s, r.key, got.sealed.version ?? got.version, got.sealed)
      } catch (e) {
        if (e instanceof HostError) throw e // the commit fetch failed at the host: pending, not given up
        // A record this member cannot open (a replayed seal under another key, or a foreign seal): the carrier delivered nothing usable.
        notes.push(`${d}: ${r.key} does not open (record epoch ${String((got.sealed as { epoch?: number }).epoch)} v${got.version}/${String(got.sealed.version)}, member epoch ${s.member.epoch}): ${String(e).slice(0, 60)}`)
        s.seen.add(r.key)
        s.pending.delete(r.key)
        continue
      }
      const f = JSON.parse(dec.decode(plain)) as Frame
      const msg: Msg = { id: ++carriedId, from: f.from, label: f.label, body: unb64(f.b) }
      s.pending.delete(r.key)
      if (withheld(msg)) {
        s.held.set(r.key, msg)
        continue
      }
      await deliver(r.key, msg)
    }
    return n
  }

  async function settle() {
    for (let round = 0; round < 60; round++) {
      let moved = 0
      for (const [d, s] of devices) moved += await push(s, d)
      for (const [d, s] of devices) moved += await pull(s, d)
      for (const [d, s] of devices) moved += await push(s, d)
      if (moved === 0) return
    }
    throw new Error('data room: not quiet after 60 rounds')
  }

  const faults: CarrierFaults = {
    drop: (m) => void faultState.drop.push(m),
    withhold: (device, m) => void faultState.withhold.push({ device, match: m }),
    reverse: (on) => void (faultState.reverse = on),
    duplicate: (on) => void (faultState.duplicate = on),
    tamper: (m, mutate) => void faultState.tamper.push({ match: m, mutate }),
    async replay(match) {
      // The host (or whoever can write) stores an old sealed record again under a new key.
      // The seal is bound to key and version, so no member opens it: measured, not assumed.
      const s = devices.values().next().value as DeviceState
      let n = 0
      for (const [key, { frame, sealed }] of sealedByKey) {
        const m: Msg = { id: 0, from: frame.from, label: frame.label, body: unb64(frame.b) }
        if (!match(m)) continue
        n++
        const newKey = `${run}/replay/${++replaySeq}-${key.split('/').pop()}`
        const version = (await headVersion(s)) + 1
        const sealedObj = JSON.parse(sealed) as Record<string, unknown>
        try {
          await task(s, 'records/put/0.1', { roomId: cfg.roomDid, key: newKey, presentation: present(s, 'write'), expectedVersion: 0, sealed: { ...sealedObj, version } })
          stats.puts++
        } catch (e) {
          notes.push(`replay refused by host: ${(e as Error).message.slice(0, 80)}`)
        }
      }
      return n
    },
    carried: () => carriedLog.slice(),
    reset() {
      faultState.drop = []
      faultState.withhold = []
      faultState.reverse = false
      faultState.duplicate = false
      faultState.tamper = []
    },
  }

  const room: DataroomsHandle = {
    run,
    stats,
    roomDid: cfg.roomDid,
    hostDid: cfg.hostDid,
    limiters: () => [...limiters],
    /** What the host holds for this run, as a member with read authority sees the listing: keys, authors, versions. */
    async inventory() {
      const s = devices.values().next().value as DeviceState
      const listed = { records: await listAbove(s, 0, `${run}/`) }
      return listed.records.map((r) => ({ key: r.key, version: r.version, author: r.author, epoch: r.sealed?.epoch }))
    },
    /** What the host can read without a key: everything in the listing, nothing of the frames. */
    visible() {
      const labels = new Set<string>()
      const persons = new Set<string>()
      for (const { frame } of sealedByKey.values()) {
        labels.add(frame.label)
        const wire = JSON.parse(dec.decode(unb64(frame.b))) as Record<string, unknown>
        if (typeof wire.person === 'string') persons.add(wire.person)
      }
      return { hostSees: ['record key (run/device/seq)', 'author did:key', 'version', 'epoch', 'size', 'time'], sealedLabels: [...labels].sort(), personsInFrames: [...persons].sort(), personsVisibleToHost: [] }
    },
  }

  return {
    id: options.label ?? 'rltp-beekem-datarooms',
    capabilities: new Set<Capability>([...inner.capabilities].filter((c) => c !== 'service' && c !== 'steal') as Capability[]),
    room,
    transport: {
      faults,
      async setOnline(d, online) {
        dev(d).online = online
      },
      settle,
      async write(d, text) {
        const s = dev(d)
        const updates: Uint8Array[] = []
        const onUpdate = (u: Uint8Array, origin: unknown) => {
          if (origin === LOCAL) updates.push(u)
        }
        s.doc.on('update', onUpdate)
        s.doc.transact(() => s.doc.getArray<string>('eintraege').push([text]), LOCAL)
        s.doc.off('update', onUpdate)
        for (const u of updates) await inner.sealContent(d, u)
        await push(s, d)
      },
      read: (d) => dev(d).doc.getArray<string>('eintraege').toArray().slice().sort(),
      idleMs: () => idle,
    },
    async dispose() {
      // Nothing to stop: the host and the room live outside the process. The run's keys stay in the room; the members go back to the pool.
      ;(options.pool ?? pool(W!)).push(...claimed.splice(0))
    },
    rerunRepair: (d) => inner.rerunRepair?.(d),

    async addDevice(p, d) {
      await inner.addDevice(p, d)
      const s: DeviceState = { person: p, online: true, doc: new Y.Doc(), ...claimIdentity(d), synced: false, outbox: [], seq: 0, sinceVersion: 0, seen: new Set(), held: new Map(), pending: new Map() }
      devices.set(d, s)
      await push(s, d)
    },
    async createGroup(d) {
      await inner.createGroup(d)
      await push(dev(d), d)
    },
    async addMember(by, p, role) {
      await inner.addMember(by, p, role)
      await push(dev(by), by)
    },
    async removeMember(by, p) {
      await inner.removeMember(by, p)
      await push(dev(by), by)
    },
    async rotate(by) {
      await inner.rotate(by)
      await push(dev(by), by)
    },
    async changePolicy(by, tag) {
      await inner.changePolicy(by, tag)
      await push(dev(by), by)
    },
    async removeDevice(by, device) {
      await inner.removeDevice!(by, device)
      await push(dev(by), by)
    },
    sealContent: (d, u) => inner.sealContent(d, u),
    takeOutgoing: () => [],
    receive: (d, m) => inner.receive(d, m),
    members: (d) => inner.members(d),
    status: (d) => `${inner.status(d)}; room puts=${stats.puts} lists=${stats.lists} gets=${stats.gets} commits=${stats.commitsApplied} versionRetries=${stats.versionRetries} mismatches=${stats.versionMismatches} 429=${stats.rateLimited} transient=${stats.transientRetries}${dev(d).outbox.length ? `; outbox=${dev(d).outbox.length}` : ''}${dev(d).lastError ? `; ${dev(d).lastError}` : ''}${notes.length ? '; ' + notes.slice(0, 2).join('; ') : ''}`,
    steal: (d) => inner.steal(d),
    attackerOpen: (st, m) => inner.attackerOpen(st, m),
  }
}

class HostError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    readonly detail: string,
  ) {
    super(`host ${status} ${code}: ${detail}`)
  }
}

export interface DataroomsHandle {
  readonly run: string
  readonly stats: { puts: number; lists: number; gets: number; commitsApplied: number; versionRetries: number; versionMismatches: number; bytesUp: number; admittedFresh: number; rateLimited: number; rateLimitWaitMs: number; transientRetries: number }
  limiters(): string[]
  readonly roomDid: string
  readonly hostDid: string
  inventory(): Promise<Array<{ key: string; version: number; author: string; epoch: number | undefined }>>
  visible(): { hostSees: string[]; sealedLabels: string[]; personsInFrames: string[]; personsVisibleToHost: string[] }
}

export { sleep as _sleep }
