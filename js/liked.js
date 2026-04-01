// js/liked.js

document.addEventListener('DOMContentLoaded', async () => {
    await Auth.init();
    setupOTPInputs();
    setupUserDropdown();
    
    if (!Auth.requireAuth()) return;
    
    loadLikedProducts();
});

async function loadLikedProducts() {
    const container = document.getElementById('likedPage');
    container.innerHTML = `<div class="page-loader"><div class="loading-spinner"></div></div>`;
    
    const { data: liked, error } = await DB.getLikedProducts(Auth.getUserId());
    
    if (!liked || liked.length === 0) {
        container.innerHTML = `
            <div class="container">
                <div class="page-header"><h1>Wishlist</h1></div>
                <div class="empty-state">
                    <div class="empty-icon">💜</div>
                    <h3>Your wishlist is empty</h3>
                    <p>Products you like will appear here</p>
                    <a href="/" class="btn btn-primary">Browse Products</a>
                </div>
            </div>
        `;
        return;
    }
    
    container.innerHTML = `
        <div class="container">
            <div class="page-header">
                <h1>Wishlist (${liked.length})</h1>
            </div>
            <div class="products-grid">
                ${liked.map(item => {
                    if (!item.products) return '';
                    return renderProductCard(item.products);
                }).join('')}
            </div>
        </div>
    `;
    
    // Mark all as liked
    document.querySelectorAll('.like-btn').forEach(btn => {
        btn.classList.add('liked');
        btn.textContent = '❤';
    });
}
