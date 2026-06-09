/* Founders Room — WS client, chat room, live plan panel, replay, export. */
"use strict";

const $ = (sel) => document.querySelector(sel);

const SECTIONS = [
  ["problem", "Problem"],
  ["target_user", "Target user"],
  ["solution", "Solution"],
  ["market", "Market & competitors"],
  ["business_model", "Business model & pricing"],
  ["gtm", "Go-to-market"],
  ["financials", "Financial sketch"],
  ["roadmap", "12-month roadmap"],
  ["risks", "Key risks & open questions"],
];

let ws = null;
let agentsMeta = {};        // name -> {role, emoji, color}
let lastBubble = {};        // agent name -> bubble element currently streaming
let sessionId = null;
let finalMarkdown = "";
let replaying = false;

/* ---------- DOM setup ---------- */

function initPlanPanel() {
  const wrap = $("#plan-sections");
  wrap.innerHTML = "";
  for (const [key, title] of SECTIONS) {
    const div = document.createElement("div");
    div.className = "plan-section";
    div.id = `sec-${key}`;
    div.innerHTML = `<h3>${title}</h3><div class="sec-body"></div>`;
    wrap.appendChild(div);
  }
}

function setStatus(msg) { $("#status").textContent = msg; }

function scrollChat() {
  const chat = $("#chat");
  chat.scrollTop = chat.scrollHeight;
}

function addSystemLine(text) {
  const div = document.createElement("div");
  div.className = "system-line";
  div.textContent = text;
  $("#chat").appendChild(div);
  scrollChat();
}

function addRoundHeader(round, question) {
  const div = document.createElement("div");
  div.className = "round-header";
  div.innerHTML = `<b></b><div></div>`;
  div.querySelector("b").textContent = `Round · ${round}`;
  div.querySelector("div").textContent = question;
  $("#chat").appendChild(div);
  scrollChat();
}

function addBubble(agent, { typing = false, decision = false } = {}) {
  const meta = agentsMeta[agent] || {};
  const isYou = agent === "You";
  const div = document.createElement("div");
  div.className = "bubble" + (isYou ? " you" : "") + (typing ? " typing" : "") +
    (decision ? " decision" : "");
  div.innerHTML = `
    <div class="avatar"></div>
    <div class="content">
      <div class="who"><span class="name"></span><span class="role"></span></div>
      <div class="body"></div>
    </div>`;
  div.querySelector(".avatar").textContent = isYou ? "🧑" : (meta.emoji || "🤖");
  if (meta.color) {
    div.querySelector(".avatar").style.borderColor = meta.color;
    div.querySelector(".name").style.color = meta.color;
  }
  div.querySelector(".name").textContent = agent;
  div.querySelector(".role").textContent = isYou ? "founder" : (meta.role || "");
  $("#chat").appendChild(div);
  scrollChat();
  return div;
}

function updatePlanSection(key, content) {
  const sec = $(`#sec-${key}`);
  if (!sec) return;
  sec.querySelector(".sec-body").textContent = content;
  sec.classList.remove("updated");
  void sec.offsetWidth; // restart the flash animation
  sec.classList.add("updated");
}

function renderOpenQuestions(questions) {
  const box = $("#open-questions-box");
  const ul = $("#open-questions");
  ul.innerHTML = "";
  for (const q of questions || []) {
    const li = document.createElement("li");
    li.textContent = q;
    ul.appendChild(li);
  }
  box.hidden = !questions || questions.length === 0;
}

/* ---------- event handling (shared by live + replay) ---------- */

function handle(ev) {
  switch (ev.type) {
    case "session_started":
      sessionId = ev.session_id;
      (ev.agents || []).forEach((a) => { agentsMeta[a.name] = a; });
      setStatus(`The room is live — concept: “${ev.concept}”`);
      break;
    case "round_start":
      addRoundHeader(ev.round, ev.question);
      break;
    case "turn_start":
      lastBubble[ev.agent] = addBubble(ev.agent, { typing: true });
      break;
    case "token": {
      const b = lastBubble[ev.agent];
      if (b) { b.querySelector(".body").textContent += ev.text; scrollChat(); }
      break;
    }
    case "tool_use": {
      const b = lastBubble[ev.agent];
      if (b && !b.querySelector(".tool-chip")) {
        const chip = document.createElement("span");
        chip.className = "tool-chip";
        chip.textContent = `🔎 ${ev.agent} is searching the web…`;
        b.querySelector(".content").appendChild(chip);
        scrollChat();
      }
      break;
    }
    case "turn_end": {
      const b = lastBubble[ev.agent];
      if (b) {
        b.classList.remove("typing");
        b.querySelector(".body").textContent = ev.text;
        const chip = b.querySelector(".tool-chip");
        if (chip) chip.textContent = "🔎 searched the web";
        delete lastBubble[ev.agent];
      }
      break;
    }
    case "chat": {
      const b = addBubble(ev.agent);
      b.querySelector(".body").textContent = ev.text;
      break;
    }
    case "round_decision": {
      // decision text already streamed as a Moderator turn; mark the last
      // Moderator bubble as a committed decision
      const bubbles = document.querySelectorAll(".bubble");
      for (let i = bubbles.length - 1; i >= 0; i--) {
        if (bubbles[i].querySelector(".name")?.textContent === "Moderator") {
          bubbles[i].classList.add("decision");
          break;
        }
      }
      break;
    }
    case "plan_update":
      updatePlanSection(ev.section, ev.content);
      break;
    case "whiteboard":
      renderOpenQuestions(ev.open_questions);
      break;
    case "status":
      addSystemLine(ev.message);
      setStatus(ev.message);
      break;
    case "session_complete":
      finalMarkdown = ev.markdown || "";
      sessionId = ev.session_id || sessionId;
      $("#export-btn").hidden = false;
      setStatus(`Plan complete${ev.spent_usd != null ? ` · session cost $${ev.spent_usd}` : ""} — export it below.`);
      addSystemLine("✅ The team is done. The full plan is on the right.");
      break;
    case "error":
      addSystemLine(`⚠️ ${ev.message}`);
      setStatus(`Error: ${ev.message}`);
      break;
  }
}

/* ---------- live session ---------- */

function startSession(concept) {
  initPlanPanel();
  $("#chat").innerHTML = "";
  $("#layout").hidden = false;
  $("#concept-bar").hidden = true;
  $("#export-btn").hidden = true;

  const proto = location.protocol === "https:" ? "wss" : "ws";
  ws = new WebSocket(`${proto}://${location.host}/ws`);
  ws.onopen = () => ws.send(JSON.stringify({ type: "start", concept }));
  ws.onmessage = (e) => handle(JSON.parse(e.data));
  ws.onclose = () => { if (!finalMarkdown) setStatus("Connection closed."); };
  ws.onerror = () => setStatus("Connection error — is the server running?");
}

function interject() {
  const input = $("#interject-input");
  const text = input.value.trim();
  if (!text || !ws || ws.readyState !== WebSocket.OPEN || replaying) return;
  ws.send(JSON.stringify({ type: "user_message", text }));
  input.value = "";
}

/* ---------- replay ---------- */

async function loadReplayList() {
  try {
    const sessions = await (await fetch("/api/sessions")).json();
    const sel = $("#replay-select");
    for (const s of sessions.slice(0, 20)) {
      const opt = document.createElement("option");
      opt.value = s.id;
      opt.textContent = `↻ ${String(s.concept).slice(0, 48)}`;
      sel.appendChild(opt);
    }
  } catch { /* server not up yet — ignore */ }
}

async function replaySession(sid) {
  const data = await (await fetch(`/api/sessions/${sid}`)).json();
  replaying = true;
  initPlanPanel();
  $("#chat").innerHTML = "";
  $("#layout").hidden = false;
  $("#concept-bar").hidden = true;
  $("#interject-input").disabled = true;
  $("#interject-btn").disabled = true;
  setStatus("Replaying session at 2× speed…");
  for (const ev of data.events || []) {
    handle(ev);
    await new Promise((r) =>
      setTimeout(r, ev.type === "token" ? 8 : ev.type === "turn_start" ? 150 : 350));
  }
  setStatus("Replay finished.");
  replaying = false;
}

/* ---------- export ---------- */

function exportPlan() {
  const blob = new Blob([finalMarkdown], { type: "text/markdown" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "startup-plan.md";
  a.click();
  URL.revokeObjectURL(a.href);
}

/* ---------- wiring ---------- */

$("#start-btn").addEventListener("click", () => {
  const concept = $("#concept-input").value.trim();
  if (concept) startSession(concept);
});
$("#concept-input").addEventListener("keydown", (e) => {
  if (e.key === "Enter") $("#start-btn").click();
});
$("#interject-btn").addEventListener("click", interject);
$("#interject-input").addEventListener("keydown", (e) => {
  if (e.key === "Enter") interject();
});
$("#export-btn").addEventListener("click", exportPlan);
$("#replay-select").addEventListener("change", (e) => {
  if (e.target.value) replaySession(e.target.value);
});

initPlanPanel();
loadReplayList();
