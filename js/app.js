// js/app.js

// ── INLINE DB FALLBACK ────────────────────────────────────────────────────────
// Agar supabase-client.js load na ho toh yeh fallback kaam karega
(function initFallback() {
    if (typeof DB !== 'undefined' && typeof supabase !== 'undefined') return;

    const _URL = 'https://ahbtazekfopmjppnlrxc.supabase.co';
    const _KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFoYnRhemVrZm9wbWpwcG5scnhjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ5OTYzMzQsImV4cCI6MjA5MDU3MjMzNH0.NrgXule6SJJrwzOk11g99hkC7rQWsd7lS7veqS8QpmA';

    try {
        if (typeof supabase === 'undefined' || !supabase.from) {
            window.supabase = window.supabase?.createClient
                ? window.supabase.createClient(_URL, _KEY)
                : null;
        }
    } catch(e) {}

    // If still no supabase, we can't do anything
    if (!window.supabase) {
        console.error('Supabase CDN not loaded yet — DB unavailable');
        return;
    }

    const sb = window.supabase;

    if (typeof DB === 'undefined') {
        window.DB = {
            // ── PROFILES ──
            async getProfile(userId) {
                const { data, error } = await sb.from('profiles').select('*').eq('id', userId).single();
                return { data, error };
            },
            async updateProfile(userId, updates) {
                const { data, error } = await sb.from('profiles').update(updates).eq('id', userId).select().single();
                return { data, error };
            },

            // ── CATEGORIES ──
            async getCategories() {
                const { data, error } = await sb.from('categories').select('*').eq('is_active', true).order('sort_order');
                return { data, error };
            },
            async getParentCategories() {
                const { data, error } = await sb.from('categories').select('*').is('parent_id', null).eq('is_active', true).order('sort_order');
                return { data, error };
            },
            async getSubCategories(parentId) {
                const { data, error } = await sb.from('categories').select('*').eq('parent_id', parentId).eq('is_active', true).order('sort_order');
                return { data, error };
            },
            async getAllCategories() {
                const { data, error } = await sb.from('categories').select('*').order('sort_order');
                return { data, error };
            },

            // ── PRODUCTS ──
            async getProducts(options = {}) {
                let query = sb.from('products').select('*, categories!products_category_id_fkey(name, slug)').eq('is_active', true);
                if (options.category_id)   query = query.eq('category_id', options.category_id);
                if (options.subcategory_id) query = query.eq('subcategory_id', options.subcategory_id);
                if (options.is_featured)   query = query.eq('is_featured', true);
                if (options.is_special)    query = query.eq('is_special', true);
                if (options.search)        query = query.or(`name.ilike.%${options.search}%,description.ilike.%${options.search}%`);
                if (options.limit)         query = query.limit(options.limit);
                if (options.offset)        query = query.range(options.offset, options.offset + (options.limit || 20) - 1);
                query = query.order('created_at', { ascending: false });
                const { data, error, count } = await query;
                return { data, error, count };
            },
            async getProduct(idOrSlug) {
                let query = sb.from('products').select('*, categories!products_category_id_fkey(name, slug)');
                const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
                query = uuidRegex.test(idOrSlug) ? query.eq('id', idOrSlug) : query.eq('slug', idOrSlug);
                const { data, error } = await query.single();
                return { data, error };
            },
            async searchProducts(term) {
                const { data, error } = await sb.from('products').select('*').eq('is_active', true)
                    .or(`name.ilike.%${term}%,description.ilike.%${term}%,sku.ilike.%${term}%`)
                    .order('is_featured', { ascending: false }).limit(50);
                return { data, error };
            },
            async getAllProducts() {
                const { data, error } = await sb.from('products').select('*, categories!products_category_id_fkey(name)').order('created_at', { ascending: false });
                return { data, error };
            },
            async createProduct(p) {
                const { data, error } = await sb.from('products').insert(p).select().single();
                return { data, error };
            },
            async updateProduct(id, p) {
                const { data, error } = await sb.from('products').update(p).eq('id', id).select().single();
                return { data, error };
            },
            async deleteProduct(id) {
                const { error } = await sb.from('products').delete().eq('id', id);
                return { error };
            },

            // ── CART ──
            async getCart(userId) {
                const { data, error } = await sb.from('cart_items').select('*, products(*)').eq('user_id', userId).order('created_at', { ascending: false });
                return { data, error };
            },
            async addToCart(userId, productId, quantity = 1, marginAmount = 0) {
                const { data: existing } = await sb.from('cart_items').select('*').eq('user_id', userId).eq('product_id', productId).single();
                if (existing) {
                    const { data, error } = await sb.from('cart_items').update({ quantity: existing.quantity + quantity, margin_amount: marginAmount }).eq('id', existing.id).select().single();
                    return { data, error };
                }
                const { data, error } = await sb.from('cart_items').insert({ user_id: userId, product_id: productId, quantity, margin_amount: marginAmount }).select().single();
                return { data, error };
            },
            async updateCartItem(id, updates) {
                const { data, error } = await sb.from('cart_items').update(updates).eq('id', id).select().single();
                return { data, error };
            },
            async removeFromCart(id) {
                const { error } = await sb.from('cart_items').delete().eq('id', id);
                return { error };
            },
            async clearCart(userId) {
                const { error } = await sb.from('cart_items').delete().eq('user_id', userId);
                return { error };
            },
            async getCartCount(userId) {
                const { count, error } = await sb.from('cart_items').select('*', { count: 'exact', head: true }).eq('user_id', userId);
                return { count: count || 0, error };
            },

            // ── ORDERS ──
            async createOrder(order) {
                const { data, error } = await sb.from('orders').insert(order).select().single();
                return { data, error };
            },
            async getOrders(userId) {
                const { data, error } = await sb.from('orders').select('*, order_items(*, products(*))').eq('user_id', userId).order('created_at', { ascending: false });
                return { data, error };
            },
            async getOrder(orderId) {
                const { data, error } = await sb.from('orders').select('*, order_items(*, products(*))').eq('id', orderId).single();
                return { data, error };
            },
            async getAllOrders(options = {}) {
                let query = sb.from('orders').select('*, order_items(*), profiles(full_name, phone)').order('created_at', { ascending: false });
                if (options.status) query = query.eq('order_status', options.status);
                if (options.limit)  query = query.limit(options.limit);
                const { data, error } = await query;
                return { data, error };
            },
            async updateOrder(id, updates) {
                const { data, error } = await sb.from('orders').update(updates).eq('id', id).select().single();
                return { data, error };
            },

            // ── LIKED PRODUCTS ──
            async toggleLike(userId, productId) {
                const { data: existing } = await sb.from('liked_products').select('id').eq('user_id', userId).eq('product_id', productId).single();
                if (existing) {
                    await sb.from('liked_products').delete().eq('id', existing.id);
                    return { liked: false, error: null };
                }
                const { error } = await sb.from('liked_products').insert({ user_id: userId, product_id: productId });
                return { liked: true, error };
            },
            async isLiked(userId, productId) {
                const { data } = await sb.from('liked_products').select('id').eq('user_id', userId).eq('product_id', productId).single();
                return !!data;
            },
            async getLikedProducts(userId) {
                const { data, error } = await sb.from('liked_products').select('*, products(*)').eq('user_id', userId).order('created_at', { ascending: false });
                return { data, error };
            },

            // ── NOTIFICATIONS ──
            async getNotifications(userId) {
                const { data, error } = await sb.from('notifications').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(50);
                return { data, error };
            },
            async markNotificationRead(id) {
                const { error } = await sb.from('notifications').update({ is_read: true }).eq('id', id);
                return { error };
            },
            async markAllNotificationsRead(userId) {
                const { error } = await sb.from('notifications').update({ is_read: true }).eq('user_id', userId).eq('is_read', false);
                return { error };
            },
            async getUnreadCount(userId) {
                const { count, error } = await sb.from('notifications').select('*', { count: 'exact', head: true }).eq('user_id', userId).eq('is_read', false);
                return { count: count || 0, error };
            },

            // ── SETTLEMENTS ──
            async getSettlements(userId) {
                const { data, error } = await sb.from('settlements').select('*, orders(order_number)').eq('user_id', userId).order('created_at', { ascending: false });
                return { data, error };
            },
            async getAllSettlements() {
                const { data, error } = await sb.from('settlements').select('*, profiles(full_name, phone), orders(order_number)').order('created_at', { ascending: false });
                return { data, error };
            },
            async updateSettlement(id, updates) {
                const { data, error } = await sb.from('settlements').update(updates).eq('id', id).select().single();
                return { data, error };
            },

            // ── ADDRESSES ──
            async getAddresses(userId) {
                const { data, error } = await sb.from('addresses').select('*').eq('user_id', userId).order('is_default', { ascending: false });
                return { data, error };
            },
            async addAddress(address) {
                const { data, error } = await sb.from('addresses').insert(address).select().single();
                return { data, error };
            },
            async updateAddress(id, updates) {
                const { data, error } = await sb.from('addresses').update(updates).eq('id', id).select().single();
                return { data, error };
            },
            async deleteAddress(id) {
                const { error } = await sb.from('addresses').delete().eq('id', id);
                return { error };
            },

            // ── ADMIN CONFIG ──
            async getAdminConfig(key) {
                const { data, error } = await sb.from('admin_config').select('value').eq('key', key).single();
                return { data, error };
            },

            // ── ANALYTICS ──
            async getAdminAnalytics() {
                const [ordersRes, usersRes, productsRes, settlementsRes] = await Promise.all([
                    sb.from('orders').select('total_amount, total_margin, order_status, created_at, payment_status'),
                    sb.from('profiles').select('id, created_at').eq('is_admin', false),
                    sb.from('products').select('id, stock, is_active'),
                    sb.from('settlements').select('margin_amount, status')
                ]);
                return {
                    orders: ordersRes.data || [],
                    users: usersRes.data || [],
                    products: productsRes.data || [],
                    settlements: settlementsRes.data || []
                };
            },
            async getUserAnalytics(userId) {
                const [ordersRes, settlementsRes] = await Promise.all([
                    sb.from('orders').select('total_amount, total_margin, order_status, created_at').eq('user_id', userId),
                    sb.from('settlements').select('margin_amount, status, created_at').eq('user_id', userId)
                ]);
                return { orders: ordersRes.data || [], settlements: settlementsRes.data || [] };
            },
            async getAllUsers() {
                const { data, error } = await sb.from('profiles').select('*').order('created_at', { ascending: false });
                return { data, error };
            }
        };

        // Also expose OTP if not defined
        if (typeof OTP === 'undefined') {
            const _TWOFACTOR_KEY = '2503bcf6-237e-11f1-bcb0-0200cd936042';
            window.OTP = {
                async sendOTP(phone) {
                    try {
                        const res = await fetch(`https://2factor.in/API/V1/${_TWOFACTOR_KEY}/SMS/${phone}/AUTOGEN/OTP1`);
                        const data = await res.json();
                        return data.Status === 'Success'
                            ? { sessionId: data.Details, error: null }
                            : { sessionId: null, error: data.Details };
                    } catch(e) { return { sessionId: null, error: e.message }; }
                },
                async verifyOTP(sessionId, otp) {
                    try {
                        const res = await fetch(`https://2factor.in/API/V1/${_TWOFACTOR_KEY}/SMS/VERIFY/${sessionId}/${otp}`);
                        const data = await res.json();
                        return (data.Status === 'Success' && data.Details === 'OTP Matched')
                            ? { verified: true, error: null }
                            : { verified: false, error: 'Invalid OTP' };
                    } catch(e) { return { verified: false, error: e.message }; }
                }
            };
        }

        console.warn('✅ Fallback DB initialized (supabase-client.js was not loaded)');
    }
})();

// ── HELPER FUNCTIONS ──────────────────────────────────────────────────────────
function formatCurrency(n) {
    return '₹' + Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function placeholderImage(name = '') {
    const initial = (name || 'P').charAt(0).toUpperCase();
    return `data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200'><rect width='200' height='200' fill='%23f0f0f0'/><text x='50%25' y='55%25' dominant-baseline='middle' text-anchor='middle' font-size='72' font-family='sans-serif' fill='%23ccc'>${initial}</text></svg>`;
}

// ── TOAST ─────────────────────────────────────────────────────────────────────
if (typeof Toast === 'undefined') {
    window.Toast = {
        show(msg, type = 'info') {
            let container = document.getElementById('toastContainer');
            if (!container) {
                container = document.createElement('div');
                container.id = 'toastContainer';
                container.style.cssText = 'position:fixed;bottom:24px;right:20px;z-index:9999;display:flex;flex-direction:column;gap:8px;';
                document.body.appendChild(container);
            }
            const t = document.createElement('div');
            t.className = `toast toast-${type}`;
            t.textContent = msg;
            t.style.cssText = 'padding:12px 18px;border-radius:10px;font-size:14px;font-weight:500;max-width:300px;box-shadow:0 4px 12px rgba(0,0,0,.15);animation:fadeIn .2s ease;';
            if (type === 'success') t.style.background = '#f0fdf4', t.style.color = '#16a34a', t.style.border = '1px solid #bbf7d0';
            else if (type === 'error') t.style.background = '#fef2f2', t.style.color = '#dc2626', t.style.border = '1px solid #fecaca';
            else t.style.background = '#eff6ff', t.style.color = '#1d4ed8', t.style.border = '1px solid #bfdbfe';
            container.appendChild(t);
            setTimeout(() => t.remove(), 3500);
        },
        success: (m) => Toast.show(m, 'success'),
        error:   (m) => Toast.show(m, 'error'),
        info:    (m) => Toast.show(m, 'info'),
    };
}

// ── MAIN APP INIT ─────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
    await Auth.init();
    setupOTPInputs();
    setupUserDropdown();
    setupMobileSearch();

    if (document.getElementById('homePage')) {
        loadHomePage();
    }
});

function setupUserDropdown() {
    const trigger  = document.getElementById('userMenuTrigger');
    const dropdown = document.getElementById('userDropdown');
    if (trigger && dropdown) {
        trigger.addEventListener('click', (e) => {
            e.stopPropagation();
            dropdown.classList.toggle('active');
        });
        document.addEventListener('click', () => dropdown.classList.remove('active'));
    }
}

function setupMobileSearch() {
    const btn = document.getElementById('mobileSearchBtn');
    if (btn) btn.addEventListener('click', () => location.href = 'search.html');
}

// ── HOME PAGE ─────────────────────────────────────────────────────────────────
async function loadHomePage() {
    const container = document.getElementById('homePage');
    if (!container) return;

    container.innerHTML = '<div class="page-loader"><div class="loading-spinner"></div></div>';

    try {
        const [categoriesRes, featuredRes, specialRes, allProductsRes] = await Promise.all([
            DB.getParentCategories(),
            DB.getProducts({ is_featured: true, limit: 8 }),
            DB.getProducts({ is_special: true, limit: 8 }),
            DB.getProducts({ limit: 16 })
        ]);

        const categories  = categoriesRes.data  || [];
        const featured    = featuredRes.data     || [];
        const special     = specialRes.data      || [];
        const allProducts = allProductsRes.data  || [];

        let html = '';

        // ── Hero ──
        html += `
            <div class="hero-banner">
                <div class="hero-pattern"></div>
                <div>
                    <h1>Resell &amp; Earn with Conitek</h1>
                    <p>Add your margin to products, share with customers, and earn profit on every sale.</p>
                    <a href="search.html" class="btn btn-secondary btn-lg">Explore Products</a>
                </div>
            </div>`;

        // ── Categories ──
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
                            </a>`).join('')}
                    </div>
                </div>`;
        }

        // ── Special Deals ──
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
                </div>`;
        }

        // ── Featured ──
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
                </div>`;
        }

        // ── All Products ──
        if (allProducts.length > 0) {
            html += `
                <div class="mb-3">
                    <div class="section-header"><h2>All Products</h2></div>
                    <div class="products-grid" id="allProductsGrid">
                        ${allProducts.map(p => renderProductCard(p)).join('')}
                    </div>
                    <div class="text-center mt-2">
                        <a href="search.html" class="btn btn-outline">View All Products</a>
                    </div>
                </div>`;
        }

        if (!html.includes('product-card')) {
            html += `
                <div class="empty-state">
                    <div style="font-size:48px;margin-bottom:16px;">📦</div>
                    <h3>No products yet</h3>
                    <p>Products will appear here once added by admin.</p>
                </div>`;
        }

        container.innerHTML = html;
        attachLikeEvents();

    } catch (err) {
        console.error('Home page load error:', err);
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">😔</div>
                <h3>Something went wrong</h3>
                <p>${err.message || 'Failed to load products. Please try again.'}</p>
                <button class="btn btn-primary" onclick="loadHomePage()">Retry</button>
            </div>`;
    }
}

// ── PRODUCT CARD ──────────────────────────────────────────────────────────────
function renderProductCard(product) {
    const maxMargin = product.mrp - product.base_price;
    return `
        <div class="product-card" data-product-id="${product.id}">
            <a href="product.html?id=${product.slug || product.id}" class="product-image">
                <img src="${product.thumbnail || (product.images && product.images[0]) || placeholderImage(product.name)}"
                     alt="${product.name}" loading="lazy">
                <div class="product-badges">
                    ${product.is_special  ? '<span class="product-badge special">Special</span>'        : ''}
                    ${product.is_featured ? '<span class="product-badge featured">Featured</span>'       : ''}
                    ${product.stock <= 0  ? '<span class="product-badge out-of-stock">Out of Stock</span>' : ''}
                </div>
            </a>
            <button class="like-btn" onclick="handleLike('${product.id}', this)" title="Add to wishlist">♡</button>
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
                           class="margin-input" data-product-id="${product.id}"
                           data-max="${maxMargin}" data-mrp="${product.mrp}">
                </div>
                <div class="card-actions">
                    ${product.stock > 0 ? `
                        <button class="btn btn-primary btn-sm add-cart-btn"
                                data-product-id="${product.id}"
                                onclick="handleAddToCart('${product.id}')">🛒 Add</button>
                    ` : `
                        <button class="btn btn-ghost btn-sm" disabled>Out of Stock</button>
                    `}
                    <a href="product.html?id=${product.slug || product.id}" class="btn btn-outline btn-sm">View</a>
                </div>
            </div>
        </div>`;
}

// ── LIKE ──────────────────────────────────────────────────────────────────────
async function handleLike(productId, btn) {
    if (!Auth.requireAuth()) return;
    const { liked, error } = await DB.toggleLike(Auth.getUserId(), productId);
    if (error) { Toast.error('Failed to update wishlist'); return; }
    btn.classList.toggle('liked', liked);
    btn.textContent = liked ? '❤' : '♡';
    Toast[liked ? 'success' : 'info'](liked ? 'Added to wishlist' : 'Removed from wishlist');
}

// ── ADD TO CART ───────────────────────────────────────────────────────────────
async function handleAddToCart(productId) {
    if (!Auth.requireAuth()) return;
    const marginInput = document.querySelector(`.margin-input[data-product-id="${productId}"]`);
    const margin = parseFloat(marginInput?.value) || 0;
    const { error } = await DB.addToCart(Auth.getUserId(), productId, 1, margin);
    if (error) { Toast.error('Failed to add to cart'); return; }
    Toast.success('Added to cart!');
    Auth.updateCartBadge();
}

// ── ATTACH EVENTS ─────────────────────────────────────────────────────────────
function attachLikeEvents() {
    if (!Auth.isLoggedIn()) return;
    document.querySelectorAll('.like-btn').forEach(async btn => {
        const productId = btn.closest('.product-card')?.dataset.productId;
        if (!productId) return;
        const liked = await DB.isLiked(Auth.getUserId(), productId);
        if (liked) { btn.classList.add('liked'); btn.textContent = '❤'; }
    });
}

function attachAddToCartEvents() { /* handled by onclick */ }

// ── SEARCH ────────────────────────────────────────────────────────────────────
function handleSearch(e) {
    if (e.key === 'Enter') {
        const term = e.target.value.trim();
        if (term) location.href = `search.html?q=${encodeURIComponent(term)}`;
    }
}
