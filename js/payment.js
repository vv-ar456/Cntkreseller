// js/payment.js

document.addEventListener('DOMContentLoaded', async () => {
    await Auth.init();
    setupOTPInputs();
    setupUserDropdown();
    
    if (!Auth.requireAuth()) return;
    
    loadPaymentPage();
});

async function loadPaymentPage() {
    const container = document.getElementById('paymentPage');
    container.innerHTML = `<div class="page-loader"><div class="loading-spinner"></div></div>`;
    
    const [summary, settlementsList] = await Promise.all([
        DB.getSettlementSummary(Auth.getUserId()),
        DB.getSettlements(Auth.getUserId())
    ]);
    
    const settlements = settlementsList.data || [];
    
    // Calculate next settlement date (15th or 30th of month)
    const now = new Date();
    let nextSettlement;
    if (now.getDate() <= 15) {
        nextSettlement = new Date(now.getFullYear(), now.getMonth(), 15);
    } else {
        nextSettlement = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    }
    
    container.innerHTML = `
        <div class="container">
            <div class="page-header"><h1>Payments & Settlements</h1></div>
            
            <div class="settlement-cards">
                <div class="settlement-card">
                    <div class="icon" style="background:var(--success-bg);color:var(--success);">💰</div>
                    <h4>Total Earnings</h4>
                    <div class="amount">${formatCurrency(summary.total)}</div>
                </div>
                <div class="settlement-card">
                    <div class="icon" style="background:var(--primary-bg);color:var(--primary);">✅</div>
                    <h4>Amount Settled</h4>
                    <div class="amount">${formatCurrency(summary.settled)}</div>
                </div>
                <div class="settlement-card">
                    <div class="icon" style="background:var(--warning-bg);color:var(--warning);">⏳</div>
                    <h4>Pending Settlement</h4>
                    <div class="amount">${formatCurrency(summary.pending + summary.eligible)}</div>
                    <div class="date">Next settlement: ${formatDate(nextSettlement)}</div>
                </div>
                <div class="settlement-card">
                    <div class="icon" style="background:var(--info-bg);color:var(--info);">📊</div>
                    <h4>Eligible for Settlement</h4>
                    <div class="amount">${formatCurrency(summary.eligible)}</div>
                    <div class="date">Updated after delivery</div>
                </div>
            </div>
            
            <div class="card">
                <div class="card-header">
                    <h2>Settlement History</h2>
                </div>
                
                ${settlements.length > 0 ? `
                    <div class="admin-table-container" style="border:none;">
                        <table class="admin-table">
                            <thead>
                                <tr>
                                    <th>Order</th>
                                    <th>Margin Amount</th>
                                    <th>Status</th>
                                    <th>Date</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${settlements.map(s => `
                                    <tr>
                                        <td>${s.orders?.order_number || '-'}</td>
                                        <td><strong>${formatCurrency(s.margin_amount)}</strong></td>
                                        <td>
                                            <span class="tag ${
                                                s.status === 'settled' ? 'tag-success' :
                                                s.status === 'eligible' ? 'tag-info' :
                                                s.status === 'cancelled' ? 'tag-danger' :
                                                'tag-warning'
                                            }">${s.status}</span>
                                        </td>
                                        <td>${s.settled_at ? formatDate(s.settled_at) : formatDate(s.created_at)}</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                ` : '<p class="text-muted text-center" style="padding:40px;">No settlements yet. Margin will appear here after successful orders.</p>'}
            </div>
        </div>
    `;
}
