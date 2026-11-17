"use client";
import { useEffect, useState } from "react";
import { AGES, ATTRS, DIAG, Filters, QType, RECORDS, STATES, laplace, trueQuery } from "@/lib/data";

type Role = "Researcher" | "Ethics Reviewer" | "System Admin";
type Project = { id: string; name: string; budget: number; used: number };
type Req = { id: string; title: string; purpose: string; attrs: string[]; types: string[]; status: "Pending" | "Approved" | "Rejected"; note?: string };
type Q = { id: string; project: string; type: QType; filters: string; eps: number; truth: number; noisy: number; t: string };
type Log = { t: string; who: string; what: string };
type S = { projects: Project[]; reqs: Req[]; qs: Q[]; log: Log[] };

const now = () => new Date().toLocaleString("en-NG", { dateStyle: "short", timeStyle: "short" });
const SEED: S = {
  projects: [
    { id: "p1", name: "Malaria Burden in South-West Nigeria", budget: 10, used: 3.5 },
    { id: "p2", name: "Hypertension Trends in Urban Centres", budget: 10, used: 8.2 },
  ],
  reqs: [{ id: "r1", title: "Diabetes outcomes by state", purpose: "Compare recovery rates of diabetes patients across states.", attrs: ["State", "Diagnosis", "Outcome"], types: ["Proportion"], status: "Pending" }],
  qs: [],
  log: [{ t: now(), who: "System", what: "Platform initialised with 24,000 de-identified records" }],
};
const USERS: { role: Role; name: string; desc: string }[] = [
  { role: "Researcher", name: "Dr. Amina Bello", desc: "Submit requests, run private queries" },
  { role: "Ethics Reviewer", name: "Prof. Chidi Okafor", desc: "Approve or reject access requests" },
  { role: "System Admin", name: "Tunde Adeyemi", desc: "Platform stats and audit trail" },
];

const card = "rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900";
const btn = "rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-40";
const input = "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800";

function Budget({ p }: { p: Project }) {
  const left = p.budget - p.used, pct = (left / p.budget) * 100;
  const color = pct > 50 ? "bg-emerald-500" : pct > 20 ? "bg-amber-500" : "bg-red-500";
  return (
    <div>
      <div className="mb-1 flex justify-between text-xs text-slate-500"><span>Privacy budget (ε)</span><span>{left.toFixed(1)} / {p.budget} remaining</span></div>
      <div className="h-3 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700"><div className={`h-full ${color} transition-all`} style={{ width: `${pct}%` }} /></div>
    </div>
  );
}
function Tip({ label, text }: { label: string; text: string }) {
  return (<details className="rounded-lg bg-brand-50 p-3 text-xs text-brand-700 dark:bg-slate-800 dark:text-emerald-300"><summary className="cursor-pointer font-medium">{label}</summary><p className="mt-1">{text}</p></details>);
}

export default function App() {
  const [s, setS] = useState<S>(SEED);
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<(typeof USERS)[number] | null>(null);
  const [dark, setDark] = useState(false);
  const [tab, setTab] = useState("Dashboard");

  useEffect(() => {
    try { const v = localStorage.getItem("pphdsp"); if (v) setS(JSON.parse(v)); } catch {}
    setReady(true);
  }, []);
  useEffect(() => { if (ready) try { localStorage.setItem("pphdsp", JSON.stringify(s)); } catch {} }, [s, ready]);
  useEffect(() => { document.documentElement.classList.toggle("dark", dark); }, [dark]);

  const log = (st: S, what: string): S => ({ ...st, log: [{ t: now(), who: user?.name ?? "?", what }, ...st.log].slice(0, 50) });
  const approved = s.projects;

  // ---- Query builder state
  const [pid, setPid] = useState("p1");
  const [type, setType] = useState<QType>("Count");
  const [f, setF] = useState<Filters>({ diagnosis: "Malaria", state: "Lagos", age: "" });
  const [eps, setEps] = useState(1);
  const [res, setRes] = useState<Q | null>(null);
  const [err, setErr] = useState("");
  const proj = approved.find((p) => p.id === pid) ?? approved[0];
  const preview = trueQuery(type, f);
  const b = preview.sens / eps;
  const unit = type === "Count" ? "records" : type === "Mean" ? "days" : "%";

  function run() {
    if (!proj) return;
    if (eps > proj.budget - proj.used + 1e-9) { setErr("Insufficient privacy budget for this ε."); return; }
    setErr("");
    const t = trueQuery(type, f);
    let noisy = t.value + laplace(t.sens / eps);
    noisy = type === "Count" ? Math.max(0, Math.round(noisy)) : Math.max(0, noisy);
    const q: Q = { id: crypto.randomUUID(), project: proj.name, type, filters: Object.entries(f).filter(([, v]) => v).map(([k, v]) => `${k}=${v}`).join(", ") || "none", eps, truth: t.value, noisy, t: now() };
    setRes(q);
    setS((st) => log({ ...st, qs: [q, ...st.qs], projects: st.projects.map((p) => (p.id === proj.id ? { ...p, used: +(p.used + eps).toFixed(2) } : p)) }, `Ran ${type} query on "${proj.name}" with ε=${eps}`));
  }
  function csv() {
    if (!res) return;
    const rows = [["project", "type", "filters", "epsilon", "noisy_result", "time"], [res.project, res.type, res.filters, res.eps, res.noisy.toFixed(2), res.t]];
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([rows.map((r) => r.map((c) => `"${c}"`).join(",")).join("\n")], { type: "text/csv" }));
    a.download = "pphdsp-result.csv"; a.click();
  }

  // ---- Request form state
  const [rq, setRq] = useState({ title: "", purpose: "", attrs: [] as string[], types: [] as string[] });
  const toggle = (arr: string[], v: string) => (arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);
  function submitReq() {
    const r: Req = { id: crypto.randomUUID(), ...rq, status: "Pending" };
    setS((st) => log({ ...st, reqs: [r, ...st.reqs] }, `Submitted access request "${rq.title}"`));
    setRq({ title: "", purpose: "", attrs: [], types: [] }); setTab("Dashboard");
  }
  function review(r: Req, ok: boolean, note: string) {
    setS((st) => log({
      ...st,
      reqs: st.reqs.map((x) => (x.id === r.id ? { ...x, status: ok ? "Approved" : "Rejected", note } : x)),
      projects: ok ? [...st.projects, { id: r.id, name: r.title, budget: 5, used: 0 }] : st.projects,
    }, `${ok ? "Approved" : "Rejected"} request "${r.title}"`));
  }
  const [notes, setNotes] = useState<Record<string, string>>({});

  if (!user) {
    return (
      <main className="mx-auto flex min-h-screen max-w-3xl flex-col justify-center gap-6 p-6">
        <div className="text-center">
          <div className="mx-auto mb-3 grid h-14 w-14 place-items-center rounded-2xl bg-brand-600 text-2xl text-white">🛡️</div>
          <h1 className="text-3xl font-bold">PPHDSP</h1>
          <p className="text-slate-500">Privacy Preserving Health Data Sharing Platform</p>
          <p className="mt-1 text-xs text-slate-400">Demo login – choose a role. No password required.</p>
        </div>
        {USERS.map((u) => (
          <button key={u.role} onClick={() => { setUser(u); setTab("Dashboard"); }} className={`${card} text-left transition hover:border-brand-500`}>
            <div className="font-semibold">{u.role}</div><div className="text-sm text-slate-500">{u.name} · {u.desc}</div>
          </button>
        ))}
      </main>
    );
  }

  const tabs = user.role === "Researcher" ? ["Dashboard", "New Request", "Query Builder"] : user.role === "Ethics Reviewer" ? ["Dashboard"] : ["Dashboard"];
  const avgEps = s.qs.length ? s.qs.reduce((a, q) => a + q.eps, 0) / s.qs.length : 0;

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/90 backdrop-blur dark:border-slate-800 dark:bg-slate-900/90">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-2 p-4">
          <div className="font-bold">🛡️ PPHDSP <span className="ml-2 rounded-full bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-700">{user.role}</span></div>
          <div className="flex items-center gap-2 text-sm">
            <span className="hidden text-slate-500 sm:inline">{user.name}</span>
            <button onClick={() => setDark(!dark)} className="rounded-lg border px-3 py-1 dark:border-slate-700">{dark ? "☀️" : "🌙"}</button>
            <button onClick={() => setUser(null)} className="rounded-lg border px-3 py-1 dark:border-slate-700">Log out</button>
          </div>
        </div>
        {tabs.length > 1 && (
          <nav className="mx-auto flex max-w-5xl gap-1 px-4">
            {tabs.map((t) => (<button key={t} onClick={() => setTab(t)} className={`border-b-2 px-3 py-2 text-sm ${tab === t ? "border-brand-600 font-semibold text-brand-700" : "border-transparent text-slate-500"}`}>{t}</button>))}
          </nav>
        )}
      </header>

      <main className="mx-auto max-w-5xl space-y-6 p-4 sm:p-6">
        {user.role === "Researcher" && tab === "Dashboard" && (<>
          <div className="flex items-center justify-between"><h2 className="text-xl font-semibold">My Research Projects</h2>
            <div className="flex gap-2"><button className={btn} onClick={() => setTab("New Request")}>+ New Data Access Request</button><button className={btn} onClick={() => setTab("Query Builder")}>Run Query</button></div></div>
          <div className="grid gap-4 sm:grid-cols-2">{approved.map((p) => (<div key={p.id} className={`${card} space-y-3`}><div className="font-medium">{p.name}</div><Budget p={p} /></div>))}</div>
          <div className={card}><h3 className="mb-3 font-semibold">Access Requests</h3>
            {s.reqs.map((r) => (<div key={r.id} className="flex justify-between border-t py-2 text-sm first:border-0 dark:border-slate-800"><span>{r.title}</span><span className={r.status === "Approved" ? "text-emerald-600" : r.status === "Rejected" ? "text-red-600" : "text-amber-600"}>{r.status}{r.note ? ` – ${r.note}` : ""}</span></div>))}</div>
        </>)}

        {user.role === "Researcher" && tab === "New Request" && (
          <div className={`${card} space-y-4`}><h2 className="text-xl font-semibold">Data Access Request</h2>
            <input className={input} placeholder="Project title" value={rq.title} onChange={(e) => setRq({ ...rq, title: e.target.value })} />
            <textarea className={input} rows={4} placeholder="Research purpose" value={rq.purpose} onChange={(e) => setRq({ ...rq, purpose: e.target.value })} />
            <div><div className="mb-1 text-sm font-medium">Data attributes</div><div className="flex flex-wrap gap-3 text-sm">{ATTRS.map((a) => (<label key={a} className="flex items-center gap-1"><input type="checkbox" checked={rq.attrs.includes(a)} onChange={() => setRq({ ...rq, attrs: toggle(rq.attrs, a) })} />{a}</label>))}</div></div>
            <div><div className="mb-1 text-sm font-medium">Query types</div><div className="flex gap-3 text-sm">{["Count", "Mean", "Proportion"].map((a) => (<label key={a} className="flex items-center gap-1"><input type="checkbox" checked={rq.types.includes(a)} onChange={() => setRq({ ...rq, types: toggle(rq.types, a) })} />{a}</label>))}</div></div>
            <button className={btn} disabled={!rq.title || !rq.purpose || !rq.attrs.length || !rq.types.length} onClick={submitReq}>Submit request</button></div>
        )}

        {user.role === "Researcher" && tab === "Query Builder" && proj && (
          <div className="grid gap-6 lg:grid-cols-2">
            <div className={`${card} space-y-4`}><h2 className="text-xl font-semibold">Query Builder</h2>
              <select className={input} value={proj.id} onChange={(e) => setPid(e.target.value)}>{approved.map((p) => (<option key={p.id} value={p.id}>{p.name}</option>))}</select>
              <Budget p={proj} />
              <div className="flex gap-2">{(["Count", "Mean", "Proportion"] as QType[]).map((t) => (<button key={t} onClick={() => setType(t)} className={`flex-1 rounded-lg border px-2 py-2 text-sm dark:border-slate-700 ${type === t ? "border-brand-600 bg-brand-50 font-semibold text-brand-700" : ""}`}>{t}</button>))}</div>
              <p className="text-xs text-slate-500">{type === "Count" ? "Number of matching patients" : type === "Mean" ? "Average length of stay (days)" : "% of matching patients who recovered"}</p>
              <div className="grid grid-cols-3 gap-2">
                <select className={input} value={f.diagnosis} onChange={(e) => setF({ ...f, diagnosis: e.target.value })}><option value="">Any diagnosis</option>{DIAG.map((x) => (<option key={x}>{x}</option>))}</select>
                <select className={input} value={f.state} onChange={(e) => setF({ ...f, state: e.target.value })}><option value="">Any state</option>{STATES.map((x) => (<option key={x}>{x}</option>))}</select>
                <select className={input} value={f.age} onChange={(e) => setF({ ...f, age: e.target.value })}><option value="">Any age</option>{AGES.map((x) => (<option key={x}>{x}</option>))}</select>
              </div>
              <div><div className="flex justify-between text-sm"><span className="font-medium">Epsilon (ε)</span><span className="font-mono">{eps.toFixed(1)}</span></div>
                <input type="range" min={0.1} max={5} step={0.1} value={eps} onChange={(e) => setEps(+e.target.value)} className="w-full accent-emerald-600" />
                <div className="flex justify-between text-xs text-slate-400"><span>More privacy</span><span>More accuracy</span></div></div>
              <div className="rounded-lg bg-slate-100 p-3 text-sm dark:bg-slate-800">Expected error: <b>± {b.toFixed(type === "Count" ? 1 : 2)} {unit}</b> <span className="text-xs text-slate-500">(Laplace scale = sensitivity / ε)</span><br />Cost: <b>{eps.toFixed(1)} ε</b> · Budget after: <b>{Math.max(0, proj.budget - proj.used - eps).toFixed(1)}</b></div>
              {err && <p className="text-sm text-red-600">{err}</p>}
              <button className={btn + " w-full"} onClick={run}>Run private query</button>
              <Tip label="What is ε (epsilon)?" text="ε controls the privacy–accuracy trade-off. Smaller ε adds more noise (stronger privacy). Every query spends ε from the project's budget; when it runs out, no more queries are allowed." />
              <Tip label="What is Differential Privacy?" text="A mathematical guarantee that a query's result barely changes whether or not any single patient is in the dataset, achieved by adding calibrated random noise." />
            </div>
            <div className={`${card} space-y-4`}><h2 className="text-xl font-semibold">Result</h2>
              {res ? (<>
                <div className="grid grid-cols-2 gap-3 text-center">
                  <div className="rounded-xl bg-emerald-50 p-4 dark:bg-slate-800"><div className="text-xs text-slate-500">Noisy result (released)</div><div className="text-3xl font-bold text-brand-700">{res.type === "Count" ? res.noisy : res.noisy.toFixed(2)}</div></div>
                  <div className="rounded-xl border border-dashed p-4 dark:border-slate-700"><div className="text-xs text-slate-500">True value (demo only)</div><div className="text-3xl font-bold text-slate-400">{res.type === "Count" ? res.truth : res.truth.toFixed(2)}</div></div>
                </div>
                <p className="text-sm text-slate-500">Absolute error: {Math.abs(res.noisy - res.truth).toFixed(2)} · ε used: {res.eps.toFixed(1)}</p>
                <button className={btn} onClick={csv}>Export CSV</button></>) : <p className="text-sm text-slate-500">Run a query to see the differentially private result.</p>}
              <div><h3 className="mb-2 text-sm font-semibold">Budget usage history</h3>
                {s.qs.slice(0, 6).map((q) => (<div key={q.id} className="flex items-center gap-2 py-1 text-xs"><span className="w-24 truncate text-slate-500">{q.t}</span><div className="h-2 rounded bg-brand-500" style={{ width: `${q.eps * 12}px` }} /><span>{q.eps.toFixed(1)} ε · {q.type}</span></div>))}</div>
            </div>
          </div>
        )}

        {user.role === "Ethics Reviewer" && (<>
          <h2 className="text-xl font-semibold">Access Requests</h2>
          {s.reqs.map((r) => (
            <div key={r.id} className={`${card} space-y-2`}>
              <div className="flex justify-between"><b>{r.title}</b><span className="text-sm">{r.status}</span></div>
              <p className="text-sm text-slate-600 dark:text-slate-300">{r.purpose}</p>
              <p className="text-xs text-slate-500">Attributes: {r.attrs.join(", ")} · Queries: {r.types.join(", ")}</p>
              {r.status === "Pending" ? (<div className="flex flex-wrap gap-2"><input className={input + " flex-1"} placeholder="Review note" value={notes[r.id] ?? ""} onChange={(e) => setNotes({ ...notes, [r.id]: e.target.value })} />
                <button className={btn} onClick={() => review(r, true, notes[r.id] ?? "")}>Approve</button>
                <button className="rounded-lg bg-red-600 px-4 py-2 text-sm text-white" onClick={() => review(r, false, notes[r.id] ?? "")}>Reject</button></div>) : r.note && <p className="text-xs italic">Note: {r.note}</p>}
            </div>))}
        </>)}

        {user.role === "System Admin" && (<>
          <h2 className="text-xl font-semibold">Platform Overview</h2>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {[["Total records", RECORDS.length.toLocaleString()], ["Active projects", s.projects.length], ["Queries run", s.qs.length], ["Average ε used", avgEps.toFixed(2)]].map(([k, v]) => (<div key={k as string} className={card}><div className="text-xs text-slate-500">{k}</div><div className="text-2xl font-bold">{v}</div></div>))}
          </div>
          <div className={card}><h3 className="mb-3 font-semibold">Audit log (last 10)</h3>
            {s.log.slice(0, 10).map((l, i) => (<div key={i} className="flex flex-wrap gap-x-3 border-t py-2 text-sm first:border-0 dark:border-slate-800"><span className="text-xs text-slate-400">{l.t}</span><b>{l.who}</b><span>{l.what}</span></div>))}</div>
          <button className="text-sm text-red-600 underline" onClick={() => { localStorage.removeItem("pphdsp"); setS(SEED); }}>Reset demo data</button>
        </>)}
      </main>
    </div>
  );
}
