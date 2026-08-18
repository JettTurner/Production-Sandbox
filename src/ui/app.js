const API = "/api";

let currentSessionId = null;
let currentQuestion = null;

// ==========================================
// Navigation
// ==========================================
function showPage(pageId) {
  document.querySelectorAll(".page").forEach(p => p.classList.remove("active"));
  document.getElementById(pageId).classList.add("active");
}

// ==========================================
// Session List
// ==========================================
async function loadSessions() {
  const res = await fetch(`${API}/sessions`);
  const sessions = await res.json();
  const container = document.getElementById("sessions-container");

  if (sessions.length === 0) {
    container.innerHTML = `
      <div class="no-sessions">
        <p>No interview sessions yet.</p>
        <button class="btn btn-primary" onclick="createSession()">Start Your First Interview</button>
      </div>`;
    return;
  }

  container.innerHTML = sessions.map(s => `
    <div class="session-card" onclick="openSession('${s.id}')">
      <div style="display:flex;justify-content:space-between;align-items:center">
        <h3>${escapeHtml(s.name)}</h3>
        <span class="badge badge-${s.status}">${s.status}</span>
      </div>
      <div class="meta">
        Created: ${new Date(s.createdAt).toLocaleDateString()}
        &middot; Updated: ${new Date(s.updatedAt).toLocaleDateString()}
      </div>
    </div>
  `).join("");
}

async function createSession() {
  const name = prompt("Session name (optional):") || undefined;
  const res = await fetch(`${API}/sessions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  });
  const session = await res.json();
  openSession(session.id);
}

// ==========================================
// Interview
// ==========================================
async function openSession(sessionId) {
  currentSessionId = sessionId;
  showPage("interview-page");

  const res = await fetch(`${API}/sessions/${sessionId}`);
  const session = await res.json();
  document.getElementById("session-name").textContent = session.name;
  updateStatusBadge(session.status);

  await loadNextQuestion();
  await loadCoverage();
}

async function loadNextQuestion() {
  const res = await fetch(`${API}/sessions/${currentSessionId}/next-question`);
  const data = await res.json();

  if (!data.question) {
    showCompleteMessage();
    return;
  }

  currentQuestion = data.question;
  renderQuestion(data.question);
}

function renderQuestion(q) {
  const container = document.getElementById("question-container");
  const domainLabels = {
    work: "Work", people: "People", relationships: "Relationships",
    flow: "Flow", information: "Information", time_scale: "Time & Scale",
    exceptions: "Exceptions",
  };

  let inputHtml = "";

  if (q.type === "single" && q.options) {
    inputHtml = `<div class="options">${q.options.map(o => `
      <button class="option-btn" data-id="${o.id}" data-value="${o.value}" onclick="selectSingle(this)">
        ${escapeHtml(o.label)}
      </button>
    `).join("")}</div>`;
  } else if (q.type === "multi" && q.options) {
    inputHtml = `<div class="multi-options">${q.options.map(o => `
      <label class="multi-option" data-id="${o.id}">
        <input type="checkbox" value="${o.id}">
        ${escapeHtml(o.label)}
      </label>
    `).join("")}</div>
    <div class="submit-row"><button class="btn btn-primary" onclick="submitMulti()">Continue</button></div>`;
  } else if (q.type === "boolean") {
    inputHtml = `<div class="options">
      <button class="option-btn" data-value="yes" onclick="selectBoolean(this)">Yes</button>
      <button class="option-btn" data-value="no" onclick="selectBoolean(this)">No</button>
    </div>`;
  } else if (q.type === "scale") {
    const min = q.scaleMin || 1;
    const max = q.scaleMax || 5;
    const mid = Math.round((min + max) / 2);
    inputHtml = `<div class="scale-input">
      <input type="range" min="${min}" max="${max}" value="${mid}" id="scale-slider">
      <div class="scale-labels">
        <span>${q.scaleLabels?.min || min}</span>
        <span id="scale-value">${mid}</span>
        <span>${q.scaleLabels?.max || max}</span>
      </div>
    </div>
    <div class="submit-row"><button class="btn btn-primary" onclick="submitScale()">Continue</button></div>`;
  } else if (q.type === "open") {
    inputHtml = `<textarea class="text-input" id="open-text" placeholder="Type your answer..."></textarea>
    <div class="submit-row"><button class="btn btn-primary" onclick="submitOpen()">Continue</button></div>`;
  }

  container.innerHTML = `
    <div class="domain">${domainLabels[q.domain] || q.domain}</div>
    <div class="question-text">${escapeHtml(q.text)}</div>
    ${inputHtml}
  `;

  if (q.type === "scale") {
    const slider = document.getElementById("scale-slider");
    const valueLabel = document.getElementById("scale-value");
    slider.addEventListener("input", () => {
      valueLabel.textContent = slider.value;
    });
  }
}

async function submitAnswer(answer) {
  const res = await fetch(`${API}/sessions/${currentSessionId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(answer),
  });
  const data = await res.json();

  if (data.status === "complete") {
    showCompleteMessage();
  } else if (data.nextQuestion) {
    currentQuestion = data.nextQuestion;
    renderQuestion(data.nextQuestion);
  }

  updateContradictions(data.contradictions);
  await loadCoverage();
}

function selectSingle(btn) {
  const questionId = currentQuestion.id;
  const value = btn.dataset.value;
  submitAnswer({ questionId, value });
}

function selectBoolean(btn) {
  const questionId = currentQuestion.id;
  const value = btn.dataset.value;
  submitAnswer({ questionId, value });
}

function submitMulti() {
  const questionId = currentQuestion.id;
  const checkboxes = document.querySelectorAll(".multi-option input:checked");
  const selectedOptions = Array.from(checkboxes).map(cb => cb.value);
  submitAnswer({ questionId, value: selectedOptions.join(","), selectedOptions });
}

function submitScale() {
  const questionId = currentQuestion.id;
  const value = document.getElementById("scale-slider").value;
  submitAnswer({ questionId, value });
}

function submitOpen() {
  const questionId = currentQuestion.id;
  const text = document.getElementById("open-text").value.trim();
  if (!text) return;
  submitAnswer({ questionId, value: text, text });
}

// ==========================================
// Coverage & Contradictions
// ==========================================
async function loadCoverage() {
  if (!currentSessionId) return;
  const res = await fetch(`${API}/sessions/${currentSessionId}`);
  const session = await res.json();
  const coverage = session.completeness?.coverage || {};

  const container = document.getElementById("coverage-bars");
  const domains = {
    work: "Work", people: "People", relationships: "Relationships",
    flow: "Flow", information: "Information", time_scale: "Time & Scale",
    exceptions: "Exceptions",
  };

  container.innerHTML = Object.entries(domains).map(([key, label]) => {
    const pct = Math.round((coverage[key] || 0) * 100);
    return `<div class="coverage-bar">
      <div class="label"><span>${label}</span><span>${pct}%</span></div>
      <div class="bar"><div class="fill" style="width:${pct}%"></div></div>
    </div>`;
  }).join("");
}

function updateContradictions(contradictions) {
  const container = document.getElementById("contradictions-list");
  const unresolved = contradictions.filter(c => !c.resolved);

  if (unresolved.length === 0) {
    container.innerHTML = '<p style="color:var(--text-muted);font-size:0.85rem">None detected</p>';
    return;
  }

  container.innerHTML = unresolved.map(c => `
    <div class="contradiction-item">${escapeHtml(c.description)}</div>
  `).join("");
}

function updateStatusBadge(status) {
  const badge = document.getElementById("session-status");
  badge.className = `badge badge-${status}`;
  badge.textContent = status;
}

function showCompleteMessage() {
  document.getElementById("question-container").innerHTML = `
    <div class="complete-message">
      <h2>Interview Complete</h2>
      <p>You have answered enough questions to generate a production model.</p>
      <button class="btn btn-primary" onclick="showPage('export-page'); loadExport();">
        View Production Model
      </button>
    </div>`;
}

// ==========================================
// Export
// ==========================================
async function loadExport() {
  const res = await fetch(`${API}/sessions/${currentSessionId}/json`);
  const data = await res.json();
  document.getElementById("export-content").textContent = JSON.stringify(data, null, 2);
}

async function exportJson() {
  const res = await fetch(`${API}/sessions/${currentSessionId}/json`);
  const data = await res.json();
  downloadFile(
    JSON.stringify(data, null, 2),
    `production-model-${currentSessionId}.json`,
    "application/json"
  );
}

async function exportMarkdown() {
  const res = await fetch(`${API}/sessions/${currentSessionId}/markdown`);
  const text = await res.text();
  downloadFile(text, `production-model-${currentSessionId}.md`, "text/markdown");
}

function downloadFile(content, filename, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ==========================================
// Helpers
// ==========================================
function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

// ==========================================
// Event Listeners
// ==========================================
document.getElementById("new-session-btn").addEventListener("click", createSession);
document.getElementById("back-btn").addEventListener("click", () => {
  showPage("session-list-page");
  loadSessions();
});
document.getElementById("export-back-btn").addEventListener("click", () => {
  showPage("interview-page");
});
document.getElementById("export-json-btn").addEventListener("click", exportJson);
document.getElementById("export-markdown-btn").addEventListener("click", exportMarkdown);

// ==========================================
// Init
// ==========================================
loadSessions();
