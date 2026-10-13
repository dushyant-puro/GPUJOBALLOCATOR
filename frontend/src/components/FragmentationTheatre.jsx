import { useEffect, useRef, useState } from "react";
import { ArrowRight, Play, RotateCcw, FlaskConical, Download } from "lucide-react";
import AllocationCluster from "./AllocationCluster";
import { createReplayRun, getReplayRun, controlReplayRun, createBenchmark, getBenchmark, benchmarkExportUrl } from "../services/api";

const rules = ["NORMALIZED", "BEST_FIT_PACKING"];
const beats = [{ time: 0, title: "Place the small jobs" }, { time: 1, title: "The whole-GPU arrival" }, { time: 20, title: "Release and retry" }, { time: 28, title: "Compare completion" }];
const f = (value) => value == null ? "—" : Number(value).toFixed(2).replace(/\.00$/, "");
const percent = (value) => value == null ? "—" : `${f(value * 100)}%`;
const storage = (rule) => { try { return sessionStorage.getItem(`gpu-trap-${rule}`); } catch { return null; } };
const message = (err) => typeof err.response?.data?.detail === "string" ? err.response.data.detail : err.message;

function SnapshotMetrics({ run }) {
  const m = run.resources.demand_fragmentation;
  return <div className="lab-snapshot-metrics">{[
    ["Virtual time", `${f(run.time_seconds)}s`], ["Completed jobs", `${run.metrics.completed} / ${run.total_jobs}`],
    ["Largest free compute block / free compute", percent(m?.by_resource.compute_units.largest_free_block_ratio)],
    ["Largest free memory block / free memory", percent(m?.by_resource.memory.largest_free_block_ratio)],
    ["External fragmentation · compute", percent(m?.by_resource.compute_units.external_fragmentation)],
    ["External fragmentation · memory", percent(m?.by_resource.memory.external_fragmentation)],
    ["Stranded free capacity", percent(m?.stranded_capacity)], ["Jobs blocked by fragmentation", m?.blocked_by_fragmentation ?? "—"],
  ].map(([label, value]) => <span key={label}>{label}<strong>{value}</strong></span>)}</div>;
}

export default function FragmentationTheatre({ connected }) {
  const [pair, setPair] = useState(null);
  const [beat, setBeat] = useState(-1);
  const [epoch, setEpoch] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [study, setStudy] = useState(null);
  const lock = useRef(false);
  const version = useRef(0);
  const alive = useRef(true);
  const ids = useRef(Object.fromEntries(rules.map((rule) => [rule, storage(rule)])));
  useEffect(() => { alive.current = true; return () => { alive.current = false; version.current += 1; }; }, []);
  useEffect(() => {
    if (!study?.id || ["SUCCEEDED", "FAILED"].includes(study.status)) return;
    let active = true;
    let polling = false;
    const refresh = async () => {
      if (polling) return;
      polling = true;
      try { const result = await getBenchmark(study.id); if (active) setStudy(result.data); }
      catch (err) { if (active) setError(message(err)); }
      finally { polling = false; }
    };
    const timer = setInterval(refresh, 700);
    refresh();
    return () => { active = false; clearInterval(timer); };
  }, [study?.id, study?.status]);
  const operate = async (operation) => {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError("");
    const token = ++version.current;
    try { await operation(token); }
    catch (err) { if (alive.current && version.current === token) setError(message(err)); }
    finally { lock.current = false; if (alive.current) setBusy(false); }
  };
  const open = () => operate(async (token) => {
    const result = [];
    for (const rule of rules) {
      if (!alive.current || token !== version.current) return;
      let current;
      if (ids.current[rule]) {
        try { current = (await getReplayRun(ids.current[rule])).data; }
        catch (err) { if (err.response?.status !== 404) throw err; ids.current[rule] = null; }
      }
      if (!current) {
        current = (await createReplayRun({ name: `Fragmentation theatre · ${rule}`, preset: "FRAGMENTATION_TRAP", policy: "FCFS", placement_rule: rule, seed: 42, count: 4 })).data;
        ids.current[rule] = current.run_id;
        try { sessionStorage.setItem(`gpu-trap-${rule}`, current.run_id); } catch { /* Optional storage. */ }
      } else current = (await controlReplayRun(current.run_id, { action: "reset" })).data;
      result.push(current);
    }
    if (JSON.stringify(result[0].trace) !== JSON.stringify(result[1].trace)) throw new Error("Workload mismatch: the paired walkthrough was not displayed.");
    if (alive.current && token === version.current) { setPair(result); setEpoch((value) => value + 1); setBeat(0); }
  });
  const jump = (index) => operate(async (token) => {
    const result = [];
    let reset = false;
    for (const run of pair) {
      if (!alive.current || token !== version.current) return;
      let current = run;
      const target = beats[index].time;
      if (target < current.time_seconds || index === 0) { current = (await controlReplayRun(run.run_id, { action: "reset" })).data; reset = true; }
      if (!alive.current || token !== version.current) return;
      if (target > current.time_seconds) current = (await controlReplayRun(run.run_id, { action: "advance", seconds: target - current.time_seconds })).data;
      result.push(current);
    }
    if (alive.current && token === version.current) { setPair(result); setBeat(index); if (reset) setEpoch((value) => value + 1); }
  });
  const measure = () => operate(async (token) => {
    const response = await createBenchmark({ name: "Fragmentation theatre · paired placement evidence", preset: "FRAGMENTATION_TRAP", count: 4, seeds: [42], policies: ["FCFS"], placement_rules: rules, baseline: "FCFS", horizon_seconds: 100, starvation_threshold_seconds: 30 });
    if (alive.current && token === version.current) setStudy(response.data);
  });
  const rows = study?.status === "SUCCEEDED" ? study.summary?.summary || [] : [];
  const atArrival = beat === 1;
  const first = pair?.[0];
  const free = (key) => first ? Object.values(first.resources.gpus).reduce((sum, gpu) => sum + gpu.available[key], 0) / Object.values(first.resources.gpus).reduce((sum, gpu) => sum + gpu.total[key], 0) : null;
  const awaitingStudy = study && ["QUEUED", "RUNNING"].includes(study.status);
  return <section className="fragmentation-theatre" aria-label="Fragmentation Trap comparison">
    <div className="trap-heading"><div><span className="studio-eyebrow">SIGNATURE EXPERIMENT / FRAGMENTATION TRAP</span><h2>Plenty of space.<br />Nowhere to fit.</h2><p>Three small vectors (2 compute, 4 memory) arrive first. Then a whole-GPU vector (8, 16) arrives. Follow the same workload under two placement rules.</p></div><span>3 × (8 COMPUTE, 16 MEMORY)<br />FCFS · SEED 42 · VIRTUAL TIME</span></div>
    {error && <div className="studio-error" role="alert">{error}</div>}
    <div className="trap-actions"><button className="studio-button primary" type="button" onClick={open} disabled={busy || connected === false}>{pair ? <RotateCcw size={15} /> : <Play size={15} />}{busy ? "Contacting engine…" : pair ? "Reset paired walkthrough" : "Start paired walkthrough"}</button>{pair && <button className="studio-button secondary" type="button" onClick={() => jump(Math.min(beat + 1, beats.length - 1))} disabled={busy || beat === beats.length - 1}>Next moment <ArrowRight size={15} /></button>}<button className="studio-button secondary" type="button" onClick={measure} disabled={busy || awaitingStudy || connected === false}><FlaskConical size={15} />{awaitingStudy ? "Measuring…" : "Measure both placements"}</button><small>Independent initial placements · no migration</small></div>
    {pair && <><div className="trap-beats">{beats.map((item, index) => <button type="button" key={item.time} onClick={() => jump(index)} disabled={busy} aria-current={beat === index ? "step" : undefined}><span>0{index + 1} / t = {item.time}s</span>{item.title}</button>)}</div>
      {atArrival && <p className="trap-observation"><strong>{percent(free("compute_units"))} compute free. {percent(free("memory"))} memory free.</strong> Under NORMALIZED, that space is split across nodes. Each has only 6 compute and 12 memory free; the incoming job needs (8, 16) on one node. Packing preserved a full node from the start.</p>}
      <div className="trap-comparison">{pair.map((run, index) => <div key={run.run_id}><AllocationCluster resources={run.resources} jobs={run.jobs} contextKey={`${run.run_id}:${epoch}`} title={index ? "Preserve a whole GPU" : "Spread the small jobs"} policy={run.placement_rule} busy={busy} error={error} compact /><SnapshotMetrics run={run} /></div>)}</div>
      <p className="replay-hint">Snapshots come from two isolated replay sessions. Both use exactly the same trace. A completed session stops at its own makespan.</p>
    </>}
    {!pair && <p className="trap-observation">The sum of free space answers “how much is left?” The largest compatible block answers “can this job actually run?” Start the walkthrough to see actual allocations.</p>}
    {study?.status === "FAILED" && <div className="studio-error" role="alert">Measurement failed: {study.error || "Review Policy Arena for details."}</div>}
    {rows.length > 0 && <div className="trap-results"><h3>The measured consequence.</h3><p>Current engine results · one fixed trace · no confidence interval. Values below are final-trial metrics; the panels above are selected-time snapshots.</p><div className="arena-table-scroll"><table><caption>Same workload, two initial placement rules</caption><thead><tr><th>Measurement</th>{rows.map((row) => <th key={row.policy}>{row.policy.split("/").at(-1).replaceAll("_", " ")}</th>)}</tr></thead><tbody>{[["Whole-GPU wait / maximum wait", "max_wait_seconds", "s"], ["Makespan", "makespan_seconds", "s"], ["Completion rate", "completion_rate_percent", "%"], ["Mean stranded free capacity", "stranded_capacity_percent", "%"], ["Mean external fragmentation", "external_fragmentation_percent", "%"]].map(([label, key, unit]) => <tr key={key}><th>{label}</th>{rows.map((row) => <td key={row.policy}>{f(row.metrics[key]?.mean)}{unit}</td>)}</tr>)}</tbody></table></div><p>Maximum wait corresponds to the whole-GPU job on this fixed trace. Fragmentation means are weighted by simulated elapsed time.</p><a className="studio-button secondary" href={benchmarkExportUrl(study.id, "json")} download><Download size={14} />Download paired evidence</a><details><summary>Metric definitions and provenance</summary><p>Source fingerprint: {study.summary.source_fingerprint}</p>{Object.entries(study.summary.metric_definitions).map(([key, definition]) => <p key={key}><strong>{key.replaceAll("_", " ")}</strong> · {definition}</p>)}</details></div>}
  </section>;
}
