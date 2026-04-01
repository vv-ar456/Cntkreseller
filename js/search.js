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
// js/search.js (continued)

                <p>Try searching with different keywords</p>
                <a href="/" class="btn btn-primary">Browse All Products</a>
            </div>
        `;
        return;
    }
    
    container.innerHTML = `
        <div class="search-results-count">${products.length} results for "${query}"</div>
        <div class="products-grid">
            ${products.map(p => renderProductCard(p)).join('')}
        </div>
    `;
    
    attachLikeEvents();
}

async function loadFilteredProducts(filters, title) {
    const container = document.getElementById('searchResults');
    container.innerHTML = `<div class="page-loader"><div class="loading-spinner"></div></div>`;
    
    const { data: products } = await DB.getProducts({ ...filters, limit: 50 });
    
    if (!products || products.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">📦</div>
                <h3>No products found</h3>
                <a href="/" class="btn btn-primary">Go Home</a>
            </div>
        `;
        return;
    }
    
    const titleEl = document.getElementById('searchTitle');
    if (titleEl) titleEl.textContent = title;
    
    container.innerHTML = `
        <div class="search-results-count">${products.length} products</div>
        <div class="products-grid">
            ${products.map(p => renderProductCard(p)).join('')}
        </div>
    `;
    
    attachLikeEvents();
}

function handleSearchInput(e) {
    if (e.key === 'Enter') {
        const term = e.target.value.trim();
        if (term) {
            window.history.pushState({}, '', `search.html?q=${encodeURIComponent(term)}`);
            performSearch(term);
        }
    }
}
