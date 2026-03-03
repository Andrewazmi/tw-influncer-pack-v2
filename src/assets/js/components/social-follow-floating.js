salla.onReady(() => {
  const blocks = document.querySelectorAll('.s-block--social-follow-floating');
  if (!blocks.length) {
    return;
  }

  blocks.forEach((block) => {
    if (block.dataset.jsInitialized === 'true') {
      return;
    }

    block.dataset.jsInitialized = 'true';
    syncCssVariables(block);
    bindMobileToggle(block);
  });
});

function syncCssVariables(block) {
  const desktopOffsetX = toPx(block.dataset.desktopOffsetX, 20);
  const desktopOffsetY = toPx(block.dataset.desktopOffsetY, 20);
  const mobileOffsetX = toPx(block.dataset.mobileOffsetX, 0);
  const mobileOffsetY = toPx(block.dataset.mobileOffsetY, 14);
  const customBgColor = block.dataset.customBgColor;
  const customIconColor = block.dataset.customIconColor;

  block.style.setProperty('--ssf-desktop-offset-x', desktopOffsetX);
  block.style.setProperty('--ssf-desktop-offset-y', desktopOffsetY);
  block.style.setProperty('--ssf-mobile-offset-x', mobileOffsetX);
  block.style.setProperty('--ssf-mobile-offset-y', mobileOffsetY);

  if (customBgColor) {
    block.style.setProperty('--ssf-custom-bg', customBgColor);
  }

  if (customIconColor) {
    block.style.setProperty('--ssf-custom-icon', customIconColor);
  }
}

function bindMobileToggle(block) {
  if (block.dataset.expandableMobile !== 'true') {
    return;
  }

  const toggle = block.querySelector('.social-follow-floating__toggle');
  const list = block.querySelector('.social-follow-floating__list');
  if (!toggle || !list) {
    return;
  }

  const isMobile = () => window.matchMedia('(max-width: 767px)').matches;

  const setExpanded = (expanded) => {
    toggle.setAttribute('aria-expanded', expanded ? 'true' : 'false');
    list.classList.toggle('is-collapsed-mobile', isMobile() && !expanded);
    const label = expanded ? toggle.dataset.labelClose : toggle.dataset.labelOpen;
    if (label) {
      toggle.setAttribute('aria-label', label);
    }
  };

  const initialExpanded = block.dataset.expandedMobile === 'true';
  setExpanded(initialExpanded);

  toggle.addEventListener('click', () => {
    if (!isMobile()) {
      return;
    }

    const expanded = toggle.getAttribute('aria-expanded') === 'true';
    setExpanded(!expanded);
  });

  toggle.addEventListener('keydown', (event) => {
    if (!isMobile()) {
      return;
    }

    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      toggle.click();
    }
  });

  document.addEventListener('keydown', (event) => {
    if (!isMobile() || event.key !== 'Escape') {
      return;
    }

    setExpanded(false);
  });

  window.addEventListener('resize', () => {
    const expanded = toggle.getAttribute('aria-expanded') === 'true';
    if (!isMobile()) {
      list.classList.remove('is-collapsed-mobile');
      return;
    }

    setExpanded(expanded);
  });
}

function toPx(value, fallback) {
  const normalized = Number(value);
  const safe = Number.isFinite(normalized) ? normalized : fallback;
  return `${safe}px`;
}
