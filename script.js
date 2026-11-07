document.addEventListener('DOMContentLoaded', () => {
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let lastFocusedElement = null;
  let pageScroll = null;

  const syncBodyLock = () => {
    const hasOpenModal = Array.from(document.querySelectorAll('.modal'))
      .some(item => item.style.display === 'flex');
    document.body.classList.toggle('modal-open', hasOpenModal);
    if (hasOpenModal) pageScroll?.stop();
  };

  const willChangeTokens = new WeakMap();

  const runOptimizedTransition = (element, properties, update, fallbackMs = 1800) => {
    if (!element) return;

    const token = Symbol('will-change');
    willChangeTokens.set(element, token);
    element.style.willChange = properties;

    const cleanup = () => {
      if (willChangeTokens.get(element) !== token) return;
      element.style.willChange = 'auto';
      willChangeTokens.delete(element);
    };

    element.addEventListener('transitionend', cleanup, { once: true });
    window.setTimeout(cleanup, fallbackMs);
    window.requestAnimationFrame(update);
  };

  // ═══════════════════════════════════════
  //  Navigation
  // ═══════════════════════════════════════

  // Full-page wheel navigation outside Projects; proportional, linear motion
  // through Projects and down into About. Touch and keyboard remain native.
  const createPageScroll = () => {
    const sections = ['begin', 'showreel', 'projects', 'about']
      .map(id => document.getElementById(id));
    if (sections.some(section => !section)) return null;

    const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');
    const root = document.documentElement;
    root.classList.add('wheel-scroll');
    let frame = 0;
    let animation = null;
    let snapLocked = false;
    let lastWheel = -Infinity;
    let lastDirection = 0;
    const gestureGap = 200;
    const maxScroll = () => Math.max(0, root.scrollHeight - window.innerHeight);
    const clamp = y => Math.max(0, Math.min(maxScroll(), y));
    const sectionTop = section => clamp(section.getBoundingClientRect().top + window.scrollY);

    const stop = () => {
      cancelAnimationFrame(frame);
      frame = 0;
      animation = null;
      snapLocked = false;
      lastWheel = -Infinity;
      lastDirection = 0;
    };

    const animate = (target, mode) => {
      cancelAnimationFrame(frame);
      const from = window.scrollY;
      const to = clamp(target);
      if (motionPreference.matches || Math.abs(to - from) < 0.5) {
        window.scrollTo(0, to);
        frame = 0;
        animation = null;
        return;
      }
      const duration = mode === 'page' ? 700 : 160;
      const start = performance.now();
      animation = {to, mode};
      const tick = now => {
        const progress = Math.min(1, (now - start) / duration);
        const amount = mode === 'page'
          ? (progress < 0.5 ? 4 * progress ** 3 : 1 - (-2 * progress + 2) ** 3 / 2)
          : progress;
        window.scrollTo(0, from + (to - from) * amount);
        if (progress < 1) {
          frame = requestAnimationFrame(tick);
        } else {
          frame = 0;
          animation = null;
        }
      };
      frame = requestAnimationFrame(tick);
    };

    const scrollToSection = section => {
      stop();
      snapLocked = true;
      animate(sectionTop(section), 'page');
    };

    const hasLocalScroll = (event, direction) => event.composedPath().some(element => {
      if (!(element instanceof Element) || element === root || element === document.body) return false;
      if (element.matches('input, textarea, select, [contenteditable]:not([contenteditable="false"])')) return true;
      const scrollable = /^(auto|scroll|overlay)$/.test(getComputedStyle(element).overflowY);
      return scrollable && element.scrollHeight > element.clientHeight &&
        (direction < 0 ? element.scrollTop > 0 : element.scrollTop + element.clientHeight < element.scrollHeight - 1);
    });

    window.addEventListener('wheel', event => {
      if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.shiftKey ||
          !event.deltaY || Math.abs(event.deltaX) > Math.abs(event.deltaY) ||
          document.body.classList.contains('modal-open') || hasLocalScroll(event, Math.sign(event.deltaY))) {
        stop();
        return;
      }
      if (!event.cancelable) { stop(); return; }
      event.preventDefault();
      const now = performance.now();
      const newGesture = now - lastWheel > gestureGap;
      lastWheel = now;
      // Absorb the rest of a wheel/trackpad gesture after a page transition.
      if (snapLocked) {
        if (animation || !newGesture) return;
        snapLocked = false;
      }

      const direction = Math.sign(event.deltaY);
      const y = window.scrollY;
      const [begin, showreel, projects, about] = sections.map(sectionTop);
      let pageTarget = null;
      if (y < projects - 2) {
        if (direction > 0) pageTarget = y < showreel - 2 ? showreel : projects;
        else pageTarget = y > showreel + 2 ? showreel : begin;
      } else if (direction < 0 && y >= about - 2) {
        pageTarget = projects;
      } else if (direction < 0 && y <= projects + 2) {
        // Reaching the top while scrolling through Projects stops there first.
        if (newGesture) pageTarget = showreel;
        else return;
      }

      if (pageTarget !== null) {
        snapLocked = true;
        animate(pageTarget, 'page');
      } else {
        const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? window.innerHeight : 1;
        const pending = animation?.mode === 'linear' && direction === lastDirection ? animation.to : y;
        const delta = Math.max(-window.innerHeight, Math.min(window.innerHeight, event.deltaY * unit));
        animate(Math.max(projects, pending + delta), 'linear');
      }
      lastDirection = direction;
    }, {passive: false});

    window.addEventListener('keydown', event => {
      if (['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End', ' '].includes(event.key)) stop();
    });
    ['pointerdown', 'touchstart', 'resize', 'blur'].forEach(type =>
      window.addEventListener(type, stop, {passive: true}));
    document.addEventListener('visibilitychange', stop);
    motionPreference.addEventListener('change', stop);
    return {stop, scrollToSection};
  };

  pageScroll = createPageScroll();
  const navLinks = Array.from(document.querySelectorAll('.navbar a'));

  navLinks.forEach(anchor => {
    anchor.addEventListener('click', function(e) {
      e.preventDefault();
      const target = document.querySelector(this.getAttribute('href'));
      if (target) {
        if (pageScroll) pageScroll.scrollToSection(target);
        else target.scrollIntoView({ behavior: prefersReducedMotion ? 'auto' : 'smooth' });
      }
    });
  });

  const setActiveNav = sectionId => {
    navLinks.forEach(link => {
      const isCurrent = link.getAttribute('href') === `#${sectionId}`;
      if (isCurrent) {
        link.setAttribute('aria-current', 'page');
      } else {
        link.removeAttribute('aria-current');
      }
    });
  };

  const navSections = navLinks
    .map(link => document.querySelector(link.getAttribute('href')))
    .filter(Boolean);

  // A compact About section never reaches the upper viewport observation band.
  // At the document end it is the current section, even below that band.
  let navFrame = 0;
  const updateActiveNav = () => {
    navFrame = 0;
    const atEnd = window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 2;
    const current = atEnd ? navSections[navSections.length - 1] :
      navSections.filter(section => section.getBoundingClientRect().top <= window.innerHeight * 0.38).pop();
    if (current) setActiveNav(current.id);
  };
  const queueActiveNav = () => {
    if (!navFrame) navFrame = requestAnimationFrame(updateActiveNav);
  };
  window.addEventListener('scroll', queueActiveNav, {passive: true});
  window.addEventListener('resize', queueActiveNav, {passive: true});
  updateActiveNav();

  // Prevent image/video drag
  document.querySelectorAll('img, video').forEach(el =>
    el.addEventListener('dragstart', e => e.preventDefault())
  );

  // ═══════════════════════════════════════
  //  Showreel visuals
  // ═══════════════════════════════════════

  const showreelSection = document.getElementById('showreel');
  const coverContainer = document.getElementById('cover-container');

  const revealShowreel = () => {
    if (!showreelSection) return;
    if (prefersReducedMotion) {
      showreelSection.classList.add('is-visible');
      return;
    }
    runOptimizedTransition(coverContainer, 'opacity, transform', () => {
      showreelSection.classList.add('is-visible');
    }, 1000);
  };

  if (showreelSection && 'IntersectionObserver' in window) {
    const showreelObserver = new IntersectionObserver(entries => {
      const hasEntered = entries.some(entry => entry.isIntersecting);
      if (!hasEntered) return;
      revealShowreel();
      showreelObserver.disconnect();
    }, { threshold: 0.22 });
    showreelObserver.observe(showreelSection);
  } else {
    revealShowreel();
  }

  const warmShowreelImages = () => {
    document.querySelectorAll('#showreel img').forEach(image => {
      image.decode?.().catch(() => {});
    });
  };

  if ('requestIdleCallback' in window) {
    window.requestIdleCallback(warmShowreelImages, { timeout: 1500 });
  } else {
    window.setTimeout(warmShowreelImages, 300);
  }

  // ═══════════════════════════════════════
  //  Showreel modal (Bilibili iframe)
  // ═══════════════════════════════════════

  const showreelModal = document.getElementById('video-modal');
  const showreelClose = showreelModal?.querySelector('.close-btn');
  const showreelContent = showreelModal?.querySelector('.modal-content');
  let stopShowreel = () => {};

  showreelContent?.addEventListener('click', e => e.stopPropagation());
  showreelContent?.addEventListener('touchstart', e => e.stopPropagation(), { passive: true });

  const openShowreel = () => {
    if (!showreelModal || !showreelContent) return;
    lastFocusedElement = document.activeElement;
    showreelModal.style.display = 'flex';
    showreelModal.setAttribute('aria-hidden', 'false');
    syncBodyLock();
    stopShowreel();
    stopShowreel = window.YaelumPortfolioPlayer(showreelContent, 1, 'BV1y2eA6MENg', 'Yaelum Showreel 2023–2026');
    showreelClose?.focus();
  };

  const closeShowreel = () => {
    if (!showreelModal) return;
    showreelModal.style.display = 'none';
    showreelModal.setAttribute('aria-hidden', 'true');
    stopShowreel();
    syncBodyLock();
    lastFocusedElement?.focus();
  };

  coverContainer?.addEventListener('click', openShowreel);
  coverContainer?.addEventListener('keydown', event => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      openShowreel();
    }
  });
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
  let stopWorkPlayer = () => {};

  modalContent?.addEventListener('click', e => e.stopPropagation());
  modalContent?.addEventListener('touchstart', e => e.stopPropagation(), { passive: true });

  const openWorkCard = card => {
    if (!modal || !modalContent || !modalImg) return;

    lastFocusedElement = document.activeElement;
    stopWorkPlayer();
    if (card.dataset.type === 'video') {
      modalImg.style.display = 'none';
      stopWorkPlayer = window.YaelumPortfolioPlayer(modalContent, Number(card.dataset.page || 1), card.dataset.bvid, card.querySelector('h3')?.textContent?.trim() || '作品播放器');
    } else {
      modalImg.src = card.dataset.src;
      modalImg.alt = card.querySelector('img')?.alt || '作品大图预览';
      modalImg.style.display = 'block';
    }

    modal.style.display = 'flex';
    modal.setAttribute('aria-hidden', 'false');
    syncBodyLock();
    modalClose?.focus();
  };

  document.querySelectorAll('.work-card').forEach(card => {
    const title = card.querySelector('h3')?.textContent?.trim() || '作品';
    card.setAttribute('role', 'button');
    card.setAttribute('tabindex', '0');
    card.setAttribute('aria-label', `打开${title}`);
    card.setAttribute('aria-haspopup', 'dialog');
    card.setAttribute('aria-controls', 'modal');
    card.addEventListener('click', () => openWorkCard(card));
    card.addEventListener('keydown', event => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        openWorkCard(card);
      }
    });
  });

  const closeWorkModal = () => {
    stopWorkPlayer();
    if (!modal) return;
    modal.style.display = 'none';
    modal.setAttribute('aria-hidden', 'true');
    syncBodyLock();
    lastFocusedElement?.focus();
  };

  modalClose?.addEventListener('click', closeWorkModal);
  modal?.addEventListener('click', e => {
    if (e.target === modal) closeWorkModal();
  });

  document.addEventListener('keydown', event => {
    if (event.key !== 'Escape') return;
    if (showreelModal?.style.display === 'flex') {
      closeShowreel();
    } else if (modal?.style.display === 'flex') {
      closeWorkModal();
    }
  });

});
