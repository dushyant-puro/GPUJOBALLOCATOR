import { lazy, Suspense, useEffect, useState } from "react";
import { ArrowUpRight, Cpu, FlaskConical, LayoutDashboard, Moon, Pause, Play, Sun, Terminal, BookOpen, ShieldCheck } from "lucide-react";
import LabBoundary from "./components/LabBoundary";
import ReplayLab from "./components/ReplayLab";
import BenchmarkLab from "./components/BenchmarkLab";
import DemoStudio from "./components/DemoStudio";
import ChallengeLab from "./components/ChallengeLab";
import { checkBackend } from "./services/api";
import "./studio.css";
import "./observatory.css";
import "./workspace-tools.css";
import "./cinematic.css";

const Dashboard = lazy(() => import("./components/Dashboard"));
const pages = { demo: "Demo studio", replay: "Replay lab", benchmarks: "Policy arena", manual: "Manual workspace", challenges: "Challenge lab" };
const initialPage = () => Object.hasOwn(pages, window.location.hash.slice(1)) ? window.location.hash.slice(1) : "demo";

function App() {
  const [page, setPage] = useState(initialPage);
  const [connected, setConnected] = useState(null);
  const [reduceMotion, setReduceMotion] = useState(() => {
    try { return localStorage.getItem("gpu-lab-reduced-motion") === "true"; }
    catch { return false; }
  });
  const [theme, setTheme] = useState(() => {
    try { return localStorage.getItem("gpu-observatory-theme") === "dark" ? "dark" : "light"; }
    catch { return "light"; }
  });

  useEffect(() => {
    const navigate = () => setPage(initialPage());
    window.addEventListener("hashchange", navigate);
    return () => window.removeEventListener("hashchange", navigate);
  }, []);
  useEffect(() => {
    let alive = true;
    const refresh = () => checkBackend().then((response) => {
      if (alive) setConnected(response.data.status === "healthy");
    }).catch(() => { if (alive) setConnected(false); });
    refresh();
    const timer = setInterval(refresh, 10000);
    return () => { alive = false; clearInterval(timer); };
  }, []);
  const changeTheme = (next) => {
    setTheme(next);
    try { localStorage.setItem("gpu-observatory-theme", next); } catch { /* Storage is optional. */ }
  };
  const changeMotion = () => {
    setReduceMotion(!reduceMotion);
    try { localStorage.setItem("gpu-lab-reduced-motion", String(!reduceMotion)); } catch { /* Optional storage. */ }
  };
  return <div className={`workspace theme-${theme} ${reduceMotion ? "motion-reduced" : ""}`}>
    <aside className="studio-sidebar">
      <a className="studio-brand" href="#demo"><span><Cpu size={23} strokeWidth={1.4} /></span><div><strong>GPU Allocator</strong><small>THE SCHEDULING LAB</small></div></a>
      <div className="studio-nav-label">WORKSPACE</div>
      <nav aria-label="Workspace navigation">{[
        ["demo", Play, "Demo studio", "01"], ["replay", Cpu, "Replay lab", "02"],
        ["benchmarks", FlaskConical, "Policy arena", "03"], ["challenges", ShieldCheck, "Challenge lab", "04"], ["manual", LayoutDashboard, "Manual workspace", "05"],
      ].map(([id, Icon, label, number]) => <a key={id} href={`#${id}`} aria-label={label} title={label} className={page === id ? "active" : ""} aria-current={page === id ? "page" : undefined}><Icon size={17} /><span>{label}</span><small>{number}</small></a>)}</nav>
      <div className="studio-sidebar-card"><span className="studio-mini-icon"><BookOpen size={17} /> FIELD NOTES / 001</span><strong>4 jobs. 3 GPUs.<br />One urgent arrival.</strong><p>Follow the interruption, then compare both policies on the same workload.</p><a href="#demo">Explore the scenario <ArrowUpRight size={14} /></a></div>
      <div className="studio-sidebar-bottom"><span className={`studio-status-dot ${connected === false ? "offline" : connected === null ? "checking" : ""}`} /><span>{connected === null ? "Connecting to engine" : connected ? "Local engine connected" : "Engine disconnected"}</span><small>Simulation · single local worker</small></div>
    </aside>
    <main className="studio-main">
      <header className="studio-topbar"><div><span>Workspace</span><b>/</b><strong>{pages[page]}</strong></div><div><span className="studio-mode"><i /> SIMULATION MODE</span><button type="button" className="studio-icon-button" onClick={changeMotion} aria-label="Reduce motion" aria-pressed={reduceMotion} title="Reduce motion; system preference is always respected">{reduceMotion ? <Play size={16} /> : <Pause size={16} />}</button><button type="button" className="studio-icon-button" onClick={() => changeTheme(theme === "dark" ? "light" : "dark")} aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}>{theme === "dark" ? <Sun size={17} /> : <Moon size={17} />}</button><a className="studio-docs" href={import.meta.env.DEV ? "http://127.0.0.1:8000/docs" : "/docs"} target="_blank" rel="noreferrer"><Terminal size={14} /> API docs <ArrowUpRight size={12} /></a></div></header>
      {connected === false && <div className="studio-offline" role="status">The local engine is unavailable. Run <code>start-demo.cmd</code> from the project folder. Prepared demo evidence remains available below.</div>}
      <div className="studio-content" key={page}><LabBoundary key={page}>{page === "demo" ? <DemoStudio connected={connected} /> : page === "replay" ? <ReplayLab /> : page === "benchmarks" ? <BenchmarkLab /> : page === "challenges" ? <ChallengeLab connected={connected} /> : <Suspense fallback={<div className="manual-loading">Opening manual workspace…</div>}><Dashboard embedded theme={theme} onThemeChange={changeTheme} /></Suspense>}</LabBoundary></div>
      <footer className="studio-footer"><span><Cpu size={12} /> GPU Job Allocator</span><span>Simulated resources. Recorded decisions. Reproducible evidence.</span></footer>
    </main>
  </div>;
}

export default App;
