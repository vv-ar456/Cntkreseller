// js/admin/admin-auth.js

const AdminAuth = {
    isAuthenticated() {
        return sessionStorage.getItem('adminAuth') === 'true';
    },

    requireAuth() {
        if (!this.isAuthenticated()) {
            window.location.href = 'index.html';
            return false;
        }
        return true;
    },

    logout() {
        sessionStorage.removeItem('adminAuth');
        window.location.href = 'index.html';
    },

    async login(password) {
        const { data, error } = await DB.getAdminConfig('admin_password');

        if (error) {
            return { success: false, error: 'Failed to verify. Try again.' };
        }

        if (data && data.value === password) {
            sessionStorage.setItem('adminAuth', 'true');
            return { success: true };
        }

        return { success: false, error: 'Invalid password' };
    },

    async changePassword(currentPassword, newPassword) {
        const { data } = await DB.getAdminConfig('admin_password');

        if (!data || data.value !== currentPassword) {
            return { success: false, error: 'Current password is incorrect' };
        }

        const { error } = await supabase
            .from('admin_config')
            .update({ value: newPassword, updated_at: new Date().toISOString() })
            .eq('key', 'admin_password');

        if (error) {
            return { success: false, error: 'Failed to update password' };
        }

        return { success: true };
    },

    // Render admin sidebar
    renderSidebar(activePage) {
        const pages = [
            { id: 'dashboard', icon: '📊', label: 'Dashboard', href: 'dashboard.html' },
            { id: 'products', icon: '📦', label: 'Products', href: 'products.html' },
            { id: 'categories', icon: '📂', label: 'Categories', href: 'categories.html' },
            { id: 'orders', icon: '🛍️', label: 'Orders', href: 'orders.html' },
            { id: 'settlements', icon: '💰', label: 'Settlements', href: 'settlements.html' },
            { id: 'users', icon: '👥', label: 'Users', href: 'users.html' },
            { id: 'analytics', icon: '📈', label: 'Analytics', href: 'analytics.html' },
            { id: 'settings', icon: '⚙️', label: 'Settings', href: 'settings.html' }
        ];

        return `
            <aside class="admin-sidebar" id="adminSidebar">
                <div class="sidebar-logo">
                    <h2>Conitek</h2>
                    <span>Admin Panel</span>
                </div>
                ${pages.map(p => `
                    <a href="${p.href}" class="nav-item ${activePage === p.id ? 'active' : ''}">
                        <span class="nav-icon">${p.icon}</span> ${p.label}
                    </a>
                `).join('')}
                <div style="margin-top:auto; padding:16px 24px; border-top:1px solid rgba(255,255,255,0.1);">
                    <a href="../" class="nav-item" target="_blank">
                        <span class="nav-icon">🏠</span> View Store
                    </a>
                    <button class="nav-item" onclick="AdminAuth.logout()">
                        <span class="nav-icon">🚪</span> Logout
                    </button>
                </div>
            </aside>
        `;
    },

    // Mobile sidebar toggle
    setupMobileSidebar() {
        const toggleBtn = document.getElementById('sidebarToggle');
        const sidebar = document.getElementById('adminSidebar');
        const overlay = document.getElementById('sidebarOverlay');

        if (toggleBtn && sidebar) {
            toggleBtn.addEventListener('click', () => {
                sidebar.classList.toggle('mobile-open');
                if (overlay) overlay.classList.toggle('active');
            });

            if (overlay) {
                overlay.addEventListener('click', () => {
                    sidebar.classList.remove('mobile-open');
                    overlay.classList.remove('active');
                });
            }
        }
    }
};
