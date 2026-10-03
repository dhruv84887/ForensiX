import { spawn } from "node:child_process";
import { setTimeout as wait } from "node:timers/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const apiBaseUrl = (process.env.VITE_API_BASE_URL || "http://localhost:5000").replace(/\/$/, "");
const viteEntry = path.join(projectRoot, "node_modules", "vite", "bin", "vite.js");
const backendEntry = path.join(projectRoot, "backend", "server.js");
const processes = [];
let shuttingDown = false;
let frontendStarted = false;

async function isReadyBackend() {
  try {
    const healthResponse = await fetch(`${apiBaseUrl}/api/health`, { signal: AbortSignal.timeout(900) });
    const health = await healthResponse.json();
    if (!healthResponse.ok || health.service !== "ForensiX demo API") return false;

    const sessionResponse = await fetch(`${apiBaseUrl}/api/auth/session`, { signal: AbortSignal.timeout(900) });
    const session = await sessionResponse.json();
    return sessionResponse.status === 401 && session.success === false;
  } catch {
    return false;
  }
}

function stopProcesses(signal = "SIGTERM") {
  if (shuttingDown) return;
  shuttingDown = true;
  processes.forEach((child) => {
    if (child.exitCode === null && !child.killed) child.kill(signal);
  });
}

function startProcess(label, entry, args = []) {
  const child = spawn(process.execPath, [entry, ...args], {
    cwd: projectRoot,
    env: process.env,
    stdio: "inherit",
  });
  processes.push(child);
  child.once("error", (error) => {
    console.error(`[${label}] ${error.message}`);
    process.exitCode = 1;
    stopProcesses();
  });
  child.once("exit", (code, signal) => {
    if (!shuttingDown) {
      if (label === "api" && !frontendStarted) {
        console.error("[api] The backend stopped before it became ready. Check whether port 5000 is already in use.");
      }
      process.exitCode = code ?? (signal ? 1 : 0);
      stopProcesses();
    }
  });
  return child;
}

async function waitForBackend(child) {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    if (child.exitCode !== null) return false;
    if (await isReadyBackend()) return true;
    await wait(300);
  }
  return false;
}

async function startDevelopment() {
  if (await isReadyBackend()) {
    console.log("[api] Reusing the running ForensiX backend.");
  } else {
    const backend = startProcess("api", backendEntry);
    if (!(await waitForBackend(backend))) {
      if (backend.exitCode === null) {
        console.error(`[api] Could not start a ready API at ${apiBaseUrl}. Check the backend port and CORS_ORIGINS.`);
      }
      process.exitCode = 1;
      stopProcesses();
      return;
    }
  }

  frontendStarted = true;
  startProcess("web", viteEntry, process.argv.slice(2));
}

process.on("SIGINT", () => stopProcesses("SIGINT"));
process.on("SIGTERM", () => stopProcesses("SIGTERM"));

startDevelopment().catch((error) => {
  console.error(`Could not start the ForensiX development environment: ${error.message}`);
  process.exitCode = 1;
  stopProcesses();
});
