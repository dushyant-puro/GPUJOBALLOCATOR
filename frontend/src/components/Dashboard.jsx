import BenchmarkLab from "./BenchmarkLab";
import ReplayLab from "./ReplayLab";
import { useEffect, useState } from "react";
import {
  Activity,
  BarChart3,
  Boxes,
  CheckCircle2,
  Clock3,
  Cpu,
  Gauge,
  LayoutDashboard,
  ListTodo,
  ServerCog,
  Sun,
  Moon,
  XCircle,
  Zap,
  MemoryStick,
  Thermometer,
  Power,
  HardDrive
} from "lucide-react";


const modernDashboardStyles = `
  :root {
    --modern-bg: #070b14;
    --modern-panel: rgba(15, 23, 42, 0.82);
    --modern-panel-strong: #0f172a;
    --modern-border: rgba(148, 163, 184, 0.14);
    --modern-text: #f8fafc;
    --modern-muted: #94a3b8;
    --modern-primary: #6366f1;
    --modern-primary-2: #8b5cf6;
    --modern-success: #22c55e;
    --modern-warning: #f59e0b;
    --modern-danger: #ef4444;
    --modern-cyan: #06b6d4;
  }

  .dashboard.modern-dashboard {
    min-height: 100vh;
    background:
      radial-gradient(circle at 12% 8%, rgba(99,102,241,.13), transparent 26%),
      radial-gradient(circle at 90% 20%, rgba(6,182,212,.08), transparent 24%),
      linear-gradient(135deg, #070b14 0%, #0a1020 52%, #070b14 100%);
    color: var(--modern-text);
    padding: 0;
    display: flex;
    align-items: stretch;
    gap: 0;
  }

  .modern-sidebar {
    position: sticky;
    top: 0;
    width: 220px;
    min-width: 220px;
    height: 100vh;
    padding: 24px 16px;
    border-right: 1px solid var(--modern-border);
    background: rgba(7, 11, 20, .88);
    backdrop-filter: blur(18px);
    z-index: 20;
    display: flex;
    flex-direction: column;
    box-sizing: border-box;
  }

  .modern-brand {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 4px 8px 24px;
  }

  .modern-brand-icon {
    width: 40px;
    height: 40px;
    display: grid;
    place-items: center;
    border-radius: 12px;
    background: linear-gradient(135deg, var(--modern-primary), var(--modern-primary-2));
    box-shadow: 0 10px 30px rgba(99,102,241,.28);
    font-size: 19px;
  }

  .modern-brand-copy strong {
    display: block;
    font-size: 14px;
    letter-spacing: .02em;
  }

  .modern-brand-copy span {
    display: block;
    margin-top: 2px;
    color: var(--modern-muted);
    font-size: 11px;
  }

  .modern-nav-label {
    padding: 10px 10px 7px;
    color: #64748b;
    font-size: 10px;
    font-weight: 800;
    letter-spacing: .14em;
    text-transform: uppercase;
  }

  .modern-nav {
    display: grid;
    gap: 4px;
  }

  .modern-nav a {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 11px;
    border: 1px solid transparent;
    border-radius: 10px;
    color: #94a3b8;
    text-decoration: none;
    font-size: 13px;
    font-weight: 600;
    transition: .2s ease;
  }

  .modern-nav a:hover,
  .modern-nav a.active {
    color: #fff;
    background: rgba(99,102,241,.12);
    border-color: rgba(99,102,241,.2);
    transform: translateX(2px);
  }

  .modern-nav-icon {
    width: 18px;
    text-align: center;
    opacity: .9;
  }

  .modern-sidebar-bottom {
    margin-top: auto;
    padding: 12px;
    border: 1px solid var(--modern-border);
    border-radius: 14px;
    background: rgba(15,23,42,.65);
  }

  .modern-system-status {
    display: flex;
    align-items: center;
    gap: 8px;
    color: #cbd5e1;
    font-size: 11px;
    font-weight: 700;
  }

  .modern-system-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--modern-success);
    box-shadow: 0 0 12px rgba(34,197,94,.8);
    animation: modernPulse 1.8s infinite;
  }

  .modern-sidebar-bottom small {
    display: block;
    margin-top: 7px;
    color: #64748b;
    font-size: 10px;
  }

  .modern-main {
    min-width: 0;
    flex: 1;
    padding: 24px 26px 48px;
    box-sizing: border-box;
  }

  .modern-main .dashboard-header {
    margin: 0 0 22px;
    padding: 24px 26px;
    border: 1px solid var(--modern-border);
    border-radius: 20px;
    background: linear-gradient(135deg, rgba(15,23,42,.94), rgba(15,23,42,.68));
    box-shadow: 0 24px 70px rgba(0,0,0,.24);
  }

  .modern-main .dashboard-header h1 {
    margin: 0;
    font-size: clamp(25px, 3vw, 34px);
    letter-spacing: -.035em;
  }

  .modern-main .dashboard-header p {
    margin: 6px 0 0;
    color: var(--modern-muted);
    font-size: 13px;
  }

  .modern-main .live-indicator {
    margin-top: 13px;
    color: #cbd5e1;
    font-size: 11px;
    font-weight: 800;
    letter-spacing: .06em;
  }

  .modern-main .live-dot {
    display: inline-block;
    width: 7px;
    height: 7px;
    margin-right: 7px;
    border-radius: 50%;
    background: var(--modern-success);
    box-shadow: 0 0 12px rgba(34,197,94,.75);
  }

  .modern-main .last-updated {
    margin-left: 10px;
    color: #64748b;
    font-weight: 500;
    letter-spacing: 0;
  }

  .modern-main .refresh-button,
  .modern-main button {
    border-radius: 10px;
    transition: transform .18s ease, box-shadow .18s ease, border-color .18s ease;
  }

  .modern-main .refresh-button:hover,
  .modern-main button:hover {
    transform: translateY(-1px);
  }

  .modern-main .stats-grid {
    display: grid;
    grid-template-columns: repeat(6, minmax(0, 1fr));
    gap: 12px;
    margin-bottom: 16px;
  }

  .modern-main .stats-grid .card {
    position: relative;
    overflow: hidden;
    min-height: 112px;
    padding: 17px;
    border: 1px solid var(--modern-border);
    border-radius: 16px;
    background: linear-gradient(145deg, rgba(15,23,42,.92), rgba(15,23,42,.66));
    box-shadow: 0 14px 38px rgba(0,0,0,.16);
    transition: .2s ease;
  }

  .modern-main .stats-grid .card::after {
    content: "";
    position: absolute;
    right: -35px;
    bottom: -55px;
    width: 100px;
    height: 100px;
    border-radius: 50%;
    background: rgba(99,102,241,.08);
  }

  .modern-main .stats-grid .card:hover {
    border-color: rgba(99,102,241,.32);
    transform: translateY(-2px);
    box-shadow: 0 18px 46px rgba(0,0,0,.24);
  }

  .modern-main .stats-grid .card strong {
    display: block;
    margin-top: 9px;
    font-size: 28px;
    line-height: 1;
    letter-spacing: -.04em;
  }

  .modern-main .card-label {
    color: #64748b;
    font-size: 10px;
    font-weight: 900;
    letter-spacing: .12em;
  }

  .modern-main .stats-grid small {
    display: block;
    margin-top: 8px;
    color: #64748b;
    font-size: 10px;
  }

  .modern-main .panel {
    margin-bottom: 16px;
    padding: 21px;
    border: 1px solid var(--modern-border);
    border-radius: 18px;
    background: rgba(15,23,42,.76);
    box-shadow: 0 18px 55px rgba(0,0,0,.16);
    backdrop-filter: blur(12px);
  }

  .modern-main .panel-header {
    margin-bottom: 18px;
  }

  .modern-main .panel-header h2,
  .modern-main .panel > h2 {
    margin: 0;
    font-size: 17px;
    letter-spacing: -.015em;
  }

  .modern-main .panel-header p {
    margin: 5px 0 0;
    color: var(--modern-muted);
    font-size: 11px;
  }

  .modern-main .resource-grid {
    gap: 12px;
  }

  .modern-main .resource-card {
    border: 1px solid rgba(148,163,184,.12);
    border-radius: 14px;
    background: rgba(7,11,20,.45);
    transition: .2s ease;
  }

  .modern-main .resource-card:hover {
    border-color: rgba(99,102,241,.25);
    background: rgba(15,23,42,.75);
    transform: translateY(-2px);
  }

  .modern-main .progress-bar {
    overflow: hidden;
    height: 7px;
    border-radius: 999px;
    background: #1e293b;
  }

  .modern-main .progress-fill {
    min-width: 2px;
    border-radius: inherit;
    background: linear-gradient(90deg, var(--modern-primary), var(--modern-cyan));
    box-shadow: 0 0 14px rgba(99,102,241,.35);
    transition: width .5s ease;
  }

  .modern-main .live-badge {
    border: 1px solid rgba(34,197,94,.18);
    background: rgba(34,197,94,.08);
    color: #86efac;
    border-radius: 999px;
    padding: 6px 9px;
    font-size: 10px;
    font-weight: 800;
  }

  .modern-main .error {
    margin-bottom: 16px;
    border-radius: 12px;
    border: 1px solid rgba(239,68,68,.25);
    background: rgba(239,68,68,.08);
    color: #fca5a5;
  }

  .modern-main input,
  .modern-main select {
    min-height: 40px;
    border: 1px solid rgba(148,163,184,.16);
    border-radius: 10px;
    background: #0b1220;
    color: #f8fafc;
    outline: none;
    transition: .18s ease;
  }

  .modern-main input:focus,
  .modern-main select:focus {
    border-color: rgba(99,102,241,.65);
    box-shadow: 0 0 0 3px rgba(99,102,241,.12);
  }

  .modern-main table {
    border-collapse: separate;
    border-spacing: 0;
    overflow: hidden;
    border: 1px solid rgba(148,163,184,.1);
    border-radius: 14px;
  }

  .modern-main th {
    background: rgba(30,41,59,.72);
    color: #94a3b8;
    font-size: 10px;
    letter-spacing: .07em;
    text-transform: uppercase;
  }

  .modern-main td {
    border-color: rgba(148,163,184,.08) !important;
    font-size: 12px;
  }

  .modern-main tbody tr {
    transition: background .16s ease;
  }

  .modern-main tbody tr:hover {
    background: rgba(99,102,241,.045);
  }

  .modern-section-kicker {
    margin: 0 0 9px;
    color: #818cf8;
    font-size: 10px;
    font-weight: 900;
    letter-spacing: .16em;
    text-transform: uppercase;
  }

  .modern-main .modern-accent-panel {
    border-color: rgba(99,102,241,.22);
    background: linear-gradient(145deg, rgba(30,27,75,.45), rgba(15,23,42,.76));
  }

  @keyframes modernPulse {
    0%, 100% { opacity: 1; transform: scale(1); }
    50% { opacity: .55; transform: scale(.86); }
  }


  /* ==========================================
     SINGLE-VIEW DASHBOARD NAVIGATION
     ========================================== */

  .modern-main[data-active-section] > section[data-dashboard-section] {
    display: none;
  }

  .modern-main[data-active-section="overview"] > section[data-dashboard-section="overview"],
  .modern-main[data-active-section="gpu-cluster"] > section[data-dashboard-section="gpu-cluster"],
  .modern-main[data-active-section="scheduler"] > section[data-dashboard-section="scheduler"],
  .modern-main[data-active-section="analytics"] > section[data-dashboard-section="analytics"],
  .modern-main[data-active-section="workloads"] > section[data-dashboard-section="workloads"],
  .modern-main[data-active-section="stress-test"] > section[data-dashboard-section="stress-test"],
  .modern-main[data-active-section="decisions"] > section[data-dashboard-section="decisions"] {
    display: block;
    animation: dashboardSectionIn .22s ease both;
  }

  @keyframes dashboardSectionIn {
    from { opacity: 0; transform: translateY(5px); }
    to { opacity: 1; transform: translateY(0); }
  }

  .modern-view-label {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin: 0 0 16px;
    color: var(--modern-muted);
    font-size: 11px;
    font-weight: 700;
    letter-spacing: .08em;
    text-transform: uppercase;
  }

  .modern-view-label strong {
    color: #e2e8f0;
    font-size: 13px;
    letter-spacing: 0;
    text-transform: none;
  }

  .modern-nav button {
    appearance: none;
    width: 100%;
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 11px;
    border: 1px solid transparent;
    border-radius: 10px;
    color: #94a3b8;
    background: transparent;
    text-align: left;
    font-size: 13px;
    font-weight: 600;
    transition: .2s ease;
  }

  .modern-nav button:hover,
  .modern-nav button.active {
    color: #fff;
    background: rgba(99,102,241,.12);
    border-color: rgba(99,102,241,.2);
    transform: translateX(2px);
  }

  @media (max-width: 1180px) {
    .advanced-gpu-grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }

  @media (max-width: 720px) {
    .advanced-gpu-grid {
      grid-template-columns: 1fr;
    }

    .advanced-gpu-card {
      padding: 16px;
    }
  }

  @media (max-width: 900px) {
    .modern-sidebar {
      width: 190px;
      min-width: 190px;
      padding-left: 12px;
      padding-right: 12px;
    }

    .modern-main {
      padding-left: 18px;
      padding-right: 18px;
    }
  }

  @media (max-width: 640px) {
    .modern-dashboard {
      display: block !important;
    }

    .modern-sidebar {
      position: relative;
      width: 100%;
      min-width: 0;
      height: auto;
      padding: 12px;
      border-right: 0;
      border-bottom: 1px solid var(--modern-border);
    }

    .modern-brand {
      padding-bottom: 10px;
    }

    .modern-sidebar-bottom {
      display: none;
    }

    .modern-nav {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .modern-main {
      padding: 16px 12px 32px;
    }
  }

  @media (max-width: 1200px) {
    .modern-main .stats-grid {
      grid-template-columns: repeat(3, minmax(0, 1fr));
    }
  }

  @media (max-width: 900px) {
    .modern-dashboard {
      display: block !important;
    }
    .modern-sidebar {
      position: relative;
      width: 100%;
      min-width: 0;
      height: auto;
      border-right: 0;
      border-bottom: 1px solid var(--modern-border);
    }
    .modern-nav {
      grid-template-columns: repeat(4, minmax(0, 1fr));
    }
    .modern-sidebar-bottom {
      display: none;
    }
    .modern-main {
      padding: 18px;
    }
  }

  @media (max-width: 640px) {
    .modern-main .stats-grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
    .modern-nav {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
    .modern-main .dashboard-header {
      padding: 18px;
    }
  }

  /* =========================================================
     SAAS COMMAND CENTER VISUAL PASS
     Inspired by the supplied reference layout
     ========================================================= */

  .dashboard.modern-dashboard {
    width: 100%;
    min-height: 100vh;
    overflow-x: hidden;
    background:
      radial-gradient(circle at 18% 4%, rgba(59,130,246,.13), transparent 22%),
      radial-gradient(circle at 82% 8%, rgba(14,165,233,.08), transparent 24%),
      linear-gradient(135deg, #07101d 0%, #091321 48%, #060c16 100%);
  }

  .modern-sidebar {
    width: 286px;
    min-width: 286px;
    padding: 26px 18px 20px;
    background:
      linear-gradient(180deg, rgba(10,19,33,.97), rgba(5,12,22,.98));
    border-right: 1px solid rgba(148,163,184,.13);
    box-shadow: 14px 0 45px rgba(0,0,0,.16);
  }

  .modern-brand {
    padding: 4px 9px 28px;
    gap: 12px;
  }

  .modern-brand-icon {
    width: 43px;
    height: 43px;
    border-radius: 13px;
    background:
      linear-gradient(135deg, #38bdf8 0%, #6366f1 48%, #8b5cf6 100%);
    box-shadow:
      0 10px 30px rgba(59,130,246,.26),
      inset 0 1px 0 rgba(255,255,255,.25);
    font-size: 20px;
  }

  .modern-brand-copy strong {
    font-size: 15px;
    color: #f8fafc;
  }

  .modern-brand-copy span {
    font-size: 10px;
    color: #718096;
  }

  .modern-nav-label {
    padding: 8px 12px 9px;
    color: #526174;
    font-size: 10px;
  }

  .modern-nav {
    gap: 5px;
  }

  .modern-nav button {
    min-height: 43px;
    padding: 10px 13px;
    border-radius: 11px;
    color: #8291a5;
    font-size: 13px;
    font-weight: 650;
  }

  .modern-nav button:hover {
    color: #e2e8f0;
    background: rgba(59,130,246,.07);
    border-color: rgba(96,165,250,.10);
    transform: translateX(1px);
  }

  .modern-nav button.active {
    color: #f8fafc;
    background:
      linear-gradient(90deg, rgba(59,130,246,.18), rgba(99,102,241,.10));
    border-color: rgba(96,165,250,.19);
    box-shadow:
      inset 3px 0 0 #38bdf8,
      0 8px 22px rgba(15,23,42,.20);
  }

  .modern-nav button.active .modern-nav-icon {
    color: #67e8f9;
  }

  .modern-nav-icon {
    width: 19px;
    color: #64748b;
    font-size: 14px;
  }

  .modern-sidebar-bottom {
    padding: 13px 14px;
    border-radius: 12px;
    background: linear-gradient(135deg, rgba(16,34,50,.82), rgba(10,24,38,.74));
    border-color: rgba(34,197,94,.14);
    box-shadow: 0 12px 30px rgba(0,0,0,.18);
  }

  .modern-main {
    padding: 20px 28px 48px;
  }

  .modern-main .dashboard-header {
    min-height: 144px;
    margin: 0 0 22px;
    padding: 24px 27px;
    border-radius: 18px;
    border: 1px solid rgba(96,165,250,.18);
    background:
      radial-gradient(circle at 92% 0%, rgba(14,165,233,.13), transparent 28%),
      linear-gradient(135deg, rgba(30,41,59,.92), rgba(13,24,40,.90));
    box-shadow:
      0 18px 55px rgba(0,0,0,.25),
      inset 0 1px 0 rgba(255,255,255,.045);
  }

  .modern-main .dashboard-header h1 {
    font-size: clamp(30px, 3vw, 42px);
    font-weight: 800;
    letter-spacing: -.045em;
  }

  .modern-main .dashboard-header p {
    margin-top: 7px;
    color: #9aa9ba;
    font-size: 14px;
  }

  .modern-main .refresh-button {
    min-width: 112px;
    min-height: 42px;
    border: 1px solid rgba(125,211,252,.20);
    background: linear-gradient(135deg, #1686d9, #2563eb);
    box-shadow: 0 10px 24px rgba(37,99,235,.25);
  }

  .modern-main .refresh-button:hover {
    box-shadow: 0 14px 28px rgba(37,99,235,.34);
  }

  .modern-view-label {
    margin: 0 0 13px;
    padding: 0 2px;
  }

  .modern-view-label strong {
    font-size: 18px;
    font-weight: 750;
    letter-spacing: -.02em;
  }

  .modern-view-label span {
    color: #64748b;
    font-size: 10px;
    letter-spacing: .12em;
  }

  .modern-main .stats-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 20px;
    margin-bottom: 0;
  }

  .modern-main .stats-grid .card {
    position: relative;
    min-height: 218px;
    overflow: hidden;
    padding: 27px 24px 24px;
    border-radius: 16px;
    border: 1px solid rgba(148,163,184,.15);
    background:
      linear-gradient(145deg, rgba(24,39,57,.96), rgba(12,23,38,.94));
    box-shadow:
      0 18px 42px rgba(0,0,0,.22),
      inset 0 1px 0 rgba(255,255,255,.035);
  }

  .modern-main .stats-grid .card::before {
    content: "";
    position: absolute;
    width: 92px;
    height: 92px;
    right: 20px;
    top: 24px;
    border-radius: 50%;
    border: 7px solid rgba(71,85,105,.42);
    border-top-color: rgba(56,189,248,.92);
    border-right-color: rgba(99,102,241,.72);
    transform: rotate(-26deg);
    opacity: .95;
    box-shadow: 0 0 24px rgba(56,189,248,.07);
  }

  .modern-main .stats-grid .card::after {
    content: "";
    position: absolute;
    left: 22px;
    right: 22px;
    bottom: 18px;
    height: 52px;
    opacity: .46;
    background:
      linear-gradient(160deg, transparent 0 18%, rgba(56,189,248,.0) 18% 27%, rgba(56,189,248,.55) 28% 30%, transparent 31% 38%, rgba(56,189,248,.38) 39% 41%, transparent 42% 50%, rgba(56,189,248,.62) 51% 53%, transparent 54% 64%, rgba(56,189,248,.44) 65% 67%, transparent 68% 100%);
    clip-path: polygon(0 78%, 8% 64%, 16% 70%, 25% 50%, 34% 61%, 43% 38%, 51% 47%, 61% 22%, 70% 38%, 78% 16%, 88% 30%, 100% 7%, 100% 100%, 0 100%);
  }

  .modern-main .stats-grid .card:nth-child(2)::before {
    border-top-color: #34d399;
    border-right-color: #22c55e;
  }

  .modern-main .stats-grid .card:nth-child(3)::before {
    border-top-color: #fb923c;
    border-right-color: #a78bfa;
  }

  .modern-main .stats-grid .card:nth-child(4)::before {
    border-top-color: #fbbf24;
    border-right-color: #f59e0b;
  }

  .modern-main .stats-grid .card:nth-child(5)::before {
    border-top-color: #fb7185;
    border-right-color: #f97316;
  }

  .modern-main .stats-grid .card:nth-child(6)::before {
    border-top-color: #64748b;
    border-right-color: #475569;
  }

  .modern-main .stats-grid .card:hover {
    transform: translateY(-3px);
    border-color: rgba(96,165,250,.30);
    box-shadow:
      0 24px 50px rgba(0,0,0,.27),
      0 0 28px rgba(37,99,235,.06);
  }

  .modern-main .stats-grid .card-label {
    position: relative;
    z-index: 1;
    color: #9aa9ba;
    font-size: 12px;
    font-weight: 800;
    letter-spacing: .045em;
  }

  .modern-main .stats-grid .card strong {
    position: relative;
    z-index: 1;
    display: block;
    margin-top: 18px;
    font-size: clamp(42px, 4vw, 57px);
    line-height: .95;
    letter-spacing: -.055em;
  }

  .modern-main .stats-grid .card:nth-child(1) strong {
    color: #22d3ee;
    text-shadow: 0 0 24px rgba(34,211,238,.16);
  }

  .modern-main .stats-grid .card:nth-child(2) strong {
    color: #4ade80;
    text-shadow: 0 0 24px rgba(74,222,128,.14);
  }

  .modern-main .stats-grid .card:nth-child(3) strong {
    color: #fb923c;
  }

  .modern-main .stats-grid .card:nth-child(4) strong {
    color: #fbbf24;
  }

  .modern-main .stats-grid .card:nth-child(5) strong {
    color: #fb6b4d;
  }

  .modern-main .stats-grid .card:nth-child(6) strong {
    color: #f8fafc;
  }

  .modern-main .stats-grid .card small {
    position: relative;
    z-index: 1;
    display: block;
    margin-top: 9px;
    color: #a1adbc;
    font-size: 12px;
  }

  .modern-main .panel {
    border-radius: 16px;
    border-color: rgba(148,163,184,.13);
    background:
      linear-gradient(145deg, rgba(19,32,49,.95), rgba(10,20,34,.94));
    box-shadow:
      0 18px 44px rgba(0,0,0,.20),
      inset 0 1px 0 rgba(255,255,255,.025);
  }

  .modern-main .panel-header h2 {
    font-size: 21px;
    letter-spacing: -.025em;
  }

  .modern-main .resource-grid,
  .modern-main .analytics-grid {
    gap: 14px;
  }

  .modern-main .resource-card,
  .modern-main .analytics-card {
    border-radius: 13px;
    border-color: rgba(148,163,184,.11);
    background: rgba(9,19,32,.66);
  }

  .modern-main table {
    width: 100%;
  }

  @media (max-width: 1200px) {
    .modern-sidebar {
      width: 250px;
      min-width: 250px;
    }

    .modern-main {
      padding-left: 20px;
      padding-right: 20px;
    }

    .modern-main .stats-grid {
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 14px;
    }
  }

  @media (max-width: 900px) {
    .modern-sidebar {
      width: 100%;
      min-width: 0;
    }

    .modern-main .stats-grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }

  @media (max-width: 640px) {
    .modern-main .stats-grid {
      grid-template-columns: 1fr;
    }

    .modern-main .stats-grid .card {
      min-height: 190px;
    }
  }


  /* =========================================================
     SIDE-BY-SIDE KPI GRID — FORCE DESKTOP 3 x 2 LAYOUT
     ========================================================= */

  .modern-dashboard .modern-main .stats-grid {
    display: grid !important;
    width: 100% !important;
    max-width: none !important;
    grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
    grid-auto-flow: row !important;
    align-items: stretch !important;
    gap: 20px !important;
  }

  .modern-dashboard .modern-main .stats-grid > .card {
    width: 100% !important;
    min-width: 0 !important;
    max-width: none !important;
    margin: 0 !important;
  }

  .modern-dashboard .modern-main {
    width: 100% !important;
    max-width: none !important;
    min-width: 0 !important;
  }

  /* Keep the six KPI cards in exactly two rows on normal desktop screens. */
  @media (min-width: 1001px) {
    .modern-dashboard .modern-main .stats-grid {
      grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
    }

    .modern-dashboard .modern-main .stats-grid > .card {
      min-height: 218px !important;
    }
  }

  @media (min-width: 701px) and (max-width: 1000px) {
    .modern-dashboard .modern-main .stats-grid {
      grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
    }
  }

  @media (max-width: 700px) {
    .modern-dashboard .modern-main .stats-grid {
      grid-template-columns: 1fr !important;
    }
  }

  /* Make the content use the entire area to the right of the sidebar. */
  .modern-dashboard .modern-main .stats-grid + * {
    width: 100%;
  }

  /* Remove any inherited narrow max-width that may be coming from App.css. */
  .modern-dashboard .modern-main > * {
    max-width: none;
  }


  /* =========================================================
     LUCIDE KPI / NAV VISUAL SYSTEM
     Removes the oversized donut treatment and replaces it
     with compact icon-led SaaS cards.
     ========================================================= */

  .modern-nav button {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 11px;
    min-height: 43px;
    padding: 10px 12px;
    border: 1px solid transparent;
    border-radius: 11px;
    background: transparent;
    color: #7f8da1;
    text-align: left;
    font-size: 13px;
    font-weight: 650;
    cursor: pointer;
  }

  .modern-nav button:hover {
    color: #e2e8f0;
    background: rgba(59,130,246,.08);
    border-color: rgba(96,165,250,.10);
    transform: translateX(1px);
  }

  .modern-nav button.active {
    color: #f8fafc;
    background: linear-gradient(90deg, rgba(59,130,246,.17), rgba(99,102,241,.08));
    border-color: rgba(96,165,250,.16);
    box-shadow: inset 3px 0 0 #38bdf8;
  }

  .modern-nav-icon {
    width: 19px;
    height: 19px;
    display: inline-grid;
    place-items: center;
    flex: 0 0 19px;
    color: #64748b;
  }

  .modern-nav button.active .modern-nav-icon {
    color: #67e8f9;
  }

  .modern-brand-icon {
    display: grid;
    place-items: center;
  }

  .modern-kpi-grid {
    display: grid !important;
    grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
    gap: 16px !important;
  }

  .modern-kpi-card {
    min-height: 190px !important;
    padding: 21px 21px 17px !important;
    border-radius: 15px !important;
    position: relative;
    overflow: hidden;
    background:
      linear-gradient(145deg, rgba(20,35,54,.98), rgba(10,22,37,.96)) !important;
    border: 1px solid rgba(100,116,139,.20) !important;
    box-shadow:
      0 16px 38px rgba(0,0,0,.20),
      inset 0 1px 0 rgba(255,255,255,.035) !important;
  }

  .modern-kpi-card::before {
    content: "";
    position: absolute;
    left: 0;
    top: 0;
    width: 100%;
    height: 2px;
    background: currentColor;
    opacity: .65;
  }

  .modern-kpi-card::after {
    content: "";
    position: absolute;
    width: 150px;
    height: 150px;
    right: -72px;
    bottom: -78px;
    border-radius: 50%;
    background: currentColor;
    opacity: .035;
    pointer-events: none;
  }

  .modern-kpi-top {
    position: relative;
    z-index: 2;
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .modern-kpi-card .card-label {
    color: #91a0b3 !important;
    font-size: 11px !important;
    letter-spacing: .10em !important;
    font-weight: 800 !important;
  }

  .modern-kpi-icon {
    width: 38px;
    height: 38px;
    display: grid;
    place-items: center;
    border-radius: 10px;
    background: rgba(15,23,42,.72);
    border: 1px solid rgba(148,163,184,.13);
    color: currentColor;
  }

  .modern-kpi-card strong {
    position: relative;
    z-index: 2;
    display: block;
    margin-top: 20px !important;
    font-size: 42px !important;
    line-height: .9 !important;
    letter-spacing: -.055em !important;
    color: currentColor;
  }

  .modern-kpi-card small {
    position: relative;
    z-index: 2;
    margin-top: 10px !important;
    color: #8d9bad !important;
    font-size: 11px !important;
  }

  .modern-kpi-footer {
    position: absolute;
    z-index: 2;
    left: 21px;
    right: 21px;
    bottom: 15px;
    display: flex;
    align-items: center;
    gap: 7px;
    color: #64748b;
    font-size: 10px;
    font-weight: 650;
    letter-spacing: .01em;
  }

  .modern-kpi-footer svg {
    color: currentColor;
    opacity: .75;
  }

  .modern-kpi-cyan { color: #22d3ee !important; }
  .modern-kpi-green { color: #4ade80 !important; }
  .modern-kpi-orange { color: #fb923c !important; }
  .modern-kpi-yellow { color: #fbbf24 !important; }
  .modern-kpi-red { color: #fb7185 !important; }
  .modern-kpi-slate { color: #dbe4ee !important; }

  .modern-kpi-card:hover {
    transform: translateY(-3px) !important;
    border-color: rgba(96,165,250,.30) !important;
    box-shadow:
      0 22px 46px rgba(0,0,0,.25),
      0 0 26px rgba(56,189,248,.045) !important;
  }

  /* Make the KPI area visually denser like a professional admin console. */
  .modern-main .stats-grid {
    margin-bottom: 20px !important;
  }

  @media (max-width: 1000px) {
    .modern-kpi-grid {
      grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
    }
  }

  @media (max-width: 680px) {
    .modern-kpi-grid {
      grid-template-columns: 1fr !important;
    }
  }
\n\n  /* =========================================================\n     FINAL CLEAN SAAS OVERLAY\n     White by default + optional night mode.\n     Metric visuals never overlap text.\n     ========================================================= */\n\n  .dashboard.modern-dashboard {\n    --page-bg: #f4f7fb;\n    --surface: #ffffff;\n    --surface-soft: #f8fafc;\n    --border-light: #e5eaf1;\n    --text-main: #172033;\n    --text-muted: #64748b;\n    --text-secondary: #9ca3af;\n    background: #f4f7fb !important;\n    color: #172033 !important;\n  }\n\n  .modern-sidebar {\n    width: 246px !important;\n    min-width: 246px !important;\n    background: #ffffff !important;\n    border-right: 1px solid #e5eaf1 !important;\n    box-shadow: 8px 0 28px rgba(15,23,42,.035) !important;\n  }\n\n  .modern-main {\n    min-width: 0;\n    background: #f4f7fb !important;\n  }\n\n  .modern-main .dashboard-header {\n    background: #ffffff !important;\n    border-color: #e5eaf1 !important;\n    box-shadow: 0 8px 24px rgba(15,23,42,.045) !important;\n  }\n\n  .modern-main .dashboard-header h1 {\n    color: #172033 !important;\n  }\n\n  .modern-main .dashboard-header p,\n  .modern-main .last-updated {\n    color: #64748b !important;\n  }\n\n  /* The six overview metrics are deliberately 3 x 2. */\n  .modern-main .stats-grid.modern-kpi-grid {\n    display: grid !important;\n    grid-template-columns: repeat(3, minmax(0, 1fr)) !important;\n    gap: 18px !important;\n    margin-bottom: 22px !important;\n  }\n\n  .modern-main .stats-grid .modern-kpi-card {\n    position: relative !important;\n    min-height: 184px !important;\n    padding: 22px !important;\n    overflow: hidden !important;\n    border: 1px solid #e5eaf1 !important;\n    border-radius: 18px !important;\n    background: #ffffff !important;\n    color: #172033 !important;\n    box-shadow: 0 8px 24px rgba(15,23,42,.055) !important;\n    display: flex !important;\n    flex-direction: column !important;\n    align-items: stretch !important;\n    justify-content: flex-start !important;\n  }\n\n  .modern-main .stats-grid .modern-kpi-card:hover {\n    transform: translateY(-2px) !important;\n    border-color: #d6e1ee !important;\n    box-shadow: 0 14px 30px rgba(15,23,42,.08) !important;\n  }\n\n  /* Disable old decorative circles that caused the overlap. */\n  .modern-main .stats-grid .modern-kpi-card::before,\n  .modern-main .stats-grid .modern-kpi-card::after {\n    display: none !important;\n  }\n\n  .modern-main .modern-kpi-top {\n    width: 100% !important;\n    min-height: 44px !important;\n    display: flex !important;\n    align-items: flex-start !important;\n    justify-content: space-between !important;\n    gap: 14px !important;\n    margin: 0 !important;\n  }\n\n  .modern-main .modern-kpi-top .card-label {\n    padding-top: 5px !important;\n    color: #64748b !important;\n    font-size: 10px !important;\n    line-height: 1.2 !important;\n    font-weight: 850 !important;\n    letter-spacing: .12em !important;\n  }\n\n  .modern-main .modern-kpi-icon {\n    position: static !important;\n    width: 44px !important;\n    height: 44px !important;\n    min-width: 44px !important;\n    display: grid !important;\n    place-items: center !important;\n    border: 0 !important;\n    border-radius: 12px !important;\n    box-shadow: none !important;\n  }\n\n  .modern-main .modern-kpi-card strong {\n    display: block !important;\n    margin: 21px 0 0 !important;\n    padding: 0 !important;\n    color: #172033 !important;\n    font-size: 36px !important;\n    line-height: 1 !important;\n    font-weight: 800 !important;\n    letter-spacing: -.045em !important;\n  }\n\n  .modern-main .stats-grid .modern-kpi-card > small {\n    display: block !important;\n    margin: 10px 0 0 !important;\n    padding: 10px 0 0 !important;\n    border-top: 1px solid #edf1f5 !important;\n    color: #9ca3af !important;\n    font-size: 11px !important;\n    line-height: 1.35 !important;\n    font-weight: 550 !important;\n  }\n\n  .modern-main .modern-kpi-footer {\n    position: static !important;\n    display: flex !important;\n    align-items: center !important;\n    gap: 6px !important;\n    margin-top: auto !important;\n    padding-top: 12px !important;\n    color: #9ca3af !important;\n    font-size: 10px !important;\n  }\n\n  .modern-main .modern-kpi-cyan .modern-kpi-icon { background: #e8f8fb !important; color: #0891b2 !important; }\n  .modern-main .modern-kpi-green .modern-kpi-icon { background: #e8f8f0 !important; color: #059669 !important; }\n  .modern-main .modern-kpi-orange .modern-kpi-icon { background: #fff3e0 !important; color: #d97706 !important; }\n  .modern-main .modern-kpi-yellow .modern-kpi-icon { background: #fff8df !important; color: #ca8a04 !important; }\n  .modern-main .modern-kpi-red .modern-kpi-icon { background: #fff0f0 !important; color: #dc2626 !important; }\n  .modern-main .modern-kpi-slate .modern-kpi-icon { background: #eef2f7 !important; color: #64748b !important; }\n\n  .modern-main .panel {\n    background: #ffffff !important;\n    border-color: #e5eaf1 !important;\n    border-radius: 18px !important;\n    box-shadow: 0 8px 24px rgba(15,23,42,.045) !important;\n  }\n\n  .modern-main .panel-header h2,\n  .modern-main .panel > h2 {\n    color: #172033 !important;\n  }\n\n  .modern-main .panel-header p {\n    color: #64748b !important;\n  }\n\n  .modern-main input,\n  .modern-main select,\n  .modern-main textarea {\n    background: #ffffff !important;\n    color: #172033 !important;\n    border-color: #dbe3ed !important;\n  }\n\n  .modern-main th {\n    background: #f8fafc !important;\n    color: #64748b !important;\n  }\n\n  .modern-main td {\n    color: #334155 !important;\n  }\n\n  .modern-header-actions {\n    display: flex;\n    align-items: center;\n    gap: 9px;\n  }\n\n  .modern-header-theme {\n    min-height: 40px;\n    padding: 0 12px;\n    display: inline-flex;\n    align-items: center;\n    gap: 7px;\n    border: 1px solid #dbe3ed;\n    border-radius: 10px;\n    background: #ffffff;\n    color: #475569;\n    font-size: 11px;\n    font-weight: 750;\n    cursor: pointer;\n  }\n\n  .modern-header-theme:hover {\n    color: #2563eb;\n    border-color: #bfdbfe;\n  }\n\n  .modern-theme-switcher {\n    display: flex;\n    align-items: center;\n    justify-content: space-between;\n    gap: 8px;\n    margin-top: auto;\n    margin-bottom: 12px;\n    padding: 9px 10px;\n    border: 1px solid #e5eaf1;\n    border-radius: 11px;\n    background: #f8fafc;\n    color: #475569;\n    font-size: 10px;\n    font-weight: 700;\n  }\n\n  .modern-theme-switcher > div {\n    display: flex;\n    align-items: center;\n    gap: 7px;\n  }\n\n  .modern-theme-switcher button {\n    padding: 5px 8px;\n    border: 1px solid #dbe3ed;\n    border-radius: 7px;\n    background: #ffffff;\n    color: #2563eb;\n    font-size: 9px;\n    font-weight: 800;\n    cursor: pointer;\n  }\n\n  /* Night mode */\n  .dashboard.modern-dashboard.theme-dark {\n    background: #0b1120 !important;\n    color: #f8fafc !important;\n  }\n\n  .theme-dark .modern-main { background: #0b1120 !important; }\n  .theme-dark .modern-sidebar {\n    background: #111827 !important;\n    border-right-color: #26344d !important;\n  }\n  .theme-dark .modern-main .dashboard-header,\n  .theme-dark .modern-main .panel {\n    background: #111c2d !important;\n    border-color: #26344d !important;\n    box-shadow: 0 12px 30px rgba(0,0,0,.18) !important;\n  }\n  .theme-dark .modern-main .dashboard-header h1,\n  .theme-dark .modern-main .panel-header h2,\n  .theme-dark .modern-main .panel > h2 { color: #f8fafc !important; }\n  .theme-dark .modern-main .dashboard-header p,\n  .theme-dark .modern-main .panel-header p,\n  .theme-dark .modern-main .last-updated { color: #94a3b8 !important; }\n  .theme-dark .modern-main .stats-grid .modern-kpi-card {\n    background: #111c2d !important;\n    border-color: #26344d !important;\n    color: #f8fafc !important;\n  }\n  .theme-dark .modern-main .stats-grid .modern-kpi-card strong { color: #f8fafc !important; }\n  .theme-dark .modern-main .modern-kpi-top .card-label { color: #cbd5e1 !important; }\n  .theme-dark .modern-main .stats-grid .modern-kpi-card > small,\n  .theme-dark .modern-main .modern-kpi-footer { color: #9ca3af !important; }\n  .theme-dark .modern-main .stats-grid .modern-kpi-card > small { border-top-color: #26344d !important; }\n  .theme-dark .modern-main input,\n  .theme-dark .modern-main select,\n  .theme-dark .modern-main textarea {\n    background: #0f172a !important;\n    color: #f8fafc !important;\n    border-color: #334155 !important;\n  }\n  .theme-dark .modern-main th { background: #162235 !important; color: #94a3b8 !important; }\n  .theme-dark .modern-main td { color: #cbd5e1 !important; border-color: #223047 !important; }\n  .theme-dark .modern-header-theme { background: #0f172a; border-color: #334155; color: #cbd5e1; }\n  .theme-dark .modern-theme-switcher { background: #0f172a; border-color: #26344d; color: #cbd5e1; }\n  .theme-dark .modern-theme-switcher button { background: #111c2d; border-color: #334155; color: #93c5fd; }\n\n  /* =========================================================
     ANALYTICS POLISH
     ========================================================= */

  .dashboard.modern-dashboard {
    width: 100vw !important;
    min-height: 100vh !important;
    max-width: none !important;
    margin: 0 !important;
    padding: 0 !important;
    overflow-x: hidden !important;
  }

  .modern-sidebar {
    border-right: 1px solid #e2e8f0 !important;
    box-shadow: 2px 0 12px rgba(15, 23, 42, 0.035) !important;
  }

  .modern-main .dashboard-header,
  .modern-main .panel {
    border-color: #f1f5f9 !important;
    box-shadow: 0 1px 3px rgba(15, 23, 42, 0.05) !important;
  }

  .modern-main .dashboard-header h1,
  .modern-main .panel-header h2,
  .modern-main .panel > h2 {
    color: #0f172a !important;
  }

  .modern-main .dashboard-header p,
  .modern-main .panel-header p,
  .modern-main .modern-view-label span {
    color: #475569 !important;
  }

  .modern-main .live-indicator {
    color: #166534 !important;
  }

  .modern-main .live-dot {
    background: #16a34a !important;
    box-shadow: 0 0 0 4px rgba(34,197,94,.12) !important;
  }

  .modern-main .live-badge {
    background: #ecfdf3 !important;
    border: 1px solid #bbf7d0 !important;
    color: #15803d !important;
  }

  .modern-nav button.active {
    background: #eff6ff !important;
    color: #1d4ed8 !important;
    border-color: #dbeafe !important;
    box-shadow: inset 3px 0 0 #2563eb !important;
    transform: none !important;
  }

  .modern-nav button.active .modern-nav-icon {
    color: #1d4ed8 !important;
  }

  .modern-nav button:hover {
    color: #1d4ed8 !important;
    background: #f8fbff !important;
    border-color: #e0edff !important;
  }

  .analytics-summary-grid {
    display: grid !important;
    grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
    gap: 18px !important;
    margin-bottom: 20px !important;
  }

  .analytics-summary-card {
    min-height: 190px;
    padding: 20px !important;
    border: 1px solid #f1f5f9 !important;
    border-radius: 16px !important;
    background: #ffffff !important;
    box-shadow: 0 1px 3px rgba(15,23,42,.05) !important;
    color: #0f172a !important;
    display: flex;
    flex-direction: column;
  }

  .analytics-summary-top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }

  .analytics-summary-top > span:first-child {
    color: #64748b;
    font-size: 10px;
    font-weight: 850;
    letter-spacing: .12em;
  }

  .analytics-summary-icon {
    width: 38px;
    height: 38px;
    display: grid;
    place-items: center;
    border-radius: 10px;
    background: #eff6ff;
    color: #2563eb;
  }

  .analytics-summary-card strong {
    margin-top: 25px;
    color: #0f172a;
    font-size: 34px;
    line-height: 1;
    letter-spacing: -.04em;
  }

  .analytics-summary-card small {
    margin-top: 9px;
    color: #475569;
    font-size: 11px;
  }

  .analytics-summary-meter {
    height: 6px;
    margin-top: auto;
    overflow: hidden;
    border-radius: 999px;
    background: #e2e8f0;
  }

  .analytics-summary-meter span {
    display: block;
    height: 100%;
    border-radius: inherit;
    background: #3b82f6;
    transition: width .4s ease;
  }

  .analytics-fragmentation .analytics-summary-meter span { background: #22c55e; }
  .analytics-efficiency .analytics-summary-meter span { background: #f59e0b; }

  .analytics-chart-card {
    margin-bottom: 18px;
    padding: 20px;
    border: 1px solid #f1f5f9;
    border-radius: 16px;
    background: #ffffff;
    box-shadow: 0 1px 3px rgba(15,23,42,.05);
  }

  .analytics-chart-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 20px;
    margin-bottom: 10px;
  }

  .analytics-chart-kicker {
    color: #2563eb;
    font-size: 9px;
    font-weight: 850;
    letter-spacing: .14em;
  }

  .analytics-chart-header h3 {
    margin: 5px 0 3px;
    color: #0f172a;
    font-size: 17px;
  }

  .analytics-chart-header p {
    margin: 0;
    color: #64748b;
    font-size: 11px;
  }

  .analytics-chart-legend {
    display: flex;
    flex-wrap: wrap;
    justify-content: flex-end;
    gap: 12px;
    color: #64748b;
    font-size: 10px;
    font-weight: 650;
  }

  .analytics-chart-legend span {
    display: inline-flex;
    align-items: center;
    gap: 5px;
  }

  .legend-dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
  }

  .legend-blue { background: #3b82f6; }
  .legend-green { background: #22c55e; }
  .legend-orange { background: #f59e0b; }

  .analytics-chart-wrap {
    width: 100%;
    min-height: 270px;
  }

  .analytics-chart-svg {
    width: 100%;
    height: 270px;
    display: block;
  }

  .chart-grid-line {
    stroke: #e2e8f0;
    stroke-width: 1;
  }

  .chart-axis-label {
    fill: #94a3b8;
    font-size: 10px;
  }

  .chart-area {
    fill: rgba(59,130,246,.08);
  }

  .chart-line {
    fill: none;
    stroke-width: 3;
    stroke-linecap: round;
    stroke-linejoin: round;
  }

  .chart-line-blue { stroke: #3b82f6; }
  .chart-line-green { stroke: #22c55e; }
  .chart-line-orange { stroke: #f59e0b; }
  .chart-point { stroke: #ffffff; stroke-width: 2; }
  .chart-point-blue { fill: #3b82f6; }

  .analytics-chart-empty {
    height: 270px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 7px;
    color: #94a3b8;
  }

  .analytics-chart-empty strong {
    color: #475569;
    font-size: 13px;
  }

  .analytics-chart-empty span {
    font-size: 11px;
  }

  .theme-dark .analytics-summary-card,
  .theme-dark .analytics-chart-card {
    background: #111c2d !important;
    border-color: #26344d !important;
  }

  .theme-dark .analytics-summary-card strong,
  .theme-dark .analytics-chart-header h3 {
    color: #f8fafc !important;
  }

  .theme-dark .analytics-summary-card small,
  .theme-dark .analytics-chart-header p,
  .theme-dark .analytics-chart-legend {
    color: #94a3b8 !important;
  }

  .theme-dark .analytics-summary-top > span:first-child {
    color: #cbd5e1 !important;
  }

  .theme-dark .analytics-summary-meter { background: #334155; }
  .theme-dark .analytics-chart-card .chart-grid-line { stroke: #334155; }
  .theme-dark .analytics-chart-card .chart-axis-label { fill: #64748b; }
  .theme-dark .chart-area { fill: rgba(59,130,246,.12); }
  .theme-dark .analytics-chart-empty strong { color: #cbd5e1; }

  @media (max-width: 1100px) {
    .analytics-summary-grid { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; }
  }

  @media (max-width: 700px) {
    .analytics-summary-grid { grid-template-columns: 1fr !important; }
    .analytics-chart-header { flex-direction: column; }
    .analytics-chart-legend { justify-content: flex-start; }
  }

  /* =========================================================\n     FINAL SECTION VISIBILITY FIX\n     Only the selected sidebar section is rendered visibly.\n     The earlier grid rules used !important and were overriding\n     the generic hide rule for overview/analytics sections.\n     ========================================================= */\n\n  .modern-main[data-active-section] > section[data-dashboard-section] {\n    display: none !important;\n  }\n\n  .modern-main[data-active-section="overview"] > section[data-dashboard-section="overview"] {\n    display: grid !important;\n  }\n\n  .modern-main[data-active-section="gpu-cluster"] > section[data-dashboard-section="gpu-cluster"],\n  .modern-main[data-active-section="scheduler"] > section[data-dashboard-section="scheduler"],\n  .modern-main[data-active-section="analytics"] > section[data-dashboard-section="analytics"],\n  .modern-main[data-active-section="workloads"] > section[data-dashboard-section="workloads"],\n  .modern-main[data-active-section="stress-test"] > section[data-dashboard-section="stress-test"],\n  .modern-main[data-active-section="decisions"] > section[data-dashboard-section="decisions"] {\n    display: block !important;\n  }\n\n  /* Analytics starts with a 3-column metric grid. */\n  .modern-main[data-active-section="analytics"] > section.stats-grid[data-dashboard-section="analytics"] {\n    display: grid !important;\n  }\n\n\n  @media (max-width: 1050px) {\n    .modern-main .stats-grid.modern-kpi-grid { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; }\n  }\n\n  @media (max-width: 700px) {\n    .modern-sidebar { width: 78px !important; min-width: 78px !important; padding: 18px 9px !important; }\n    .modern-brand-copy, .modern-nav-label, .modern-nav button:not(.active)::after, .modern-theme-switcher span, .modern-sidebar-bottom small { display: none !important; }\n    .modern-main .stats-grid.modern-kpi-grid { grid-template-columns: 1fr !important; }\n    .modern-main .stats-grid .modern-kpi-card { min-height: 175px !important; }\n  }\n

  /* =========================================================
     FINAL UI POLISH — FULL-WIDTH SAAS CANVAS + CONTROLS
     ========================================================= */

  .dashboard.modern-dashboard {
    width: 100vw !important;
    min-width: 100vw !important;
    min-height: 100vh !important;
    max-width: none !important;
    box-sizing: border-box !important;
    overflow-x: hidden !important;
    background: #f4f7fb !important;
    color: #0f172a !important;
  }

  .dashboard.modern-dashboard,
  .dashboard.modern-dashboard * {
    box-sizing: border-box;
  }

  .modern-sidebar {
    border-right: 1px solid #e2e8f0 !important;
    box-shadow: 2px 0 12px rgba(15, 23, 42, 0.035) !important;
  }

  .modern-main {
    flex: 1 1 auto !important;
    width: auto !important;
    min-width: 0 !important;
    max-width: none !important;
    color: #0f172a !important;
  }

  .modern-main .dashboard-header h1,
  .modern-main .panel-header h2,
  .modern-main .panel > h2,
  .modern-main .modern-view-label strong {
    color: #0f172a !important;
  }

  .modern-main .dashboard-header p,
  .modern-main .panel-header p,
  .modern-main .modern-view-label span,
  .modern-main .last-updated {
    color: #475569 !important;
  }

  .modern-main .modern-section-kicker,
  .modern-main .card-label {
    color: #64748b !important;
  }

  /* Standard button system for every interactive control in the main view. */
  .modern-main button {
    min-height: 40px;
    padding: 10px 18px;
    border: none !important;
    border-radius: 8px !important;
    background: #2563eb !important;
    color: #ffffff !important;
    font-family: inherit;
    font-size: 12px;
    font-weight: 600;
    line-height: 1.2;
    cursor: pointer;
    transition: background-color .2s ease, transform .18s ease, box-shadow .18s ease, opacity .2s ease;
  }

  .modern-main button:hover:not(:disabled) {
    background: #1d4ed8 !important;
    transform: translateY(-1px);
    box-shadow: 0 7px 16px rgba(37, 99, 235, .18);
  }

  .modern-main button:disabled {
    opacity: .55;
    cursor: not-allowed;
    transform: none !important;
    box-shadow: none !important;
  }

  .modern-main .modern-header-theme {
    border: 1px solid #cbd5e1 !important;
    background: #ffffff !important;
    color: #334155 !important;
  }

  .modern-main .modern-header-theme:hover {
    background: #eff6ff !important;
    color: #1d4ed8 !important;
    border-color: #93c5fd !important;
  }

  /* Clean form controls. */
  .modern-main input,
  .modern-main select,
  .modern-main textarea {
    width: 100%;
    min-height: 42px;
    padding: 9px 12px !important;
    border: 1px solid #cbd5e1 !important;
    border-radius: 8px !important;
    background: #ffffff !important;
    color: #0f172a !important;
    font-family: inherit;
    font-size: 12px;
    outline: none;
    box-shadow: none !important;
    transition: border-color .2s ease, box-shadow .2s ease;
  }

  .modern-main input::placeholder,
  .modern-main textarea::placeholder {
    color: #94a3b8 !important;
  }

  .modern-main input:focus,
  .modern-main select:focus,
  .modern-main textarea:focus {
    border-color: #3b82f6 !important;
    box-shadow: 0 0 0 3px rgba(59, 130, 246, .12) !important;
  }

  /* Labeled, aligned job/workload/stress-test forms. */
  .modern-main .form-grid {
    display: grid !important;
    grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)) !important;
    gap: 16px !important;
    align-items: end !important;
    width: 100% !important;
  }

  .modern-main .form-field {
    display: flex !important;
    flex-direction: column !important;
    gap: 7px !important;
    min-width: 0 !important;
  }

  .modern-main .form-field label {
    color: #475569 !important;
    font-size: 11px !important;
    font-weight: 700 !important;
    line-height: 1.2 !important;
  }

  .modern-main .form-field-action {
    display: flex !important;
    align-items: flex-end !important;
    min-width: 150px !important;
  }

  .modern-main .form-field-action button {
    width: 100%;
  }

  .modern-main .job-form {
    display: grid !important;
    grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)) !important;
    gap: 16px !important;
    align-items: end !important;
    width: 100% !important;
  }

  .modern-main .job-form > input,
  .modern-main .job-form > select {
    min-width: 0 !important;
  }

  /* GPU/analytics cards stay white in light mode. */
  .modern-main .resource-card,
  .modern-main .analytics-card {
    background: #ffffff !important;
    border: 1px solid #f1f5f9 !important;
    color: #0f172a !important;
    box-shadow: 0 1px 3px rgba(0, 0, 0, .05) !important;
  }

  .modern-main .resource-card:hover,
  .modern-main .analytics-card:hover {
    background: #ffffff !important;
    border-color: #e2e8f0 !important;
    box-shadow: 0 8px 20px rgba(15, 23, 42, .07) !important;
  }

  .modern-main .resource-card span,
  .modern-main .analytics-card span {
    color: #64748b !important;
  }

  .modern-main .resource-card strong,
  .modern-main .analytics-card strong {
    color: #0f172a !important;
  }

  .modern-main .resource-card small,
  .modern-main .analytics-card small {
    color: #475569 !important;
  }

  /* Progress bars: soft track + visible blue fill instead of dark lines. */
  .modern-main .progress-bar,
  .modern-main .progress-track {
    width: 100% !important;
    height: 8px !important;
    min-height: 8px !important;
    overflow: hidden !important;
    border-radius: 4px !important;
    background: #e2e8f0 !important;
    box-shadow: none !important;
  }

  .modern-main .progress-fill {
    height: 100% !important;
    min-height: 8px !important;
    min-width: 0 !important;
    border-radius: 4px !important;
    background: #3b82f6 !important;
    box-shadow: none !important;
    transition: width .35s ease !important;
  }

  /* Advanced GPU visualization: detailed side-by-side node cards. */
  .advanced-gpu-grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 18px;
  }

  .advanced-gpu-card {
    min-width: 0;
    padding: 20px;
    border: 1px solid #e2e8f0;
    border-radius: 16px;
    background: #ffffff;
    box-shadow: 0 8px 24px rgba(15, 23, 42, .06);
  }

  .advanced-gpu-card-header,
  .advanced-gpu-section-heading,
  .advanced-gpu-block-header,
  .advanced-gpu-job-header,
  .advanced-gpu-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }

  .advanced-gpu-title {
    display: flex;
    align-items: center;
    gap: 11px;
    min-width: 0;
  }

  .advanced-gpu-node-icon {
    width: 38px;
    height: 38px;
    flex: 0 0 38px;
    display: grid;
    place-items: center;
    border-radius: 10px;
    background: #eff6ff;
    color: #2563eb;
  }

  .advanced-gpu-title strong {
    display: block;
    color: #0f172a;
    font-size: 17px;
    line-height: 1.2;
  }

  .advanced-gpu-title span {
    display: block;
    margin-top: 3px;
    color: #64748b;
    font-size: 11px;
  }

  .advanced-gpu-status-stack {
    display: grid;
    justify-items: end;
    gap: 5px;
  }

  .advanced-gpu-health,
  .advanced-gpu-allocation {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    white-space: nowrap;
    border-radius: 999px;
    padding: 5px 9px;
    font-size: 9px;
    font-weight: 800;
    letter-spacing: .06em;
  }

  .advanced-gpu-health {
    border: 1px solid #bbf7d0;
    background: #f0fdf4;
    color: #15803d;
  }

  .advanced-gpu-health.gpu-health-busy {
    border-color: #fde68a;
    background: #fffbeb;
    color: #b45309;
  }

  .advanced-gpu-health.gpu-health-load {
    border-color: #fecaca;
    background: #fef2f2;
    color: #b91c1c;
  }

  .advanced-gpu-health-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: currentColor;
  }

  .advanced-gpu-allocation {
    border: 1px solid #dbeafe;
    background: #eff6ff;
    color: #1d4ed8;
  }

  .advanced-gpu-allocation.is-idle {
    border-color: #e2e8f0;
    background: #f8fafc;
    color: #64748b;
  }

  .advanced-gpu-utilization {
    margin-top: 19px;
    padding-top: 17px;
    border-top: 1px solid #f1f5f9;
  }

  .advanced-gpu-section-heading span,
  .advanced-gpu-block-header span,
  .advanced-gpu-job-header > div > strong,
  .advanced-gpu-footer span,
  .advanced-gpu-detail-grid span {
    color: #64748b;
    font-size: 9px;
    font-weight: 800;
    letter-spacing: .07em;
    text-transform: uppercase;
  }

  .advanced-gpu-section-heading strong {
    color: #0f172a;
    font-size: 20px;
  }

  .advanced-gpu-progress {
    width: 100%;
    height: 8px;
    margin-top: 9px;
    overflow: hidden;
    border-radius: 999px;
    background: #e2e8f0;
  }

  .advanced-gpu-progress > span {
    display: block;
    height: 100%;
    border-radius: inherit;
    background: #3b82f6;
    transition: width .35s ease;
  }

  .advanced-gpu-progress-meta {
    display: flex;
    justify-content: space-between;
    gap: 8px;
    margin-top: 7px;
    color: #64748b;
    font-size: 10px;
  }

  .advanced-gpu-metric-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px;
    margin-top: 15px;
  }

  .advanced-gpu-metric {
    display: flex;
    align-items: center;
    gap: 9px;
    min-width: 0;
    padding: 11px;
    border: 1px solid #eef2f7;
    border-radius: 11px;
    background: #f8fafc;
  }

  .advanced-gpu-metric-icon {
    width: 30px;
    height: 30px;
    flex: 0 0 30px;
    display: grid;
    place-items: center;
    border-radius: 8px;
    background: #ffffff;
    color: #2563eb;
    border: 1px solid #e2e8f0;
  }

  .advanced-gpu-metric span,
  .advanced-gpu-metric strong {
    display: block;
  }

  .advanced-gpu-metric span {
    color: #64748b;
    font-size: 9px;
    font-weight: 700;
    letter-spacing: .04em;
  }

  .advanced-gpu-metric strong {
    margin-top: 3px;
    color: #0f172a;
    font-size: 12px;
  }

  .advanced-gpu-resource-block {
    margin-top: 15px;
  }

  .advanced-gpu-block-header {
    align-items: flex-end;
  }

  .advanced-gpu-block-header > div {
    min-width: 0;
  }

  .advanced-gpu-block-header strong {
    display: block;
    color: #0f172a;
    font-size: 11px;
  }

  .advanced-gpu-block-header > div span {
    display: block;
    margin-top: 3px;
    color: #64748b;
    font-size: 10px;
    font-weight: 500;
    letter-spacing: 0;
    text-transform: none;
  }

  .advanced-gpu-memory-progress > span {
    background: #2563eb;
  }

  .advanced-gpu-fragmentation-progress > span {
    background: #f59e0b;
  }

  .advanced-gpu-detail-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px;
    margin-top: 15px;
    padding: 13px 0;
    border-top: 1px solid #f1f5f9;
    border-bottom: 1px solid #f1f5f9;
  }

  .advanced-gpu-detail-grid strong {
    display: block;
    margin-top: 4px;
    color: #0f172a;
    font-size: 11px;
  }

  .advanced-gpu-job-section {
    margin-top: 15px;
  }

  .advanced-gpu-job-header > div {
    min-width: 0;
  }

  .advanced-gpu-job-header > div > span {
    display: block;
    margin-top: 3px;
    color: #64748b;
    font-size: 10px;
  }

  .advanced-gpu-job-count {
    min-width: 25px;
    height: 25px;
    display: grid;
    place-items: center;
    border-radius: 8px;
    background: #eff6ff;
    color: #1d4ed8;
    font-size: 11px;
    font-weight: 800;
  }

  .advanced-gpu-job-list {
    display: grid;
    gap: 8px;
    margin-top: 9px;
  }

  .advanced-gpu-job {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    padding: 10px;
    border: 1px solid #e2e8f0;
    border-radius: 10px;
    background: #ffffff;
  }

  .advanced-gpu-job-main {
    display: flex;
    align-items: center;
    gap: 9px;
    min-width: 0;
  }

  .advanced-gpu-job-id {
    display: grid;
    place-items: center;
    min-width: 31px;
    height: 27px;
    border-radius: 7px;
    background: #f1f5f9;
    color: #334155;
    font-size: 10px;
    font-weight: 800;
  }

  .advanced-gpu-job-main strong,
  .advanced-gpu-job-main span {
    display: block;
  }

  .advanced-gpu-job-main strong {
    overflow: hidden;
    color: #0f172a;
    font-size: 11px;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .advanced-gpu-job-main div span {
    margin-top: 2px;
    color: #64748b;
    font-size: 9px;
  }

  .advanced-gpu-job-resources {
    display: flex;
    gap: 5px;
    flex-wrap: wrap;
    justify-content: flex-end;
  }

  .advanced-gpu-job-resources span {
    padding: 4px 6px;
    border-radius: 6px;
    background: #f8fafc;
    color: #475569;
    font-size: 9px;
    font-weight: 700;
  }

  .advanced-gpu-empty-job {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-top: 9px;
    padding: 11px;
    border: 1px dashed #cbd5e1;
    border-radius: 10px;
    background: #f8fafc;
    color: #64748b;
    font-size: 10px;
  }

  .advanced-gpu-footer {
    align-items: flex-end;
    gap: 8px;
    margin-top: 16px;
    padding-top: 13px;
    border-top: 1px solid #f1f5f9;
  }

  .advanced-gpu-footer > div {
    min-width: 0;
  }

  .advanced-gpu-footer strong {
    display: flex;
    align-items: center;
    gap: 4px;
    margin-top: 4px;
    color: #0f172a;
    font-size: 10px;
  }

  .advanced-gpu-footer > div:last-child {
    text-align: right;
  }

  .theme-dark .advanced-gpu-card {
    background: #111c2d;
    border-color: #26344d;
    box-shadow: none;
  }

  .theme-dark .advanced-gpu-title strong,
  .theme-dark .advanced-gpu-section-heading strong,
  .theme-dark .advanced-gpu-block-header strong,
  .theme-dark .advanced-gpu-metric strong,
  .theme-dark .advanced-gpu-detail-grid strong,
  .theme-dark .advanced-gpu-job-main strong,
  .theme-dark .advanced-gpu-footer strong {
    color: #f8fafc;
  }

  .theme-dark .advanced-gpu-title span,
  .theme-dark .advanced-gpu-progress-meta,
  .theme-dark .advanced-gpu-block-header > div span,
  .theme-dark .advanced-gpu-job-header > div > span,
  .theme-dark .advanced-gpu-job-main div span,
  .theme-dark .advanced-gpu-empty-job {
    color: #94a3b8;
  }

  .theme-dark .advanced-gpu-utilization,
  .theme-dark .advanced-gpu-detail-grid,
  .theme-dark .advanced-gpu-footer {
    border-color: #26344d;
  }

  .theme-dark .advanced-gpu-metric,
  .theme-dark .advanced-gpu-empty-job {
    background: #0f172a;
    border-color: #26344d;
  }

  .theme-dark .advanced-gpu-metric-icon,
  .theme-dark .advanced-gpu-job {
    background: #111c2d;
    border-color: #334155;
  }

  .theme-dark .advanced-gpu-job-resources span {
    background: #0f172a;
    color: #cbd5e1;
  }

  .theme-dark .advanced-gpu-job-id {
    background: #1e293b;
    color: #cbd5e1;
  }

  /* Light-mode panels remain consistently white. */

  .dashboard.modern-dashboard.theme-light .modern-main .panel,
  .dashboard.modern-dashboard.theme-light .modern-main .dashboard-header {
    background: #ffffff !important;
    border-color: #f1f5f9 !important;
    color: #0f172a !important;
  }

  /* Keep night mode intentionally dark. */
  .dashboard.modern-dashboard.theme-dark {
    background: #0b1120 !important;
    color: #f8fafc !important;
  }

  .theme-dark .modern-main,
  .theme-dark .modern-main .panel,
  .theme-dark .modern-main .dashboard-header {
    color: #f8fafc !important;
  }

  .theme-dark .modern-main .panel,
  .theme-dark .modern-main .dashboard-header,
  .theme-dark .modern-main .resource-card,
  .theme-dark .modern-main .analytics-card {
    background: #111c2d !important;
    border-color: #26344d !important;
  }

  .theme-dark .modern-main .resource-card strong,
  .theme-dark .modern-main .analytics-card strong,
  .theme-dark .modern-main .dashboard-header h1,
  .theme-dark .modern-main .panel-header h2,
  .theme-dark .modern-main .panel > h2,
  .theme-dark .modern-main .modern-view-label strong {
    color: #f8fafc !important;
  }

  .theme-dark .modern-main .resource-card span,
  .theme-dark .modern-main .analytics-card span,
  .theme-dark .modern-main .resource-card small,
  .theme-dark .modern-main .analytics-card small,
  .theme-dark .modern-main .dashboard-header p,
  .theme-dark .modern-main .panel-header p,
  .theme-dark .modern-main .modern-view-label span {
    color: #94a3b8 !important;
  }

  .theme-dark .modern-main input,
  .theme-dark .modern-main select,
  .theme-dark .modern-main textarea {
    background: #0f172a !important;
    color: #f8fafc !important;
    border-color: #334155 !important;
  }

  .theme-dark .modern-main .form-field label {
    color: #cbd5e1 !important;
  }

  .theme-dark .modern-main .progress-bar,
  .theme-dark .modern-main .progress-track {
    background: #334155 !important;
  }

  .theme-dark .modern-main .progress-fill {
    background: #3b82f6 !important;
  }

  @media (max-width: 900px) {
    .modern-main .form-grid,
    .modern-main .job-form {
      grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
    }
  }

  @media (max-width: 600px) {
    .modern-main .form-grid,
    .modern-main .job-form {
      grid-template-columns: 1fr !important;
    }
  }

  .dashboard.modern-dashboard.theme-light .modern-brand-copy strong {
    color: #0f172a !important;
  }

`;


import {
  getJobs,
  getResources,
  getResourceAnalytics,
  createJob,
  completeJob,
  cancelJob,
  getDeadlockStatus,
  getSchedulerStatistics,
  getHistoricalAnalytics,
  getSchedulingPolicy,
  setSchedulingPolicy,
  generateWorkload,
  runStressTest,
  getWorkloadStatistics,
} from "../services/api";


function Dashboard({ theme = "light", embedded = false, onThemeChange = () => {} }) {
  // ==========================================
  // STATE
  // ==========================================

  const [jobs, setJobs] = useState([]);
  const [resources, setResources] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [deadlock, setDeadlock] = useState({
    deadlock_detected: false,
    status: "NOT_APPLICABLE",
  });

  const [schedulingPolicy, setSchedulingPolicyState] = useState({
    policy: "RESOURCE_BALANCED",
    available_policies: [
      "FCFS",
      "PRIORITY",
      "SJF",
      "RESOURCE_EFFICIENT",
      "RESOURCE_BALANCED",
      "PREEMPTIVE",
    ],
  });

  const [changingPolicy, setChangingPolicy] = useState(false);

  const [statistics, setStatistics] = useState({
    total_jobs: 0,
    running_jobs: 0,
    waiting_jobs: 0,
    completed_jobs: 0,
    cancelled_jobs: 0,
    queued_jobs: 0,
  });

  const [historicalAnalytics, setHistoricalAnalytics] =
    useState(null);

  // Short in-session history used by the live Analytics chart.
  // Values come directly from the dashboard polling response.
  const [analyticsHistory, setAnalyticsHistory] = useState([]);

  // ==========================================
  // WORKLOAD / STRESS TEST STATE
  // ==========================================

  const [workloadResult, setWorkloadResult] = useState(null);
  const [stressResult, setStressResult] = useState(null);
  const [workloadHistory, setWorkloadHistory] = useState(null);

  const [workloadLoading, setWorkloadLoading] = useState(false);
  const [stressLoading, setStressLoading] = useState(false);

  const [workloadCount, setWorkloadCount] = useState(10);
  const [workloadPattern, setWorkloadPattern] = useState("MIXED");
  const [workloadSeed, setWorkloadSeed] = useState("");

  const [stressSize, setStressSize] = useState(100);
  const [stressPattern, setStressPattern] = useState("MIXED");
  const [stressSeed, setStressSeed] = useState("");

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [activeSection, setActiveSection] = useState("overview");

  const setTheme = (next) => onThemeChange(typeof next === "function" ? next(theme) : next);

  const [form, setForm] = useState({
    name: "",
    compute_required: 1,
    memory_required: 1,
    accelerator_a_required: 0,
    accelerator_b_required: 0,
    priority: 1,
  });


  // ==========================================
  // LOAD ALL DASHBOARD DATA
  // ==========================================

  const loadData = async () => {
    try {

      const [
        jobsResponse,
        resourcesResponse,
        analyticsResponse,
        statisticsResponse,
        historicalAnalyticsResponse,
        deadlockResponse,
        policyResponse,
        workloadHistoryResponse,
      ] = await Promise.all([
        getJobs(),
        getResources(),
        getResourceAnalytics(),
        getSchedulerStatistics(),
        getHistoricalAnalytics(),
        getDeadlockStatus(),
        getSchedulingPolicy(),
        getWorkloadStatistics(),
      ]);

      setError("");

      // The /jobs/ endpoint returns an object like { jobs: [...] }.
      // Keep the frontend state as an array so jobs.map(), jobs.length, etc. work safely.
      setJobs(
        Array.isArray(jobsResponse.data)
          ? jobsResponse.data
          : jobsResponse.data?.jobs || []
      );

      setResources(resourcesResponse.data);
      setAnalytics(analyticsResponse.data);

      const utilizationValues = Object.values(
        analyticsResponse.data?.utilization || {}
      ).map(Number).filter(Number.isFinite);

      const liveUtilization = utilizationValues.length
        ? utilizationValues.reduce((sum, value) => sum + value, 0) / utilizationValues.length
        : 0;

      const liveFragmentation = Number(
        analyticsResponse.data?.overall_fragmentation ?? 0
      );

      const liveEfficiency = Number(
        analyticsResponse.data?.allocation_efficiency ?? 0
      );

      setAnalyticsHistory((previous) => [
        ...previous,
        {
          time: new Date(),
          utilization: Math.max(0, Math.min(100, liveUtilization)),
          fragmentation: Math.max(0, Math.min(100, liveFragmentation)),
          efficiency: Math.max(0, Math.min(100, liveEfficiency)),
        },
      ].slice(-20));

      setStatistics(statisticsResponse.data);
      setHistoricalAnalytics(
        historicalAnalyticsResponse.data
      );
      setDeadlock(deadlockResponse.data);
      setSchedulingPolicyState(policyResponse.data);
      setWorkloadHistory(workloadHistoryResponse.data);

      setLastUpdated(new Date());
      setLoading(false);

    } catch (err) {
      console.error("Dashboard error:", err);

      setError(
        "Backend is not connected. Make sure FastAPI is running."
      );

      setLoading(false);
    }
  };


  // ==========================================
  // LIVE REFRESH
  // ==========================================

  useEffect(() => {
    // Start network refresh asynchronously and cancel an abandoned initial mount.
    const initial = setTimeout(loadData, 0);
    const interval = setInterval(loadData, 3000);
    return () => {
      clearTimeout(initial);
      clearInterval(interval);
    };
  }, []);


  // ==========================================
  // CREATE JOB
  // ==========================================

  const handleCreateJob = async (e) => {
    e.preventDefault();

    if (!form.name.trim()) {
      setError("Please enter a job name.");
      return;
    }

    try {
      setError("");

      await createJob({
        name: form.name.trim(),

        compute_required: Number(
          form.compute_required
        ),

        memory_required: Number(
          form.memory_required
        ),

        accelerator_a_required: Number(
          form.accelerator_a_required
        ),

        accelerator_b_required: Number(
          form.accelerator_b_required
        ),

        priority: Number(
          form.priority
        ),
      });

      setForm({
        name: "",
        compute_required: 1,
        memory_required: 1,
        accelerator_a_required: 0,
        accelerator_b_required: 0,
        priority: 1,
      });

      await loadData();

    } catch (err) {
      console.error("Create job error:", err);

      setError(
        err?.response?.data?.detail ||
        "Failed to create job."
      );
    }
  };


  // ==========================================
  // COMPLETE JOB
  // ==========================================

  const handleCompleteJob = async (jobId) => {
    try {
      setError("");

      await completeJob(jobId);

      await loadData();

    } catch (err) {
      console.error("Complete job error:", err);

      setError(
        err?.response?.data?.detail ||
        "Failed to complete job."
      );
    }
  };


  // ==========================================
  // CANCEL JOB
  // ==========================================

  const handleCancelJob = async (jobId) => {
    try {
      setError("");

      await cancelJob(jobId);

      await loadData();

    } catch (err) {
      console.error("Cancel job error:", err);

      setError(
        err?.response?.data?.detail ||
        "Failed to cancel job."
      );
    }
  };


  // ==========================================
  // SCHEDULING POLICY
  // ==========================================

  const handleSchedulingPolicyChange = async (e) => {
    const newPolicy = e.target.value;

    try {
      setChangingPolicy(true);
      setError("");

      const response = await setSchedulingPolicy(
        newPolicy
      );

      setSchedulingPolicyState(response.data);

      await loadData();

    } catch (err) {
      console.error("Scheduling policy error:", err);

      setError(
        err?.response?.data?.detail?.message ||
        err?.response?.data?.detail ||
        "Failed to change scheduling policy."
      );
    } finally {
      setChangingPolicy(false);
    }
  };


  // ==========================================
  // GENERATE WORKLOAD
  // ==========================================

  const handleGenerateWorkload = async () => {
    try {
      setWorkloadLoading(true);
      setError("");

      const response = await generateWorkload(
        workloadCount,
        workloadPattern,
        workloadSeed
      );

      setWorkloadResult(response.data);
      await loadData();

    } catch (err) {
      console.error("Workload generation error:", err);

      setError(
        err?.response?.data?.detail?.message ||
        err?.response?.data?.detail ||
        "Failed to generate workload."
      );
    } finally {
      setWorkloadLoading(false);
    }
  };


  // ==========================================
  // RUN STRESS TEST
  // ==========================================

  const handleStressTest = async () => {
    try {
      setStressLoading(true);
      setError("");

      const response = await runStressTest(
        stressSize,
        stressPattern,
        stressSeed
      );

      setStressResult(response.data);
      await loadData();

    } catch (err) {
      console.error("Stress test error:", err);

      setError(
        err?.response?.data?.detail?.message ||
        err?.response?.data?.detail ||
        "Failed to run stress test."
      );
    } finally {
      setStressLoading(false);
    }
  };


  // ==========================================
  // FORMAT RESOURCE NAME
  // ==========================================

  const formatResourceName = (name) => {
    return name
      .replaceAll("_", " ")
      .replace(/\b\w/g, (letter) =>
        letter.toUpperCase()
      );
  };


  // ==========================================
  // GET STATUS CLASS
  // ==========================================

  const getStatusClass = (status) => {
    switch (status) {
      case "RUNNING":
        return "status-running";

      case "WAITING":
        return "status-waiting";

      case "COMPLETED":
        return "status-completed";

      case "QUEUED":
        return "status-queued";

      case "CANCELLED":
        return "status-cancelled";

      default:
        return "status-default";
    }
  };


  // ==========================================
  // CALCULATE OVERALL UTILIZATION
  // ==========================================

  const getOverallUtilization = () => {
    if (!analytics?.utilization) {
      return 0;
    }

    const values = Object.values(
      analytics.utilization
    );

    if (values.length === 0) {
      return 0;
    }

    return (
      values.reduce(
        (sum, value) => sum + Number(value),
        0
      ) / values.length
    ).toFixed(1);
  };


  // ==========================================
  // GET FRAGMENTATION
  // ==========================================

  const fragmentation =
    analytics?.overall_fragmentation ?? 0;

  const fragmentationLevel =
    analytics?.fragmentation_level ?? "LOW";

  const allocationEfficiency =
    analytics?.allocation_efficiency ?? 0;


  // ==========================================
  // EXECUTION TRACKING HELPERS
  // ==========================================

  const formatDuration = (seconds) => {
    const value = Number(seconds ?? 0);

    if (!Number.isFinite(value) || value < 0) {
      return "0s";
    }

    if (value < 60) {
      return `${value.toFixed(1)}s`;
    }

    const minutes = Math.floor(value / 60);
    const remainingSeconds = Math.floor(value % 60);

    if (minutes < 60) {
      return `${minutes}m ${remainingSeconds}s`;
    }

    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;

    return `${hours}h ${remainingMinutes}m`;
  };

  const formatTimestamp = (timestamp) => {
    if (!timestamp) {
      return "—";
    }

    const date = new Date(timestamp);

    if (Number.isNaN(date.getTime())) {
      return "—";
    }

    return date.toLocaleString();
  };




  // ==========================================
  // MULTI-GPU HELPERS
  // ==========================================

  const getGpuEntries = () => {
    if (!resources?.gpus) {
      return [];
    }

    return Object.entries(resources.gpus);
  };

  const getJobsForGpu = (gpuId) => {
    return jobs.filter(
      (job) => job.gpu_id === gpuId && job.status === "RUNNING"
    );
  };

  const getGpuUtilization = (gpuData) => {
    const values = Object.values(gpuData?.utilization || {});

    if (values.length === 0) {
      return 0;
    }

    return (
      values.reduce(
        (sum, value) => sum + Number(value || 0),
        0
      ) / values.length
    ).toFixed(1);
  };

  const getAverageGpuUtilization = () => {
    const gpuEntries = getGpuEntries();

    if (gpuEntries.length === 0) {
      return 0;
    }

    const values = gpuEntries.map(
      ([, gpuData]) => Number(
        getGpuUtilization(gpuData)
      )
    );

    if (values.length === 0) {
      return 0;
    }

    return (
      values.reduce(
        (sum, value) => sum + value,
        0
      ) / values.length
    );
  };


  const getGpuAvailability = (gpuData) => {
    const values = Object.values(gpuData?.availability || {});

    if (values.length === 0) {
      return 0;
    }

    return (
      values.reduce(
        (sum, value) => sum + Number(value || 0),
        0
      ) / values.length
    ).toFixed(1);
  };

  const getWaitingJobs = () => {
    return jobs.filter(
      (job) => job.status === "WAITING" || job.status === "QUEUED"
    );
  };

  const getWaitingReason = (job) => {
    const explanation = job?.allocation_explanation || {};
    if (explanation.decision === "INFEASIBLE") return explanation.headline;
    const candidates = job?.current_diagnostics?.candidates || explanation.candidates || [];
    const eligible = candidates.filter((candidate) => candidate.eligible);

    if (eligible.length > 0) {
      return "A suitable GPU exists, but the scheduler is waiting for the current queue/policy to allow allocation.";
    }

    if (candidates.length === 0) {
      return explanation.headline || "No GPU candidate information is available yet.";
    }

    return "All GPU candidates are currently unable to satisfy this job's complete resource request.";
  };

  const getWaitingBlockers = (job) => {
    const candidates = job?.current_diagnostics?.candidates || job?.allocation_explanation?.candidates || [];
    const blockers = candidates.flatMap((candidate) => {
      const deficits = candidate.fits_total_capacity
        ? candidate.blocking_resources || {}
        : candidate.capacity_deficits || {};
      return Object.entries(deficits).map(([resource, deficit]) =>
        `${candidate.gpu_id}: ${resource.replaceAll("_", " ")} short by ${deficit}${candidate.fits_total_capacity ? " currently" : " in total capacity"}`
      );
    });
    return blockers.length ? blockers : ["Waiting for the next scheduling opportunity."];
  };

  const getGpuHealth = (utilization, availability, fragmentation) => {
    if (utilization >= 90 || availability <= 10) {
      return "HIGH LOAD";
    }

    if (fragmentation >= 50 || utilization >= 70) {
      return "BUSY";
    }

    return "HEALTHY";
  };

  const getUtilizationWidth = (value) => {
    return Math.min(Math.max(Number(value) || 0, 0), 100);
  };

  const getGpuIndex = (gpuId) => {
    const match = String(gpuId || "").match(/(\\d+)$/);
    return match ? Number(match[1]) : 0;
  };

  const getGpuTelemetry = (gpuId, gpuData, utilization, availability, runningJobs) => {
    const gpuIndex = getGpuIndex(gpuId);

    const totalMemory = Number(
      gpuData?.total?.memory ??
      gpuData?.resources?.memory ??
      gpuData?.memory?.total ??
      16
    );

    const explicitAvailableMemory =
      gpuData?.available?.memory ??
      gpuData?.resources?.available_memory ??
      gpuData?.memory?.available;

    const jobMemory = runningJobs.reduce(
      (sum, job) =>
        sum +
        Number(
          job?.memory_required ??
          job?.resources?.memory ??
          job?.resource_request?.memory ??
          0
        ),
      0
    );

    const calculatedUsedMemory = Math.min(
      totalMemory,
      Math.max(jobMemory, totalMemory * (1 - availability / 100))
    );

    const usedMemory = Number(
      gpuData?.memory?.used ??
      gpuData?.used?.memory ??
      Math.max(calculatedUsedMemory, 0)
    );

    const availableMemory = Number(
      explicitAvailableMemory ??
      Math.max(totalMemory - usedMemory, 0)
    );

    const memoryUtilization = totalMemory > 0
      ? Math.min((usedMemory / totalMemory) * 100, 100)
      : 0;

    const totalCompute = Number(
      gpuData?.total?.compute_units ??
      gpuData?.resources?.compute_units ??
      gpuData?.compute_units?.total ??
      8
    );

    const availableCompute = Number(
      gpuData?.available?.compute_units ??
      gpuData?.resources?.available_compute_units ??
      gpuData?.compute_units?.available ??
      Math.max(totalCompute * (availability / 100), 0)
    );

    const usedCompute = Math.max(totalCompute - availableCompute, 0);

    const acceleratorA = Number(
      gpuData?.accelerator_a ??
      gpuData?.accelerators?.accelerator_a ??
      0
    );

    const acceleratorB = Number(
      gpuData?.accelerator_b ??
      gpuData?.accelerators?.accelerator_b ??
      0
    );

    // These telemetry values are simulated for the dashboard because the backend
    // is a GPU resource simulator rather than a physical NVIDIA telemetry source.
    const temperature = Math.round(45 + utilization * 0.18 + gpuIndex * 3);
    const power = Math.round(65 + utilization * 1.05 + gpuIndex * 8);
    const gpuClock = Math.round(1200 + utilization * 8 + gpuIndex * 45);
    const memoryClock = Math.round(5000 + utilization * 18 + gpuIndex * 120);

    return {
      totalMemory,
      usedMemory: Math.min(usedMemory, totalMemory),
      availableMemory,
      memoryUtilization,
      totalCompute,
      usedCompute,
      availableCompute,
      acceleratorA,
      acceleratorB,
      temperature,
      power,
      gpuClock,
      memoryClock,
      telemetryMode: "SIMULATED"
    };
  };



  // ==========================================
  // LOADING SCREEN
  // ==========================================

  if (loading && !resources) {
    return (
      <div className="dashboard">
        <div className="panel">
          <h2>GPU Job Allocator</h2>
          <p>Connecting to GPU scheduler...</p>
        </div>
      </div>
    );
  }


  // ==========================================
  // DASHBOARD
  // ==========================================

  return (
    <div className={`dashboard modern-dashboard theme-${theme} ${embedded ? "embedded-workspace" : ""}`}>

      <style>{modernDashboardStyles}</style>
      {embedded && <div className="manual-intro"><div><span className="studio-eyebrow">LIVE CLUSTER / MANUAL CONTROLS</span><h2>Manual workspace</h2><p>Submit jobs, inspect placement, and release resources in the live simulated cluster.</p></div><button type="button" onClick={loadData}>Refresh state</button></div>}

      <aside className="modern-sidebar">
        <div className="modern-brand">
          <div className="modern-brand-icon"><Zap size={21} strokeWidth={2.2} /></div>
          <div className="modern-brand-copy">
            <strong>GPU Allocator</strong>
            <span>Resource orchestration</span>
          </div>
        </div>

        <div className="modern-nav-label">Workspace</div>
        <nav className="modern-nav">
          <button type="button" className={activeSection === "overview" ? "active" : ""} onClick={() => setActiveSection("overview")}>
            <span className="modern-nav-icon"><LayoutDashboard size={17} strokeWidth={2} /></span>Overview
          </button>
          <button type="button" className={activeSection === "gpu-cluster" ? "active" : ""} onClick={() => setActiveSection("gpu-cluster")}>
            <span className="modern-nav-icon"><Cpu size={17} strokeWidth={2} /></span>GPU Cluster
          </button>
          <button type="button" className={activeSection === "scheduler" ? "active" : ""} onClick={() => setActiveSection("scheduler")}>
            <span className="modern-nav-icon"><Clock3 size={17} strokeWidth={2} /></span>Scheduler
          </button>
          <button type="button" className={activeSection === "analytics" ? "active" : ""} onClick={() => setActiveSection("analytics")}>
            <span className="modern-nav-icon"><BarChart3 size={17} strokeWidth={2} /></span>Analytics
          </button>
          <button type="button" className={activeSection === "benchmarks" ? "active" : ""} onClick={() => embedded ? window.location.hash = "#benchmarks" : setActiveSection("benchmarks")}>
            <span className="modern-nav-icon"><BarChart3 size={17} strokeWidth={2} /></span>Policy Arena
          </button>
          <button type="button" className={activeSection === "replay" ? "active" : ""} onClick={() => embedded ? window.location.hash = "#replay" : setActiveSection("replay")}>
            <span className="modern-nav-icon"><Clock3 size={17} strokeWidth={2} /></span>Replay Lab
          </button>
          <button type="button" className={activeSection === "workloads" ? "active" : ""} onClick={() => setActiveSection("workloads")}>
            <span className="modern-nav-icon"><Boxes size={17} strokeWidth={2} /></span>Workloads
          </button>
          <button type="button" className={activeSection === "stress-test" ? "active" : ""} onClick={() => setActiveSection("stress-test")}>
            <span className="modern-nav-icon"><Gauge size={17} strokeWidth={2} /></span>Stress Test
          </button>
          <button type="button" className={activeSection === "decisions" ? "active" : ""} onClick={() => setActiveSection("decisions")}>
            <span className="modern-nav-icon"><CheckCircle2 size={17} strokeWidth={2} /></span>Decisions
          </button>
        </nav>

        <div className="modern-theme-switcher">
          <div>
            {theme === "light" ? <Sun size={15} strokeWidth={2} /> : <Moon size={15} strokeWidth={2} />}
            <span>{theme === "light" ? "Light mode" : "Night mode"}</span>
          </div>
          <button
            type="button"
            onClick={() => setTheme((current) => current === "light" ? "dark" : "light")}
          >
            {theme === "light" ? "Night" : "Light"}
          </button>
        </div>

        <div className="modern-sidebar-bottom">
          <div className="modern-system-status">
            <span className="modern-system-dot"></span>
            SYSTEM OPERATIONAL
          </div>
          <small>Live scheduler monitoring enabled</small>
        </div>
      </aside>

      <main className="modern-main" id="overview" data-active-section={activeSection}>

      {/* ======================================
          HEADER
      ====================================== */}

      <header className="dashboard-header">

        <div>
          <h1>GPU Job Allocator</h1>

          <p>
            Resource-Aware GPU Resource
            Management
          </p>

          <div className="live-indicator">
            <span className="live-dot"></span>

            LIVE

            {lastUpdated && (
              <span className="last-updated">
                Last updated{" "}
                {lastUpdated.toLocaleTimeString()}
              </span>
            )}
          </div>
        </div>

        <div className="modern-header-actions">
          <button
            type="button"
            className="modern-header-theme"
            onClick={() => setTheme((current) => current === "light" ? "dark" : "light")}
            title={theme === "light" ? "Switch to night mode" : "Switch to light mode"}
          >
            {theme === "light" ? <Moon size={16} strokeWidth={2} /> : <Sun size={16} strokeWidth={2} />}
            <span>{theme === "light" ? "Night" : "Light"}</span>
          </button>

          <button
            className="refresh-button"
            onClick={loadData}
          >
            ↻ Refresh
          </button>
        </div>

      </header>

      <div className="modern-view-label">
        <strong>{
          activeSection === "overview" ? "Overview" :
          activeSection === "gpu-cluster" ? "GPU Cluster" :
          activeSection === "scheduler" ? "Scheduler" :
          activeSection === "analytics" ? "Analytics" :
          activeSection === "benchmarks" ? "Policy Arena" :
          activeSection === "replay" ? "Replay Lab" :
          activeSection === "workloads" ? "Workloads" :
          activeSection === "stress-test" ? "Stress Test" :
          "Decisions"
        }</strong>
        <span>Live workspace</span>
      </div>

      {/* ======================================
          ERROR
      ====================================== */}

      {error && (
        <div className="error">
          <strong>Connection issue:</strong>{" "}
          {error}
        </div>
      )}


      {/* ======================================
          MAIN STATISTICS
      ====================================== */}

      {activeSection === "benchmarks" && <section data-dashboard-section="benchmarks"><BenchmarkLab /></section>}

      {activeSection === "replay" && <section data-dashboard-section="replay"><ReplayLab /></section>}

      <section className="stats-grid modern-kpi-grid" data-dashboard-section="overview">

        <div className="card modern-kpi-card modern-kpi-cyan">
          <div className="modern-kpi-top">
            <span className="card-label">TOTAL JOBS</span>
            <span className="modern-kpi-icon"><ListTodo size={19} strokeWidth={2} /></span>
          </div>
          <strong>{statistics.total_jobs}</strong>
          <small>All submitted jobs</small>
          <div className="modern-kpi-footer">
            <Activity size={14} strokeWidth={2} />
            <span>Workload volume</span>
          </div>
        </div>

        <div className="card modern-kpi-card modern-kpi-green">
          <div className="modern-kpi-top">
            <span className="card-label">RUNNING</span>
            <span className="modern-kpi-icon"><Cpu size={19} strokeWidth={2} /></span>
          </div>
          <strong>{statistics.running_jobs}</strong>
          <small>Currently using GPU</small>
          <div className="modern-kpi-footer">
            <Activity size={14} strokeWidth={2} />
            <span>Active compute</span>
          </div>
        </div>

        <div className="card modern-kpi-card modern-kpi-orange">
          <div className="modern-kpi-top">
            <span className="card-label">WAITING</span>
            <span className="modern-kpi-icon"><Clock3 size={19} strokeWidth={2} /></span>
          </div>
          <strong>{statistics.waiting_jobs}</strong>
          <small>Waiting for resources</small>
          <div className="modern-kpi-footer">
            <Clock3 size={14} strokeWidth={2} />
            <span>Queue pressure</span>
          </div>
        </div>

        <div className="card modern-kpi-card modern-kpi-yellow">
          <div className="modern-kpi-top">
            <span className="card-label">COMPLETED</span>
            <span className="modern-kpi-icon"><CheckCircle2 size={19} strokeWidth={2} /></span>
          </div>
          <strong>{statistics.completed_jobs}</strong>
          <small>Successfully completed</small>
          <div className="modern-kpi-footer">
            <CheckCircle2 size={14} strokeWidth={2} />
            <span>Successful workloads</span>
          </div>
        </div>

        <div className="card modern-kpi-card modern-kpi-red">
          <div className="modern-kpi-top">
            <span className="card-label">CANCELLED</span>
            <span className="modern-kpi-icon"><XCircle size={19} strokeWidth={2} /></span>
          </div>
          <strong>{statistics.cancelled_jobs ?? 0}</strong>
          <small>Jobs stopped by scheduler/user</small>
          <div className="modern-kpi-footer">
            <XCircle size={14} strokeWidth={2} />
            <span>Stopped workloads</span>
          </div>
        </div>

        <div className="card modern-kpi-card modern-kpi-slate">
          <div className="modern-kpi-top">
            <span className="card-label">QUEUED</span>
            <span className="modern-kpi-icon"><ServerCog size={19} strokeWidth={2} /></span>
          </div>
          <strong>{statistics.queued_jobs}</strong>
          <small>Waiting in scheduler</small>
          <div className="modern-kpi-footer">
            <ListTodo size={14} strokeWidth={2} />
            <span>Scheduler queue</span>
          </div>
        </div>

      </section>


      {/* ======================================
          GPU OVERVIEW
      ====================================== */}

      <section className="panel" data-dashboard-section="gpu-cluster">

        <div className="panel-header">

          <div>
            <div className="modern-section-kicker" id="gpu-cluster">GPU CLUSTER</div>
            <h2>GPU Resource Overview</h2>

            <p>
              Real-time resource allocation
            </p>
          </div>

          <div className="live-badge">
            ● LIVE
          </div>

        </div>


        {resources ? (

          <div className="resource-grid">

            {Object.entries(
              resources.total || {}
            ).map(([resource, total]) => {

              const available =
                resources.available?.[
                  resource
                ] ?? 0;

              const used =
                Number(total) -
                Number(available);

              const percentage =
                total > 0
                  ? (
                      (used /
                        Number(total)) *
                      100
                    ).toFixed(1)
                  : 0;

              return (
                <div
                  className="resource-card"
                  key={resource}
                >

                  <div className="resource-card-top">

                    <span>
                      {formatResourceName(
                        resource
                      )}
                    </span>

                    <strong>
                      {percentage}%
                    </strong>

                  </div>


                  <div className="resource-value">

                    {available}

                    <span>
                      / {total}
                    </span>

                  </div>


                  <div className="progress-bar">

                    <div
                      className="progress-fill"
                      style={{
                        width: `${Math.min(
                          percentage,
                          100
                        )}%`,
                      }}
                    />

                  </div>


                  <small>
                    {used} used ·{" "}
                    {available} available
                  </small>

                </div>
              );
            })}

          </div>

        ) : (

          <p>
            Loading GPU resources...
          </p>

        )}

      </section>


      {/* ======================================
          MULTI-GPU NODE MONITOR
      ====================================== */}

      <section className="panel" data-dashboard-section="gpu-cluster">

        <div className="panel-header">

          <div>
            <div className="modern-section-kicker">LIVE NODES</div>
            <h2>GPU Node Monitor</h2>

            <p>
              Live utilization, availability and job placement across the GPU cluster
            </p>
          </div>

          <span className="live-badge">
            {resources?.gpu_count ?? getGpuEntries().length} GPUs
          </span>

        </div>

        {getGpuEntries().length > 0 ? (

          <div className="resource-grid">

            {getGpuEntries().map(([gpuId, gpuData]) => {

              const utilization = Number(
                getGpuUtilization(gpuData)
              );

              const availability = Number(
                getGpuAvailability(gpuData)
              );

              const runningJobs = getJobsForGpu(gpuId);

              const fragmentation = Number(
                gpuData?.overall_fragmentation ?? 0
              );

              const fragmentationLevel =
                gpuData?.fragmentation_level ?? "LOW";

              return (
                <div
                  className="resource-card"
                  key={gpuId}
                >

                  <div className="resource-card-top">

                    <span>{gpuId}</span>

                    <strong>
                      {utilization.toFixed(1)}%
                    </strong>

                  </div>

                  <div className="resource-value">
                    {runningJobs.length}
                    <span> running jobs</span>
                  </div>

                  <div className="progress-bar">
                    <div
                      className="progress-fill"
                      style={{
                        width: `${Math.min(
                          utilization,
                          100
                        )}%`,
                      }}
                    />
                  </div>

                  <small>
                    {availability.toFixed(1)}% available
                  </small>

                  <small>
                    Imbalance: {fragmentation.toFixed(1)}% · {fragmentationLevel}
                  </small>

                  <small>
                    Jobs: {runningJobs.length > 0
                      ? runningJobs.map((job) => `#${job.job_id}`).join(", ")
                      : "No running jobs"}
                  </small>

                </div>
              );
            })}

          </div>

        ) : (

          <div className="empty-state">
            <h3>GPU nodes unavailable</h3>
            <p>Waiting for multi-GPU resource data from the scheduler.</p>
          </div>

        )}

      </section>


      {/* ======================================
          ADVANCED GPU VISUALIZATION
      ====================================== */}

      <section className="panel advanced-gpu-panel" data-dashboard-section="gpu-cluster">

        <div className="panel-header">

          <div>
            <h2>Advanced GPU Visualization</h2>
            <p>
              Detailed node telemetry, resource capacity, allocation state and active jobs
            </p>
          </div>

          <span className="live-badge">
            LIVE CLUSTER MAP
          </span>

        </div>

        {getGpuEntries().length > 0 ? (

          <div className="advanced-gpu-grid">

            {getGpuEntries().map(([gpuId, gpuData]) => {
              const utilization = Number(getGpuUtilization(gpuData));
              const availability = Number(getGpuAvailability(gpuData));
              const fragmentation = Number(gpuData?.overall_fragmentation ?? 0);
              const runningJobs = getJobsForGpu(gpuId);

              const health = getGpuHealth(
                utilization,
                availability,
                fragmentation
              );

              const telemetry = getGpuTelemetry(
                gpuId,
                gpuData,
                utilization,
                availability,
                runningJobs
              );

              const allocationStatus =
                runningJobs.length > 0 ? "ALLOCATED" : "IDLE";

              const statusClass =
                health === "HEALTHY"
                  ? "gpu-health-healthy"
                  : health === "BUSY"
                    ? "gpu-health-busy"
                    : "gpu-health-load";

              const utilizationWidth = getUtilizationWidth(utilization);
              const fragmentationWidth = getUtilizationWidth(fragmentation);
              const memoryWidth = getUtilizationWidth(
                telemetry.memoryUtilization
              );

              return (
                <article
                  key={`advanced-${gpuId}`}
                  className="advanced-gpu-card"
                >

                  <div className="advanced-gpu-card-header">

                    <div className="advanced-gpu-title">
                      <div className="advanced-gpu-node-icon">
                        <Cpu size={19} strokeWidth={2.2} />
                      </div>

                      <div>
                        <strong>{gpuId}</strong>
                        <span>GPU compute node</span>
                      </div>
                    </div>

                    <div className="advanced-gpu-status-stack">
                      <span className={`advanced-gpu-health ${statusClass}`}>
                        <span className="advanced-gpu-health-dot" />
                        {health}
                      </span>

                      <span className={`advanced-gpu-allocation ${
                        allocationStatus === "ALLOCATED"
                          ? "is-allocated"
                          : "is-idle"
                      }`}>
                        {allocationStatus}
                      </span>
                    </div>

                  </div>


                  <div className="advanced-gpu-utilization">

                    <div className="advanced-gpu-section-heading">
                      <span>GPU UTILIZATION</span>
                      <strong>{utilization.toFixed(1)}%</strong>
                    </div>

                    <div className="advanced-gpu-progress">
                      <span style={{ width: `${utilizationWidth}%` }} />
                    </div>

                    <div className="advanced-gpu-progress-meta">
                      <span>
                        {runningJobs.length} active job{runningJobs.length === 1 ? "" : "s"}
                      </span>
                      <span>
                        {availability.toFixed(1)}% capacity available
                      </span>
                    </div>

                  </div>


                  <div className="advanced-gpu-metric-grid">

                    <div className="advanced-gpu-metric">
                      <div className="advanced-gpu-metric-icon">
                        <MemoryStick size={16} />
                      </div>
                      <div>
                        <span>VRAM</span>
                        <strong>
                          {telemetry.usedMemory.toFixed(1)} / {telemetry.totalMemory.toFixed(1)} GB
                        </strong>
                      </div>
                    </div>

                    <div className="advanced-gpu-metric">
                      <div className="advanced-gpu-metric-icon">
                        <Gauge size={16} />
                      </div>
                      <div>
                        <span>COMPUTE</span>
                        <strong>
                          {telemetry.usedCompute.toFixed(1)} / {telemetry.totalCompute.toFixed(1)}
                        </strong>
                      </div>
                    </div>

                    <div className="advanced-gpu-metric">
                      <div className="advanced-gpu-metric-icon">
                        <Thermometer size={16} />
                      </div>
                      <div>
                        <span>TEMPERATURE</span>
                        <strong>{telemetry.temperature}°C</strong>
                      </div>
                    </div>

                    <div className="advanced-gpu-metric">
                      <div className="advanced-gpu-metric-icon">
                        <Power size={16} />
                      </div>
                      <div>
                        <span>POWER</span>
                        <strong>{telemetry.power} W</strong>
                      </div>
                    </div>

                  </div>


                  <div className="advanced-gpu-resource-block">

                    <div className="advanced-gpu-block-header">
                      <div>
                        <strong>Memory capacity</strong>
                        <span>
                          {telemetry.availableMemory.toFixed(1)} GB available
                        </span>
                      </div>
                      <strong>
                        {telemetry.memoryUtilization.toFixed(1)}%
                      </strong>
                    </div>

                    <div className="advanced-gpu-progress advanced-gpu-memory-progress">
                      <span style={{ width: `${memoryWidth}%` }} />
                    </div>

                  </div>


                  <div className="advanced-gpu-resource-block">

                    <div className="advanced-gpu-block-header">
                      <div>
                        <strong>Resource imbalance</strong>
                        <span>
                          {fragmentation < 25
                            ? "Low pressure"
                            : fragmentation < 50
                              ? "Moderate pressure"
                              : "High pressure"}
                        </span>
                      </div>
                      <strong>{fragmentation.toFixed(1)}%</strong>
                    </div>

                    <div className="advanced-gpu-progress advanced-gpu-fragmentation-progress">
                      <span style={{ width: `${fragmentationWidth}%` }} />
                    </div>

                  </div>


                  <div className="advanced-gpu-detail-grid">

                    <div>
                      <span>GPU CLOCK</span>
                      <strong>{telemetry.gpuClock.toLocaleString()} MHz</strong>
                    </div>

                    <div>
                      <span>MEMORY CLOCK</span>
                      <strong>{telemetry.memoryClock.toLocaleString()} MHz</strong>
                    </div>

                    <div>
                      <span>ACCELERATOR A</span>
                      <strong>{telemetry.acceleratorA}</strong>
                    </div>

                    <div>
                      <span>ACCELERATOR B</span>
                      <strong>{telemetry.acceleratorB}</strong>
                    </div>

                  </div>


                  <div className="advanced-gpu-job-section">

                    <div className="advanced-gpu-job-header">
                      <div>
                        <strong>ACTIVE JOBS</strong>
                        <span>
                          {runningJobs.length > 0
                            ? "Currently allocated workloads"
                            : "No workload currently assigned"}
                        </span>
                      </div>

                      <span className="advanced-gpu-job-count">
                        {runningJobs.length}
                      </span>
                    </div>

                    {runningJobs.length > 0 ? (

                      <div className="advanced-gpu-job-list">

                        {runningJobs.map((job) => (
                          <div
                            key={`${gpuId}-active-job-${job.job_id}`}
                            className="advanced-gpu-job"
                          >
                            <div className="advanced-gpu-job-main">

                              <span className="advanced-gpu-job-id">
                                #{job.job_id}
                              </span>

                              <div>
                                <strong>
                                  {job.name || "Unnamed workload"}
                                </strong>

                                <span>
                                  Priority {job.priority ?? 1} · {job.status}
                                </span>
                              </div>

                            </div>

                            <div className="advanced-gpu-job-resources">
                              <span>
                                C {job.compute_required ?? job.resources?.compute_units ?? 0}
                              </span>
                              <span>
                                M {job.memory_required ?? job.resources?.memory ?? 0} GB
                              </span>
                            </div>

                          </div>
                        ))}

                      </div>

                    ) : (

                      <div className="advanced-gpu-empty-job">
                        <HardDrive size={17} />
                        <span>
                          GPU is available for the next schedulable workload.
                        </span>
                      </div>

                    )}

                  </div>


                  <div className="advanced-gpu-footer">

                    <div>
                      <span>Scheduler policy</span>
                      <strong>
                        {schedulingPolicy.policy || "RESOURCE_BALANCED"}
                      </strong>
                    </div>

                    <div>
                      <span>Node state</span>
                      <strong>{allocationStatus}</strong>
                    </div>

                    <div>
                      <span>Telemetry</span>
                      <strong>
                        {telemetry.telemetryMode}
                      </strong>
                    </div>

                  </div>

                </article>
              );
            })}

          </div>

        ) : (

          <div className="empty-state">
            <h3>GPU visualization unavailable</h3>
            <p>Waiting for live GPU cluster data.</p>
          </div>

        )}

      </section>


      {/* ======================================
          ANALYTICS SUMMARY
      ====================================== */}

      <section
        className="analytics-summary-grid"
        data-dashboard-section="analytics"
      >

        <div className="analytics-summary-card analytics-utilization">
          <div className="analytics-summary-top">
            <span>GPU UTILIZATION</span>
            <span className="analytics-summary-icon"><Cpu size={17} /></span>
          </div>
          <strong>{getOverallUtilization()}%</strong>
          <small>Average resource utilization</small>
          <div className="analytics-summary-meter">
            <span style={{ width: `${getUtilizationWidth(getOverallUtilization())}%` }} />
          </div>
        </div>

        <div className="analytics-summary-card analytics-fragmentation">
          <div className="analytics-summary-top">
            <span>RESOURCE IMBALANCE</span>
            <span className="analytics-summary-icon"><Activity size={17} /></span>
          </div>
          <strong>{fragmentation}%</strong>
          <small>Level: {fragmentationLevel}</small>
          <div className="analytics-summary-meter">
            <span style={{ width: `${getUtilizationWidth(fragmentation)}%` }} />
          </div>
        </div>

        <div className="analytics-summary-card analytics-efficiency">
          <div className="analytics-summary-top">
            <span>UTILIZATION SCORE</span>
            <span className="analytics-summary-icon"><Zap size={17} /></span>
          </div>
          <strong>{allocationEfficiency}%</strong>
          <small>Utilization minus imbalance penalty</small>
          <div className="analytics-summary-meter">
            <span style={{ width: `${getUtilizationWidth(allocationEfficiency)}%` }} />
          </div>
        </div>

      </section>


      {/* ======================================
          DEADLOCK MONITOR
      ====================================== */}

      <section className="panel" data-dashboard-section="scheduler">

        <div className="panel-header">
          <div>
            <h2>Queue Diagnostics</h2>
            <p>Blocked and infeasible resource requests</p>
          </div>

          <span
            className={
              deadlock.deadlock_detected
                ? "live-badge deadlock-danger"
                : "live-badge deadlock-safe"
            }
          >
            {deadlock.deadlock_detected
              ? "● DEADLOCK DETECTED"
              : "● RESOURCE DIAGNOSTICS"}
          </span>
        </div>

        <div className="resource-grid">
          <div className="resource-card">
            <span>Detection Status</span>
            <strong>
              {deadlock.status || "NOT_APPLICABLE"}
            </strong>
            <small>No dependency graph is modeled</small>
          </div>

          <div className="resource-card">
            <span>Blocked / Infeasible</span>
            <strong>{deadlock.blocked_count ?? 0} / {deadlock.infeasible_count ?? 0}</strong>
            <small>Checked during live refresh</small>
          </div>
        </div>

      </section>




      {/* ======================================
          SCHEDULING POLICY
      ====================================== */}

      <section className="panel" data-dashboard-section="scheduler">

        <div className="panel-header">

          <div>
            <h2>Scheduling Policy</h2>

            <p>
              Select how waiting GPU jobs are scheduled
            </p>
          </div>

          <span className="live-badge">
            {schedulingPolicy.policy || "RESOURCE_BALANCED"}
          </span>

        </div>

        <div className="job-form">

          <select
            value={schedulingPolicy.policy || "RESOURCE_BALANCED"}
            onChange={handleSchedulingPolicyChange}
            disabled={changingPolicy}
          >
            {(schedulingPolicy.available_policies || []).map(
              (policy) => (
                <option key={policy} value={policy}>
                  {policy === "RESOURCE_BALANCED"
                    ? "Resource Balanced (Intelligent)"
                    : policy === "RESOURCE_EFFICIENT"
                    ? "Resource Efficient"
                    : policy === "PRIORITY"
                    ? "Priority"
                    : policy === "SJF"
                    ? "Smallest Resource Demand (legacy SJF)"
                    : policy === "PREEMPTIVE"
                    ? "Preemptive Scheduling"
                    : "First Come First Served (FCFS)"}
                </option>
              )
            )}
          </select>

          <div>
            <strong>
              Current: {schedulingPolicy.policy || "RESOURCE_BALANCED"}
            </strong>

            <small>
              {changingPolicy
                ? "Updating scheduler..."
                : "Policy changes are applied to waiting jobs."}
            </small>
          </div>

        </div>

      </section>


            {/* ======================================
          CREATE JOB
      ====================================== */}

      <section className="panel" data-dashboard-section="scheduler">

        <div className="panel-header">

          <div>
            <h2>Create GPU Job</h2>

            <p>
              Submit a workload to the scheduler
            </p>
          </div>

        </div>


        <form
          onSubmit={handleCreateJob}
          className="form-grid"
        >

          <div className="form-field">
            <label htmlFor="job-name">Job name</label>
            <input
              id="job-name"
              type="text"
              placeholder="e.g. AI Training"
              value={form.name}
              onChange={(e) =>
                setForm({
                  ...form,
                  name: e.target.value,
                })
              }
              required
            />
          </div>

          <div className="form-field">
            <label htmlFor="compute-units">Compute units</label>
            <input
              id="compute-units"
              type="number"
              min="1"
              value={form.compute_required}
              onChange={(e) =>
                setForm({
                  ...form,
                  compute_required: e.target.value,
                })
              }
              required
            />
          </div>

          <div className="form-field">
            <label htmlFor="memory">Memory</label>
            <input
              id="memory"
              type="number"
              min="1"
              value={form.memory_required}
              onChange={(e) =>
                setForm({
                  ...form,
                  memory_required: e.target.value,
                })
              }
              required
            />
          </div>

          <div className="form-field">
            <label htmlFor="accelerator-a">Accelerator A</label>
            <input
              id="accelerator-a"
              type="number"
              min="0"
              value={form.accelerator_a_required}
              onChange={(e) =>
                setForm({
                  ...form,
                  accelerator_a_required: e.target.value,
                })
              }
            />
          </div>

          <div className="form-field">
            <label htmlFor="accelerator-b">Accelerator B</label>
            <input
              id="accelerator-b"
              type="number"
              min="0"
              value={form.accelerator_b_required}
              onChange={(e) =>
                setForm({
                  ...form,
                  accelerator_b_required: e.target.value,
                })
              }
            />
          </div>

          <div className="form-field">
            <label htmlFor="priority">Priority</label>
            <input
              id="priority"
              type="number"
              min="1"
              value={form.priority}
              onChange={(e) =>
                setForm({
                  ...form,
                  priority: e.target.value,
                })
              }
            />
          </div>

          <div className="form-field form-field-action">
            <button type="submit">
              + Allocate Job
            </button>
          </div>

        </form>

      </section>


      {/* ======================================
          RESOURCE ANALYTICS
      ====================================== */}

      <section className="panel" data-dashboard-section="analytics">

        <div className="panel-header">

          <div>
            <h2>Resource Analytics</h2>

            <p>
              Detailed GPU allocation analysis
            </p>
          </div>

        </div>


        {analytics ? (

          <>
            <div className="analytics-chart-card">
            <div className="analytics-chart-header">
              <div>
                <span className="analytics-chart-kicker">LIVE RESOURCE TREND</span>
                <h3>GPU performance over time</h3>
                <p>Captured from the dashboard's 3-second live refresh cycle.</p>
              </div>
              <div className="analytics-chart-legend">
                <span><i className="legend-dot legend-blue" /> Utilization</span>
                <span><i className="legend-dot legend-green" /> Imbalance</span>
                <span><i className="legend-dot legend-orange" /> Utilization score</span>
              </div>
            </div>

            {analyticsHistory.length >= 2 ? (
              <div className="analytics-chart-wrap">
                {(() => {
                  const width = 900;
                  const height = 270;
                  const padX = 42;
                  const padY = 24;
                  const innerW = width - padX * 2;
                  const innerH = height - padY * 2;

                  const pointFor = (value, index) => {
                    const x = padX + (index / Math.max(analyticsHistory.length - 1, 1)) * innerW;
                    const y = padY + (1 - Math.max(0, Math.min(100, Number(value) || 0)) / 100) * innerH;
                    return { x, y };
                  };

                  const makePoints = (key) =>
                    analyticsHistory.map((entry, index) => pointFor(entry[key], index));

                  const toPath = (points) =>
                    points.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x.toFixed(1)} ${point.y.toFixed(1)}`).join(" ");

                  const utilizationPoints = makePoints("utilization");
                  const fragmentationPoints = makePoints("fragmentation");
                  const efficiencyPoints = makePoints("efficiency");
                  const areaPath = `${toPath(utilizationPoints)} L ${width - padX} ${height - padY} L ${padX} ${height - padY} Z`;

                  return (
                    <svg
                      className="analytics-chart-svg"
                      viewBox={`0 0 ${width} ${height}`}
                      role="img"
                      aria-label="Live GPU utilization, resource imbalance and utilization score trend"
                    >
                      {[0, 25, 50, 75, 100].map((tick) => {
                        const y = padY + (1 - tick / 100) * innerH;
                        return (
                          <g key={tick}>
                            <line x1={padX} x2={width - padX} y1={y} y2={y} className="chart-grid-line" />
                            <text x="8" y={y + 4} className="chart-axis-label">{tick}%</text>
                          </g>
                        );
                      })}

                      <path d={areaPath} className="chart-area" />
                      <path d={toPath(utilizationPoints)} className="chart-line chart-line-blue" />
                      <path d={toPath(fragmentationPoints)} className="chart-line chart-line-green" />
                      <path d={toPath(efficiencyPoints)} className="chart-line chart-line-orange" />

                      {utilizationPoints.map((point, index) => (
                        <circle key={`u-${index}`} cx={point.x} cy={point.y} r="3.2" className="chart-point chart-point-blue" />
                      ))}
                    </svg>
                  );
                })()}
              </div>
            ) : (
              <div className="analytics-chart-empty">
                <BarChart3 size={28} />
                <strong>Collecting live analytics</strong>
                <span>The chart will populate after the next dashboard refresh.</span>
              </div>
            )}
          </div>

          <div className="resource-grid">

            {Object.entries(
              analytics.utilization || {}
            ).map(([resource, utilization]) => {

              const availability =
                analytics.availability?.[
                  resource
                ] ?? 0;

              const fragmentationValue =
                analytics.fragmentation?.[
                  resource
                ] ?? 0;

              return (
                <div
                  className="resource-card"
                  key={resource}
                >

                  <span>
                    {formatResourceName(
                      resource
                    )}
                  </span>

                  <strong>
                    {utilization}%
                  </strong>

                  <small>
                    Utilization
                  </small>

                  <small>
                    Availability:{" "}
                    {availability}%
                  </small>

                  <small>
                    Imbalance:{" "}
                    {fragmentationValue}%
                  </small>

                </div>
              );
            })}

          </div>

          </>

        ) : (

          <p>
            Loading analytics...
          </p>

        )}

      </section>


      {/* ======================================
          SCHEDULER KPI OVERVIEW
      ====================================== */}

      <section className="panel" data-dashboard-section="analytics">

        <div className="panel-header">

          <div>
            <h2>Scheduler KPI Overview</h2>

            <p>
              Key performance indicators for the current scheduler session
            </p>
          </div>

          <span className="live-badge">
            ● KPI
          </span>

        </div>

        {historicalAnalytics ? (

          <div className="resource-grid">

            <div className="resource-card">
              <span>THROUGHPUT / HOUR</span>
              <strong>
                {Number(
                  historicalAnalytics.throughput_per_hour ?? 0
                ).toFixed(2)}
              </strong>
              <small>Completed jobs per hour</small>
            </div>

            <div className="resource-card">
              <span>GPU UTILIZATION</span>
              <strong>
                {Number(
                  getAverageGpuUtilization()
                ).toFixed(1)}%
              </strong>
              <small>Average utilization across GPU nodes</small>
            </div>

            <div className="resource-card">
              <span>UTILIZATION SCORE</span>
              <strong>
                {Number(
                  historicalAnalytics.allocation_efficiency ??
                    allocationEfficiency ??
                    0
                ).toFixed(1)}%
              </strong>
              <small>Heuristic utilization score</small>
            </div>

            <div className="resource-card">
              <span>ALLOCATION RATE</span>
              <strong>
                {Number(
                  historicalAnalytics.successful_allocation_rate ?? 0
                ).toFixed(1)}%
              </strong>
              <small>Successful allocation attempts</small>
            </div>

            <div className="resource-card">
              <span>ACTIVE JOBS</span>
              <strong>
                {historicalAnalytics.active_jobs ??
                  ((statistics.running_jobs ?? 0) +
                    (statistics.waiting_jobs ?? 0) +
                    (statistics.queued_jobs ?? 0))}
              </strong>
              <small>Running, waiting and queued jobs</small>
            </div>

            <div className="resource-card">
              <span>PREEMPTIONS</span>
              <strong>
                {historicalAnalytics.preemption_count ?? 0}
              </strong>
              <small>Scheduler preemption events</small>
            </div>

          </div>

        ) : (

          <p>
            Loading scheduler KPIs...
          </p>

        )}

      </section>


      {/* ======================================
          GPU PERFORMANCE KPIs
      ====================================== */}

      <section className="panel" data-dashboard-section="analytics">

        <div className="panel-header">

          <div>
            <h2>GPU Performance KPIs</h2>

            <p>
              Per-node utilization, availability and workload distribution
            </p>
          </div>

          <span className="live-badge">
            {resources?.gpu_count ?? getGpuEntries().length} NODES
          </span>

        </div>

        {getGpuEntries().length > 0 ? (

          <div className="resource-grid">

            {getGpuEntries().map(([gpuId, gpuData]) => {

              const utilization = Number(
                getGpuUtilization(gpuData)
              );

              const availability = Number(
                getGpuAvailability(gpuData)
              );

              const runningJobs = getJobsForGpu(gpuId);

              const fragmentation = Number(
                gpuData?.overall_fragmentation ?? 0
              );

              return (
                <div
                  className="resource-card"
                  key={`kpi-${gpuId}`}
                >

                  <div className="resource-card-top">
                    <span>{gpuId}</span>
                    <strong>{utilization.toFixed(1)}%</strong>
                  </div>

                  <small>
                    Utilization
                  </small>

                  <div className="progress-bar">
                    <div
                      className="progress-fill"
                      style={{
                        width: `${Math.min(
                          Math.max(utilization, 0),
                          100
                        )}%`,
                      }}
                    />
                  </div>

                  <small>
                    Availability: {availability.toFixed(1)}%
                  </small>

                  <small>
                    Running jobs: {runningJobs.length}
                  </small>

                  <small>
                    Imbalance: {fragmentation.toFixed(1)}%
                  </small>

                </div>
              );
            })}

          </div>

        ) : (

          <p>
            GPU performance data is not available yet.
          </p>

        )}

      </section>


      {/* ======================================
          HISTORICAL ANALYTICS
      ====================================== */}

      <section className="panel" data-dashboard-section="analytics">

        <div className="panel-header">

          <div>
            <h2>Historical Scheduler Analytics</h2>

            <p>
              Performance metrics collected during
              the current scheduler session
            </p>
          </div>

          <span className="live-badge">
            ● LIVE
          </span>

        </div>


        {historicalAnalytics ? (

          <div className="resource-grid">

            <div className="resource-card">
              <span>THROUGHPUT</span>

              <strong>
                {Number(
                  historicalAnalytics.throughput_per_minute ?? 0
                ).toFixed(2)}
              </strong>

              <small>
                Completed jobs / minute
              </small>
            </div>


            <div className="resource-card">
              <span>AVG WAITING TIME</span>

              <strong>
                {formatDuration(
                  historicalAnalytics.average_waiting_time
                )}
              </strong>

              <small>
                Average queue waiting time
              </small>
            </div>


            <div className="resource-card">
              <span>AVG EXECUTION TIME</span>

              <strong>
                {formatDuration(
                  historicalAnalytics.average_execution_time
                )}
              </strong>

              <small>
                Average execution duration
              </small>
            </div>


            <div className="resource-card">
              <span>AVG TOTAL DURATION</span>

              <strong>
                {formatDuration(
                  historicalAnalytics.average_total_duration
                )}
              </strong>

              <small>
                Submission to completion/cancellation
              </small>
            </div>


            <div className="resource-card">
              <span>ALLOCATION SUCCESS</span>

              <strong>
                {Number(
                  historicalAnalytics.successful_allocation_rate ?? 0
                ).toFixed(1)}%
              </strong>

              <small>
                Successful allocation attempts
              </small>
            </div>


            <div className="resource-card">
              <span>COMPLETED</span>

              <strong>
                {historicalAnalytics.completed_jobs ?? 0}
              </strong>

              <small>
                Successfully completed jobs
              </small>
            </div>


            <div className="resource-card">
              <span>CANCELLED</span>

              <strong>
                {historicalAnalytics.cancelled_jobs ?? 0}
              </strong>

              <small>
                Cancelled jobs
              </small>
            </div>


            <div className="resource-card">
              <span>PREEMPTIONS</span>

              <strong>
                {historicalAnalytics.preemption_count ?? 0}
              </strong>

              <small>
                Scheduler preemption events
              </small>
            </div>

          </div>

        ) : (

          <p>
            Loading historical analytics...
          </p>

        )}

      </section>


      {/* ======================================
          WORKLOAD GENERATOR
      ====================================== */}

      <section className="panel" data-dashboard-section="workloads">

        <div className="panel-header">
          <div>
            <div className="modern-section-kicker" id="workloads">WORKLOADS</div>
          <h2>Workload Generator</h2>
            <p>Generate realistic GPU workloads for scheduler testing</p>
          </div>

        </div>

        <div className="form-grid">

          <div className="form-field">
            <label htmlFor="workload-count">Job count</label>
            <input
              id="workload-count"
              type="number"
              min="1"
              max="1000"
              value={workloadCount}
              onChange={(e) => setWorkloadCount(Number(e.target.value))}
            />
          </div>

          <div className="form-field">
            <label htmlFor="workload-pattern">Workload pattern</label>
            <select
              id="workload-pattern"
              value={workloadPattern}
              onChange={(e) => setWorkloadPattern(e.target.value)}
            >
              <option value="LIGHT">Light</option>
              <option value="BALANCED">Balanced</option>
              <option value="HEAVY">Heavy</option>
              <option value="MIXED">Mixed</option>
              <option value="ACCELERATOR_HEAVY">Accelerator Heavy</option>
            </select>
          </div>

          <div className="form-field">
            <label htmlFor="workload-seed">Seed</label>
            <input
              id="workload-seed"
              type="number"
              min="0"
              value={workloadSeed}
              onChange={(e) => setWorkloadSeed(e.target.value)}
              placeholder="Optional"
            />
          </div>

          <div className="form-field form-field-action">
            <button
              type="button"
              onClick={handleGenerateWorkload}
              disabled={workloadLoading}
            >
              {workloadLoading ? "Generating..." : "Generate Workload"}
            </button>
          </div>

        </div>

        {workloadResult && (
          <div className="resource-grid">
            <div className="resource-card">
              <span>GENERATED</span>
              <strong>{workloadResult.count ?? 0}</strong>
              <small>{workloadResult.pattern} workload</small>
            </div>

            <div className="resource-card">
              <span>RUNNING</span>
              <strong>
                {workloadResult.jobs?.filter((job) => job.status === "RUNNING").length ?? 0}
              </strong>
              <small>Jobs immediately allocated</small>
            </div>

            <div className="resource-card">
              <span>WAITING</span>
              <strong>
                {workloadResult.jobs?.filter((job) => job.status === "WAITING").length ?? 0}
              </strong>
              <small>Jobs waiting for resources</small>
            </div>

            <div className="resource-card">
              <span>LAST BATCH</span>
              <strong>READY</strong>
              <small>Added to live scheduler</small>
            </div>
          </div>
        )}

      </section>


      {/* ======================================
          STRESS TESTING
      ====================================== */}

      <section className="panel" data-dashboard-section="stress-test">

        <div className="panel-header">
          <div>
            <div className="modern-section-kicker" id="stress-test">BENCHMARKING</div>
          <h2>Scheduler Submission Stress Test</h2>
          <p>Measures batch submission processing. Jobs are added to the live simulator and complete manually.</p>
            <p>Benchmark scheduler behavior under high job volume</p>
          </div>

        </div>

        <div className="form-grid">

          <div className="form-field">
            <label htmlFor="stress-size">Test size</label>
            <select
              id="stress-size"
              value={stressSize}
              onChange={(e) => setStressSize(Number(e.target.value))}
            >
              <option value={10}>10 Jobs</option>
              <option value={50}>50 Jobs</option>
              <option value={100}>100 Jobs</option>
              <option value={500}>500 Jobs</option>
              <option value={1000}>1000 Jobs</option>
            </select>
          </div>

          <div className="form-field">
            <label htmlFor="stress-pattern">Workload pattern</label>
            <select
              id="stress-pattern"
              value={stressPattern}
              onChange={(e) => setStressPattern(e.target.value)}
            >
              <option value="LIGHT">Light</option>
              <option value="BALANCED">Balanced</option>
              <option value="HEAVY">Heavy</option>
              <option value="MIXED">Mixed</option>
              <option value="ACCELERATOR_HEAVY">Accelerator Heavy</option>
            </select>
          </div>

          <div className="form-field">
            <label htmlFor="stress-seed">Seed</label>
            <input
              id="stress-seed"
              type="number"
              min="0"
              value={stressSeed}
              onChange={(e) => setStressSeed(e.target.value)}
              placeholder="Optional"
            />
          </div>

          <div className="form-field form-field-action">
            <button
              type="button"
              onClick={handleStressTest}
              disabled={stressLoading}
            >
              {stressLoading ? "Testing..." : "Run Stress Test"}
            </button>
          </div>

        </div>

        {stressResult?.result && (
          <div className="resource-grid">

            <div className="resource-card">
              <span>JOBS PROCESSED</span>
              <strong>{stressResult.result.generated_jobs ?? 0}</strong>
              <small>Submitted during this test</small>
            </div>

            <div className="resource-card">
              <span>PROCESSING TIME</span>
              <strong>{Number(stressResult.result.processing_time_ms ?? 0).toFixed(1)} ms</strong>
              <small>Scheduler processing time</small>
            </div>

            <div className="resource-card">
              <span>JOBS / SECOND</span>
              <strong>{Number(stressResult.result.jobs_per_second ?? 0).toFixed(2)}</strong>
              <small>Submission throughput</small>
            </div>

            <div className="resource-card">
              <span>ALLOCATION SUCCESS</span>
              <strong>{Number(stressResult.result.allocation_success_rate ?? 0).toFixed(1)}%</strong>
              <small>Successful allocation attempts</small>
            </div>

            <div className="resource-card">
              <span>RUNNING</span>
              <strong>{stressResult.result.allocated_jobs ?? 0}</strong>
              <small>Allocated during test</small>
            </div>

            <div className="resource-card">
              <span>WAITING</span>
              <strong>{stressResult.result.waiting_jobs ?? 0}</strong>
              <small>Resource-constrained jobs</small>
            </div>

            <div className="resource-card">
              <span>ATTEMPTS</span>
              <strong>{stressResult.result.allocation_attempts ?? 0}</strong>
              <small>Allocation decisions made</small>
            </div>

            <div className="resource-card">
              <span>CLUSTER JOBS</span>
              <strong>{stressResult.result.total_jobs_after ?? 0}</strong>
              <small>Total jobs after test</small>
            </div>

          </div>
        )}

        {workloadHistory && (
          <div className="job-resources">
            <span>
              Workload batches: {workloadHistory.workload_batches ?? 0}
            </span>
            <span>
              Stress-test runs: {workloadHistory.stress_test_runs ?? 0}
            </span>
          </div>
        )}

      </section>


      {/* ======================================
          ALLOCATION EXPLANATION
      ====================================== */}

      <section className="panel" data-dashboard-section="decisions">

        <div className="panel-header">

          <div>
            <div className="modern-section-kicker" id="decisions">DECISIONS</div>
          <h2>Allocation Decision Center</h2>

            <p>
              Understand why the scheduler selected each GPU
            </p>
          </div>


        </div>

        {jobs.length > 0 ? (

          <div className="resource-grid">

            {jobs
              .filter((job) => job.allocation_explanation)
              .slice(-6)
              .reverse()
              .map((job) => {

                const explanation =
                  job.allocation_explanation;

                const reasons =
                  explanation.reasons || [];

                const candidates =
                  explanation.candidates || [];

                return (
                  <div
                    className="resource-card"
                    key={`explanation-${job.job_id}`}
                  >

                    <div className="resource-card-top">
                      <span>JOB #{job.job_id}</span>

                      <strong>
                        {Number(
                          explanation.score ??
                          job.allocation_score ??
                          0
                        ).toFixed(1)}
                      </strong>
                    </div>

                    <div className="resource-value">
                      {explanation.gpu_id || explanation.decision || "QUEUED"}
                    </div>

                    <small>
                      {explanation.headline ||
                        "Scheduler decision pending"}
                    </small>

                    <small>
                      Policy: {explanation.policy ||
                        schedulingPolicy.policy ||
                        "RESOURCE_BALANCED"}
                    </small>

                    <details style={{ marginTop: "10px" }}>
                      <summary
                        style={{
                          cursor: "pointer",
                          fontWeight: 700,
                          fontSize: "12px"
                        }}
                      >
                        Why was this GPU selected?
                      </summary>

                      <div
                        className="job-resources"
                        style={{ marginTop: "8px" }}
                      >
                        {reasons.map((reason, index) => (
                          <span key={`${job.job_id}-reason-${index}`}>
                            ✓ {reason}
                          </span>
                        ))}
                      </div>

                      {candidates.length > 0 && (
                        <div
                          className="job-resources"
                          style={{ marginTop: "8px" }}
                        >
                          <span>GPU candidate scores</span>

                          {candidates.map((candidate) => (
                            <span
                              key={`${job.job_id}-${candidate.gpu_id}`}
                            >
                              {candidate.gpu_id}: {
                                candidate.eligible
                                  ? Number(candidate.score || 0).toFixed(1)
                                  : "Not eligible"
                              }
                            </span>
                          ))}
                        </div>
                      )}
                    </details>

                  </div>
                );
              })}

          </div>

        ) : (

          <div className="empty-state">
            <h3>No allocation decisions yet</h3>
            <p>Create a GPU job to see the scheduler explanation here.</p>
          </div>

        )}

      </section>


      {/* ======================================
          WAITING JOB EXPLANATION
      ====================================== */}

      <section className="panel" data-dashboard-section="decisions">

        <div className="panel-header">

          <div>
            <div className="modern-section-kicker">QUEUE INSIGHTS</div>
          <h2>Waiting Job Explanation</h2>
            <p>
              See exactly why queued jobs are waiting and what is blocking them
            </p>
          </div>

          <span className="live-badge">
            {getWaitingJobs().length} WAITING
          </span>

        </div>

        {getWaitingJobs().length > 0 ? (

          <div className="resource-grid">

            {getWaitingJobs().slice(0, 8).map((job) => {
              const explanation = job.allocation_explanation || {};
              const blockers = getWaitingBlockers(job);

              return (
                <div
                  className="resource-card"
                  key={`waiting-${job.job_id}`}
                >

                  <div className="resource-card-top">
                    <span>JOB #{job.job_id}</span>
                    <strong>P{job.priority}</strong>
                  </div>

                  <div className="resource-value">
                    {job.name}
                  </div>

                  <small>
                    {getWaitingReason(job)}
                  </small>

                  <div
                    className="job-resources"
                    style={{ marginTop: "10px" }}
                  >
                    {blockers.map((blocker, index) => (
                      <span key={`${job.job_id}-blocker-${index}`}>
                        ⚠ {blocker}
                      </span>
                    ))}
                  </div>

                  <details style={{ marginTop: "10px" }}>
                    <summary
                      style={{
                        cursor: "pointer",
                        fontWeight: 700,
                        fontSize: "12px"
                      }}
                    >
                      Scheduler details
                    </summary>

                    <div
                      className="job-resources"
                      style={{ marginTop: "8px" }}
                    >
                      <span>
                        Policy: {explanation.policy || schedulingPolicy.policy}
                      </span>
                      <span>
                        Allocation score: {Number(
                          job.allocation_score ?? explanation.score ?? 0
                        ).toFixed(1)}
                      </span>
                      {(explanation.reasons || []).map((reason, index) => (
                        <span key={`${job.job_id}-wait-reason-${index}`}>
                          • {reason}
                        </span>
                      ))}
                    </div>
                  </details>

                </div>
              );
            })}

          </div>

        ) : (

          <div className="empty-state">
            <h3>No waiting jobs</h3>
            <p>All submitted jobs are currently allocated, completed, cancelled or queued normally.</p>
          </div>

        )}

      </section>


      {/* ======================================
          JOB TABLE
      ====================================== */}

      <section className="panel" data-dashboard-section="decisions">

        <div className="panel-header">

          <div>
            <h2>GPU Jobs</h2>

            <p>
              Live scheduler queue
            </p>
          </div>

          <span>
            {jobs.length} jobs
          </span>

        </div>


        {jobs.length === 0 ? (

          <div className="empty-state">
            <h3>No jobs submitted</h3>

            <p>
              Create your first GPU workload
              above.
            </p>
          </div>

        ) : (

          <div className="table-container">

            <table>

              <thead>

                <tr>
                  <th>ID</th>
                  <th>GPU</th>
                  <th>Job</th>
                  <th>Priority</th>
                  <th>Resources</th>
                  <th>Score</th>
                  <th>Allocation Explanation</th>
                  <th>Execution Tracking</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>

              </thead>


              <tbody>

                {jobs.map((job) => (

                  <tr key={job.job_id}>

                    <td>
                      #{job.job_id}
                    </td>


                    <td>
                      <strong>
                        {job.gpu_id || "—"}
                      </strong>

                      <div className="job-resources">
                        <span>
                          {job.status === "RUNNING"
                            ? "Allocated"
                            : job.status === "WAITING"
                            ? "Waiting for GPU"
                            : "Not allocated"}
                        </span>
                      </div>
                    </td>


                    <td>
                      <strong>
                        {job.name}
                      </strong>

                      <div className="job-resources">
                        <span>
                          Submitted: {formatTimestamp(job.submitted_at)}
                        </span>
                        {job.started_at && (
                          <span>
                            Started: {formatTimestamp(job.started_at)}
                          </span>
                        )}
                        {job.completed_at && (
                          <span>
                            Completed: {formatTimestamp(job.completed_at)}
                          </span>
                        )}
                        {job.cancelled_at && (
                          <span>
                            Cancelled: {formatTimestamp(job.cancelled_at)}
                          </span>
                        )}
                      </div>
                    </td>


                    <td>
                      P{job.priority}
                    </td>


                    <td>

                      <div className="job-resources">

                        <span>
                          C:{" "}
                          {job.resources
                            ?.compute_units ??
                            0}
                        </span>

                        <span>
                          M:{" "}
                          {job.resources
                            ?.memory ??
                            0}
                        </span>

                      </div>

                    </td>


                    <td>
                      {Number(
                        job.allocation_score ??
                        0
                      ).toFixed(1)}
                    </td>


                    <td>
                      <details>
                        <summary
                          style={{
                            cursor: "pointer",
                            fontWeight: 700
                          }}
                        >
                          {job.allocation_explanation?.decision === "ALLOCATED"
                            ? "Why selected?"
                            : job.status === "COMPLETED" || job.status === "CANCELLED"
                              ? "Final outcome"
                              : job.allocation_explanation?.decision === "INFEASIBLE"
                                ? "Why infeasible?"
                                : "Why waiting?"}
                        </summary>

                        <div
                          className="job-resources"
                          style={{ marginTop: "8px" }}
                        >
                          <span>
                            {job.allocation_explanation?.headline ||
                              "No explanation available"}
                          </span>

                          {(job.allocation_explanation?.reasons || []).map(
                            (reason, index) => (
                              <span key={`${job.job_id}-table-reason-${index}`}>
                                ✓ {reason}
                              </span>
                            )
                          )}
                        </div>
                      </details>
                    </td>


                    <td>
                      <div className="job-resources">
                        <span>
                          Queue: {formatDuration(
                            job.queue_wait_seconds
                          )}
                        </span>
                        <span>
                          Exec: {formatDuration(
                            job.execution_duration_seconds
                          )}
                        </span>
                        <span>
                          Total: {formatDuration(
                            job.total_duration_seconds
                          )}
                        </span>
                      </div>
                    </td>


                    <td>

                      <span
                        className={`status-badge ${getStatusClass(
                          job.status
                        )}`}
                      >
                        {job.status}
                      </span>

                    </td>


                    <td>

                      <div className="job-actions">

                        {job.status === "RUNNING" && (
                          <button
                            className="complete-button"
                            onClick={() =>
                              handleCompleteJob(job.job_id)
                            }
                          >
                            Complete
                          </button>
                        )}

                        {(job.status === "RUNNING" ||
                          job.status === "WAITING" ||
                          job.status === "QUEUED") && (
                          <button
                            className="cancel-button"
                            onClick={() =>
                              handleCancelJob(job.job_id)
                            }
                          >
                            Cancel
                          </button>
                        )}

                        {job.status === "WAITING" && (
                          <span>Waiting</span>
                        )}

                        {job.status === "COMPLETED" && (
                          <span>✓ Done</span>
                        )}

                        {job.status === "CANCELLED" && (
                          <span>✕ Cancelled</span>
                        )}

                        {job.status === "QUEUED" && (
                          <span>Queued</span>
                        )}

                      </div>

                    </td>

                  </tr>

                ))}

              </tbody>

            </table>

          </div>

        )}

      </section>


      {/* ======================================
          SYSTEM INFORMATION
      ====================================== */}

      <section className="panel" data-dashboard-section="scheduler">

        <div className="modern-section-kicker" id="scheduler">SYSTEM</div>
        <h2>Scheduler Information</h2>

        <div className="resource-grid">

          <div className="resource-card">
            <span>Scheduler</span>
            <strong>ONLINE</strong>
            <small>
              FastAPI backend
            </small>
          </div>


          <div className="resource-card">
            <span>Allocation</span>
            <strong>
              Resource-Aware
            </strong>
            <small>
              Resource-aware scheduling
            </small>
          </div>


          <div className="resource-card">
            <span>Dependency Detection</span>
            <strong>
              {deadlock.status || "NOT_APPLICABLE"}
            </strong>
            <small>
              {deadlock.deadlock_detected
                ? "Deadlock detected"
                : "No dependency graph is modeled"}
            </small>
          </div>


          <div className="resource-card">
            <span>Execution Tracking</span>
            <strong>ACTIVE</strong>
            <small>
              Queue, wait, execution and total durations
            </small>
          </div>


          <div className="resource-card">
            <span>Live Monitoring</span>
            <strong>3 SEC</strong>
            <small>
              Automatic dashboard refresh
            </small>
          </div>

        </div>

      </section>

      </main>
    </div>
  );
}

export default Dashboard;