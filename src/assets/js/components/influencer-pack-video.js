const VIDEO_SELECTOR = '.s-block--influencer-pack-video .js-influencer-pack-video';

salla.onReady(() => {
  const videos = Array.from(document.querySelectorAll(VIDEO_SELECTOR));
  if (!videos.length) {
    return;
  }

  videos.forEach((video) => setupInfluencerPackVideo(video));
});

function setupInfluencerPackVideo(video) {
  if (video.dataset.jsInitialized === 'true') {
    return;
  }
  video.dataset.jsInitialized = 'true';

  const shouldAutoPlay = canAutoplayVideo();
  const source = video.dataset.src;
  if (!source) {
    return;
  }

  let isHydrated = false;
  let wasPlayingBeforeHidden = false;

  const hydrate = (preload = 'metadata') => {
    if (!isHydrated) {
      video.src = source;
      video.preload = preload;
      video.load();
      isHydrated = true;
      return;
    }

    if (preload === 'auto' && video.preload !== 'auto') {
      video.preload = 'auto';
      video.load();
    }
  };

  const playIfAllowed = () => {
    if (!shouldAutoPlay) {
      return;
    }

    hydrate('auto');
    const playPromise = video.play();
    if (playPromise && typeof playPromise.catch === 'function') {
      playPromise.catch(() => {});
    }
  };

  const pauseIfPlaying = () => {
    if (!video.paused && !video.ended) {
      wasPlayingBeforeHidden = true;
      video.pause();
    }
  };

  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.target !== video) {
            return;
          }

          if (!entry.isIntersecting) {
            pauseIfPlaying();
            return;
          }

          hydrate(entry.intersectionRatio >= 0.2 ? 'auto' : 'metadata');
          if (entry.intersectionRatio >= 0.35) {
            playIfAllowed();
            wasPlayingBeforeHidden = false;
          }
        });
      },
      {
        root: null,
        rootMargin: '280px 0px',
        threshold: [0, 0.2, 0.35, 0.75],
      }
    );

    observer.observe(video);
  } else {
    hydrate('auto');
    playIfAllowed();
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      pauseIfPlaying();
      return;
    }

    if (wasPlayingBeforeHidden) {
      playIfAllowed();
      wasPlayingBeforeHidden = false;
    }
  });
}

function canAutoplayVideo() {
  const prefersReducedMotion =
    window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  const saveData = Boolean(connection && connection.saveData);

  return !prefersReducedMotion && !saveData;
}
