const variants = [
  { key: "editorial", label: "Editorial" },
  { key: "signal", label: "Signal" },
  { key: "field-notes", label: "Field Notes" },
];

const params = new URLSearchParams(window.location.search);
const requested = params.get("variant");
let currentIndex = Math.max(0, variants.findIndex(({ key }) => key === requested));

function renderVariant() {
  const current = variants[currentIndex];
  document.querySelectorAll("[data-variant]").forEach((deck) => {
    const active = deck.dataset.variant === current.key;
    deck.hidden = !active;
    deck.setAttribute("aria-hidden", String(!active));
  });

  document.querySelector("#variant-label").textContent = `${String.fromCharCode(65 + currentIndex)} — ${current.label}`;
  document.title = `PROTOTYPE — ${current.label}`;
  params.set("variant", current.key);
  window.history.replaceState({}, "", `${window.location.pathname}?${params}`);
}

function cycle(direction) {
  currentIndex = (currentIndex + direction + variants.length) % variants.length;
  renderVariant();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

document.querySelectorAll("[data-direction]").forEach((button) => {
  button.addEventListener("click", () => cycle(Number(button.dataset.direction)));
});

window.addEventListener("keydown", (event) => {
  const target = event.target;
  if (target.matches("input, textarea, [contenteditable]")) return;
  if (event.key === "ArrowLeft") cycle(-1);
  if (event.key === "ArrowRight") cycle(1);
});

const localHosts = new Set(["localhost", "127.0.0.1", ""]);
document.querySelector(".prototype-switcher").hidden = !localHosts.has(window.location.hostname);
renderVariant();
