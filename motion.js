/* FoxyAI — motion layer: text reveals, tilt, parallax, magnetic buttons, scroll FX */
(() => {
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  const root = document.documentElement;
  const lerp = (a, b, t) => a + (b - a) * t;

  /* ---------- Split headings into words for a staggered rise ---------- */
  const splitWords = (el) => {
    const walk = (node) => {
      [...node.childNodes].forEach((child) => {
        if (child.nodeType === Node.TEXT_NODE) {
          const frag = document.createDocumentFragment();
          child.textContent.split(/(\s+)/).forEach((part) => {
            if (!part) return;
            if (/^\s+$/.test(part)) return frag.append(" ");
            const w = document.createElement("span");
            w.className = "w";
            const inner = document.createElement("span");
            inner.textContent = part;
            w.append(inner);
            frag.append(w);
          });
          child.replaceWith(frag);
        } else if (child.nodeType === Node.ELEMENT_NODE && child.tagName !== "BR") {
          walk(child);
        }
      });
    };
    el.setAttribute("aria-label", el.textContent.trim());
    walk(el);
    el.querySelectorAll(".w").forEach((w, i) => {
      w.setAttribute("aria-hidden", "true");
      w.style.setProperty("--d", `${i * 70}ms`);
    });
    el.classList.add("split");
  };

  const headings = document.querySelectorAll(".display, .display-2");
  headings.forEach(splitWords);

  /* ---------- Hero intro on load ---------- */
  document.querySelectorAll(".hero-copy > *:not(h1), .hero-foot").forEach((el, i) => {
    el.classList.add("intro");
    el.style.setProperty("--i", i < 1 ? 0 : i + 3);
  });
  requestAnimationFrame(() => {
    root.classList.add("loaded");
    document.querySelector(".hero .display")?.classList.add("in");
  });

  const headIO = new IntersectionObserver(
    (entries) => entries.forEach((e) => {
      if (e.isIntersecting) { e.target.classList.add("in"); headIO.unobserve(e.target); }
    }),
    { threshold: 0.3 }
  );
  headings.forEach((h) => headIO.observe(h));

  if (reduceMotion) return;

  /* ---------- Pointer state (shared) ---------- */
  const pointer = { x: innerWidth / 2, y: innerHeight / 2, nx: 0, ny: 0 };
  window.foxyPointer = pointer; // read by hero canvas
  addEventListener("pointermove", (e) => {
    pointer.x = e.clientX;
    pointer.y = e.clientY;
    pointer.nx = e.clientX / innerWidth - 0.5;
    pointer.ny = e.clientY / innerHeight - 0.5;
  }, { passive: true });

  /* ---------- Scroll: progress bar, nav state, parallax ---------- */
  const progress = document.querySelector(".scroll-progress");
  const navWrap = document.querySelector(".nav-wrap");
  const parallax = [
    { el: document.querySelector(".hero-visual"), speed: -0.08 },
    { el: document.querySelector(".cta-visual"), speed: -0.12 },
    { el: document.querySelector(".footer-notes"), speed: 0.1 },
  ].filter((p) => p.el);

  /* ---------- Hero mouse parallax ---------- */
  const heroVisual = document.querySelector(".hero-visual");
  let hx = 0, hy = 0;

  /* ---------- Cursor glow ---------- */
  const glow = document.querySelector(".cursor-glow");
  let gx = pointer.x, gy = pointer.y;
  if (finePointer) root.classList.add("has-cursor");

  const frame = () => {
    const max = document.documentElement.scrollHeight - innerHeight;
    const sy = scrollY;
    progress.style.transform = `scaleX(${max > 0 ? sy / max : 0})`;
    navWrap.classList.toggle("scrolled", sy > 40);

    parallax.forEach((p) => {
      const r = p.el.getBoundingClientRect();
      const center = r.top + r.height / 2 - innerHeight / 2;
      p.el.style.translate = `0 ${(center * p.speed).toFixed(1)}px`;
    });

    if (heroVisual && finePointer) {
      hx = lerp(hx, pointer.nx, 0.06);
      hy = lerp(hy, pointer.ny, 0.06);
      heroVisual.style.setProperty("--px", hx.toFixed(3));
      heroVisual.style.setProperty("--py", hy.toFixed(3));
    }

    if (glow && finePointer) {
      gx = lerp(gx, pointer.x, 0.12);
      gy = lerp(gy, pointer.y, 0.12);
      glow.style.transform = `translate(${gx}px, ${gy}px)`;
    }
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);

  if (!finePointer) return;

  /* ---------- 3D tilt + liquid-glass shine following the cursor ---------- */
  document.querySelectorAll(".member, .service, .tile").forEach((card) => {
    const shine = document.createElement("span");
    shine.className = "shine";
    shine.setAttribute("aria-hidden", "true");
    card.append(shine);
    const strength = card.classList.contains("tile") ? 6 : 9;

    card.addEventListener("pointerenter", () => {
      card.style.transition = "transform 0.15s ease-out, box-shadow 0.35s ease";
    });
    card.addEventListener("pointermove", (e) => {
      const r = card.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width;
      const y = (e.clientY - r.top) / r.height;
      card.style.transform =
        `perspective(900px) rotateX(${((0.5 - y) * strength).toFixed(2)}deg) ` +
        `rotateY(${((x - 0.5) * strength).toFixed(2)}deg) translateY(-6px)`;
      card.style.setProperty("--mx", `${(x * 100).toFixed(1)}%`);
      card.style.setProperty("--my", `${(y * 100).toFixed(1)}%`);
    });
    card.addEventListener("pointerleave", () => {
      card.style.transition = "transform 0.7s cubic-bezier(.2,.8,.2,1), box-shadow 0.35s ease";
      card.style.transform = "";
    });
  });

  /* ---------- Magnetic buttons ---------- */
  document.querySelectorAll(".magnetic").forEach((btn) => {
    btn.addEventListener("pointermove", (e) => {
      const r = btn.getBoundingClientRect();
      const dx = e.clientX - (r.left + r.width / 2);
      const dy = e.clientY - (r.top + r.height / 2);
      btn.style.transform = `translate(${dx * 0.25}px, ${dy * 0.35}px)`;
    });
    btn.addEventListener("pointerleave", () => { btn.style.transform = ""; });
  });

  /* ---------- Cursor glow grows over interactive elements ---------- */
  document.querySelectorAll("a, button, .member, .service, .tile").forEach((el) => {
    el.addEventListener("pointerenter", () => glow?.classList.add("big"));
    el.addEventListener("pointerleave", () => glow?.classList.remove("big"));
  });
})();
