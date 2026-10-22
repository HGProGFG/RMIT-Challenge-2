"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import type { Exam, Role, SessionResponse } from "../lib/contracts";
import { api, mutation, safeError } from "../lib/client/api";
import { useVaultSession } from "../providers/vault-session";

const accounts = [
  ["author", "Exam author"], ["invigilator", "Invigilator"], ["teacher", "Teacher"], ["app-admin", "Application administrator"],
  ["governor-1", "Governor 1"], ["governor-2", "Governor 2"], ["governor-3", "Governor 3"],
] as const;
export function SimulationPanel({ examId }: { examId?: string }) {
  const { simulation, session, loading, error, login, logout, refresh, notify } = useVaultSession();
  const [selected, setSelected] = useState(""), [busy, setBusy] = useState(false), [message, setMessage] = useState("");
  const [sealedExams, setSealedExams] = useState<Exam[]>([]), [releaseExamId, setReleaseExamId] = useState(""), [loadingExams, setLoadingExams] = useState(false);
  const canRelease = session?.identity.roles.some(r => r === "invigilator" || r === "tide-realm-admin");
  useEffect(() => { setSelected(session?.identity.subject ?? ""); }, [session?.identity.subject]);
  useEffect(() => {
    let alive = true;
    if (!canRelease) { setSealedExams([]); setReleaseExamId(""); setLoadingExams(false); return; }
    setLoadingExams(true);
    api<{ exams: Exam[] }>("/api/exams").then(({ exams }) => {
      if (!alive) return;
      const sealed = exams.filter(exam => exam.state === "SEALED");
      setSealedExams(sealed);
      setReleaseExamId(previous => examId ?? (sealed.some(exam => exam.id === previous) ? previous : sealed.length === 1 ? sealed[0].id : ""));
    }).catch(error => { if (alive) { setSealedExams([]); setMessage(safeError(error)); } })
      .finally(() => { if (alive) setLoadingExams(false); });
    return () => { alive = false; };
  }, [session, canRelease, examId]);
  if (!simulation) return null;
  async function switchAccount() {
    setBusy(true); setMessage("");
    try {
      await logout();
      await login(selected.startsWith("governor-") ? "tide-realm-admin" : selected as Role, selected);
      const current = await api<SessionResponse>("/api/session");
      if (current.identity.subject !== selected) throw new Error("Unexpected simulation identity");
      setMessage(`Selected ${accounts.find(a => a[0] === selected)?.[1]}. This identity is simulated.`);
    } catch (error) { setMessage(safeError(error)); } finally { setBusy(false); }
  }
  async function release() {
    setBusy(true); setMessage("");
    try {
      const { exams } = await api<{ exams: Exam[] }>("/api/exams"), exam = exams.find(e => e.id === (examId ?? releaseExamId) && e.state === "SEALED");
      if (!exam) { setMessage("Choose a sealed exam before requesting its release."); return; }
      await api(`/api/exams/${exam.id}/access-requests`, mutation({ kind: "INVIGILATOR_RELEASE" }, crypto.randomUUID()));
      await refresh(); notify(`Release requested for “${exam.title}”. Two different governor identities must approve this paper.`);
      setMessage("Release requested. Open Governance as Governor 1, then Governor 2 to approve.");
    } catch (error) { setMessage(safeError(error)); } finally { setBusy(false); }
  }
  async function reset() {
    setBusy(true); setMessage("");
    try { await api("/api/simulation/reset", mutation({})); await refresh(); notify("All local simulation papers, keys and votes were reset."); }
    catch (error) { setMessage(safeError(error)); } finally { setBusy(false); }
  }
  return <details className="simulation-panel" open>
    <summary>Plan C · Demo accounts <span>No Tide login required</span></summary>
    <p role="status">Current identity: <strong>{loading ? "Loading…" : session?.identity.alias ?? "No account selected"}</strong>{session && <> · {session.identity.roles.join(", ")}</>}</p>
    <div className="simulation-controls">
      <label htmlFor="simulation-identity">Demo identity<select id="simulation-identity" value={selected} disabled={busy} onChange={event => setSelected(event.target.value)}>
        <option value="" disabled>Choose a demo account</option>
        {accounts.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
      </select></label>
      <button className="button button-secondary" disabled={busy || loading || !selected} onClick={() => void switchAccount()}>{busy ? "Updating…" : "Switch simulated identity"}</button>
      {canRelease && <><label htmlFor="release-exam">Release exam<select id="release-exam" value={releaseExamId} disabled={busy || loadingExams || !!examId} onChange={event => setReleaseExamId(event.target.value)}><option value="">{loadingExams ? "Loading papers…" : "Choose a sealed exam"}</option>{sealedExams.map(exam => <option key={exam.id} value={exam.id}>{exam.title} · {exam.id.slice(0, 8)}</option>)}</select></label><button className="button button-secondary" disabled={busy || loadingExams || !sealedExams.some(exam => exam.id === (examId ?? releaseExamId))} onClick={() => void release()}>Request invigilator release</button></>}
      {session?.identity.roles.includes("app-admin") && <button className="button button-secondary" disabled={busy} onClick={() => void reset()}>Reset all demo papers and votes</button>}
    </div>
    <p>Author: <Link href="/vault/new">seal a sample paper</Link>. Teacher or admin: attempt to open and see refusal. Invigilator: request release. <Link href="/governance">Governors 1 and 2</Link>: approve separately. Invigilator: open the paper.</p>
    <p className="fine-print">Sign-in, record policies and quorum checks are simulated locally. AES-GCM runs in the browser, but the local server holds the demo keys. This demonstrates the workflow; it does not provide Tide’s distributed protection.</p>
    {error && <p role="alert">{error}</p>}<p role="status">{message}</p>
  </details>;
}
