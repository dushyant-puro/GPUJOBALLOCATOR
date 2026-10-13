import { useEffect, useRef, useState } from "react";

import { Play, Pause, SkipForward, RotateCcw, Plus, Trash2, Clock3 } from "lucide-react";

import {

  getReplayPresets, listReplayRuns, createReplayRun, getReplayRun,

  controlReplayRun, deleteReplayRun,

} from "../services/api";

import "./ReplayLab.css";
import AllocationCluster from "./AllocationCluster";



const format = (value) => Number(value ?? 0).toFixed(2);

const exampleTrace = JSON.stringify([

  { name: "Training", compute_required: 8, memory_required: 16, priority: 1, arrival_seconds: 0, duration_seconds: 20 },

  { name: "Evaluation", compute_required: 2, memory_required: 4, priority: 5, arrival_seconds: 5, duration_seconds: 6 },

], null, 2);



function ReplayLab() {

  const [presets, setPresets] = useState([]);

  const [policies, setPolicies] = useState([]);

  const [runs, setRuns] = useState([]);

  const [selectedId, setSelectedId] = useState("");

  const [run, setRun] = useState(null);

  const [preset, setPreset] = useState("MIXED");

  const [agingRate, setAgingRate] = useState(1);
  const [placement, setPlacement] = useState("NORMALIZED");

  const [policy, setPolicy] = useState("RESOURCE_BALANCED");

  const [seed, setSeed] = useState(42);

  const [count, setCount] = useState(30);

  const [custom, setCustom] = useState(false);

  const [traceText, setTraceText] = useState(exampleTrace);

  const [busy, setBusy] = useState(false);

  const [error, setError] = useState("");

  const [selectedJob, setSelectedJob] = useState(null);

  const generation = useRef(0);
  const alive = useRef(true);
  const [epoch, setEpoch] = useState(0);
  useEffect(() => { alive.current = true; return () => { alive.current = false; generation.current += 1; }; }, []);

  const busyRef = useRef(false);



  useEffect(() => {

    let alive = true;

    Promise.all([getReplayPresets(), listReplayRuns()]).then(([catalog, inventory]) => {

      if (!alive) return;

      setPresets(catalog.data.presets);

      setPolicies(catalog.data.policies);

      setRuns(inventory.data.runs);

      const saved = sessionStorage.getItem("gpu-replay-run");

      if (inventory.data.runs.some((item) => item.run_id === saved)) setSelectedId(saved);

    }).catch(() => { if (alive) setError("Replay API unavailable. Restart the backend with the updated code."); });

    return () => { alive = false; };

  }, []);



  useEffect(() => {

    if (!selectedId) return;

    let alive = true;

    let polling = false;

    const refresh = async () => {

      if (polling || busyRef.current) return;

      polling = true;

      const version = generation.current;

      try {

        const response = await getReplayRun(selectedId);

        if (alive && version === generation.current && !busyRef.current) {

          setRun(response.data);

        }

      } catch (err) {

        if (alive && version === generation.current) {

          setError(err.response?.data?.detail || "Could not refresh replay.");

          if (err.response?.status === 404) {

            setSelectedId("");

            setRun(null);

            setRuns([]);

            sessionStorage.removeItem("gpu-replay-run");

          }

        }

      } finally { polling = false; }

    };

    sessionStorage.setItem("gpu-replay-run", selectedId);

    refresh();

    const timer = setInterval(refresh, 500);

    return () => { alive = false; clearInterval(timer); };

  }, [selectedId]);



  const perform = async (operation) => {

    if (busyRef.current) return;

    busyRef.current = true;

    generation.current += 1;

    setBusy(true);

    setError("");

    try { await operation(); }

    catch (err) {

      const detail = err.response?.data?.detail || err.message;

      if (alive.current) setError(typeof detail === "string" ? detail : JSON.stringify(detail));

    } finally { busyRef.current = false; if (alive.current) setBusy(false); }

  };



  const create = () => perform(async () => {

    const payload = { name: custom ? "Custom trace" : `${presets.find((item) => item.id === preset)?.name || preset} · seed ${seed}`,

      preset, policy, placement_rule: placement, aging_rate: Number(agingRate), seed: Number(seed), count: Number(count) };

    if (custom) payload.jobs = JSON.parse(traceText);

    const response = await createReplayRun(payload);

    if (!alive.current) return;
    setRun(response.data);

    setSelectedId(response.data.run_id);

    setSelectedJob(null);

    const inventory = await listReplayRuns();
    if (alive.current) setRuns(inventory.data.runs);

  });



  const control = (action, extra = {}) => perform(async () => {

    const response = await controlReplayRun(selectedId, { action, ...extra });

    if (!alive.current) return;
    setRun(response.data);

    if (action === "reset") { setSelectedJob(null); setEpoch((value) => value + 1); }

  });



  const remove = () => perform(async () => {

    await deleteReplayRun(selectedId);
    if (!alive.current) return;

    setSelectedId("");

    setRun(null);

    setSelectedJob(null);

    sessionStorage.removeItem("gpu-replay-run");

    const inventory = await listReplayRuns();
    if (alive.current) setRuns(inventory.data.runs);

  });



  const playing = run?.status === "PLAYING";

  const finished = run?.status === "COMPLETED" || run?.status === "STALLED";

  const horizon = Math.max(1, run?.time_seconds || 0, run?.next_event_seconds || 0,

    ...(run?.trace || []).map((job) => job.arrival_seconds + job.duration_seconds));

  const inspected = run?.jobs.find((job) => job.job_id === selectedJob);

  const jobLabel = (job) => `${job.name} · ${job.status} · ${format(job.remaining_duration_seconds)}s remaining`;



  return (

    <div className="replay-lab">

      <div className="replay-heading">

        <div><span className="replay-eyebrow">SIMULATION ENGINE</span><h2>Replay Lab</h2>

          <p>Give jobs a runtime. Watch the queue evolve, inspect interruptions, and replay the same scenario.</p></div>

        <span className="replay-isolation">Isolated from your live workspace</span>

      </div>



      {error && <div className="replay-error" role="alert">{error}</div>}



      <div className="replay-builder">

        <label>Scenario<select value={preset} disabled={busy || custom} onChange={(event) => {

          setPreset(event.target.value);

          if (event.target.value === "PREEMPTION") setPolicy("PREEMPTIVE");

        }}>{presets.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>

        <label>Policy<select value={policy} disabled={busy} onChange={(event) => setPolicy(event.target.value)}>

          {policies.map((item) => <option key={item} value={item}>{item === "SJF" ? "SJF · remaining runtime" : item.replaceAll("_", " ")}</option>)}

        </select></label>

        <label>Seed<input type="number" value={seed} disabled={busy || custom} onChange={(event) => setSeed(event.target.value)} /></label>

        <label>Jobs<input type="number" min="1" max="200" value={custom ? count : ({PREEMPTION:4,INFEASIBLE:4,FRAGMENTATION_TRAP:4,FAIRNESS_STREAM:94}[preset] || count)} disabled={busy || custom || !["MIXED", "BURST"].includes(preset)} onChange={(event) => setCount(event.target.value)} /></label>

        <button type="button" className="replay-primary" disabled={busy || !presets.length} onClick={create}><Plus size={16} />Create run</button>

      </div>

      <p className="replay-hint">{custom ? "Use arrival_seconds and duration_seconds to describe your own workload." : presets.find((item) => item.id === preset)?.description}</p>

      <label className="replay-run-selector">Placement rule<select value={placement} disabled={busy} onChange={(event) => setPlacement(event.target.value)}>{["NORMALIZED","FIRST_FIT","MEMORY_BEST_FIT","BEST_FIT_PACKING","ALIGNMENT"].map((rule) => <option key={rule} value={rule}>{rule.replaceAll("_"," ")}{rule === "ALIGNMENT" ? " · experimental ablation" : ""}</option>)}</select></label>

      {policy === "PRIORITY_AGING" && <label className="replay-run-selector">Aging priority units / second<input type="number" min="0.01" max="100" step="0.01" value={agingRate} disabled={busy} onChange={(event) => setAgingRate(event.target.value)} /></label>}
      <label className="replay-custom"><input type="checkbox" checked={custom} disabled={busy} onChange={(event) => setCustom(event.target.checked)} /> Use a custom JSON trace</label>

      {custom && <textarea className="replay-trace-editor" aria-label="Custom job trace JSON" spellCheck="false" value={traceText} onChange={(event) => setTraceText(event.target.value)} />}



      {runs.length > 0 && <label className="replay-run-selector">Open scenario<select value={selectedId} disabled={busy} onChange={(event) => {

        generation.current += 1;

        setSelectedId(event.target.value);

        setRun(null);

        setSelectedJob(null);

      }}><option value="">Select a run</option>{runs.map((item) => <option key={item.run_id} value={item.run_id}>{item.name} · {item.policy} · {item.run_id.slice(0, 6)}</option>)}</select></label>}



      {!run ? <div className="replay-empty"><Clock3 size={34} /><h3>A workload, a clock, a clear story.</h3><p>Create a scenario or open an existing run to begin. Every run owns a fresh three-GPU cluster. Up to 200 jobs per run.</p></div> : <>

        <div className="replay-controls">

          <div className="replay-clock"><span>VIRTUAL TIME</span><strong>{format(run.time_seconds)}<small> s</small></strong></div>

          <span className={`replay-state replay-state-${run.status.toLowerCase()}`}>{run.status}</span>

          <button type="button" disabled={busy || finished} onClick={() => control(playing ? "pause" : "play")}>{playing ? <Pause size={16} /> : <Play size={16} />}{playing ? "Pause" : "Play"}</button>

          <button type="button" disabled={busy || playing || finished} onClick={() => control("step")}><SkipForward size={16} />Next event</button>

          <button type="button" disabled={busy || playing || finished} onClick={() => control("advance", { seconds: 5 })}>+5 seconds</button>

          <label className="replay-speed">Speed<select aria-label="Playback speed" value={run.speed} disabled={busy} onChange={(event) => control("speed", { speed: Number(event.target.value) })}>{[0.5, 1, 2, 5, 10, 25].map((speed) => <option key={speed} value={speed}>{speed}×</option>)}</select></label>

          <button type="button" disabled={busy} onClick={() => control("reset")}><RotateCcw size={16} />Reset</button>

          <button type="button" className="replay-delete" disabled={busy} onClick={remove} aria-label="Delete selected run"><Trash2 size={16} /></button>

        </div>

        {run.resources.demand_fragmentation && <p className="replay-hint">Placement: {run.placement_rule} · fragmentation-blocked jobs: {run.resources.demand_fragmentation.blocked_by_fragmentation} · stranded free capacity: {format(run.resources.demand_fragmentation.stranded_capacity * 100)}%</p>}

        {run.status === "STALLED" && <div className="replay-notice">No future event can unblock the remaining jobs. Inspect their capacity deficits or reset with another trace.</div>}

        <div className="replay-metrics">{[

          ["Scheduled", run.metrics.scheduled], ["Waiting", run.metrics.waiting], ["Running", run.metrics.running],

          ["Completed", `${run.metrics.completed} / ${run.total_jobs}`], ["Mean completed wait", `${format(run.metrics.mean_wait_seconds)} s`],

        ].map(([label, value]) => <div key={label}><span>{label}</span><strong>{value}</strong></div>)}</div>



        <AllocationCluster resources={run.resources} jobs={run.jobs} contextKey={`${run.run_id}:${epoch}`} title="Inside this replay" policy={run.placement_rule} busy={busy} error={error} selectedJobId={selectedJob} onSelectJob={setSelectedJob} />



        <div className="replay-timeline-heading"><h3>Job timeline</h3><div className="replay-legend"><span><i className="replay-running" />Running</span><span><i className="replay-waiting" />Waiting</span><span><i className="replay-scheduled" />Scheduled arrival</span></div></div>

        <div className="replay-timeline-scroll"><div className="replay-timeline">

          <div className="replay-axis"><span>0 s</span><span>{format(horizon / 2)} s</span><span>{format(horizon)} s</span></div>

          {run.jobs.map((job) => <button type="button" className={`replay-job-row ${selectedJob === job.job_id ? "selected" : ""}`} key={job.job_id} onClick={() => setSelectedJob(job.job_id)} title={jobLabel(job)}>

            <div className="replay-job-label"><strong>{job.name}</strong><span>{job.status} · {job.gpu_id || (job.last_gpu_id ? `previous ${job.last_gpu_id}` : "unassigned")}</span></div>

            <div className="replay-track">{job.timeline.filter((interval) => interval.end > interval.start).map((interval, index) => <i key={index} className={interval.status === "RUNNING" ? "replay-running" : "replay-waiting"} style={{ left: `${interval.start / horizon * 100}%`, width: `${(interval.end - interval.start) / horizon * 100}%` }} title={`${interval.status}: ${format(interval.start)}–${format(interval.end)} s`} />)}<b className="replay-time-marker" style={{ left: `${run.time_seconds / horizon * 100}%` }} /></div>

          </button>)}

          {run.pending_jobs.map((job) => <div className="replay-job-row" key={`pending-${job.trace_index}`}><div className="replay-job-label"><strong>{job.name}</strong><span>SCHEDULED · arrives {format(job.arrival_seconds)} s</span></div><div className="replay-track"><i className="replay-arrival" style={{ left: `${job.arrival_seconds / horizon * 100}%` }} /><b className="replay-time-marker" style={{ left: `${run.time_seconds / horizon * 100}%` }} /></div></div>)}

        </div></div>

        <p className="replay-hint">Click an arrived job to inspect its latest decision. Reset reuses the exact trace and policy.</p>



        {inspected && <div className="replay-inspector"><div><h3>{inspected.name}</h3><span>{format(inspected.execution_duration_seconds)} s executed · {format(inspected.waiting_duration_seconds)} s waited · {format(inspected.remaining_duration_seconds)} s remaining</span></div><strong>{inspected.allocation_explanation.headline}</strong>

          {inspected.allocation_explanation.reasons.map((reason) => <p key={reason}>{reason}</p>)}

          {(inspected.allocation_explanation.candidates.length ? inspected.allocation_explanation.candidates : inspected.allocation_explanation.last_allocation?.candidates || []).map((candidate) => <div className="replay-candidate" key={candidate.gpu_id}><strong>{candidate.gpu_id}</strong><span>{candidate.eligible ? `Eligible · score ${format(candidate.score)}` : Object.entries(candidate.blocking_resources).map(([key, value]) => `${key.replaceAll("_", " ")} short ${value}`).join(" · ")}</span></div>)}

        </div>}



        <div className="replay-events"><h3>Event log <small>· latest 30 of {run.event_count}</small></h3><div>{run.events.slice(-30).reverse().map((event) => <p key={event.event_id}><time>{format(event.time_seconds)} s</time><button type="button" onClick={() => setSelectedJob(event.job_id)} disabled={event.job_id == null} aria-label={`Inspect ${event.kind} for job ${event.job_id ?? "unknown"}`}><strong>{event.kind}</strong></button><span>Job #{event.job_id}{event.gpu_id ? ` → ${event.gpu_id}` : ""}</span></p>)}</div></div>

      </>}

    </div>

  );

}



export default ReplayLab;

