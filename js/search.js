// js/search.js

document.addEventListener('DOMContentLoaded', async () => {
    await Auth.init();
    setupOTPInputs();
    setupUserDropdown();
    
    const params = new URLSearchParams(window.location.search);
    const query = params.get('q');
    const special = params.get('special');
    const featured = params.get('featured');
    const categoryId = params.get('category');
    
    if (query) {
        document.getElementById('searchInput').value = query;
        performSearch(query);
    } else if (special) {
        loadFilteredProducts({ is_special: true }, '🔥 Special Deals');
    } else if (featured) {
        loadFilteredProducts({ is_featured: true }, '⭐ Featured Products');
    } else if (categoryId) {
        loadFilteredProducts({ category_id: categoryId }, 'Category Products');
    }
});

async function performSearch(query) {
    const container = document.getElementById('searchResults');
    container.innerHTML = `<div class="page-loader"><div class="loading-spinner"></div></div>`;
    
    const { data: products, error } = await DB.searchProducts(query);
    
    if (!products || products.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">🔍</div>
                <h3>No results found</h3>
