import { useId, useState } from "react";
import { ArrowUpRight, Pause, Play } from "lucide-react";

const positions = [[35, 238], [235, 130], [435, 238]];
const fmt = (value) => Number(value).toFixed(1);

function Rotor({ x, y, active }) {
  return <g transform={`translate(${x} ${y})`}>
    <circle r="23" fill="#202d28" stroke="#657a69" strokeWidth="1.5" />
    <circle r="20" fill="#15241e" stroke="#819481" strokeWidth=".5" />
    <g className={active ? "cluster-rotor spinning" : "cluster-rotor"}>
      {Array.from({ length: 7 }, (_, index) => <path key={index} transform={`rotate(${index * 360 / 7})`} d="M2 -3 C6 -15 16 -18 17 -10 C18 -3 9 -1 3 2Z" fill="#87968a" />)}
    </g>
    <circle r="5" fill="#c8d5c4" /><circle r="2" fill="#597261" />
  </g>;
}

function ClusterScene({ scene, live, onInspect }) {
  const [selected, setSelected] = useState("GPU-2");
  const [motion, setMotion] = useState(true);
  const id = useId().replaceAll(":", "");
  const gpus = Object.entries(scene.resources.gpus);
  const gpu = scene.resources.gpus[selected] || gpus[0][1];
  const owner = scene.jobs.find((job) => job.gpu_id === selected && job.status === "RUNNING");
  const running = scene.jobs.filter((job) => job.status === "RUNNING").length;

  return <div className={`cluster-figure ${motion ? "" : "motion-paused"}`}>
    <div className="cluster-figure-heading"><span><i />{live ? "LIVE LOCAL REPLAY" : "PREPARED SCENE"}</span><span>t = {fmt(scene.time_seconds)}s</span></div>
    <div className="cluster-drawing">
      <svg viewBox="0 0 720 530" aria-hidden="true" className="cluster-svg">
        <defs>
          <pattern id={`${id}-grid`} width="24" height="24" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r=".8" fill="currentColor" opacity=".17" /></pattern>
          <pattern id={`${id}-floor`} width="28" height="28" patternUnits="userSpaceOnUse" patternTransform="matrix(1 .5 -1 .5 0 0)"><path d="M28 0H0V28" fill="none" stroke="#b4bfb0" strokeWidth=".6" /></pattern>
          <filter id={`${id}-shadow`} x="-40%" y="-40%" width="180%" height="200%"><feGaussianBlur stdDeviation="9" /></filter>
        </defs>
        <rect width="720" height="530" fill={`url(#${id}-grid)`} />
        <path d="M28 288 360 114 692 288 360 463Z" fill="#adb4a3" opacity=".12" transform="translate(0 13)" filter={`url(#${id}-shadow)`} />
        <path d="M28 288 360 114 692 288 360 463Z" fill="#f0f0e5" stroke="#b7c2ae" />
        <path d="M28 288 360 114 692 288 360 463Z" fill={`url(#${id}-floor)`} />
        <path d="M28 288V300L360 475 692 300V288L360 463Z" fill="#dce2d3" stroke="#b7c2ae" />
        {gpus.map(([gpuId], index) => {
          const [x, y] = positions[index];
          const job = scene.jobs.find((item) => item.gpu_id === gpuId && item.status === "RUNNING");
          const color = job?.priority >= 5 ? "#c36b3d" : "#356d50";
          return <path key={gpuId} d={`M360 466V414L${x + 125} ${y + 128}V${y + 68}`} fill="none" stroke={job ? color : "#b5beae"} strokeWidth="2" className={job ? "cluster-flow" : ""} strokeDasharray={job ? "5 8" : "2 5"} />;
        })}
        {gpus.map(([gpuId, item], index) => {
          const [x, y] = positions[index];
          const job = scene.jobs.find((entry) => entry.gpu_id === gpuId && entry.status === "RUNNING");
          const used = item.total.compute_units - item.available.compute_units;
          const urgent = job?.priority >= 5;
          const accent = urgent ? "#c36b3d" : "#356d50";
          return <g key={gpuId} transform={`translate(${x} ${y})`} className={`cluster-board ${selected === gpuId ? "is-selected" : ""}`}>
            <path d="M0 8 120 -52 250 13 130 73Z" fill="#294230" opacity=".18" transform="translate(0 15)" filter={`url(#${id}-shadow)`} />
            <path className="cluster-board-outline" d="M-7 -3 120 -67 258 2 130 72Z" fill="none" stroke={accent} strokeWidth="1.5" strokeDasharray="4 4" />
            <path d="M0 0 130 65V80L0 15Z" fill="#526753" stroke="#3f5544" />
            <path d="M130 65 250 5V20L130 80Z" fill="#82957c" stroke="#566c53" />
            <path d="M0 0 120 -60 250 5 130 65Z" fill={urgent ? "#d5bc9c" : selected === gpuId ? "#b1c3a3" : "#c2ceaf"} stroke="#72886a" />
            <g transform="matrix(1 .5 -1 .5 121 -49)">
              <rect width="114" height="86" rx="3" fill={urgent ? "#e2cfb5" : "#d2dbbf"} stroke="#819671" />
              {[10, 22, 34, 46, 58, 70].map((row) => <path key={row} d={`M3 ${row}H111`} stroke="#b6c4a0" strokeWidth=".7" />)}
              {[6, 102].map((column) => <g key={column}>{[8, 23, 38, 53, 68].map((row) => <rect key={row} x={column} y={row} width="7" height="10" rx="1" fill="#536a4c" stroke="#ebedcf" strokeWidth=".5" />)}</g>)}
              <rect x="18" y="13" width="78" height="60" rx="8" fill="#394f3f" stroke="#657f63" />
              <Rotor x={37} y={43} active={Boolean(job)} /><Rotor x={78} y={43} active={Boolean(job)} />
              {[0, 1, 2, 3].map((unit) => <rect key={unit} x={23 + unit * 17} y="76" width="13" height="4" rx="1" fill={unit < used / item.total.compute_units * 4 ? accent : "#abb998"} />)}
              <circle cx="5" cy="4" r="2" fill="#e8eddc" stroke="#697e5e" /><circle cx="108" cy="82" r="2" fill="#e8eddc" stroke="#697e5e" />
            </g>
            <path d="M9 18 40 33 40 40 9 25Z" fill="#d5dfc9" />
            {[0, 1, 2, 3, 4].map((port) => <path key={port} d={`M${63 + port * 11} ${38 + port * 5.5}l6 3v7l-6 -3Z`} fill="#2f4834" />)}
            <circle cx="144" cy="69" r="2.5" fill={job ? accent : "#bac5b1"} />
          </g>;
        })}
        <g transform="translate(333 468)"><path d="M0 0 27 -14 54 0 27 14Z" fill="#d1dfb5" stroke="#78935c" /><path d="M0 0v7l27 14 27 -14V0L27 14Z" fill="#a8bd86" stroke="#78935c" /><text x="27" y="40" textAnchor="middle" fill="#69755f" fontSize="10" fontFamily="monospace">WORKLOAD IN</text></g>
      </svg>
      {gpus.map(([gpuId, item], index) => <button key={gpuId} type="button" aria-label={`Inspect ${gpuId} in cluster graphic`} aria-pressed={selected === gpuId} onClick={() => setSelected(gpuId)} className={`cluster-machine-label machine-${index} ${selected === gpuId ? "selected" : ""}`}><span>{gpuId}</span><small>{item.total.compute_units - item.available.compute_units}/{item.total.compute_units} compute <ArrowUpRight size={12} /></small></button>)}
      <div className="cluster-scale">3 NODES / SIMULATED CAPACITIES</div>
      <button type="button" className="cluster-motion" onClick={() => setMotion(!motion)} aria-label={motion ? "Pause graphic animation" : "Resume graphic animation"}>{motion ? <Pause size={13} /> : <Play size={13} />}</button>
    </div>
    <div className="cluster-readout" aria-live="polite"><div><span>{selected} / {owner ? "ALLOCATED" : "AVAILABLE"}</span><strong>{owner?.name || "Ready for a workload"}</strong></div><div className="cluster-readout-memory"><span>MEMORY</span><strong>{gpu.total.memory - gpu.available.memory}<small> / {gpu.total.memory}</small></strong></div>{owner && <button type="button" onClick={() => onInspect(owner.job_id)} aria-label={`Inspect allocation for ${owner.name}`}>Inspect <ArrowUpRight size={14} /></button>}</div>
    <div className="cluster-caption"><span>Illustrated hardware · actual replay state</span><span>{running} running / {scene.metrics.waiting} waiting</span></div>
  </div>;
}

export default ClusterScene;
