/**
 * Product Helper Functions
 * Contains helper functions for working with products in Salla themes
 */

/**
 * Fetch products by category
 * @param {string|object|array} categoryId - The category ID to fetch products from or category object
 * @param {number} limit - Maximum number of products to return
 * @returns {Promise<Array>} - Array of product objects
 */
function fetchProductsByCategory(categoryId, limit = 4) {
  console.log('fetchProductsByCategory called with categoryId:', categoryId, 'limit:', limit);

  return new Promise((resolve, reject) => {
    try {
      // Extract the proper category ID if an object or array is passed
      let actualCategoryId = null;

      console.log('Original category data:', JSON.stringify(categoryId));

      // Handle different data types
      if (categoryId === null || categoryId === undefined || categoryId === '') {
        console.log('Category ID is null/undefined/empty');
        actualCategoryId = null;
      }
      // Handle string (direct ID)
      else if (typeof categoryId === 'string') {
        if (categoryId.trim() !== '') {
          actualCategoryId = categoryId.trim();
          console.log(`Using string category ID: ${actualCategoryId}`);
        }
      }
      // Handle number
      else if (typeof categoryId === 'number') {
        actualCategoryId = categoryId;
        console.log(`Using numeric category ID: ${actualCategoryId}`);
      }
      // Handle array or object
      else if (typeof categoryId === 'object') {
        console.log('Category is an object or array');

        // Handle array of objects
        if (Array.isArray(categoryId)) {
          console.log('Category is an array with length:', categoryId.length);

          if (categoryId.length > 0) {
            const firstItem = categoryId[0];

            // Try to extract ID from first item of array
            if (typeof firstItem === 'object' && firstItem !== null) {
              if ('id' in firstItem) {
                actualCategoryId = firstItem.id;
                console.log(`Extracted ID from array item: ${actualCategoryId}`);
              } else {
                // Look for any property that might be an ID
                const idKeys = Object.keys(firstItem).filter(k =>
                  k === 'id' || k === 'categoryId' || k === 'category_id');

                if (idKeys.length > 0) {
                  actualCategoryId = firstItem[idKeys[0]];
                  console.log(`Found ID in array item using key ${idKeys[0]}: ${actualCategoryId}`);
                } else {
                  console.log('Could not extract ID from array item', firstItem);
                }
              }
            }
            // If first item is a direct value (string/number)
            else if (firstItem !== null) {
              actualCategoryId = firstItem;
              console.log(`Using first array item as ID: ${actualCategoryId}`);
            }
          }
        }
        // Handle direct object
        else if (categoryId !== null) {
          if ('id' in categoryId) {
            actualCategoryId = categoryId.id;
            console.log(`Extracted ID from object: ${actualCategoryId}`);
          } else {
            // Look for any property that might be an ID
            const idKeys = Object.keys(categoryId).filter(k =>
              k === 'id' || k === 'categoryId' || k === 'category_id');

            if (idKeys.length > 0) {
              actualCategoryId = categoryId[idKeys[0]];
              console.log(`Found ID in object using key ${idKeys[0]}: ${actualCategoryId}`);
            } else {
              console.log('Could not extract ID from object', categoryId);
            }
          }
        }
      }

      // If no valid ID could be determined, use featured products
      if (!actualCategoryId) {
        console.log('No valid category ID could be determined, using featured products');

        // Use the correct API endpoint for featured products
        salla.api.get(`/products?limit=${limit}`)
          .then(response => {
            console.log('Featured products response:', response);
            if (response && response.data && response.data.length) {
              resolve(response.data);
            } else {
              console.log('No featured products found, trying with format=light parameter');
              // Try with format=light parameter
              salla.api.get(`/products?limit=${limit}&format=light`)
                .then(lightResponse => {
                  console.log('Light format products response:', lightResponse);
                  if (lightResponse && lightResponse.data && lightResponse.data.length) {
                    resolve(lightResponse.data);
                  } else {
                    console.warn('Could not find any products with any method');
                    resolve([]);
                  }
                })
                .catch(lightError => {
                  console.error('Error fetching light format products:', lightError);
                  resolve([]);
                });
            }
          })
          .catch(error => {
            console.error('Error fetching featured products:', error);
            // Try one more approach with direct API call
            salla.api.get(`/products?limit=${limit}&format=light`)
              .then(response => {
                console.log('Fallback to light format response:', response);
                resolve(response.data || []);
              })
              .catch(finalError => {
                console.error('All product fetch methods failed:', finalError);
                resolve([]);
              });
          });
        return;
      }

      console.log(`Fetching products for category ID: ${actualCategoryId}, limit: ${limit}`);

      // Use the correct API endpoint for category products
      salla.api.get(`/products?categories[]=${actualCategoryId}&limit=${limit}`)
        .then(response => {
          console.log('Category products response:', response);

          if (response && response.data && response.data.length) {
            console.log(`Found ${response.data.length} products using category API call`);
            resolve(response.data);
          } else {
            console.log('No products found with category parameter, trying with categories[] parameter');

            // Try alternative parameter format
            salla.api.get(`/products?category=${actualCategoryId}&limit=${limit}`)
              .then(altResponse => {
                console.log('Alternative parameter response:', altResponse);

                if (altResponse && altResponse.data && altResponse.data.length) {
                  console.log(`Found ${altResponse.data.length} products using alternative parameter`);
                  resolve(altResponse.data);
                } else {
                  // Try with format=light parameter
                  console.log('No products found with any category parameter, trying with format=light');

                  salla.api.get(`/products?categories[]=${actualCategoryId}&limit=${limit}&format=light`)
                    .then(lightResponse => {
                      console.log('Light format category products response:', lightResponse);
                      if (lightResponse && lightResponse.data && lightResponse.data.length) {
                        resolve(lightResponse.data);
                      } else {
                        // FINAL FALLBACK: Just get some products
                        console.log('No products found with any method, getting general products');

                        salla.api.get(`/products?limit=${limit}`)
                          .then(finalResponse => {
                            console.log('Final fallback response:', finalResponse);
                            if (finalResponse && finalResponse.data && finalResponse.data.length) {
                              resolve(finalResponse.data);
                            } else {
                              console.warn('Could not find any products with any method');
                              resolve([]);
                            }
                          })
                          .catch(finalError => {
                            console.error('Final fallback also failed:', finalError);
                            resolve([]);
                          });
                      }
                    })
                    .catch(lightError => {
                      console.error('Error fetching light format category products:', lightError);
                      // Try general products
                      salla.api.get(`/products?limit=${limit}`)
                        .then(response => {
                          console.log('General products after light format error:', response);
                          resolve(response.data || []);
                        })
                        .catch(error => {
                          console.error('All methods failed:', error);
                          resolve([]);
                        });
                    });
                }
              })
              .catch(altError => {
                console.error('Alternative parameter method failed:', altError);
                // Try general products
                salla.api.get(`/products?limit=${limit}`)
                  .then(response => {
                    console.log('General products after alternative parameter error:', response);
                    resolve(response.data || []);
                  })
                  .catch(error => {
                    console.error('All methods failed:', error);
                    resolve([]);
                  });
              });
          }
        })
        .catch(error => {
          console.error('Category API method failed:', error);

          // Try one more approach
          salla.api.get(`/products?limit=${limit}`)
            .then(altResponse => {
              console.log('Alternative method response:', altResponse);
              if (altResponse && altResponse.data && altResponse.data.length) {
                resolve(altResponse.data);
              } else {
                resolve([]);
              }
            })
            .catch(altError => {
              console.error('All product fetch methods failed:', altError);
              resolve([]);
            });
        });
    } catch (e) {
      console.error('Unexpected error in fetchProductsByCategory:', e);
      resolve([]);
    }
  });
}

// Make sure the function is globally available
window.fetchProductsByCategory = fetchProductsByCategory;
console.log('Product helpers loaded - fetchProductsByCategory is now available globally');

/**
 * Initialize custom product functions after the page loads
 */
salla.onReady(() => {
  // Add Twig extension function for getting products by category
  if (typeof window.get_products_by_category !== 'function') {
    window.get_products_by_category = (categoryId, limit = 4) => {
      // Since Twig can't handle async functions directly, we'll load products client-side
      const productsContainer = document.querySelector('.s-block--video-products .product-card-container');

      if (productsContainer) {
        // Show loading state
        productsContainer.innerHTML = '<div class="loading-container p-8 text-center"><span class="spinner inline-block"></span></div>';

        // Fetch products
        fetchProductsByCategory(categoryId, limit)
          .then(products => {
            if (!products || !products.length) {
              productsContainer.innerHTML = '<div class="no-products text-center p-8 bg-gray-100 rounded-md"><p>لا توجد منتجات</p></div>';
              return;
            }

            // Build the HTML based on the product count
            if (products.length >= 4) {
              const html = `
                <div class="flex-1 grid lg:grid-cols-2 gap-4 sm:gap-8">
                  <custom-salla-product-card shadow-on-hover product='${JSON.stringify(products[0])}'
                    fullImage></custom-salla-product-card>
                  <div class="grid gap-4 sm:gap-8">
                    ${products.slice(1, 4).map(product => `
                      <custom-salla-product-card shadow-on-hover product='${JSON.stringify(product)}'
                        minimal></custom-salla-product-card>
                    `).join('')}
                  </div>
                </div>
              `;
              productsContainer.innerHTML = html;
            } else {
              const html = `
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                  ${products.map(product => `
                    <custom-salla-product-card shadow-on-hover product='${JSON.stringify(product)}'
                      minimal></custom-salla-product-card>
                  `).join('')}
                </div>
              `;
              productsContainer.innerHTML = html;
            }

            // Show more button
            const showMoreButton = productsContainer.querySelector('.more-button-container');
            if (showMoreButton) {
              showMoreButton.style.display = 'block';
            }
          });
      }

      // Return empty array for initial server-side render
      return [];
    };
  }
});
