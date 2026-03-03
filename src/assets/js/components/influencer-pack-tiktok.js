const TIKTOK_EMBED_SCRIPT_SRC = 'https://www.tiktok.com/embed.js';
const TIKTOK_AUTO_SCROLL_INTERVAL = 4200;

let tiktokEmbedScriptPromise = null;
let tiktokEmbedPreloadScheduled = false;

salla.onReady(() => {
  const blocks = Array.from(document.querySelectorAll('.s-block--influencer-pack-tiktok'));
  if (!blocks.length) {
    return;
  }

  document.documentElement.classList.add('has-tiktok-pack');
  document.body.classList.add('has-tiktok-pack');
  scheduleTikTokEmbedPreload();
  blocks.forEach((block) => setupTikTokPack(block));
});

function setupTikTokPack(block) {
  if (block.dataset.jsInitialized === 'true') {
    return;
  }
  block.dataset.jsInitialized = 'true';

  const bgColor = block.dataset.bgColor;
  if (bgColor) {
    block.style.setProperty('--tiktok-section-bg', bgColor);
  }
  const navBgColor = block.dataset.navBgColor;
  if (navBgColor) {
    block.style.setProperty('--tiktok-nav-bg', navBgColor);
  }
  const navIconColor = block.dataset.navIconColor;
  if (navIconColor) {
    block.style.setProperty('--tiktok-nav-icon', navIconColor);
    block.style.setProperty('--tiktok-nav-border', navIconColor);
  }

  const track = block.querySelector('.influencer-pack-tiktok__track');
  const cards = Array.from(block.querySelectorAll('.influencer-pack-tiktok__card'));
  if (!track || !cards.length) {
    return;
  }

  setupLazyEmbedScriptLoad(block, track);

  const navPrev = block.querySelector('.influencer-pack-tiktok__nav--prev');
  const navNext = block.querySelector('.influencer-pack-tiktok__nav--next');
  const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const isRtl = getComputedStyle(track).direction === 'rtl' || document.documentElement.dir === 'rtl';

  syncNavIcons(navPrev, navNext, isRtl);

  let activeIndex = 0;
  let autoScrollTimer = null;
  let isAutoScrollPausedByHover = false;
  let sectionInView = isSectionInViewport();

  setActiveCard(0);
  resetPageHorizontalShift();
  resetInitialTrackPosition();
  startAutoScroll();

  if (navPrev) {
    navPrev.addEventListener('click', () => scrollToCard(activeIndex - 1));
  }

  if (navNext) {
    navNext.addEventListener('click', () => scrollToCard(activeIndex + 1));
  }

  track.addEventListener('keydown', (event) => {
    const nextKey = isRtl ? 'ArrowLeft' : 'ArrowRight';
    const prevKey = isRtl ? 'ArrowRight' : 'ArrowLeft';

    if (event.key === nextKey) {
      event.preventDefault();
      scrollToCard(activeIndex + 1);
      return;
    }

    if (event.key === prevKey) {
      event.preventDefault();
      scrollToCard(activeIndex - 1);
    }
  });

  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(
      (entries) => {
        let bestIndex = activeIndex;
        let bestRatio = 0;

        entries.forEach((entry) => {
          if (!entry.isIntersecting) {
            return;
          }

          const index = Number(entry.target.dataset.index || 0);
          if (entry.intersectionRatio > bestRatio) {
            bestRatio = entry.intersectionRatio;
            bestIndex = index;
          }
        });

        if (bestRatio >= 0.55) {
          setActiveCard(bestIndex);
        }
      },
      {
        root: track,
        threshold: [0.35, 0.55, 0.8],
      }
    );

    cards.forEach((card) => observer.observe(card));

    const sectionObserver = new IntersectionObserver(
      (entries) => {
        const sectionEntry = entries[0];
        if (!sectionEntry) {
          return;
        }

        sectionInView = sectionEntry.isIntersecting;
        if (sectionInView) {
          startAutoScroll();
          return;
        }

        stopAutoScroll();
      },
      { threshold: [0.12] }
    );

    sectionObserver.observe(block);
  }

  window.setTimeout(resetInitialTrackPosition, 120);
  window.setTimeout(resetInitialTrackPosition, 500);
  window.setTimeout(resetPageHorizontalShift, 40);
  window.setTimeout(resetPageHorizontalShift, 240);
  window.setTimeout(resetPageHorizontalShift, 700);
  window.addEventListener('load', resetInitialTrackPosition, { once: true });
  window.addEventListener('load', resetPageHorizontalShift, { once: true });
  window.addEventListener('resize', resetInitialTrackPosition);
  window.addEventListener('resize', resetPageHorizontalShift);
  document.addEventListener('visibilitychange', syncAutoScrollVisibilityState);
  block.addEventListener('mouseenter', pauseAutoScrollOnHover);
  block.addEventListener('mouseleave', resumeAutoScrollAfterHover);

  function scrollToCard(index) {
    const safeIndex = clamp(index, 0, cards.length - 1);
    track.scrollTo({
      left: getCardCenteredLeft(cards[safeIndex]),
      behavior: reduceMotion ? 'auto' : 'smooth',
    });
    setActiveCard(safeIndex);
  }

  function setActiveCard(index) {
    activeIndex = clamp(index, 0, cards.length - 1);

    cards.forEach((card, reelIndex) => {
      const isActive = reelIndex === activeIndex;
      card.classList.toggle('is-active', isActive);
      card.setAttribute('aria-current', isActive ? 'true' : 'false');
    });

    syncNavDisabledState(navPrev, navNext, activeIndex, cards.length);
  }

  function startAutoScroll() {
    if (
      cards.length <= 1 ||
      reduceMotion ||
      autoScrollTimer ||
      isAutoScrollPausedByHover ||
      document.hidden ||
      !sectionInView
    ) {
      return;
    }

    autoScrollTimer = window.setInterval(() => {
      const nextIndex = activeIndex >= cards.length - 1 ? 0 : activeIndex + 1;
      scrollToCard(nextIndex);
    }, TIKTOK_AUTO_SCROLL_INTERVAL);
  }

  function stopAutoScroll() {
    if (!autoScrollTimer) {
      return;
    }

    window.clearInterval(autoScrollTimer);
    autoScrollTimer = null;
  }

  function pauseAutoScrollOnHover() {
    isAutoScrollPausedByHover = true;
    stopAutoScroll();
  }

  function resumeAutoScrollAfterHover() {
    isAutoScrollPausedByHover = false;
    startAutoScroll();
  }

  function syncAutoScrollVisibilityState() {
    if (document.hidden) {
      stopAutoScroll();
      return;
    }

    startAutoScroll();
  }

  function getCardCenteredLeft(card) {
    if (!card) {
      return track.scrollLeft;
    }

    const rawLeft = card.offsetLeft + card.offsetWidth / 2 - track.clientWidth / 2;
    const maxLeft = Math.max(track.scrollWidth - track.clientWidth, 0);
    return clamp(rawLeft, 0, maxLeft);
  }

  function isSectionInViewport() {
    const rect = block.getBoundingClientRect();
    return rect.bottom > 0 && rect.top < window.innerHeight;
  }

  function resetInitialTrackPosition() {
    if (!cards.length) {
      return;
    }

    track.scrollTo({ left: 0, behavior: 'auto' });
    track.scrollLeft = 0;
    setActiveCard(0);
  }

  function resetPageHorizontalShift() {
    if (window.scrollX !== 0) {
      window.scrollTo({ left: 0, top: window.scrollY, behavior: 'auto' });
    }
  }
}

function setupLazyEmbedScriptLoad(block, track) {
  let isLoadingRequested = false;
  let viewportObserver = null;

  const requestLoad = () => {
    if (isLoadingRequested) {
      return;
    }

    isLoadingRequested = true;
    ensureTikTokEmbedScript()
      .then(() => {
        if (viewportObserver) {
          viewportObserver.disconnect();
        }
      })
      .catch(() => {
        isLoadingRequested = false;
      });
  };

  block.addEventListener('pointerenter', requestLoad, { once: true });
  track.addEventListener('pointerdown', requestLoad, { once: true, passive: true });
  track.addEventListener('focusin', requestLoad, { once: true });

  if ('IntersectionObserver' in window) {
    viewportObserver = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          requestLoad();
        }
      },
      {
        root: null,
        rootMargin: '900px 0px',
        threshold: 0.01,
      }
    );

    viewportObserver.observe(block);
    return;
  }

  requestLoad();
}

function scheduleTikTokEmbedPreload() {
  if (tiktokEmbedPreloadScheduled) {
    return;
  }
  tiktokEmbedPreloadScheduled = true;

  const loadScriptWhenVisible = () => {
    if (document.hidden) {
      document.addEventListener(
        'visibilitychange',
        () => {
          if (!document.hidden) {
            ensureTikTokEmbedScript().catch(() => {});
          }
        },
        { once: true }
      );
      return;
    }

    ensureTikTokEmbedScript().catch(() => {});
  };

  if ('requestIdleCallback' in window) {
    window.requestIdleCallback(loadScriptWhenVisible, { timeout: 2200 });
    return;
  }

  window.setTimeout(loadScriptWhenVisible, 1200);
}

function ensureTikTokEmbedScript() {
  if (tiktokEmbedScriptPromise) {
    return tiktokEmbedScriptPromise;
  }

  const existingScript = document.querySelector(`script[src="${TIKTOK_EMBED_SCRIPT_SRC}"]`);
  if (existingScript) {
    tiktokEmbedScriptPromise = waitForTikTokEmbedScript(existingScript);
    return tiktokEmbedScriptPromise;
  }

  const script = document.createElement('script');
  script.src = TIKTOK_EMBED_SCRIPT_SRC;
  script.async = true;
  tiktokEmbedScriptPromise = waitForTikTokEmbedScript(script);
  document.head.appendChild(script);

  return tiktokEmbedScriptPromise;
}

function waitForTikTokEmbedScript(script) {
  if (
    script.dataset.loaded === 'true' ||
    script.readyState === 'loaded' ||
    script.readyState === 'complete' ||
    isTikTokEmbedReady()
  ) {
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    const handleLoad = () => {
      script.dataset.loaded = 'true';
      resolve();
    };

    const handleError = () => {
      tiktokEmbedScriptPromise = null;
      reject(new Error('TikTok embed script failed to load'));
    };

    script.addEventListener('load', handleLoad, { once: true });
    script.addEventListener('error', handleError, { once: true });
  });
}

function isTikTokEmbedReady() {
  return typeof window.tiktokEmbed === 'object' && window.tiktokEmbed !== null;
}

function syncNavIcons(navPrev, navNext, isRtl) {
  if (!navPrev || !navNext) {
    return;
  }

  const prevIcon = navPrev.querySelector('i');
  const nextIcon = navNext.querySelector('i');

  if (!prevIcon || !nextIcon) {
    return;
  }

  // Salla icon names are visually inverted for these arrows.
  // Keep visual order as "< >" by button position in both LTR and RTL.
  prevIcon.className = isRtl ? 'sicon-keyboard_arrow_left' : 'sicon-keyboard_arrow_right';
  nextIcon.className = isRtl ? 'sicon-keyboard_arrow_right' : 'sicon-keyboard_arrow_left';
}

function syncNavDisabledState(prevButton, nextButton, activeIndex, total) {
  if (prevButton) {
    const isDisabled = activeIndex <= 0;
    prevButton.disabled = isDisabled;
    prevButton.setAttribute('aria-disabled', isDisabled ? 'true' : 'false');
  }

  if (nextButton) {
    const isDisabled = activeIndex >= total - 1;
    nextButton.disabled = isDisabled;
    nextButton.setAttribute('aria-disabled', isDisabled ? 'true' : 'false');
  }
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}
