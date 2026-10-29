/* FoxyAI — interactions & canvas visuals */
(() => {
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const DPR = Math.min(window.devicePixelRatio || 1, 2);
  const ORANGE = [255, 98, 31];

  /* ---------- Liquid glass refraction: Chromium supports SVG backdrop filters ---------- */
  const brands = navigator.userAgentData && navigator.userAgentData.brands;
  if (brands && brands.some((b) => /Chrom/.test(b.brand))) {
    document.documentElement.classList.add("lg-refract");
  }

  /* ---------- Mobile menu ---------- */
  const menuBtn = document.querySelector(".menu-btn");
  const menu = document.getElementById("mobile-menu");
  const setMenu = (open) => {
    menuBtn.setAttribute("aria-expanded", String(open));
    menuBtn.setAttribute("aria-label", open ? "Close menu" : "Open menu");
    menu.hidden = !open;
  };
  menuBtn.addEventListener("click", () => setMenu(menu.hidden));
  menu.addEventListener("click", (e) => { if (e.target.closest("a")) setMenu(false); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") setMenu(false); });

  document.getElementById("year").textContent = new Date().getFullYear();

  /* ---------- Reveal on scroll + stat counters ---------- */
  const revealEls = document.querySelectorAll(
    ".section-head, .member, .service, .tile, .cta, .footer-bar"
  );
  revealEls.forEach((el, i) => {
    el.classList.add("reveal");
    el.style.transitionDelay = `${(i % 6) * 70}ms`;
  });
  const countUp = (el) => {
    const target = +el.dataset.count;
    const start = performance.now();
    const step = (t) => {
      const p = Math.min((t - start) / 1400, 1);
      el.textContent = Math.round(target * (1 - Math.pow(1 - p, 3)));
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  };
  const io = new IntersectionObserver(
    (entries) => entries.forEach((en) => {
      if (!en.isIntersecting) return;
      en.target.classList.add("in");
      en.target.querySelectorAll("[data-count]").forEach(countUp);
      io.unobserve(en.target);
    }),
    { threshold: 0, rootMargin: "0px 0px -6% 0px" }
  );
  revealEls.forEach((el) => io.observe(el));

  /* ---------- Canvas helper: sizes to its box, pauses offscreen ---------- */
  function canvasLoop(canvas, draw) {
    const ctx = canvas.getContext("2d");
    let w = 0, h = 0, visible = true, raf = 0, last = 0;
    const resize = () => {
      const r = canvas.getBoundingClientRect();
      w = r.width; h = r.height;
      canvas.width = Math.round(w * DPR);
      canvas.height = Math.round(h * DPR);
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
      draw(ctx, w, h, last); // repaint immediately so a resize never leaves a blank canvas
    };
    new ResizeObserver(resize).observe(canvas);
    resize();
    if (reduceMotion) return;
    new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
      if (visible && !raf) raf = requestAnimationFrame(tick);
    }).observe(canvas);
    const tick = (t) => {
      raf = 0;
      if (!visible) return;
      ctx.clearRect(0, 0, w, h);
      last = t / 1000;
      draw(ctx, w, h, last);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
  }
  const rgba = (c, a) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;

  /* ---------- Hero: data streams flowing into a neural network ---------- */
  const heroCanvas = document.getElementById("hero-canvas");
  if (heroCanvas) {
    // points on a sphere (fibonacci) form the network
    const N = 46;
    const nodes = Array.from({ length: N }, (_, i) => {
      const y = 1 - (i / (N - 1)) * 2;
      const r = Math.sqrt(1 - y * y);
      const th = i * 2.399963;
      return { x: Math.cos(th) * r, y, z: Math.sin(th) * r, s: 0.6 + Math.random() * 0.8 };
    });
    const links = [];
    for (let i = 0; i < N; i++)
      for (let j = i + 1; j < N; j++) {
        const d = Math.hypot(nodes[i].x - nodes[j].x, nodes[i].y - nodes[j].y, nodes[i].z - nodes[j].z);
        if (d < 0.62) links.push([i, j]);
      }
    const streams = Array.from({ length: 14 }, (_, i) => ({
      y0: 0.18 + (i / 14) * 0.6,
      off: Math.random(),
      speed: 0.12 + Math.random() * 0.12,
      target: (i * 7) % N,
    }));

    canvasLoop(heroCanvas, (ctx, w, h, t) => {
      const mobile = w < 560;
      const cx = w * (mobile ? 0.36 : 0.32);
      const cy = h * 0.5;
      const R = Math.min(w, h) * (mobile ? 0.3 : 0.27);
      const ptr = window.foxyPointer || { nx: 0, ny: 0 };
      heroCanvas._px = (heroCanvas._px || 0) + (ptr.nx - (heroCanvas._px || 0)) * 0.05;
      heroCanvas._py = (heroCanvas._py || 0) + (ptr.ny - (heroCanvas._py || 0)) * 0.05;
      const rot = t * 0.18 + heroCanvas._px * 1.2;
      const cos = Math.cos(rot), sin = Math.sin(rot);
      const tilt = 0.35 + heroCanvas._py * 0.6, ct = Math.cos(tilt), st = Math.sin(tilt);

      const P = nodes.map((n) => {
        const x = n.x * cos - n.z * sin;
        let z = n.x * sin + n.z * cos;
        const y = n.y * ct - z * st;
        z = n.y * st + z * ct;
        const k = 1 / (1.9 - z * 0.5);
        return { x: cx + x * R * k * 1.4, y: cy + y * R * k * 1.4, z, k };
      });

      // streams of data from the left edge into the network
      streams.forEach((s) => {
        const tp = P[s.target];
        const sx = -10, sy = h * s.y0;
        const c1x = w * 0.08, c1y = sy, c2x = cx - R * 1.4, c2y = tp.y;
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.bezierCurveTo(c1x, c1y, c2x, c2y, tp.x, tp.y);
        ctx.strokeStyle = rgba(ORANGE, 0.12);
        ctx.lineWidth = 1;
        ctx.stroke();
        const p = (t * s.speed + s.off) % 1;
        const mt = 1 - p;
        const px = mt ** 3 * sx + 3 * mt * mt * p * c1x + 3 * mt * p * p * c2x + p ** 3 * tp.x;
        const py = mt ** 3 * sy + 3 * mt * mt * p * c1y + 3 * mt * p * p * c2y + p ** 3 * tp.y;
        ctx.fillStyle = rgba(ORANGE, 0.9);
        ctx.beginPath();
        ctx.arc(px, py, 2, 0, Math.PI * 2);
        ctx.fill();
      });

      // links
      links.forEach(([a, b]) => {
        const A = P[a], B = P[b];
        const depth = (A.z + B.z) / 2;
        ctx.strokeStyle = rgba(ORANGE, 0.12 + (depth + 1) * 0.18);
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        ctx.moveTo(A.x, A.y);
        ctx.lineTo(B.x, B.y);
        ctx.stroke();
      });

      // nodes (back to front)
      P.map((p, i) => ({ ...p, s: nodes[i].s, i }))
        .sort((a, b) => a.z - b.z)
        .forEach((p) => {
          const glow = 0.5 + 0.5 * Math.sin(t * 2 + p.i);
          const r = (2.2 + p.s * 3.2) * p.k * (mobile ? 0.9 : 1.2);
          const a = 0.35 + (p.z + 1) * 0.32;
          const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r * 3.5);
          g.addColorStop(0, rgba(ORANGE, 0.35 * a * (0.6 + glow * 0.4)));
          g.addColorStop(1, rgba(ORANGE, 0));
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.arc(p.x, p.y, r * 3.5, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = rgba([255, 120 + glow * 40, 50], a);
          ctx.beginPath();
          ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
          ctx.fill();
        });
    });
  }

  /* ---------- CTA: perforated dotted sphere ---------- */
  const sphereCanvas = document.getElementById("sphere-canvas");
  if (sphereCanvas) {
    const dots = [];
    const rings = 22;
    for (let i = 1; i < rings; i++) {
      const phi = (i / rings) * Math.PI;
      const count = Math.round(Math.sin(phi) * 46);
      for (let j = 0; j < count; j++) dots.push({ phi, th: (j / count) * Math.PI * 2 });
    }
    canvasLoop(sphereCanvas, (ctx, w, h, t) => {
      const cx = w / 2, cy = h / 2;
      const R = Math.min(w, h) * 0.4;
      // body
      const body = ctx.createRadialGradient(cx - R * 0.35, cy - R * 0.4, R * 0.1, cx, cy, R);
      body.addColorStop(0, "#ffb06b");
      body.addColorStop(0.55, "#ff6a24");
      body.addColorStop(1, "#b83a06");
      ctx.fillStyle = body;
      ctx.beginPath();
      ctx.arc(cx, cy, R, 0, Math.PI * 2);
      ctx.fill();
      // holes
      const rot = t * 0.25;
      dots.forEach((d) => {
        const th = d.th + rot;
        const x = Math.sin(d.phi) * Math.cos(th);
        const z = Math.sin(d.phi) * Math.sin(th);
        const y = Math.cos(d.phi);
        if (z < 0) return;
        const size = R * 0.042 * (0.35 + z * 0.65);
        ctx.fillStyle = `rgba(40,10,0,${0.35 + z * 0.55})`;
        ctx.beginPath();
        ctx.ellipse(cx + x * R, cy - y * R, size * (0.4 + z * 0.6), size, 0, 0, Math.PI * 2);
        ctx.fill();
      });
      // rim light
      const rim = ctx.createRadialGradient(cx, cy, R * 0.7, cx, cy, R * 1.25);
      rim.addColorStop(0, "rgba(255,200,150,0)");
      rim.addColorStop(0.6, "rgba(255,220,180,0.25)");
      rim.addColorStop(1, "rgba(255,220,180,0)");
      ctx.fillStyle = rim;
      ctx.beginPath();
      ctx.arc(cx, cy, R * 1.25, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  /* ---------- Footer: glowing dunes with a light path ---------- */
  const dunesCanvas = document.getElementById("dunes-canvas");
  if (dunesCanvas) {
    const stars = Array.from({ length: 40 }, () => ({ x: Math.random(), y: 0.45 + Math.random() * 0.5, p: Math.random() * 6 }));
    canvasLoop(dunesCanvas, (ctx, w, h, t) => {
      const sky = ctx.createLinearGradient(0, 0, 0, h);
      sky.addColorStop(0, "#f3f1ee");
      sky.addColorStop(0.35, "#f6d9c4");
      sky.addColorStop(1, "#ff8a45");
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, w, h);

      // sun
      const sx = w * 0.72, sy = h * 0.5;
      const sun = ctx.createRadialGradient(sx, sy, 0, sx, sy, 90);
      sun.addColorStop(0, "rgba(255,120,50,0.9)");
      sun.addColorStop(0.3, "rgba(255,120,50,0.5)");
      sun.addColorStop(1, "rgba(255,120,50,0)");
      ctx.fillStyle = sun;
      ctx.beginPath();
      ctx.arc(sx, sy, 90, 0, Math.PI * 2);
      ctx.fill();

      // dune layers
      const layers = [
        { base: 0.5, amp: 0.08, f: 1.4, c1: "#ffa060", c2: "#ff7a33", sp: 0.02 },
        { base: 0.62, amp: 0.1, f: 1.1, c1: "#ff8740", c2: "#f0601c", sp: 0.035 },
        { base: 0.76, amp: 0.09, f: 1.8, c1: "#ff6d26", c2: "#cf4a0e", sp: 0.05 },
        { base: 0.88, amp: 0.06, f: 2.4, c1: "#f05a17", c2: "#a83a08", sp: 0.07 },
      ];
      layers.forEach((L, li) => {
        const g = ctx.createLinearGradient(0, h * (L.base - L.amp), 0, h);
        g.addColorStop(0, L.c1);
        g.addColorStop(1, L.c2);
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.moveTo(0, h);
        for (let x = 0; x <= w; x += 8) {
          const u = x / w;
          const y = h * (L.base - L.amp * (0.6 * Math.sin(u * Math.PI * L.f + li * 1.7 + t * L.sp) + 0.4 * Math.sin(u * Math.PI * L.f * 2.3 + li)));
          ctx.lineTo(x, y);
        }
        ctx.lineTo(w, h);
        ctx.closePath();
        ctx.fill();
      });

      // glowing winding path
      const path = (pr) => {
        ctx.beginPath();
        for (let i = 0; i <= 60; i++) {
          const v = i / 60;
          const y = h * (0.42 + v * 0.62);
          const x = w * 0.7 + Math.sin(v * 5.2 + 0.6) * w * 0.07 * (0.4 + v) - v * w * 0.05;
          i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
          if (v > pr) break;
        }
      };
      ctx.lineCap = "round";
      ctx.strokeStyle = "rgba(255,240,220,0.25)";
      ctx.lineWidth = 16;
      path(1); ctx.stroke();
      ctx.strokeStyle = "rgba(255,250,240,0.95)";
      ctx.lineWidth = 3;
      ctx.shadowColor = "#fff";
      ctx.shadowBlur = 14;
      path(1); ctx.stroke();
      ctx.shadowBlur = 0;

      // twinkling network nodes over the dunes
      ctx.strokeStyle = "rgba(255,255,255,0.18)";
      ctx.lineWidth = 0.6;
      for (let i = 0; i < stars.length - 1; i++) {
        const a = stars[i], b = stars[i + 1];
        if (Math.abs(a.x - b.x) < 0.2) {
          ctx.beginPath();
          ctx.moveTo(a.x * w, a.y * h);
          ctx.lineTo(b.x * w, b.y * h);
          ctx.stroke();
        }
      }
      stars.forEach((s) => {
        const a = 0.4 + 0.6 * Math.abs(Math.sin(t * 1.2 + s.p));
        ctx.fillStyle = `rgba(255,245,230,${a})`;
        ctx.beginPath();
        ctx.arc(s.x * w, s.y * h, 1.6, 0, Math.PI * 2);
        ctx.fill();
      });
    });
  }
})();
