import { useEffect, useRef, useState } from "react";
import { ArrowRight, ArrowUpRight, Check, CheckCircle2, Cpu, Download, Fingerprint, FlaskConical, Play, RotateCcw, ShieldCheck, Timer } from "lucide-react";
import ClusterScene from "./ClusterScene";
import reference from "../data/demo-reference.json";
import { createReplayRun, getReplayRun, controlReplayRun, createBenchmark, getBenchmark } from "../services/api";

const chapters = [
  { time: 0, title: "Fill the cluster", detail: "Three long jobs occupy all three simulated GPUs." },
  { time: 5, title: "Make room for urgency", detail: "A priority-5 job arrives. One lower-priority job is interrupted." },
  { time: 9, title: "Resume, don't restart", detail: "The urgent job finishes. Interrupted work resumes with its progress preserved." },
  { time: 24, title: "Close the loop", detail: "All four jobs finish and every resource returns to the cluster." },
];
const number = (value) => Number(value ?? 0).toFixed(1);
const errorMessage = (error) => {
  const detail = error.response?.data?.detail || error.message;
  return typeof detail === "string" ? detail : "Check the local engine and try again.";
};
const rememberedRun = () => {
  try { return sessionStorage.getItem("gpu-guided-run"); } catch { return null; }
};

function DemoStudio({ connected }) {
  const [run, setRun] = useState(null);
  const [chapter, setChapter] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [study, setStudy] = useState(null);
  const [inspectedId, setInspectedId] = useState(null);
  const runId = useRef(rememberedRun());
  const inFlight = useRef(false);
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  useEffect(() => {
    if (inspectedId) document.getElementById("allocation-record")?.scrollIntoView({ block: "center" });
  }, [inspectedId]);
  useEffect(() => {
    if (!study?.id || ["SUCCEEDED", "FAILED"].includes(study.status)) return;
    let active = true;
    let polling = false;
    const refresh = async () => {
      if (polling) return;
      polling = true;
      try { const response = await getBenchmark(study.id); if (active) setStudy(response.data); }
      catch (err) { if (active) setError(errorMessage(err)); }
      finally { polling = false; }
    };
    refresh();
    const timer = setInterval(refresh, 700);
    return () => { active = false; clearInterval(timer); };
  }, [study?.id, study?.status]);

  const jump = async (index) => {
    if (inFlight.current) return;
    inFlight.current = true; setBusy(true); setError("");
    try {
      let current;
      if (runId.current) {
        try { current = (await getReplayRun(runId.current)).data; }
        catch (err) { if (err.response?.status !== 404) throw err; runId.current = null; }
      }
      if (!runId.current) {
        current = (await createReplayRun({ name: "Hackathon guided demo", preset: "PREEMPTION", policy: "PREEMPTIVE", seed: 42, count: 4 })).data;
        runId.current = current.run_id;
        try { sessionStorage.setItem("gpu-guided-run", current.run_id); } catch { /* Storage is optional. */ }
      }
      if (current.status === "PLAYING") current = (await controlReplayRun(runId.current, { action: "pause" })).data;
      const target = chapters[index].time;
      if (current.time_seconds > target || index === 0) current = (await controlReplayRun(runId.current, { action: "reset" })).data;
      if (target > current.time_seconds) current = (await controlReplayRun(runId.current, { action: "advance", seconds: target - current.time_seconds })).data;
      if (alive.current) { setRun(current); setChapter(index); setInspectedId(null); }
    } catch (err) { if (alive.current) setError(errorMessage(err)); }
    finally { inFlight.current = false; if (alive.current) setBusy(false); }
  };
  const compare = async () => {
    if (inFlight.current) return;
    inFlight.current = true; setBusy(true); setError("");
    try {
      const response = await createBenchmark({ name: "Hackathon · urgent workload", preset: "PREEMPTION", count: 4, seeds: [42], policies: ["FCFS", "PREEMPTIVE"], baseline: "FCFS", horizon_seconds: 100, starvation_threshold_seconds: 30 });
      if (alive.current) setStudy(response.data);
    } catch (err) { if (alive.current) setError(errorMessage(err)); }
    finally { inFlight.current = false; if (alive.current) setBusy(false); }
  };
  const scene = run || reference.preview;
  const report = study?.summary || reference.report;
  const baselineWait = report.summary.find((row) => row.policy === "FCFS").metrics.p95_wait_seconds.mean;
  const preemptiveWait = report.summary.find((row) => row.policy === "PREEMPTIVE").metrics.p95_wait_seconds.mean;
  const inspected = scene.jobs.find((job) => job.job_id === inspectedId);
  const decision = inspected?.allocation_explanation;
  const candidates = decision?.candidates?.length ? decision.candidates : decision?.last_allocation?.candidates || [];
  const horizon = Math.max(24, scene.time_seconds);
  const activeStudy = study && ["QUEUED", "RUNNING"].includes(study.status);

  return <div className="demo-studio">
    <section className="studio-hero">
      <div className="observatory-intro">
        <div className="studio-eyebrow"><span />RESOURCE ALLOCATION, MADE VISIBLE</div>
        <h1>Inside the<br /><em>GPU cluster.</em></h1>
        <p>Three GPUs. Four jobs. One urgent arrival. Follow the workload from allocation to completion, and inspect every decision along the way.</p>
        <div className="studio-hero-actions"><button className="studio-button primary" disabled={busy || connected === false} onClick={() => jump(0)}><Play size={15} />{busy ? "Preparing…" : "Follow the workload"}<ArrowRight size={16} /></button><a className="studio-button secondary" href="#benchmarks">Compare policies <ArrowUpRight size={15} /></a></div>
        <div className="observatory-note"><span>01 — THE URGENT WORKLOAD</span><p>A priority-5 job needs a full GPU.<br />The cluster is already occupied. What happens next?</p></div>
      </div>
      <ClusterScene scene={scene} live={Boolean(run)} onInspect={setInspectedId} />
    </section>
    <div className="studio-stat-strip">{[["03", "Simulated GPUs"], ["06", "Scheduling policies"], ["04", "Jobs in this scenario"], ["JSON / CSV", "Exportable evidence"]].map(([value, label]) => <div key={label}><strong>{value}</strong><span>{label}</span></div>)}</div>
    <section id="guided-workload" className="studio-stage"><div className="studio-section-heading"><div><div className="studio-eyebrow">01 / FOLLOW THE WORKLOAD</div><h2>An urgent arrival changes the queue.</h2></div><span className={`studio-pill ${run ? "live" : ""}`}><span />{run ? "Live local replay" : "Prepared example"}</span></div><p className="studio-stage-intro">Step through a real simulation. Every colored interval and explanation comes from the engine.</p>
      {error && <div className="studio-error" role="alert">{error}</div>}
      <div className="studio-chapters">{chapters.map((item, index) => <button type="button" key={item.time} disabled={busy || connected === false} className={chapter === index ? "current" : ""} onClick={() => jump(index)} aria-label={`${item.title} at ${item.time} seconds`}><span>{chapter != null && index < chapter ? <Check size={14} /> : String(index + 1).padStart(2, "0")}</span><div><strong>{item.title}</strong><small>t = {item.time}s</small></div></button>)}</div>
      <div className="studio-scene-title"><span>{chapter == null ? "Prepared scene · urgent arrival" : chapters[chapter].detail}</span><div><strong>{number(scene.time_seconds)}<small> s</small></strong><button type="button" onClick={() => jump(0)} disabled={busy || connected === false} aria-label="Reset guided demo"><RotateCcw size={15} /></button></div></div>
      <div className="studio-gpu-grid">{Object.entries(scene.resources.gpus).map(([id, gpu]) => {
        const owners = scene.jobs.filter((job) => job.gpu_id === id && job.status === "RUNNING");
        const used = gpu.total.compute_units - gpu.available.compute_units;
        return <div className="studio-gpu-card" key={id}><div><span className="studio-chip-icon"><Cpu size={17} /></span><strong>{id}</strong><span className={used ? "gpu-busy" : "gpu-free"}>{used ? "Allocated" : "Available"}</span></div><h3>{owners.map((job) => job.name).join(", ") || "Ready for the next job"}</h3><div className="studio-resource-row"><span>Compute</span><strong>{used} / {gpu.total.compute_units}</strong></div><div className="studio-capacity"><i style={{ width: `${used / gpu.total.compute_units * 100}%` }} /></div><div className="studio-resource-row"><span>Memory</span><strong>{gpu.total.memory - gpu.available.memory} / {gpu.total.memory}</strong></div><div className="studio-capacity memory"><i style={{ width: `${(gpu.total.memory - gpu.available.memory) / gpu.total.memory * 100}%` }} /></div></div>;
      })}</div>
      <div className="studio-timeline-head"><h3>Work, waiting, and the exact moment of change.</h3><div><span><i />Running</span><span><i />Waiting</span></div></div><div className="studio-timeline-scroll"><div className="studio-timeline"><div className="studio-time-axis"><span>0s</span><span>12s</span><span>24s</span></div>{scene.jobs.map((job) => <button type="button" key={job.job_id} className={`studio-timeline-row ${inspectedId === job.job_id ? "selected" : ""}`} onClick={() => setInspectedId(job.job_id)}><div><strong>{job.name}</strong><span>{job.status.toLowerCase()} · {number(job.remaining_duration_seconds)}s remaining</span></div><div className="studio-time-track">{job.timeline.filter((interval) => interval.end > interval.start).map((interval, index) => <i key={index} className={interval.status === "RUNNING" ? "running" : "waiting"} style={{ left: `${interval.start / horizon * 100}%`, width: `${(interval.end - interval.start) / horizon * 100}%` }} title={`${interval.status} ${interval.start}–${interval.end}s`} />)}<b style={{ left: `${scene.time_seconds / horizon * 100}%` }} /></div></button>)}</div></div><p className="studio-click-hint"><Fingerprint size={13} />Click a job to inspect its recorded allocation decision.</p>
      {inspected && <div id="allocation-record" className="studio-decision"><div><span className="studio-eyebrow">DECISION RECORD #{decision.decision_id}</span><h3>{inspected.name}</h3><p>{decision.headline}</p></div><div className="studio-decision-stats"><span><strong>{number(inspected.execution_duration_seconds)}s</strong>Executed</span><span><strong>{number(inspected.waiting_duration_seconds)}s</strong>Waiting</span><span><strong>{number(inspected.remaining_duration_seconds)}s</strong>Remaining</span></div><div className="studio-candidates">{candidates.map((candidate) => <div key={candidate.gpu_id}><strong>{candidate.gpu_id}</strong><span className={candidate.eligible ? "eligible" : ""}>{candidate.eligible ? `Eligible · ${number(candidate.score)} score` : "Insufficient resources"}</span></div>)}</div><details><summary>Why this decision?</summary>{decision.reasons.map((reason) => <p key={reason}>{reason}</p>)}<p>Recorded policy: {decision.policy}. Candidate eligibility describes the original decision state.</p></details></div>}
      <div className="studio-scene-footer"><span><CheckCircle2 size={15} />{scene.metrics.completed} / {scene.total_jobs} completed<span className="studio-divider" />{scene.metrics.waiting} waiting<span className="studio-divider" />{scene.metrics.running} running</span><a href="#replay">Open the full replay lab <ArrowRight size={14} /></a></div>
    </section>
    <section className="studio-evidence"><div className="studio-evidence-copy"><div className="studio-eyebrow">02 / COMPARE THE POLICIES</div><h2>Same workload.<br />Different waiting times.</h2><p>The guided example compares FCFS and preemptive scheduling on the exact same four-job workload.</p><button type="button" className="studio-button primary" disabled={busy || activeStudy || connected === false} onClick={compare}><FlaskConical size={16} />{activeStudy ? "Comparing…" : "Run this comparison"}<ArrowRight size={16} /></button><small>{study?.status === "SUCCEEDED" ? "Live comparison saved to the study archive." : "Prepared reference available before the live comparison."}</small>{study?.status === "FAILED" && <p role="alert" className="studio-error">{study.error}</p>}</div><div className="studio-evidence-result"><span className="studio-pill"><Fingerprint size={12} />{study?.summary ? "Live measured result" : "Prepared reference result"}</span><div className="studio-evidence-number"><strong>{number(baselineWait - preemptiveWait)}<small>s</small></strong><span>lower p95 waiting time<br /><b>on this specific demo trace</b></span></div><div className="studio-compare-bar"><span>FCFS</span><div><i style={{ width: "100%" }} /></div><strong>{number(baselineWait)}s</strong></div><div className="studio-compare-bar optimized"><span>Preemptive</span><div><i style={{ width: `${preemptiveWait / Math.max(1, baselineWait) * 100}%` }} /></div><strong>{number(preemptiveWait)}s</strong></div><p>One fixed trace; confidence intervals are unavailable. Checkpoint and recovery costs are assumed zero.</p><div><a href={`${import.meta.env.BASE_URL}demo-evidence.json`} download><Download size={14} />Prepared evidence</a><a href="#benchmarks">All metrics <ArrowRight size={14} /></a></div></div></section>
    <div className="studio-principles">{[[Fingerprint, "Explain the choice", "Original candidates, score components, and rejected alternatives."], [Timer, "Replay the consequence", "A virtual clock, preserved progress, and exact event ordering."], [ShieldCheck, "Keep the evidence", "Paired traces, saved studies, and exportable experiment logs."]].map(([Icon, title, text]) => <div key={title}><Icon size={21} /><h3>{title}</h3><p>{text}</p></div>)}</div>
  </div>;
}

export default DemoStudio;
