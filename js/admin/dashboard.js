// js/admin/dashboard.js

const AdminDashboard = {
    async init() {
        if (!AdminAuth.requireAuth()) return;
        await this.loadDashboard();
    },

    async loadDashboard() {
        const container = document.getElementById('dashboardContent');
        if (!container) return;

        container.innerHTML = `<div class="page-loader"><div class="loading-spinner"></div></div>`;

        try {
            const analytics = await DB.getAdminAnalytics();
            const recentOrders = await DB.getAllOrders({ limit: 10 });

            const orders = analytics.orders || [];
            const users = analytics.users || [];
            const products = analytics.products || [];
            const settlements = analytics.settlements || [];

            // Calculate stats
            const totalRevenue = orders.reduce((sum, o) => sum + (parseFloat(o.total_amount) || 0), 0);
            const totalOrders = orders.length;
            const totalUsers = users.length;
            const activeProducts = products.filter(p => p.is_active).length;
            const totalStock = products.reduce((sum, p) => sum + (p.stock || 0), 0);
            const lowStockProducts = products.filter(p => p.stock > 0 && p.stock <= 5).length;
            const outOfStockProducts = products.filter(p => p.stock <= 0).length;
            const paidOrders = orders.filter(o => o.payment_status === 'paid').length;
            const deliveredOrders = orders.filter(o => o.order_status === 'delivered').length;
            const pendingOrders = orders.filter(o => !['delivered', 'cancelled', 'rto_completed', 'returned'].includes(o.order_status)).length;

            const pendingSettlementAmount = settlements
                .filter(s => s.status === 'eligible' || s.status === 'pending')
                .reduce((sum, s) => sum + parseFloat(s.margin_amount), 0);

            const settledAmount = settlements
                .filter(s => s.status === 'settled')
                .reduce((sum, s) => sum + parseFloat(s.margin_amount), 0);

            const totalMarginGenerated = orders.reduce((sum, o) => sum + (parseFloat(o.total_margin) || 0), 0);

            // Order status breakdown
            const statusCounts = {};
            orders.forEach(o => {
                const label = o.order_status.replace(/_/g, ' ');
                statusCounts[o.order_status] = (statusCounts[o.order_status] || 0) + 1;
            });

            // Today's stats
            const today = new Date().toISOString().split('T')[0];
            const todayOrders = orders.filter(o => o.created_at?.startsWith(today));
            const todayRevenue = todayOrders.reduce((sum, o) => sum + (parseFloat(o.total_amount) || 0), 0);

            // This month stats
            const thisMonth = new Date().toISOString().slice(0, 7);
            const monthOrders = orders.filter(o => o.created_at?.startsWith(thisMonth));
            const monthRevenue = monthOrders.reduce((sum, o) => sum + (parseFloat(o.total_amount) || 0), 0);

            // Recent user registrations (last 7 days)
            const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
            const newUsersThisWeek = users.filter(u => u.created_at >= weekAgo).length;

            container.innerHTML = `
                <div class="admin-header">
                    <div>
                        <h1>Dashboard</h1>
                        <p class="text-muted" style="margin-top:4px;">
                            ${new Date().toLocaleDateString('en-IN', { 
                                weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' 
                            })}
                        </p>
                    </div>
                    <div class="flex gap-1">
                        <button class="btn btn-ghost btn-sm" onclick="AdminDashboard.loadDashboard()">🔄 Refresh</button>
                    </div>
                </div>

                <!-- Today's Highlights -->
                <div class="card mb-2" style="background: linear-gradient(135deg, var(--primary) 0%, var(--primary-dark) 100%); color:white; border:none;">
                    <div class="flex-between" style="flex-wrap:wrap; gap:20px;">
                        <div>
                            <p style="opacity:0.8; font-size:14px;">Today's Revenue</p>
                            <h2 style="font-size:32px; font-weight:800;">${formatCurrency(todayRevenue)}</h2>
                            <p style="opacity:0.8; font-size:13px;">${todayOrders.length} orders today</p>
                        </div>
                        <div>
                            <p style="opacity:0.8; font-size:14px;">This Month</p>
                            <h2 style="font-size:32px; font-weight:800;">${formatCurrency(monthRevenue)}</h2>
                            <p style="opacity:0.8; font-size:13px;">${monthOrders.length} orders this month</p>
                        </div>
                        <div>
                            <p style="opacity:0.8; font-size:14px;">New Users (7 days)</p>
                            <h2 style="font-size:32px; font-weight:800;">${newUsersThisWeek}</h2>
                            <p style="opacity:0.8; font-size:13px;">${totalUsers} total resellers</p>
                        </div>
                    </div>
                </div>

                <!-- Primary Stats -->
                <div class="stats-grid">
                    <div class="stat-card">
                        <div class="stat-icon purple">💰</div>
                        <div class="stat-info">
                            <h3>Total Revenue</h3>
                            <div class="stat-value">${formatCurrency(totalRevenue)}</div>
                        </div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-icon blue">📦</div>
                        <div class="stat-info">
                            <h3>Total Orders</h3>
                            <div class="stat-value">${totalOrders}</div>
                            <div class="stat-change positive">${paidOrders} paid</div>
                        </div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-icon green">👥</div>
                        <div class="stat-info">
                            <h3>Total Resellers</h3>
                            <div class="stat-value">${totalUsers}</div>
                            <div class="stat-change positive">+${newUsersThisWeek} this week</div>
                        </div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-icon orange">📊</div>
                        <div class="stat-info">
                            <h3>Active Products</h3>
                            <div class="stat-value">${activeProducts}</div>
                            ${lowStockProducts > 0 ? `<div class="stat-change negative">${lowStockProducts} low stock</div>` : ''}
                        </div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-icon green">✅</div>
                        <div class="stat-info">
                            <h3>Delivered Orders</h3>
                            <div class="stat-value">${deliveredOrders}</div>
                            <div class="stat-change positive">${totalOrders > 0 ? (deliveredOrders / totalOrders * 100).toFixed(1) : 0}%</div>
                        </div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-icon red">⏳</div>
                        <div class="stat-info">
                            <h3>Pending Settlements</h3>
                            <div class="stat-value">${formatCurrency(pendingSettlementAmount)}</div>
                            <div class="stat-change">${formatCurrency(settledAmount)} settled</div>
                        </div>
                    </div>
                </div>

                <!-- Order Status Grid -->
                <div class="card mb-2">
                    <div class="card-header">
                        <h2>Order Status Overview</h2>
                        <a href="orders.html" class="btn btn-ghost btn-sm">Manage Orders →</a>
                    </div>
                    <div class="stats-grid" style="margin-bottom:0;">
                        ${Object.entries(statusCounts).length > 0 ?
                            Object.entries(statusCounts).map(([status, count]) => `
                                <div class="stat-card" style="padding:14px; cursor:pointer;" 
                                     onclick="window.location.href='orders.html?status=${status}'">
                                    <span class="order-status-badge ${status}" style="margin-right:12px;">
                                        ${status.replace(/_/g, ' ')}
                                    </span>
                                    <strong style="font-size:22px;">${count}</strong>
                                </div>
                            `).join('') :
                            '<p class="text-muted" style="padding:20px;">No orders yet</p>'
                        }
                    </div>
                </div>

                <!-- Alerts Section -->
                ${this.renderAlerts(outOfStockProducts, lowStockProducts, pendingOrders, pendingSettlementAmount)}

                <!-- Recent Orders Table -->
                <div class="card mb-2">
                    <div class="card-header">
                        <h2>Recent Orders</h2>
                        <a href="orders.html" class="btn btn-ghost btn-sm">View All →</a>
                    </div>
                    ${this.renderRecentOrdersTable(recentOrders.data || [])}
                </div>

                <!-- Quick Stats Charts -->
                <div class="analytics-charts">
                    ${this.renderRevenueChart(orders)}
                    ${this.renderMarginChart(orders)}
                </div>
            `;

        } catch (err) {
            console.error('Dashboard error:', err);
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">😔</div>
                    <h3>Failed to load dashboard</h3>
                    <p>${err.message}</p>
                    <button class="btn btn-primary" onclick="AdminDashboard.loadDashboard()">Retry</button>
                </div>
            `;
        }
    },

    renderAlerts(outOfStock, lowStock, pendingOrders, pendingSettlement) {
        const alerts = [];

        if (outOfStock > 0) {
            alerts.push({
                type: 'danger',
                icon: '🚨',
                message: `${outOfStock} product(s) are out of stock`,
                action: 'products.html'
            });
        }

        if (lowStock > 0) {
            alerts.push({
                type: 'warning',
                icon: '⚠️',
                message: `${lowStock} product(s) have low stock (≤5)`,
                action: 'products.html'
            });
        }

        if (pendingOrders > 5) {
            alerts.push({
                type: 'info',
                icon: '📋',
                message: `${pendingOrders} orders need attention`,
                action: 'orders.html'
            });
        }

        if (pendingSettlement > 1000) {
            alerts.push({
                type: 'warning',
                icon: '💰',
                message: `${formatCurrency(pendingSettlement)} in pending settlements`,
                action: 'settlements.html'
            });
        }

        if (alerts.length === 0) return '';

        return `
            <div class="card mb-2">
                <div class="card-header"><h2>⚡ Alerts</h2></div>
                ${alerts.map(a => `
                    <div style="display:flex; align-items:center; gap:12px; padding:12px 0; border-bottom:1px solid var(--gray-100);">
                        <span style="font-size:20px;">${a.icon}</span>
                        <span style="flex:1; font-size:14px;">${a.message}</span>
                        <a href="${a.action}" class="btn btn-ghost btn-sm">View →</a>
                    </div>
                `).join('')}
            </div>
        `;
    },

    renderRecentOrdersTable(orders) {
        if (!orders || orders.length === 0) {
            return '<p class="text-muted text-center" style="padding:30px;">No orders yet</p>';
        }

        return `
            <div class="admin-table-container" style="border:none;">
                <table class="admin-table">
                    <thead>
                        <tr>
                            <th>Order</th>
                            <th>Customer</th>
                            <th>Amount</th>
                            <th>Margin</th>
                            <th>Status</th>
                            <th>Payment</th>
                            <th>Date</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${orders.map(o => `
                            <tr style="cursor:pointer;" onclick="window.location.href='orders.html?id=${o.id}'">
                                <td><strong>${o.order_number}</strong></td>
                                <td>
                                    ${o.customer_name || o.profiles?.full_name || '-'}
                                    <br><small class="text-muted">${o.customer_phone || o.profiles?.phone || ''}</small>
                                </td>
                                <td><strong>${formatCurrency(o.total_amount)}</strong></td>
                                <td><span class="text-success fw-600">${formatCurrency(o.total_margin)}</span></td>
                                <td>
                                    <span class="order-status-badge ${o.order_status}">
                                        ${o.order_status.replace(/_/g, ' ')}
                                    </span>
                                </td>
                                <td>
                                    <span class="tag ${o.payment_status === 'paid' ? 'tag-success' : 
                                        o.payment_status === 'failed' ? 'tag-danger' : 'tag-warning'}">
                                        ${o.payment_status}
                                    </span>
                                </td>
                                <td>${formatDateTime(o.created_at)}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
    },

    renderRevenueChart(orders) {
        const monthlyData = {};
        orders.forEach(o => {
            const month = new Date(o.created_at).toLocaleString('en', { month: 'short', year: '2-digit' });
            if (!monthlyData[month]) monthlyData[month] = 0;
            monthlyData[month] += parseFloat(o.total_amount) || 0;
        });

        const entries = Object.entries(monthlyData).slice(-6);
        const maxVal = Math.max(...entries.map(([, v]) => v), 1);

        return `
            <div class="chart-card">
                <h3>Monthly Revenue (Last 6 months)</h3>
                <div class="chart-placeholder">
                    ${entries.length > 0 ? entries.map(([month, val]) => `
                        <div class="chart-bar-row">
                            <span class="bar-label">${month}</span>
                            <div class="bar-track">
                                <div class="bar-fill purple" style="width:${(val / maxVal * 100)}%"></div>
                            </div>
                            <span class="bar-value">${formatCurrency(val)}</span>
                        </div>
                    `).join('') : '<p class="text-muted text-center">No data yet</p>'}
                </div>
            </div>
        `;
    },

    renderMarginChart(orders) {
        const monthlyData = {};
        orders.forEach(o => {
            const month = new Date(o.created_at).toLocaleString('en', { month: 'short', year: '2-digit' });
            if (!monthlyData[month]) monthlyData[month] = 0;
            monthlyData[month] += parseFloat(o.total_margin) || 0;
        });

        const entries = Object.entries(monthlyData).slice(-6);
        const maxVal = Math.max(...entries.map(([, v]) => v), 1);

        return `
            <div class="chart-card">
                <h3>Monthly Margins Generated</h3>
                <div class="chart-placeholder">
                    ${entries.length > 0 ? entries.map(([month, val]) => `
                        <div class="chart-bar-row">
                            <span class="bar-label">${month}</span>
                            <div class="bar-track">
                                <div class="bar-fill green" style="width:${(val / maxVal * 100)}%"></div>
                            </div>
                            <span class="bar-value">${formatCurrency(val)}</span>
                        </div>
                    `).join('') : '<p class="text-muted text-center">No data yet</p>'}
                </div>
            </div>
        `;
    }
};

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => AdminDashboard.init());
