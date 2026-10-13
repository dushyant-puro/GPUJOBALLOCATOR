import { useEffect, useState } from "react";
import { getBenchmarkEvidence } from "../services/api";

export default function FairnessTradeoff({ study }) {
  const [evidence, setEvidence] = useState(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let alive = true;
    if (study?.status === "SUCCEEDED" && study.config?.preset === "FAIRNESS_STREAM") {
      getBenchmarkEvidence(study.id).then((response) => { if (alive) { setEvidence({ id: study.id, trials: response.data.trials }); setError(""); } }).catch(() => { if (alive) setError("Per-job evidence could not be loaded. Summary metrics and exports remain available."); });
    }
    return () => { alive = false; };
  }, [study?.id, study?.status, study?.config?.preset]);
  if (study.config?.preset !== "FAIRNESS_STREAM") return null;
  return <section className="trap-results" aria-label="Priority aging trade-off"><h3>Who waits when priorities keep arriving?</h3><p>Actual per-job evidence, beside the overall latency cost. Aging changes the distribution of waiting; compare p95 and makespan too.</p>{error && <p role="status">{error}</p>}{evidence?.id === study.id ? <div className="arena-table-scroll"><table><caption>Fairness Stream · low-priority job and system-wide outcomes</caption><thead><tr><th>Variant</th><th>Low-priority job</th><th>Its wait (s)</th><th>p95 wait (s)</th><th>Makespan (s)</th><th>Starvation (%)</th></tr></thead><tbody>{evidence.trials.map((trial) => {
    const job = [...trial.jobs].sort((a,b) => a.priority-b.priority || a.trace_index-b.trace_index)[0];
    return <tr key={`${trial.policy}:${trial.placement_rule}:${trial.trace_hash}`}><th>{trial.policy.replaceAll("_", " ")}</th><td>{job?.name || "—"}</td><td>{job?.accumulated_wait_seconds ?? "—"}</td><td>{trial.metrics.p95_wait_seconds ?? "—"}</td><td>{trial.metrics.makespan_seconds ?? "—"}</td><td>{trial.metrics.starvation_rate_percent ?? "—"}</td></tr>;
  })}</tbody></table></div> : !error && <p role="status">Loading per-job evidence…</p>}</section>;
}
