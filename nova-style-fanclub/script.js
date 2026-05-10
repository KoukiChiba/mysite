const body = document.body;
const menuButton = document.querySelector("[data-menu-button]");
const drawer = document.querySelector("[data-drawer]");
const loader = document.querySelector("[data-loader]");

window.addEventListener("load", () => {
  window.setTimeout(() => loader?.classList.add("is-hidden"), 420);
});

menuButton?.addEventListener("click", () => {
  const isOpen = body.classList.toggle("menu-open");
  menuButton.setAttribute("aria-expanded", String(isOpen));
});

drawer?.addEventListener("click", (event) => {
  if (event.target instanceof HTMLAnchorElement) {
    body.classList.remove("menu-open");
    menuButton?.setAttribute("aria-expanded", "false");
  }
});

const observer = new IntersectionObserver(
  (entries) => {
    for (const entry of entries) {
      if (entry.isIntersecting) {
        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      }
    }
  },
  { threshold: 0.16 }
);

document.querySelectorAll(".reveal").forEach((element) => observer.observe(element));
