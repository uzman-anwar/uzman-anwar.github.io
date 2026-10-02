"use strict";

const toast = document.querySelector(".toast");
const postCount = document.querySelectorAll(".post").length;
let toastTimer;

function notify(message) {
  toast.textContent = message;
  toast.classList.add("visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("visible"), 2600);
}

function postText(post) {
  // Read whole editable blocks so newly added lines and paragraphs are included.
  const parts = [...post.querySelectorAll(".post-copy, .model-quote")].map(el =>
    el.matches(".model-quote")
      ? `${el.querySelector("h3").textContent.trim()}: ${el.querySelector("blockquote").textContent.trim()}`
      : el.innerText.trim()
  );
  return `${Number(post.dataset.number)}/${postCount}\n\n${parts.join("\n\n")}`;
}

function threadText() {
  return [...document.querySelectorAll(".post")].map(postText).join("\n\n———\n\n");
}

async function copyText(text, message) {
  try {
    await navigator.clipboard.writeText(text);
    notify(message);
  } catch {
    notify("Clipboard unavailable here. Select the text to copy it.");
  }
}

document.querySelectorAll(".copy-post").forEach(button => {
  button.addEventListener("click", () => copyText(postText(button.closest(".post")), "Post copied."));
});
document.querySelectorAll(".copy-thread").forEach(button => {
  button.addEventListener("click", () => copyText(threadText(), `All ${postCount} posts copied. Graphics are available separately.`));
});

// Local-only editing: the static server and manuscript are never written to.
// The supplied Chrome draft is now the page's text. Keep the old storage key
// untouched as a backup, but do not let it overwrite this revised thread.
const draftKey = "vt-tweetprint-draft-v2";
const editorStatus = document.querySelector("#editor-status");
const resetEdits = document.querySelector("#reset-edits");
const editableBlocks = [];
let drafts = {};
let draftReadError = false;

function safeCopyHtml(html) {
  const template = document.createElement("template");
  template.innerHTML = html;
  const allowed = new Set(["H2", "P", "DIV", "SPAN", "BR", "STRONG", "EM", "B", "I", "U", "S"]);
  const output = document.createElement("div");
  function copy(node, target) {
    if (node.nodeType === Node.TEXT_NODE) return target.append(document.createTextNode(node.textContent));
    if (node.nodeType !== Node.ELEMENT_NODE || ["SCRIPT", "STYLE", "IFRAME", "OBJECT"].includes(node.tagName)) return;
    let parent = target;
    if (allowed.has(node.tagName)) {
      parent = document.createElement(node.tagName.toLowerCase());
      if (node.tagName === "BR" && node.classList.contains("desktop-break")) parent.className = "desktop-break";
      target.append(parent);
    }
    node.childNodes.forEach(child => copy(child, parent));
  }
  template.content.childNodes.forEach(node => copy(node, output));
  return output.innerHTML;
}

try {
  const stored = JSON.parse(localStorage.getItem(draftKey) || "null");
  if (stored && stored.version === 1 && stored.blocks && typeof stored.blocks === "object") drafts = stored.blocks;
} catch {
  draftReadError = true;
}

function showEditorStatus(message, error = false) {
  editorStatus.textContent = message;
  editorStatus.dataset.state = error ? "error" : "saved";
  resetEdits.disabled = !Object.keys(drafts).length;
}

function saveDraft() {
  try {
    if (Object.keys(drafts).length) localStorage.setItem(draftKey, JSON.stringify({ version: 1, blocks: drafts, updatedAt: new Date().toISOString() }));
    else localStorage.removeItem(draftKey);
    showEditorStatus(Object.keys(drafts).length ? "Saved in this browser only." : "Edits save in this browser only.");
    return true;
  } catch {
    showEditorStatus("Could not save here. Download your text before leaving.", true);
    return false;
  }
}

document.querySelectorAll(".post").forEach(post => {
  post.querySelectorAll(".post-copy").forEach((block, index) => {
    const key = `${post.id}:${index}`;
    const original = block.innerHTML;
    editableBlocks.push({ block, key, original });
    if (typeof drafts[key] === "string") block.innerHTML = safeCopyHtml(drafts[key]);
    // Older saved drafts used tweet sentences as headings. Keep their words,
    // but let page-only titles live outside the editable/copied tweet text.
    block.querySelectorAll("h1, h2, h3, h4, h5, h6").forEach(heading => {
      const paragraph = document.createElement("p");
      paragraph.append(...heading.childNodes);
      heading.replaceWith(paragraph);
    });
    block.setAttribute("contenteditable", "true");
    block.setAttribute("spellcheck", "true");
    block.setAttribute("role", "textbox");
    block.setAttribute("aria-multiline", "true");
    block.setAttribute("aria-label", `Edit text for post ${Number(post.dataset.number)}`);
    block.setAttribute("aria-describedby", "editor-status");
    block.title = "Click to edit. Changes are saved in this browser.";
    block.addEventListener("paste", event => {
      event.preventDefault();
      // Chrome's native insertion keeps undo working, without pasted HTML/styles.
      document.execCommand("insertText", false, event.clipboardData.getData("text/plain"));
    });
    block.addEventListener("drop", event => event.preventDefault());
    block.addEventListener("input", () => {
      const value = safeCopyHtml(block.innerHTML);
      if (value === safeCopyHtml(original)) delete drafts[key];
      else drafts[key] = value;
      saveDraft();
      scheduleReadingUpdate();
    });
    block.addEventListener("keydown", event => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        if (saveDraft()) notify("Edits saved in this browser.");
      }
      if (event.key === "Escape") block.blur();
    });
  });
});

document.querySelector(".editor-bar").hidden = false;
showEditorStatus(draftReadError ? "Could not load saved edits. Use Download text to keep a copy." : Object.keys(drafts).length ? "Saved edits restored from this browser." : "Edits save in this browser only.", draftReadError);

document.querySelector("#download-thread").addEventListener("click", () => {
  const url = URL.createObjectURL(new Blob([threadText() + "\n"], { type: "text/plain;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = "verbalization-training-thread.txt";
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
});

resetEdits.addEventListener("click", () => {
  if (!window.confirm("Reset all your browser edits to the original draft? Download your text first if you want to keep a copy.")) return;
  editableBlocks.forEach(({ block, original }) => { block.innerHTML = original; });
  drafts = {};
  saveDraft();
  scheduleReadingUpdate();
});

const dialog = document.querySelector(".lightbox");
const lightboxImage = document.querySelector(".lightbox-image");
const lightboxDownload = document.querySelector(".lightbox-download");

document.querySelectorAll(".figure-open").forEach(button => {
  button.addEventListener("click", () => {
    lightboxImage.src = button.dataset.figure;
    lightboxImage.alt = button.querySelector("img").alt;
    lightboxDownload.href = button.dataset.figure;
    dialog.showModal();
    document.body.classList.add("modal-open");
    document.querySelector(".lightbox-body").scrollTo(0, 0);
  });
});
document.querySelector(".lightbox-close").addEventListener("click", () => dialog.close());
dialog.addEventListener("close", () => document.body.classList.remove("modal-open"));
dialog.addEventListener("click", event => {
  if (event.target === dialog) {
    const bounds = dialog.getBoundingClientRect();
    if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) dialog.close();
  }
});

const navLinks = [...document.querySelectorAll(".sidebar nav a")];
const navTargets = navLinks.map(link => document.querySelector(link.getAttribute("href")));
const progress = document.querySelector(".reading-progress span");
let updatePending = false;

function updateReadingPosition() {
  const maximum = document.documentElement.scrollHeight - window.innerHeight;
  progress.style.width = `${maximum > 0 ? Math.min(100, window.scrollY / maximum * 100) : 0}%`;
  let current = 0;
  navTargets.forEach((section, index) => {
    if (section.getBoundingClientRect().top <= window.innerHeight * 0.38) current = index;
  });
  navLinks.forEach((link, index) => {
    link.classList.toggle("active", index === current);
    if (index === current) link.setAttribute("aria-current", "location");
    else link.removeAttribute("aria-current");
  });
  updatePending = false;
}
function scheduleReadingUpdate() {
  if (!updatePending) {
    updatePending = true;
    requestAnimationFrame(updateReadingPosition);
  }
}
window.addEventListener("scroll", scheduleReadingUpdate, { passive: true });
window.addEventListener("resize", scheduleReadingUpdate);
window.addEventListener("load", scheduleReadingUpdate);
updateReadingPosition();

function makeCell(tag, value, scope) {
  const cell = document.createElement(tag);
  cell.textContent = value;
  if (scope) cell.scope = scope;
  return cell;
}

async function populateData() {
  const response = await fetch("data.json");
  if (!response.ok) throw new Error(`Unable to load results (${response.status})`);
  const data = await response.json();
  document.querySelectorAll("[data-source]").forEach(link => {
    link.href = data.sources[link.dataset.source].url;
  });
  const sdfBody = document.querySelector("#sdf-table tbody");
  data.sdf.forEach(row => {
    const tr = document.createElement("tr");
    if (row.policy === "SDF + VT") tr.className = "highlight-row";
    tr.append(makeCell("th", row.policy, "row"));
    ["recall", "vea", "target_recovery", "pass_condition"].forEach(key => tr.append(makeCell("td", row[key].toFixed(1))));
    sdfBody.append(tr);
  });
  const behaviorBody = document.querySelector("#behavior-table tbody");
  data.behavior.forEach(row => {
    const tr = document.createElement("tr");
    tr.append(makeCell("th", row.model, "row"));
    const signed = `${row.mean_task_delta_pp >= 0 ? "+" : "−"}${Math.abs(row.mean_task_delta_pp).toFixed(1)}`;
    tr.append(makeCell("td", signed), makeCell("td", row.max_factor_abs_delta_pp.toFixed(1)), makeCell("td", `+${row.perplexity_delta_percent}%`));
    behaviorBody.append(tr);
  });
  document.documentElement.dataset.ready = "true";
}

populateData().catch(error => {
  console.error(error);
  document.querySelectorAll(".table-card").forEach(card => {
    if (card.querySelector("tbody:empty")) {
      const note = document.createElement("p");
      note.className = "table-note";
      note.textContent = "The results table could not load. Please reload the page or view the paper PDF.";
      card.append(note);
    }
  });
});
