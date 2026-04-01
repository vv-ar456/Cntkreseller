// js/app.js

// Main application initialization
document.addEventListener('DOMContentLoaded', async () => {
    await Auth.init();
    setupOTPInputs();
    setupUserDropdown();
    setupMobileSearch();
    
    // Load homepage content
    if (document.getElementById('homePage')) {
        loadHomePage();
    }
});

function setupUserDropdown() {
    const trigger = document.getElementById('userMenuTrigger');
    const dropdown = document.getElementById('userDropdown');
    
    if (trigger && dropdown) {
        trigger.addEventListener('click', (e) => {
            e.stopPropagation();
            dropdown.classList.toggle('active');
        });
        
        document.addEventListener('click', () => {
            dropdown.classList.remove('active');
        });
    }
}

function setupMobileSearch() {
    const mobileSearchBtn = document.getElementById('mobileSearchBtn');
    if (mobileSearchBtn) {
        mobileSearchBtn.addEventListener('click', () => {
            window.location.href = 'search.html';
        });
    }
}

async function loadHomePage() {
    const container = document.getElementById('homePage');
    if (!container) return;
    
    // Show loading
    container.innerHTML = `
        <div class="page-loader">
            <div class="loading-spinner"></div>
        </div>
    `;
    
    try {
        // Load data in parallel
        const [categoriesRes, featuredRes, specialRes, allProductsRes] = await Promise.all([
            DB.getParentCategories(),
            DB.getProducts({ is_featured: true, limit: 8 }),
            DB.getProducts({ is_special: true, limit: 8 }),
            DB.getProducts({ limit: 16 })
        ]);
        
        const categories = categoriesRes.data || [];
        const featured = featuredRes.data || [];
        const special = specialRes.data || [];
        const allProducts = allProductsRes.data || [];
        
        let html = '';
        
        // Hero Banner
        html += `
            <div class="hero-banner">
                <div class="hero-pattern"></div>
                <div>
                    <h1>Resell & Earn with Conitek</h1>
                    <p>Add your margin to products, share with customers, and earn profit on every sale.</p>
                    <a href="search.html" class="btn btn-secondary btn-lg">Explore Products</a>
                </div>
            </div>
        `;
        
        // Categories
        if (categories.length > 0) {
            html += `
                <div class="mb-3">
                    <div class="section-header">
                        <h2>Shop by Category</h2>
                        <a href="category.html" class="view-all">View All →</a>
                    </div>
                    <div class="categories-scroll">
                        ${categories.map(cat => `
                            <a href="category.html?id=${cat.id}" class="category-card">
                                <div class="cat-image">
                                    <img src="${cat.image_url || placeholderImage(cat.name)}" alt="${cat.name}" loading="lazy">
                                </div>
                                <div class="cat-name">${cat.name}</div>
                            </a>
                        `).join('')}
                    </div>
                </div>
            `;
        }
        
        // Special Products
        if (special.length > 0) {
            html += `
                <div class="special-section mb-3">
                    <div class="section-header">
                        <h2>🔥 Special Deals</h2>
                        <a href="search.html?special=true" class="view-all">View All →</a>
                    </div>
                    <div class="products-grid">
                        ${special.map(p => renderProductCard(p)).join('')}
                    </div>
                </div>
            `;
        }
        
        // Featured Products
        if (featured.length > 0) {
            html += `
                <div class="mb-3">
                    <div class="section-header">
                        <h2>⭐ Featured Products</h2>
                        <a href="search.html?featured=true" class="view-all">View All →</a>
                    </div>
                    <div class="products-grid">
                        ${featured.map(p => renderProductCard(p)).join('')}
                    </div>
                </div>
            `;
        }
        
        // All Products
        if (allProducts.length > 0) {
            html += `
                <div class="mb-3">
                    <div class="section-header">
                        <h2>All Products</h2>
                    </div>
                    <div class="products-grid" id="allProductsGrid">
                        ${allProducts.map(p => renderProductCard(p)).join('')}
                    </div>
                    <div class="text-center mt-2">
                        <a href="search.html" class="btn btn-outline">View All Products</a>
                    </div>
                </div>
            `;
        }
        
        container.innerHTML = html;
        
        // Attach like button events
        attachLikeEvents();
        attachAddToCartEvents();
        
    } catch (err) {
        console.error('Error loading home:', err);
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">😔</div>
                <h3>Something went wrong</h3>
                <p>Failed to load products. Please try again.</p>
                <button class="btn btn-primary" onclick="loadHomePage()">Retry</button>
            </div>
        `;
    }
}

function renderProductCard(product) {
    const maxMargin = product.mrp - product.base_price;
    return `
        <div class="product-card" data-product-id="${product.id}">
            <a href="product.html?id=${product.slug || product.id}" class="product-image">
                <img src="${product.thumbnail || (product.images && product.images[0]) || placeholderImage(product.name)}" alt="${product.name}" loading="lazy">
                <div class="product-badges">
                    ${product.is_special ? '<span class="product-badge special">Special</span>' : ''}
                    ${product.is_featured ? '<span class="product-badge featured">Featured</span>' : ''}
                    ${product.stock <= 0 ? '<span class="product-badge out-of-stock">Out of Stock</span>' : ''}
                </div>
            </a>
            <button class="like-btn" onclick="handleLike('${product.id}', this)" title="Add to wishlist">
                ♡
            </button>
            <div class="product-info">
                <a href="product.html?id=${product.slug || product.id}">
                    <div class="product-name">${product.name}</div>
                </a>
                <div class="product-price">
                    <span class="product-mrp">${formatCurrency(product.mrp)}</span>
                    ${product.base_price < product.mrp ? `<span class="product-base-price">${formatCurrency(product.base_price)}</span>` : ''}
                </div>
                <div class="margin-info">
                    <span>💰 Max margin: ${formatCurrency(maxMargin)}</span>
                </div>
                <div class="add-margin-input">
                    <input type="number" placeholder="Your margin ₹" min="0" max="${maxMargin}" 
                           class="margin-input" data-product-id="${product.id}" data-max="${maxMargin}"
                           data-mrp="${product.mrp}">
                </div>
                <div class="card-actions">
                    ${product.stock > 0 ? `
                        <button class="btn btn-primary btn-sm add-cart-btn" 
                                data-product-id="${product.id}" onclick="handleAddToCart('${product.id}')">
                            🛒 Add
                        </button>
                    ` : `
                        <button class="btn btn-ghost btn-sm" disabled>Out of Stock</button>
                    `}
                    <a href="product.html?id=${product.slug || product.id}" class="btn btn-outline btn-sm">View</a>
                </div>
            </div>
        </div>
    `;
}

async function handleLike(productId, btn) {
    if (!Auth.requireAuth()) return;
    
    const { liked, error } = await DB.toggleLike(Auth.getUserId(), productId);
    if (error) {
        Toast.error('Failed to update wishlist');
        return;
    }
    
    if (liked) {
        btn.classList.add('liked');
        btn.textContent = '❤';
        Toast.success('Added to wishlist');
    } else {
        btn.classList.remove('liked');
        btn.textContent = '♡';
        Toast.info('Removed from wishlist');
    }
}

async function handleAddToCart(productId) {
    if (!Auth.requireAuth()) return;
    
    const marginInput = document.querySelector(`.margin-input[data-product-id="${productId}"]`);
    const margin = parseFloat(marginInput?.value) || 0;
    
    const { data, error } = await DB.addToCart(Auth.getUserId(), productId, 1, margin);
    if (error) {
        Toast.error('Failed to add to cart');
        return;
    }
    
    Toast.success('Added to cart!');
    Auth.updateCartBadge();
}

function attachLikeEvents() {
    // Check liked status for logged in user
    if (Auth.isLoggedIn()) {
        document.querySelectorAll('.like-btn').forEach(async btn => {
            const card = btn.closest('.product-card');
            const productId = card?.dataset.productId;
            if (productId) {
                const liked = await DB.isLiked(Auth.getUserId(), productId);
                if (liked) {
                    btn.classList.add('liked');
                    btn.textContent = '❤';
                }
            }
        });
    }
}

function attachAddToCartEvents() {
    // Already handled by onclick
}

// Search functionality
function handleSearch(e) {
    if (e.key === 'Enter') {
        const term = e.target.value.trim();
        if (term) {
            window.location.href = `search.html?q=${encodeURIComponent(term)}`;
        }
    }
}
