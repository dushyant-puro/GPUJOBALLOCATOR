import { useEffect, useRef, useState } from "react";
import { FlaskConical, Download, CheckCircle2, Layers, ArrowRight } from "lucide-react";
import { getReplayPresets, listBenchmarks, createBenchmark, getBenchmark, benchmarkExportUrl } from "../services/api";
import FairnessTradeoff from "./FairnessTradeoff";
import "./ReplayLab.css";
import "./BenchmarkLab.css";

const metrics = {
  external_fragmentation_percent: { label: "External fragmentation", unit: "%", lower: true },
  stranded_capacity_percent: { label: "Stranded free capacity", unit: "%", lower: true },
  fragmentation_blocked_jobs_mean: { label: "Fragmentation-blocked jobs", unit: "jobs", lower: true },
  max_wait_seconds: { label: "Maximum observed waiting", unit: "s", lower: true },
  slowdown_jain_index: { label: "Slowdown equality (Jain)", unit: "index", lower: false },
  makespan_seconds: { label: "Makespan", unit: "s", lower: true },
  p95_wait_seconds: { label: "P95 waiting", unit: "s", lower: true },
  throughput_per_minute: { label: "Throughput", unit: "jobs/min", lower: false },
  memory_utilization_percent: { label: "Memory utilization", unit: "%", lower: false },
  mean_wait_seconds: { label: "Mean waiting", unit: "s", lower: true },
  compute_utilization_percent: { label: "Compute utilization", unit: "%", lower: false },
  starvation_rate_percent: { label: "Starvation rate", unit: "%", lower: true },
};
const display = (value, digits = 2) => value == null ? "—" : Number(value).toFixed(digits);
const policyLabel = (value) => {
  if (!value.includes("/")) return value.replaceAll("_", " ");
  const [policy, rule] = value.split("/");
  return `${policy.replace("RESOURCE_", "").replaceAll("_", " ")} / ${{NORMALIZED:"normalized",BEST_FIT_PACKING:"packing",MEMORY_BEST_FIT:"memory fit",FIRST_FIT:"first fit",ALIGNMENT:"alignment"}[rule] || rule}`;
};
const errorText = (err) => {
  const detail = err.response?.data?.detail || err.message;
  return Array.isArray(detail) ? detail.map((item) => item.msg).join(" · ") : String(detail);
};

function BenchmarkLab() {
  const [presets, setPresets] = useState([]);
  const [policies, setPolicies] = useState([]);
  const [selectedPolicies, setSelectedPolicies] = useState(["FCFS", "PRIORITY", "RESOURCE_BALANCED"]);
  const [preset, setPreset] = useState("MIXED");
  const [count, setCount] = useState(30);
  const [seeds, setSeeds] = useState("42, 43, 44");
  const [agingRate, setAgingRate] = useState(1);
  const [placement, setPlacement] = useState("NORMALIZED");
  const [baseline, setBaseline] = useState("FCFS");
  const [horizon, setHorizon] = useState(10000);
  const [threshold, setThreshold] = useState(30);
  const [custom, setCustom] = useState(false);
  const [traceText, setTraceText] = useState(JSON.stringify([
    { name: "Training", compute_required: 8, memory_required: 16, arrival_seconds: 0, duration_seconds: 20 },
    { name: "Evaluation", compute_required: 2, memory_required: 4, arrival_seconds: 5, duration_seconds: 6 },
  ], null, 2));
  const [studies, setStudies] = useState([]);
  const [studyId, setStudyId] = useState("");
  const [study, setStudy] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [metric, setMetric] = useState("makespan_seconds");
  const generation = useRef(0);
  const launching = useRef(false);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; generation.current += 1; }; }, []);

  useEffect(() => {
    let alive = true;
    Promise.all([getReplayPresets(), listBenchmarks()]).then(([catalog, inventory]) => {
      if (!alive) return;
      setPresets(catalog.data.presets);
      setPolicies(catalog.data.policies);
      setStudies(inventory.data.benchmarks);
      if (inventory.data.benchmarks.length) setStudyId(inventory.data.benchmarks[0].id);
    }).catch((err) => { if (alive) setError(errorText(err)); });
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    if (!studyId) return;
    let alive = true;
    let polling = false;
    let terminal = false;
    const refresh = async () => {
      if (polling || terminal) return;
      const version = generation.current;
      polling = true;
      try {
        const response = await getBenchmark(studyId);
        if (alive && version === generation.current) {
          setStudy(response.data);
          terminal = ["SUCCEEDED", "FAILED"].includes(response.data.status);
          if (terminal) {
            const inventory = await listBenchmarks();
            if (alive && version === generation.current) setStudies(inventory.data.benchmarks);
          }
        }
      } catch (err) { if (alive && version === generation.current) setError(errorText(err)); }
      finally { polling = false; }
    };
    refresh();
    const timer = setInterval(refresh, 700);
    return () => { alive = false; clearInterval(timer); };
  }, [studyId]);

  const togglePolicy = (value) => {
    const next = selectedPolicies.includes(value) ? selectedPolicies.filter((item) => item !== value) : [...selectedPolicies, value];
    setSelectedPolicies(next);
    if (!next.includes(baseline)) setBaseline(next[0] || "");
  };

  const launch = async () => {
    if (launching.current) return;
    launching.current = true;
    setBusy(true);
    setError("");
    generation.current += 1;
    try {
      const parsedSeeds = seeds.split(/[ ,]+/).filter(Boolean).map(Number);
      const payload = {
        name: `${custom ? "Custom workload" : presets.find((item) => item.id === preset)?.name || preset} · ${selectedPolicies.length} policies`,
        preset, aging_rate: Number(agingRate), placement_rules: placement === "PACKING_COMPARISON" ? ["NORMALIZED","BEST_FIT_PACKING"] : [placement], count: Number(count), seeds: parsedSeeds, policies: selectedPolicies,
        baseline, horizon_seconds: Number(horizon), starvation_threshold_seconds: Number(threshold),
      };
      if (custom) payload.jobs = JSON.parse(traceText);
      const response = await createBenchmark(payload);
      if (!mounted.current) return;
      setStudy(response.data);
      setStudyId(response.data.id);
      const inventory = await listBenchmarks();
      if (mounted.current) setStudies(inventory.data.benchmarks);
    } catch (err) { if (mounted.current) setError(errorText(err)); }
    finally { launching.current = false; if (mounted.current) setBusy(false); }
  };

  const reuseSettings = () => {
    const config = study.config;
    setAgingRate(config.aging_rate || 1); setPreset(config.preset); setPlacement(config.placement_rules?.length > 1 ? "PACKING_COMPARISON" : config.placement_rules?.[0] || "NORMALIZED");
    setCount(config.count);
    setSeeds(config.seeds.join(", "));
    setSelectedPolicies(config.policies);
    setBaseline(config.baseline);
    setHorizon(config.horizon_seconds);
    setThreshold(config.starvation_threshold_seconds);
    setCustom(Boolean(config.jobs));
    if (config.jobs) setTraceText(JSON.stringify(config.jobs, null, 2));
  };

  const summary = study?.summary;
  const rows = summary?.summary || [];
  const selection = metrics[metric];
  const maximum = Math.max(1, ...rows.map((row) => row.metrics[metric].mean || 0));
  const completedRows = rows.filter((row) => row.complete_trials === row.trials);
  const fastest = [...completedRows].sort((a, b) => a.metrics.makespan_seconds.mean - b.metrics.makespan_seconds.mean)[0];
  const leaders = completedRows.filter((row) => row.metrics.makespan_seconds.mean === fastest?.metrics.makespan_seconds.mean);
  const progress = study?.progress;
  const active = study && ["QUEUED", "RUNNING"].includes(study.status);

  return <div className="replay-lab benchmark-lab">
    <div className="replay-heading"><div><span className="replay-eyebrow">MEASURE BEFORE YOU OPTIMIZE</span><h2>Policy Arena</h2><p>One workload. Identical starting conditions. Evidence you can reproduce.</p></div><span className="replay-isolation"><Layers size={12} /> Paired workloads · saved results</span></div>
    {error && <div role="alert" className="replay-error">{error}</div>}
    <div className="arena-builder">
      <label>Workload<select value={preset} disabled={busy || custom} onChange={(event) => setPreset(event.target.value)}>{presets.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
      <label>Jobs per workload<input type="number" min="1" max="200" disabled={busy || custom || ["PREEMPTION", "INFEASIBLE"].includes(preset)} value={count} onChange={(event) => setCount(event.target.value)} /></label>
      <label>Seeds · up to five<input value={seeds} disabled={busy} onChange={(event) => setSeeds(event.target.value)} /></label>
      <label>Baseline<select value={baseline} disabled={busy} onChange={(event) => setBaseline(event.target.value)}>{selectedPolicies.map((item) => <option key={item} value={item}>{policyLabel(item)}</option>)}</select></label>
    </div>
    <label className="replay-custom"><input type="checkbox" checked={custom} disabled={busy} onChange={(event) => setCustom(event.target.checked)} /> Use a custom JSON workload</label>
    {custom && <textarea className="replay-trace-editor" aria-label="Benchmark job trace JSON" value={traceText} onChange={(event) => setTraceText(event.target.value)} spellCheck="false" />}
    <fieldset className="arena-policies"><legend>Compare policies · choose at least {placement === "PACKING_COMPARISON" ? "one" : "two"}</legend>{policies.map((item) => <label key={item} className={selectedPolicies.includes(item) ? "selected" : ""}><input type="checkbox" checked={selectedPolicies.includes(item)} disabled={busy} onChange={() => togglePolicy(item)} /><span>{policyLabel(item)}</span>{item === baseline && <small>BASELINE</small>}</label>)}</fieldset>
    <label className="replay-run-selector">Placement comparison<select value={placement} disabled={busy} onChange={(event) => setPlacement(event.target.value)}>{["NORMALIZED","FIRST_FIT","MEMORY_BEST_FIT","BEST_FIT_PACKING","ALIGNMENT","PACKING_COMPARISON"].map((rule) => <option key={rule} value={rule}>{rule === "PACKING_COMPARISON" ? "NORMALIZED vs BEST FIT PACKING" : rule.replaceAll("_"," ")}</option>)}</select></label>
    {selectedPolicies.includes("PRIORITY_AGING") && <label className="replay-run-selector">Aging priority units / second<input type="number" min="0.01" max="100" step="0.01" value={agingRate} disabled={busy} onChange={(event) => setAgingRate(event.target.value)} /></label>}
    <div className="arena-launch"><details><summary>Evaluation settings</summary><div><label>Timeout · simulated seconds<input type="number" min="0.001" max="604800" value={horizon} onChange={(event) => setHorizon(event.target.value)} /></label><label>Starvation threshold · waiting seconds<input type="number" min="0.001" max="604800" value={threshold} onChange={(event) => setThreshold(event.target.value)} /></label></div></details><button type="button" className="replay-primary" disabled={busy || selectedPolicies.length < (placement === "PACKING_COMPARISON" ? 1 : 2) || !presets.length} onClick={launch}><FlaskConical size={16} />{busy ? "Submitting…" : "Run comparison"}</button></div>
    <p className="replay-hint">Each policy gets a fresh cluster and the same trace for each seed. Fixed demo traces are counted once. Results survive backend restarts.</p>
    {studies.length > 0 && <label className="replay-run-selector">Saved study<select value={studyId} disabled={busy} onChange={(event) => { generation.current += 1; setStudyId(event.target.value); setStudy(null); setError(""); }}><option value="">Select a study</option>{studies.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.status} · {item.id.slice(0, 6)}</option>)}</select></label>}
    {study && <button type="button" className="arena-reuse" disabled={busy} onClick={reuseSettings}>Use these settings</button>}
    {active && <div className="arena-progress" role="status"><div><strong>{study.status === "QUEUED" ? "Waiting for the experiment worker" : "Comparing scheduling outcomes"}</strong><span>{progress?.completed || 0} / {progress?.total ?? "…"} trials</span></div><div className="arena-progress-track"><i style={{ width: `${progress?.total ? progress.completed / progress.total * 100 : 3}%` }} /></div><small>{progress?.policy ? `${policyLabel(progress.policy)} · seed ${progress.seed}` : "Your live workspace and replay sessions remain independent."}</small></div>}
    {study?.status === "FAILED" && <div className="replay-error">{study.error}</div>}
    {!study && <div className="replay-empty"><FlaskConical size={34} /><h3>Turn scheduling claims into measurable results.</h3><p>Run a paired comparison, inspect the trade-offs, and export the complete experiment.</p></div>}
    {summary && <>
      <div className="arena-result-title"><div><CheckCircle2 size={18} /><h3>Comparison complete</h3><span>{summary.trial_count} trials · {summary.distinct_workloads} distinct workloads</span></div><div className="arena-downloads"><a href={benchmarkExportUrl(study.id, "csv")} download><Download size={14} />CSV metrics</a><a href={benchmarkExportUrl(study.id, "json")} download><Download size={14} />JSON evidence</a></div></div>
      <div className="arena-scorecards"><div><span>Fastest complete mean makespan</span><strong>{fastest ? display(fastest.metrics.makespan_seconds.mean) + " s" : "No complete policy"}</strong><small>{leaders.length > 1 ? `Tie: ${leaders.map((row) => policyLabel(row.policy)).join(" · ")}` : fastest ? policyLabel(fastest.policy) : "Increase timeout or inspect infeasible jobs"}</small></div><div><span>Baseline</span><strong>{policyLabel((summary.baseline_variant || summary.config.baseline))}</strong><small>Every difference uses paired traces</small></div><div><span>Evidence integrity</span><strong>{summary.distinct_workloads >= 2 ? "Paired intervals" : "One distinct trace"}</strong><small>{summary.distinct_workloads >= 2 ? "Exploratory 95% bootstrap intervals" : "Confidence intervals unavailable"}</small></div></div>
      <div className="arena-chart-panel"><div><h3>Compare outcomes</h3><label>Metric<select value={metric} onChange={(event) => setMetric(event.target.value)}>{Object.entries(metrics).map(([key, value]) => <option key={key} value={key}>{value.label}</option>)}</select></label></div><p>{selection.lower ? "Lower" : "Higher"} values are better for this metric. Bars show means across distinct workloads.</p><svg className="arena-chart" viewBox={`0 0 700 ${rows.length * 50 + 20}`} role="img" aria-label={`${selection.label} comparison by policy`}>
        {rows.map((row, index) => <g key={row.policy}><text x="0" y={index * 50 + 27}>{policyLabel(row.policy)}</text><rect x="190" y={index * 50 + 10} width="390" height="26" rx="5" className="arena-bar-track" /><rect x="190" y={index * 50 + 10} width={row.metrics[metric].mean == null ? 0 : Math.max(0, row.metrics[metric].mean / maximum * 390)} height="26" rx="5" className={row.policy === (summary.baseline_variant || summary.config.baseline) ? "arena-bar-baseline" : "arena-bar-policy"} /><text x="598" y={index * 50 + 27}>{display(row.metrics[metric].mean)} {selection.unit}</text></g>)}
      </svg></div>
      <div className="arena-table-scroll"><table className="arena-table"><caption>Policy results · means across workloads; waiting metrics use completed jobs</caption><thead><tr><th>Policy</th><th>Complete trials</th><th>Makespan (s)</th><th>Mean wait (s)</th><th>P95 wait (s)</th><th>Compute (%)</th><th>Jobs/min</th><th>Starvation (%)</th><th>Preemptions</th></tr></thead><tbody>{rows.map((row) => <tr key={row.policy}><th>{policyLabel(row.policy)}{row.policy === (summary.baseline_variant || summary.config.baseline) && <small>BASELINE</small>}</th><td>{row.complete_trials}/{row.trials}</td>{["makespan_seconds", "mean_wait_seconds", "p95_wait_seconds", "compute_utilization_percent", "throughput_per_minute", "starvation_rate_percent", "preemptions"].map((key) => <td key={key}>{display(row.metrics[key].mean)}</td>)}</tr>)}</tbody></table></div>
      <div className="arena-deltas"><h3>Paired {selection.label.toLowerCase()} differences <ArrowRight size={14} /> {policyLabel((summary.baseline_variant || summary.config.baseline))}</h3><p>Policy minus baseline in {selection.unit}. {selection.lower ? "Negative" : "Positive"} differences favor the policy.</p>{rows.filter((row) => row.policy !== (summary.baseline_variant || summary.config.baseline)).map((row) => {
        const delta = row.paired_deltas[metric];
        const favorable = delta.mean != null && (selection.lower ? delta.mean < 0 : delta.mean > 0);
        return <div key={row.policy}><strong>{policyLabel(row.policy)}</strong><span className={favorable ? "favorable" : ""}>{delta.mean == null ? "—" : `${delta.mean > 0 ? "+" : ""}${display(delta.mean)} ${selection.unit}`}</span><small>{delta.bootstrap_95_interval ? `95% interval [${display(delta.bootstrap_95_interval[0])}, ${display(delta.bootstrap_95_interval[1])}]` : "Interval unavailable"} · {delta.pairs} paired workloads</small></div>;
      })}</div>
      <FairnessTradeoff study={study} />
      <div className="arena-notes"><h3>Interpretation and limits</h3>{summary.warnings.map((warning) => <p key={warning}>{warning}</p>)}</div>
      <details className="arena-provenance"><summary>Reproduction details and metric definitions</summary><p>Engine: {summary.engine_version} · source SHA-256: <code>{summary.source_fingerprint}</code></p><p>Seeds: {summary.config.seeds.join(", ")} · timeout: {summary.config.horizon_seconds}s · starvation threshold: {summary.config.starvation_threshold_seconds}s</p><p>Placement rules used: {(summary.config.placement_rules || ["NORMALIZED"]).join(", ")}. Preemption recovery cost is currently zero.</p>{Object.entries(summary.metric_definitions).map(([key, value]) => <p key={key}><strong>{key.replaceAll("_", " ")}</strong> — {value}</p>)}</details>
    </>}
  </div>;
}

export default BenchmarkLab;
