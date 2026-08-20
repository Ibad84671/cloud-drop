(() => {
  const toggle = document.getElementById('themeToggle');
  const root = document.documentElement;
  const isLanding = document.body?.classList.contains('landing-page');

  if (toggle) {
    const saved = localStorage.getItem('theme');
    const initial = saved === 'light' || saved === 'dark' ? saved : 'dark';
    root.setAttribute('data-theme', initial);
    toggle.setAttribute('aria-pressed', String(initial === 'dark'));

    toggle.addEventListener('click', () => {
      const next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
      root.setAttribute('data-theme', next);
      localStorage.setItem('theme', next);
      toggle.setAttribute('aria-pressed', String(next === 'dark'));
    });
  }

  if (!isLanding) return;

  const style = document.createElement('style');
  style.textContent = `
    .premium-contact-link{display:inline-flex;align-items:center;gap:7px;color:var(--muted);text-decoration:none;font-size:12px;font-weight:750;padding:8px 10px;border:1px solid transparent;border-radius:10px;transition:all .2s ease}
    .premium-contact-link:hover{color:var(--text);border-color:var(--line);background:var(--surface-2)}
    .premium-contact-link b{color:var(--accent);font-size:13px}
    .side-showcase{position:relative;margin-top:auto;padding:14px;border:1px solid rgba(255,255,255,.065);border-radius:18px;background:linear-gradient(145deg,rgba(255,138,31,.055),rgba(255,255,255,.012));overflow:hidden;box-shadow:0 18px 42px rgba(0,0,0,.14)}
    .side-showcase:before{content:"";position:absolute;width:90px;height:90px;right:-30px;top:-35px;border-radius:50%;background:rgba(255,138,31,.08);filter:blur(24px)}
    .showcase-kicker{position:relative;color:#667082;font-size:8px;font-weight:900;letter-spacing:.16em}
    .showcase-title{position:relative;margin-top:5px;font-size:13px;font-weight:850;letter-spacing:-.02em}
    .showcase-title span{color:var(--accent)}
    .showcase-line{position:relative;display:flex;align-items:center;gap:7px;margin-top:11px;color:var(--muted);font-size:9px}
    .showcase-node{width:7px;height:7px;border-radius:50%;background:var(--accent);box-shadow:0 0 13px rgba(255,138,31,.7);flex:none}
    .showcase-connector{height:1px;flex:1;background:linear-gradient(90deg,rgba(255,138,31,.65),rgba(255,255,255,.06))}
    .right-metrics{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin-top:12px}
    .right-metric{padding:9px 7px;border:1px solid rgba(255,255,255,.055);border-radius:12px;background:rgba(255,255,255,.012);text-align:center}
    .right-metric strong{display:block;font-size:12px;color:var(--text);letter-spacing:-.02em}.right-metric span{display:block;margin-top:2px;color:#667082;font-size:7px;text-transform:uppercase;letter-spacing:.08em}
    .side-ambient-particle{position:absolute;width:3px;height:3px;border-radius:50%;background:var(--accent);box-shadow:0 0 12px rgba(255,138,31,.7);pointer-events:none;animation:ambientDrift 7s ease-in-out infinite}
    .side-ambient-particle.p1{left:16%;top:18%;animation-delay:-1s}.side-ambient-particle.p2{right:12%;top:42%;animation-delay:-3.2s}.side-ambient-particle.p3{left:26%;bottom:18%;animation-delay:-5s}
    .landing-contact{position:relative;margin:28px auto 8px;padding:24px 28px;border:1px solid var(--line);border-radius:24px;background:linear-gradient(135deg,rgba(255,138,31,.055),rgba(255,255,255,.018));display:grid;grid-template-columns:1fr auto;align-items:center;gap:24px;overflow:hidden;box-shadow:var(--shadow-soft)}
    .landing-contact:before{content:"";position:absolute;width:260px;height:160px;right:-60px;top:-70px;border-radius:50%;background:rgba(255,138,31,.1);filter:blur(60px);pointer-events:none}
    .contact-kicker{position:relative;color:var(--accent);font-size:9px;font-weight:900;letter-spacing:.17em}.landing-contact h2{position:relative;margin-top:5px;font-size:24px;letter-spacing:-.045em}.landing-contact p{position:relative;color:var(--muted);font-size:12px;margin-top:5px;max-width:560px}.contact-actions{position:relative;display:flex;align-items:center;gap:8px}.contact-actions a{white-space:nowrap}
    .contact-modal-backdrop{position:fixed;inset:0;z-index:100;background:rgba(3,5,8,.72);backdrop-filter:blur(12px);display:grid;place-items:center;padding:20px;opacity:0;pointer-events:none;transition:opacity .2s ease}.contact-modal-backdrop.open{opacity:1;pointer-events:auto}
    .contact-modal{width:min(520px,100%);padding:24px;border:1px solid rgba(255,255,255,.09);border-radius:24px;background:linear-gradient(150deg,#111721,#0b0f16);box-shadow:0 30px 100px rgba(0,0,0,.55);transform:translateY(10px) scale(.985);transition:transform .2s ease}.contact-modal-backdrop.open .contact-modal{transform:none}
    .contact-modal-head{display:flex;justify-content:space-between;gap:16px;align-items:flex-start}.contact-modal .eyebrow{margin-bottom:4px}.contact-modal h2{font-size:26px;letter-spacing:-.045em}.contact-modal p{color:var(--muted);font-size:13px;line-height:1.55;margin-top:6px}.contact-close{width:34px;height:34px;border:1px solid var(--line);border-radius:50%;background:var(--surface-2);color:var(--text);cursor:pointer}.contact-choice{display:grid;grid-template-columns:42px 1fr auto;gap:12px;align-items:center;margin-top:16px;padding:13px;border:1px solid var(--line);border-radius:16px;background:rgba(255,255,255,.018);text-decoration:none;color:var(--text);transition:all .2s ease}.contact-choice:hover{transform:translateY(-2px);border-color:rgba(255,138,31,.3);background:rgba(255,138,31,.035)}.contact-choice-icon{width:42px;height:42px;border-radius:13px;display:grid;place-items:center;background:var(--accent-soft);color:var(--accent);font-weight:900}.contact-choice strong{display:block;font-size:13px}.contact-choice span{display:block;color:var(--muted);font-size:10px;margin-top:2px}.contact-arrow{color:var(--accent);font-size:18px}
    @keyframes ambientDrift{0%,100%{transform:translate(0,0);opacity:.35}50%{transform:translate(9px,-12px);opacity:1}}
    @media(max-width:820px){.premium-contact-link{display:none}.landing-contact{grid-template-columns:1fr;padding:20px}.contact-actions{width:100%}.contact-actions a{flex:1}.side-showcase{display:none}}
    @media(prefers-reduced-motion:reduce){.side-ambient-particle,.contact-modal-backdrop,.contact-modal,.premium-contact-link{animation:none;transition:none!important}}
  `;
  document.head.appendChild(style);

  const nav = document.querySelector('.nav-actions');
  if (nav && !document.getElementById('contact-nav-link')) {
    const link = document.createElement('a');
    link.id = 'contact-nav-link';
    link.className = 'premium-contact-link';
    link.href = '#contact';
    link.innerHTML = '<b>✦</b> Contact';
    nav.insertBefore(link, nav.firstChild);
  }

  const leftRail = document.querySelector('.side-rail-left');
  if (leftRail && !leftRail.querySelector('.side-showcase')) {
    const card = document.createElement('div');
    card.className = 'side-showcase';
    card.innerHTML = `
      <span class="showcase-kicker">THE HANDOFF</span>
      <div class="showcase-title">One file flow. <span>Three moments.</span></div>
      <div class="showcase-line"><i class="showcase-node"></i><span>Upload</span><i class="showcase-connector"></i><i class="showcase-node"></i><span>Link</span><i class="showcase-connector"></i><i class="showcase-node"></i><span>Send</span></div>
    `;
    leftRail.appendChild(card);
  }

  const rightRail = document.querySelector('.side-rail-right');
  if (rightRail && !rightRail.querySelector('.right-metrics')) {
    const visual = rightRail.querySelector('.share-visual');
    if (visual) {
      ['p1','p2','p3'].forEach(c => { const dot=document.createElement('i'); dot.className=`side-ambient-particle ${c}`; visual.appendChild(dot); });
    }
    const metrics = document.createElement('div');
    metrics.className = 'right-metrics';
    metrics.innerHTML = `
      <div class="right-metric"><strong>2 GB</strong><span>transfer</span></div>
      <div class="right-metric"><strong>7 days</strong><span>lifetime</span></div>
      <div class="right-metric"><strong>0 steps</strong><span>extra friction</span></div>
    `;
    rightRail.appendChild(metrics);
  }

  const trust = document.querySelector('.trust-row');
  if (trust && !document.getElementById('contact')) {
    const contact = document.createElement('section');
    contact.id = 'contact';
    contact.className = 'landing-contact';
    contact.innerHTML = `
      <div><span class="contact-kicker">NEED A HAND?</span><h2>Questions, feedback, or ideas?</h2><p>CloudDrop is built as a focused file-sharing experience. Reach out through the project space for feedback, bugs, or improvements.</p></div>
      <div class="contact-actions"><a class="btn btn-secondary" href="https://github.com/Ibad84671/cloud-drop/issues" target="_blank" rel="noreferrer">Open project contact</a><a class="btn btn-primary" href="https://github.com/Ibad84671/cloud-drop" target="_blank" rel="noreferrer">View GitHub</a></div>
    `;
    trust.after(contact);
  }

  const footer = document.querySelector('.site-footer');
  if (footer && !footer.querySelector('.footer-contact-link')) {
    const contactLink = document.createElement('a');
    contactLink.className = 'footer-contact-link';
    contactLink.href = '#contact';
    contactLink.textContent = 'Contact / Feedback';
    contactLink.style.cssText = 'color:var(--muted);text-decoration:none;font-size:11px;margin-left:14px';
    footer.insertBefore(contactLink, footer.lastElementChild);
  }

  const config = window.CLOUDDROP_CONFIG || {};
  if (config.emailEnabled === false) {
    const emailBtn = document.getElementById('email-btn');
    const emailStatus = document.getElementById('email-status');
    if (emailBtn) {
      emailBtn.disabled = true;
      emailBtn.textContent = 'Coming soon';
      emailBtn.title = 'Email delivery is not enabled in this deployment yet.';
    }
    if (emailStatus && !emailStatus.textContent) {
      emailStatus.textContent = 'Email sharing is ready in the UI; delivery will activate when SES is configured.';
    }
  }
})();
