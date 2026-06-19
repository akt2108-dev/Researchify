const steps = {
  1: { label: "Search Agent" },
  2: { label: "Reader Agent" },
  3: { label: "Writer" },
  4: { label: "Critic" },
};

const state = {
  active: false,
  currentRunId: null,
  currentStep: null,
  eventSource: null,
  retryCount: 0,
  runCount: Number(localStorage.getItem("researchRunCount") || "0"),
  history: JSON.parse(localStorage.getItem("researchHistory") || "[]"),
  reportMarkdown: "",
  feedbackText: "",
  startTime: null,
  elapsedTimer: null,
  stepTimers: {},
  typewriter: Promise.resolve(),
};

const dom = {
  form: document.getElementById("researchForm"),
  input: document.getElementById("topicInput"),
  submit: document.getElementById("submitButton"),
  charCount: document.getElementById("charCount"),
  topicZone: document.getElementById("topicZone"),
  terminal: document.getElementById("terminal"),
  streamLabel: document.getElementById("streamLabel"),
  runStatus: document.getElementById("runStatus"),
  elapsedTime: document.getElementById("elapsedTime"),
  runCount: document.getElementById("runCount"),
  historyList: document.getElementById("historyList"),
  sidebar: document.getElementById("sidebar"),
  reportZone: document.getElementById("reportZone"),
  reportContent: document.getElementById("reportContent"),
  criticBox: document.getElementById("criticBox"),
  criticHeader: document.getElementById("criticHeader"),
  criticFeedback: document.getElementById("criticFeedback"),
  criticToggleIcon: document.getElementById("criticToggleIcon"),
  copyReport: document.getElementById("copyReport"),
  downloadReport: document.getElementById("downloadReport"),
  newResearch: document.getElementById("newResearch"),
  completionFlash: document.getElementById("completionFlash"),
  connectionStatus: document.getElementById("connectionStatus"),
};

function init() {
  dom.runCount.textContent = state.runCount;
  renderHistory();
  updateCharCount();
  bindEvents();
  checkBackendHealth();
  if (window.lucide) {
    window.lucide.createIcons();
  }
}

function bindEvents() {
  dom.form.addEventListener("submit", (event) => {
    event.preventDefault();
    submitResearch();
  });

  dom.input.addEventListener("input", updateCharCount);

  document.addEventListener("keydown", (event) => {
    if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
      event.preventDefault();
      submitResearch();
    }

    if (event.key === "Escape" && !state.active) {
      dom.input.value = "";
      updateCharCount();
      dom.input.focus();
    }
  });

  dom.copyReport.addEventListener("click", copyReport);
  dom.downloadReport.addEventListener("click", downloadReport);
  dom.newResearch.addEventListener("click", resetUi);

  dom.criticHeader.addEventListener("click", () => {
    dom.criticBox.classList.toggle("is-minimized");
    const isMin = dom.criticBox.classList.contains("is-minimized");
    dom.criticToggleIcon.setAttribute("data-lucide", isMin ? "chevron-down" : "chevron-up");
    if (window.lucide) {
      window.lucide.createIcons();
    }
  });
}

function updateCharCount() {
  dom.charCount.textContent = dom.input.value.length;
}

async function checkBackendHealth() {
  try {
    const response = await fetch("/health", { cache: "no-store" });
    if (!response.ok) {
      throw new Error("Health check failed.");
    }
    setConnectionStatus(true);
  } catch {
    setConnectionStatus(false);
  }
}

function setConnectionStatus(online) {
  dom.connectionStatus.classList.toggle("is-online", online);
  dom.connectionStatus.classList.toggle("is-offline", !online);
  dom.connectionStatus.querySelector("span:last-child").textContent = online ? "Backend live" : "Backend offline";
}

async function submitResearch() {
  const topic = dom.input.value.trim();
  if (!topic || state.active) {
    return;
  }

  setActive(true);
  resetRunSurface();
  addHistory(topic);
  state.runCount += 1;
  localStorage.setItem("researchRunCount", String(state.runCount));
  dom.runCount.textContent = state.runCount;
  startElapsedTimer();
  setStatus("Starting");

  try {
    const response = await fetch("/research", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ topic }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.detail || "Unable to start research run.");
    }

    const payload = await response.json();
    state.currentRunId = payload.run_id;
    connectStream(payload.run_id);
  } catch (error) {
    handleError({ message: error.message || String(error) });
  }
}

function connectStream(runId) {
  closeStream();
  state.retryCount = 0;
  openStream(runId);
}

function openStream(runId) {
  state.eventSource = new EventSource(`/stream/${runId}`);

  state.eventSource.onmessage = (message) => {
    const event = JSON.parse(message.data);
    handlePipelineEvent(event);
  };

  state.eventSource.onerror = () => {
    closeStream();
    if (!state.active || state.retryCount >= 3) {
      if (state.active) {
        handleError({ message: "Stream disconnected after 3 retries." });
      }
      return;
    }

    state.retryCount += 1;
    setStatus(`Reconnecting ${state.retryCount}/3`);
    window.setTimeout(() => openStream(runId), 700 * state.retryCount);
  };
}

function handlePipelineEvent(event) {
  if (event.event === "step_start") {
    startStep(event.step, event.label);
  }

  if (event.event === "step_output") {
    appendStepOutput(event.step, event.content || "");
  }

  if (event.event === "step_done") {
    finishStep(event.step);
  }

  if (event.event === "pipeline_complete") {
    completePipeline(event);
  }

  if (event.event === "error") {
    handleError(event);
  }
}

function startStep(step, label) {
  state.currentStep = step;
  state.stepTimers[step] = performance.now();
  setStatus(label);
  dom.streamLabel.textContent = `Step ${step} running`;
  setStepState(step, "running");

  const section = getOrCreateStepSection(step, label);
  section.classList.add("is-running");
  section.classList.remove("is-collapsed");
}

function appendStepOutput(step, content) {
  const section = getOrCreateStepSection(step, steps[step].label);
  const body = section.querySelector(".step-body");
  state.typewriter = state.typewriter.then(() => typeText(body, content));
}

function finishStep(step) {
  setStepState(step, "done");
  const section = getOrCreateStepSection(step, steps[step].label);
  const elapsed = formatElapsed((performance.now() - state.stepTimers[step]) / 1000);
  section.classList.remove("is-running");
  section.classList.add("is-collapsed");
  section.querySelector(".step-header-meta").innerHTML = `<span class="done-badge">DONE</span><span>${elapsed}</span>`;
  dom.streamLabel.textContent = `Step ${step} complete`;
}

function completePipeline(event) {
  state.reportMarkdown = event.report || "";
  state.feedbackText = event.feedback || "";
  setActive(false);
  stopElapsedTimer();
  closeStream();
  state.typewriter.then(() => {
    dom.reportContent.innerHTML = window.marked ? window.marked.parse(state.reportMarkdown) : escapeHtml(state.reportMarkdown);
    dom.criticFeedback.textContent = state.feedbackText;
    
    document.querySelector('.main-panel').classList.add('report-mode');
    dom.criticBox.classList.add('is-minimized');
    dom.criticToggleIcon.setAttribute('data-lucide', 'chevron-down');
    if (window.lucide) {
      window.lucide.createIcons();
    }

    dom.reportZone.classList.add("is-visible");
    dom.reportZone.setAttribute("aria-hidden", "false");
    dom.reportZone.scrollIntoView({ behavior: "smooth", block: "start" });
    flashCompletion();
    setStatus("Complete");
    dom.streamLabel.textContent = "Pipeline complete";
  });
}

function handleError(event) {
  const step = event.step || state.currentStep;
  if (step) {
    setStepState(step, "error");
  }
  appendTerminalError(event.message || "Unknown pipeline error.");
  setStatus("Error");
  dom.streamLabel.textContent = "Run failed";
  setActive(false);
  stopElapsedTimer();
  closeStream();
}

function setStepState(step, mode) {
  const node = document.querySelector(`.timeline-step[data-step="${step}"]`);
  if (!node) {
    return;
  }

  node.classList.remove("is-idle", "is-running", "is-done", "is-error");
  node.classList.add(`is-${mode}`);
  node.querySelector(".step-status").textContent = mode;
}

function getOrCreateStepSection(step, label) {
  const id = `step-section-${step}`;
  let section = document.getElementById(id);
  if (section) {
    return section;
  }

  clearTerminalEmpty();
  section = document.createElement("section");
  section.id = id;
  section.className = "step-section";
  section.innerHTML = `
    <div class="step-header" role="button" tabindex="0">
      <span>&gt; STEP ${step} - ${escapeHtml(label).toUpperCase()}</span>
      <span class="step-header-meta">RUNNING</span>
    </div>
    <div class="step-body"></div>
  `;

  const header = section.querySelector(".step-header");
  header.addEventListener("click", () => section.classList.toggle("is-collapsed"));
  header.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      section.classList.toggle("is-collapsed");
    }
  });

  dom.terminal.appendChild(section);
  scrollTerminal();
  return section;
}

function typeText(target, text) {
  return new Promise((resolve) => {
    if (!text) {
      resolve();
      return;
    }

    let index = 0;
    const batch = () => {
      const slice = text.slice(index, index + 5);
      target.textContent += slice;
      index += slice.length;
      scrollTerminal();

      if (index < text.length) {
        window.setTimeout(batch, 8);
      } else {
        target.textContent += "\n";
        resolve();
      }
    };

    batch();
  });
}

function appendTerminalError(message) {
  clearTerminalEmpty();
  const error = document.createElement("div");
  error.className = "terminal-error";
  error.textContent = `ERROR: ${message}`;
  dom.terminal.appendChild(error);
  scrollTerminal();
}

function clearTerminalEmpty() {
  const empty = dom.terminal.querySelector(".terminal-empty");
  if (empty) {
    empty.remove();
  }
}

function resetRunSurface() {
  document.querySelector('.main-panel').classList.remove('report-mode');
  state.currentStep = null;
  state.reportMarkdown = "";
  state.feedbackText = "";
  state.stepTimers = {};
  state.typewriter = Promise.resolve();
  dom.terminal.innerHTML = '<div class="terminal-empty">Pipeline output will stream here.</div>';
  dom.reportContent.innerHTML = "";
  dom.criticFeedback.textContent = "";
  dom.reportZone.classList.remove("is-visible");
  dom.reportZone.setAttribute("aria-hidden", "true");
  dom.streamLabel.textContent = "Awaiting stream";
  document.querySelectorAll(".timeline-step").forEach((node) => {
    node.classList.remove("is-running", "is-done", "is-error");
    node.classList.add("is-idle");
    node.querySelector(".step-status").textContent = "Idle";
  });
}

function resetUi() {
  closeStream();
  setActive(false);
  stopElapsedTimer();
  resetRunSurface();
  setStatus("Idle");
  dom.elapsedTime.textContent = "00:00";
  dom.input.value = "";
  updateCharCount();
  dom.input.focus();
}

function setActive(active) {
  state.active = active;
  dom.input.disabled = active;
  dom.submit.disabled = active;
  dom.topicZone.classList.toggle("is-locked", active);
}

function setStatus(status) {
  dom.runStatus.textContent = status;
}

function startElapsedTimer() {
  stopElapsedTimer();
  state.startTime = Date.now();
  dom.elapsedTime.textContent = "00:00";
  state.elapsedTimer = window.setInterval(() => {
    dom.elapsedTime.textContent = formatElapsed((Date.now() - state.startTime) / 1000);
  }, 250);
}

function stopElapsedTimer() {
  if (state.elapsedTimer) {
    window.clearInterval(state.elapsedTimer);
    state.elapsedTimer = null;
  }
}

function formatElapsed(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = Math.floor(totalSeconds % 60);
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function addHistory(topic) {
  state.history = [topic, ...state.history.filter((item) => item !== topic)].slice(0, 5);
  localStorage.setItem("researchHistory", JSON.stringify(state.history));
  renderHistory();
}

function renderHistory() {
  if (!state.history.length) {
    dom.historyList.innerHTML = '<li class="empty-history">No runs yet</li>';
    return;
  }

  dom.historyList.innerHTML = "";
  state.history.forEach((topic) => {
    const item = document.createElement("li");
    item.textContent = topic;
    item.title = topic;
    dom.historyList.appendChild(item);
  });
}

async function copyReport() {
  if (!state.reportMarkdown) {
    return;
  }
  await navigator.clipboard.writeText(state.reportMarkdown);
  dom.copyReport.querySelector("span:last-child").textContent = "Copied";
  window.setTimeout(() => {
    dom.copyReport.querySelector("span:last-child").textContent = "Copy Report";
  }, 1000);
}

function downloadReport() {
  if (!state.reportMarkdown) {
    return;
  }

  const blob = new Blob([state.reportMarkdown], { type: "text/markdown" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "research-report.md";
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function flashCompletion() {
  dom.completionFlash.classList.remove("is-active");
  void dom.completionFlash.offsetWidth;
  dom.completionFlash.classList.add("is-active");
}

function closeStream() {
  if (state.eventSource) {
    state.eventSource.close();
    state.eventSource = null;
  }
}

function scrollTerminal() {
  dom.terminal.scrollTop = dom.terminal.scrollHeight;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

init();
