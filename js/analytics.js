// js/analytics.js

document.addEventListener('DOMContentLoaded', async () => {
    await Auth.init();
    setupOTPInputs();
    setupUserDropdown();
    
    if (!Auth.requireAuth()) return;
    
    loadAnalytics();
});

async function loadAnalytics() {
    const container = document.getElementById('analyticsPage');
    container.innerHTML = `<div class="page-loader"><div class="loading-spinner"></div></div>`;
    
    const data = await DB.getUserAnalytics(Auth.getUserId());
    const orders = data.orders || [];
    const settlements = data.settlements || [];
    
    // Calculate analytics
    let totalRevenue = 0, totalProfit = 0, totalOrders = orders.length;
    let deliveredOrders = 0, cancelledOrders = 0, pendingOrders = 0;
    let monthlyData = {};
    
    orders.forEach(o => {
        totalRevenue += parseFloat(o.total_amount) || 0;
        totalProfit += parseFloat(o.total_margin) || 0;
        
        if (o.order_status === 'delivered') deliveredOrders++;
        else if (['cancelled', 'rto_completed', 'returned'].includes(o.order_status)) cancelledOrders++;
        else pendingOrders++;
        
        const month = new Date(o.created_at).toLocaleString('en', { month: 'short' });
        if (!monthlyData[month]) monthlyData[month] = { revenue: 0, profit: 0, orders: 0 };
        monthlyData[month].revenue += parseFloat(o.total_amount) || 0;
        monthlyData[month].profit += parseFloat(o.total_margin) || 0;
        monthlyData[month].orders++;
    });
    
    const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;
    const profitMarginPercent = totalRevenue > 0 ? (totalProfit / totalRevenue * 100).toFixed(1) : 0;
    
    const maxRevenue = Math.max(...Object.values(monthlyData).map(d => d.revenue), 1);
    
    container.innerHTML = `
        <div class="container">
            <div class="page-header"><h1>My Analytics</h1></div>
            
            <div class="stats-grid">
                <div class="stat-card">
                    <div class="stat-icon purple">📊</div>
                    <div class="stat-info">
                        <h3>Total Revenue</h3>
                        <div class="stat-value">${formatCurrency(totalRevenue)}</div>
                    </div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon green">💰</div>
                    <div class="stat-info">
                        <h3>Total Profit</h3>
                        <div class="stat-value">${formatCurrency(totalProfit)}</div>
                        <div class="stat-change positive">${profitMarginPercent}% margin</div>
                    </div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon blue">📦</div>
                    <div class="stat-info">
                        <h3>Total Orders</h3>
                        <div class="stat-value">${totalOrders}</div>
                    </div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon orange">📈</div>
                    <div class="stat-info">
                        <h3>Avg Order Value</h3>
                        <div class="stat-value">${formatCurrency(avgOrderValue)}</div>
                    </div>
                </div>
            </div>
            
            <div class="stats-grid" style="grid-template-columns:repeat(3,1fr);">
                <div class="stat-card">
                    <div class="stat-icon green">✅</div>
                    <div class="stat-info">
                        <h3>Delivered</h3>
                        <div class="stat-value">${deliveredOrders}</div>
                    </div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon orange">⏳</div>
                    <div class="stat-info">
                        <h3>In Progress</h3>
                        <div class="stat-value">${pendingOrders}</div>
                    </div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon red">❌</div>
                    <div class="stat-info">
                        <h3>Cancelled/RTO</h3>
                        <div class="stat-value">${cancelledOrders}</div>
                    </div>
                </div>
            </div>
            
            <div class="analytics-charts">
                <div class="chart-card">
                    <h3>Monthly Revenue</h3>
                    <div class="chart-placeholder">
                        ${Object.entries(monthlyData).map(([month, data]) => `
                            <div class="chart-bar-row">
                                <span class="bar-label">${month}</span>
                                <div class="bar-track">
                                    <div class="bar-fill purple" style="width:${(data.revenue / maxRevenue * 100)}%"></div>
                                </div>
                                <span class="bar-value">${formatCurrency(data.revenue)}</span>
                            </div>
                        `).join('') || '<p class="text-muted text-center">No data yet</p>'}
                    </div>
                </div>
                
                <div class="chart-card">
                    <h3>Monthly Profit</h3>
                    <div class="chart-placeholder">
                        ${Object.entries(monthlyData).map(([month, data]) => {
                            const maxProfit = Math.max(...Object.values(monthlyData).map(d => d.profit), 1);
                            return `
                                <div class="chart-bar-row">
                                    <span class="bar-label">${month}</span>
                                    <div class="bar-track">
                                        <div class="bar-fill green" style="width:${(data.profit / maxProfit * 100)}%"></div>
                                    </div>
                                    <span class="bar-value">${formatCurrency(data.profit)}</span>
                                </div>
                            `;
                        }).join('') || '<p class="text-muted text-center">No data yet</p>'}
                    </div>
                </div>
            </div>
        </div>
    `;
}
