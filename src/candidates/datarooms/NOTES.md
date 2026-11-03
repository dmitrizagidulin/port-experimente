# Port notes: RLTP over BeeKEM on an OpenVTC Data Room (E16, step 1)

As of 2 November 2026. Plan: `rltp/design/port-experimente-2026-10.md`, E16;
background: the comparison of RLTP groups, OpenVTC Data Rooms and ATProto
Spaces (`rltp/design/interop/gruppen-vergleich-…-2026-11-01.md`). The pattern
is E12 (`rltp-beekem-pws`): the BeeKEM candidate (E6–E9) is unchanged, only
the transport changes. Here the transport is a Data Room of the Verifiable
Trust Infrastructure (VTI, `OpenVTC/verifiable-trust-infrastructure`, main
`6c57452a`, 21 October 2026), hosted by a VTC, as **blind storage**: the host
stores sealed records and answers `rooms/*` trust tasks; it holds no member
list and no key.

## What runs where

- **Host**: a VTC (`vtc-service`) on `localhost:8200`, provisioned from a
  community VTA (C). It hosts rooms for its members only, so the room's owner
  is a member of the test community.
- **Owner**: "Alice", a persona on VTA A (`localhost:3100`). Her VTA holds the
  room's DID and signing key and is the only party that admits members
  (`pnm rooms owner invite | group-add | issue-membership | issue-authority`).
  The owner does nothing else in this experiment; in particular, the RLTP
  group's authority never passes through her.
- **Devices**: `vti-rooms-wasm` members in Node (no VTA, no browser): an
  `Identity` (did:key) signs the trust-task documents, a `RoomMember` holds the
  MLS leaf, seals and opens records and applies the room's commits. The
  WebAssembly is built from the VTI worktree with `--target
  experimental-nodejs-module` and lives in `pkg/` (gitignored, build in
  `rltp/design/openvtc-local-stack/README.md`).
- **Pool**: admitting a member takes four `pnm` calls against the owner's VTA
  (about 1.5 s, and the VTA rate-limits its DID log), so 32 identities are
  admitted once (`/tmp/vdr/e16/pool`, `pool.mjs`) and handed to devices. A
  candidate instance gives them back when it is disposed: membership of the
  room is permanent, the MLS state moves on, and runs do not see each other's
  records. When the pool runs dry the candidate admits a fresh identity
  through `pnm` (`stats.admittedFresh`).
- **Provisioning**: `rltp/design/openvtc-local-stack/provision-e16.sh` (VTAs,
  DID server, VTC, community admin, Alice as member, room) and `room-e16.sh`
  (room steps only). Result: `/tmp/vdr/e16/room.json`, read by the candidate.

## How frames travel

- Every frame of the candidate (card, authority operation with BeeKEM
  attachment, loose BeeKEM operation, revocation, content with chain) becomes
  a JSON `{from, label, b}` that the device seals as a record
  (`RoomMember.sealRecord`) and stores with `rooms/records/put/0.1`. Cards of
  the encounter channel go device to device, not through the room (as in E12).
- Record keys are `<run>/<device>/<seq>`; one run = one candidate instance.
  `rooms/records/list/0.1` filters by `prefix`, so many groups share one room
  without seeing each other's keys.
- **Versions are room-wide.** The seal is bound to key and version, the host
  requires the version to be the room's head + 1. So a device lists before
  it writes, and two devices writing at once collide; the loser lists again
  and re-seals. Counted as `stats.versionRetries`.
- Reading: `list` with `sinceVersion` (the device's own checkpoint), then
  `get` and `openRecord` for the others' records. A record sealed under an
  epoch above the member's own means a membership change at the room: the
  device fetches `rooms/epoch/commits/0.1` above its epoch, applies them and
  opens again. A record sealed under an epoch below the member's join is
  opened through the epoch chain (`rooms/epoch/chain/0.1`, `addLinks`).
- Faults (E10): drop, withhold, reorder, duplicate and tamper are played by
  the hull, as in E12 (the host is real). Replay = an old sealed record stored
  again under a new key: the host accepts it, no member opens it (the seal is
  bound to key and version). Rebind: no second host in this step (T8 not
  applicable).

## What the host sees

The listing: record key (run, device, sequence), author (the device's
did:key), version, epoch, size, time. Never a frame: who is in the RLTP group,
which operation was issued, which policy applies, all of that is inside the
seal. This is stronger than E12 on the same bench, where frames went to PWS
in clear because the candidate does not seal frames (#24): here the room
seals every record. What the host still learns is the shape of the traffic:
how many devices write how much and when, and that they share a run prefix.

## Results (check 1: does a Data Room carry as blind storage? Yes.)

Run 2 November 2026, VTI 6c57452a, 32 pooled members, room at about 1 500
records after the runs. `tests/datarooms.test.ts` green: both tables below
are what the test pins.

| | Result | Reason |
|---|---|---|
| S1–S4f, S4j, S5, S5c, S6, S6b, S8 | passed | as at the bench relay and as on PWS |
| S5b, S7, S11 | not applicable | no theft model at the host (the bench does not see the frames) |
| S10a–c | not applicable | the host is blind: no enforcing service |
| T1–T7 | passed | gap repair, reorder, duplicate, tamper, replay (the replayed seal opens for nobody), reads after removal only through the key epoch (KV1) |
| T6b | failed | blind: a frozen host is not noticeable without an attested target (D5), like PWS |
| T8 | not applicable | one host in this step; a second host (or a room move) is step 3 |
| T11 | not applicable | one candidate carries one group |
| T12 | passed | the host holds sealed records only: no person, no label, no content in clear |

Times: S suite 30 s, T suite 33 s, one scenario 1–2.5 s (T5 9.5 s with 84
puts and 336 gets). A scenario costs about 15–20 puts, 25–45 lists and
30–70 gets at the host; `versionRetries` stayed 0 because the bench moves
devices one after the other. S4b applied 70 commits: pool members joined at
different epochs and each one catches up on first use.

Two findings from building it, both about the host, not the candidate:

1. **Rate limits.** The VTC answers 429 after about 400 `rooms/*` documents
   from one address (`[rooms.rate_limits]`, default burst 400 then one per
   10 ms; a presenter 120 then one per 100 ms; beneath that the admission
   constants, 120 per address and 60 per signer). The first full run died
   there: every scenario after S4d failed in milliseconds. The candidate now
   waits `Retry-After` and counts; the bench VTC has raised budgets. For a
   real app the lesson is the same as for PWS: a chatty replication that
   lists before every write meets a host that budgets per address.
2. **Pages.** `rooms/records/list` returns 500 records a page with a cursor;
   absence of the cursor is the only end. Taking the first page's highest
   version as the room's head sealed records at a version below the host's,
   and the host stored them under its own number, where no member could
   open them ("sealed under a different key, epoch, or location"). The same
   trap the browser spike of 22 October hit. The candidate follows the
   cursor and keeps the head across devices.

Review #90 (3 November) found a third thing, in the hull rather than at the
host: the listing cursor moved past a record before its fetch had succeeded,
so one failed `get` (a 503, a reset) skipped that record for good. Now every
listed record is held as pending until it is delivered, withheld or given up
(a seal that does not open), whatever order the carrier delivers in; a host
error leaves it pending and the next pull takes it again. The hull also
retries 502/503/504 and connection errors three times before the caller
sees them, and when the host stores a record under a version other than the
one the seal is bound to (a write landed in between), the frame goes again
under a fresh key and the orphan stays as garbage (`stats.versionMismatches`).
`tests/datarooms-cursor.test.ts` pins all of this against a host of its own
(no VTI stack): pages of two, the failed fetch, reverse delivery, the single
503, the version skew.

What the host learned (check 3): keys `<run>/<device>/<seq>`, authors as
did:key, versions, epochs, sizes and times. From that it can count devices
and frames per run and see which devices write together; it cannot tell a
card from an authority operation, nor who is in the group.

Not measured yet (steps 2 and 3 of E16): a second host or a move of the
room (T8), what two rooms on one host reveal about each other (T11), the
ATProto Space as the second carrier, and the two of them stacked.
