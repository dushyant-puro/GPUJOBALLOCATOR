import { useEffect, useId, useState } from "react";
import { ArrowUpRight, CheckCircle2, Cpu, Clock3, Layers } from "lucide-react";

const n = (value) => Number(value ?? 0);
const format = (value) => n(value).toLocaleString(undefined, { maximumFractionDigits: 2 });
const colors = ["var(--lab-job-1)", "var(--lab-job-2)", "var(--lab-job-3)", "var(--lab-job-4)"];
const identity = (job) => `${job.status}:${job.gpu_id}:${job.allocation_explanation?.decision_id}`;
const jobColor = (job) => colors[Math.abs(n(job.job_id) - 1) % colors.length];

// Only confirmed snapshots produce pulses. Initial historical states can opt out.
function useAllocationPulse(jobs, contextKey, enabled, busy, error, animateInitial) {
  const [record, setRecord] = useState({ key: null, signature: null, jobs: {}, event: null, sequence: 0 });
  const [finished, setFinished] = useState(0);
  const key = enabled && !error ? contextKey : null;
  const states = Object.fromEntries(jobs.map((job) => [job.job_id, identity(job)]));
  const signature = JSON.stringify(states);
  // Guarded snapshot reconciliation avoids an effect-induced extra render on every poll.
  if (record.key !== key || record.signature !== signature) {
    const sameContext = record.key === key && key != null;
    const changed = jobs.filter((job) => sameContext ? record.jobs[job.job_id] !== identity(job) : key != null && animateInitial);
    const relevant = changed.filter((job) => ["RUNNING", "WAITING", "COMPLETED", "CANCELLED", "REJECTED", "FAILED", "PREEMPTED"].includes(job.status));
    const sequence = record.sequence + (relevant.length ? 1 : 0);
    const transitions = relevant.filter((job) => record.jobs[job.job_id]?.split(":")[0] !== job.status);
    const incoming = transitions.filter((job) => !sameContext || !record.jobs[job.job_id]);
    const meaningful = incoming.length ? incoming : transitions.length ? transitions : relevant;
    const job = meaningful.find((item) => item.status === "WAITING") || meaningful.at(-1);
    setRecord({ key, signature, jobs: states, sequence, event: key == null || !jobs.length ? null : job ? { key: sequence, job, changed: relevant } : sameContext ? record.event : null });
  }
  const event = record.key === key && key != null ? record.event : null;
  useEffect(() => {
    if (!event) return;
    const timer = setTimeout(() => setFinished(event.key), 800);
    return () => clearTimeout(timer);
  }, [event]);
  return { event: busy ? null : event, active: !!event && event.key !== finished && !busy && !error };
}

function VectorMeter({ resource, label, gpu, owners }) {
  const total = n(gpu.total[resource]);
  const free = n(gpu.available[resource]);
  const used = total - free;
  const field = resource === "compute_units" ? "compute_required" : "memory_required";
  return <div className={`lab-meter ${resource === "memory" ? "is-memory" : ""}`}>
    <div><span>{label}</span><strong>{format(used)}<small> / {format(total)} used</small></strong></div>
    <div className="lab-meter-track" role="meter" aria-label={`${label} used`} aria-valuemin={0} aria-valuemax={total} aria-valuenow={used}>
      <div className="lab-meter-fill" style={{ width: `${total ? used / total * 100 : 0}%` }}>
        {owners.length ? owners.map((job) => <i key={job.job_id} title={`${job.name}: ${format(job[field])} ${label.toLowerCase()}`} style={{ flexGrow: n(job[field]), background: jobColor(job) }} />) : <i />}
      </div>
    </div><small>{format(free)} {label.toLowerCase()} free</small>
  </div>;
}

export default function AllocationCluster({ resources, jobs = [], contextKey = "cluster", title = "The live cluster", policy, busy = false, error, live = true, animateInitial = true, selectedJobId, onSelectJob, compact = false }) {
  const id = useId().replaceAll(":", "");
  const [nodeId, setNodeId] = useState(null);
  const [localJob, setLocalJob] = useState(null);
  const [visibleCount, setVisibleCount] = useState(80);
  const { event, active } = useAllocationPulse(jobs, contextKey, live, busy, error, animateInitial);
  const nodes = Object.entries(resources?.gpus || {});
  const chosenJob = jobs.find((job) => job.job_id === (selectedJobId ?? localJob)) || event?.job;
  const decision = chosenJob?.allocation_explanation;
  const candidates = decision?.candidates?.length ? decision.candidates : decision?.last_allocation?.candidates || [];
  const chosenNode = nodeId && resources?.gpus[nodeId] ? nodeId : chosenJob?.gpu_id || nodes[0]?.[0];
  const inspectedNode = resources?.gpus[chosenNode];
  const owners = jobs.filter((job) => job.status === "RUNNING" && job.gpu_id === chosenNode);
  const total = (key, field) => nodes.reduce((sum, [, gpu]) => sum + n(gpu[field][key]), 0);
  const selectJob = (job) => { setLocalJob(job.job_id); setNodeId(null); onSelectJob?.(job.job_id); };
  const selectedIndex = nodes.findIndex(([node]) => node === chosenJob?.gpu_id);
  const outcome = error ? "error" : busy ? "evaluating" : chosenJob?.status?.toLowerCase() || "settled";
  if (!nodes.length) return <div className="lab-cluster-empty" role="status"><Cpu size={24} /><p>{error || (busy ? "Waiting for the engine snapshot…" : "No cluster snapshot yet.")}</p></div>;
  return <section className={`allocation-cluster ${compact ? "is-compact" : ""} ${active ? "pulse-active" : ""}`} data-outcome={outcome} aria-label={title} tabIndex={-1}>
    <header className="lab-cluster-heading"><div><span className="studio-eyebrow"><span className="lab-live-dot" />{live ? "ENGINE SNAPSHOT" : "PREPARED SNAPSHOT"}</span><h3>{title}</h3></div><span>{policy?.replaceAll("_", " ") || "Resource vector"}</span></header>
    <div className="lab-network" aria-hidden="true"><svg viewBox={`0 0 ${nodes.length * 240} 95`} preserveAspectRatio="none"><defs><marker id={`${id}-arrow`} markerWidth="5" markerHeight="5" refX="4" refY="2.5" orient="auto"><path d="M0 0L5 2.5L0 5" fill="var(--studio-accent)" /></marker></defs>
      {nodes.map(([node], index) => <path key={node} d={`M${nodes.length * 120} 8V25Q${nodes.length * 120} 42 ${index * 240 + 120} 42V90`} className={`lab-route ${chosenJob?.gpu_id === node ? "is-destination" : ""}`} />)}
      {active && event?.changed.filter((job) => job.status === "RUNNING" && job.gpu_id).map((job) => {
        const index = nodes.findIndex(([node]) => node === job.gpu_id);
        if (index < 0) return null;
        return <path key={`${event.key}-${job.job_id}`} d={`M${nodes.length * 120} 8V25Q${nodes.length * 120} 42 ${index * 240 + 120} 42V90`} className="lab-pulse-route" markerEnd={`url(#${id}-arrow)`} />;
      })}
      <circle cx={nodes.length * 120} cy="8" r="5" className={selectedIndex >= 0 ? "lab-source committed" : "lab-source"} />
    </svg><span>{busy ? "Awaiting engine decision" : active ? "Confirmed state transition" : "Queue → resource vector → node"}</span></div>
    <div className="lab-node-grid" style={{ "--node-count": nodes.length }}>
      {nodes.map(([node, gpu]) => {
        const running = jobs.filter((job) => job.status === "RUNNING" && job.gpu_id === node);
        const candidate = candidates.find((item) => item.gpu_id === node);
        const destination = active ? event.changed.some((job) => job.status === "RUNNING" && job.gpu_id === node) : chosenJob?.status === "RUNNING" && chosenJob.gpu_id === node;
        const blocked = chosenJob?.status === "WAITING" && candidate?.eligible === false;
        return <article key={node} className={`lab-node ${chosenNode === node ? "selected" : ""} ${destination ? "destination" : ""} ${blocked ? "blocked" : ""}`}>
          <button className="lab-node-select" type="button" onClick={() => setNodeId(node)} aria-pressed={chosenNode === node} aria-label={`Inspect ${node} resources`} title={`${node}: ${format(gpu.available.compute_units)} compute and ${format(gpu.available.memory)} memory free`}><span><Cpu size={18} /><strong>{node}</strong></span><ArrowUpRight size={14} /></button>
          <div className="lab-node-type">{gpu.node_type || candidate?.node_type || "GPU"} <span>{running.length ? `${running.length} running` : "Available"}</span></div>
          <VectorMeter resource="compute_units" label="Compute" gpu={gpu} owners={running} /><VectorMeter resource="memory" label="Memory" gpu={gpu} owners={running} />
          <div className="lab-node-jobs">{running.length ? running.map((job) => <button type="button" key={job.job_id} onClick={() => selectJob(job)} className={chosenJob?.job_id === job.job_id ? "selected" : ""}><i style={{ background: jobColor(job) }} />{job.name}<span>({format(job.compute_required)}, {format(job.memory_required)})</span></button>) : <span className="lab-unreserved">No running job · capacity preserved</span>}</div>
          {candidate && <span className={`lab-decision-tag ${candidate.eligible ? "eligible" : ""}`}>Decision-time {candidate.compatible === false ? "type mismatch" : candidate.eligible ? "vector fits" : "no fit"}</span>}
          {candidate && chosenJob?.status === "WAITING" && <p className="lab-fit-reason">{candidate.compatible === false ? `Incompatible with type ${chosenJob.required_node_type}` : candidate.eligible ? "Vector fits this snapshot" : Object.entries(candidate.blocking_resources || {}).map(([key, value]) => `${key.replaceAll("_", " ")}: short ${format(value)}`).join(" · ") || "No eligible fit in recorded decision"}</p>}
        </article>;
      })}
    </div>
    <div className="lab-vector-totals"><span><Layers size={14} />Aggregate free vector</span><strong>{format(total("compute_units", "available"))} / {format(total("compute_units", "total"))}<small> compute</small></strong><strong>{format(total("memory", "available"))} / {format(total("memory", "total"))}<small> memory</small></strong></div>
    <div className="lab-job-queue" aria-label="Inspect job state">{jobs.slice(0, visibleCount).map((job) => <button type="button" key={job.job_id} className={`lab-job ${job.status.toLowerCase()} ${chosenJob?.job_id === job.job_id ? "selected" : ""}`} onClick={() => selectJob(job)} aria-pressed={chosenJob?.job_id === job.job_id}><span className="lab-job-id">#{job.job_id}</span><strong>{job.name}</strong><small>{job.status}{job.preemption_count ? ` · ${job.preemption_count} interruption(s)` : ""}</small></button>)}{jobs.length > visibleCount && <button type="button" className="lab-job" onClick={() => setVisibleCount((value) => value + 80)}>Show next {Math.min(80, jobs.length - visibleCount)} jobs · {jobs.length} total</button>}{!jobs.length && <p>No arrived jobs. The cluster is ready.</p>}</div>
    <div className={`lab-allocation-result ${outcome}`} role="status" aria-live="polite" aria-atomic="true">
      {error ? <><Clock3 size={19} /><div><strong>Request unsuccessful</strong><p>{String(error)} · No allocation is inferred.</p></div></> : busy ? <><Cpu size={19} /><div><strong>Request submitted to the local engine</strong><p>Current resources remain visible until a confirmed snapshot arrives.</p></div></> : chosenJob ? <><span className="lab-result-icon">{chosenJob.status === "RUNNING" ? <CheckCircle2 size={21} /> : <Clock3 size={21} />}</span><div><strong>#{chosenJob.job_id} · {chosenJob.name} → {chosenJob.status === "RUNNING" ? chosenJob.gpu_id : chosenJob.status}</strong><p>Requested ({format(chosenJob.compute_required)} compute, {format(chosenJob.memory_required)} memory){chosenJob.required_node_type ? ` · type ${chosenJob.required_node_type}` : ""}. {decision?.headline || "Inspect the current resource vector."}</p>{chosenJob.status === "RUNNING" && resources.gpus[chosenJob.gpu_id] && <p>Remaining on {chosenJob.gpu_id}: ({format(resources.gpus[chosenJob.gpu_id].available.compute_units)} compute, {format(resources.gpus[chosenJob.gpu_id].available.memory)} memory). Placement: {decision?.placement_rule || policy || "not supplied"}.</p>}{decision?.score != null && <small>Recorded decision score: {format(decision.score)}</small>}</div></> : <><Cpu size={19} /><div><strong>Select a node or a job</strong><p>Compute and memory are independent constraints. Aggregate free space does not guarantee an individual fit.</p></div></>}
    </div>
    {inspectedNode && <details className="lab-node-inspector"><summary>{chosenNode} · resource inspector · {owners.length} running</summary><p>Free vector: ({format(inspectedNode.available.compute_units)} compute, {format(inspectedNode.available.memory)} memory). Type: {inspectedNode.node_type || "not supplied"}.</p>{Object.entries(inspectedNode.total).filter(([key]) => !["compute_units", "memory"].includes(key)).map(([key, value]) => <p key={key}>{key.replaceAll("_", " ")}: {format(inspectedNode.available[key])} / {format(value)} free</p>)}<p>Placement: {decision?.placement_rule || policy || "not supplied"}. {owners.map((job) => job.name).join(", ") || "No running owners."}</p>{decision?.reasons?.map((reason, index) => <p key={index}>{reason}</p>)}</details>}
  </section>;
}
