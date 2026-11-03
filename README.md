# Port experiments

A test bench for group authority, key agreement, replication and delivery.
The same scenarios run against several candidate stacks; from what each
candidate needs from the app we derive the ports of the Real Life Trust
Protocol. The findings per candidate live here in
`src/candidates/*/NOTES.md`; the plan and its reasoning in the private
workshop repository (`rltp/design/port-experimente-2026-10.md`).

## Results

- **The conformance matrix**, interactive: 53 promises across four ports
  (group candidates in the authority, key and replication ports, multi-device
  candidates in the multi-device port), every cell with its scenarios and
  the recorded result:
  https://real-life.org/port-experimente/matrix.html. The page and the
  Markdown matrix (`matrix.md`) are both written by
  `REPORT=1 pnpm vitest run report` (`src/lab/matrix-page.ts`; the English
  text of ports, promises, scenarios and candidates in `src/lab/matrix-en.ts`,
  a test fails when one is missing); never edit `public/matrix.html` by
  hand. The browser page
  renders it at the end of a run.
- **How to read it.** A promise is kept only if every scenario mapped to it
  passes. "Not applicable" means the candidate has no capability for the
  scenario, or the carrier fault never touched a frame of that kind. That
  is a gap in coverage, never a pass.
- **Every branch.** A cell is kept only if it holds in every branch.
  Where a candidate decides by chance (two concurrent MLS commits: the
  smaller hash wins), the bench forces each side of every such decision and
  runs the scenario in all branches (`src/lab/zweige.ts`). The enumeration
  covers only that sibling-commit tiebreak (`force_tiebreak` in
  `rust/mls-wasm`); other random-dependent orders, such as the topological
  sort over nonce-dependent operation ids in
  `src/candidates/rltp-beekem/authority.ts`, are not enumerated (no
  changing outcome observed in 2 × 132 cells). Where a result depends on
  delivery time and the stack gives no delivery bound (the Subduction
  server in `keyhive-ark`, S6 and S6b), the cell is not kept, always: it
  reads "abhängig von: Zustellzeit …". The bench still runs the scenario
  several times, checks every run strictly (no exception, the expected
  membership) and reports the distribution within an observation window in
  the details (`src/lab/zeit.ts`); the window is the bench's waiting time,
  not a bound. A cell that holds only sometimes is not kept, and its result
  says what it depends on ("abhängig von …"). There is no
  "nondeterministic" marker and no oracle is widened to make a run pass.
- The bench itself speaks German: scenario titles, status lines and the
  recorded results are German strings in the code. The notes and this
  README are English.

## Candidates

| Id | What | Transport class |
|---|---|---|
| `gen2` | WoT generation 2 (`@web_of_trust/core` 0.6.0, Yjs, own relay in process) | own server |
| `p2panda` | p2panda-spaces 0.7.1 (WebAssembly) | bench relay |
| `keyhive` | Keyhive 0.3.0-alpha.1 (WebAssembly, content in Yjs) | bench relay |
| `keyhive-ark` | Keyhive over ARK 0.6.0-alpha.1 (Automerge, Subduction server) | own server, Node only |
| `rltp-beekem` | authority log by the conflict matrix, keys from BeeKEM 0.4.0 | bench relay |
| `rltp-beekem-sichten`, `-logreplik` | the same with an enforcing service at the relay (class view or class log) | bench relay, enforcing |
| `rltp-beekem-pws` | the same on Portable Web Spaces (was-teaching-server 0.42) as blind storage | own server, Node only |
| `rltp-beekem-datarooms` | the same on an OpenVTC Data Room (VTI 6c57452a: VTC as host, frames as sealed records, devices as `vti-rooms-wasm` members in Node, owner VTA only for admission) as blind storage (E16) | own server, Node only, local VTI stack |
| `rltp-mls`, `rltp-mls-sichten` | the same candidate code, keys from MLS (OpenMLS 0.9.1) | bench relay |
| `consensual-mls-any-staged`, `-owner` | MLS without an authority log, the commit decides membership (room model) | bench relay |
| `klartext` | null candidate without encryption; shows that the bench detects faults | bench relay |

Run times are comparable only within a transport class: with an own server,
S9 is almost all waiting.

- `mehrgeraet-k0`: E15, the multi-device holder state. K0 is today's
  cut, one seed and no merge, the baseline that has to fail X1, X2, X3
  and X7. Further candidates (journal with pre-assigned rights, device
  sets with a delegation profile, soft limits) follow.

## Scenarios

- **S1 to S11** (`src/lab/scenarios.ts`): membership under conflict, devices
  per person, history, stolen state, a service at the relay.
- **T1 to T12** (`src/lab/traeger.ts`): the carrier as adversary (drop,
  reorder, duplicate, tamper, withhold, freeze, carrier switch, what the
  carrier reads).
- **T9, T10, Z1 to Z5** (`src/lab/zustellung.ts`): pair delivery over the
  wires plain envelope, TSP Rev 3 and DIDComm v2 (authcrypt, anoncrypt):
  lost receipt, device offline, what the carrier learns, carrier switch,
  multiple devices, foreign sender, wrong recipient key. E11b step 2 adds
  the direct send forms (b) `tsp-direct-connection` and (a)
  `tsp-direct-egress-session`, with sessions per relationship under a
  carrier that forwards only senders holding a session. E11b step 3 adds
  the routed form (c) `tsp-routed` (and `tsp-routed-egress-session`) with
  an intermediary that opens the routing layer and forwards the inner
  frame, under foreign senders, duplicates, tampering and rebinding.
- **S9, S9b** (`src/lab/load.ts`): load, 30 members.
- **X1 to X12** (`src/lab/mehrgeraet/scenarios.ts`): several devices of
  one person against the target model of Trust 0.32 §8 and §6a: double
  consumption, budget, consent against decline, revocation against send,
  departure against replay, restore from backup, continuity across
  devices, enrollment, device revocation, long separation, delivery per
  device. Each runs with two devices and serially as the control.

## Layout

- `src/lab/types.ts`: the driver interface of the bench. This is **not**
  the port we are looking for, only as much as the scenarios need.
- `src/lab/world.ts`: simulated world with one Y.Doc per device and a
  store-and-forward network with partitions and fault injection.
- `src/lab/matrix.ts`: promises per port with the mapping scenario to
  promise; generates the matrix.
- `src/candidates/<id>/`: one candidate per directory, with `NOTES.md`.
  `rltp-beekem` is the experiment on the port cut: the authority log
  (`authority.ts`) decides membership, the key port (`keyport.ts`) delivers
  the keys, BeeKEM or MLS; the service at the relay is in `service.ts`.
- `src/candidates/zustellung/`: the wires of the delivery bench.
- `src/lab/mehrgeraet/`: the multi-device bench (E15): target model,
  holder device, world, scenarios.
- `rust/`: WebAssembly wrappers (`p2panda-wasm`, `beekem-wasm`, `mls-wasm`),
  built by `scripts/build-wasm.sh`; the bindings land under
  `src/candidates/*/pkg/`. `rust/mls-wasm/examples/vectors.rs` exchanges
  KeyPackage, Welcome, Commit and message as raw bytes with other MLS
  implementations (`cargo run --example vectors`).
- Candidates marked `nodeOnly` run only in Node and in CI; the browser page
  states the reason.

## Commands

```sh
pnpm install
pnpm wasm                       # build the Rust wrappers (Rust 1.96, wasm-bindgen 0.2.129)
pnpm server:fetch               # Subduction server (Rust binary) for Keyhive over ARK
pnpm test                       # bench tests
pnpm test:rust                  # native tests of the Rust wrappers
REPORT=1 pnpm vitest run report # result table of all candidates and matrix.md
pnpm dev                        # browser run, local
```

### Live probe against the VTI mediator (E11b)

`tests/zustellung-live.test.ts` measures Rev 3 routed TSP against a live
mediator. It needs the network, is skipped by default and never enters
the report. Results: `src/candidates/zustellung/NOTES.md`, section
"E11b live".

```sh
RLTP_LIVE_MEDIATOR=1 pnpm vitest run tests/zustellung-live.test.ts
```

| Variable | Meaning | Default |
|---|---|---|
| `RLTP_LIVE_MEDIATOR` | `1` runs the probe | off |
| `MEDIATOR_DID` | another mediator instance | instance of 27 September 2026 |
| `MEDIATOR_ALLOW_INSECURE` | `1` sets net policy `allowInsecure` and `allowPrivate` (local mediator) | off |
| `RLTP_WIRE_DEBUG` | `1` prints row outcomes and error classes on stderr | off |
| `E11B_FORMS` | comma list of forms (`D-c,D-es,D-e,R-cc,R-c,R-c',R-es,R-ce`) | all |
| `E11B_RUNS` | runs per form pass (integer ≥ 1) | 3 |
| `E11B_TIMEOUT_MS` | delivery window and ack deadline | 20000 |
| `E11B_PROTOCOL_OUT` | path of the protocol JSON | `.cache/e11b-live/<UTC-ISO>.json` |

The post-observation per form pass is the constant `OBSERVE_MS` (30 s),
not a variable.

The protocol holds no keys, seeds, tokens, payloads or error texts: only
shortened DIDs, digest prefixes, counts, hosts and values from fixed lists.

The browser page is published via GitHub Pages on every push to `main`.
There, all runs can be started on a real device (S9, for example on
GrapheneOS) and the result copied as JSON.

## License

[MIT](LICENSE). The vendored p2panda crates under `rust/p2panda-wasm/vendor/`
keep their own license, MIT OR Apache-2.0; the texts are in
[`rust/p2panda-wasm/vendor/LICENSES/`](rust/p2panda-wasm/vendor/LICENSES/).
