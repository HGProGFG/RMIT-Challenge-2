CREATE TABLE IF NOT EXISTS SchemaMigration(version INTEGER PRIMARY KEY, appliedAt TEXT NOT NULL);
CREATE TABLE DemoRun(
  id TEXT PRIMARY KEY, mode TEXT NOT NULL CHECK(mode='LIVE_MANUAL_RELEASE'),
  createdAt TEXT NOT NULL, versionManifest TEXT NOT NULL DEFAULT '{}',
  expectedPolicyFingerprints TEXT NOT NULL DEFAULT '{}', pinnedKeyFingerprint TEXT
);
CREATE TABLE Exam(
  id TEXT PRIMARY KEY, runId TEXT NOT NULL UNIQUE REFERENCES DemoRun(id),
  title TEXT NOT NULL CHECK(length(title) BETWEEN 1 AND 120),
  authorIssuer TEXT NOT NULL, authorSubject TEXT NOT NULL, advisoryReleaseAt TEXT NOT NULL,
  createdAt TEXT NOT NULL, sealedAt TEXT,
  contentType TEXT NOT NULL CHECK(contentType='text/plain;charset=utf-8'),
  state TEXT NOT NULL CHECK(state IN ('PREPARED','SEALED')),
  ciphertext BLOB, ciphertextSha256 TEXT, byteLength INTEGER, version INTEGER NOT NULL DEFAULT 1,
  CHECK((state='PREPARED' AND ciphertext IS NULL AND sealedAt IS NULL) OR
        (state='SEALED' AND ciphertext IS NOT NULL AND sealedAt IS NOT NULL AND byteLength=length(ciphertext)))
);
CREATE TRIGGER sealed_exam_write_once BEFORE UPDATE ON Exam WHEN OLD.state='SEALED'
BEGIN SELECT RAISE(ABORT,'SEALED_WRITE_ONCE'); END;
CREATE TABLE ExamPolicy(
  id TEXT PRIMARY KEY, examId TEXT NOT NULL REFERENCES Exam(id),
  purpose TEXT NOT NULL CHECK(purpose IN ('WRITE','READ')), signedBytes BLOB NOT NULL,
  digest TEXT NOT NULL, metadata TEXT NOT NULL, version INTEGER NOT NULL CHECK(version=1),
  UNIQUE(examId,purpose,version)
);
CREATE TRIGGER policy_write_once BEFORE UPDATE ON ExamPolicy
BEGIN SELECT RAISE(ABORT,'POLICY_WRITE_ONCE'); END;
CREATE TABLE GovernanceLink(
  id TEXT PRIMARY KEY, examId TEXT NOT NULL REFERENCES Exam(id),
  requesterIssuer TEXT NOT NULL, requesterSubject TEXT NOT NULL,
  targetIssuer TEXT NOT NULL, targetSubject TEXT NOT NULL, requestedRoles TEXT NOT NULL,
  changeRequestIds TEXT NOT NULL, observation TEXT NOT NULL,
  createdAt TEXT NOT NULL
);
CREATE TABLE DemoRoleOverride(
  runId TEXT NOT NULL REFERENCES DemoRun(id), issuer TEXT NOT NULL, subject TEXT NOT NULL,
  displayRole TEXT NOT NULL CHECK(displayRole='invigilator'), updatedAt TEXT NOT NULL,
  PRIMARY KEY(runId,issuer,subject)
);
CREATE TABLE ActivityEvent(
  id TEXT PRIMARY KEY, runId TEXT NOT NULL REFERENCES DemoRun(id), examId TEXT NOT NULL REFERENCES Exam(id),
  actorIssuer TEXT NOT NULL, actorSubject TEXT NOT NULL, kind TEXT NOT NULL, outcome TEXT NOT NULL,
  source TEXT NOT NULL CHECK(source IN ('APP','CLIENT_REPORTED','TIDE_OBSERVATION')),
  code TEXT NOT NULL, correlationId TEXT NOT NULL, observedAt TEXT NOT NULL
);
CREATE INDEX activity_exam_time ON ActivityEvent(examId,observedAt,id);
CREATE TABLE DpopReplay(thumbprint TEXT NOT NULL, jti TEXT NOT NULL, expiresAt INTEGER NOT NULL,
  PRIMARY KEY(thumbprint,jti));
CREATE INDEX replay_expiry ON DpopReplay(expiresAt);
CREATE TABLE Idempotency(
  issuer TEXT NOT NULL, subject TEXT NOT NULL, scope TEXT NOT NULL, key TEXT NOT NULL,
  requestDigest TEXT NOT NULL, response TEXT,
  PRIMARY KEY(issuer,subject,scope,key)
);
CREATE TABLE RateLimit(bucket TEXT NOT NULL, window INTEGER NOT NULL, count INTEGER NOT NULL,
  PRIMARY KEY(bucket,window));
