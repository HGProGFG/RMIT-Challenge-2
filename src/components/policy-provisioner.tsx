"use client";
import { useEffect, useRef, useState } from "react";
import type { Exam, SignedPolicy } from "../lib/contracts";
import { api, ClientApiError, mutation, safeError } from "../lib/client/api";
import { getBrowserTide } from "../lib/tide/browser/adapter";
import { hasVerifiedRole } from "../lib/roles";
import { useVaultSession } from "../providers/vault-session";

export function PolicyProvisioner() {
  const { session, simulation } = useVaultSession();
  const [exams, setExams] = useState<Exam[]>([]), [selected, setSelected] = useState("");
  const [busy, setBusy] = useState(false), [message, setMessage] = useState("");
  const epoch = useRef(0);
  const governor = !simulation && !!session && hasVerifiedRole(session.identity, "tide-realm-admin");
  useEffect(() => {
    const current = ++epoch.current; setExams([]); setMessage(""); setBusy(false);
    if (governor) api<{ exams: Exam[] }>("/api/exams").then(data => {
      if (current === epoch.current) { setExams(data.exams); setSelected(data.exams[0]?.id ?? ""); }
    }).catch(error => { if (current === epoch.current) setMessage(safeError(error)); });
    return () => { ++epoch.current; };
  }, [session, governor]);
  async function sign() {
    const adapter = getBrowserTide(), current = epoch.current;
    if (!selected || !adapter.signPolicy) return;
    setBusy(true); setMessage("Review the author write policy and invigilator read policy in your Tide enclave.");
    try {
      for (const purpose of ["WRITE", "READ"] as const) {
        let existing: SignedPolicy | null = null;
        try { existing = (await api<{ policy: SignedPolicy }>(`/api/exams/${selected}/policy?purpose=${purpose}`)).policy; }
        catch (error) { if (!(error instanceof ClientApiError) || error.code !== "POLICY_NOT_READY") throw error; }
        if (current !== epoch.current) return;
        if (existing) continue;
        const signedBytesBase64 = await adapter.signPolicy({ examId: selected, purpose });
        if (current !== epoch.current) return;
        await api(`/api/exams/${selected}/policies`, mutation({ purpose, signedBytesBase64 }));
        if (current !== epoch.current) return;
      }
      setMessage("Both verified policies are stored. The author can resume sealing this exam. Releasing the decrypt role still requires separate governance approval.");
    } catch (error) { if (current === epoch.current) setMessage(safeError(error)); }
    finally { if (current === epoch.current) setBusy(false); }
  }
  if (!governor) return null;
  return <section className="panel small-panel"><h2>Prepare record policies</h2>
    <p>A governor signs two policies for the prepared exam. Each policy binds one operation and one role to this exact exam identifier.</p>
    <label htmlFor="policy-exam">Prepared exam</label>{" "}
    <select id="policy-exam" value={selected} disabled={busy} onChange={event => setSelected(event.target.value)}>
      {exams.map(exam => <option key={exam.id} value={exam.id}>{exam.title}</option>)}
    </select>{" "}
    <button className="button button-secondary" disabled={busy || !selected || session?.readiness.policy !== "ready"} onClick={() => void sign()}>
      {busy ? "Waiting for enclave approval…" : "Sign missing exam policies"}
    </button>
    <p role="status">{message || (!selected ? "The author must prepare an exam first." : "Policy signing does not grant the protected decrypt role.")}</p>
  </section>;
}
