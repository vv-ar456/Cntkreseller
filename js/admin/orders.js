// js/admin/orders.js

const AdminOrders = {
    allOrders: [],
    currentFilter: '',
    searchTerm: '',
    selectedOrderId: null,

    async init() {
        if (!AdminAuth.requireAuth()) return;

        // Check URL params for filters
        const params = new URLSearchParams(window.location.search);
        const statusParam = params.get('status');
        const idParam = params.get('id');

        if (statusParam) {
            this.currentFilter = statusParam;
            const filterSelect = document.getElementById('statusFilter');
            if (filterSelect) filterSelect.value = statusParam;
        }

        await this.loadOrders();

        if (idParam) {
            this.showOrderDetail(idParam);
        }

        this.setupEventListeners();
    },

    setupEventListeners() {
        const statusFilter = document.getElementById('statusFilter');
        if (statusFilter) {
            statusFilter.addEventListener('change', () => {
                this.currentFilter = statusFilter.value;
                this.renderOrders();
            });
        }

        const searchInput = document.getElementById('orderSearch');
        if (searchInput) {
            let debounce;
            searchInput.addEventListener('input', () => {
                clearTimeout(debounce);
                debounce = setTimeout(() => {
                    this.searchTerm = searchInput.value.trim().toLowerCase();
                    this.renderOrders();
                }, 300);
            });
        }
    },

    async loadOrders() {
        const container = document.getElementById('ordersContent');
        if (!container) return;

        container.innerHTML = `<div class="page-loader"><div class="loading-spinner"></div></div>`;

        const { data, error } = await DB.getAllOrders();

        if (error) {
            container.innerHTML = `
                <div class="empty-state">
                    <h3>Failed to load orders</h3>
                    <button class="btn btn-primary" onclick="AdminOrders.loadOrders()">Retry</button>
                </div>
            `;
            return;
        }

        this.allOrders = data || [];
        this.renderOrders();
    },

    getFilteredOrders() {
        let orders = [...this.allOrders];

        if (this.currentFilter) {
            orders = orders.filter(o => o.order_status === this.currentFilter);
        }

        if (this.searchTerm) {
            orders = orders.filter(o =>
                o.order_number.toLowerCase().includes(this.searchTerm) ||
                o.customer_name?.toLowerCase().includes(this.searchTerm) ||
                o.customer_phone?.includes(this.searchTerm) ||
                o.profiles?.full_name?.toLowerCase().includes(this.searchTerm) ||
                o.profiles?.phone?.includes(this.searchTerm)
            );
        }

        return orders;
    },

    renderOrders() {
        const container = document.getElementById('ordersContent');
        if (!container) return;

        const filtered = this.getFilteredOrders();

        if (filtered.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">🛍️</div>
                    <h3>${this.currentFilter || this.searchTerm ? 'No matching orders' : 'No orders yet'}</h3>
                </div>
            `;
            return;
        }

        // Status summary
        const statusSummary = {};
        this.allOrders.forEach(o => {
            statusSummary[o.order_status] = (statusSummary[o.order_status] || 0) + 1;
        });

        container.innerHTML = `
            <!-- Status Quick Filters -->
            <div class="flex gap-1 mb-2" style="flex-wrap:wrap;">
                <button class="filter-chip ${!this.currentFilter ? 'active' : ''}" 
                        onclick="AdminOrders.setFilter('')">
                    All (${this.allOrders.length})
                </button>
                ${Object.entries(statusSummary).map(([status, count]) => `
                    <button class="filter-chip ${this.currentFilter === status ? 'active' : ''}" 
                            onclick="AdminOrders.setFilter('${status}')">
                        ${status.replace(/_/g, ' ')} (${count})
                    </button>
                `).join('')}
            </div>

            <p class="text-muted mb-1" style="font-size:13px;">${filtered.length} orders</p>

            <div class="admin-table-container">
                <table class="admin-table">
                    <thead>
                        <tr>
                            <th>Order</th>
                            <th>Customer</th>
                            <th>Items</th>
                            <th>Amount</th>
                            <th>Margin</th>
                            <th>Status</th>
                            <th>Payment</th>
                            <th>Date</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${filtered.map(o => this.renderOrderRow(o)).join('')}
                    </tbody>
                </table>
            </div>
        `;
    },

    renderOrderRow(order) {
        const itemCount = order.order_items?.length || 0;

        return `
            <tr>
                <td>
                    <strong style="color:var(--primary);cursor:pointer;" onclick="AdminOrders.showOrderDetail('${order.id}')">
                        ${order.order_number}
                    </strong>
                </td>
                <td>
                    ${order.customer_name || order.profiles?.full_name || '-'}
                    <br><small class="text-muted">${order.customer_phone || order.profiles?.phone || ''}</small>
                </td>
                <td>${itemCount} item${itemCount !== 1 ? 's' : ''}</td>
                <td><strong>${formatCurrency(order.total_amount)}</strong></td>
                <td>
                    <span class="text-success fw-600">
                        ${parseFloat(order.total_margin) > 0 ? formatCurrency(order.total_margin) : '-'}
                    </span>
                </td>
                <td>
                    <span class="order-status-badge ${order.order_status}">
                        ${order.order_status.replace(/_/g, ' ')}
                    </span>
                </td>
                <td>
                    <span class="tag ${order.payment_status === 'paid' ? 'tag-success' : 
                        order.payment_status === 'failed' ? 'tag-danger' : 
                        order.payment_status === 'refunded' ? 'tag-info' : 'tag-warning'}">
                        ${order.payment_status}
                    </span>
                </td>
                <td>
                    ${formatDate(order.created_at)}
                    <br><small class="text-muted">${new Date(order.created_at).toLocaleTimeString('en-IN', {hour:'2-digit', minute:'2-digit'})}</small>
                </td>
                <td>
                    <div class="actions">
                        <button class="edit-btn" onclick="AdminOrders.showUpdateModal('${order.id}')">Update</button>
                        <button class="view-btn" onclick="AdminOrders.showOrderDetail('${order.id}')">View</button>
                    </div>
                </td>
            </tr>
        `;
    },

    setFilter(status) {
        this.currentFilter = status;
        const select = document.getElementById('statusFilter');
        if (select) select.value = status;
        this.renderOrders();
    },

    showUpdateModal(orderId) {
        const order = this.allOrders.find(o => o.id === orderId);
        if (!order) return;

        this.selectedOrderId = orderId;

        document.getElementById('updateOrderId').value = orderId;
        document.getElementById('updateOrderNum').textContent = '#' + order.order_number;
        document.getElementById('updateStatus').value = order.order_status;
        document.getElementById('updateTracking').value = order.tracking_number || '';
        document.getElementById('updateTrackingUrl').value = order.tracking_url || '';
        document.getElementById('updateNotes').value = order.notes || '';

        document.getElementById('orderModal').classList.add('active');
    },

    hideUpdateModal() {
        document.getElementById('orderModal').classList.remove('active');
        this.selectedOrderId = null;
    },

    async updateOrderStatus() {
        const id = document.getElementById('updateOrderId').value;
        const status = document.getElementById('updateStatus').value;

        const updates = {
            order_status: status,
            tracking_number: document.getElementById('updateTracking').value.trim() || null,
            tracking_url: document.getElementById('updateTrackingUrl').value.trim() || null,
            notes: document.getElementById('updateNotes').value.trim() || null
        };

        // Auto-set timestamps
        if (status === 'shipped' && !updates.shipped_at) {
            updates.shipped_at = new Date().toISOString();
        }
        if (status === 'delivered') {
            updates.delivered_at = new Date().toISOString();
        }
        if (status === 'cancelled') {
            updates.cancelled_at = new Date().toISOString();
        }
        if (status === 'rto_initiated') {
            updates.rto_initiated_at = new Date().toISOString();
        }
        if (status === 'rto_completed') {
            updates.rto_completed_at = new Date().toISOString();
        }

        const btn = event.target;
        btn.disabled = true;
        btn.innerHTML = '<span class="loading-spinner sm"></span> Updating...';

        const { error } = await DB.updateOrder(id, updates);

        if (error) {
            Toast.error('Failed: ' + error.message);
            btn.disabled = false;
            btn.textContent = 'Update Order';
            return;
        }

        // Send notification to user
        const order = this.allOrders.find(o => o.id === id);
        if (order) {
            const statusMessages = {
                confirmed: 'Your order has been confirmed!',
                processing: 'Your order is being processed.',
                shipped: `Your order has been shipped! ${updates.tracking_number ? 'Tracking: ' + updates.tracking_number : ''}`,
                out_for_delivery: 'Your order is out for delivery!',
                delivered: 'Your order has been delivered!',
                cancelled: 'Your order has been cancelled.',
                rto_initiated: 'Your order is being returned to origin.',
                rto_completed: 'Return to origin completed for your order.'
            };

            if (statusMessages[status]) {
                await DB.createNotification({
                    user_id: order.user_id,
                    title: `Order #${order.order_number} - ${status.replace(/_/g, ' ').toUpperCase()}`,
                    message: statusMessages[status],
                    type: 'order',
                    link: `orders.html?id=${order.id}`
                });
            }
        }

        Toast.success('Order updated successfully!');
        this.hideUpdateModal();
        await this.loadOrders();

        btn.disabled = false;
        btn.textContent = 'Update Order';
    },

    async showOrderDetail(orderId) {
        const order = this.allOrders.find(o => o.id === orderId);
        if (!order) {
            // Fetch from DB
            const { data } = await DB.getOrder(orderId);
            if (!data) {
                Toast.error('Order not found');
                return;
            }
            this.renderOrderDetail(data);
            return;
        }
        this.renderOrderDetail(order);
    },

    renderOrderDetail(order) {
        const detailModal = document.getElementById('orderDetailModal');
        const detailContent = document.getElementById('orderDetailContent');

        if (!detailModal || !detailContent) return;

        const statusLabels = {
            placed: 'Order Placed', confirmed: 'Confirmed', processing: 'Processing',
            shipped: 'Shipped', out_for_delivery: 'Out for Delivery', delivered: 'Delivered',
            cancelled: 'Cancelled', rto_initiated: 'RTO Initiated',
            rto_completed: 'RTO Completed', returned: 'Returned'
        };

        detailContent.innerHTML = `
            <div class="flex-between mb-2" style="flex-wrap:wrap; gap:12px;">
                <div>
                    <h2>Order #${order.order_number}</h2>
                    <p class="text-muted">${formatDateTime(order.created_at)}</p>
                </div>
                <span class="order-status-badge ${order.order_status}" style="font-size:14px;padding:8px 18px;">
                    ${statusLabels[order.order_status] || order.order_status}
                </span>
            </div>

            <!-- Customer Info -->
            <div class="card mb-2">
                <h3 class="mb-1">Customer Details</h3>
                <div class="product-form-grid">
                    <div>
                        <p class="text-muted" style="font-size:12px;">Name</p>
                        <p class="fw-600">${order.customer_name || '-'}</p>
                    </div>
                    <div>
                        <p class="text-muted" style="font-size:12px;">Phone</p>
                        <p class="fw-600">${order.customer_phone || '-'}</p>
                    </div>
                    <div>
                        <p class="text-muted" style="font-size:12px;">Email</p>
                        <p class="fw-600">${order.customer_email || '-'}</p>
                    </div>
                    <div>
                        <p class="text-muted" style="font-size:12px;">Reseller</p>
                        <p class="fw-600">${order.profiles?.full_name || '-'} (${order.profiles?.phone || ''})</p>
                    </div>
                </div>
            </div>

            <!-- Items -->
            <div class="card mb-2">
                <h3 class="mb-1">Order Items</h3>
                ${(order.order_items || []).map(item => `
                    <div class="order-item-row" style="border-bottom:1px solid var(--gray-100); padding:10px 0;">
                        <div class="item-thumb" style="width:50px;height:50px;">
                            <img src="${item.product_thumbnail || placeholderImage('')}" alt="">
                        </div>
                        <div class="item-info" style="flex:1;">
                            <div class="item-name" style="font-size:14px;">${item.product_name}</div>
                            <div style="font-size:12px; color:var(--gray-500);">
                                Qty: ${item.quantity} × MRP ${formatCurrency(item.mrp)}
                                ${item.margin_amount > 0 ? ` + Margin ₹${item.margin_amount}` : ''}
                            </div>
                        </div>
                        <div style="text-align:right;">
                            <div class="fw-700">${formatCurrency(item.total_price)}</div>
                            ${item.margin_amount > 0 ? `<div class="text-success" style="font-size:12px;">+${formatCurrency(item.margin_amount * item.quantity)} margin</div>` : ''}
                        </div>
                    </div>
                `).join('')}
            </div>

            <!-- Payment & Shipping -->
            <div class="product-form-grid">
                <div class="card">
                    <h3 class="mb-1">Payment Summary</h3>
                    <div class="summary-row"><span>Subtotal</span><span class="value">${formatCurrency(order.subtotal)}</span></div>
                    <div class="summary-row"><span>Margin</span><span class="value text-success">+${formatCurrency(order.total_margin)}</span></div>
                    <div class="summary-row"><span>Shipping</span><span class="value">${order.shipping_cost > 0 ? formatCurrency(order.shipping_cost) : 'FREE'}</span></div>
                    <div class="summary-row total"><span>Total</span><span class="value">${formatCurrency(order.total_amount)}</span></div>
                    <div class="summary-row">
                        <span>Payment Status</span>
                        <span class="tag ${order.payment_status === 'paid' ? 'tag-success' : 'tag-warning'}">${order.payment_status}</span>
                    </div>
                    ${order.razorpay_payment_id ? `
                        <div class="summary-row"><span>Razorpay ID</span><span class="value" style="font-size:12px;">${order.razorpay_payment_id}</span></div>
                    ` : ''}
                </div>

                <div class="card">
                    <h3 class="mb-1">Shipping Address</h3>
                    <p class="fw-600">${order.shipping_address?.full_name || '-'}</p>
                    <p style="font-size:14px; color:var(--gray-600); line-height:1.6;">
                        ${order.shipping_address?.address_line1 || ''}
                        ${order.shipping_address?.address_line2 ? '<br>' + order.shipping_address.address_line2 : ''}
                        <br>${order.shipping_address?.city || ''}, ${order.shipping_address?.state || ''} - ${order.shipping_address?.pincode || ''}
                        <br>📞 ${order.shipping_address?.phone || '-'}
                    </p>

                    ${order.tracking_number ? `
                        <div class="mt-2" style="padding-top:12px; border-top:1px solid var(--gray-200);">
                            <p class="text-muted" style="font-size:12px;">Tracking</p>
                            <p class="fw-600">${order.tracking_number}</p>
                            ${order.tracking_url ? `<a href="${order.tracking_url}" target="_blank" class="text-primary" style="font-size:13px;">Track Package →</a>` : ''}
                        </div>
                    ` : ''}

                    ${order.notes ? `
                        <div class="mt-2" style="padding-top:12px; border-top:1px solid var(--gray-200);">
                            <p class="text-muted" style="font-size:12px;">Notes</p>
                            <p style="font-size:14px;">${order.notes}</p>
                        </div>
                    ` : ''}
                </div>
            </div>

            <div class="flex gap-1 mt-2">
                <button class="btn btn-primary" onclick="AdminOrders.hideOrderDetail(); AdminOrders.showUpdateModal('${order.id}')">
                    Update Status
                </button>
                <button class="btn btn-ghost" onclick="AdminOrders.hideOrderDetail()">Close</button>
            </div>
        `;

        detailModal.classList.add('active');
    },

    hideOrderDetail() {
        const modal = document.getElementById('orderDetailModal');
        if (modal) modal.classList.remove('active');
    }
};

document.addEventListener('DOMContentLoaded', () => AdminOrders.init());
