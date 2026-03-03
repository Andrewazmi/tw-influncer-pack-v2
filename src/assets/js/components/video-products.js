/**
 * Video with Products Component
 * Ensures proper loading and display of products in the video-with-products component
 * Handles RTL layout and positioning
 */

salla.onReady(() => {
  // Initialize the video-with-products component
  const initVideoProducts = () => {
    // Find all video-with-products sections
    const videoProductSections = document.querySelectorAll('.s-block--video-products');

    if (!videoProductSections.length) return;

    console.log(`Found ${videoProductSections.length} video-with-products sections`);

    videoProductSections.forEach((section, index) => {
      // Check RTL status
      const isRTL = document.documentElement.dir === 'rtl';
      const hasReverseLayout = section.classList.contains('reverse-layout');

      console.log(`Section ${index + 1} - RTL: ${isRTL}, Reverse Layout: ${hasReverseLayout}`);

      // Log the current layout positions
      const videoSection = section.querySelector('.video-section');
      const productsSection = section.querySelector('.products-section');

      if (videoSection && productsSection) {
        console.log(`Section ${index + 1} - Video position: ${getComputedStyle(videoSection).order}, Products position: ${getComputedStyle(productsSection).order}`);
      }

      // Find product lists in this section
      const productList = section.querySelector('salla-products-list');

      if (productList) {
        // Force the list to be visible
        productList.style.display = 'block';
        productList.style.visibility = 'visible';
        productList.style.opacity = '1';

        // Log product list attributes
        console.log(`Product List ${index + 1} - Source: ${productList.getAttribute('source')}, Source Value: ${productList.getAttribute('source-value')}`);

        // Set data-loaded attribute to trigger loading
        productList.setAttribute('data-loaded', 'true');

        // Force a refresh after a short delay
        setTimeout(() => {
          console.log('Refreshing products list:', productList.id || `list-${index}`);

          // Try to force a re-render by toggling attributes
          const sourceValue = productList.getAttribute('source-value');
          const source = productList.getAttribute('source');

          if (source && sourceValue) {
            // Temporarily remove and re-add the source attributes to force refresh
            productList.removeAttribute('source-value');
            setTimeout(() => {
              productList.setAttribute('source-value', sourceValue);
              console.log('Re-applied source-value:', sourceValue);
            }, 50);
          }
        }, 500);

        // Add event listeners for debugging
        productList.addEventListener('load', () => {
          console.log('Products loaded successfully:', productList.id || `list-${index}`);
        });

        productList.addEventListener('error', (e) => {
          console.error('Error loading products:', e);
        });
      }
    });

    // Make sure video containers have proper aspect ratio
    const videoContainers = document.querySelectorAll('.s-block--video-products .video-container');
    videoContainers.forEach(container => {
      container.style.aspectRatio = '16/9';
    });

    // Apply RTL-specific adjustments if needed
    if (document.documentElement.dir === 'rtl') {
      console.log('Applying RTL-specific adjustments to video-with-products component');

      // Force refresh layout after a short delay to ensure RTL styles are applied
      setTimeout(() => {
        document.querySelectorAll('.s-block--video-products').forEach(section => {
          section.style.display = 'none';
          setTimeout(() => {
            section.style.display = '';
          }, 10);
        });
      }, 1000);
    }
  };

  // Initialize on page load
  initVideoProducts();

  // Also initialize when the DOM content is fully loaded
  document.addEventListener('DOMContentLoaded', initVideoProducts);

  // Re-initialize when the page is fully loaded (including images)
  window.addEventListener('load', initVideoProducts);

  // Listen for Salla's custom events
  document.addEventListener('salla::products::load', initVideoProducts);
  document.addEventListener('salla::loaded', initVideoProducts);

  // Listen for language/direction changes
  document.addEventListener('salla::language::changed', initVideoProducts);
});
