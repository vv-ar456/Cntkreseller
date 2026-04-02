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

    container.innerHTML = `
        <div style="padding:40px 20px;text-align:center;">
            <div style="width:36px;height:36px;border:3px solid #eee;border-top-color:#6c47ff;
                        border-radius:50%;animation:spin .7s linear infinite;margin:0 auto 12px;"></div>
            <p style="color:#999;font-size:14px;">Loading products...</p>
        </div>
        <style>@keyframes spin{to{transform:rotate(360deg)}}</style>`;

    try {
        const [categoriesRes, featuredRes, specialRes, allProductsRes] = await Promise.all([
            DB.getParentCategories(),
            DB.getProducts({ is_featured: true, limit: 10 }),
            DB.getProducts({ is_special: true, limit: 10 }),
            DB.getProducts({ limit: 20 })
        ]);

        const categories  = categoriesRes.data  || [];
        const featured    = featuredRes.data     || [];
        const special     = specialRes.data      || [];
        const allProducts = allProductsRes.data  || [];

        // inject home page styles
        if (!document.getElementById('homeStyles')) {
            const s = document.createElement('style');
            s.id = 'homeStyles';
            s.textContent = HOME_STYLES;
            document.head.appendChild(s);
        }

        let html = '';

        // ── Trust Strip ──
        html += `
        <div class="trust-strip">
            <div class="trust-item"><span>✅</span><span>Quality Assured</span></div>
            <div class="trust-item"><span>🚚</span><span>Free Shipping</span></div>
            <div class="trust-item"><span>💵</span><span>Cash on Delivery</span></div>
            <div class="trust-item"><span>🔄</span><span>Easy Returns</span></div>
        </div>`;

        // ── Categories ──
        if (categories.length > 0) {
            html += `
            <div class="cat-scroll-wrap">
                <div class="cat-scroll">
                    ${categories.map(cat => `
                    <a href="category.html?id=${cat.id}" class="cat-pill">
                        <div class="cat-pill-img">
                            <img src="${cat.image_url || placeholderImage(cat.name)}" alt="${cat.name}" loading="lazy"
                                 onerror="this.src='${placeholderImage(cat.name)}'">
                        </div>
                        <span>${cat.name}</span>
                    </a>`).join('')}
                </div>
            </div>`;
        }

        // ── Special Deals ──
        if (special.length > 0) {
            html += renderSection('🔥 Special Deals', special.length, 'search.html?special=true', special);
        }

        // ── Featured ──
        if (featured.length > 0) {
            html += renderSection('⭐ Featured Products', featured.length, 'search.html?featured=true', featured);
        }

        // ── All Products ──
        if (allProducts.length > 0) {
            html += renderSection('All Products', allProducts.length, 'search.html', allProducts);
        }

        if (!special.length && !featured.length && !allProducts.length) {
            html += `
            <div style="padding:60px 20px;text-align:center;color:#999;">
                <div style="font-size:48px;margin-bottom:12px;">📦</div>
                <h3 style="color:#333;margin-bottom:6px;">No products yet</h3>
                <p style="font-size:14px;">Products will appear here once added by admin.</p>
            </div>`;
        }

        container.innerHTML = html;
        attachLikeEvents();

    } catch (err) {
        console.error('Home page load error:', err);
        container.innerHTML = `
            <div style="padding:60px 20px;text-align:center;">
                <div style="font-size:40px;margin-bottom:12px;">😔</div>
                <h3 style="color:#333;margin-bottom:8px;">Something went wrong</h3>
                <p style="color:#999;font-size:14px;margin-bottom:20px;">${err.message || 'Failed to load products'}</p>
                <button onclick="loadHomePage()" style="background:#6c47ff;color:#fff;border:none;padding:12px 24px;border-radius:10px;font-size:14px;font-weight:600;cursor:pointer;">Retry</button>
            </div>`;
    }
}

function renderSection(title, count, viewAllHref, products) {
    return `
    <div class="product-section">
        <div class="section-hdr">
            <div>
                <div class="section-title">${title}</div>
                <div class="section-count">${count}+ Products</div>
            </div>
            <a href="${viewAllHref}" class="view-all-btn">View All ›</a>
        </div>
        <div class="products-2col">
            ${products.map(p => renderProductCard(p)).join('')}
        </div>
    </div>`;
}

// ── HOME STYLES (injected once) ───────────────────────────────────────────────
const HOME_STYLES = `
/* Trust Strip */
.trust-strip {
    display: flex; overflow-x: auto; gap: 0;
    background: #f5f0ff; padding: 10px 16px;
    scrollbar-width: none;
}
.trust-strip::-webkit-scrollbar { display: none; }
.trust-item {
    display: flex; align-items: center; gap: 6px;
    white-space: nowrap; padding: 4px 16px;
    font-size: 12px; font-weight: 600; color: #444;
    border-right: 1px solid #e0d4ff;
}
.trust-item:last-child { border-right: none; }

/* Category Scroll */
.cat-scroll-wrap { overflow: hidden; padding: 16px 0 4px; }
.cat-scroll {
    display: flex; gap: 10px; overflow-x: auto;
    padding: 0 16px 10px; scrollbar-width: none;
}
.cat-scroll::-webkit-scrollbar { display: none; }
.cat-pill {
    display: flex; flex-direction: column; align-items: center;
    gap: 6px; min-width: 60px; text-decoration: none;
    color: #333; font-size: 11px; font-weight: 500;
    text-align: center; line-height: 1.2;
}
.cat-pill-img {
    width: 52px; height: 52px; border-radius: 50%;
    overflow: hidden; background: #f0f0f0;
    border: 2px solid #eee;
}
.cat-pill-img img { width: 100%; height: 100%; object-fit: cover; }
.cat-pill:hover .cat-pill-img { border-color: #6c47ff; }

/* Section */
.product-section { padding: 16px 0 4px; }
.section-hdr {
    display: flex; align-items: flex-end; justify-content: space-between;
    padding: 0 16px 12px;
}
.section-title { font-size: 16px; font-weight: 700; color: #111; }
.section-count { font-size: 12px; color: #999; margin-top: 2px; }
.view-all-btn {
    font-size: 13px; font-weight: 600; color: #6c47ff;
    text-decoration: none; white-space: nowrap;
}

/* 2-col product grid */
.products-2col {
    display: grid; grid-template-columns: 1fr 1fr;
    gap: 10px; padding: 0 12px;
}

/* Product Card — Roposo style */
.rc-card {
    background: #fff; border-radius: 12px;
    overflow: hidden; border: 1px solid #eee;
    box-shadow: 0 1px 6px rgba(0,0,0,.05);
    position: relative; cursor: pointer;
    transition: box-shadow .15s;
}
.rc-card:hover { box-shadow: 0 4px 16px rgba(0,0,0,.1); }

.rc-img-wrap {
    position: relative; width: 100%; padding-top: 100%;
    background: #f8f8f8; overflow: hidden;
}
.rc-img-wrap img {
    position: absolute; inset: 0; width: 100%; height: 100%;
    object-fit: cover; transition: transform .3s;
}
.rc-card:hover .rc-img-wrap img { transform: scale(1.04); }

.rc-badges {
    position: absolute; top: 6px; left: 6px;
    display: flex; flex-direction: column; gap: 3px;
}
.rc-badge {
    font-size: 9px; font-weight: 700; padding: 2px 7px;
    border-radius: 4px; text-transform: uppercase; letter-spacing: .04em;
}
.rc-badge-special  { background: #ff4d4d; color: #fff; }
.rc-badge-featured { background: #ffb800; color: #000; }
.rc-badge-oos      { background: rgba(0,0,0,.6); color: #fff; }
.rc-badge-new      { background: #6c47ff; color: #fff; }

.rc-like {
    position: absolute; top: 6px; right: 6px;
    background: rgba(255,255,255,.9); border: none; border-radius: 50%;
    width: 30px; height: 30px; font-size: 15px; cursor: pointer;
    display: flex; align-items: center; justify-content: center;
    box-shadow: 0 1px 4px rgba(0,0,0,.1); transition: transform .15s;
    z-index: 2;
}
.rc-like:hover { transform: scale(1.15); }
.rc-like.liked { color: #ff4d4d; }

.rc-info { padding: 8px 10px 10px; }
.rc-name {
    font-size: 12px; font-weight: 500; color: #222;
    line-height: 1.4; margin-bottom: 6px;
    display: -webkit-box; -webkit-line-clamp: 2;
    -webkit-box-orient: vertical; overflow: hidden;
}
.rc-price-row {
    display: flex; align-items: center; gap: 6px; margin-bottom: 5px;
}
.rc-price {
    font-size: 15px; font-weight: 800; color: #111;
}
.rc-mrp {
    font-size: 12px; color: #aaa;
    text-decoration: line-through;
}
.rc-discount {
    font-size: 11px; font-weight: 700; color: #ff4d4d;
    background: #fff0f0; padding: 1px 5px; border-radius: 4px;
}
.rc-meta {
    display: flex; align-items: center; justify-content: space-between;
    font-size: 11px; color: #888; margin-bottom: 7px;
}
.rc-stock { color: #555; }
.rc-sold  { color: #f59e0b; font-weight: 600; }
.rc-margin-row {
    display: flex; align-items: center; gap: 6px; margin-bottom: 8px;
}
.rc-margin-input {
    flex: 1; padding: 5px 8px; border: 1.5px solid #eee;
    border-radius: 7px; font-size: 12px; outline: none;
    color: #333; background: #fafafa;
    transition: border-color .15s;
}
.rc-margin-input:focus { border-color: #6c47ff; background: #fff; }
.rc-add-btn {
    padding: 6px 10px; background: #6c47ff; color: #fff;
    border: none; border-radius: 7px; font-size: 12px;
    font-weight: 700; cursor: pointer; white-space: nowrap;
    transition: background .15s;
}
.rc-add-btn:hover   { background: #5535d4; }
.rc-add-btn:disabled { background: #ccc; cursor: not-allowed; }
.rc-view-btn {
    display: block; text-align: center; padding: 7px;
    background: #f5f0ff; color: #6c47ff; border-radius: 8px;
    font-size: 12px; font-weight: 600; text-decoration: none;
    margin-top: 4px;
}
`;

// ── PRODUCT CARD (Roposo style) ───────────────────────────────────────────────
function renderProductCard(product) {
    const maxMargin  = product.mrp - product.base_price;
    const discount   = product.mrp > 0 ? Math.round((maxMargin / product.mrp) * 100) : 0;
    const imgSrc     = product.thumbnail
                    || (product.images && product.images[0])
                    || placeholderImage(product.name);
    const isOOS      = product.stock <= 0;
    const isLowStock = product.stock > 0 && product.stock <= 5;

    return `
    <div class="rc-card" data-product-id="${product.id}">
        <a href="product.html?id=${product.slug || product.id}" style="display:block;text-decoration:none;">
            <div class="rc-img-wrap">
                <img src="${imgSrc}" alt="${product.name}" loading="lazy"
                     onerror="this.src='${placeholderImage(product.name)}'">
                <div class="rc-badges">
                    ${isOOS               ? '<span class="rc-badge rc-badge-oos">Out of Stock</span>'  : ''}
                    ${product.is_special  ? '<span class="rc-badge rc-badge-special">Special</span>'  : ''}
                    ${product.is_featured ? '<span class="rc-badge rc-badge-featured">Featured</span>': ''}
                </div>
            </div>
        </a>
        <button class="rc-like" onclick="handleLike('${product.id}',this)" title="Wishlist">♡</button>

        <div class="rc-info">
            <a href="product.html?id=${product.slug || product.id}" style="text-decoration:none;">
                <div class="rc-name">${product.name}</div>
                <div class="rc-price-row">
                    <span class="rc-price">${formatCurrency(product.base_price)}</span>
                    ${product.mrp > product.base_price
                        ? `<span class="rc-mrp">${formatCurrency(product.mrp)}</span>
                           <span class="rc-discount">${discount}% off</span>`
                        : ''}
                </div>
            </a>
            <div class="rc-meta">
                <span class="rc-stock">${
                    isOOS        ? '❌ Out of stock'
                    : isLowStock ? `⚠️ Only ${product.stock} left`
                    :              `📦 ${product.stock} in stock`
                }</span>
                ${maxMargin > 0 ? `<span class="rc-sold">💰 Earn ${formatCurrency(maxMargin)}</span>` : ''}
            </div>

            ${!isOOS ? `
            <div class="rc-margin-row">
                <input type="number" class="rc-margin-input margin-input"
                       placeholder="Add margin ₹" min="0" max="${maxMargin}"
                       data-product-id="${product.id}" data-max="${maxMargin}" data-mrp="${product.mrp}">
                <button class="rc-add-btn" onclick="handleAddToCart('${product.id}')">🛒 Add</button>
            </div>
            ` : `
            <button style="width:100%;padding:7px;background:#f5f5f5;border:none;border-radius:8px;
                           color:#aaa;font-size:12px;font-weight:600;margin-top:4px;" disabled>
                Out of Stock
            </button>
            `}

            <a href="product.html?id=${product.slug || product.id}" class="rc-view-btn">View Details</a>
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
    document.querySelectorAll('.rc-like').forEach(async btn => {
        const productId = btn.closest('.rc-card')?.dataset.productId;
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
