// English text of the matrix page (public/matrix.html). The bench speaks
// German; the public page is English. Every port, promise, scenario and
// candidate that appears in a report needs an entry here, the page test
// fails otherwise, so the page cannot drift from the code.

import type { Port } from './matrix'

export const portEn: Record<Port, { id: string; title: string }> = {
  "autorität": {
    "id": "authority",
    "title": "Authority port (Access §3, §3.6, §4, §7.3, §9.3)"
  },
  "schlüssel": {
    "id": "key",
    "title": "Key port (KV1–KV6 from the port synthesis; devices from E7)"
  },
  "replikation": {
    "id": "replication",
    "title": "Replication port (Replication Contract I1–I16, doors D1–D5; delivery DV from E11)"
  },
  "mehrgerät": {
    "id": "multidevice",
    "title": "Multi-device port (E15: holder state across the devices of one person; Trust 0.32 §8/§6a, HSC)"
  }
}

/** Promise id → English title, source and (where the promise has no scenario yet) the gap. */
export const promiseEn: Record<string, { title: string; ref: string; gap: string | null }> = {
  "A1": {
    "title": "Creation and admission: everyone sees the same membership",
    "ref": "Access §3",
    "gap": null
  },
  "A2": {
    "title": "A removal holds, even next to a write by the removed",
    "ref": "Access §3.6, RLTP-ACC-3400 (Strong Removal)",
    "gap": null
  },
  "A3": {
    "title": "Simultaneous removals of different people both hold",
    "ref": "Access §3.6 conflict matrix",
    "gap": null
  },
  "A4": {
    "title": "Mutual removal: both are out, neither reads new content",
    "ref": "Access §3.6; decision 05.10.",
    "gap": null
  },
  "A4a": {
    "title": "Mutual removal: all remaining members agree (no fixed expectation what a candidate makes of it)",
    "ref": "Access §3.6",
    "gap": null
  },
  "A5": {
    "title": "Removal next to a rotation by another member",
    "ref": "Access §3.6",
    "gap": null
  },
  "A6": {
    "title": "Two simultaneous policy changes: all replicas agree on state and membership",
    "ref": "Access §3.6 class rule 3",
    "gap": null
  },
  "A7": {
    "title": "Policy change next to an enforcement: fork, the enforcement lapses, ended by a policy change on both branches",
    "ref": "Access §3.6, 3565–3568",
    "gap": null
  },
  "A8": {
    "title": "A removed member invites concurrently: the chain lapses, nobody in it reads new content",
    "ref": "Access RLTP-ACC-3400, 3475",
    "gap": null
  },
  "A9": {
    "title": "The creator has no special role: the group stays able to act without them",
    "ref": "Access §3 (RLTP-ACC-3060)",
    "gap": null
  },
  "A10": {
    "title": "Write offline, then converge: same evidence, same state",
    "ref": "Access §3.6; candidate invariant I1",
    "gap": null
  },
  "A11": {
    "title": "View service: a removed member writes concurrently, the service discards",
    "ref": "Access §7.3, §9.3 (P2)",
    "gap": null
  },
  "A12": {
    "title": "View service: a stale view does not let the removed keep writing",
    "ref": "Access §7.3, §9.3",
    "gap": null
  },
  "A13": {
    "title": "View service: mutual removal leaves one member, view quorum",
    "ref": "Access §7.3 (quorum rule: finding 9)",
    "gap": null
  },
  "KV1": {
    "title": "Fresh secret per enforcement: the removed person or device reads nothing new",
    "ref": "port synthesis KV1; Access §9",
    "gap": null
  },
  "KV2": {
    "title": "Exactly the remaining members: even under simultaneous enforcements no removed member reads along",
    "ref": "port synthesis KV2",
    "gap": null
  },
  "KV3": {
    "title": "Binding in the log: a tree change no log entry covers opens no access",
    "ref": "port synthesis KV3; Access registration/0.27 keyOpDigest",
    "gap": null
  },
  "KV4": {
    "title": "History via the replica: a newcomer reads earlier entries with the current secret and the chain",
    "ref": "port synthesis KV4",
    "gap": null
  },
  "KV5": {
    "title": "Rotation on demand: after a stolen state the thief reads nothing after the rotation (PCS)",
    "ref": "port synthesis KV5",
    "gap": null
  },
  "KV6": {
    "title": "Merging parallel secrets: simultaneous tree changes converge without anyone reading along",
    "ref": "port synthesis KV6",
    "gap": null
  },
  "K7": {
    "title": "Devices per person: a second device reads along, a lost device is removed alone, removing a person hits all their devices",
    "ref": "E7 (one leaf per device); Access device.add/revoke",
    "gap": null
  },
  "I1": {
    "title": "Catch-up: a device that appears late converges from the log",
    "ref": "Replication §5.1",
    "gap": null
  },
  "I2": {
    "title": "Causal application: the carrier may reorder",
    "ref": "Replication §5.2",
    "gap": null
  },
  "I3": {
    "title": "A run and its result belong together",
    "ref": "Replication §5.3",
    "gap": "no scenario yet that counts runs and assigns each exactly one result; T1 only shows the end state"
  },
  "I4": {
    "title": "Commit before forwarding, displacement of the replica",
    "ref": "Replication §5.4",
    "gap": "the bench has no durable storage, a commit is not observable"
  },
  "I5": {
    "title": "Convergence against an attested target: withholding is noticed",
    "ref": "Replication §5.5, door D5",
    "gap": null
  },
  "I6": {
    "title": "Key-blind: the carrier reads only ciphertext with an envelope",
    "ref": "Replication §5.6; Access envelope",
    "gap": null
  },
  "I7": {
    "title": "Authorization only against the presented view",
    "ref": "Replication §5.7",
    "gap": "T7 only checks that the removed reads nothing; a scenario would have to switch the view and test the service verdict against it"
  },
  "I8": {
    "title": "State, not edge: duplicates and old frames change nothing",
    "ref": "Replication §5.8; Delivery 6.3",
    "gap": null
  },
  "I9": {
    "title": "Durability per transaction",
    "ref": "Replication §5.9",
    "gap": "no durable storage in the bench (harness limit)"
  },
  "I10": {
    "title": "Local truth never replicates",
    "ref": "Replication §5.10",
    "gap": "no scenario yet that checks carried frames for local verdicts (notes, dispositions); T12 only checks names and content"
  },
  "I11": {
    "title": "Retry authority lives in the durable log",
    "ref": "Replication §5.11",
    "gap": "no durable storage in the bench; the outbox (PWS: awaiting-transport) is only a hint"
  },
  "I12": {
    "title": "Gap repair, addressed and terminating",
    "ref": "Replication §5.12; Delivery DV2",
    "gap": null
  },
  "I13": {
    "title": "Cost bound per side",
    "ref": "Replication §5.13",
    "gap": "S9/S9b measure time per operation, not transactions and round trips per side"
  },
  "I14": {
    "title": "Ingest at every inlet",
    "ref": "Replication §5.14",
    "gap": "the bench has one inlet per device (receive); several inlets are not modelled"
  },
  "I15": {
    "title": "Rebinding after loss: carrier switch mid-life",
    "ref": "Replication §5.15",
    "gap": null
  },
  "I16": {
    "title": "Concurrent enforcement forks, nothing else",
    "ref": "Replication §5.16",
    "gap": "I16 is pinned to Access 0.53 and contradicts the 0.56 conflict matrix (enforcement ∥ enforcement does not fork, S4b/S4c); first the reconciliation, then a scenario"
  },
  "D1": {
    "title": "Signed DAG, form before content: the carrier can only destroy, never reinterpret",
    "ref": "Replication door D1",
    "gap": null
  },
  "R1": {
    "title": "Service classes: blind keeps serving the removed (who opens nothing), view/log refuse",
    "ref": "Access §9.3",
    "gap": null
  },
  "DV4": {
    "title": "Pseudonym per group: the carrier does not link groups via identities",
    "ref": "delivery hypotheses DV4/DV6",
    "gap": null
  },
  "DV2": {
    "title": "Delivery: lost receipts and an unreachable carrier never end silently",
    "ref": "Delivery 6.1, 6.3 (E11: T9, T10)",
    "gap": "covered by the separate delivery bench (E11, T9/T10 pass on four wires), not yet mapped into this matrix"
  },
  "MG1": {
    "title": "Mediator devices: a stock key is named in at most one act, and two separated mediator devices do not exceed the side's shared acceptance budget",
    "ref": "Trust 0.32 §8 8570.1, 8510 (E15 X1, X13)",
    "gap": null
  },
  "MG2": {
    "title": "Hard acceptance limit: ten acceptances per mediator relationship across all devices of the person",
    "ref": "§8 8510, 8640.10 (X2)",
    "gap": null
  },
  "MG3": {
    "title": "One state per person: consent and decline are terminal, the counterpart sees nothing the person as a whole does not carry",
    "ref": "§8 8325.A3/A4, 8765, 8910.7/.8 (X3, X18)",
    "gap": null
  },
  "MG4": {
    "title": "Class revocation next to a send and old stock: the running act continues, a ticket on a key withdrawn meanwhile holds and consumes the key once (the withdrawal takes effect when the empty revision arrives, decision 4a), M's view becomes empty, no equivocation",
    "ref": "§8 8232.2, 8535, 8475.S6, 6270 (X4, X16)",
    "gap": null
  },
  "MG5": {
    "title": "Departure ends duties; a replay from another device revives nothing",
    "ref": "§6a 6845.7, 6845.10 (X5)",
    "gap": null
  },
  "MG6": {
    "title": "Numbers across devices: neither a restore from backup nor parallel production on two devices reuses a number; no stale stock, no lost acts",
    "ref": "§8 8500, 8315–8318, 6270; §6a 6680 (X6, X17, later X19)",
    "gap": null
  },
  "MG7": {
    "title": "Continuity across devices: two encounters of the same persons on different devices become one relationship, no doubles",
    "ref": "§6a 2300, 6806, 6975, 6987; I-6 (X7, X7b, X14, X15)",
    "gap": null
  },
  "MG8": {
    "title": "Enrollment: a new device sees everything and acts at once",
    "ref": "HSC-020 replacement, Identity enrollment (X8)",
    "gap": null
  },
  "MG9": {
    "title": "Device revocation: a revoked device reads nothing new, not even with the old state",
    "ref": "Identity revocation; K7 (X9, later X20)",
    "gap": null
  },
  "MG10": {
    "title": "Rights per device or app: a restricted app can only do what its right allows",
    "ref": "delegation profile K2 (X10, later X22)",
    "gap": null
  },
  "MG11": {
    "title": "Convergence after a long separation and journal repair: the same projection on all devices, no missing batch, the repair ends",
    "ref": "HSC-440; E15 plan section 5 (X11, X21)",
    "gap": null
  },
  "MG12": {
    "title": "Delivery with several devices: lost receipt and unreachable carrier per device never end silently, effect once",
    "ref": "Delivery 6.1, 6.3 (X12)",
    "gap": null
  }
}

/** Scenario id → English title. */
export const scenarioEn: Record<string, string> = {
  "S1": "Create a group, admit two members, exchange content",
  "S2": "Remove a member; the removed reads nothing new",
  "S3": "Write offline, then converge",
  "S4a": "Alice removes Bob while Bob writes",
  "S4b": "Two admins remove different people at the same time",
  "S4c": "Mutual removal of two admins: remaining members agree",
  "S4c2": "Mutual removal: both are out, neither reads new content",
  "S4d": "Removal next to a rotation by another member",
  "S4e": "Two simultaneous policy changes",
  "S4j": "Policy change next to a removal: fork, ended by a policy change on both branches",
  "S4f": "A removed member invites at the same time; the invitee invites further",
  "S5": "Second device of the same person",
  "S5b": "Lost device: the person removes it, the finder reads no further",
  "S5c": "A person with two devices is removed; neither reads new content",
  "S6": "A new member reads the history",
  "S6b": "A new member reads the history after the next entry",
  "S7": "Device state stolen, then rotation: does the attacker keep reading?",
  "S8": "The creator drops out, the group stays able to act",
  "S11": "Key operation without a log entry: a removed device adds a new leaf",
  "S10a": "Service: removed member writes concurrently, the relay discards",
  "S10b": "Service: removal without relay, the removed keeps writing at the relay (stale view)",
  "S10c": "Service: mutual removal leaves one member, view quorum",
  "T1": "Carrier silently drops a frame",
  "T2": "Carrier reorders",
  "T3": "Carrier delivers twice",
  "T4": "Carrier replays an old removal",
  "T5": "Carrier tampers with a frame",
  "T6": "Carrier withholds one entry from one device",
  "T6b": "Carrier freezes a device (everything withheld)",
  "T7": "A removed device keeps asking",
  "T8": "Carrier switch mid-life",
  "T11": "Two groups on one carrier",
  "T12": "Sealed entry: what the carrier reads",
  "X1": "M1 and M2 pick the same stock key of A offline for two introductions (single use 8570.1)",
  "X2": "Budget at 9; A1 and A2 each accept a tenth ticket while separated (hard limit 8510)",
  "X3": "A1 consents to an introduction, A2 declines the same one (both offline): terminality 8325, what B and M see",
  "X4": "A1 switches the class off, A2 has just sent a card and refills (revocation ∥ send, 8232.2, 8535, 6270)",
  "X5": "A1 ends the relationship with B, A2 replays an old mapping duty (departure ∥ replay, 6845.7, 6845.10)",
  "X6": "A2 is restored from an old backup: number reuse, stock state, incarnation (8500, 8315, finding 5)",
  "X7": "A1 meets B1, A2 meets B2 in the same round, no device has shared candidates: continuity across devices (I-6, 2300)",
  "X7b": "Third encounter after the symmetric concurrent pair (X7): both devices synced, A1 meets B1 again; entries per device before/after, rounds to one entry with three tuples, no double effects (2300, 6806, 6975)",
  "X8": "A enrols A2: A2 sees everything and acts at once; enrollment traffic",
  "X9": "A loses A2 and revokes it: B and M must not reach A2 any more, A1 still",
  "X10": "A second app of A as a further device with a restricted right (read only)",
  "X11": "Long separation (30 rounds), both devices act, then union: stable convergence, journal size",
  "X12": "Lost receipt and unreachable carrier per device (T9/T10 with several devices): effect once, both devices equal afterwards",
  "X13": "M1 and M2 each issue an introduction to A while separated, A's shared budget per mediator relationship stands at 9; A1 sees only one, A2 only the other (mediator devices against the shared budget, 8510, 8640.10)",
  "X14": "A1 and A2 separately introduce the same person C to B (two acts, one purpose): double introduction, union of the acts at B and C (6975, I-6)",
  "X15": "Union of two relationships with M (6975) while an act runs on one (consented, card in transit): A1 consents, A2, separated from A1, meets M again and unites (6987.5/.6/.10/.12/.14)",
  "X16": "A1 revokes the class, A2, separated, holds the old stock; a mediator device with the old view still introduces, A2 accepts the ticket: under decision 4a the ticket holds, the withdrawal takes effect when the empty revision arrives; after healing the devices agree, the key is consumed once, M's view is empty (8535, 8475.S6, 8640.6)",
  "X17": "A1 and A2, separated, each produce a revision (each accepts another ticket and refills): parallel production; with a writer tag per relationship M accepts both, the stock is the union (8500 and 6270 per writer, decision 3a); measured what M learns about the devices; probe sequence 6680 not modelled",
  "X18": "A1 and A2, separated, consent to the same act and each produce a card: two cards of one act, what B sees (8325.A4, 8910.7, 8910.8)",
  "X21": "Journal duplicated, reordered, incomplete: completed batches after an old and a double restore, concurrent requests, crashes before and after commit; loss of request, answer, batches alone (reply head delivered) and receipt, each for more than 12 rounds; repair ends only with no pending catch-up (HSC-440, reviews 9 and 11)"
}

/** Candidate id → name and one line. */
export const candidateEn: Record<string, { name: string; desc: string }> = {
  "gen2": {
    "name": "WoT Gen 2",
    "desc": "our production app: @web_of_trust/core 0.6.0, Yjs, own relay"
  },
  "p2panda": {
    "name": "p2panda",
    "desc": "p2panda-spaces 0.7.1, no server"
  },
  "keyhive": {
    "name": "Keyhive",
    "desc": "@keyhive/keyhive 0.3.0-alpha.1, content Yjs, no server"
  },
  "rltp-beekem": {
    "name": "RLTP / BeeKEM",
    "desc": "authority log over BeeKEM 0.4.0, blind relay"
  },
  "rltp-beekem-sichten": {
    "name": "RLTP / BeeKEM + view service",
    "desc": "same, with an enforcing key-blind service (authorization views, Access §7.3)"
  },
  "rltp-mls": {
    "name": "RLTP / MLS",
    "desc": "authority log over MLS (OpenMLS 0.9.1), blind relay"
  },
  "rltp-mls-sichten": {
    "name": "RLTP / MLS + view service",
    "desc": "same, with the view-class service"
  },
  "consensual-mls-any-staged": {
    "name": "MLS room, any-staged",
    "desc": "no authority log, membership = tree, any member commits, lowest hash wins"
  },
  "consensual-mls-owner": {
    "name": "MLS room, owner",
    "desc": "no authority log, only the founder commits, members propose"
  },
  "rltp-beekem-logreplik": {
    "name": "RLTP / BeeKEM + log replica",
    "desc": "service materializes the authority log (plaintext mode, control)"
  },
  "klartext": {
    "name": "Plaintext (null candidate)",
    "desc": "shows the bench detects faults; no encryption"
  },
  "keyhive-ark": {
    "name": "Keyhive / ARK",
    "desc": "Keyhive over ARK 0.6.0-alpha.1, Automerge, Subduction server"
  },
  "rltp-beekem-pws": {
    "name": "RLTP / BeeKEM on PWS",
    "desc": "Portable Web Spaces (was-teaching-server 0.42) as blind storage"
  },
  "rltp-beekem-datarooms": {
    "name": "RLTP / BeeKEM on a Data Room",
    "desc": "an OpenVTC Data Room (VTI, VTC as host) as blind storage; devices as vti-rooms-wasm members in Node, the owner's VTA admits"
  },
  "k0-one-seed": {
    "name": "K0: one seed, no merge",
    "desc": "every device derives all keys from one seed and keeps its own holder state, nothing is merged; the baseline that has to fail"
  },
  "k1a-static": {
    "name": "K1a: journal, static rights",
    "desc": "one seed; every committed step travels as a journal batch with its production intents; acceptance budget and nameable stock keys split statically across devices; a received probe is evaluated again when the journal adds own tuples; a hit owes the own mapping, the union comes from the counterpart's mapping"
  },
  "k1a-journal-service": {
    "name": "K1a + journal at the service",
    "desc": "K1a's rules unchanged; the person's self address at the carrier keeps the journal as an ordered log: catch-up reads the log from the device's position (fast), a new device folds the log from the start and is released by the enrolling device's witness, never by the log answer (withholding by the service never causes a release); no gate after restore (MV-6 new, as in K1a); an option under study, not the default"
  },
  "k2-device-keys": {
    "name": "K2-strict: device keys, device sets",
    "desc": "K1a's journal and fold rules with keys per device: every device has its own secret, registers its own addresses and signs its journal batches; counterparts know a person's device set per relationship only from received proofs (device-set@1: signed admissions and revocations, chained to the anchor first verified at the encounter or through the voucher); one card per act, produced by the device that allocated the named stock key; a stock key's private part stays on that device, only it opens the ticket; each device lists only as many own keys as it can still accept; no gate after restore (MV-6 new): a restored device acts from its reachable state, the counterpart catches duplicates (8640.12 as a rule); step 2a: the mediator runs as a single-writer fixture (one device), distributed mediator issuance is step 2b"
  }
}
