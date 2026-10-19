"use strict";

// Reuse the thread's copy, figure-viewer and reading-navigation behavior.
// Article text and result tables are already present in the HTML.
const toast = document.querySelector(".toast");
let toastTimer;

function notify(message) {
  toast.textContent = message;
  toast.classList.add("visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("visible"), 2600);
}

function postText(post) {
  const parts = [post.querySelector(".post-title").innerText.trim()];
  for (const block of post.querySelector(".post-copy").children) {
    const source = block.matches("figure") ? block.querySelector(".original-caption") : block;
    if (source) parts.push(source.innerText.trim());
  }
  return parts.filter(Boolean).join("\n\n");
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    notify("Copied.");
  } catch {
    notify("Clipboard unavailable here. Select the text to copy it.");
  }
}

document.querySelectorAll(".copy-post").forEach(button => {
  button.addEventListener("click", () => copyText(postText(button.closest(".post"))));
});
document.querySelectorAll(".copy-thread").forEach(button => {
  button.addEventListener("click", () => copyText([
    document.querySelector("h1").innerText,
    "Usman Anwar",
    ...[...document.querySelectorAll(".post")].map(postText),
    document.querySelector(".footer-bottom a").href,
  ].join("\n\n")));
});

const dialog = document.querySelector(".lightbox");
const lightboxImage = document.querySelector(".lightbox-image");
const lightboxDownload = document.querySelector(".lightbox-download");

document.querySelectorAll(".figure-open").forEach(link => {
  link.addEventListener("click", event => {
    if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    lightboxImage.src = link.dataset.figure;
    lightboxImage.alt = link.querySelector("img").alt;
    lightboxDownload.href = link.dataset.figure;
    dialog.showModal();
    document.body.classList.add("modal-open");
    document.querySelector(".lightbox-body").scrollTo(0, 0);
  });
});
document.querySelector(".lightbox-close").addEventListener("click", () => dialog.close());
dialog.addEventListener("close", () => document.body.classList.remove("modal-open"));
dialog.addEventListener("click", event => {
  if (event.target !== dialog) return;
  const bounds = dialog.getBoundingClientRect();
  if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) dialog.close();
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
document.addEventListener("load", scheduleReadingUpdate, true);
updateReadingPosition();

document.querySelectorAll(".mobile-contents a").forEach(link => {
  link.addEventListener("click", () => link.closest("details").removeAttribute("open"));
});
