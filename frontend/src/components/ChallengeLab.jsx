import { useEffect, useRef, useState } from "react";
import { ArrowRight, Check, Download, GitBranch, Play, RotateCcw, ShieldCheck, SkipForward } from "lucide-react";
import { getChallengeCatalog, createChallengeRun, getChallengeRun, controlChallengeRun, challengeExportUrl } from "../services/api";

import AllocationCluster from "./AllocationCluster";

const savedId = (id) => { try { return sessionStorage.getItem(`gpu-challenge-${id}`); } catch { return null; } };
const savedChallenge = () => {
  try { const id = sessionStorage.getItem("gpu-active-challenge"); return ["C1", "C2", "C3", "C4", "C5"].includes(id) ? id : "C1"; }
  catch { return "C1"; }
};
const releasedVector = (value) => Array.isArray(value) ? value.join(", ") : Object.entries(value || {}).map(([key, amount]) => `${key} × ${amount}`).join(", ");
const message = (error) => typeof error.response?.data?.detail === "string" ? error.response.data.detail : error.message;

function NodePanel({ engine, rejected, contextKey, busy, error }) {
  return <section className="challenge-engine"><div className="challenge-engine-title"><h3>{engine.label}</h3><span>{engine.running} running · {engine.waiting} waiting</span></div>
    <AllocationCluster resources={{gpus:Object.fromEntries(engine.nodes.map((node) => [node.gpu_id,node]))}} jobs={engine.jobs} contextKey={`${contextKey}:${engine.label}`} busy={busy} error={error} title={engine.label} policy={engine.placement_rule} compact />
    <div className="challenge-utilization"><span>Compute <strong>{engine.compute_utilization}%</strong></span><span>Memory <strong>{engine.memory_utilization}%</strong></span><span>Mean of both <strong>{engine.aggregate_utilization}%</strong></span></div>
    <div className="challenge-jobs">{engine.jobs.map((job) => <details key={job.job_id}><summary><strong>{job.name}</strong><span>({job.compute_required}, {job.memory_required}){job.required_node_type ? ` · type ${job.required_node_type}` : ""}</span><b className={`job-state ${job.status.toLowerCase()}`}>{job.status}</b></summary><p>{job.allocation_explanation.headline}</p>{job.allocation_explanation.candidates.map((candidate) => <p key={candidate.gpu_id}><strong>{candidate.gpu_id}</strong> — {candidate.compatible === false ? `Type ${candidate.node_type} does not match ${candidate.required_node_type}` : candidate.eligible ? "Vector fits" : `Deficit: ${Object.entries(candidate.blocking_resources).map(([key, value]) => `${key} ${value}`).join(", ") || "No current capacity"}`}{candidate.remaining_memory_after != null ? ` · ${candidate.remaining_memory_after} memory left after placement` : ""}</p>)}<p>Recorded placement rule: {job.allocation_explanation.placement_rule || engine.placement_rule}.</p></details>)}{rejected.filter((job) => job.engine === engine.label).map((job) => <div key={job.name} className="challenge-rejection"><strong>{job.name}</strong><b className="job-state rejected">REJECTED</b><p>{job.reason}</p><small>Not admitted; holds no resources and blocks no queued jobs.</small></div>)}</div>
  </section>;
}

function WaitGraph({ state }) {
  const cycle = state.cycles?.length > 0;
  const deadlocked = state.deadlock;
  const edges = Object.values(state.edges.reduce((groups, edge) => {
    const key = `${edge.from}:${edge.to}`;
    if (!groups[key]) groups[key] = { ...edge, resources: [] };
    groups[key].resources.push(edge.resource);
    return groups;
  }, {}));
  const safeSequence = state.safe_sequence == null ? "unavailable" : state.safe_sequence.length ? state.safe_sequence.join(" -> ") : "all processes completed";
  return <section className="challenge-reservation"><div className="challenge-engine-title"><h3>{state.multi_unit ? "Multi-unit reservations" : "Two-step reservations"}</h3><span className={cycle ? "cycle-warning" : ""}>{cycle ? "CIRCULAR WAIT DETECTED" : deadlocked ? "DEADLOCK DETECTED BY REQUEST REDUCTION" : "No reported deadlock"}</span></div>
    <div className={`wait-graph ${cycle ? "has-cycle" : ""}`}><svg viewBox="0 0 680 230" role="img" aria-label={cycle ? "Wait-for graph: A waits for B, B waits for A" : `Wait-for graph with ${state.edges.length} waiting edges`}><defs><marker id="wait-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0 0 10 5 0 10Z" fill="currentColor" /></marker><pattern id="wait-grid" width="20" height="20" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r=".7" fill="currentColor" opacity=".15" /></pattern></defs><rect width="680" height="230" fill="url(#wait-grid)" />{edges.map((edge) => <g key={`${edge.from}-${edge.to}`}><path d={edge.from === "A" ? "M240 84Q340 16 440 84" : "M440 143Q340 210 240 143"} fill="none" stroke="currentColor" strokeWidth="2" markerEnd="url(#wait-arrow)" className="wait-edge" /><text x="340" y={edge.from === "A" ? 37 : 210} textAnchor="middle">{edge.from} waits for {edge.resources.join(" + ")}</text></g>)}{["A", "B"].map((id, index) => { const task = state.processes.find((item) => item.id === id); return <g key={id} transform={`translate(${index ? 500 : 180} 115)`}><circle r="53" className={`process-circle ${task?.status === "ABORTED" ? "aborted" : ""}`} /><text className="process-id" textAnchor="middle" y="-8">{id}</text><text textAnchor="middle" y="15">{task?.status || "NOT STARTED"}</text><text textAnchor="middle" y="83">Holds: {task?.held.join(" + ") || "none"}</text>{state.multi_unit && <text textAnchor="middle" y="100">Restarts: {task?.restarts ?? 0}</text>}</g>; })}</svg></div>
    <div className="reservation-slots">{Object.entries(state.resources).map(([resource, owner]) => <div key={resource}><span>{resource} / {state.resource_vectors?.total[resource] || 1} {(state.resource_vectors?.total[resource] || 1) === 1 ? "UNIT" : "UNITS"}</span><strong>{owner ? `Reserved by ${owner}` : "Available"}</strong><i className={owner ? "held" : ""} /></div>)}</div>
    <p className="challenge-graph-note">{state.multi_unit ? `Mode ${state.mode}. Safe sequence: ${safeSequence}. Restarts: ${state.processes.map((task) => `${task.id}=${task.restarts}`).join(", ")}. Multi-unit detection uses request reduction; arrows show dependencies.` : cycle ? "A → B → A: each process holds a resource the other needs. The next step aborts B, the younger process in this cycle." : state.processes.some((task) => task.status === "ABORTED") ? "B was aborted. Its holdings were released, allowing A's pending request to proceed. The event log records both changes." : "Edges appear only when a process waits on a resource held by another process."}</p>
  </section>;
}

function ChallengeLab({ connected }) {
  const [catalog, setCatalog] = useState([]);
  const [selected, setSelected] = useState(savedChallenge);
  const [run, setRun] = useState(null);
  const [epoch, setEpoch] = useState(0);
  const [reservationMode, setReservationMode] = useState("LEGACY");
  const [victimPolicy, setVictimPolicy] = useState("ABORT_YOUNGEST_IN_CYCLE");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [seen, setSeen] = useState({});
  const generation = useRef(0);
  const inFlight = useRef(false);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    let active = true;
    getChallengeCatalog().then((response) => { if (active) setCatalog(response.data.challenges); }).catch((err) => { if (active) setError(message(err)); });
    return () => { active = false; alive.current = false; };
  }, []);
  useEffect(() => {
    const token = ++generation.current;
    const id = savedId(selected);
    if (id) getChallengeRun(id).then((response) => { if (generation.current === token && alive.current) setRun(response.data); }).catch((err) => { if (err.response?.status !== 404 && generation.current === token && alive.current) setError(message(err)); });
  }, [selected]);
  const choose = (id) => {
    if (id === selected) return;
    ++generation.current;
    setSelected(id); setRun(null); setError("");
    try { sessionStorage.setItem("gpu-active-challenge", id); } catch { /* Optional storage. */ }
  };
  const execute = async (action) => {
    if (inFlight.current) return;
    inFlight.current = true; setBusy(true); setError("");
    const token = ++generation.current;
    const valid = () => alive.current && generation.current === token;
    try {
      let current = run;
      if (current) {
        try { current = (await getChallengeRun(current.run_id)).data; }
        catch (err) { if (err.response?.status !== 404) throw err; current = null; }
      }
      const storageKey = selected === "C4" && reservationMode !== "LEGACY" ? `${selected}:${reservationMode}:${victimPolicy}` : selected;
      if (!current && savedId(storageKey)) {
        try { current = (await getChallengeRun(savedId(storageKey))).data; }
        catch (err) { if (err.response?.status !== 404) throw err; }
      }
      if (!valid()) return;
      if (!current) {
        current = (await createChallengeRun(selected, selected === "C4" ? {reservation_mode:reservationMode,victim_policy:victimPolicy} : {})).data;
        try { sessionStorage.setItem(`gpu-challenge-${storageKey}`, current.run_id); } catch { /* Optional storage. */ }
      }
      if (!valid()) return;
      if (action === "reset") current = (await controlChallengeRun(current.run_id, "reset")).data;
      if (action === "step") current = (await controlChallengeRun(current.run_id, "step")).data;
      if (action === "all") while (!current.complete && valid()) { current = (await controlChallengeRun(current.run_id, "step")).data; if (valid()) setRun(current); }
      if (valid()) { setRun(current); if (action === "reset") setEpoch((value) => value + 1); if (current.complete) setSeen((previous) => ({ ...previous, [selected]: true })); }
    } catch (err) { if (alive.current) setError(message(err)); }
    finally { inFlight.current = false; if (alive.current) setBusy(false); }
  };
  const definition = run?.definition || catalog.find((item) => item.id === selected);
  const next = definition?.steps[run?.step_index || 0];
  return <div className="challenge-lab"><div className="challenge-heading"><div><span className="studio-eyebrow">KERNEL OPS / OSH018</span><h1>The challenge bench.</h1><p>Five edge cases. Inspect the state change, verify the accounting, and keep the evidence.</p></div><span className="studio-pill"><ShieldCheck size={13} />Isolated simulations</span></div>
    <nav className="challenge-picker" aria-label="Choose organizer challenge">{catalog.map((item) => <button type="button" key={item.id} aria-current={selected === item.id ? "page" : undefined} onClick={() => choose(item.id)} disabled={busy} className={selected === item.id ? "selected" : ""}><span>{item.id}{seen[item.id] && <Check size={12} />}</span><strong>{item.title}</strong><small>{item.difficulty}</small></button>)}</nav>
    {error && <div className="studio-error" role="alert">{error}<button type="button" onClick={() => getChallengeCatalog().then((response) => { setCatalog(response.data.challenges); setError(""); }).catch((err) => setError(message(err)))}>Retry connection</button></div>}
    {selected === "C4" && <div className="arena-builder replay-lab"><label>Reservation mode<select value={reservationMode} disabled={busy} onChange={(event) => { ++generation.current; setReservationMode(event.target.value); setRun(null); }}><option value="LEGACY">Recovery - original unit scenario</option><option value="NAIVE">NAIVE - multi-unit</option><option value="AVOIDANCE">AVOIDANCE - multi-unit</option><option value="DETECT_RECOVER">DETECT / RECOVER - multi-unit</option></select></label><label>Victim policy<select value={victimPolicy} disabled={busy || reservationMode !== "DETECT_RECOVER"} onChange={(event) => { ++generation.current; setVictimPolicy(event.target.value); setRun(null); }}><option value="ABORT_YOUNGEST_IN_CYCLE">Youngest</option><option value="COST_WEIGHTED">Work + held units</option></select></label></div>}
    {definition && <><div className="challenge-description"><div><span className="studio-eyebrow">{definition.code} / {definition.difficulty.toUpperCase()}</span><h2>{definition.title}</h2><p>{definition.mechanism}</p></div><span className="challenge-unit-note">Compute / memory<br />simulated units</span></div>
      <div className="challenge-control"><div><span>{run?.complete ? "SCENARIO COMPLETE" : `STEP ${run?.step_index || 0} OF ${definition.steps.length}`}</span><strong>{run?.complete ? "Review the state and export your evidence." : next?.label}</strong></div><div><button type="button" className="studio-button secondary" onClick={() => execute("reset")} disabled={busy || connected === false} aria-label="Reset challenge"><RotateCcw size={15} /></button><button type="button" className="studio-button primary" onClick={() => execute(run ? "step" : "start")} disabled={busy || run?.complete || connected === false}>{run ? <SkipForward size={15} /> : <Play size={15} />}{busy ? "Running…" : run ? "Next step" : "Start scenario"}</button>{run && !run.complete && <button type="button" className="studio-button secondary" onClick={() => execute("all")} disabled={busy || connected === false}>Run remaining <ArrowRight size={14} /></button>}</div></div>
      <div className="challenge-step-strip">{definition.steps.map((operation, index) => <div key={index} className={index < (run?.step_index || 0) ? "done" : index === (run?.step_index || 0) ? "next" : ""}><span>{index < (run?.step_index || 0) ? <Check size={12} /> : String(index + 1).padStart(2, "0")}</span><small>{operation.label}</small></div>)}</div>
      {!run ? <div className="challenge-ready"><GitBranch size={34} /><h3>A fresh cluster for this case.</h3><p>{definition.nodes.length ? definition.nodes.map((node) => `${node.gpu_id}${node.node_type !== "GENERIC" ? ` type ${node.node_type}` : ""}: (${node.compute_units}, ${node.memory})`).join(" · ") : "G1 = 1 unit · G2 = 1 unit · two processes"}</p><span>Start the scenario to create actual state. Each step calls the local engine.</span></div> : <><div className={`challenge-engine-grid ${run.engines.length === 2 ? "comparison" : ""}`}>{run.engines.map((engine) => <NodePanel key={engine.label} engine={engine} rejected={run.rejections} contextKey={`${run.run_id}:${epoch}`} busy={busy} error={error} />)}</div>{run.reservations && <WaitGraph state={run.reservations} />}
        {run.events.at(-1)?.outcomes.some((outcome) => outcome.before) && <div className="lab-release-note"><strong>{run.events.at(-1).outcomes.every((outcome) => outcome.changed === false) ? "No mutation" : "Confirmed operation"}</strong><p>{run.events.at(-1).outcomes.filter((outcome) => outcome.before).map((outcome) => `${outcome.engine}: free (${outcome.before.compute_units}, ${outcome.before.memory}) → (${outcome.after.compute_units}, ${outcome.after.memory})${outcome.changed === false ? "; no resources released again" : ""}`).join(" · ")}</p></div>}
        <div className="challenge-proof"><span><ShieldCheck size={16} />{run.invariants_ok ? "Resource accounting verified after this step" : "Resource accounting check failed"}</span><a href={challengeExportUrl(run.run_id)} download><Download size={14} />Export executed steps</a></div>
        {selected === "C3" && run.complete && <div className="challenge-tradeoff"><strong>A placement trade-off, measured.</strong><p>Both rules admit two jobs and use 83.33% of the mean compute/memory capacity. First fit strands 4 memory units; memory best fit strands 4 compute units and admits J2 earlier. Neither rule can fit all three jobs at once. This example demonstrates why the workload mix matters.</p></div>}
        {run.events.length > 0 && <section className="challenge-events"><div><h3>Execution record</h3><span>{run.events.length} recorded operations</span></div>{run.events.map((event) => <details key={event.sequence} open={event.sequence === run.step_index}><summary><span>{String(event.sequence).padStart(2, "0")}</span><strong>{event.operation.label}</strong><small>{event.outcomes.map((outcome) => outcome.status || outcome.action).join(" / ")}</small></summary>{event.outcomes.map((outcome, index) => <div className="challenge-event-detail" key={index}><strong>{outcome.engine || outcome.process || "Reservation engine"}</strong>{outcome.before ? <p>Available vector: ({outcome.before.compute_units}, {outcome.before.memory}) → ({outcome.after.compute_units}, {outcome.after.memory}){outcome.changed === false ? " · no mutation" : ""}</p> : <p>{outcome.action}{outcome.released ? ` · released ${releasedVector(outcome.released)}` : ""}</p>}{outcome.granted_processes?.length > 0 && <p>Pending grants: {outcome.granted_processes.join(", ")}</p>}{outcome.granted?.length > 0 && <p>Pending requests granted: {outcome.granted.map((grant) => `${grant.process} receives ${grant.resource}`).join(", ")}</p>}{outcome.reason && <p>{outcome.reason}</p>}</div>)}</details>)}</section>}</>}
      <section className="challenge-assumptions"><h3>Mechanism and assumptions</h3>{definition.assumptions.map((assumption) => <p key={assumption}>{assumption}</p>)}<small>These are the five organizer options. The assigned challenge is confirmed at the event. Sessions reset when the engine restarts; exported evidence is independent.</small></section></>}
    {!definition && !error && <div className="challenge-ready"><p>Connecting to the local challenge engine…</p></div>}
  </div>;
}

export default ChallengeLab;
