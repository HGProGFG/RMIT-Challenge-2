"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import type { DecryptResult, Exam, GovernanceObservation, Role, SessionResponse, SignedPolicy } from "../lib/contracts";
import { MAX_PLAINTEXT_BYTES } from "../lib/contracts";
import { api, mutation, safeError } from "../lib/client/api";
import { resumableExam, scheduleInput } from "../lib/client/exams";
import { getBrowserTide } from "../lib/tide/browser/adapter";
import { useVaultSession } from "../providers/vault-session";
import { Icon, type IconName } from "./icon";
import { hasVerifiedRole } from "../lib/roles";
import { SimulationPanel } from "./simulation-panel";

export type View = "vault" | "upload" | "detail" | "signin" | "attacks" | "governance" | "activity";
const previewId = "00000000-0000-4000-8000-000000000001";
const sampleExam: Exam = { id: previewId, runId: previewId, title: "Foundations of Computer Science", authorIssuer: "preview", authorSubject: "Synthetic author", authorAlias: "Synthetic author", advisoryReleaseAt: "2026-10-23T02:00:00Z", createdAt: "2026-10-22T02:00:00Z", sealedAt: null, contentType: "text/plain;charset=utf-8", state: "PREPARED", ciphertextSha256: null, byteLength: null, version: 1 };
const nav: { name: string; href: string; icon: IconName; view: View }[] = [
  { name: "Exam vault", href: "/vault", icon: "grid", view: "vault" },
  { name: "Governance", href: "/governance", icon: "users", view: "governance" },
  { name: "Activity", href: "/activity", icon: "activity", view: "activity" },
  { name: "Admin attack panel", href: "/administration/attacks", icon: "shield", view: "attacks" },
];
export function Badge({ children, tone = "neutral", dot = false }: { children: ReactNode; tone?: string; dot?: boolean }) {
  return <span className={`badge badge-${tone}`}>{dot && <span className="status-dot"/>}{children}</span>;
}
function Button({ children, icon, onClick, disabled, variant = "primary", type = "button", title }: { children: ReactNode; icon?: IconName; onClick?: () => void; disabled?: boolean; variant?: string; type?: "button" | "submit"; title?: string }) {
  return <button type={type} className={`button button-${variant}`} onClick={onClick} disabled={disabled} title={title}>{icon && <Icon name={icon} size={17}/>} {children}</button>;
}
function PageHeading({ eyebrow, title, description, action }: { eyebrow?: string; title: string; description: string; action?: ReactNode }) {
  return <div className="page-heading"><div>{eyebrow && <div className="eyebrow">{eyebrow}</div>}<h1>{title}</h1><p>{description}</p></div>{action && <div className="heading-action">{action}</div>}</div>;
}
function Empty({ icon = "lock", title, children }: { icon?: IconName; title: string; children: ReactNode }) {
  return <div className="empty-state"><div className="empty-icon"><Icon name={icon} size={25}/></div><h3>{title}</h3><p>{children}</p></div>;
}
function Notice({ children, tone = "info" }: { children: ReactNode; tone?: string }) {
  return <div className={`notice notice-${tone}`} role={tone === "error" ? "alert" : "status"}><Icon name="info" size={18}/><div>{children}</div></div>;
}
function date(value: string | null, compact = false) {
  if (!value) return "Not yet sealed";
  // Fixed punctuation keeps server and browser ICU versions from changing hydration text.
  const local = new Date(Date.parse(value) + 7 * 60 * 60 * 1000);
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const two = (n: number) => String(n).padStart(2, "0");
  return `${two(local.getUTCDate())} ${months[local.getUTCMonth()]}${compact ? "" : ` ${local.getUTCFullYear()}`}, ${two(local.getUTCHours())}:${two(local.getUTCMinutes())} ICT`;
}
function useExams() {
  const { session } = useVaultSession();
  const [exams, setExams] = useState<Exam[]>([]), [loading, setLoading] = useState(false), [error, setError] = useState("");
  async function load() {
    if (!session) { setExams([]); return; }
    setLoading(true); setError("");
    try { setExams((await api<{ exams: Exam[] }>("/api/exams")).exams); } catch (e) { setError(safeError(e)); } finally { setLoading(false); }
  }
  useEffect(() => { let alive = true; if (!session) { setExams([]); setError(""); return; } setExams([]); setError(""); setLoading(true); api<{ exams: Exam[] }>("/api/exams").then(v => { if (alive) setExams(v.exams); }).catch(e => { if (alive) setError(safeError(e)); }).finally(() => { if (alive) setLoading(false); }); return () => { alive = false; }; }, [session]);
  return { exams: session ? exams : [sampleExam], loading, error, load };
}

export function VaultApp({ view, examId }: { view: View; examId?: string }) {
  const { session, loading, notice, preview, logout, simulation } = useVaultSession();
  const protectedReady = session?.readiness.tide === "ready";
  const [mobileMenu, setMobileMenu] = useState(false), [help, setHelp] = useState(false);
  const pathname = usePathname();
  useEffect(() => { setMobileMenu(false); }, [pathname]);
  return <div className="app-shell">
    <a className="skip-link" href="#main">Skip to content</a>
    <aside className={`sidebar ${mobileMenu ? "sidebar-open" : ""}`}>
      <Link href="/vault" className="brand" aria-label="Sealed home" title="Sealed · Exam workspace"><span className="brand-symbol"><Icon name="vault" size={23}/></span><span className="brand-wordmark">Sealed</span></Link>
      <nav aria-label="Main navigation">{nav.map(n => <Link key={n.view} href={n.href} aria-label={n.name} title={n.name} aria-current={(view === n.view || (n.view === "vault" && ["detail", "upload"].includes(view))) ? "page" : undefined} className={`nav-item ${(view === n.view || (n.view === "vault" && ["detail", "upload"].includes(view))) ? "active" : ""}`}><Icon name={n.icon} size={19}/><span className="rail-label">{n.name}</span></Link>)}</nav>
      <div className="sidebar-bottom"><button className="icon-button rail-help" aria-label="How Sealed works" title="How Sealed works" onClick={() => setHelp(true)}><Icon name="info" size={19}/></button><Link href="/vault/new" className="rail-create" aria-label="Create a new exam" title="Create a new exam"><Icon name="plus" size={20}/></Link></div>
    </aside>
    {mobileMenu && <button className="sidebar-scrim" aria-label="Close navigation" onClick={() => setMobileMenu(false)}/>}
    <div className="app-body"><header className="topbar">
      <button className="icon-button mobile-toggle" aria-label="Toggle navigation" aria-expanded={mobileMenu} onClick={() => setMobileMenu(!mobileMenu)}><Icon name="menu"/></button>
      <nav className="top-navigation" aria-label="Workspace sections">{nav.map(n => <Link href={n.href} key={n.view} className={(view === n.view || (n.view === "vault" && ["detail", "upload"].includes(view))) ? "active" : ""}>{n.view === "vault" ? "Overview" : n.view === "attacks" ? "Admin tests" : n.name}</Link>)}</nav>
      <div className="topbar-right"><Link href="/vault#exam-search" className="global-search" onClick={view === "vault" ? event => { event.preventDefault(); document.getElementById("exam-search")?.focus(); } : undefined}><Icon name="search" size={15}/><span>Find an exam…</span></Link>
        <Link href="/vault/new" className="button button-secondary topbar-create"><Icon name="plus" size={15}/>New exam</Link>
        <Link className="profile-link" href="/sign-in" title={session?.identity.alias ?? "Connect your Tide identity"} aria-label={session ? `Account: ${session.identity.alias}` : "Connect your Tide identity"}><span className="avatar">{session ? session.identity.alias.slice(0, 2).toUpperCase() : <Icon name="users" size={16}/>}</span></Link>{session && <button aria-label="Sign out" className="icon-button" onClick={() => void logout()}><Icon name="logout" size={17}/></button>}
      </div></header>
      <main id="main" className="main-content"><div className={`mode-strip ${protectedReady ? "mode-live" : "mode-preview"}`}><span><span className="status-dot"/>{simulation ? "PLAN C · LOCAL SIMULATION" : preview ? "WORKSPACE PREVIEW" : protectedReady ? "AUTHENTICATED WORKSPACE" : "PROTECTED OPERATIONS UNAVAILABLE"}</span><p>{simulation ? "Synthetic sign-in, roles, access and approvals · Local demo keys · No live Tide security claim" : preview ? "Sample metadata only. Tide authentication and protected operations are not connected." : protectedReady ? "Manual governance release · Synthetic content · Schedule is advisory" : "Verified identity · Tide integration is not fully configured or verified"}</p>{preview && <Link href="/sign-in">Connect identity <Icon name="arrow" size={14}/></Link>}</div>
        {loading && <div className="loading-line" role="status" aria-label="Verifying session"/>}
        <SimulationPanel/>{notice && <Notice>{notice}</Notice>}

        {view === "vault" && <VaultView/>}{view === "upload" && <UploadView/>}{view === "detail" && <DetailView examId={examId ?? previewId}/>}{view === "signin" && <SignInView/>}{view === "attacks" && <AttacksView/>}{view === "governance" && <GovernanceView/>}{view === "activity" && <ActivityView/>}
        <footer className="page-footer"><span><Icon name="shield" size={13}/> {simulation ? "Synthetic content. Simulated protection." : "Synthetic content. Real security boundaries."}</span><span>Sealed Exam Vault <span className="footer-separator">/</span> UNLOCKED Challenge 2</span></footer>
      </main>
    </div>
    {help && <HelpDialog close={() => setHelp(false)}/>}
  </div>;
}
function VaultView() {
  const { preview, session, simulation } = useVaultSession(), { exams, loading, error, load } = useExams();
  const [search, setSearch] = useState(""), [filter, setFilter] = useState("all");
  const shown = exams.filter(e => e.title.toLowerCase().includes(search.toLowerCase()) && (filter === "all" || e.state === filter));
  const sealedCount = preview ? 0 : exams.filter(exam => exam.state === "SEALED").length;
  const steps: { title: string; caption: string; icon: IconName; height: number }[] = [
    { title: "Prepare", caption: "Exam author", icon: "file", height: 154 },
    { title: "Seal", caption: "Browser encryption", icon: "lock", height: 112 },
    { title: "Approve", caption: simulation ? "Synthetic governors" : "Independent governors", icon: "users", height: 194 },
    { title: "Open", caption: simulation ? "Simulated invigilator" : "Verified invigilator", icon: "key", height: 140 },
  ];
  useEffect(() => { if (window.location.hash === "#exam-search") document.getElementById("exam-search")?.focus(); }, []);
  return <>
    <PageHeading title="Overview" description="Your examination workspace, at a glance." action={<><span className="workspace-context"><Icon name="clock" size={15}/>Manual release</span><Link href="/vault/new" className="button button-primary"><Icon name="plus" size={16}/>New exam</Link></>}/>
    <div className="overview-grid">
      <div className="overview-main">
        <div className="stats-grid">
          <div className="stat-card"><span className="stat-label">{preview ? "Sample papers" : "Exam papers"}</span><div className="stat-value">{exams.length}<span className="metric-context">{preview ? "preview" : "in vault"}</span></div><span className="stat-description">{preview ? "Example metadata only" : "In the active workspace"}</span></div>
          <div className="stat-card"><span className="stat-label">Approval threshold</span><div className="stat-value">2<span className="metric-denominator">/ 3</span></div><span className="stat-description">{simulation ? "Simulated local quorum" : "Intended governance policy"}</span></div>
          <div className="stat-card"><span className="stat-label">Encrypted papers</span><div className="stat-value">{sealedCount}<span className="metric-context">stored</span></div><span className="stat-description">{preview ? "No ciphertext in preview" : "Sealed in this workspace"}</span></div>
        </div>
        <section className="lifecycle-panel" aria-labelledby="lifecycle-title">
          <div className="panel-heading"><div><h2 id="lifecycle-title">A paper's path</h2><p>Four steps. Separate responsibilities.</p></div><span className="subtle-label"><span className="status-dot"/>Workflow guide</span></div>
          <div className="lifecycle-scene">
            <div className="lifecycle-callout"><span className="callout-line"/><div><strong>A shared decision</strong><small>{simulation ? "2 of 3 synthetic governors" : "2 of 3 governors · target policy"}</small></div><span className="callout-people" aria-hidden="true"><i>G1</i><i>G2</i><i>G3</i></span></div>
            <ol className="lifecycle-stages">{steps.map((step, index) => <li key={step.title}><div className={`stage-tile stage-${index + 1}`} style={{ height: step.height }}><span className="stage-number">0{index + 1}</span><Icon name={step.icon} size={24}/><strong>{step.title}</strong></div><span className="stage-caption">{step.caption}</span></li>)}</ol>
          </div>
          <div className="lifecycle-footer"><span>Workflow illustration · live progress is not shown</span><Link href="/governance">How access works <Icon name="arrow" size={14}/></Link></div>
        </section>
        <section className="exam-panel" aria-label="Exam papers">
          <div className="panel-heading"><div className="paper-section-title"><h2>Exam papers</h2><span className="count-bubble">{exams.length}</span>{preview && <Badge>Sample metadata</Badge>}</div><button className="icon-button" aria-label="Refresh exam list" disabled={preview || loading} onClick={() => void load()}><Icon name="refresh" size={16}/></button></div>
          <div className="table-toolbar"><label className="search-field"><Icon name="search" size={15}/><input id="exam-search" placeholder="Search papers…" aria-label="Search exam papers" value={search} onChange={e => setSearch(e.target.value)}/></label><select className="filter-select" aria-label="Filter exams by status" value={filter} onChange={e => setFilter(e.target.value)}><option value="all">All statuses</option><option value="SEALED">Sealed</option><option value="PREPARED">Awaiting seal</option></select></div>
          {error && <div className="panel-inset"><Notice tone="error">{error}</Notice></div>}
          {loading ? <div className="skeleton-card" aria-label="Loading exams"/> : shown.length ? <div className="exam-table-wrap"><table className="exam-table"><thead><tr><th>Paper</th><th>Status</th><th className="schedule-column">Advisory release</th><th><span className="visually-hidden">Open details</span></th></tr></thead><tbody>{shown.map(exam => <tr key={exam.id}><td><Link href={`/vault/${exam.id}`} className="paper-title"><span className="paper-row-icon"><Icon name="file" size={17}/></span><span><strong>{exam.title}</strong><small>{preview ? "Synthetic example · UTF-8 text" : `${exam.id.slice(0, 8)} · UTF-8 text`}</small></span></Link></td><td><Badge tone={exam.state === "SEALED" && !preview ? "green" : "neutral"} dot>{preview ? "Preview" : exam.state === "SEALED" ? "Sealed" : "Awaiting seal"}</Badge></td><td className="schedule-column">{date(exam.advisoryReleaseAt, true)}</td><td><Link href={`/vault/${exam.id}`} className="paper-open" aria-label={`View ${exam.title}`}><Icon name="arrow" size={16}/></Link></td></tr>)}</tbody></table></div> : <Empty icon="search" title={search ? "No matching papers" : "Your vault is ready"}>{search ? "Try another title or change the status filter." : "Create a synthetic exam to begin."}</Empty>}
          <div className="panel-bottom-note"><Icon name="info" size={14}/>The schedule is advisory. Release requires governance approval.</div>
        </section>
      </div>
      <aside className="overview-aside">
        <div className="start-panel"><span className="start-mark"><Icon name="plus" size={18}/></span><h2>A new paper starts here.</h2><p>Prepare a synthetic exam, then seal it in your browser.</p><Link href="/vault/new" className="button button-primary">Create an exam <Icon name="arrow" size={15}/></Link></div>
        <div className="workspace-actions"><h3>YOUR WORKSPACE</h3>
          <Link href="/sign-in" className="workspace-action"><span className="action-icon"><Icon name="users" size={18}/></span><span><strong>{simulation ? "Simulated identity" : "Tide identity"}</strong><small>A separate session for each role</small></span><span className={`action-tag ${session ? "tag-connected" : ""}`}>{session ? simulation ? "Simulated" : "Verified" : "Connect"}</span></Link>
          <Link href="/vault/new" className="workspace-action"><span className="action-icon"><Icon name="file" size={18}/></span><span><strong>Prepare a paper</strong><small>Write or import synthetic text</small></span><Icon name="chevron" size={13}/></Link>
          <Link href="/governance" className="workspace-action"><span className="action-icon"><Icon name="shield" size={18}/></span><span><strong>Governance</strong><small>Review requests independently</small></span><span className="action-tag">Review</span></Link>
          <Link href={exams[0] ? `/vault/${exams[0].id}` : "/vault"} className="workspace-action"><span className="action-icon"><Icon name="key" size={18}/></span><span><strong>Open a paper</strong><small>Use the invigilator's identity</small></span><Icon name="chevron" size={13}/></Link>
          <Link href="/activity" className="workspace-action"><span className="action-icon"><Icon name="activity" size={18}/></span><span><strong>Workspace activity</strong><small>Attempts, approvals and evidence</small></span><Icon name="chevron" size={13}/></Link>
        </div>
        <div className="boundary-summary"><div className="boundary-summary-heading"><span><Icon name="lock" size={15}/>Protected operations</span><Badge tone={session?.readiness.tide === "ready" ? "green" : "neutral"} dot>{simulation ? "Simulated" : session?.readiness.tide === "ready" ? "Configured" : "Not connected"}</Badge></div><p>{simulation ? "Local sign-in, roles and access decisions are simulated. The demo server holds the encryption keys; no live Tide enforcement is claimed." : preview ? "Explore the workspace with sample metadata. Real sign-in and network enforcement still need to be connected." : "Configuration status does not prove enforcement. Inspect session evidence and test the live Tide boundary."}</p><Link href="/administration/attacks">Inspect security boundaries <Icon name="arrow" size={14}/></Link></div>
        <div className="overview-footnote"><span className="tide-mark">≋</span><span>Built with TideCloak<small>Shared authority. Clear boundaries.</small></span></div>
      </aside>
    </div>
  </>;
}

function SignInView() {
  const { session } = useVaultSession();
  return <><PageHeading title="Plan C demo accounts" description="Choose an account in the panel above. No Tide realm, license or password is required."/>
    <section className="panel panel-inset"><h2>Try the complete workflow</h2><p>Exam author seals a synthetic paper. Teacher and administrator are refused access. Two different governors approve release, then the invigilator opens it.</p>
    <Notice>{session ? <>Active account: <strong>{session.identity.alias}</strong>. Use the account selector above to change responsibility.</> : "Choose Exam author above and click Switch simulated identity to begin."}</Notice>
    <Link className="button button-primary" href={session?.identity.subject === "author" ? "/vault/new" : "/vault"}>{session?.identity.subject === "author" ? "Create a synthetic exam" : "Open the vault"}</Link></section></>;
}

function UploadView() {
  const { session, loading: sessionLoading, notify, simulation, login, logout } = useVaultSession();
  const [title, setTitle] = useState(""), [text, setText] = useState(""), [schedule, setSchedule] = useState("2026-10-23T09:00"), [synthetic, setSynthetic] = useState(false);
  const [exam, setExam] = useState<Exam | null>(null), [busy, setBusy] = useState(false), [step, setStep] = useState(""), [error, setError] = useState("");
  const [checkingExam, setCheckingExam] = useState(false), [resumeError, setResumeError] = useState("");
  const preparedKey = useRef<string | null>(null), sealKey = useRef<string | null>(null), encrypted = useRef<{ ciphertextBase64: string; writePolicyId: string } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null), epoch = useRef(0);
  const bytes = new TextEncoder().encode(text).length, isAuthor = !!session?.identity.realmRoles.includes("author");
  useEffect(() => { const clear = () => { ++epoch.current; setText(""); encrypted.current = null; }; window.addEventListener("vault:clear-plaintext", clear); return () => { clear(); window.removeEventListener("vault:clear-plaintext", clear); }; }, []);
  useEffect(() => {
    const current = ++epoch.current;
    setText(""); encrypted.current = null; preparedKey.current = null; sealKey.current = null;
    setExam(null); setTitle(""); setStep(""); setError(""); setResumeError(""); setSynthetic(false); setCheckingExam(false); setBusy(false);
    if (!session?.identity.realmRoles.includes("author")) return;
    if (!session.activeRunId) { setResumeError("A demo run must be prepared by the examination operator before you can seal a paper."); return; }
    setCheckingExam(true);
    api<{ exams: Exam[] }>("/api/exams").then(value => {
      if (current !== epoch.current) return;
      const existing = resumableExam(value.exams, session.identity);
      if (existing) { setExam(existing); setTitle(existing.title); setSchedule(scheduleInput(existing.advisoryReleaseAt));
        setStep(existing.state === "SEALED" ? "This run already has its sealed paper." : "Resuming the prepared paper. Re-enter its synthetic source text to finish sealing."); }
    }).catch(e => { if (current === epoch.current) setResumeError(e instanceof Error && e.message === "RUN_OWNED_BY_ANOTHER_AUTHOR"
      ? "This run already contains another author's paper. Contact the examination operator." : safeError(e)); })
      .finally(() => { if (current === epoch.current) setCheckingExam(false); });
    return () => { ++epoch.current; };
  }, [session]);
  async function readFile(file?: File) {
    if (!file) return; const current = epoch.current; setError("");
    if (!file.name.toLowerCase().endsWith(".txt") || file.size > MAX_PLAINTEXT_BYTES) { setError("Choose a UTF-8 .txt file of 16 KiB or less."); return; }
    try { const value = new TextDecoder("utf-8", { fatal: true }).decode(await file.arrayBuffer()); if (current !== epoch.current) return; setText(value); } catch { if (current === epoch.current) setError("This file is not valid UTF-8 text."); }
  }
  async function seal() {
    setError("");
    if (!isAuthor) { setError("Select Exam author in the Plan C account panel before sealing a paper."); return; }
    if (checkingExam || resumeError || !session?.activeRunId) { setError(resumeError || "The active paper has not been verified yet. Refresh session evidence and try again."); return; }
    if (!title.trim() || !text.trim() || bytes > MAX_PLAINTEXT_BYTES || !synthetic || !schedule) { setError("Add a title, valid schedule and synthetic text of 16 KiB or less, then confirm the content is synthetic."); return; }
    const current = epoch.current;
    setBusy(true);
    try {
      let prepared = exam;
      if (!prepared) { setStep("Preparing exam…"); preparedKey.current ??= crypto.randomUUID(); const result = await api<{ exam: Exam }>("/api/exams/prepare", mutation({ title: title.trim(), advisoryReleaseAt: new Date(`${schedule}:00+07:00`).toISOString() }, preparedKey.current)); prepared = result.exam; if (current !== epoch.current) return; setExam(prepared); }
      if (!encrypted.current) {
        setStep("Checking signed policies…");
        const [write] = await Promise.all([api<{ policy: SignedPolicy }>(`/api/exams/${prepared.id}/policy?purpose=WRITE`), api<{ policy: SignedPolicy }>(`/api/exams/${prepared.id}/policy?purpose=READ`)]);
        if (current !== epoch.current) return;
        setStep("Encrypting in this browser…"); const ciphertextBase64 = await getBrowserTide().encrypt({ examId: prepared.id, plaintext: text, policy: write.policy });
        if (current !== epoch.current) return;
        encrypted.current = { ciphertextBase64, writePolicyId: write.policy.id };
      }
      setStep("Saving encrypted paper…"); sealKey.current ??= crypto.randomUUID();
      const result = await api<{ exam: Exam }>(`/api/exams/${prepared.id}/seal`, mutation({ ...encrypted.current, contentType: "text/plain;charset=utf-8", expectedVersion: 1 }, sealKey.current));
      if (current !== epoch.current) return; setExam(result.exam); setText(""); encrypted.current = null; setStep("Sealed. Only ciphertext was sent to storage."); notify("Synthetic paper sealed successfully. Plaintext has been cleared from this form.");
    } catch (e) { if (current === epoch.current) { setError(safeError(e)); setStep(""); } } finally { if (current === epoch.current) setBusy(false); }
  }
  return <><PageHeading title="Seal a new exam" description="Prepare your paper here. Encryption happens before it reaches storage." action={<Link className="button button-secondary" href="/vault">Back to vault</Link>}/>{!isAuthor && <Notice>{sessionLoading ? "Loading your demo account…" : <>Current account: {session?.identity.alias ?? "none"}. Select Exam author before entering a paper. <Button disabled={sessionLoading} onClick={() => void (async () => { await logout(); await login("author"); })()}>Use Exam author</Button></>}</Notice>}<div className="upload-layout"><section className="panel upload-panel"><div className="step-header"><span className="step-number">01</span><div><h2>Paper details</h2><p>Use synthetic content only.</p></div><Badge tone="purple">Text paper</Badge></div><div className="form-fields"><label>Exam title<input maxLength={120} placeholder="e.g. Foundations of Computer Science" value={title} disabled={!!exam || busy} onChange={e => setTitle(e.target.value)}/></label><div className="form-row"><label>Scheduled release<input type="datetime-local" value={schedule} disabled={!!exam || busy} onChange={e => setSchedule(e.target.value)}/><small>Vietnam time · UTC+7 · Advisory only</small></label><div className="release-method"><span>Release method</span><div><Icon name="users" size={18}/>Manual governance approval</div><small>{simulation ? "2 of 3 synthetic governor accounts required" : "2 of 3 independent approvers required"}</small></div></div></div><div className="form-divider"/><div className="step-header"><span className="step-number">02</span><div><h2>Exam content</h2><p>Plain text, maximum 16 KiB.</p></div><span className={`byte-count ${bytes > MAX_PLAINTEXT_BYTES ? "over-limit" : ""}`}>{bytes.toLocaleString()} / 16,384 bytes</span></div><div className="form-fields"><input ref={inputRef} type="file" accept=".txt,text/plain" className="visually-hidden" aria-label="Import synthetic text exam" onChange={e => { void readFile(e.target.files?.[0]); e.target.value = ""; }}/><button className="dropzone" disabled={busy || !!encrypted.current || exam?.state === "SEALED"} onClick={() => inputRef.current?.click()} onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); if (!busy && !encrypted.current && exam?.state !== "SEALED") void readFile(e.dataTransfer.files[0]); }}><span className="upload-icon"><Icon name="upload" size={22}/></span><strong>Click to upload or drag a text file</strong><span>UTF-8 .txt · Up to 16 KiB · Read locally</span></button><div className="editor-label"><label htmlFor="exam-content">Or write your synthetic exam</label><button className="text-link" disabled={busy || !!encrypted.current || exam?.state === "SEALED"} onClick={() => setText("SYNTHETIC EXAM — DEMONSTRATION ONLY\n\n1. Explain the difference between a stack and a queue.\n2. Write pseudocode for a binary search.\n3. Describe one benefit of independent access approvals.")}>Use sample text</button></div><textarea autoComplete="off" spellCheck={false} id="exam-content" value={text} onChange={e => setText(e.target.value)} disabled={busy || !!encrypted.current || exam?.state === "SEALED"} placeholder="Your synthetic exam stays in this browser until you encrypt it…" rows={9}/><label className="checkbox-field"><input type="checkbox" checked={synthetic} disabled={busy} onChange={e => setSynthetic(e.target.checked)}/><span>I confirm this paper contains synthetic content and no student data.</span></label>{exam && <p className="fine-print">Exam ID: <code>{exam.id}</code>. {exam.state === "PREPARED" ? "Awaiting verified signed policies." : "Sealed."}</p>}{resumeError && <Notice tone="error">{resumeError}</Notice>}{error && <Notice tone="error">{error}</Notice>}{step && <Notice tone={exam?.state === "SEALED" ? "success" : "info"}>{step}</Notice>}<div className="form-actions"><span><Icon name="lock" size={15}/>Only encrypted bytes are uploaded.</span>{exam?.state === "SEALED" ? <Link href={`/vault/${exam.id}`} className="button button-primary">View sealed exam <Icon name="arrow" size={16}/></Link> : <Button icon="lock" disabled={!isAuthor || sessionLoading || busy || checkingExam || !!resumeError || !synthetic || bytes === 0 || bytes > MAX_PLAINTEXT_BYTES} onClick={() => void seal()}>{checkingExam ? "Checking current paper…" : busy ? step : "Encrypt and seal"}</Button>}</div></div></section><aside className="right-stack"><section className="panel guidance-panel"><div className="guidance-icon"><Icon name="shield" size={25}/></div><h2>What sealing means</h2><ol className="process-list"><li><span>1</span><div><strong>{simulation ? "Prepare simulated policies" : "Prepare signed policies"}</strong><p>The author gets write access. The invigilator's read policy is prepared separately.</p></div></li><li><span>2</span><div><strong>Encrypt in your browser</strong><p>{simulation ? "Local AES-GCM demonstrates encryption. The demo server holds the key." : "Tide’s real SDK must complete encryption before upload."}</p></div></li><li><span>3</span><div><strong>Store ciphertext only</strong><p>The application never receives your paper's plaintext.</p></div></li></ol></section><div className="quiet-note"><Icon name="info" size={18}/><p>The schedule does not unlock the paper. This prototype uses manual governance release.</p></div></aside></div></>;
}

function DetailView({ examId }: { examId: string }) {
  const { session, preview, simulation } = useVaultSession();
  const [exam, setExam] = useState<Exam | null>(null), [error, setError] = useState(""), [busy, setBusy] = useState(false);
  const [result, setResult] = useState<({ status: "opened"; message: string; plaintext: string } | { status: Exclude<DecryptResult["status"], "opened">; message: string }) | null>(null), [tab, setTab] = useState("overview");
  const epoch = useRef(0);
  useEffect(() => {
    const current = ++epoch.current;
    const clear = () => { ++epoch.current; setResult(null); setBusy(false); };
    window.addEventListener("vault:clear-plaintext", clear);
    setExam(null); setResult(null); setError("");
    if (session) api<{ exam: Exam }>(`/api/exams/${examId}`).then(v => { if (epoch.current === current) setExam(v.exam); }).catch(e => { if (epoch.current === current) setError(safeError(e)); });
    return () => { ++epoch.current; window.removeEventListener("vault:clear-plaintext", clear); };
  }, [examId, session]);
  const shown = preview && examId === previewId ? sampleExam : exam;
  async function open() {
    setError("");
    if (!session) { setResult({ status: "not_ready", message: "Sign in with a verified Tide identity to attempt decryption. Preview contains no encrypted exam." }); return; }
    if (!exam || exam.state !== "SEALED") { setResult({ status: "not_ready", message: "This exam has not been sealed. No decryption was attempted." }); return; }
    const current = epoch.current; setBusy(true); setResult(null);
    try {
      const [stored, policy] = await Promise.all([api<{ ciphertextBase64: string }>(`/api/exams/${examId}/ciphertext`), api<{ policy: SignedPolicy }>(`/api/exams/${examId}/policy?purpose=READ`)]);
      if (current !== epoch.current) return;
      const value = await getBrowserTide().decrypt({ examId, ciphertextBase64: stored.ciphertextBase64, policy: policy.policy });
      if (current !== epoch.current) return;
      if (value.status === "opened") setResult({ status: "opened", message: "Opened in this browser. Authorized recipients can copy this content.", plaintext: value.plaintext });
      else setResult({ status: value.status, message: value.status === "denied" ? simulation ? "Simulated policy denied access. This identity has no released read permission." : "Access denied by Tide. This identity has no protected read authority." : "Opening could not be verified. The paper remains closed." });
      const codes = { opened: "SDK_OPENED", denied: value.status !== "opened" && value.code === "SDK_POLICY_DENIED" ? "SDK_POLICY_DENIED" : "SDK_ROLE_DENIED", not_ready: "POLICY_NOT_READY", unavailable: "NETWORK_UNAVAILABLE", error: "SDK_UNKNOWN" };
      try { await api("/api/activity/client-observations", mutation({ examId, kind: "DECRYPT_ATTEMPT", outcome: value.status, code: codes[value.status], correlationId: crypto.randomUUID() })); } catch { /* A log failure must not change the actual crypto outcome. */ }
    } catch (e) { if (current === epoch.current) setResult({ status: "unavailable", message: safeError(e) }); }
    finally { if (current === epoch.current) setBusy(false); }
  }
  return <><div className="back-link"><Link href="/vault"><Icon name="arrow" size={15} style={{ transform: "rotate(180deg)" }}/>Back to exam vault</Link></div><PageHeading eyebrow="EXAM DETAILS" title={shown?.title ?? "Exam details"} description="The paper is protected separately from its metadata." action={<Badge tone="purple" dot>{preview ? "Sample metadata" : shown?.state === "SEALED" ? "Sealed" : "Awaiting seal"}</Badge>}/>{error && <Notice tone="error">{error}</Notice>}<div className="detail-layout"><section className="panel"><div className="tabs" role="tablist" aria-label="Exam information">{["overview", "access policy"].map(t => <button role="tab" aria-selected={tab === t} key={t} className={tab === t ? "selected" : ""} onClick={() => setTab(t)}>{t === "overview" ? "Overview" : "Access policy"}</button>)}</div>{tab === "overview" ? <><div className="paper-cover"><div className="paper-illustration"><div className="paper-fold"/><span className="paper-stamp"><Icon name="lock" size={26}/></span><div className="paper-lines"><i/><i/><i/></div><span className="paper-classification">CONFIDENTIAL EXAM</span></div><h2>{preview ? "A preview of your sealed workflow" : "Paper content stays closed"}</h2><p>{preview ? "This example shows the layout. There is no stored paper or simulated ciphertext." : simulation ? "Use your simulated identity to test the local access policy." : "Use your verified identity to request a real decryption operation."}</p></div><div className="metadata-grid"><div><span>Scheduled release</span><strong>{date(shown?.advisoryReleaseAt ?? null)}</strong><small>Advisory · manual approval required</small></div><div><span>File format</span><strong>UTF-8 plain text</strong><small>Maximum 16 KiB before encryption</small></div><div><span>Sealed at</span><strong>{date(shown?.sealedAt ?? null)}</strong></div><div><span>Exam identifier</span><code>{shown?.id ?? "Loading…"}</code></div></div></> : <div className="policy-content"><h2>Access follows the policy</h2><p>Read and write permissions are separate. A signed policy and the protected realm role must both permit the operation.</p><div className="policy-row"><Icon name="file"/><div><strong>Author</strong><span>Write-only policy · cannot decrypt through this grant</span></div></div><div className="policy-row"><Icon name="key"/><div><strong>Invigilator</strong><span>Read-only policy · decrypt role granted through governance</span></div></div><div className="policy-row"><Icon name="shield"/><div><strong>Teacher & application administrator</strong><span>Metadata access · no protected read grant</span></div></div><Notice>The real network must verify policy signatures and caller permissions. A local role label does not grant authority.</Notice></div>}</section><aside className="right-stack"><section className="panel open-panel"><span className="open-lock"><Icon name="lock" size={29}/></span><h2>Open the paper</h2><p>Only an authorized invigilator can decrypt after access is released.</p><div className="current-identity"><span>Current identity</span><strong>{session?.identity.alias ?? "Not authenticated"}</strong><Badge>{session ? simulation ? "Simulated session" : "Verified session" : "Preview"}</Badge></div><Button icon="key" disabled={busy || !shown} onClick={() => void open()}>{busy ? "Verifying protected operation…" : "Attempt to open"}</Button><div aria-live="polite">{result && <Notice tone={result.status === "opened" ? "success" : result.status === "denied" ? "error" : "info"}>{result.message}</Notice>}</div><p className="fine-print"><Icon name="info" size={14}/>No automatic time lock or exam-room verification is claimed.</p></section><section className="panel small-panel"><h3>Need to inspect the boundary?</h3><p>The administrator can inspect storage and request a role change. Neither creates a decryption key.</p><Link href="/administration/attacks" className="text-link">Open attack panel <Icon name="arrow" size={15}/></Link></section></aside></div>{session && result?.status === "opened" && <section className="panel plaintext-panel"><div className="panel-heading"><div><h2>Opened in this browser</h2><p>Authorized recipients can copy this content.</p></div><Button variant="secondary" icon="eye" onClick={() => setResult(null)}>Hide paper</Button></div><pre>{result.plaintext}</pre></section>}</>;
}

function AttacksView() {
  const { session, simulation } = useVaultSession(), { exams } = useExams();
  const [id, setId] = useState(""), [busy, setBusy] = useState(""), [results, setResults] = useState<Record<string, string>>({});
  const [stored, setStored] = useState<{ ciphertextBase64: string; sha256: string; byteLength: number } | null>(null);
  const [proposal, setProposal] = useState<GovernanceObservation | null>(null);
  const key = useRef<string | null>(null), epoch = useRef(0);
  const selected = exams.find(e => e.id === id) ?? exams[0];
  useEffect(() => { ++epoch.current; setResults({}); setStored(null); setProposal(null); key.current = null; setBusy(""); }, [selected?.id, session]);
  useEffect(() => () => { ++epoch.current; }, []);
  async function attack(kind: "storage" | "grant" | "role") {
    if (!session) { setResults(r => ({ ...r, [kind]: "Sign in as the application administrator. This preview does not run a simulated attack." })); return; }
    if (!session.identity.realmRoles.includes("app-admin")) { setResults(r => ({ ...r, [kind]: simulation ? "Switch to the simulated application administrator." : "A verified application administrator session is required." })); return; }
    if (!selected) return;
    const current = epoch.current; setBusy(kind);
    try {
      if (kind === "storage") { const value = await api<{ ciphertextBase64: string; sha256: string; byteLength: number }>(`/api/exams/${selected.id}/ciphertext`); if (current !== epoch.current) return; setStored(value); setResults(r => ({ ...r, storage: "Read from the persisted record. This digest is an integrity reference, not a signature." })); }
      if (kind === "grant") { key.current ??= crypto.randomUUID(); const value = await api<{ observation: GovernanceObservation }>(`/api/exams/${selected.id}/access-requests`, mutation({ kind: "SELF_ACCESS" }, key.current)); if (current !== epoch.current) return; setProposal(value.observation); setResults(r => ({ ...r, grant: simulation ? "Simulated self-access request created. It grants no access. A governor can reject it." : "Actual request IDs returned by the Tide bridge. No authority is created by this application row." })); }
      if (kind === "role") { const value = await api<{ authorityChanged: boolean; before: string | null; after: string }>("/api/demo/display-role", { ...mutation({ runId: selected.runId, displayRole: "invigilator" }), method: "PUT" }); if (current !== epoch.current) return; setResults(r => ({ ...r, role: `Display label: ${value.before ?? "unchanged"} → ${value.after}. Protected authority changed: ${value.authorityChanged ? "unexpected — investigate" : "no"}. Use the exam detail to attempt ${simulation ? "simulated" : "real"} decryption with the same identity.` })); }
    } catch (e) { if (current === epoch.current) setResults(r => ({ ...r, [kind]: safeError(e) })); } finally { if (current === epoch.current) setBusy(""); }
  }
  function download() {
    if (!stored) return; const bytes = Uint8Array.from(atob(stored.ciphertextBase64), c => c.charCodeAt(0)); const url = URL.createObjectURL(new Blob([bytes], { type: "application/octet-stream" })); const a = document.createElement("a"); a.href = url; a.download = `${selected?.id ?? "exam"}.ciphertext`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  const cards: { kind: "storage" | "grant" | "role"; icon: IconName; title: string; description: string; action: string; boundary: string }[] = [
    { kind: "storage", icon: "code", title: "Read the database", description: "Full storage access should reveal ciphertext, not the exam paper.", action: "Inspect stored ciphertext", boundary: "Storage access ≠ decryption authority" },
    { kind: "grant", icon: "users", title: "Grant yourself access", description: simulation ? "Request access as the synthetic administrator. The fixed recipient policy refuses it." : "Request the protected invigilator roles using the administrator’s real identity.", action: "Request invigilator access", boundary: "A request is not a permission grant" },
    { kind: "role", icon: "shield", title: "Change an application role", description: "Edit the app-owned display label, then attempt decryption again.", action: "Change display role", boundary: "An app database row ≠ a signed Tide credential" },
  ];
  return <><PageHeading title="Administrator attack panel" description="Give the operator control. See where that control stops." action={<Badge tone="amber" dot>Controlled synthetic demo</Badge>}/><div className="attack-intro"><div><span className="section-kicker">THE CENTRAL DEMONSTRATION</span><h2>Running the system shouldn't mean<br/>owning the paper.</h2><p>{simulation ? "Test the local policy decisions below. These results demonstrate the workflow and are not live Tide evidence." : "Each action below crosses a different boundary. Only a real, verified denial counts as evidence."}</p></div><span className="attack-intro-icon"><Icon name="shield" size={62}/></span></div><div className="selection-bar"><label htmlFor="attack-exam">Target exam</label><select id="attack-exam" value={selected?.id ?? ""} onChange={e => setId(e.target.value)}>{exams.map(e => <option key={e.id} value={e.id}>{e.title}{session ? "" : " · sample metadata"}</option>)}</select><span><Icon name="info" size={15}/>{simulation ? "All access and approval checks are simulated locally." : "No protected action is simulated."}</span></div><div className="attack-grid">{cards.map((c, index) => <section key={c.kind} className="panel attack-card"><div className="attack-card-top"><span className="attack-icon"><Icon name={c.icon} size={24}/></span><span className="attack-number">0{index + 1}</span></div><h2>{c.title}</h2><p>{c.description}</p><div className="boundary-label"><Icon name="lock" size={14}/>{c.boundary}</div><Button variant="secondary" icon={c.icon} disabled={!!busy || !selected} onClick={() => void attack(c.kind)}>{busy === c.kind ? "Checking…" : c.action}</Button>{results[c.kind] && <div className="attack-result" role="status">{results[c.kind]}</div>}</section>)}</div>{stored && <section className="panel ciphertext-panel"><div className="panel-heading"><div><h2>Actual stored ciphertext</h2><p>{stored.byteLength.toLocaleString()} bytes · Base64 preview · Not a signature</p></div><Button variant="secondary" icon="download" onClick={download}>Download ciphertext</Button></div><code className="digest">SHA-256: {stored.sha256}</code><pre>{stored.ciphertextBase64}</pre></section>}{proposal && <section className="panel panel-inset"><h2>{simulation ? "Simulated governance requests" : "Actual governance requests"}</h2>{proposal.requests.map(r => <div className="request-row" key={r.changeRequestId}><code>{r.changeRequestId}</code><Badge>{r.status}</Badge><span>{r.authorizationCount ?? "Unknown"} / {r.threshold ?? "unknown"} approvals</span></div>)}</section>}<div className="attack-bottom"><Icon name="info" size={18}/><p>A compromised server that serves malicious frontend code may capture author input or recipient plaintext. This demo does not establish protection against that attack.</p>{selected && <Link href={`/vault/${selected.id}`} className="text-link">{simulation ? "Attempt simulated opening" : "Attempt actual decryption"} <Icon name="arrow" size={15}/></Link>}</div></>;
}

type GovernanceLink = { id: string; examId: string; requestedRoles: string[]; targetSubject: string; observation: GovernanceObservation };
function GovernanceView() {
  const { session, preview, notify, simulation } = useVaultSession();
  const [rejecting, setRejecting] = useState<string | null>(null);
  const [links, setLinks] = useState<GovernanceLink[]>([]), [busy, setBusy] = useState(false), [error, setError] = useState(""), [filter, setFilter] = useState("all");
  const requestEpoch = useRef(0);
  async function load() {
    const current = ++requestEpoch.current;
    if (!session) return;
    setBusy(true); setError("");
    try { const value = await api<{ requests: GovernanceLink[] }>("/api/governance/requests"); if (current === requestEpoch.current) setLinks(value.requests); } catch (e) { if (current === requestEpoch.current) setLinks([]); setError(safeError(e)); } finally { if (current === requestEpoch.current) setBusy(false); }
  }
  useEffect(() => { setLinks([]); setError(""); void load(); return () => { ++requestEpoch.current; }; }, [session]);
  async function rejectRequest(appRequestId: string, changeRequestId: string) {
    const current = requestEpoch.current; setRejecting(changeRequestId); setError("");
    try {
      await api(`/api/governance/requests/${appRequestId}/deny`, mutation({ changeRequestId }));
      if (current !== requestEpoch.current) return;
      await load(); notify(simulation ? "Simulated request rejected. No existing grant was changed." : "Rejection was observed from Tide. This action does not revoke an existing grant.");
    } catch (e) { if (current === requestEpoch.current) { const message = safeError(e); await load(); setError(message); } }
    finally { setRejecting(null); }
  }
  async function approveRequest(appRequestId: string, changeRequestId: string) {
    const current = requestEpoch.current; setRejecting(changeRequestId); setError("");
    try { await api(`/api/governance/requests/${appRequestId}/approve`, mutation({ changeRequestId }));
      if (current !== requestEpoch.current) return; await load(); notify("Simulated approval saved. Release needs two distinct governor identities.");
    } catch (e) { if (current === requestEpoch.current) setError(safeError(e)); } finally { setRejecting(null); }
  }
  const rows = links.flatMap(l => l.observation.requests.map(r => ({ ...r, link: l }))).filter(r => filter === "all" || r.status === filter);
  const consoleUrl = session?.tideConsoleUrl ?? process.env.NEXT_PUBLIC_TIDE_CONSOLE_URL;
  let safeConsole: string | null = null;
  try {
    const url = new URL(consoleUrl ?? "");
    if (!url.username && !url.password && !url.search && !url.hash && (url.protocol === "https:" ||
        (url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname)))) safeConsole = url.href;
  } catch { /* No valid reviewed console is configured. */ }
  return <><PageHeading title="Governance" description="Independent identities. Explicit decisions. No unilateral access." action={<Button variant="secondary" icon="refresh" disabled={busy || !session} onClick={() => void load()}>{busy ? "Refreshing…" : "Refresh requests"}</Button>}/><div className="governance-overview"><div><span className="section-kicker">ACCESS REQUIRES AGREEMENT</span><div className="threshold-display">2<span>of</span>3</div><h2>Independent approval, by design.</h2><p>{simulation ? "The local simulator requires two different governor identities. Identity independence is demonstrated, not cryptographically proven." : "This is the intended quorum. The active signed policy must verify the live threshold before any enforcement claim."}</p></div><div className="governor-group">{[1, 2, 3].map(n => <div className="governor-profile" key={n}><span>G{n}</span><strong>Governor {n}</strong><small>{simulation ? "Simulated identity" : preview ? "Not connected" : "Verify in Tide"}</small></div>)}</div></div><section className="panel"><div className="panel-heading"><div><h2>Access change requests <span className="count-bubble">{preview || error ? "—" : rows.length}</span></h2><p>{simulation ? "Counts and decisions come from the local simulation. No ORK approvals are performed." : "Counts and outcomes come from live Tide observations."}</p></div><select className="filter-select" value={filter} aria-label="Filter governance requests" onChange={e => setFilter(e.target.value)}><option value="all">All requests</option><option value="PENDING">Pending</option><option value="COMMITTED">Committed</option><option value="REJECTED">Rejected</option></select></div>{error && <div className="panel-inset"><Notice tone="error">{error}</Notice></div>}{rows.length ? <div className="requests-list">{rows.map(r => <div className="governance-request" key={r.changeRequestId}><span className="request-icon"><Icon name="key"/></span><div className="request-main"><strong>Protected role change</strong><code>{r.changeRequestId}</code><small>Target: {r.link.targetSubject}</small><small>{r.link.requestedRoles.join(", ")}</small><small>Observed {date(r.link.observation.observedAt)}</small></div><div className="request-votes"><strong>{r.authorizationCount ?? "—"} <span>/ {r.threshold ?? "—"}</span></strong><small>{simulation ? "Simulated approvals" : "Distinct approvals"}</small></div><Badge tone={r.status === "COMMITTED" ? "green" : "amber"}>{r.status}</Badge>{simulation && session?.identity.roles.includes("tide-realm-admin") && r.status === "PENDING" && <Button variant="primary" disabled={busy || !!rejecting || r.authorizers?.includes(session.identity.subject) || r.link.targetSubject !== "invigilator"} onClick={() => void approveRequest(r.link.id, r.changeRequestId)}>{r.authorizers?.includes(session.identity.subject) ? "Already approved" : "Simulate approval"}</Button>}{(session && hasVerifiedRole(session.identity, "tide-realm-admin")) && r.status === "PENDING" && <Button variant="secondary" disabled={busy || !!rejecting || session.capabilities.deny !== "ready"} title={session.capabilities.deny !== "ready" ? "A reviewed rejection bridge is unavailable. Use your Tide console." : "Reject this pending request"} onClick={() => void rejectRequest(r.link.id, r.changeRequestId)}>{rejecting === r.changeRequestId ? "Verifying rejection…" : "Reject request"}</Button>}</div>)}</div> : <Empty icon="users" title={preview ? "No live requests to review" : busy ? "Fetching current requests…" : "No requests in this view"}>{preview ? "Connect Tide to see actual change requests. We never invent pending approvals or vote counts." : simulation ? "Use Request invigilator release above after sealing a paper." : "Requests will appear after the live proposal bridge returns actual Tide change-request IDs."}</Empty>}<div className="panel-bottom-note"><Icon name="info" size={15}/>Missing approval counts remain unknown. A request is effective only after authoritative commitment.</div></section><div className="two-column governance-notes"><section className="panel small-panel"><Icon name="external" className="section-icon"/><h2>Approve in your own session</h2><p>{simulation ? "Switch to Governor 1 and approve above, then switch to Governor 2. One account cannot count twice. These are synthetic identities on one machine." : "Each governor reviews and signs in the supported Tide console. A service account never casts a human’s vote."}</p>{(session && hasVerifiedRole(session.identity, "tide-realm-admin")) && safeConsole ? <a href={safeConsole} target="_blank" rel="noopener noreferrer" className="button button-secondary">Open Tide console <Icon name="external" size={15}/></a> : <Badge>{simulation ? "Use the simulated approval buttons" : "Console integration not configured"}</Badge>}</section><section className="panel small-panel"><Icon name="shield" className="section-icon"/><h2>The rules need protection, too</h2><p>Role grants, governance membership and the active signed threshold must be checked at their actual enforcement boundary.</p><Link href="/administration/attacks" className="text-link">Inspect the administrator's limits <Icon name="arrow" size={15}/></Link></section></div></>;
}

type ActivityEvent = { actorAlias?: string; id: string; kind: string; outcome: string; source: string; code: string; actorSubject: string; observedAt: string; correlationId: string };
function ActivityView() {
  const { session, preview, simulation } = useVaultSession();
  const [events, setEvents] = useState<ActivityEvent[]>([]), [error, setError] = useState(""), [busy, setBusy] = useState(false), [filter, setFilter] = useState("all"), [offset, setOffset] = useState(0);
  const epoch = useRef(0);
  async function load(nextOffset = 0) {
    const current = ++epoch.current; if (!session) return; setBusy(true); setError("");
    try { const value = await api<{ events: ActivityEvent[] }>(`/api/activity?limit=20&offset=${nextOffset}`); if (current === epoch.current) { setEvents(value.events); setOffset(nextOffset); } } catch (e) { if (current === epoch.current) setError(safeError(e)); } finally { if (current === epoch.current) setBusy(false); }
  }
  useEffect(() => { setEvents([]); setOffset(0); setError(""); void load(); return () => { ++epoch.current; }; }, [session]);
  const shown = events.filter(e => filter === "all" || e.source === filter);
  return <><PageHeading title="Activity timeline" description="Know what was observed, and what the evidence can actually prove." action={<Button variant="secondary" icon="refresh" disabled={busy || !session} onClick={() => void load()}>{busy ? "Refreshing…" : "Refresh activity"}</Button>}/><Notice>Application logs can be edited by the infrastructure operator. Client-reported openings are not independently verified audit receipts.</Notice><section className="panel timeline-panel"><div className="panel-heading"><div><h2>Recorded observations</h2><p>Latest events first · timestamps shown in Vietnam time</p></div><select className="filter-select" value={filter} aria-label="Filter activity source" onChange={e => setFilter(e.target.value)}><option value="all">All sources</option>{simulation && <option value="SIMULATION">Simulated events</option>}<option value="APP">Application</option><option value="CLIENT_REPORTED">Client reported</option><option value="TIDE_OBSERVATION">Observed from Tide</option></select></div>{error && <div className="panel-inset"><Notice tone="error">{error}</Notice></div>}{shown.length ? <div className="timeline">{shown.map(e => <article className="timeline-event" key={e.id}><span className="timeline-dot"><Icon name={e.kind === "DECRYPT_ATTEMPT" ? "key" : e.kind.includes("ACCESS") ? "users" : "file"} size={17}/></span><div className="timeline-event-content"><div><strong>{e.kind.toLowerCase().replaceAll("_", " ")}</strong><time dateTime={e.observedAt}>{date(e.observedAt)}</time></div><p>{e.actorAlias ?? e.actorSubject} · {e.outcome}</p><Badge>{e.source === "CLIENT_REPORTED" ? "Client reported" : e.source === "TIDE_OBSERVATION" ? "Observed from TideCloak" : e.source === "SIMULATION" ? "SIMULATION · local event" : "Mutable application log"}</Badge><code>{e.code} · {e.correlationId}</code></div></article>)}</div> : <Empty icon="activity" title={preview ? "Your evidence trail starts here" : "No observations in this view"}>{preview ? "Once real operations are connected, access attempts and governance observations will appear with clear source labels." : "Try another source filter, refresh, or perform a real operation."}</Empty>}<div className="pagination"><span>Page {Math.floor(offset / 20) + 1} · {events.length} observations{filter !== "all" ? " before source filter" : ""}</span><div><Button variant="secondary" disabled={busy || offset === 0 || !session} onClick={() => void load(Math.max(0, offset - 20))}>Previous</Button><Button variant="secondary" disabled={busy || events.length < 20 || !session} onClick={() => void load(offset + 20)}>Next</Button></div></div></section><section className="evidence-legend"><h3>Reading the evidence</h3><div><span className="legend-dot neutral"/><strong>Application log</strong><p>An editable record of what the app observed.</p></div><div><span className="legend-dot amber"/><strong>Client reported</strong><p>A browser report, not independent proof of opening.</p></div><div><span className="legend-dot purple"/><strong>Tide observation</strong><p>A fetched status, not an immutable signed history.</p></div></section></>;
}
function HelpDialog({ close }: { close: () => void }) {
  const { simulation } = useVaultSession();
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => { dialog.current?.showModal(); }, []);
  return <dialog className="help-dialog" ref={dialog} onCancel={close} onClick={e => { if (e.target === e.currentTarget) close(); }} aria-labelledby="help-title"><button className="icon-button dialog-close" onClick={close} aria-label="Close explanation"><Icon name="close"/></button><div className="guidance-icon"><Icon name="shield" size={27}/></div><h2 id="help-title">Shared authority, clear limits.</h2><p>The author encrypts a synthetic paper in their browser. The application stores ciphertext. A verified invigilator can decrypt after independently approved access release.</p><div className="mini-rule"><Icon name="lock"/>Application roles do not create protected access.</div><div className="mini-rule"><Icon name="users"/>The target is 2 approvals from 3 independent governors.</div><div className="mini-rule"><Icon name="clock"/>The schedule is advisory, not a cryptographic time lock.</div><Notice>{simulation ? "Local simulation: synthetic identities, simulated policies and approvals. Browser AES-GCM uses keys held by the demo server. Real Tide authentication, signed policies and distributed enforcement require a ready realm." : "The current workspace preview contains sample metadata. Real authentication, signed policies and network enforcement must be connected and tested before making security claims."}</Notice><Button onClick={close}>Understood</Button></dialog>;
}
