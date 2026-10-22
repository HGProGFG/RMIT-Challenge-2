import type { Exam, Identity } from "../contracts";

/** The backend allows one paper per active run. Resume that exact owner's metadata. */
export function resumableExam(exams: Exam[], identity: Identity): Exam | null {
  const exam = exams[0];
  if (!exam) return null;
  if (exam.authorIssuer !== identity.issuer || exam.authorSubject !== identity.subject) {
    throw new Error("RUN_OWNED_BY_ANOTHER_AUTHOR");
  }
  return exam;
}
export function scheduleInput(value: string) {
  return new Date(Date.parse(value) + 7 * 60 * 60 * 1000).toISOString().slice(0, 16);
}
