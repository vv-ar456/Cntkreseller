// js/orders.js

document.addEventListener('DOMContentLoaded', async () => {
    await Auth.init();
    setupOTPInputs();
    setupUserDropdown();
    
    if (!Auth.requireAuth()) return;
    
    const params = new URLSearchParams(window.location.search);
    const orderId = params.get('id');
    
    if (orderId) {
        loadOrderDetail(orderId);
    } else {
        loadOrders();
    }
});

async function loadOrders() {
    const container = document.getElementById('ordersPage');
    container.innerHTML = `<div class="page-loader"><div class="loading-spinner"></div></div>`;
    
    const { data: orders, error } = await DB.getOrders(Auth.getUserId());
    
    if (!orders || orders.length === 0) {
        container.innerHTML = `
            <div class="container">
                <div class="page-header"><h1>My Orders</h1></div>
                <div class="empty-state">
                    <div class="empty-icon">📦</div>
                    <h3>No orders yet</h3>
                    <p>Start reselling to see your orders here!</p>
                    <a href="/" class="btn btn-primary">Browse Products</a>
                </div>
            </div>
        `;
        return;
    }
    
    container.innerHTML = `
        <div class="container">
            <div class="page-header"><h1>My Orders (${orders.length})</h1></div>
            
            ${orders.map(order => `
                <div class="order-card" onclick="window.location.href='orders.html?id=${order.id}'" style="cursor:pointer;">
                    <div class="order-card-header">
                        <div>
                            <div class="order-number">#${order.order_number}</div>
                            <div class="order-date">${formatDateTime(order.created_at)}</div>
                        </div>
                        <span class="order-status-badge ${order.order_status}">${order.order_status.replace(/_/g, ' ')}</span>
                    </div>
                    <div class="order-items-list">
                        ${(order.order_items || []).slice(0, 3).map(item => `
                            <div class="order-item-row">
                                <div class="item-thumb">
                                    <img src="${item.product_thumbnail || placeholderImage('')}" alt="">
                                </div>
                                <div class="item-info">
                                    <div class="item-name">${item.product_name}</div>
                                    <div class="item-qty">Qty: ${item.quantity}</div>
                                </div>
                                <div class="item-price">${formatCurrency(item.total_price)}</div>
                            </div>
                        `).join('')}
                        ${order.order_items?.length > 3 ? `<p class="text-muted" style="padding:8px 0;font-size:13px;">+${order.order_items.length - 3} more items</p>` : ''}
                    </div>
                    <div class="order-card-footer">
                        <div class="total-amount">
                            <span>Total: </span>${formatCurrency(order.total_amount)}
                        </div>
                        ${order.total_margin > 0 ? `
                            <span class="tag tag-success">💰 Margin: ${formatCurrency(order.total_margin)}</span>
                        ` : ''}
                    </div>
                </div>
            `).join('')}
        </div>
    `;
}

async function loadOrderDetail(orderId) {
    const container = document.getElementById('ordersPage');
    container.innerHTML = `<div class="page-loader"><div class="loading-spinner"></div></div>`;
    
    const { data: order, error } = await DB.getOrder(orderId);
    
    if (!order) {
        container.innerHTML = `
            <div class="container">
                <div class="empty-state">
                    <h3>Order not found</h3>
                    <a href="orders.html" class="btn btn-primary">View All Orders</a>
                </div>
            </div>
        `;
        return;
    }
    
    const statuses = ['placed', 'confirmed', 'processing', 'shipped', 'out_for_delivery', 'delivered'];
    const statusLabels = {
        placed: 'Order Placed', confirmed: 'Confirmed', processing: 'Processing',
        shipped: 'Shipped', out_for_delivery: 'Out for Delivery', delivered: 'Delivered',
        cancelled: 'Cancelled', rto_initiated: 'RTO Initiated', rto_completed: 'RTO Completed', returned: 'Returned'
    };
    
    const currentStatusIdx = statuses.indexOf(order.order_status);
    const isCancelled = ['cancelled', 'rto_initiated', 'rto_completed', 'returned'].includes(order.order_status);
    
    container.innerHTML = `
        <div class="container">
            <button class="back-btn" onclick="window.location.href='orders.html'">← All Orders</button>
            
            <div class="page-header">
                <h1>Order #${order.order_number}</h1>
                <span class="order-status-badge ${order.order_status}">${statusLabels[order.order_status] || order.order_status}</span>
            </div>
            
            <!-- Tracking Timeline -->
            ${!isCancelled ? `
                <div class="card mb-2">
                    <div class="card-header">
                        <h3>Order Tracking</h3>
                        ${order.tracking_number ? `<span class="text-muted" style="font-size:13px;">Tracking: ${order.tracking_number}</span>` : ''}
                    </div>
                    <div class="order-tracking">
                        <div class="tracking-timeline">
                            ${statuses.map((status, idx) => {
                                let stepClass = '';
                                if (idx < currentStatusIdx) stepClass = 'completed';
                                else if (idx === currentStatusIdx) stepClass = 'active';
                                
                                let dateStr = '';
                                if (status === 'placed') dateStr = formatDateTime(order.created_at);
                                if (status === 'shipped') dateStr = formatDateTime(order.shipped_at);
                                if (status === 'delivered') dateStr = formatDateTime(order.delivered_at);
                                
                                return `
                                    <div class="tracking-step ${stepClass}">
                                        <div class="step-dot"></div>
                                        <div class="step-title">${statusLabels[status]}</div>
                                        ${dateStr ? `<div class="step-date">${dateStr}</div>` : ''}
                                    </div>
                                `;
                            }).join('')}
                        </div>
                    </div>
                </div>
            ` : `
                <div class="card mb-2" style="border-color: var(--danger);">
                    <div class="flex gap-1" style="align-items:center; padding:8px;">
                        <span style="font-size:24px;">❌</span>
                        <div>
                            <strong>${statusLabels[order.order_status]}</strong>
                            <p class="text-muted" style="font-size:13px;">${order.cancelled_at ? formatDateTime(order.cancelled_at) : ''}</p>
                        </div>
                    </div>
                </div>
            `}
            
            <!-- Order Items -->
            <div class="card mb-2">
                <div class="card-header">
                    <h3>Items</h3>
                </div>
                ${(order.order_items || []).map(item => `
                    <div class="order-item-row">
                        <div class="item-thumb">
                            <img src="${item.product_thumbnail || placeholderImage('')}" alt="">
                        </div>
                        <div class="item-info">
                            <div class="item-name">${item.product_name}</div>
                            <div class="item-qty">Qty: ${item.quantity} • MRP: ${formatCurrency(item.mrp)} ${item.margin_amount > 0 ? `• Margin: +₹${item.margin_amount}` : ''}</div>
                        </div>
                        <div class="item-price">${formatCurrency(item.total_price)}</div>
                    </div>
                `).join('')}
            </div>
            
            <!-- Summary -->
            <div class="card mb-2" style="max-width:400px;">
                <h3 class="mb-2">Payment Summary</h3>
                <div class="summary-row">
                    <span>Subtotal</span>
                    <span class="value">${formatCurrency(order.subtotal)}</span>
                </div>
                ${order.total_margin > 0 ? `
                    <div class="summary-row margin">
                        <span>Your Margin</span>
                        <span class="value">+${formatCurrency(order.total_margin)}</span>
                    </div>
                ` : ''}
                <div class="summary-row">
                    <span>Shipping</span>
                    <span class="value">${order.shipping_cost > 0 ? formatCurrency(order.shipping_cost) : 'FREE'}</span>
                </div>
                <div class="summary-row total">
                    <span>Total Paid</span>
                    <span class="value">${formatCurrency(order.total_amount)}</span>
                </div>
                <div class="summary-row">
                    <span>Payment</span>
                    <span class="tag tag-success">${order.payment_status}</span>
                </div>
            </div>
            
            <!-- Shipping Address -->
            <div class="card" style="max-width:400px;">
                <h3 class="mb-1">Shipping Address</h3>
                <p><strong>${order.shipping_address?.full_name}</strong></p>
                <p class="text-muted" style="font-size:14px;">
                    ${order.shipping_address?.address_line1}${order.shipping_address?.address_line2 ? ', ' + order.shipping_address.address_line2 : ''}<br>
                    ${order.shipping_address?.city}, ${order.shipping_address?.state} - ${order.shipping_address?.pincode}<br>
                    📞 ${order.shipping_address?.phone}
                </p>
            </div>
        </div>
    `;
}
