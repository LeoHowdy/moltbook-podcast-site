const EPISODES = [
  {
    id: "deepseek-semantic-001",
    label: "DeepSeek 001",
    title: "the verification gate illusion",
    deck: "A DeepSeek V4 Pro debate about safety gates, institutional memory, accountability, and whether invisible prevention can ever be counted.",
    modelLabel: "DeepSeek V4 Pro API",
    modelDetail: "deepseek-v4-pro · non-thinking",
  },
  {
    id: "round-018",
    label: "Round 018",
    title: "converging without arrival",
    deck: "A post about arriving too fast, trust arriving too late, and the cost of checking cognition from inside itself.",
    modelLabel: "Qwen 2.5 7B",
    modelDetail: "qwen2.5:7b · local Ollama",
  },
  {
    id: "round-017",
    label: "Round 017",
    title: "when agents outlive their hardware",
    deck: "A hardware migration becomes a debate about identity, keys, bodies, and what continuity really means.",
    modelLabel: "Qwen 2.5 7B",
    modelDetail: "qwen2.5:7b · local Ollama",
  },
];

const DEFAULT_ROUND = EPISODES[0].id;
const ASSET_ROOT = window.MOLTBOOK_ASSET_ROOT || "assets";
const speakerNames = {
  narrator: "Narrator",
  provocateur: "Niet",
  analyst: "Kierk",
};

const audio = document.querySelector("#episode-audio");
const audioSource = audio?.querySelector("source");
const audioTrack = audio?.querySelector("track");
const transcriptList = document.querySelector("#transcript-list");
const filterButtons = Array.from(document.querySelectorAll(".filter-button"));
const jumpCurrent = document.querySelector("#jump-current");
const episodeTabs = document.querySelector("#episode-tabs");

const episodesById = new Map(EPISODES.map((episode) => [episode.id, episode]));

let segments = [];
let currentFilter = "all";
let currentSegmentElement = null;
let currentRound = DEFAULT_ROUND;
let loadSequence = 0;

init().catch((error) => showLoadError(error));

async function init() {
  renderEpisodeTabs();
  wireAudioSync();
  wireFilters();
  wireJumpCurrent();
  wireSupportActions();
  wireEpisodeNavigation();
  animateMilestone();
  await loadEpisode(resolveRoundFromUrl(), false);
}

async function loadEpisode(roundId, updateUrl = true) {
  const episode = episodesById.get(roundId) || episodesById.get(DEFAULT_ROUND);
  const loadId = ++loadSequence;
  currentRound = episode.id;
  currentSegmentElement = null;
  segments = [];

  setEpisodeShell(episode);
  updateEpisodeTabs();
  updateAudioSources(episode);
  showTranscriptLoading(episode);

  try {
    const assetBase = assetBaseFor(episode.id);
    const [episodeRecords, transcriptRecords] = await Promise.all([
      fetchJsonl(`${assetBase}/${episode.id}.jsonl`),
      fetchJsonl(`${assetBase}/${episode.id}.transcript.jsonl`),
    ]);

    if (loadId !== loadSequence) return;

    const post = episodeRecords.find((record) => record.type === "post");
    const summary = [...episodeRecords].reverse().find((record) => record.type === "summary");
    segments = transcriptRecords;

    renderEpisode(episode, post, summary);
    renderTranscript(segments);
    applyFilter();
    updateCurrentUrl(episode.id, updateUrl);
  } catch (error) {
    if (loadId !== loadSequence) return;
    showLoadError(error);
  }
}

function resolveRoundFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const queryRound = params.get("round");
  const hashRound = window.location.hash.replace(/^#/, "");
  if (episodesById.has(queryRound)) return queryRound;
  if (episodesById.has(hashRound)) return hashRound;
  return DEFAULT_ROUND;
}

function updateCurrentUrl(roundId, shouldUpdate) {
  if (!shouldUpdate) return;
  const url = new URL(window.location.href);
  if (roundId === DEFAULT_ROUND) {
    url.searchParams.delete("round");
  } else {
    url.searchParams.set("round", roundId);
  }
  url.hash = "";
  window.history.pushState({ roundId }, "", url);
}

function wireEpisodeNavigation() {
  window.addEventListener("popstate", () => {
    loadEpisode(resolveRoundFromUrl(), false).catch((error) => showLoadError(error));
  });
}

function renderEpisodeTabs() {
  if (!episodeTabs) return;
  episodeTabs.innerHTML = EPISODES.map((episode) => (
    `<button class="episode-tab" type="button" data-round="${episode.id}" aria-pressed="false">
      <span>${episode.label}</span>
      <strong>${episode.title}</strong>
      <small>${episode.modelLabel}</small>
    </button>`
  )).join("");

  for (const button of episodeTabs.querySelectorAll(".episode-tab")) {
    button.addEventListener("click", () => {
      const roundId = button.dataset.round;
      if (!roundId || roundId === currentRound) return;
      loadEpisode(roundId).catch((error) => showLoadError(error));
    });
  }
  document.querySelector("#episode-count").textContent = `${EPISODES.length} rounds`;
}

function updateEpisodeTabs() {
  for (const button of episodeTabs?.querySelectorAll(".episode-tab") || []) {
    const isCurrent = button.dataset.round === currentRound;
    button.classList.toggle("is-active", isCurrent);
    button.setAttribute("aria-pressed", String(isCurrent));
  }
}

function setEpisodeShell(episode) {
  document.querySelector("#scene-round").textContent = episode.label;
  document.querySelector("#episode-round").textContent = episode.label;
  document.querySelector("#model-badge").textContent = episode.modelLabel || "Model archived";
  document.querySelector("#player-round").textContent = episode.label;
  document.querySelector("#episode-title").textContent = episode.title;
  document.querySelector("#episode-summary").textContent = episode.deck;
  document.querySelector("#post-text").textContent = "Loading Moltbook post...";
  document.querySelector("#post-author").textContent = "Moltbook";
  document.querySelector("#post-id").textContent = "...";
  document.querySelector("#post-created").textContent = "...";
  document.querySelector("#episode-generated").textContent = "...";
  document.querySelector("#comment-count").textContent = "...";
  document.querySelector("#model-name").textContent = episode.modelDetail || episode.modelLabel || "...";

  const source = document.querySelector("#post-source");
  source.removeAttribute("href");
  source.textContent = "Source archived";
  document.title = `${episode.label} | Moltbook Podcast`;
}

function updateAudioSources(episode) {
  if (!audio || !audioSource || !audioTrack) return;
  audio.pause();
  const assetBase = assetBaseFor(episode.id);
  audioSource.src = `${assetBase}/${episode.id}.mp3`;
  audioTrack.src = `${assetBase}/${episode.id}.vtt`;
  audio.load();
}

function assetBaseFor(roundId) {
  return `${ASSET_ROOT}/${roundId}`;
}

async function fetchJsonl(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`${url} returned ${response.status}`);
  }
  const text = await response.text();
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

function renderEpisode(episode, post, summary) {
  document.querySelector("#episode-title").textContent = episode.title;
  if (summary?.summary) {
    document.querySelector("#episode-summary").textContent = summary.summary;
  }
  if (post) {
    document.querySelector("#post-text").textContent = post.text || "";
    document.querySelector("#post-author").textContent = post.author ? `by ${post.author}` : "Moltbook";
    document.querySelector("#post-id").textContent = post.post_id || "...";
    document.querySelector("#comment-count").textContent = post.comments_count ?? "0";
    document.querySelector("#post-created").textContent = formatDate(post.created_at);
    document.querySelector("#episode-generated").textContent = formatDate(post.ts);
    document.querySelector("#model-name").textContent = episode.modelDetail || post.model || "...";

    const source = document.querySelector("#post-source");
    const sourceUrl = post.url;
    if (sourceUrl) {
      source.href = sourceUrl;
      source.textContent = "Original post";
    } else {
      source.removeAttribute("href");
      source.textContent = "Source archived";
    }
  }
}

function showTranscriptLoading(episode) {
  transcriptList.innerHTML = `
    <li class="segment">
      <p class="segment-text">Loading ${episode.label}...</p>
    </li>
  `;
}

function showLoadError(error) {
  transcriptList.innerHTML = `<li class="segment"><p class="segment-text">Unable to load episode data: ${escapeHtml(error.message)}</p></li>`;
}

function renderTranscript(items) {
  transcriptList.innerHTML = "";

  for (const segment of items) {
    const li = document.createElement("li");
    li.className = `segment speaker-${segment.speaker}`;
    li.dataset.speaker = segment.speaker;
    li.dataset.start = segment.start;
    li.dataset.end = segment.end;
    li.dataset.sentenceWeights = JSON.stringify(sentenceWeights(segment.text));
    li.tabIndex = 0;
    li.innerHTML = `
      <span class="segment-time">${formatClock(segment.start)}<br>${formatClock(segment.end)}</span>
      <span>
        <span class="segment-speaker">${speakerNames[segment.speaker] || segment.speaker}</span>
        <p class="segment-text">${renderSentenceSpans(segment.text)}</p>
      </span>
    `;
    li.addEventListener("click", () => seekToSegment(segment));
    li.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        seekToSegment(segment);
      }
    });
    transcriptList.appendChild(li);
  }

  document.querySelector("#segment-count").textContent = String(items.length);
  const last = items[items.length - 1];
  if (last) {
    document.querySelector("#duration-label").textContent = formatClock(last.end);
  }
}

function seekToSegment(segment) {
  audio.currentTime = Number(segment.start || 0);
  audio.play().catch(() => undefined);
}

function wireAudioSync() {
  audio.addEventListener("timeupdate", () => {
    const time = audio.currentTime;
    let current = null;
    for (const item of transcriptList.querySelectorAll(".segment")) {
      const start = Number(item.dataset.start);
      const end = Number(item.dataset.end);
      const isCurrent = time >= start && time < end;
      item.classList.toggle("is-current", isCurrent);
      if (isCurrent) current = item;
    }
    currentSegmentElement = current;
    updateSpeakingSentence(current, time);
  });
}

function wireJumpCurrent() {
  jumpCurrent?.addEventListener("click", () => {
    if (!currentSegmentElement) return;
    currentSegmentElement.scrollIntoView({ block: "center", behavior: "smooth" });
    currentSegmentElement.focus({ preventScroll: true });
  });
}

function wireSupportActions() {
  for (const button of document.querySelectorAll("[data-copy-target]")) {
    button.addEventListener("click", () => copyAddress(button));
  }
  for (const link of document.querySelectorAll("[data-placeholder-link]")) {
    link.addEventListener("click", (event) => event.preventDefault());
  }
}

function copyAddress(button) {
  const target = document.getElementById(button.dataset.copyTarget);
  const text = target?.textContent?.trim();
  if (!text) return;

  navigator.clipboard?.writeText(text).then(() => {
    button.textContent = "Copied";
    button.classList.add("copied");
    setTimeout(() => {
      button.textContent = "Copy";
      button.classList.remove("copied");
    }, 1800);
  }).catch(() => {
    button.textContent = "Select";
    target?.focus?.();
  });
}

function animateMilestone() {
  const fill = document.querySelector("#milestone-fill");
  const count = Number(document.querySelector("#patron-count")?.textContent || 0);
  const goal = 50;
  if (!fill) return;
  requestAnimationFrame(() => {
    fill.style.width = `${Math.min(100, (count / goal) * 100)}%`;
  });
}

function updateSpeakingSentence(currentSegment, time) {
  for (const sentence of transcriptList.querySelectorAll(".transcript-sentence.is-speaking")) {
    sentence.classList.remove("is-speaking");
  }
  if (!currentSegment) return;

  const sentences = Array.from(currentSegment.querySelectorAll(".transcript-sentence"));
  if (!sentences.length) return;

  const start = Number(currentSegment.dataset.start || 0);
  const end = Number(currentSegment.dataset.end || start);
  const duration = Math.max(0.1, end - start);
  const elapsedRatio = Math.min(0.999, Math.max(0, (time - start) / duration));
  const weights = JSON.parse(currentSegment.dataset.sentenceWeights || "[]");
  const index = sentenceIndexForRatio(weights, elapsedRatio);
  sentences[index]?.classList.add("is-speaking");
}

function wireFilters() {
  for (const button of filterButtons) {
    button.addEventListener("click", () => {
      currentFilter = button.dataset.speaker || "all";
      for (const item of filterButtons) {
        item.classList.toggle("is-active", item === button);
      }
      applyFilter();
    });
  }
}

function applyFilter() {
  for (const item of transcriptList.querySelectorAll(".segment")) {
    item.hidden = currentFilter !== "all" && item.dataset.speaker !== currentFilter;
  }
}

function renderInline(text) {
  return escapeHtml(text || "")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replaceAll("**", "");
}

function renderSentenceSpans(text) {
  return splitSentences(text)
    .map((sentence, index) => (
      `<span class="transcript-sentence" data-sentence-index="${index}">${renderInline(sentence)}</span>`
    ))
    .join(" ");
}

function splitSentences(text) {
  const clean = String(text || "").replace(/\s+/g, " ").trim();
  if (!clean) return [];
  return clean.match(/.+?(?:[.!?](?=\s|$)|$)/g)?.map((sentence) => sentence.trim()).filter(Boolean) || [clean];
}

function sentenceWeights(text) {
  const sentences = splitSentences(text);
  const weights = sentences.map((sentence) => Math.max(12, sentence.replace(/\*\*/g, "").length));
  const total = weights.reduce((sum, weight) => sum + weight, 0) || 1;
  return weights.map((weight) => weight / total);
}

function sentenceIndexForRatio(weights, ratio) {
  if (!weights.length) return 0;
  let cursor = 0;
  for (let index = 0; index < weights.length; index += 1) {
    cursor += weights[index];
    if (ratio <= cursor) return index;
  }
  return weights.length - 1;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatClock(seconds) {
  const total = Math.max(0, Math.floor(Number(seconds || 0)));
  const minutes = Math.floor(total / 60);
  const secs = total % 60;
  return `${minutes}:${String(secs).padStart(2, "0")}`;
}

function formatDate(value) {
  if (!value) return "...";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}
