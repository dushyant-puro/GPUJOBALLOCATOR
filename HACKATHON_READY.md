# Hackathon rehearsal — October 14, 2026

## Run it

From `GPU-Job-Allocator-main`, double-click **start-demo.cmd**. The app opens at **http://127.0.0.1:8000/studio/**. Keep the laptop running and open the page before your slot.

The production build and prepared evidence are included in this workspace. Once Python dependencies are installed, launch needs no internet or frontend dev server. This is a local simulated cluster, not a hardware GPU connection. Replay sessions reset when the server restarts; benchmark studies are saved in SQLite.

If rebuilding tonight, run `prepare-demo.cmd`. On a fresh machine, install Python and Node, then run `prepare-demo.cmd -Install` while online. This installs the locked project dependencies, runs backend tests and lint, generates evidence, and builds the UI. Use one backend process; do not add multiple workers.

If an older backend occupies port 8000, stop it in its original terminal, then launch again. Startup diagnostics are in `.demo/server-error.log`. To stop the demo server, use Task Manager to stop the Python process whose command line contains this project's backend path and `app.main:app`.

## Three-minute presentation

1. **0:00 — The problem.** “GPU work competes for compute, memory, and accelerators. Allocation needs to explain its decisions and expose the cost of each policy.” Point out that the lab models three GPUs and six scheduling policies.
2. **0:25 — Follow the workload.** Click the hero button. Three long jobs occupy the cluster. Click **Make room for urgency**: at five seconds an urgent job arrives and interrupts lower-priority work. Select an illustrated GPU and click **Inspect**, or click a job row, to see the recorded candidates and decision reasons.
3. **1:10 — Resume, don't restart.** Click the third chapter. At nine seconds the urgent job has finished. The interrupted job resumes with 15 seconds remaining, retaining its five seconds of progress. Click **Close the loop**: all four jobs complete at 24 seconds and resources are restored.
4. **1:50 — Prove the trade-off.** Click **Run this comparison**. Both policies receive the identical four-job trace. FCFS p95 accumulated waiting is 15 seconds; preemptive is four seconds. This is an 11-second reduction **on this trace**, not a universal performance claim. The interrupted long job pays the four-second wait.
5. **2:25 — Evidence and extensibility.** Open **Policy arena** to show saved experiments, paired trials, metrics, and JSON/CSV export. Open **Replay lab** to show other presets, policies, speed controls, and a virtual clock. Finish: “An inspectable scheduling lab: explain the choice, replay the consequence, retain the evidence.”

## Judge questions

For the assigned technical challenge, open **Challenge lab** and follow [the challenge rehearsal guide](CHALLENGE_READINESS.md). Each of C1–C5 has actual step controls, state changes and JSON evidence. Demonstrate the assigned case first; the five options are not automatically all compulsory.

- **What is novel?** The product combines recorded placement evidence, deterministic event replay, preserved work during interruption, and reproducible policy comparisons in one interactive workflow. Do not claim a novel scheduler or globally first algorithm; CAPE remains a future roadmap item.
- **Is it a real GPU orchestrator?** No. Resource capacities, runtime durations, and arrivals are simulated. Hardware integration is future work.
- **What does preemption cost?** This model assumes zero checkpoint/recovery overhead. A production deployment would require measurements and explicit recovery costs.
- **How strong is this result?** The demo is one fixed trace. Its result is deterministic; confidence intervals are unavailable. Use the arena with multiple distinct seeds for broader comparisons and inspect failures and incomplete trials.
- **What survives a restart?** SQLite benchmark archives; live manual/replay sessions do not. Saved evidence files can be downloaded and inspected independently.

## Before leaving home

- Rehearse all four chapters, click a job, and run the comparison once.
- Open the arena and download JSON/CSV. Keep `frontend/public/demo-evidence.json` as a reference copy.
- Turn Wi-Fi off and repeat the guided demo at the local URL.
- Test the display/projector and browser zoom. The studio supports smaller screens and light/dark themes.
- Close sleep-intensive apps; bring the charger. Avoid restarting the engine mid-presentation.

If the engine is temporarily unavailable, the homepage explicitly labels its examples and results **Prepared**. Present those as reference evidence. Do not describe them as a live run. The backend health indicator distinguishes the two.
