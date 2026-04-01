// js/notifications.js

document.addEventListener('DOMContentLoaded', async () => {
    await Auth.init();
    setupOTPInputs();
    setupUserDropdown();
    
    if (!Auth.requireAuth()) return;
    
    loadNotifications();
});

async function loadNotifications() {
    const container = document.getElementById('notificationsPage');
    container.innerHTML = `<div class="page-loader"><div class="loading-spinner"></div></div>`;
    
    const { data: notifications, error } = await DB.getNotifications(Auth.getUserId());
    
    if (!notifications || notifications.length === 0) {
        container.innerHTML = `
            <div class="container">
                <div class="page-header"><h1>Notifications</h1></div>
                <div class="empty-state">
                    <div class="empty-icon">🔔</div>
                    <h3>No notifications</h3>
                    <p>You're all caught up!</p>
                </div>
            </div>
        `;
        return;
    }
    
    const unreadCount = notifications.filter(n => !n.is_read).length;
    
    container.innerHTML = `
        <div class="container">
            <div class="page-header">
                <h1>Notifications ${unreadCount > 0 ? `<span class="tag tag-primary">${unreadCount} new</span>` : ''}</h1>
                ${unreadCount > 0 ? `<button class="btn btn-ghost btn-sm" onclick="markAllRead()">Mark all read</button>` : ''}
            </div>
            
            <div class="card" style="padding:0; overflow:hidden;">
                ${notifications.map(notif => `
                    <div class="notification-item ${notif.is_read ? '' : 'unread'}" 
                         onclick="handleNotifClick('${notif.id}', '${notif.link || ''}')">
                        <div class="notif-icon ${notif.type}">
                            ${notif.type === 'order' ? '📦' : 
                              notif.type === 'settlement' ? '💰' : 
                              notif.type === 'promo' ? '🎉' : 
                              notif.type === 'alert' ? '⚠️' : 'ℹ️'}
                        </div>
                        <div class="notif-content">
                            <div class="notif-title">${notif.title}</div>
                            <div class="notif-message">${notif.message}</div>
                            <div class="notif-time">${timeAgo(notif.created_at)}</div>
                        </div>
                    </div>
                `).join('')}
            </div>
        </div>
    `;
}

async function handleNotifClick(notifId, link) {
    await DB.markNotificationRead(notifId);
    Auth.updateNotifBadge();
    
    if (link) {
        window.location.href = link;
    } else {
        // Just mark as read and refresh
        const item = document.querySelector(`[onclick*="${notifId}"]`);
        if (item) item.classList.remove('unread');
    }
}

async function markAllRead() {
    await DB.markAllNotificationsRead(Auth.getUserId());
    Auth.updateNotifBadge();
    Toast.success('All notifications marked as read');
    loadNotifications();
}
