# Korea V1.2 exploratory user-test protocol

**Goal:** Learn whether Korean export / warehouse / packaging users can complete core tasks without developer coaching.  
**Sample size:** 5–8 participants (exploratory, not statistically representative).  
**Build:** PackFlow V1.2 Demo with routed Korean URLs (`/ko/tools/...`).

## Participant profiles (target mix)

- Trade / shipping clerk at an SME exporter
- Warehouse / loading coordinator
- Packaging engineer or box designer

## Tasks (30–40 minutes)

| ID | Task | Deep link | Success look-like |
|----|------|-----------|-------------------|
| A | Excel → container plan | `/ko/tools/container-loading/` | Names unplaced SKUs; exports load guide |
| B | Invoice vs P/L check | `/ko/tools/packing-list-checker/` | Finds qty/unit mismatches; exports diff |
| C | T11 pallet floor brief | `/ko/tools/pallet-loading/` | Explains layers; states geometry-only limit |
| D | Open tool from link | `/ko/tools/cbm-calculator/` | Lands on tool without home; refresh keeps tool |

## Metrics (trial thresholds, not industry benchmarks)

| Metric | Target | How to measure |
|--------|--------|----------------|
| Time to first useful result | ≤ 30s on sample | Stopwatch from page open |
| Task completion (no coaching) | ≥ 80% | Pass/fail per task |
| Export usable without rework | ≥ 80% | Review PDF/CSV with participant |
| Willingness to reuse | ≥ 60% | End interview yes/maybe/no |

## Session sheet (copy per participant)

- Date / moderator / locale device:
- Role / company type:
- Task A: pass / fail · time · notes:
- Task B: pass / fail · time · notes:
- Task C: pass / fail · time · notes:
- Task D: pass / fail · time · notes:
- Confused terms:
- Missing features:
- Reuse willingness (Y/M/N) + quote:

## Out of scope for this protocol

- Measuring SEO rankings or Naver traffic
- Validating physical pallet safety
- Live carrier freight pricing
