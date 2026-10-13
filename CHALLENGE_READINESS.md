# Kernel Ops / Bhailog / OSH018 — challenge readiness

Open **Challenge lab** from the shared sidebar. These are five organizer options; the event confirms which are assigned. Each case has an isolated engine session, individual step controls, invariant checks, recorded operations, and JSON export. No real systems or GPUs are altered.

| Case | What to show | Verified result |
| --- | --- | --- |
| C1: vector fit and release | Start; submit J1; submit J2; release J1 | N1=(4,8). J1=(2,6) runs; J2=(3,3) waits. Completing J1 starts J2; available becomes (1,5). Neither dimension exceeds capacity. |
| C2: repeat cancellation | Allocate J1; cancel twice; cancel J99 | First cancellation restores (4,8). Second records ALREADY_TERMINAL, unknown records NOT_FOUND. Both leave resources unchanged. |
| C3: fragmentation | Step through the same arrivals in both columns | First fit runs J1 on N1 and J3 on N2, leaving J2 waiting and (0,4) free. Memory best fit runs J1 on N2 and J2 on N1, leaving J3 waiting and (4,0) free. Both run two jobs with 83.33% mean utilization. |
| C4: circular wait | Step until A waits for B and B waits for A; recover | Graph detects A→B→A. Recovery aborts B, the youngest process in the cycle. G2 becomes available and is granted to A. Completing A restores both unit resources. |
| C5: node type | Submit type Z request, then X and Y | J0 is rejected before admission. J1 runs only on X; J2 only on Y. Rejected demand holds nothing, consumes no ID, and does not block feasible jobs. |

## A strong demonstration

1. Show C1's resource segments and the transition from waiting to running.
2. Show C2's resource vector before and after both no-op operations.
3. Show C3 side by side. Explain the choice: memory best fit places the small job on the node with the smallest remaining memory, preserving the memory-rich node for J2. This uses current availability, not future arrivals.
4. Show C4 at step 4 before recovery. Point to both arrows; then execute recovery and show the recorded release and grant. Finish A.
5. Show C5's rejected J0 and both compatible placements. Export JSON, including the intermediate state snapshots.

## Boundaries to explain

- The C3 supplied workload cannot fit all three jobs simultaneously: demand is (16,16) while the cluster is (12,12). Memory best fit is an added placement heuristic, not a universally superior or globally novel scheduler. It improves memory utilization in this trace while sacrificing compute utilization. Report both dimensions.
- C4 is a separate partial-acquisition simulator with two unit resources and one pending request per process. The ordinary GPU scheduler still acquires a full resource vector atomically, so its deadlock status remains not applicable. Recovery aborts work; it does not invisibly restart it.
- Matching is exact and case-sensitive. Untyped requests accept any node. Typed requests without a compatible node of sufficient total capacity are rejected before allocation. Occupied compatible capacity causes waiting.
- Sessions reset with the engine. Export evidence before restarting. The JSON includes only steps actually executed, plus initial and intermediate snapshots.

## Code and checks

The existing `Simulation` engine now accepts custom node capacities/types and records eligibility, compatibility and placement choice. `required_node_type` is available on job requests and traces. The live job API returns 422 for incompatible typed admission.

The challenge API exposes `/challenges/catalog`, `/challenges/runs`, step/reset controls, and JSON export. Its registry and per-session locks bound sessions and serialize mutations. The reservation engine maintains resource ownership, wait-for edges, cycle detection and deterministic recovery.

Run `prepare-demo.cmd` before presenting. The added tests cover the five specified workloads, repeated release, unknown IDs, impossible type/capacity, compatible-only preemption, acyclic waits, three-process cycles, terminal no-ops, bad requests, concurrent steps, reset reproducibility, export isolation and API errors.

All pages now share the observatory sidebar and one theme setting. The manual controls are embedded in that workspace, with the older sidebar converted to local tabs. Opening a menu never selects a different theme.
