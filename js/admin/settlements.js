// js/admin/settlements.js

const AdminSettlements = {
    allSettlements: [],
    currentFilter: '',

    async init() {
        if (!AdminAuth.requireAuth()) return;
        await this.loadSettlements();
        this.setupEventListeners();
    },

    setupEventListeners() {
        const filter = document.getElementById('settlementFilter');
        if (filter) {
            filter.addEventListener('change', () => {
                this.currentFilter = filter.value;
                this.renderSettlements();
            });
        }
    },

    async loadSettlements() {
        const container = document.getElementById('settlementsContent');
        if (!container) return;

        container.innerHTML = `<div class="page-loader"><div class="loading-spinner"></div></div>`;

        const { data, error } = await DB.getAllSettlements();

        if (error) {
            container.innerHTML = `<div class="empty-state"><h3>Failed to load</h3><button class="btn btn-primary" onclick="AdminSettlements.loadSettlements()">Retry</button></div>`;
            return;
        }

        this.allSettlements = data || [];
        this.renderSettlements();
    },

    renderSettlements() {
        const container = document.getElementById('settlementsContent');
        if (!container) return;

        const all = this.allSettlements;
        const filtered = this.currentFilter
            ? all.filter(s => s.status === this.currentFilter)
            : all;

        // Calculate totals
        const totals = { pending: 0, eligible: 0, processing: 0, settled: 0, cancelled: 0 };
        all.forEach(s => {
            if (totals.hasOwnProperty(s.status)) {
                totals[s.status] += parseFloat(s.margin_amount) || 0;
            }
        });

        const totalPending = totals.pending + totals.eligible + totals.processing;

        container.innerHTML = `
            <!-- Summary Cards -->
            <div class="settlement-cards mb-2">
                <div class="settlement-card" onclick="AdminSettlements.setFilter('pending')" style="cursor:pointer;">
                    <div class="icon" style="background:var(--warning-bg);color:var(--warning);">⏳</div>
                    <h4>Pending (Awaiting Delivery)</h4>
                    <div class="amount">${formatCurrency(totals.pending)}</div>
                    <div class="date">${all.filter(s => s.status === 'pending').length} settlements</div>
                </div>
                <div class="settlement-card" onclick="AdminSettlements.setFilter('eligible')" style="cursor:pointer;">
                    <div class="icon" style="background:var(--info-bg);color:var(--info);">✅</div>
                    <h4>Eligible (Ready to Settle)</h4>
                    <div class="amount">${formatCurrency(totals.eligible)}</div>
                    <div class="date">${all.filter(s => s.status === 'eligible').length} settlements</div>
                </div>
                <div class="settlement-card" onclick="AdminSettlements.setFilter('processing')" style="cursor:pointer;">
                    <div class="icon" style="background:var(--primary-bg);color:var(--primary);">🔄</div>
                    <h4>Processing</h4>
                    <div class="amount">${formatCurrency(totals.processing)}</div>
                    <div class="date">${all.filter(s => s.status === 'processing').length} settlements</div>
                </div>
                <div class="settlement-card" onclick="AdminSettlements.setFilter('settled')" style="cursor:pointer;">
                    <div class="icon" style="background:var(--success-bg);color:var(--success);">💰</div>
                    <h4>Settled</h4>
                    <div class="amount">${formatCurrency(totals.settled)}</div>
                    <div class="date">${all.filter(s => s.status === 'settled').length} settlements</div>
                </div>
            </div>

            <!-- Bulk Actions -->
            ${totals.eligible > 0 ? `
                <div class="card mb-2" style="background:var(--info-bg); border-color:var(--info);">
                    <div class="flex-between" style="flex-wrap:wrap;gap:12px;">
                        <div>
                            <strong>${formatCurrency(totals.eligible)}</strong> eligible for settlement 
                            (${all.filter(s => s.status === 'eligible').length} items)
                        </div>
                        <button class="btn btn-primary btn-sm" onclick="AdminSettlements.bulkProcess()">
                            Process All Eligible →
                        </button>
                    </div>
                </div>
            ` : ''}

            ${totals.processing > 0 ? `
                <div class="card mb-2" style="background:var(--primary-bg); border-color:var(--primary);">
                    <div class="flex-between" style="flex-wrap:wrap;gap:12px;">
                        <div>
                            <strong>${formatCurrency(totals.processing)}</strong> being processed 
                            (${all.filter(s => s.status === 'processing').length} items)
                        </div>
                        <button class="btn btn-success btn-sm" onclick="AdminSettlements.bulkSettle()">
                            Mark All as Settled ✓
                        </button>
                    </div>
                </div>
            ` : ''}

            <!-- Filter Chips -->
            <div class="flex gap-1 mb-2" style="flex-wrap:wrap;">
                <button class="filter-chip ${!this.currentFilter ? 'active' : ''}" onclick="AdminSettlements.setFilter('')">
                    All (${all.length})
                </button>
                ${Object.entries(totals).map(([status, amount]) => {
                    const count = all.filter(s => s.status === status).length;
                    if (count === 0) return '';
                    return `
                        <button class="filter-chip ${this.currentFilter === status ? 'active' : ''}" 
                                onclick="AdminSettlements.setFilter('${status}')">
                            ${status} (${count})
                        </button>
                    `;
                }).join('')}
            </div>

            <!-- Table -->
            ${filtered.length > 0 ? `
                <div class="admin-table-container">
                    <table class="admin-table">
                        <thead>
                            <tr>
                                <th>Reseller</th>
                                <th>Order</th>
                                <th>Margin Amount</th>
                                <th>Status</th>
                                <th>Created</th>
                                <th>Settled At</th>
                                <th>Ref</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${filtered.map(s => `
                                <tr>
                                    <td>
                                        ${s.profiles?.full_name || '-'}
                                        <br><small class="text-muted">${s.profiles?.phone || ''}</small>
                                    </td>
                                    <td><strong>${s.orders?.order_number || '-'}</strong></td>
                                    <td><strong class="text-success">${formatCurrency(s.margin_amount)}</strong></td>
                                    <td>
                                        <span class="tag ${
                                            s.status === 'settled' ? 'tag-success' :
                                            s.status === 'eligible' ? 'tag-info' :
                                            s.status === 'processing' ? 'tag-primary' :
                                            s.status === 'cancelled' ? 'tag-danger' : 'tag-warning'
                                        }">${s.status}</span>
                                    </td>
                                    <td>${formatDate(s.created_at)}</td>
                                    <td>${s.settled_at ? formatDate(s.settled_at) : '-'}</td>
                                    <td><small>${s.transaction_ref || '-'}</small></td>
                                    <td>
                                        <div class="actions">
                                            ${s.status === 'pending' ? `
                                                <button class="view-btn" onclick="AdminSettlements.markEligible('${s.id}')">→ Eligible</button>
                                            ` : ''}
                                            ${s.status === 'eligible' ? `
                                                <button class="edit-btn" onclick="AdminSettlements.markProcessing('${s.id}')">Process</button>
                                            ` : ''}
                                            ${s.status === 'processing' ? `
                                                <button class="view-btn" onclick="AdminSettlements.markSettled('${s.id}')">Settle</button>
                                            ` : ''}
                                            ${['pending', 'eligible'].includes(s.status) ? `
                                                <button class="delete-btn" onclick="AdminSettlements.cancel('${s.id}')">Cancel</button>
                                            ` : ''}
                                        </div>
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            ` : `
                <div class="empty-state">
                    <div class="empty-icon">💰</div>
                    <h3>No settlements found</h3>
                </div>
            `}
        `;
    },

    setFilter(status) {
        this.currentFilter = status;
        const select = document.getElementById('settlementFilter');
        if (select) select.value = status;
        this.renderSettlements();
    },

    async markEligible(id) {
        await this.updateStatus(id, 'eligible');
    },

    async markProcessing(id) {
        await this.updateStatus(id, 'processing');
    },

    async markSettled(id) {
        const ref = prompt('Enter transaction reference number (optional):');
        const updates = {
            status: 'settled',
            settled_at: new Date().toISOString(),
            transaction_ref: ref || null
        };

        const { error } = await DB.updateSettlement(id, updates);
        if (error) {
            Toast.error('Failed: ' + error.message);
            return;
        }

        // Notify user
        const settlement = this.allSettlements.find(s => s.id === id);
        if (settlement) {
            await DB.createNotification({
                user_id: settlement.user_id,
                title: 'Settlement Completed! 💰',
                message: `${formatCurrency(settlement.margin_amount)} has been settled to your bank account.${ref ? ' Ref: ' + ref : ''}`,
                type: 'settlement'
            });
        }

        Toast.success('Settlement completed!');
        await this.loadSettlements();
    },

    async cancel(id) {
        if (!confirm('Cancel this settlement?')) return;
        await this.updateStatus(id, 'cancelled');
    },

    async updateStatus(id, status) {
        const { error } = await DB.updateSettlement(id, { status });
        if (error) {
            Toast.error('Failed: ' + error.message);
            return;
        }
        Toast.success(`Settlement marked as ${status}`);
        await this.loadSettlements();
    },

    async bulkProcess() {
        if (!confirm('Mark all eligible settlements as processing?')) return;

        const eligible = this.allSettlements.filter(s => s.status === 'eligible');
        let success = 0, failed = 0;

        for (const s of eligible) {
            const { error } = await DB.updateSettlement(s.id, { status: 'processing' });
            if (error) failed++;
            else success++;
        }

        Toast.success(`${success} settlements moved to processing${failed > 0 ? `, ${failed} failed` : ''}`);
        await this.loadSettlements();
    },

    async bulkSettle() {
        const ref = prompt('Enter bulk transaction reference (optional):');
        if (ref === null) return; // Cancelled prompt
        
        if (!confirm('Mark all processing settlements as settled?')) return;

        const processing = this.allSettlements.filter(s => s.status === 'processing');
        let success = 0, failed = 0;

        for (const s of processing) {
            const { error } = await DB.updateSettlement(s.id, {
                status: 'settled',
                settled_at: new Date().toISOString(),
                transaction_ref: ref || null
            });

            if (error) {
                failed++;
            } else {
                success++;
                // Notify user
                await DB.createNotification({
                    user_id: s.user_id,
                    title: 'Settlement Completed! 💰',
                    message: `${formatCurrency(s.margin_amount)} settled to your bank account.${ref ? ' Ref: ' + ref : ''}`,
                    type: 'settlement'
                });
            }
        }

        Toast.success(`${success} settlements completed${failed > 0 ? `, ${failed} failed` : ''}`);
        await this.loadSettlements();
    }
};

document.addEventListener('DOMContentLoaded', () => AdminSettlements.init());
