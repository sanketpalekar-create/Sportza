#!/usr/bin/env node
/**
 * scripts/share.js
 *
 * Prints clear instructions for exposing Sportza to the internet via
 * ngrok (recommended) or cloudflared (zero-config alternative).
 *
 * Run:  pnpm dev:share
 */

const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const RESET  = "\x1b[0m";
const BOLD   = "\x1b[1m";
const CYAN   = "\x1b[36m";
const YELLOW = "\x1b[33m";
const GREEN  = "\x1b[32m";
const RED    = "\x1b[31m";

function banner(msg) {
  console.log(`\n${BOLD}${CYAN}${"─".repeat(60)}`);
  console.log(`  ${msg}`);
  console.log(`${"─".repeat(60)}${RESET}\n`);
}

function step(n, msg) {
  console.log(`${BOLD}${GREEN}[${n}]${RESET} ${msg}`);
}

function warn(msg) {
  console.log(`${YELLOW}⚠  ${msg}${RESET}`);
}

function code(cmd) {
  console.log(`    ${CYAN}${cmd}${RESET}`);
}

// ─── Check for ngrok ────────────────────────────────────────────────────────
let hasNgrok = false;
try { execSync("ngrok version", { stdio: "pipe" }); hasNgrok = true; } catch {}

// ─── Check for cloudflared ───────────────────────────────────────────────────
let hasCloudflared = false;
try { execSync("cloudflared --version", { stdio: "pipe" }); hasCloudflared = true; } catch {}

banner("Sportza — Expose to the Internet");

if (!hasNgrok && !hasCloudflared) {
  console.log(`${RED}Neither ngrok nor cloudflared found.${RESET}`);
  console.log(`Install one of them first:\n`);
  console.log(`  ngrok:       https://ngrok.com/download`);
  console.log(`  cloudflared: https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/install-and-setup/installation`);
  process.exit(0);
}

const tool = hasNgrok ? "ngrok" : "cloudflared";
console.log(`Using: ${BOLD}${tool}${RESET}\n`);

banner("Step-by-step");

step(1, "Start the backend (in one terminal):");
code("pnpm dev:backend");

step(2, `Expose the backend on port 5000 (in another terminal):`);
if (hasNgrok) {
  code("ngrok http 5000");
} else {
  code("cloudflared tunnel --url http://localhost:5000");
}
warn("Copy the public URL shown (e.g. https://abc123.ngrok-free.app)");

step(3, `Update ${BOLD}apps/api/.env${RESET} → add the frontend origin:`);
code("CLIENT_ORIGIN=http://localhost:5173,https://<frontend-url>.ngrok-free.app");

step(4, `Update ${BOLD}apps/web/.env${RESET} → point to the backend public URL:`);
code("VITE_API_URL=https://<backend-url>.ngrok-free.app/api");

step(5, "Start the frontend (in another terminal):");
code("pnpm dev:frontend");

step(6, `Expose the frontend on port 5173:`);
if (hasNgrok) {
  code("ngrok http 5173");
} else {
  code("cloudflared tunnel --url http://localhost:5173");
}
warn("Share the frontend public URL with testers.");

banner("Checklist");
[
  "Backend URL reachable:   curl https://<backend>.ngrok-free.app/api/health",
  "Frontend loads in browser at ngrok URL",
  "Login / OTP flow works",
  "No CORS errors in browser console",
  "No 'localhost' references in Network tab requests",
].forEach((item, i) => console.log(`  ${GREEN}☐${RESET}  ${item}`));

banner("Cloudflared alternative (no account needed)");
code("cloudflared tunnel --url http://localhost:5000   # backend");
code("cloudflared tunnel --url http://localhost:5173   # frontend");

console.log(`\n${YELLOW}Note: Restart the frontend dev server after changing .env files.${RESET}\n`);
