/**
 * script.js — Round Robin Scheduler Frontend Logic
 * =================================================
 * Responsibilities:
 *   1. Manage the list of processes added by the user.
 *   2. Validate inputs before submitting.
 *   3. Send data to the Flask API via fetch().
 *   4. Render the Gantt chart, summary cards, and results table.
 */

"use strict";

// ═══════════════════════════════════════════════ CONFIG ═══
const API_BASE = "http://localhost:5000"; // Flask server URL

// ════════════════════════════════════════════════ STATE ═══
/**
 * processQueue: array of { name: string, burst_time: number }
 * This is the single source of truth for the process list.
 */
let processQueue = [];

// Color palette for Gantt chart blocks and process dots
const COLORS = [
  "#6c63ff", "#00d2ff", "#ff6b6b", "#ffd166",
  "#06d6a0", "#f72585", "#4cc9f0", "#f77f00",
  "#a8dadc", "#e63946"
];

// Map process name → color index for consistent coloring
const colorMap = {};

// ═══════════════════════════════════════════ INIT / HEALTH ═══
/**
 * On page load: check if the Flask server is reachable.
 * Updates the status badge in the header.
 */
window.addEventListener("DOMContentLoaded", () => {
  checkServerHealth();
  // Allow pressing Enter in the process name / burst time fields to add a process
  document.getElementById("procName").addEventListener("keydown", handleEnterKey);
  document.getElementById("burstTime").addEventListener("keydown", handleEnterKey);
});

/** Check the /health endpoint every 10 seconds */
async function checkServerHealth() {
  const dot    = document.getElementById("serverDot");
  const status = document.getElementById("serverStatus");

  try {
    const res = await fetch(`${API_BASE}/health`, { signal: AbortSignal.timeout(3000) });
    if (res.ok) {
      dot.className    = "badge-dot online";
      status.textContent = "Server Online";
    } else {
      throw new Error("Non-OK response");
    }
  } catch {
    dot.className    = "badge-dot offline";
    status.textContent = "Server Offline";
  }

  // Re-check after 10 seconds
  setTimeout(checkServerHealth, 10_000);
}

/** Let the user hit Enter inside name/burst fields to trigger Add */
function handleEnterKey(e) {
  if (e.key === "Enter") addProcess();
}

// ═══════════════════════════════════════════ PROCESS MANAGEMENT ═══

/**
 * Reads the process name and burst time from the input fields,
 * validates them, then appends the process to processQueue and re-renders the list.
 */
function addProcess() {
  const nameInput  = document.getElementById("procName");
  const burstInput = document.getElementById("burstTime");

  const name  = nameInput.value.trim();
  const burst = parseInt(burstInput.value.trim(), 10);

  // ── Validation ──
  if (!name) {
    showError("Please enter a process name.");
    nameInput.focus();
    return;
  }
  if (processQueue.some(p => p.name.toLowerCase() === name.toLowerCase())) {
    showError(`A process named "${name}" already exists. Use a unique name.`);
    nameInput.focus();
    return;
  }
  if (isNaN(burst) || burst <= 0) {
    showError("Burst time must be a positive integer.");
    burstInput.focus();
    return;
  }

  clearError();

  // Assign a stable color to this process
  if (!(name in colorMap)) {
    colorMap[name] = Object.keys(colorMap).length % COLORS.length;
  }

  // Add to state
  processQueue.push({ name, burst_time: burst });

  // Clear inputs and focus name field for quick entry of next process
  nameInput.value  = "";
  burstInput.value = "";
  nameInput.focus();

  renderProcessList();
}

/**
 * Removes a process from the queue by its index.
 */
function removeProcess(index) {
  processQueue.splice(index, 1);
  renderProcessList();
}

/**
 * Re-renders the <ul> process list based on the current processQueue array.
 */
function renderProcessList() {
  const list      = document.getElementById("processList");
  const emptyMsg  = document.getElementById("emptyMsg");
  const countPill = document.getElementById("procCount");

  countPill.textContent = processQueue.length;

  if (processQueue.length === 0) {
    list.innerHTML  = "";
    emptyMsg.classList.remove("hidden");
    return;
  }

  emptyMsg.classList.add("hidden");

  list.innerHTML = processQueue.map((p, i) => `
    <li class="process-item" id="proc-item-${i}">
      <div class="proc-info">
        <span class="proc-dot" style="background:${COLORS[colorMap[p.name] ?? 0]}"></span>
        <span class="proc-name">${escHtml(p.name)}</span>
        <span class="proc-burst">${p.burst_time} ms</span>
      </div>
      <button class="proc-remove" onclick="removeProcess(${i})" title="Remove ${escHtml(p.name)}">✕</button>
    </li>
  `).join("");
}

// ═══════════════════════════════════════════ SCHEDULER ═══

/**
 * Validates inputs, then POSTs to the Flask API.
 * On success, renders Gantt chart, summary cards, and results table.
 */
async function runScheduler() {
  clearError();

  const quantum = parseInt(document.getElementById("timeQuantum").value, 10);

  // ── Validation ──
  if (processQueue.length === 0) {
    showError("Please add at least one process before running the scheduler.");
    return;
  }
  if (isNaN(quantum) || quantum <= 0) {
    showError("Time Quantum must be a positive integer.");
    document.getElementById("timeQuantum").focus();
    return;
  }

  // ── Show Loading Overlay ──
  showLoading(true);

  try {
    const response = await fetch(`${API_BASE}/schedule`, {
      method : "POST",
      headers: { "Content-Type": "application/json" },
      body   : JSON.stringify({
        processes   : processQueue,    // [{ name, burst_time }, ...]
        time_quantum: quantum
      }),
      signal: AbortSignal.timeout(10_000)  // 10-second timeout
    });

    const data = await response.json();

    if (!response.ok) {
      // Flask returned an error (e.g., 400 with { "error": "..." })
      showError(data.error || "An unexpected error occurred on the server.");
      return;
    }

    // ── Render Results ──
    renderResults(data);

  } catch (err) {
    if (err.name === "TimeoutError") {
      showError("Request timed out. Is the Flask server running on port 5000?");
    } else {
      showError(`Could not connect to the server. Start it with: python app.py\n\nDetails: ${err.message}`);
    }
  } finally {
    showLoading(false);
  }
}

// ═══════════════════════════════════════════ RENDER RESULTS ═══

/**
 * Renders all output sections from the API response.
 * @param {Object} data  API response: { gantt_chart, results, avg_waiting_time, avg_turnaround_time }
 */
function renderResults(data) {
  // Show the results content area
  document.getElementById("placeholder").classList.add("hidden");
  document.getElementById("resultsContent").classList.remove("hidden");

  renderGanttChart(data.gantt_chart);
  renderSummaryCards(data.avg_waiting_time, data.avg_turnaround_time);
  renderTable(data.results);
  renderLegend(data.results);

  // Smooth-scroll to results on mobile
  if (window.innerWidth < 900) {
    document.getElementById("resultsPanel").scrollIntoView({ behavior: "smooth" });
  }
}

/**
 * Builds the Gantt chart from the execution sequence.
 * Each block's width is proportional to its run time.
 *
 * @param {Array} gantt  [{ name, start, end }, ...]
 */
function renderGanttChart(gantt) {
  const chartRow = document.getElementById("ganttChart");
  const timeRow  = document.getElementById("ganttTime");

  // Total execution time (last block's end)
  const totalTime = gantt.length ? gantt[gantt.length - 1].end : 1;
  const BASE_W    = 600; // reference width in px for proportional scaling

  chartRow.innerHTML = "";
  timeRow.innerHTML  = "";

  gantt.forEach(block => {
    const duration  = block.end - block.start;
    const widthPct  = (duration / totalTime) * 100;
    const colorIdx  = colorMap[block.name] ?? 0;
    const color     = COLORS[colorIdx];

    const div = document.createElement("div");
    div.className    = "gantt-block";
    div.style.width  = `${widthPct}%`;
    div.style.minWidth = "32px";
    div.style.background = color;
    div.textContent  = block.name;
    div.title        = `${block.name}: t=${block.start} → ${block.end} (${duration} ms)`;
    chartRow.appendChild(div);
  });

  // Time ticks: one per unique boundary
  const ticks = [...new Set(gantt.flatMap(b => [b.start, b.end]))].sort((a,b)=>a-b);

  ticks.forEach((tick, i) => {
    const span = document.createElement("span");
    span.className   = "gantt-tick";
    const prevTick   = ticks[i - 1] ?? gantt[0].start;
    const gap        = tick - prevTick;
    // Position tick labels by width proportional to the segment they follow
    span.style.width = i === 0
      ? "0px"
      : `${(gap / totalTime) * 100}%`;
    span.style.display = "inline-block";
    span.textContent = tick;
    timeRow.appendChild(span);
  });
}

/**
 * Updates the two summary cards with average times.
 */
function renderSummaryCards(avgWaiting, avgTurnaround) {
  document.getElementById("avgWaiting").textContent    = avgWaiting;
  document.getElementById("avgTurnaround").textContent = avgTurnaround;
}

/**
 * Fills the results table with per-process data.
 * @param {Array} results  [{ name, burst_time, waiting_time, turnaround_time, completion_time }, ...]
 */
function renderTable(results) {
  const tbody = document.getElementById("resultsBody");
  tbody.innerHTML = results.map((r, i) => {
    const color = COLORS[colorMap[r.name] ?? i % COLORS.length];
    return `
      <tr>
        <td>
          <span style="display:inline-flex;align-items:center;gap:8px;">
            <span style="width:10px;height:10px;border-radius:50%;background:${color};flex-shrink:0;"></span>
            ${escHtml(r.name)}
          </span>
        </td>
        <td>${r.burst_time}</td>
        <td>${r.completion_time}</td>
        <td>${r.waiting_time}</td>
        <td>${r.turnaround_time}</td>
      </tr>
    `;
  }).join("");
}

/**
 * Renders a color legend below the Gantt chart.
 */
function renderLegend(results) {
  const legend = document.getElementById("ganttLegend");
  const seen   = new Set();
  legend.innerHTML = results
    .filter(r => { const dup = seen.has(r.name); seen.add(r.name); return !dup; })
    .map(r => {
      const color = COLORS[colorMap[r.name] ?? 0];
      return `
        <div class="legend-item">
          <span class="legend-swatch" style="background:${color}"></span>
          <span>${escHtml(r.name)} (BT: ${r.burst_time} ms)</span>
        </div>
      `;
    }).join("");
}

// ═══════════════════════════════════════════ RESET ═══

/**
 * Clears all state and returns the UI to its initial blank state.
 */
function resetAll() {
  // Clear state
  processQueue.length = 0;
  for (const k in colorMap) delete colorMap[k];

  // Reset input fields
  document.getElementById("procName").value   = "";
  document.getElementById("burstTime").value  = "";
  document.getElementById("timeQuantum").value = "2";

  // Re-render empty process list
  renderProcessList();

  // Hide results content, show placeholder
  document.getElementById("resultsContent").classList.add("hidden");
  document.getElementById("placeholder").classList.remove("hidden");

  clearError();
}

// ═══════════════════════════════════════════ HELPERS ═══

/** Show an error message in the error box */
function showError(msg) {
  const box = document.getElementById("errorBox");
  box.textContent = msg;
  box.classList.remove("hidden");
  // Restart the shake animation
  box.style.animation = "none";
  box.offsetHeight;                // reflow
  box.style.animation = "";
}

/** Hide the error box */
function clearError() {
  document.getElementById("errorBox").classList.add("hidden");
}

/** Toggle the full-screen loading overlay */
function showLoading(show) {
  document.getElementById("loadingOverlay").classList.toggle("hidden", !show);
}

/** Escape HTML special characters to prevent XSS when building innerHTML */
function escHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
