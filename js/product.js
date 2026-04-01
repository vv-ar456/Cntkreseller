// js/product.js

document.addEventListener('DOMContentLoaded', async () => {
    await Auth.init();
    setupOTPInputs();
    setupUserDropdown();
    loadProduct();
});

async function loadProduct() {
    const params = new URLSearchParams(window.location.search);
    const productId = params.get('id');
    
    if (!productId) {
        window.location.href = '/';
        return;
    }
    
    const container = document.getElementById('productPage');
    container.innerHTML = `<div class="page-loader"><div class="loading-spinner"></div></div>`;
    
    const { data: product, error } = await DB.getProduct(productId);
    
    if (error || !product) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">🔍</div>
                <h3>Product not found</h3>
                <p>The product you're looking for doesn't exist or has been removed.</p>
                <a href="/" class="btn btn-primary">Go Home</a>
            </div>
        `;
        return;
    }
    
    const maxMargin = product.mrp - product.base_price;
    const images = product.images?.length > 0 ? product.images : [product.thumbnail || placeholderImage(product.name)];
    
    let isLiked = false;
    if (Auth.isLoggedIn()) {
        isLiked = await DB.isLiked(Auth.getUserId(), product.id);
    }
    
    container.innerHTML = `
        <div class="container">
            <button class="back-btn" onclick="history.back()">← Back</button>
            
            <div class="product-detail">
                <div class="product-gallery">
                    <div class="main-image" id="mainImage">
                        <img src="${images[0]}" alt="${product.name}" id="mainImg">
                    </div>
                    ${images.length > 1 ? `
                        <div class="thumbnails">
                            ${images.map((img, i) => `
                                <div class="thumb ${i === 0 ? 'active' : ''}" onclick="changeImage('${img}', this)">
                                    <img src="${img}" alt="Thumbnail ${i + 1}">
                                </div>
                            `).join('')}
                        </div>
                    ` : ''}
                </div>
                
                <div class="product-details-info">
                    <h1>${product.name}</h1>
                    
                    <div class="product-meta">
                        ${product.sku ? `<span class="sku">SKU: ${product.sku}</span>` : ''}
                        <span class="stock-status ${product.stock > 0 ? 'in-stock' : 'out-of-stock'}">
                            ${product.stock > 0 ? `✓ In Stock (${product.stock})` : '✕ Out of Stock'}
                        </span>
                    </div>
                    
                    <div class="pricing-box">
                        <div class="mrp-price">MRP: ${formatCurrency(product.mrp)}</div>
                        <div class="base-price-note">Base price: ${formatCurrency(product.base_price)} • Max margin: ${formatCurrency(maxMargin)}</div>
                        
                        <div class="margin-input-group">
                            <label>Set Your Margin (Profit per item)</label>
                            <div class="margin-input-wrapper">
                                <div class="input-with-prefix">
                                    <span class="prefix">₹</span>
                                    <input type="number" id="marginAmount" placeholder="0" min="0" max="${maxMargin}" 
                                           value="0" oninput="updateSellingPrice(${product.mrp}, ${maxMargin})">
                                </div>
                                <div class="selling-price-preview">
                                    <div class="label">Selling Price</div>
                                    <div class="price" id="sellingPrice">${formatCurrency(product.mrp)}</div>
                                </div>
                            </div>
                            <div class="profit-preview" id="profitPreview" style="display:none;">
                                <span class="profit-icon">💰</span>
                                <span>Your profit: <strong id="profitAmount">₹0</strong> per item</span>
                            </div>
                        </div>
                    </div>
                    
                    <div class="quantity-selector">
                        <label>Quantity:</label>
                        <div class="quantity-controls">
                            <button onclick="changeQty(-1)">−</button>
                            <input type="number" class="qty-value" id="qtyInput" value="1" min="1" max="${product.stock}" readonly>
                            <button onclick="changeQty(1)">+</button>
                        </div>
                    </div>
                    
                    <div class="product-actions">
                        ${product.stock > 0 ? `
                            <button class="btn btn-primary btn-lg" onclick="addProductToCart('${product.id}')">
                                🛒 Add to Cart
                            </button>
                            <button class="btn btn-secondary btn-lg" onclick="buyNow('${product.id}')">
                                ⚡ Buy Now
                            </button>
                        ` : `
                            <button class="btn btn-ghost btn-lg" disabled>Out of Stock</button>
                        `}
                        <button class="btn btn-outline btn-icon" id="likeBtn" onclick="toggleProductLike('${product.id}')" 
                                style="flex-shrink:0;width:50px;height:50px;border-radius:12px;font-size:22px;">
                            ${isLiked ? '❤' : '♡'}
                        </button>
                    </div>
                    
                    ${product.description ? `
                        <div class="product-description">
                            <h3>Description</h3>
                            <p>${product.description}</p>
                        </div>
                    ` : ''}
                    
                    ${product.specifications && Object.keys(product.specifications).length > 0 ? `
                        <div class="product-specs mt-2">
                            <h3>Specifications</h3>
                            <table>
                                ${Object.entries(product.specifications).map(([key, val]) => `
                                    <tr>
                                        <td>${key}</td>
                                        <td>${val}</td>
                                    </tr>
                                `).join('')}
                            </table>
                        </div>
                    ` : ''}
                </div>
            </div>
        </div>
    `;
}

function changeImage(src, thumbEl) {
    document.getElementById('mainImg').src = src;
    document.querySelectorAll('.thumb').forEach(t => t.classList.remove('active'));
    thumbEl.classList.add('active');
}

function updateSellingPrice(mrp, maxMargin) {
    const margin = Math.min(parseFloat(document.getElementById('marginAmount').value) || 0, maxMargin);
    const sellingPrice = mrp + margin;
    document.getElementById('sellingPrice').textContent = formatCurrency(sellingPrice);
    
    const profitPreview = document.getElementById('profitPreview');
    const profitAmount = document.getElementById('profitAmount');
    
    if (margin > 0) {
        profitPreview.style.display = 'flex';
        profitAmount.textContent = formatCurrency(margin);
    } else {
        profitPreview.style.display = 'none';
    }
}

function changeQty(delta) {
    const input = document.getElementById('qtyInput');
    const newVal = parseInt(input.value) + delta;
    const max = parseInt(input.max) || 100;
    if (newVal >= 1 && newVal <= max) {
        input.value = newVal;
    }
}

async function addProductToCart(productId) {
    if (!Auth.requireAuth()) return;
    
    const margin = parseFloat(document.getElementById('marginAmount').value) || 0;
    const qty = parseInt(document.getElementById('qtyInput').value) || 1;
    
    const { error } = await DB.addToCart(Auth.getUserId(), productId, qty, margin);
    if (error) {
        Toast.error('Failed to add to cart');
        return;
    }
    
    Toast.success('Added to cart!');
    Auth.updateCartBadge();
}

async function buyNow(productId) {
    if (!Auth.requireAuth()) return;
    
    await addProductToCart(productId);
    window.location.href = 'cart.html';
}

async function toggleProductLike(productId) {
    if (!Auth.requireAuth()) return;
    
    const { liked } = await DB.toggleLike(Auth.getUserId(), productId);
    const btn = document.getElementById('likeBtn');
    
    if (liked) {
        btn.textContent = '❤';
        Toast.success('Added to wishlist');
    } else {
        btn.textContent = '♡';
        Toast.info('Removed from wishlist');
    }
                            }
