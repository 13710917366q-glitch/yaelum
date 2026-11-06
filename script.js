document.addEventListener('DOMContentLoaded', () => {
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let lastFocusedElement = null;

  const syncBodyLock = () => {
    const hasOpenModal = Array.from(document.querySelectorAll('.modal'))
      .some(item => item.style.display === 'flex');
    document.body.classList.toggle('modal-open', hasOpenModal);
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

  const navLinks = Array.from(document.querySelectorAll('.navbar a'));

  navLinks.forEach(anchor => {
    anchor.addEventListener('click', function(e) {
      e.preventDefault();
      const target = document.querySelector(this.getAttribute('href'));
      if (target) {
        target.scrollIntoView({ behavior: prefersReducedMotion ? 'auto' : 'smooth' });
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

  if ('IntersectionObserver' in window) {
    const navObserver = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) setActiveNav(entry.target.id);
      });
    }, {
      rootMargin: '-32% 0px -58% 0px',
      threshold: 0
    });
    navSections.forEach(section => navObserver.observe(section));
  } else {
    setActiveNav('begin');
  }

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
    stopShowreel = window.YaelumPortfolioPlayer(showreelContent, 9, 'BV19KpezdExJ', 'Yaelum Showreel');
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
