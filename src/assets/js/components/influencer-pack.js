/**
 * Influencer Pack component behavior
 * - One active reel at a time
 * - Autoplay all muted reels (when enabled)
 * - Keyboard and swipe-friendly controls
 */

salla.onReady(() => {
  const blocks = document.querySelectorAll('.s-block--influencer-pack');
  if (!blocks.length) {
    return;
  }

  blocks.forEach((block) => setupInfluencerPack(block));
});

const REELS_AUTO_ADVANCE_INTERVAL = 4200;
const REELS_TOUCH_RESUME_DELAY = 900;
const REELS_MANUAL_RESUME_DELAY = 5000;

function setupInfluencerPack(block) {
  const copyButtonColor = block.dataset.copyButtonColor;
  if (copyButtonColor) {
    block.style.setProperty('--influencer-copy-btn-bg', copyButtonColor);
  }

  bindCopyCodeButtons(block);
  bindReelStripInteractions(block);

  const track = block.querySelector('.influencer-pack__reels-track');
  const reels = Array.from(block.querySelectorAll('.influencer-pack__reel-card'));
  if (!track || !reels.length) {
    return;
  }
  track.classList.toggle('is-single', reels.length === 1);

  const autoplayEnabled = block.dataset.autoplay === 'true';
  const mutedByDefault = block.dataset.muted !== 'false';
  const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const navPrev = block.querySelector('.influencer-pack__nav--prev');
  const navNext = block.querySelector('.influencer-pack__nav--next');
  const htmlDir = (document.documentElement.getAttribute('dir') || '').toLowerCase();
  const bodyDir = (document.body && document.body.getAttribute('dir') ? document.body.getAttribute('dir') : '').toLowerCase();
  const htmlLang = (document.documentElement.getAttribute('lang') || '').toLowerCase();
  const isRtl =
    getComputedStyle(track).direction === 'rtl' ||
    htmlDir === 'rtl' ||
    bodyDir === 'rtl' ||
    htmlLang.startsWith('ar');

  syncNavIcons(navPrev, navNext, isRtl);
  syncNavDisabledState(navPrev, navNext, 0, reels.length);

  let activeIndex = 0;
  let sectionVisible = true;
  let autoAdvanceTimer = null;
  let touchResumeTimer = null;
  let manualResumeTimer = null;
  let manualPauseUntil = 0;
  let isHovering = false;
  let isTouching = false;
  let isFocused = false;
  const ownerDocument = block.ownerDocument || document;

  reels.forEach((reel, index) => {
    reel.dataset.index = String(index);

    const video = reel.querySelector('.influencer-pack__video');
    const mediaSurface = reel.querySelector('.influencer-pack__reel-media');
    const mediaHitTarget = reel.querySelector('.influencer-pack__media-hit-target');
    const toggle = ensurePlayGlyph(reel.querySelector('.influencer-pack__play-toggle'));
    const muteToggle = reel.querySelector('.influencer-pack__mute-toggle');
    const progressFill = reel.querySelector('.influencer-pack__progress-fill');

    if (video) {
      setVideoMuted(video, mutedByDefault);
      video.playsInline = true;
      video.autoplay = autoplayEnabled && mutedByDefault;
      video.preload = autoplayEnabled ? 'auto' : (index <= 1 ? 'metadata' : 'none');
      updateMuteToggle(muteToggle, video.muted);

      video.addEventListener('loadeddata', () => {
        maybeAutoplay(reel);
      });

      video.addEventListener('canplay', () => {
        maybeAutoplay(reel);
      });

      video.addEventListener('play', () => {
        reel.classList.add('is-playing');
        reel.classList.remove('is-manual-required');
        setToggleState(toggle, true);
      });

      video.addEventListener('pause', () => {
        reel.classList.remove('is-playing');
        setToggleState(toggle, false);
      });

      video.addEventListener('ended', () => {
        reel.classList.remove('is-playing');
        reel.classList.add('is-ended');
        setToggleState(toggle, false);
        if (progressFill) {
          progressFill.style.width = '100%';
        }
      });

      video.addEventListener('timeupdate', () => {
        if (!progressFill || !video.duration) {
          return;
        }
        const progress = Math.min((video.currentTime / video.duration) * 100, 100);
        progressFill.style.width = `${progress}%`;
      });

      // Some mobile browsers don't reliably bubble tap events from <video> to parent wrappers.
      video.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        setActiveReel(index, true);
        handleToggle(reel, true);
      });

      video.addEventListener('touchend', (event) => {
        event.preventDefault();
        event.stopPropagation();
        setActiveReel(index, true);
        handleToggle(reel, true);
      });

      // Autoplay can start before listeners are fully attached in some browsers.
      syncToggleWithVideoState(video, toggle);
    }

    if (toggle) {
      toggle.addEventListener('click', () => {
        setActiveReel(index, true);
        handleToggle(reel, true);
      });
    }

    if (mediaHitTarget) {
      mediaHitTarget.addEventListener('click', () => {
        setActiveReel(index, true);
        handleToggle(reel, true);
      });
    }

    if (muteToggle && video) {
      muteToggle.addEventListener('click', () => {
        setActiveReel(index, true);
        const nextMutedState = !video.muted;
        setVideoMuted(video, nextMutedState);
        updateMuteToggle(muteToggle, nextMutedState);
        if (nextMutedState) {
          maybeAutoplay(reel);
        }
      });
    }

    bindMediaSurfaceToggle(mediaSurface, reel, index, setActiveReel, handleToggle);
  });

  if (navPrev) {
    navPrev.addEventListener('click', () => scrollToReel(activeIndex - 1, true));
  }

  if (navNext) {
    navNext.addEventListener('click', () => scrollToReel(activeIndex + 1, true));
  }

  track.addEventListener('keydown', (event) => {
    const nextKey = isRtl ? 'ArrowLeft' : 'ArrowRight';
    const prevKey = isRtl ? 'ArrowRight' : 'ArrowLeft';

    if (event.key === nextKey) {
      event.preventDefault();
      scrollToReel(activeIndex + 1, true);
      return;
    }

    if (event.key === prevKey) {
      event.preventDefault();
      scrollToReel(activeIndex - 1, true);
      return;
    }

    if (event.key === ' ' || event.key === 'Enter') {
      event.preventDefault();
      handleToggle(reels[activeIndex], true);
    }
  });

  track.addEventListener('pointerenter', (event) => {
    if (event.pointerType && event.pointerType !== 'mouse') {
      return;
    }
    isHovering = true;
    stopAutoAdvance();
  });

  track.addEventListener('pointerleave', (event) => {
    if (event.pointerType && event.pointerType !== 'mouse') {
      return;
    }
    isHovering = false;
    startAutoAdvanceIfNeeded();
  });

  track.addEventListener('touchstart', () => {
    isTouching = true;
    window.clearTimeout(touchResumeTimer);
    stopAutoAdvance();
  }, { passive: true });

  track.addEventListener('touchend', scheduleTouchResume, { passive: true });
  track.addEventListener('touchcancel', scheduleTouchResume, { passive: true });

  track.addEventListener('focusin', () => {
    isFocused = true;
    stopAutoAdvance();
  });

  track.addEventListener('focusout', () => {
    const nextFocus = ownerDocument.activeElement;
    isFocused = Boolean(nextFocus && track.contains(nextFocus));
    if (!isFocused) {
      startAutoAdvanceIfNeeded();
    }
  });

  ownerDocument.addEventListener('visibilitychange', () => {
    if (ownerDocument.hidden) {
      stopAutoAdvance();
      return;
    }
    startAutoAdvanceIfNeeded();
  });

  bindWheelNavigation(track, reels, () => activeIndex, scrollToReel, reduceMotion, () => {
    holdAutoAdvanceAfterManualInteraction();
  });

  if ('IntersectionObserver' in window) {
    const reelObserver = new IntersectionObserver(
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

        if (bestRatio >= 0.6) {
          setActiveReel(bestIndex, false);
        }
      },
      {
        root: track,
        threshold: [0.35, 0.6, 0.85],
      }
    );

    reels.forEach((reel) => reelObserver.observe(reel));

    const sectionObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          sectionVisible = entry.isIntersecting;
          if (!sectionVisible) {
            stopAutoAdvance();
            pauseAllMedia();
            return;
          }

          startAutoAdvanceIfNeeded();
          autoplayMutedReels();
        });
      },
      { threshold: [0.15] }
    );

    sectionObserver.observe(block);
  }

  setActiveReel(0, false);
  window.setTimeout(() => autoplayMutedReels(), 120);
  window.setTimeout(() => autoplayMutedReels(), 420);
  startAutoAdvanceIfNeeded();

  function scrollToReel(index, isUserIntent = true) {
    if (!reels.length) {
      return;
    }
    const nextIndex = clamp(index, 0, reels.length - 1);
    track.scrollTo({
      left: getReelCenteredLeft(reels[nextIndex]),
      behavior: reduceMotion ? 'auto' : 'smooth',
    });
    setActiveReel(nextIndex, isUserIntent);
  }

  function getReelCenteredLeft(reel) {
    if (!reel) {
      return track.scrollLeft;
    }

    const trackRect = track.getBoundingClientRect();
    const reelRect = reel.getBoundingClientRect();
    const deltaToCenter = reelRect.left - trackRect.left - (track.clientWidth - reelRect.width) / 2;

    return track.scrollLeft + deltaToCenter;
  }

  function setActiveReel(index, isUserIntent) {
    if (isUserIntent) {
      holdAutoAdvanceAfterManualInteraction();
    }

    const safeIndex = clamp(index, 0, reels.length - 1);
    if (safeIndex === activeIndex && reels[safeIndex].classList.contains('is-active')) {
      return;
    }

    activeIndex = safeIndex;
    syncNavDisabledState(navPrev, navNext, activeIndex, reels.length);

    reels.forEach((reel, reelIndex) => {
      const isActive = reelIndex === activeIndex;
      reel.classList.toggle('is-active', isActive);
      reel.setAttribute('aria-current', isActive ? 'true' : 'false');

      if (!isActive) {
        resetYoutube(reel);
      }
    });

    primeNeighborVideos(reels, activeIndex);
    autoplayMutedReels();
  }

  function maybeAutoplay(reel) {
    if (!reel || !sectionVisible || reduceMotion || !autoplayEnabled) {
      return;
    }

    if (reel.dataset.userPaused === 'true') {
      return;
    }

    const video = reel.querySelector('.influencer-pack__video');
    if (!video || !video.muted) {
      return;
    }

    if (video.readyState < 2) {
      return;
    }

    const playAttempt = video.play();
    if (playAttempt && typeof playAttempt.catch === 'function') {
      playAttempt.then(() => {
        syncToggleWithVideoState(video, reel.querySelector('.influencer-pack__play-toggle'));
      });
      playAttempt
        .catch(() => {
          reel.classList.add('is-manual-required');
          setToggleState(reel.querySelector('.influencer-pack__play-toggle'), false);
        });
    }
  }

  function autoplayMutedReels() {
    if (!sectionVisible || reduceMotion || !autoplayEnabled) {
      return;
    }

    reels.forEach((reel) => {
      maybeAutoplay(reel);
    });
  }

  function handleToggle(reel, isUserIntent) {
    if (!reel) {
      return;
    }
    if (isUserIntent) {
      holdAutoAdvanceAfterManualInteraction();
    }

    const video = reel.querySelector('.influencer-pack__video');
    const youtubeShell = reel.querySelector('.influencer-pack__youtube');
    const toggle = reel.querySelector('.influencer-pack__play-toggle');

    if (video) {
      if (video.paused) {
        reel.dataset.userPaused = 'false';
        const playAttempt = video.play();
        if (playAttempt && typeof playAttempt.catch === 'function') {
          playAttempt.then(() => {
            syncToggleWithVideoState(video, toggle);
          });
          playAttempt.catch(() => {
            reel.classList.add('is-manual-required');
            setToggleState(toggle, false);
          });
        }
      } else {
        reel.dataset.userPaused = 'true';
        video.pause();
      }
      return;
    }

    if (youtubeShell) {
      if (youtubeShell.hidden) {
        youtubeShell.hidden = false;
        reel.classList.add('is-youtube-open');
        setToggleState(toggle, true);
      } else {
        resetYoutube(reel);
        setToggleState(toggle, false);
      }
    }
  }

  function pauseAllMedia() {
    reels.forEach((reel) => {
      pauseReelMedia(reel);
      resetYoutube(reel);
      setToggleState(reel.querySelector('.influencer-pack__play-toggle'), false);
    });
  }

  function shouldAutoAdvance() {
    return (
      reels.length > 1 &&
      !reduceMotion &&
      sectionVisible &&
      !ownerDocument.hidden &&
      !isHovering &&
      !isTouching &&
      !isFocused &&
      Date.now() >= manualPauseUntil
    );
  }

  function startAutoAdvanceIfNeeded() {
    if (autoAdvanceTimer || !shouldAutoAdvance()) {
      return;
    }

    autoAdvanceTimer = window.setInterval(() => {
      if (!shouldAutoAdvance()) {
        stopAutoAdvance();
        return;
      }
      scrollToReel(getNextVisualIndex(), false);
    }, REELS_AUTO_ADVANCE_INTERVAL);
  }

  function stopAutoAdvance() {
    if (!autoAdvanceTimer) {
      return;
    }
    window.clearInterval(autoAdvanceTimer);
    autoAdvanceTimer = null;
  }

  function holdAutoAdvanceAfterManualInteraction() {
    manualPauseUntil = Date.now() + REELS_MANUAL_RESUME_DELAY;
    stopAutoAdvance();
    window.clearTimeout(manualResumeTimer);
    manualResumeTimer = window.setTimeout(() => {
      startAutoAdvanceIfNeeded();
    }, REELS_MANUAL_RESUME_DELAY + 40);
  }

  function scheduleTouchResume() {
    window.clearTimeout(touchResumeTimer);
    touchResumeTimer = window.setTimeout(() => {
      isTouching = false;
      startAutoAdvanceIfNeeded();
    }, REELS_TOUCH_RESUME_DELAY);
  }

  function getNextVisualIndex() {
    const visualOrder = reels
      .map((reel, index) => ({ index, left: reel.getBoundingClientRect().left }))
      .sort((a, b) => a.left - b.left)
      .map((item) => item.index);

    if (!visualOrder.length) {
      return activeIndex;
    }

    const currentPosition = visualOrder.indexOf(activeIndex);
    if (currentPosition === -1) {
      return visualOrder[0];
    }
    return visualOrder[(currentPosition + 1) % visualOrder.length];
  }
}

function pauseReelMedia(reel) {
  const video = reel.querySelector('.influencer-pack__video');
  if (video && !video.paused) {
    video.pause();
  }
}

function setVideoMuted(video, isMuted) {
  video.muted = isMuted;
  video.defaultMuted = isMuted;
  video.loop = isMuted;
}

function primeNeighborVideos(reels, activeIndex) {
  reels.forEach((reel, index) => {
    const video = reel.querySelector('.influencer-pack__video');
    if (!video) {
      return;
    }
    const shouldPrime = Math.abs(index - activeIndex) <= 1;
    if (shouldPrime && video.preload === 'none') {
      video.preload = 'metadata';
      video.load();
    }
  });
}

function resetYoutube(reel) {
  const shell = reel.querySelector('.influencer-pack__youtube');
  const original = shell ? shell.querySelector('lite-youtube') : null;
  if (!shell || !original || shell.hidden) {
    return;
  }

  const next = document.createElement('lite-youtube');
  next.setAttribute('videoid', original.getAttribute('videoid') || '');
  next.setAttribute('params', original.getAttribute('params') || 'rel=0');
  shell.innerHTML = '';
  shell.appendChild(next);
  shell.hidden = true;
  reel.classList.remove('is-youtube-open');
}

function bindCopyCodeButtons(block) {
  block.addEventListener('click', (event) => {
    const button = event.target.closest('.influencer-pack__copy-code');
    if (!button || !block.contains(button)) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    const code = (button.dataset.code || '').trim();
    if (!code) {
      return;
    }

    const originalText = button.dataset.originalText || button.textContent || 'نسخ الكود';
    button.dataset.originalText = originalText;
    copyText(code).then((copied) => {
      if (!copied) {
        return;
      }

      button.textContent = 'تم النسخ';
      button.classList.add('is-copied');
      window.setTimeout(() => {
        button.classList.remove('is-copied');
        button.textContent = originalText;
      }, 1200);
    });
  });
}

function bindReelStripInteractions(block) {
  if (!block) {
    return;
  }

  const productCache = new Map();
  let activeStrip = null;
  let activeStripTrigger = null;

  const closeActiveStrip = () => {
    if (!activeStrip) {
      return;
    }

    const strip = activeStrip;
    strip.classList.remove('is-open');
    strip.setAttribute('aria-hidden', 'true');
    window.setTimeout(() => {
      strip.hidden = true;
      unlockPageScroll();
    }, 220);
    activeStrip = null;
    if (activeStripTrigger && typeof activeStripTrigger.focus === 'function') {
      activeStripTrigger.focus();
    }
    activeStripTrigger = null;
  };

  const openStrip = (stripId, trigger) => {
    if (!stripId) {
      return;
    }

    const strip = block.querySelector(`#${stripId}`);
    if (!strip) {
      return;
    }

    if (activeStrip && activeStrip !== strip) {
      activeStrip.classList.remove('is-open');
      activeStrip.setAttribute('aria-hidden', 'true');
      activeStrip.hidden = true;
    }

    strip.hidden = false;
    strip.setAttribute('aria-hidden', 'false');
    hydrateStripProducts(strip, productCache);
    lockPageScroll();
    window.requestAnimationFrame(() => {
      strip.classList.add('is-open');
      const closeButton = strip.querySelector('.influencer-pack__reel-strip-close');
      if (closeButton && typeof closeButton.focus === 'function') {
        closeButton.focus();
      }
    });
    activeStrip = strip;
    activeStripTrigger = trigger || null;
  };

  block.addEventListener('click', (event) => {
    const openButton = event.target.closest('[data-open-strip]');
    if (openButton && block.contains(openButton)) {
      event.preventDefault();
      event.stopPropagation();
      openStrip(openButton.dataset.openStrip || '', openButton);
      return;
    }
  });

  block.ownerDocument.addEventListener('click', (event) => {
    if (!activeStrip) {
      return;
    }

    const closeButton = event.target.closest('[data-close-strip]');
    if (closeButton && activeStrip.contains(closeButton)) {
      event.preventDefault();
      event.stopPropagation();
      closeActiveStrip();
    }
  });

  block.ownerDocument.addEventListener('keydown', (event) => {
    if (!activeStrip) {
      return;
    }

    if (event.key === 'Escape') {
      closeActiveStrip();
      return;
    }

    if (event.key !== 'Tab') {
      return;
    }

    const focusable = Array.from(
      activeStrip.querySelectorAll('a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])')
    ).filter((el) => !el.hasAttribute('hidden') && el.getAttribute('aria-hidden') !== 'true');

    if (!focusable.length) {
      return;
    }

    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const current = block.ownerDocument.activeElement;

    if (event.shiftKey) {
      if (current === first || !activeStrip.contains(current)) {
        event.preventDefault();
        last.focus();
      }
      return;
    }

    if (current === last) {
      event.preventDefault();
      first.focus();
    }
  });

}

function hydrateStripProducts(strip, productCache) {
  if (!strip) {
    return;
  }

  const list = ensureStripList(strip);
  if (!list) {
    return;
  }

  const ids = (strip.dataset.productIds || '')
    .split(',')
    .map((id) => Number(String(id).trim()))
    .filter((id) => Number.isFinite(id) && id > 0);

  if (!ids.length) {
    list.textContent = list.dataset.errorText || 'تعذر تحميل المنتجات حالياً';
    list.classList.add('is-empty');
    return;
  }

  if (list.dataset.loaded === 'true') {
    return;
  }

  list.classList.remove('is-empty');
  list.innerHTML = '';
  const loadingText = list.dataset.loadingText || 'جاري تحميل المنتجات...';
  const loading = document.createElement('p');
  loading.className = 'influencer-pack__strip-message';
  loading.textContent = loadingText;
  list.appendChild(loading);

  fetchProductsByIds(ids, productCache)
    .then((products) => {
      const available = products.filter(Boolean);
      if (!available.length) {
        throw new Error('No products');
      }
      renderStripProducts(list, available);
      list.dataset.loaded = 'true';
    })
    .catch(() => {
      list.classList.add('is-empty');
      list.innerHTML = '';
      const errorText = list.dataset.errorText || 'تعذر تحميل المنتجات حالياً';
      const errorMessage = document.createElement('p');
      errorMessage.className = 'influencer-pack__strip-message';
      errorMessage.textContent = errorText;
      list.appendChild(errorMessage);
    });
}

function ensureStripList(strip) {
  if (!strip) {
    return null;
  }

  const productsShell = strip.querySelector('.influencer-pack__reel-strip-products');
  if (!productsShell) {
    return null;
  }

  let list = productsShell.querySelector('[data-strip-products]');
  if (list) {
    return list;
  }

  // Backward-compatibility for older twig markup that still renders salla-products-slider.
  productsShell.innerHTML = '';
  list = document.createElement('div');
  list.className = 'influencer-pack__strip-list';
  list.setAttribute('data-strip-products', '');
  list.dataset.loadingText = 'جاري تحميل المنتجات...';
  list.dataset.errorText = 'تعذر تحميل المنتجات حالياً';
  productsShell.appendChild(list);

  return list;
}

function renderStripProducts(list, products) {
  list.innerHTML = '';

  products.forEach((product) => {
    const card = document.createElement('article');
    card.className = 'influencer-pack__strip-item';

    const productUrl = product?.url || product?.permalink || (product?.id ? `/products/${product.id}` : '#');
    const imageUrl = product?.image?.url || product?.thumbnail || '';
    const productName = product?.name || product?.title || 'منتج';

    const thumb = document.createElement('a');
    thumb.className = 'influencer-pack__strip-thumb';
    thumb.href = productUrl;
    thumb.setAttribute('aria-label', productName);

    if (imageUrl) {
      const image = document.createElement('img');
      image.src = imageUrl;
      image.alt = productName;
      image.loading = 'lazy';
      thumb.appendChild(image);
    } else {
      thumb.classList.add('is-placeholder');
      thumb.textContent = '—';
    }

    const body = document.createElement('div');
    body.className = 'influencer-pack__strip-body';

    const title = document.createElement('a');
    title.className = 'influencer-pack__strip-title';
    title.href = productUrl;
    title.textContent = productName;

    const price = document.createElement('p');
    price.className = 'influencer-pack__strip-price';
    const priceValue = document.createElement('span');
    priceValue.className = 'influencer-pack__strip-price-value';
    priceValue.textContent = getProductPriceValue(product);
    const sarIcon = document.createElement('i');
    sarIcon.className = 'sicon-sar';
    sarIcon.setAttribute('aria-hidden', 'true');
    price.appendChild(priceValue);
    price.appendChild(sarIcon);

    const cta = document.createElement('a');
    cta.className = 'influencer-pack__strip-cta';
    cta.href = productUrl;
    cta.textContent = 'عرض المنتج';

    body.appendChild(title);
    body.appendChild(price);
    body.appendChild(cta);

    card.appendChild(thumb);
    card.appendChild(body);
    list.appendChild(card);
  });
}

function getProductPriceValue(product) {
  const candidates = [
    product?.price?.amount,
    product?.regular_price?.amount,
    product?.sale_price?.amount,
    product?.price,
    product?.regular_price,
    product?.sale_price,
  ];

  const value = candidates.find((candidate) => candidate !== undefined && candidate !== null && candidate !== '');
  if (typeof value === 'number' && Number.isFinite(value)) {
    return new Intl.NumberFormat('ar-SA').format(value);
  }

  const asString = String(value || '').trim();
  return asString || '—';
}

async function fetchProductsByIds(ids, productCache) {
  const uniqueIds = Array.from(new Set(ids.map((id) => Number(id)).filter((id) => id > 0)));
  const missingIds = uniqueIds.filter((id) => !productCache.has(id));

  if (missingIds.length) {
    const batchProducts = await fetchProductsBatch(missingIds);
    batchProducts.forEach((product) => {
      const productId = Number(product?.id || 0);
      if (productId) {
        productCache.set(productId, product);
      }
    });

    const unresolved = missingIds.filter((id) => !productCache.has(id));
    if (unresolved.length) {
      const singles = await Promise.allSettled(unresolved.map((id) => fetchProductById(id)));
      singles.forEach((result) => {
        if (result.status !== 'fulfilled') {
          return;
        }
        const product = result.value;
        const productId = Number(product?.id || 0);
        if (productId) {
          productCache.set(productId, product);
        }
      });
    }
  }

  return ids.map((id) => productCache.get(Number(id))).filter(Boolean);
}

async function fetchProductsBatch(ids) {
  const apiGet = salla?.api && typeof salla.api.get === 'function' ? salla.api.get.bind(salla.api) : null;
  if (!apiGet) {
    return [];
  }

  const queries = [];

  const idsArrayParams = new URLSearchParams();
  ids.forEach((id) => idsArrayParams.append('ids[]', String(id)));
  idsArrayParams.append('limit', String(ids.length));
  idsArrayParams.append('format', 'light');
  queries.push(`/products?${idsArrayParams.toString()}`);

  const idsCsvParams = new URLSearchParams();
  idsCsvParams.append('ids', ids.join(','));
  idsCsvParams.append('limit', String(ids.length));
  idsCsvParams.append('format', 'light');
  queries.push(`/products?${idsCsvParams.toString()}`);

  for (const endpoint of queries) {
    try {
      const response = await apiGet(endpoint);
      const payload = response?.data?.data || response?.data;
      if (Array.isArray(payload) && payload.length) {
        return payload;
      }
    } catch (_error) {
      // Try next endpoint format.
    }
  }

  return [];
}

async function fetchProductById(id) {
  const productApi = salla?.api?.product;
  if (productApi && typeof productApi.getDetails === 'function') {
    const response = await productApi.getDetails(String(id));
    const payload = response?.data?.data || response?.data;
    const product = Array.isArray(payload) ? payload[0] : payload;
    if (product) {
      return product;
    }
  }

  const apiGet = salla?.api && typeof salla.api.get === 'function' ? salla.api.get.bind(salla.api) : null;
  if (!apiGet) {
    throw new Error('No supported product API method');
  }

  const response = await apiGet(`/products/${id}`);
  const payload = response?.data?.data || response?.data;
  return Array.isArray(payload) ? payload[0] : payload;
}

function lockPageScroll() {
  const body = document.body;
  if (!body) {
    return;
  }

  if (body.dataset.influencerScrollLock !== 'true') {
    body.dataset.influencerPreviousOverflow = body.style.overflow || '';
  }
  body.dataset.influencerScrollLock = 'true';
  body.style.overflow = 'hidden';
}

function unlockPageScroll() {
  const body = document.body;
  if (!body) {
    return;
  }

  if (document.querySelector('.influencer-pack__reel-strip.is-open')) {
    return;
  }

  if (body.dataset.influencerPreviousOverflow !== undefined) {
    body.style.overflow = body.dataset.influencerPreviousOverflow;
    delete body.dataset.influencerPreviousOverflow;
  } else {
    body.style.removeProperty('overflow');
  }
  delete body.dataset.influencerScrollLock;
}

function copyText(value) {
  // Keep a synchronous copy path for iframe/editor contexts.
  if (legacyCopy(value)) {
    return Promise.resolve(true);
  }

  if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
    return navigator.clipboard
      .writeText(value)
      .then(() => true)
      .catch(() => false);
  }

  return Promise.resolve(false);
}

function legacyCopy(value) {
  const temp = document.createElement('textarea');
  temp.value = value;
  temp.setAttribute('readonly', '');
  temp.setAttribute('aria-hidden', 'true');
  temp.style.position = 'absolute';
  temp.style.opacity = '0';
  temp.style.left = '-9999px';
  temp.style.top = '0';
  temp.style.pointerEvents = 'none';
  document.body.appendChild(temp);

  const previousSelection = document.getSelection();
  const selectedRange = previousSelection && previousSelection.rangeCount ? previousSelection.getRangeAt(0) : null;

  temp.select();
  temp.setSelectionRange(0, temp.value.length);

  let success = false;
  try {
    success = document.execCommand('copy');
  } catch (error) {
    success = false;
  }

  document.body.removeChild(temp);
  if (selectedRange && previousSelection) {
    previousSelection.removeAllRanges();
    previousSelection.addRange(selectedRange);
  }

  return Boolean(success);
}

function setToggleState(toggle, isPlaying) {
  if (!toggle) {
    return;
  }

  renderPlayIcon(toggle, isPlaying);
  toggle.classList.toggle('is-playing', isPlaying);
  toggle.setAttribute('aria-label', isPlaying ? 'إيقاف الفيديو' : 'تشغيل الفيديو');
}

function updateMuteToggle(toggle, isMuted) {
  if (!toggle) {
    return;
  }

  const mutedLabel = toggle.dataset.labelMuted || 'تشغيل الصوت';
  const unmutedLabel = toggle.dataset.labelUnmuted || 'كتم الصوت';
  const nextLabel = isMuted ? mutedLabel : unmutedLabel;
  const text = toggle.querySelector('.sr-only');
  const icon = toggle.querySelector('i');

  toggle.setAttribute('aria-pressed', isMuted ? 'true' : 'false');
  toggle.setAttribute('aria-label', nextLabel);
  if (text) {
    text.textContent = nextLabel;
  }
  if (icon) {
    icon.classList.remove('sicon-volume', 'sicon-volume-off');
    icon.classList.add(isMuted ? 'sicon-volume-off' : 'sicon-volume');
  }
}

function syncNavIcons(navPrev, navNext, _isRtl) {
  const prevArrow = navPrev ? navPrev.querySelector('.influencer-pack__nav-arrow') : null;
  const nextArrow = navNext ? navNext.querySelector('.influencer-pack__nav-arrow') : null;
  const prevIcon = navPrev ? navPrev.querySelector('i') : null;
  const nextIcon = navNext ? navNext.querySelector('i') : null;
  // Keep visual order by button position: left shows "<", right shows ">".
  const prevChar = _isRtl ? '›' : '‹';
  const nextChar = _isRtl ? '‹' : '›';
  // Salla icon names are visually inverted in this context.
  const prevIconClass = _isRtl ? 'sicon-keyboard_arrow_left' : 'sicon-keyboard_arrow_right';
  const nextIconClass = _isRtl ? 'sicon-keyboard_arrow_right' : 'sicon-keyboard_arrow_left';

  if (prevArrow) {
    prevArrow.textContent = prevChar;
  } else if (prevIcon) {
    prevIcon.className = prevIconClass;
  }

  if (nextArrow) {
    nextArrow.textContent = nextChar;
  } else if (nextIcon) {
    nextIcon.className = nextIconClass;
  }
}

function syncNavDisabledState(navPrev, navNext, activeIndex, reelsCount) {
  if (!reelsCount) {
    return;
  }

  const isSingle = reelsCount <= 1;
  const isAtStart = activeIndex <= 0;
  const isAtEnd = activeIndex >= reelsCount - 1;

  if (navPrev) {
    navPrev.disabled = isSingle || isAtStart;
    navPrev.setAttribute('aria-disabled', navPrev.disabled ? 'true' : 'false');
  }

  if (navNext) {
    navNext.disabled = isSingle || isAtEnd;
    navNext.setAttribute('aria-disabled', navNext.disabled ? 'true' : 'false');
  }
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function ensurePlayGlyph(toggle) {
  if (!toggle) {
    return toggle;
  }

  if (!toggle.querySelector('.influencer-pack__play-glyph')) {
    toggle.innerHTML = '';
    const glyph = document.createElement('span');
    glyph.className = 'influencer-pack__play-glyph';
    glyph.setAttribute('aria-hidden', 'true');
    toggle.appendChild(glyph);
  }

  renderPlayIcon(toggle, toggle.classList.contains('is-playing'));

  return toggle;
}

function bindMediaSurfaceToggle(surface, reel, index, onActivate, onToggle) {
  if (!surface || !reel) {
    return;
  }

  const tapMaxDistance = 12;
  const tapMaxDuration = 350;
  let pointerStart = null;
  let skipSyntheticClick = false;

  surface.addEventListener('pointerdown', (event) => {
    if (isInteractiveMediaTarget(event.target)) {
      pointerStart = null;
      return;
    }

    pointerStart = {
      x: event.clientX,
      y: event.clientY,
      time: Date.now(),
      pointerType: event.pointerType || 'mouse',
    };
  });

  surface.addEventListener('pointerup', (event) => {
    if (!pointerStart || isInteractiveMediaTarget(event.target)) {
      pointerStart = null;
      return;
    }

    const deltaX = Math.abs(event.clientX - pointerStart.x);
    const deltaY = Math.abs(event.clientY - pointerStart.y);
    const duration = Date.now() - pointerStart.time;
    const isMousePointer = pointerStart.pointerType === 'mouse';
    pointerStart = null;

    if (deltaX > tapMaxDistance || deltaY > tapMaxDistance || (!isMousePointer && duration > tapMaxDuration)) {
      return;
    }

    skipSyntheticClick = true;
    window.setTimeout(() => {
      skipSyntheticClick = false;
    }, 350);

    onActivate(index, true);
    onToggle(reel, true);
  });

  surface.addEventListener('pointercancel', () => {
    pointerStart = null;
  });

  surface.addEventListener('click', (event) => {
    if (skipSyntheticClick) {
      skipSyntheticClick = false;
      return;
    }

    if (isInteractiveMediaTarget(event.target)) {
      return;
    }

    onActivate(index, true);
    onToggle(reel, true);
  });
}

function isInteractiveMediaTarget(target) {
  if (!(target instanceof Element)) {
    return false;
  }

  return Boolean(target.closest('a, button, input, select, textarea, label, [role="button"], lite-youtube, video'));
}

function bindWheelNavigation(track, reels, getActiveIndex, scrollToReel, reduceMotion, onUserNavigate) {
  if (!track || !reels.length) {
    return;
  }

  let wheelLock = false;
  track.addEventListener(
    'wheel',
    (event) => {
      const dominantDelta = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
      if (Math.abs(dominantDelta) < 12) {
        return;
      }

      event.preventDefault();

      if (wheelLock) {
        return;
      }

      const direction = dominantDelta > 0 ? 1 : -1;
      const nextIndex = clamp(getActiveIndex() + direction, 0, reels.length - 1);
      if (nextIndex === getActiveIndex()) {
        return;
      }

      wheelLock = true;
      if (typeof onUserNavigate === 'function') {
        onUserNavigate();
      }
      scrollToReel(nextIndex, true);
      window.setTimeout(() => {
        wheelLock = false;
      }, reduceMotion ? 80 : 260);
    },
    { passive: false }
  );
}

function syncToggleWithVideoState(video, toggle) {
  if (!video || !toggle) {
    return;
  }

  const isPlaying = !video.paused && !video.ended && video.currentTime > 0;
  setToggleState(toggle, isPlaying);
}

function renderPlayIcon(toggle, isPlaying) {
  if (!toggle) {
    return;
  }

  let glyph = toggle.querySelector('.influencer-pack__play-glyph');
  if (!glyph) {
    glyph = document.createElement('span');
    glyph.className = 'influencer-pack__play-glyph';
    glyph.setAttribute('aria-hidden', 'true');
    toggle.innerHTML = '';
    toggle.appendChild(glyph);
  }

  glyph.textContent = isPlaying ? '❚❚' : '▶';
  glyph.style.color = '#111111';
  glyph.style.display = 'inline-block';
  glyph.style.lineHeight = '1';
  glyph.style.fontWeight = '800';
  glyph.style.fontSize = isPlaying ? '0.72rem' : '0.92rem';
  glyph.style.marginInlineStart = isPlaying ? '0' : '0.08rem';
}
