document.addEventListener('DOMContentLoaded', () => {

  // ═══════════════════════════════════════
  //  Navigation
  // ═══════════════════════════════════════

  document.querySelectorAll('.navbar a').forEach(anchor => {
    anchor.addEventListener('click', function(e) {
      e.preventDefault();
      const target = document.querySelector(this.getAttribute('href'));
      if (target) target.scrollIntoView({ behavior: 'smooth' });
    });
  });

  // ═══════════════════════════════════════
  //  Scroll system
  // ═══════════════════════════════════════

  const sections = Array.from(document.querySelectorAll('section'));
  const projectsSection = document.getElementById('projects');
  const WHEEL_THRESHOLD = 35;
  const BOUNDARY_RATIO = 0.03;

  let isSnapScrolling = false;
  let wheelAccumulator = 0;
  let wheelResetTimer = null;

  const getBoundaryZone = (section) => section.offsetHeight * BOUNDARY_RATIO;

  const isAtTop = (section) => {
    const rect = section.getBoundingClientRect();
    return Math.abs(rect.top) <= getBoundaryZone(section);
  };

  const isAtBottom = (section) => {
    const rect = section.getBoundingClientRect();
    return Math.abs(rect.bottom - window.innerHeight) <= getBoundaryZone(section);
  };

  const getCurrentSectionIndex = () => {
    let best = 0;
    let bestScore = Infinity;
    sections.forEach((section, i) => {
      const rect = section.getBoundingClientRect();
      if (rect.top <= window.innerHeight && rect.bottom >= 0) {
        const score = Math.abs(rect.top);
        if (score < bestScore) { bestScore = score; best = i; }
      }
    });
    return best;
  };

  const resetAccumulator = () => {
    wheelAccumulator = 0;
    if (wheelResetTimer) { clearTimeout(wheelResetTimer); wheelResetTimer = null; }
  };

  const snapTo = (target) => {
    if (!target) return;
    isSnapScrolling = true;
    target.scrollIntoView({ behavior: 'smooth' });
    setTimeout(() => { isSnapScrolling = false; }, 900);
  };

  const handleWheel = function(e) {
    if (window.innerWidth <= 768) return;
    if (isSnapScrolling) { e.preventDefault(); return; }

    const idx = getCurrentSectionIndex();
    const section = sections[idx];
    const dir = e.deltaY > 0 ? 1 : -1;

    // ── PROJECTS: linear scroll with boundary snapping ──
    if (section === projectsSection) {
      const atTop = isAtTop(section);
      const atBottom = isAtBottom(section);

      if (!atTop && !atBottom) { resetAccumulator(); return; }       // inside → free scroll
      if (atTop && dir > 0)    { resetAccumulator(); return; }       // enter from top → scroll down
      if (atBottom && dir < 0) { resetAccumulator(); return; }       // from bottom → scroll up
      if (atTop && dir < 0) {                                       // top edge ↑ → snap to SHOWREEL
        e.preventDefault();
        snapTo(sections[Math.max(idx - 1, 0)]);
        resetAccumulator();
        return;
      }
      if (atBottom && dir > 0) { resetAccumulator(); return; }      // bottom edge ↓ → linear into ABOUT
    }

    // ── Transition zone: PROJECTS bottom at viewport, ABOUT detected as current ──
    if (section !== projectsSection) {
      const pRect = projectsSection.getBoundingClientRect();
      const nearBottom = Math.abs(pRect.bottom - window.innerHeight) <= getBoundaryZone(projectsSection);
      if (nearBottom) { resetAccumulator(); return; }
    }

    // ── General snap scroll ──
    const targetIdx = Math.min(Math.max(idx + dir, 0), sections.length - 1);
    if (targetIdx === idx) { resetAccumulator(); return; }  // no target → free scroll

    e.preventDefault();
    wheelAccumulator += e.deltaY;
    if (wheelResetTimer) clearTimeout(wheelResetTimer);
    wheelResetTimer = setTimeout(resetAccumulator, 150);
    if (Math.abs(wheelAccumulator) < WHEEL_THRESHOLD) return;

    const target = sections[targetIdx];
    if (!target) return;
    resetAccumulator();
    snapTo(target);
  };

  window.addEventListener('wheel', handleWheel, { passive: false });

  // Prevent image/video drag
  document.querySelectorAll('img, video').forEach(el =>
    el.addEventListener('dragstart', e => e.preventDefault())
  );

  // ═══════════════════════════════════════
  //  Showreel visuals
  // ═══════════════════════════════════════

  const showreelSection = document.getElementById('showreel');
  const bgA = document.getElementById('bg-a');
  const bgSolidOverlay = document.getElementById('bg-solid-overlay');
  const coverImg = document.getElementById('cover-img');
  let bgShown = false;
  let coverShown = false;
  let showreelWasActive = false;

  const onScrollShowreel = () => {
    if (!showreelSection) return;
    const rect = showreelSection.getBoundingClientRect();

    // Background image fade-in (once)
    if (!bgShown && rect.top < window.innerHeight * 0.35) {
      bgA.style.opacity = '1';
      bgShown = true;
    }
    // Cover image fade-in (once)
    if (!coverShown && rect.top < window.innerHeight * 0.65) {
      coverImg.style.opacity = '1';
      coverShown = true;
    }

    // Solid overlay: enter → 80%→0%, leave → 0%→80%
    if (!bgSolidOverlay) return;
    const isActive = rect.top < window.innerHeight * 0.6
                  && rect.bottom > window.innerHeight * 0.4;
    if (isActive !== showreelWasActive) {
      bgSolidOverlay.style.transition = 'opacity 0.8s ease';
      bgSolidOverlay.style.opacity = isActive ? '0' : '0.8';
    }
    showreelWasActive = isActive;
  };

  window.addEventListener('scroll', onScrollShowreel, { passive: true });
  onScrollShowreel();

  // ═══════════════════════════════════════
  //  Showreel modal (Bilibili iframe)
  // ═══════════════════════════════════════

  const showreelModal = document.getElementById('video-modal');
  const showreelClose = showreelModal?.querySelector('.close-btn');
  const showreelContent = showreelModal?.querySelector('.modal-content');

  showreelContent?.addEventListener('click', e => e.stopPropagation());
  showreelContent?.addEventListener('touchstart', e => e.stopPropagation(), { passive: true });

  const openShowreel = () => {
    if (!showreelModal || !showreelContent) return;
    showreelModal.style.display = 'flex';
    let iframe = document.getElementById('showreel-bilibili-iframe');
    if (!iframe) {
      iframe = document.createElement('iframe');
      iframe.id = 'showreel-bilibili-iframe';
      iframe.width = '100%';
      iframe.height = '100%';
      iframe.frameBorder = '0';
      iframe.allow = 'autoplay; fullscreen; picture-in-picture';
      iframe.allowFullscreen = true;
      showreelContent.appendChild(iframe);
    }
    iframe.src = 'https://player.bilibili.com/player.html?bvid=BV19KpezdExJ&page=9&p=9&autoplay=1';
  };

  const closeShowreel = () => {
    showreelModal.style.display = 'none';
    const iframe = document.getElementById('showreel-bilibili-iframe');
    if (iframe) iframe.src = '';
  };

  document.getElementById('cover-container')?.addEventListener('click', openShowreel);
  showreelClose?.addEventListener('click', closeShowreel);
  showreelModal?.addEventListener('click', e => {
    if (e.target === showreelModal) closeShowreel();
  });

  // ═══════════════════════════════════════
  //  Work card modal (Bilibili / image)
  // ═══════════════════════════════════════

  const modal = document.getElementById('modal');
  const modalClose = modal?.querySelector('.close-btn');
  const modalContent = modal?.querySelector('.modal-content');
  const modalImg = document.getElementById('modal-img');
  let modalIframe = null;

  modalContent?.addEventListener('click', e => e.stopPropagation());
  modalContent?.addEventListener('touchstart', e => e.stopPropagation(), { passive: true });

  document.querySelectorAll('.work-card').forEach(card => {
    card.addEventListener('click', () => {
      if (!modal || !modalContent || !modalImg) return;

      if (card.dataset.type === 'video') {
        modalImg.style.display = 'none';
        if (!modalIframe) {
          modalIframe = document.createElement('iframe');
          modalIframe.width = '100%';
          modalIframe.height = '100%';
          modalIframe.frameBorder = '0';
          modalIframe.allow = 'autoplay; fullscreen; picture-in-picture';
          modalIframe.allowFullscreen = true;
          modalContent.appendChild(modalIframe);
        }
        modalIframe.src = `https://player.bilibili.com/player.html?bvid=${card.dataset.bvid}&page=${card.dataset.page || 1}&p=${card.dataset.page || 1}&autoplay=1`;
        modalIframe.style.display = 'block';
      } else {
        if (modalIframe) modalIframe.style.display = 'none';
        modalImg.src = card.dataset.src;
        modalImg.style.display = 'block';
      }

      modal.style.display = 'flex';
    });
  });

  const closeWorkModal = () => {
    if (modalIframe) modalIframe.src = '';
    if (modal) modal.style.display = 'none';
  };

  modalClose?.addEventListener('click', closeWorkModal);
  modal?.addEventListener('click', e => {
    if (e.target === modal) closeWorkModal();
  });

});
