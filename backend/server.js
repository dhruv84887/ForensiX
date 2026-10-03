const cors = require("cors");
const express = require("express");
const { randomBytes, scrypt: scryptCallback, timingSafeEqual } = require("node:crypto");
const fs = require("node:fs/promises");
const path = require("node:path");
const { promisify } = require("node:util");

const app = express();
const PORT = Number(process.env.PORT) || 5000;
const cases = new Map();
const accounts = new Map();
const accountsById = new Map();
const sessions = new Map();
const scrypt = promisify(scryptCallback);
const accountStorePath = process.env.FORENSIX_DATA_DIR
  ? path.join(process.env.FORENSIX_DATA_DIR, "accounts.json")
  : path.join(__dirname, "data", "accounts.json");
const allowedOrigins = new Set(
  (process.env.CORS_ORIGINS || "http://localhost:5173,http://127.0.0.1:5173")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean),
);
const SESSION_COOKIE = "forensix_session";
const SESSION_DURATION = 12 * 60 * 60 * 1000;
const REMEMBERED_SESSION_DURATION = 30 * 24 * 60 * 60 * 1000;
const authAttempts = new Map();
let accountWriteQueue = Promise.resolve();
let accountCreationQueue = Promise.resolve();

const DEMO_FILES = [
  { name: "vacation_photo.jpg", type: "image", size: "4.8 MB", confidence: 98 },
  { name: "project_report.pdf", type: "document", size: "2.4 MB", confidence: 95 },
  { name: "family_video.mp4", type: "video", size: "18.6 MB", confidence: 91 },
];

app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.has(origin)) return callback(null, true);
    return callback(new Error("This origin is not allowed to access the API."));
  },
  credentials: true,
}));
app.use(express.json({ limit: "32kb" }));

const publicUser = (account) => ({ id: account.id, name: account.name, email: account.email });

async function loadAccounts() {
  await fs.mkdir(path.dirname(accountStorePath), { recursive: true });
  try {
    const savedAccounts = JSON.parse(await fs.readFile(accountStorePath, "utf8"));
    if (!Array.isArray(savedAccounts)) throw new Error("Account data has an invalid format.");
    savedAccounts.forEach((account) => {
      if (account?.id && account?.email && account?.salt && account?.passwordHash) {
        accounts.set(account.email, account);
        accountsById.set(account.id, account);
      }
    });
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    await fs.writeFile(accountStorePath, "[]", { encoding: "utf8", mode: 0o600 });
  }
}

function saveAccounts() {
  accountWriteQueue = accountWriteQueue.catch(() => undefined).then(async () => {
    const temporaryPath = `${accountStorePath}.tmp`;
    await fs.writeFile(temporaryPath, JSON.stringify([...accounts.values()], null, 2), {
      encoding: "utf8",
      mode: 0o600,
    });
    await fs.rename(temporaryPath, accountStorePath);
  });
  return accountWriteQueue;
}

function getSessionId(req) {
  const cookies = (req.headers.cookie || "").split(";");
  const sessionCookie = cookies.find((cookie) => cookie.trim().startsWith(`${SESSION_COOKIE}=`));
  return sessionCookie?.trim().slice(SESSION_COOKIE.length + 1) || "";
}

function setSessionCookie(res, sessionId, rememberMe) {
  const maxAge = rememberMe ? `; Max-Age=${Math.floor(REMEMBERED_SESSION_DURATION / 1000)}` : "";
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  res.setHeader("Set-Cookie", `${SESSION_COOKIE}=${sessionId}; Path=/; HttpOnly; SameSite=Lax${maxAge}${secure}`);
}

function clearSessionCookie(res) {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  res.setHeader("Set-Cookie", `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}`);
}

function createSession(account, rememberMe, res) {
  const sessionId = randomBytes(32).toString("base64url");
  const duration = rememberMe ? REMEMBERED_SESSION_DURATION : SESSION_DURATION;
  sessions.set(sessionId, { userId: account.id, expiresAt: Date.now() + duration });
  setSessionCookie(res, sessionId, rememberMe);
}

function authenticate(req, res, next) {
  const sessionId = getSessionId(req);
  const session = sessions.get(sessionId);
  if (!session || session.expiresAt <= Date.now()) {
    if (sessionId) sessions.delete(sessionId);
    return res.status(401).json({ success: false, message: "Please log in to continue." });
  }

  const account = accountsById.get(session.userId);
  if (!account) {
    sessions.delete(sessionId);
    return res.status(401).json({ success: false, message: "Please log in to continue." });
  }

  req.user = publicUser(account);
  return next();
}

function takeAuthAttempt(key, limit, windowMs) {
  const now = Date.now();
  const attempts = (authAttempts.get(key) || []).filter((at) => now - at < windowMs);
  if (attempts.length >= limit) {
    authAttempts.set(key, attempts);
    return false;
  }
  attempts.push(now);
  authAttempts.set(key, attempts);
  return true;
}

const makeId = (prefix) => `${prefix}-${Date.now().toString(36).toUpperCase()}`;

const createCase = (source, fileType, userId) => {
  const currentCase = {
    caseId: makeId("FX"),
    reportId: makeId("REP"),
    userId,
    source,
    fileType,
    status: "ACTIVE",
    scanStatus: "PENDING",
    recoveryStatus: "PENDING",
    files: DEMO_FILES.map((file) => ({ ...file, recovered: false })),
    createdAt: new Date().toISOString(),
    logs: [],
  };
  cases.set(currentCase.caseId, currentCase);
  return currentCase;
};

const findCase = (caseId, res, userId) => {
  const currentCase = cases.get(caseId);
  if (!currentCase || currentCase.userId !== userId) {
    res.status(404).json({ success: false, message: "Case not found. Run a scan first." });
    return null;
  }
  return currentCase;
};

const caseSummary = (currentCase) => ({
  caseId: currentCase.caseId,
  reportId: currentCase.reportId,
  source: currentCase.source,
  fileType: currentCase.fileType,
  status: currentCase.status,
  scanStatus: currentCase.scanStatus,
  recoveryStatus: currentCase.recoveryStatus,
  totalFiles: currentCase.files.length,
  recoveredFiles: currentCase.files.filter((file) => file.recovered).length,
  files: currentCase.files,
});

app.get("/api/health", (_req, res) => {
  res.json({ success: true, service: "ForensiX demo API", mode: "simulation" });
});

app.post("/api/auth/register", async (req, res) => {
  const name = typeof req.body?.name === "string" ? req.body.name.trim() : "";
  const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
  const password = typeof req.body?.password === "string" ? req.body.password : "";
  const rememberMe = req.body?.rememberMe === true;

  if (!takeAuthAttempt(`register:${req.ip}`, 8, 60 * 60 * 1000)) {
    return res.status(429).json({ success: false, message: "Too many registration attempts. Please try again later." });
  }
  if (!name || name.length > 80) {
    return res.status(400).json({ success: false, message: "Enter a name with no more than 80 characters." });
  }
  if (!/^\S+@\S+\.\S+$/.test(email) || email.length > 254) {
    return res.status(400).json({ success: false, message: "Enter a valid email address." });
  }
  if (password.length < 8 || password.length > 128) {
    return res.status(400).json({ success: false, message: "Password must be between 8 and 128 characters." });
  }

  const salt = randomBytes(16).toString("hex");
  const passwordHash = (await scrypt(password, salt, 64)).toString("hex");
  const account = {
    id: randomBytes(16).toString("hex"),
    name,
    email,
    salt,
    passwordHash,
    createdAt: new Date().toISOString(),
  };

  const creation = accountCreationQueue.then(async () => {
    if (accounts.has(email)) return false;
    accounts.set(email, account);
    accountsById.set(account.id, account);
    try {
      await saveAccounts();
      return true;
    } catch (error) {
      accounts.delete(email);
      accountsById.delete(account.id);
      throw error;
    }
  });
  accountCreationQueue = creation.catch(() => undefined);
  if (!(await creation)) {
    return res.status(409).json({ success: false, message: "An account with this email already exists." });
  }

  createSession(account, rememberMe, res);
  return res.status(201).json({ success: true, user: publicUser(account) });
});

app.post("/api/auth/login", async (req, res) => {
  const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
  const password = typeof req.body?.password === "string" ? req.body.password : "";
  const rememberMe = req.body?.rememberMe === true;
  const attemptKey = `login:${req.ip}:${email}`;

  if (!takeAuthAttempt(attemptKey, 8, 15 * 60 * 1000)) {
    return res.status(429).json({ success: false, message: "Too many login attempts. Please try again later." });
  }
  if (!email || email.length > 254 || !password || password.length > 128) {
    return res.status(401).json({ success: false, message: "Email or password is incorrect." });
  }

  const account = accounts.get(email);
  const salt = account?.salt || "00112233445566778899aabbccddeeff";
  const expectedHash = account ? Buffer.from(account.passwordHash, "hex") : Buffer.alloc(64);
  const actualHash = await scrypt(password, salt, 64);
  if (!account || expectedHash.length !== actualHash.length || !timingSafeEqual(actualHash, expectedHash)) {
    return res.status(401).json({ success: false, message: "Email or password is incorrect." });
  }

  authAttempts.delete(attemptKey);
  createSession(account, rememberMe, res);
  return res.json({ success: true, user: publicUser(account) });
});

app.post("/api/auth/logout", (req, res) => {
  const sessionId = getSessionId(req);
  if (sessionId) sessions.delete(sessionId);
  clearSessionCookie(res);
  return res.json({ success: true });
});

app.get("/api/auth/session", authenticate, (req, res) => {
  res.json({ success: true, user: req.user });
});

app.use("/api", authenticate);

app.post("/api/scan", (req, res) => {
  const source = typeof req.body?.source === "string" ? req.body.source.trim() : "";
  const fileType = typeof req.body?.fileType === "string" ? req.body.fileType : "All Files";
  const caseId = typeof req.body?.caseId === "string" ? req.body.caseId : "";
  const allowedFileTypes = new Set(["All Files", "Images", "Documents", "Videos", "Audio Files"]);

  if (!source) {
    return res.status(400).json({ success: false, message: "Choose a storage location before scanning." });
  }
  if (!allowedFileTypes.has(fileType)) {
    return res.status(400).json({ success: false, message: "Choose a supported file type." });
  }

  const currentCase = caseId ? cases.get(caseId) : null;
  const scanCase = currentCase?.userId === req.user.id ? currentCase : createCase(source, fileType, req.user.id);
  scanCase.source = source.slice(0, 120);
  scanCase.fileType = fileType;
  scanCase.scanStatus = "COMPLETED";
  scanCase.recoveryStatus = "READY";
  const typeAliases = {
    Images: "image",
    Documents: "document",
    Videos: "video",
    "Audio Files": "audio",
  };
  const requestedType = typeAliases[fileType];
  scanCase.files = DEMO_FILES
    .filter((file) => fileType === "All Files" || file.type === requestedType)
    .map((file) => ({ ...file, recovered: false }));
  scanCase.logs.push({ action: "scan", at: new Date().toISOString() });

  return res.json({
    success: true,
    ...caseSummary(scanCase),
    filesFound: scanCase.files.length,
    message: "Demo scan completed. Results are sample data.",
  });
});

app.get("/api/cases/:caseId", (req, res) => {
  const currentCase = findCase(req.params.caseId, res, req.user.id);
  if (!currentCase) return;
  return res.json({ success: true, ...caseSummary(currentCase) });
});

app.post("/api/recover", (req, res) => {
  const { caseId, fileName } = req.body || {};
  if (typeof caseId !== "string" || typeof fileName !== "string") {
    return res.status(400).json({ success: false, message: "Case and file are required." });
  }

  const currentCase = findCase(caseId, res, req.user.id);
  if (!currentCase) return;
  const file = currentCase.files.find((candidate) => candidate.name === fileName);
  if (!file) return res.status(404).json({ success: false, message: "File not found in this scan." });

  file.recovered = true;
  currentCase.recoveryStatus = currentCase.files.every((candidate) => candidate.recovered) ? "COMPLETED" : "IN_PROGRESS";
  currentCase.logs.push({ action: "recover", fileName, at: new Date().toISOString() });
  return res.json({ success: true, ...caseSummary(currentCase), message: "Demo recovery completed." });
});

app.post("/api/recover-all", (req, res) => {
  const { caseId } = req.body || {};
  if (typeof caseId !== "string") {
    return res.status(400).json({ success: false, message: "Case is required." });
  }

  const currentCase = findCase(caseId, res, req.user.id);
  if (!currentCase) return;
  if (currentCase.files.length === 0) {
    return res.status(409).json({ success: false, message: "This scan has no sample files to recover." });
  }
  currentCase.files.forEach((file) => { file.recovered = true; });
  currentCase.recoveryStatus = "COMPLETED";
  currentCase.logs.push({ action: "recover-all", at: new Date().toISOString() });
  return res.json({ success: true, ...caseSummary(currentCase), message: "Demo recovery completed." });
});

app.post("/api/erase", (req, res) => {
  const {
    securityLevel = "Standard",
    method = "Quick Secure Erase",
    source = "Unspecified storage",
  } = req.body || {};
  const allowedMethods = new Set([
    "Quick Secure Erase",
    "DoD 5220.22-M",
    "Advanced Multi-Pass Erasure",
  ]);
  if (!new Set(["Standard", "High", "Maximum"]).has(securityLevel)) {
    return res.status(400).json({ success: false, message: "Choose a supported security level." });
  }
  if (!allowedMethods.has(method)) {
    return res.status(400).json({ success: false, message: "Choose a supported erasure method." });
  }

  // This endpoint intentionally runs a response-only simulation. It never accesses storage or deletes data.
  return res.json({
    success: true,
    simulated: true,
    source: String(source).slice(0, 120),
    securityLevel,
    method,
    status: "SIMULATION_COMPLETED",
    message: "Erasure simulation completed. No data was deleted.",
  });
});

app.use((error, _req, res, _next) => {
  if (error instanceof SyntaxError && "body" in error) {
    return res.status(400).json({ success: false, message: "Request body must be valid JSON." });
  }
  console.error("API error:", error);
  return res.status(500).json({ success: false, message: "Unexpected server error." });
});

loadAccounts().then(() => {
  app.listen(PORT, () => {
    console.log(`ForensiX demo API running at http://localhost:${PORT}`);
  });
}).catch((error) => {
  console.error("Could not load the ForensiX account store:", error);
  process.exitCode = 1;
});
