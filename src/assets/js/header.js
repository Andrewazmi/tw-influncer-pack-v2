/**
 * Header functionality
 */
class Header {
  constructor() {
    // Initialize elements
    this.header = document.querySelector('.store-header');
    this.mainNav = document.querySelector('.main-nav-container');
    this.searchTrigger = document.querySelector('.search-trigger');
    this.searchOverlay = document.querySelector('#searchOverlay');
    this.searchCloseBtn = document.querySelector('.search-close-btn');
    this.searchComponent = document.querySelector('#searchComponent');
    this.lastScrollTop = 0;

    if (this.header) {
      this.init();
    } else {
      console.error('Header element not found');
    }
  }

  init() {
    // Wait for Salla components to be ready
    document.addEventListener('salla::ready', () => {
      console.log('Salla components ready - initializing header');
      this.initScrollBehavior();
      this.initSearchOverlay();
    });

    // Still call init in case the event has already fired
    this.initScrollBehavior();
    this.initSearchOverlay();
  }

  initScrollBehavior() {
    if (!this.mainNav) return;

    let lastScrollTop = 0;
    const SCROLL_THRESHOLD = 100;

    window.addEventListener('scroll', () => {
      const currentScroll = window.pageYOffset;

      // Don't do anything if we haven't scrolled past threshold
      if (currentScroll <= SCROLL_THRESHOLD) {
        this.mainNav.classList.remove('nav-hidden');
        return;
      }

      // Determine scroll direction
      if (currentScroll > lastScrollTop) {
        // Scrolling down
        this.mainNav.classList.add('nav-hidden');
      } else {
        // Scrolling up
        this.mainNav.classList.remove('nav-hidden');
      }

      lastScrollTop = currentScroll;
    }, { passive: true });
  }

  initSearchOverlay() {
    if (!this.searchTrigger || !this.searchOverlay) {
      console.warn('Search elements not found');
      return;
    }

    // Open search overlay
    this.searchTrigger.addEventListener('click', () => {
      this.openSearchOverlay();
    });

    // Close search overlay with close button
    if (this.searchCloseBtn) {
      this.searchCloseBtn.addEventListener('click', () => {
        this.closeSearchOverlay();
      });
    }

    // Close search overlay when clicking outside
    this.searchOverlay.addEventListener('click', (e) => {
      if (e.target === this.searchOverlay) {
        this.closeSearchOverlay();
      }
    });

    // Close search overlay with ESC key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.searchOverlay.classList.contains('active')) {
        this.closeSearchOverlay();
      }
    });

    // Listen for salla-search events
    document.addEventListener('salla-search::open', () => {
      this.openSearchOverlay();
    });

    document.addEventListener('salla-search::close', () => {
      this.closeSearchOverlay();
    });

    // Handle search results visibility
    if (this.searchComponent) {
      this.searchComponent.addEventListener('salla-search::results', (event) => {
        console.log('Search results received:', event.detail);
        // Ensure the overlay is properly positioned to show results
        this.searchOverlay.classList.add('has-results');
      });

      this.searchComponent.addEventListener('salla-search::empty', () => {
        console.log('No search results');
        this.searchOverlay.classList.remove('has-results');
      });
    }
  }

  openSearchOverlay() {
    this.searchOverlay.classList.add('active');
    document.body.classList.add('overflow-hidden');

    // Focus the search input after a short delay to ensure the component is ready
    setTimeout(() => {
      try {
        if (this.searchComponent) {
          console.log('Attempting to focus search component');

          // Try multiple approaches to focus the input
          // 1. Try to focus the component itself
          this.searchComponent.focus && this.searchComponent.focus();

          // 2. Try to access shadow DOM
          const shadowRoot = this.searchComponent.shadowRoot;
          if (shadowRoot) {
            const input = shadowRoot.querySelector('input');
            if (input) {
              console.log('Found input in shadow DOM, focusing');
              input.focus();
            }
          }

          // 3. Try to dispatch a custom event
          this.searchComponent.dispatchEvent(new CustomEvent('salla-search::focus'));

          // 4. Try to click the component to activate it
          this.searchComponent.click();
        }
      } catch (error) {
        console.warn('Could not focus search input:', error);
      }
    }, 300); // Increased delay to ensure component is fully rendered
  }

  closeSearchOverlay() {
    this.searchOverlay.classList.remove('active');
    this.searchOverlay.classList.remove('has-results');
    document.body.classList.remove('overflow-hidden');

    // Reset search component if possible
    if (this.searchComponent) {
      try {
        // Try to reset the search component
        this.searchComponent.value = '';
        this.searchComponent.dispatchEvent(new CustomEvent('salla-search::reset'));
      } catch (error) {
        console.warn('Could not reset search component:', error);
      }
    }
  }
}

// Initialize header functionality when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  console.log('Header.js - DOM loaded');
  new Header();
});

// For immediate execution as well
console.log('Header.js is running');
new Header();
