// js/supabase-client.js

const SUPABASE_URL = 'https://ahbtazekfopmjppnlrxc.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFoYnRhemVrZm9wbWpwcG5scnhjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ5OTYzMzQsImV4cCI6MjA5MDU3MjMzNH0.NrgXule6SJJrwzOk11g99hkC7rQWsd7lS7veqS8QpmA';
const RAZORPAY_KEY = 'rzp_live_SSegtOEGykPOUN';
const TWOFACTOR_API_KEY = '2503bcf6-237e-11f1-bcb0-0200cd936042';

// Initialize Supabase client
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Helper functions
const DB = {
    // ---- PROFILES ----
    async getProfile(userId) {
        const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', userId)
            .single();
        return { data, error };
    },

    async updateProfile(userId, updates) {
        const { data, error } = await supabase
            .from('profiles')
            .update(updates)
            .eq('id', userId)
            .select()
            .single();
        return { data, error };
    },

    // ---- ADDRESSES ----
    async getAddresses(userId) {
        const { data, error } = await supabase
            .from('addresses')
            .select('*')
            .eq('user_id', userId)
            .order('is_default', { ascending: false });
        return { data, error };
    },

    async addAddress(address) {
        const { data, error } = await supabase
            .from('addresses')
            .insert(address)
            .select()
            .single();
        return { data, error };
    },

    async updateAddress(id, updates) {
        const { data, error } = await supabase
            .from('addresses')
            .update(updates)
            .eq('id', id)
            .select()
            .single();
        return { data, error };
    },

    async deleteAddress(id) {
        const { error } = await supabase
            .from('addresses')
            .delete()
            .eq('id', id);
        return { error };
    },

    // ---- BANK ACCOUNTS ----
    async getBankAccount(userId) {
        const { data, error } = await supabase
            .from('bank_accounts')
            .select('*')
            .eq('user_id', userId)
            .single();
        return { data, error };
    },

    async upsertBankAccount(bankData) {
        const { data, error } = await supabase
            .from('bank_accounts')
            .upsert(bankData, { onConflict: 'user_id' })
            .select()
            .single();
        return { data, error };
    },

    // ---- CATEGORIES ----
    async getCategories() {
        const { data, error } = await supabase
            .from('categories')
            .select('*')
            .eq('is_active', true)
            .order('sort_order');
        return { data, error };
    },

    async getParentCategories() {
        const { data, error } = await supabase
            .from('categories')
            .select('*')
            .is('parent_id', null)
            .eq('is_active', true)
            .order('sort_order');
        return { data, error };
    },

    async getSubCategories(parentId) {
        const { data, error } = await supabase
            .from('categories')
            .select('*')
            .eq('parent_id', parentId)
            .eq('is_active', true)
            .order('sort_order');
        return { data, error };
    },

    async getAllCategories() {
        const { data, error } = await supabase
            .from('categories')
            .select('*')
            .order('sort_order');
        return { data, error };
    },

    // ---- PRODUCTS ----
    async getProducts(options = {}) {
        let query = supabase
            .from('products')
            .select('*, categories!products_category_id_fkey(name, slug)')
            .eq('is_active', true);

        if (options.category_id) {
            query = query.eq('category_id', options.category_id);
        }
        if (options.subcategory_id) {
            query = query.eq('subcategory_id', options.subcategory_id);
        }
        if (options.is_featured) {
            query = query.eq('is_featured', true);
        }
        if (options.is_special) {
            query = query.eq('is_special', true);
        }
        if (options.search) {
            query = query.or(`name.ilike.%${options.search}%,description.ilike.%${options.search}%,tags.cs.{${options.search}}`);
        }
        if (options.limit) {
            query = query.limit(options.limit);
        }
        if (options.offset) {
            query = query.range(options.offset, options.offset + (options.limit || 20) - 1);
        }

        query = query.order('created_at', { ascending: false });

        const { data, error, count } = await query;
        return { data, error, count };
    },

    async getProduct(idOrSlug) {
        let query = supabase
            .from('products')
            .select('*, categories!products_category_id_fkey(name, slug)');

        // Check if it's a UUID or slug
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (uuidRegex.test(idOrSlug)) {
            query = query.eq('id', idOrSlug);
        } else {
            query = query.eq('slug', idOrSlug);
        }

        const { data, error } = await query.single();
        return { data, error };
    },

    async searchProducts(term) {
        const { data, error } = await supabase
            .from('products')
            .select('*')
            .eq('is_active', true)
            .or(`name.ilike.%${term}%,description.ilike.%${term}%,sku.ilike.%${term}%`)
            .order('is_special', { ascending: false })
            .order('is_featured', { ascending: false })
            .limit(50);
        return { data, error };
    },

    // ---- CART ----
    async getCart(userId) {
        const { data, error } = await supabase
            .from('cart_items')
            .select('*, products(*)')
            .eq('user_id', userId)
            .order('created_at', { ascending: false });
        return { data, error };
    },

    async addToCart(userId, productId, quantity = 1, marginAmount = 0) {
        // Check if exists
        const { data: existing } = await supabase
            .from('cart_items')
            .select('*')
            .eq('user_id', userId)
            .eq('product_id', productId)
            .single();

        if (existing) {
            const { data, error } = await supabase
                .from('cart_items')
                .update({
                    quantity: existing.quantity + quantity,
                    margin_amount: marginAmount
                })
                .eq('id', existing.id)
                .select()
                .single();
            return { data, error };
        }

        const { data, error } = await supabase
            .from('cart_items')
            .insert({
                user_id: userId,
                product_id: productId,
                quantity,
                margin_amount: marginAmount
            })
            .select()
            .single();
        return { data, error };
    },

    async updateCartItem(id, updates) {
        const { data, error } = await supabase
            .from('cart_items')
            .update(updates)
            .eq('id', id)
            .select()
            .single();
        return { data, error };
    },

    async removeFromCart(id) {
        const { error } = await supabase
            .from('cart_items')
            .delete()
            .eq('id', id);
        return { error };
    },

    async clearCart(userId) {
        const { error } = await supabase
            .from('cart_items')
            .delete()
            .eq('user_id', userId);
        return { error };
    },

    async getCartCount(userId) {
        const { count, error } = await supabase
            .from('cart_items')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', userId);
        return { count, error };
    },

    // ---- LIKES ----
    async getLikedProducts(userId) {
        const { data, error } = await supabase
            .from('liked_products')
            .select('*, products(*)')
            .eq('user_id', userId)
            .order('created_at', { ascending: false });
        return { data, error };
    },

    async toggleLike(userId, productId) {
        const { data: existing } = await supabase
            .from('liked_products')
            .select('*')
            .eq('user_id', userId)
            .eq('product_id', productId)
            .single();

        if (existing) {
            const { error } = await supabase
                .from('liked_products')
                .delete()
                .eq('id', existing.id);
            return { liked: false, error };
        }

        const { error } = await supabase
            .from('liked_products')
            .insert({ user_id: userId, product_id: productId });
        return { liked: true, error };
    },

    async isLiked(userId, productId) {
        const { data } = await supabase
            .from('liked_products')
            .select('id')
            .eq('user_id', userId)
            .eq('product_id', productId)
            .single();
        return !!data;
    },

    // ---- ORDERS ----
    async createOrder(orderData) {
        const orderNumber = 'CNT' + Date.now().toString().slice(-8) + Math.random().toString(36).slice(-4).toUpperCase();
        const { data, error } = await supabase
            .from('orders')
            .insert({ ...orderData, order_number: orderNumber })
            .select()
            .single();
        return { data, error };
    },

    async createOrderItems(items) {
        const { data, error } = await supabase
            .from('order_items')
            .insert(items)
            .select();
        return { data, error };
    },

    async getOrders(userId) {
        const { data, error } = await supabase
            .from('orders')
            .select('*, order_items(*, products(thumbnail, name))')
            .eq('user_id', userId)
            .order('created_at', { ascending: false });
        return { data, error };
    },

    async getOrder(orderId) {
        const { data, error } = await supabase
            .from('orders')
            .select('*, order_items(*, products(thumbnail, name))')
            .eq('id', orderId)
            .single();
        return { data, error };
    },

    async updateOrder(orderId, updates) {
        const { data, error } = await supabase
            .from('orders')
            .update(updates)
            .eq('id', orderId)
            .select()
            .single();
        return { data, error };
    },

    // ---- SETTLEMENTS ----
    async createSettlement(settlementData) {
        const { data, error } = await supabase
            .from('settlements')
            .insert(settlementData)
            .select()
            .single();
        return { data, error };
    },

    async getSettlements(userId) {
        const { data, error } = await supabase
            .from('settlements')
            .select('*, orders(order_number)')
            .eq('user_id', userId)
            .order('created_at', { ascending: false });
        return { data, error };
    },

    async getSettlementSummary(userId) {
        const { data: settlements } = await supabase
            .from('settlements')
            .select('margin_amount, status')
            .eq('user_id', userId);

        if (!settlements) return { total: 0, settled: 0, pending: 0, eligible: 0 };

        const summary = {
            total: 0,
            settled: 0,
            pending: 0,
            eligible: 0
        };

        settlements.forEach(s => {
            summary.total += parseFloat(s.margin_amount);
            if (s.status === 'settled') summary.settled += parseFloat(s.margin_amount);
            if (s.status === 'pending') summary.pending += parseFloat(s.margin_amount);
            if (s.status === 'eligible') summary.eligible += parseFloat(s.margin_amount);
        });

        return summary;
    },

    // ---- NOTIFICATIONS ----
    async getNotifications(userId) {
        const { data, error } = await supabase
            .from('notifications')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .limit(50);
        return { data, error };
    },

    async markNotificationRead(id) {
        const { error } = await supabase
            .from('notifications')
            .update({ is_read: true })
            .eq('id', id);
        return { error };
    },

    async markAllNotificationsRead(userId) {
        const { error } = await supabase
            .from('notifications')
            .update({ is_read: true })
            .eq('user_id', userId)
            .eq('is_read', false);
        return { error };
    },

    async getUnreadCount(userId) {
        const { count, error } = await supabase
            .from('notifications')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', userId)
            .eq('is_read', false);
        return { count, error };
    },

    async createNotification(notif) {
        const { data, error } = await supabase
            .from('notifications')
            .insert(notif)
            .select()
            .single();
        return { data, error };
    },

    // ---- ADMIN ----
    async getAllOrders(options = {}) {
        let query = supabase
            .from('orders')
            .select('*, order_items(*), profiles(full_name, phone)')
            .order('created_at', { ascending: false });

        if (options.status) {
            query = query.eq('order_status', options.status);
        }
        if (options.limit) {
            query = query.limit(options.limit);
        }

        const { data, error } = await query;
        return { data, error };
    },

    async getAllProducts() {
        const { data, error } = await supabase
            .from('products')
            .select('*, categories!products_category_id_fkey(name)')
            .order('created_at', { ascending: false });
        return { data, error };
    },

    async createProduct(product) {
        const { data, error } = await supabase
            .from('products')
            .insert(product)
            .select()
            .single();
        return { data, error };
    },

    async updateProduct(id, updates) {
        const { data, error } = await supabase
            .from('products')
            .update(updates)
            .eq('id', id)
            .select()
            .single();
        return { data, error };
    },

    async deleteProduct(id) {
        const { error } = await supabase
            .from('products')
            .delete()
            .eq('id', id);
        return { error };
    },

    async createCategory(cat) {
        const { data, error } = await supabase
            .from('categories')
            .insert(cat)
            .select()
            .single();
        return { data, error };
    },

    async updateCategory(id, updates) {
        const { data, error } = await supabase
            .from('categories')
            .update(updates)
            .eq('id', id)
            .select()
            .single();
        return { data, error };
    },

    async deleteCategory(id) {
        const { error } = await supabase
            .from('categories')
            .delete()
            .eq('id', id);
        return { error };
    },

    async getAllSettlements() {
        const { data, error } = await supabase
            .from('settlements')
            .select('*, profiles(full_name, phone), orders(order_number)')
            .order('created_at', { ascending: false });
        return { data, error };
    },

    async updateSettlement(id, updates) {
        const { data, error } = await supabase
            .from('settlements')
            .update(updates)
            .eq('id', id)
            .select()
            .single();
        return { data, error };
    },

    async getAllUsers() {
        const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .order('created_at', { ascending: false });
        return { data, error };
    },

    async getAdminConfig(key) {
        const { data, error } = await supabase
            .from('admin_config')
            .select('value')
            .eq('key', key)
            .single();
        return { data, error };
    },

    // Analytics helpers
    async getAdminAnalytics() {
        const [ordersRes, usersRes, productsRes, settlementsRes] = await Promise.all([
            supabase.from('orders').select('total_amount, total_margin, order_status, created_at, payment_status'),
            supabase.from('profiles').select('id, created_at').eq('is_admin', false),
            supabase.from('products').select('id, stock, is_active'),
            supabase.from('settlements').select('margin_amount, status')
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
            supabase.from('orders').select('total_amount, total_margin, order_status, created_at').eq('user_id', userId),
            supabase.from('settlements').select('margin_amount, status, created_at').eq('user_id', userId)
        ]);

        return {
            orders: ordersRes.data || [],
            settlements: settlementsRes.data || []
        };
    },

    // Upload image
    async uploadImage(bucket, file, path) {
        const fileExt = file.name.split('.').pop();
        const fileName = `${path}/${Date.now()}.${fileExt}`;
        const { data, error } = await supabase.storage
            .from(bucket)
            .upload(fileName, file);
        
        if (error) return { url: null, error };
        
        const { data: urlData } = supabase.storage
            .from(bucket)
            .getPublicUrl(fileName);
        
        return { url: urlData.publicUrl, error: null };
    }
};

// OTP Functions using 2factor
const OTP = {
    async sendOTP(phone) {
        try {
            const response = await fetch(
                `https://2factor.in/API/V1/${TWOFACTOR_API_KEY}/SMS/${phone}/AUTOGEN/OTP1`,
                { method: 'GET' }
            );
            const data = await response.json();
            if (data.Status === 'Success') {
                return { sessionId: data.Details, error: null };
            }
            return { sessionId: null, error: data.Details || 'Failed to send OTP' };
        } catch (err) {
            return { sessionId: null, error: err.message };
        }
    },

    async verifyOTP(sessionId, otp) {
        try {
            const response = await fetch(
                `https://2factor.in/API/V1/${TWOFACTOR_API_KEY}/SMS/VERIFY/${sessionId}/${otp}`,
                { method: 'GET' }
            );
            const data = await response.json();
            if (data.Status === 'Success' && data.Details === 'OTP Matched') {
                return { verified: true, error: null };
            }
            return { verified: false, error: 'Invalid OTP' };
        } catch (err) {
            return { verified: false, error: err.message };
        }
    }
};

// Razorpay Helper
const Payment = {
    createOrder(amount, orderId, prefill = {}) {
        return new Promise((resolve, reject) => {
            const options = {
                key: RAZORPAY_KEY,
                amount: Math.round(amount * 100), // in paise
                currency: 'INR',
                name: 'Conitek',
                description: `Order #${orderId}`,
           
