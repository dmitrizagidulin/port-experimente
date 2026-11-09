# Port notes: RLTP over BeeKEM on Portable Web Spaces (E12)

As of 11 October 2026. Plan: `rltp/design/port-experimente-2026-10.md`,
E12; background `rltp/design/pws-bruecke-2026-10.md`. Portable Web Spaces
(PWS, formerly Wallet Attached Storage, W3C CCG v0.5) as a group's storage,
with the unchanged BeeKEM candidate (E6–E9) on top. Only the transport
changes. Server: `was-teaching-server` 0.42.2 in process
(`startTestServer`, own temp storage per server), client
`@interop/was-client` 0.96; both require Node ≥ 24. Both packages have
since been renamed: the server is `@interop/web-spaces-server` from 0.44.0
(repository `interop-alliance/web-spaces-server`), the client
`@interop/pws-client` from 0.104.0. The versions pinned here keep the old
names.

## Variant (a): blind storage

- **One space per group, one collection `frames`.** Every frame of the
  candidate (card, authority operation with BeeKEM attachments, loose BeeKEM
  operation, revocation, content with chain) is stored as a JSON resource
  `{from, label, b}` under the id `<device>-<sequence>`; the server checks
  nothing about the content (a plaintext collection, the bytes are our
  sealed frames).
- **Reading via the changes feed**, per device with its own checkpoint;
  frames of other devices go to `candidate.receive`, own ones are skipped.
  Offline = no push, no pull; the outbox buffers.
- **The space controller is a group key** (`did:key`) that all devices hold
  and sign with. For WAS the group is thereby one controller. The server
  knows no membership; whoever has the key reads and writes. Removal acts
  only through the key epoch (KV1), never at the server.
- Partitions: in the bench, with own transport only the first group is
  online; the others buffer, without a mesh among themselves (the
  convention for all candidates with own transport, like Gen 2 and Keyhive
  over ARK).

### Results (check 1: does PWS carry as blind storage?)

| | Result | Reason |
|---|---|---|
| S1–S4f, S4j, S5, S5c, S6b, S8 | passed | as at the bench relay |
| S6 | passed | matrix run of 20 October 2026; the first run (11 October) failed: history only via the chain |
| S4e, S4j | passed | fork and fork end run over the feed as over the relay |
| S5b, S7 | not applicable | the bench does not see the frames (they lie at the server), so no theft model via `w.log` |
| S10a–c | not applicable | the server is blind, no enforcing service (variant a) |
| S9 (30 × 100, one run) | 105 ms/op, of which 83 % waiting for HTTP (`idleMs`); active ≈ 18 ms/op as at the relay (E9 step 3: 17.8) | the server costs time, not the candidate; view service at the relay: 31.9 |
| S9b (5 × 100) | 17.9 ms per entry, of which 87 % HTTP | content goes as one resource per entry |

**Answer to check 1: yes.** Every scenario that passes at the bench relay
also passes over PWS, with no change to the candidate. The feed delivers
frames in the server's write order; the candidate's buffers (`waiting`,
BeeKEM predecessors) carry any order.

### Check 3: what the server learns

**Correction after the review of PR #23 (#24):** the first version of this
note was wrong. The server sees the frames in plaintext, Base64 is not
encryption. From `visible()` after creation, two admissions and one entry,
checked on the HTTP payload:

| Frame | in plaintext at the server (state at #24) | since E10, sealed frames |
|---|---|---|
| `card` | person name, BeeKEM id, share key, device key | no longer goes over the server (encounter channel) |
| `auth`, `policy` | the whole authority operation: kind, subject, signers, policy, key binding, predecessors; plus the BeeKEM attachments | `sealed`: ciphertext, envelope `kind`, `heads` (hashes), `by` (device key) |
| `cgka` | BeeKEM operations (signed, path secrets encrypted) | unchanged; the attachments of an operation precede it as frames of their own |
| `content` | `c`, `iv`, `tab`, `ref`: sealed; envelope `heads`, `by` | as `auth` |
| `repair` | repair request (E10, I12): missing and evidencing ids, heads, addressees | `sealed` |
| `welcome` | — | encrypted to one device (`to` = its welcome key) |

`visible()` after creation, two admissions and one entry: no person, no
card; every sealed frame (`auth`, `policy`, `content`, `repair`) only
`by, c, heads, iv, keyOp, kind, ref, t, tab`, the welcome `c, eph, iv, t,
to`, BeeKEM operations `op, t`. The paragraph below describes the state
before sealed frames.

Persons `alice`, `bob`, `carol` were thereby readable for the server, as
were membership, policy and who admitted whom. Not readable: content and
the group secrets. The reason lay not with PWS but with the bench
candidate: it sealed content (KV1 is the topic of E6–E9), not the frames;
the bench relay was blind only by convention. The spec seals every
replicated entry under the epoch key (Replication Contract, "key-blind by
construction"; Access envelope) and delivers welcomes and cards separately.
For E12 this means: variant (a) is "blind" only for content; a blind carrier
in the spec's sense needs the sealed entry, and that belongs in the carrier
bench (E10/E11) as a door of its own, not in this candidate.

The server additionally sees: resource ids with device names and sequence
numbers (a pseudonym per device × group would be the answer, E8 finding
5), the frame labels and sizes. The server stores no checkpoints: it sees
one only in each read request, and with one shared key it cannot tie a
request to a device.

### Check 4: server switch

`space.exportBlob()` → new server → `space.import()` under the same space
id: 1 collection, 8 resources taken over, 0 skipped, space metadata
restored; provenance "unattested" for all 10 entries, because we set no
export signatures. Checkpoints are a fact of the old server (the feed is
read anew, `seen` filters what is known). A new device reads the whole
history from the new server, writing continues, membership is right. That
is their declared goal "data portability", and for us it suffices: the
Replication Contract demands nothing from the carrier that the move could
lose; authority and keys live with the members.

## Check 2: what the group as controller would cost (variants b, c)

Not built; derived from the server code (`was-teaching-server` 0.42.2).

- **Controller methods.** There is no registry of DID methods; the two
  admitted ones are hard-coded. `src/lib/validateDid.ts` admits `did:key`
  and `did:webvh` as controllers; `src/lib/webvhController.ts` resolves a
  self-hosted `did:webvh` from a log in the space and verifies the history
  locally; `src/zcap.ts` (1,863 lines) hooks this resolver into signature
  verification (`setDidResolver(didResolverWithWebvh(…))`). An RLTP profile
  would be another method of the same class ("verified log"): the log is
  our view chain (E9 step 2), the key set of the "controller document" are
  the `identities` of the last verified view, each under
  `capabilityInvocation`. Difference to `did:webvh`: an entry is not signed
  by a key of its predecessor but by m identities from predecessor ∩
  successor (intersection rule); log verification therefore needs a quorum
  rule instead of the single signature. The resolver hook exists, the
  method does not; adding one is a change to `validateDid.ts` and to the
  resolver in `zcap.ts`.
- **Container rule.** `src/lib/containerRule.ts`: replacing space meta and
  deleting a collection are "controller-only" = direct root invocation by
  the controller. Deleting a space additionally admits a delegated
  capability that targets exactly the space URL with `allowedAction`
  exactly `['DELETE']` (the `exact-delete` rule). With the group as controller,
  every listed device would be "the controller" and could delete. A profile
  would have to bind these operations to a quorum; HTTP signatures carry
  one signature, not a quorum. Way out: a quorum-signed entry in the chain
  (`terminal`, Access §7.3 knows it) that the server reads as a delete
  order, instead of a signed request.
- **Displacement.** Today removal acts only via the epoch. With the chain
  as controller history, the next view would take a removed device key out
  of the document; WAS's current-key-set rule makes that effective at the
  server immediately, including everything that key delegated. That is
  service class "view" from Access §9.3, without a service of our own.
  The server offers this path today without a new method: promote the
  space to a self-hosted `did:webvh` whose document lists each device key
  under `capabilityInvocation`; removing a key from the document removes
  it at the server. This holds only with `@interop/did-method-webvh`
  5.16.0 or later: earlier versions accepted a log entry whose `proof` is
  an empty array, so any holder of a write grant on `did.jsonl` could have
  added or kept a device key without the update key. The server requires
  the fixed library from 0.42.3; the 0.42.2 pinned here resolves 5.14.0
  and is affected. What `did:webvh` cannot give is a quorum-signed log
  update (a single update key signs each entry), so the quorum rule, not
  the resolver, is the gap a new method would close.
- **Variant (c), log replica:** the server materializes the authority log.
  That would be a governing profile of their governing history logs (the
  server checks only the line format, readers verify) plus server-side
  evaluation: a clearly larger intervention than (b).
- **What we would have to bring:** a pseudonym per device × group towards
  the server (E8 finding 5), the chain as a resource log in the space, and
  the decision on finding 9 (which quorum rule the chain runs).

**Estimate:** (b) is a new method in `validateDid.ts` and the resolver in
`zcap.ts`, plus a container exception, on their side perhaps a few hundred
lines at a resolver whose hook already exists; (c) a new server part. With
(a) as the floor, (b) suffices for everything E8 demanded of the service.
Their spec would stay unchanged only if its authorization profile admitted
the method; today the two methods are fixed in code.

## Carrier bench (E10)

`transport.faults` lays the faults of catalogue T over the real server:
loss and tampering before the put, withholding per device and reordering
on read (all devices sign with the same key, the server cannot tell them
apart), replay as a new resource. Withheld frames are kept per device
until the rule is lifted (#28): the feed checkpoint advances, the frame
does not. Result identical to the relay: T2–T5 passed, T1/T6/T12 not
(findings on the candidate and on class blind, see `rltp-beekem/NOTES.md`,
E10). One gap (T1) was particularly silent here: the put never reached the
server, and nobody noticed. Second pass with gap repair in the candidate:
T1 and T6 passed (Bob asks Alice, Alice stores the frame as a new resource;
the feed then carries it like any other), T6b (feed frozen) still not; T12
passed since sealed frames (the server holds only ciphertext with an
envelope); T7 passed (the server keeps serving the removed device, it opens
nothing), T8 passed (`rebind` = move by export/import mid-life, then
admission and writing on the new server), T11 not applicable (one group per
candidate). A rejected put stays in the outbox beside it and is retried
(`awaiting-transport`).

## Limits of the bench

- Reading is not bound to proof of possession, because the group key is
  shared (variant a). With (b) every device would have its own.
- `w.log` is empty: scenarios that measure on the traffic (S7, S5b, S10)
  are not applicable. An eavesdropping model at the server would be
  possible (theft = access to the server storage), but that is a different
  attacker model.
- Node ≥ 24 only for this candidate; CI runs on 22 and skips it until it is
  raised.
