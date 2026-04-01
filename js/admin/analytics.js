// js/admin/analytics.js

const AdminAnalytics = {
    async init() {
        if (!AdminAuth.requireAuth()) return;
        await this.loadAnalytics();
    },

    async loadAnalytics() {
        const container = document.getElementById('analyticsContent');
        if (!container) return;

        container.innerHTML = `<div class="page-loader"><div class="loading-spinner"></div></div>`;

        try {
            const data = await DB.getAdminAnalytics();
            const orders = data.orders || [];
            const users = data.users || [];
            const products = data.products || [];
            const settlements = data.settlements || [];

            // Core metrics
            const totalRevenue = orders.reduce((s, o) => s + (parseFloat(o.total_amount) || 0), 0);
            const totalMargin = orders.reduce((s, o) => s + (parseFloat(o.total_margin) || 0), 0);
            const paidOrders = orders.filter(o => o.payment_status === 'paid');
            const deliveredOrders = orders.filter(o => o.order_status === 'delivered');
            const cancelledOrders = orders.filter(o => ['cancelled', 'rto_completed', 'returned'].includes(o.order_status));
            const rtoOrders = orders.filter(o => ['rto_initiated', 'rto_completed'].includes(o.order_status));
            const activeProducts = products.filter(p => p.is_active);
            const outOfStock = products.filter(p => p.stock <= 0);

            const avgOrderValue = orders.length > 0 ? totalRevenue / orders.length : 0;
            const avgMarginPerOrder = orders.length > 0 ? totalMargin / orders.length : 0;
            const deliveryRate = orders.length > 0 ? (deliveredOrders.length / orders.length * 100) : 0;
            const cancellationRate = orders.length > 0 ? (cancelledOrders.length / orders.length * 100) : 0;
            const rtoRate = orders.length > 0 ? (rtoOrders.length / orders.length * 100) : 0;

            const totalSettled = settlements.filter(s => s.status === 'settled').reduce((s, x) => s + parseFloat(x.margin_amount), 0);
            const totalPendingSettle = settlements.filter(s => ['pending', 'eligible', 'processing'].includes(s.status)).reduce((s, x) => s + parseFloat(x.margin_amount), 0);

            // Monthly breakdowns
            const monthlyRevenue = this.getMonthlyBreakdown(orders, 'total_amount');
            const monthlyOrders = this.getMonthlyCount(orders);
            const monthlyMargin = this.getMonthlyBreakdown(orders, 'total_margin');
            const monthlyUsers = this.getMonthlyCount(users);

            // Top performers (by margin)
            const userMargins = {};
            orders.forEach(o => {
                if (!userMargins[o.user_id]) userMargins[o.user_id] = { total: 0, orders: 0 };
                userMargins[o.user_id].total += parseFloat(o.total_margin) || 0;
                userMargins[o.user_id].orders++;
            });

            // Day of week analysis
            const dayOfWeekOrders = [0, 0, 0, 0, 0, 0, 0];
            const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
            orders.forEach(o => {
                const day = new Date(o.created_at).getDay();
                dayOfWeekOrders[day]++;
            });

            container.innerHTML = `
                <div class="admin-header">
                    <h1>Website Analytics</h1>
                    <button class="btn btn-ghost btn-sm" onclick="AdminAnalytics.loadAnalytics()">🔄 Refresh</button>
                </div>

                <!-- Key Metrics -->
                <div class="stats-grid">
                    <div class="stat-card">
                        <div class="stat-icon purple">💰</div>
                        <div class="stat-info">
                            <h3>Total Revenue</h3>
                            <div class="stat-value">${formatCurrency(totalRevenue)}</div>
                        </div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-icon green">📊</div>
                        <div class="stat-info">
                            <h3>Total Margins</h3>
                            <div class="stat-value">${formatCurrency(totalMargin)}</div>
                            <div class="stat-change">${formatCurrency(totalSettled)} settled</div>
                        </div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-icon blue">📦</div>
                        <div class="stat-info">
                            <h3>Total Orders</h3>
                            <div class="stat-value">${orders.length}</div>
                            <div class="stat-change positive">${paidOrders.length} paid</div>
                        </div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-icon orange">👥</div>
                        <div class="stat-info">
                            <h3>Total Resellers</h3>
                            <div class="stat-value">${users.length}</div>
                        </div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-icon green">✅</div>
                        <div class="stat-info">
                            <h3>Delivery Rate</h3>
                            <div class="stat-value">${deliveryRate.toFixed(1)}%</div>
                            <div class="stat-change positive">${deliveredOrders.length} delivered</div>
                        </div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-icon red">🔄</div>
                        <div class="stat-info">
                            <h3>RTO/Cancel Rate</h3>
                            <div class="stat-value">${(cancellationRate + rtoRate).toFixed(1)}%</div>
                            <div class="stat-change negative">${cancelledOrders.length + rtoOrders.length} orders</div>
                        </div>
                    </div>
                </div>

                <!-- Detailed Metrics -->
                <div class="card mb-2">
                    <div class="card-header"><h2>Key Performance Indicators</h2></div>
                    <div class="stats-grid" style="margin-bottom:0;">
                        <div class="stat-card" style="padding:14px;">
                            <div class="stat-info">
                                <h3>Average Order Value</h3>
                                <div class="stat-value" style="font-size:20px;">${formatCurrency(avgOrderValue)}</div>
                            </div>
                        </div>
                        <div class="stat-card" style="padding:14px;">
                            <div class="stat-info">
                                <h3>Avg Margin/Order</h3>
                                <div class="stat-value text-success" style="font-size:20px;">${formatCurrency(avgMarginPerOrder)}</div>
                            </div>
                        </div>
                        <div class="stat-card" style="padding:14px;">
                            <div class="stat-info">
                                <h3>Active Products</h3>
                                <div class="stat-value" style="font-size:20px;">${activeProducts.length}</div>
                            </div>
                        </div>
                        <div class="stat-card" style="padding:14px;">
                            <div class="stat-info">
                                <h3>Out of Stock</h3>
                                <div class="stat-value text-danger" style="font-size:20px;">${outOfStock.length}</div>
                            </div>
                        </div>
                        <div class="stat-card" style="padding:14px;">
                            <div class="stat-info">
                                <h3>Pending Settlements</h3>
                                <div class="stat-value" style="font-size:20px;">${formatCurrency(totalPendingSettle)}</div>
                            </div>
                        </div>
                        <div class="stat-card" style="padding:14px;">
                            <div class="stat-info">
                                <h3>Revenue per User</h3>
                                <div class="stat-value" style="font-size:20px;">${formatCurrency(users.length > 0 ? totalRevenue / users.length : 0)}</div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Charts -->
                <div class="analytics-charts">
                    ${this.renderBarChart('Monthly Revenue', monthlyRevenue, 'purple', true)}
                    ${this.renderBarChart('Monthly Orders', monthlyOrders, 'green', false)}
                    ${this.renderBarChart('Monthly Margins', monthlyMargin, 'orange', true)}
                    ${this.renderBarChart('New Users/Month', monthlyUsers, 'blue', false)}
                </div>

                <!-- Day of Week -->
                <div class="card mb-2">
                    <div class="card-header"><h2>Orders by Day of Week</h2></div>
                    <div class="chart-placeholder">
                        ${dayOfWeekOrders.map((count, i) => {
                            const maxDay = Math.max(...dayOfWeekOrders, 1);
                            return `
                                <div class="chart-bar-row">
                                    <span class="bar-label">${dayNames[i]}</span>
                                    <div class="bar-track">
                                        <div class="bar-fill purple" style="width:${(count / maxDay * 100)}%"></div>
                                    </div>
                                    <span class="bar-value">${count}</span>
                                </div>
                            `;
                        }).join('')}
                    </div>
                </div>

                <!-- Order Status Distribution -->
                <div class="card">
                    <div class="card-header"><h2>Order Status Distribution</h2></div>
                    <div class="chart-placeholder">
                        ${(() => {
                            const statusCounts = {};
                            orders.forEach(o => {
                                statusCounts[o.order_status] = (statusCounts[o.order_status] || 0) + 1;
                            });
                            const maxStatus = Math.max(...Object.values(statusCounts), 1);
                            const statusColors = {
                                placed: 'purple', confirmed: 'purple', processing: 'orange',
                                shipped: 'purple', out_for_delivery: 'orange', delivered: 'green',
                                cancelled: 'orange', rto_initiated: 'orange', rto_completed: 'orange', returned: 'orange'
                            };
                            return Object.entries(statusCounts)
                                .sort((a, b) => b[1] - a[1])
                                .map(([status, count]) => `
                                    <div class="chart-bar-row">
                                        <span class="bar-label" style="width:100px;">${status.replace(/_/g, ' ')}</span>
                                        <div class="bar-track">
                                            <div class="bar-fill ${statusColors[status] || 'purple'}" style="width:${(count / maxStatus * 100)}%"></div>
                                        </div>
                                        <span class="bar-value">${count}</span>
                                    </div>
                                `).join('');
                        })()}
                    </div>
                </div>
            `;

        } catch (err) {
            console.error('Analytics error:', err);
            container.innerHTML = `
                <div class="empty-state">
                    <h3>Failed to load analytics</h3>
                    <p>${err.message}</p>
                    <button class="btn btn-primary" onclick="AdminAnalytics.loadAnalytics()">Retry</button>
                </div>
            `;
        }
    },

    getMonthlyBreakdown(items, amountField) {
        const monthly = {};
        items.forEach(item => {
            const month = new Date(item.created_at).toLocaleString('en', { month: 'short', year: '2-digit' });
            monthly[month] = (monthly[month] || 0) + (parseFloat(item[amountField]) || 0);
        });
        return Object.entries(monthly).slice(-8);
    },

    getMonthlyCount(items) {
        const monthly = {};
        items.forEach(item => {
            const month = new Date(item.created_at).toLocaleString('en', { month: 'short', year: '2-digit' });
            monthly[month] = (monthly[month] || 0) + 1;
        });
        return Object.entries(monthly).slice(-8);
    },

    renderBarChart(title, entries, colorClass, isCurrency) {
        if (!entries || entries.length === 0) {
            return `
                <div class="chart-card">
                    <h3>${title}</h3>
                    <p class="text-muted text-center" style="padding:40px;">No data yet</p>
                </div>
            `;
        }

        const maxVal = Math.max(...entries.map(([, v]) => v), 1);

        return `
            <div class="chart-card">
                <h3>${title}</h3>
                <div class="chart-placeholder">
                    ${entries.map(([label, value]) => `
                        <div class="chart-bar-row">
                            <span class="bar-label">${label}</span>
                            <div class="bar-track">
                                <div class="bar-fill ${colorClass}" style="width:${(value / maxVal * 100)}%"></div>
                            </div>
                            <span class="bar-value">${isCurrency ? formatCurrency(value) : value}</span>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }
};

document.addEventListener('DOMContentLoaded', () => AdminAnalytics.init());
