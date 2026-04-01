// js/cart.js

document.addEventListener('DOMContentLoaded', async () => {
    await Auth.init();
    setupOTPInputs();
    setupUserDropdown();
    
    if (!Auth.requireAuth()) {
        return;
    }
    
    loadCart();
});

async function loadCart() {
    const container = document.getElementById('cartPage');
    container.innerHTML = `<div class="page-loader"><div class="loading-spinner"></div></div>`;
    
    const { data: cartItems, error } = await DB.getCart(Auth.getUserId());
    
    if (error || !cartItems || cartItems.length === 0) {
        container.innerHTML = `
            <div class="container">
                <div class="page-header">
                    <h1>Shopping Cart</h1>
                </div>
                <div class="empty-state">
                    <div class="empty-icon">🛒</div>
                    <h3>Your cart is empty</h3>
                    <p>Add products to your cart and start reselling!</p>
                    <a href="/" class="btn btn-primary">Browse Products</a>
                </div>
            </div>
        `;
        return;
    }
    
    let subtotal = 0;
    let totalMargin = 0;
    let totalAmount = 0;
    
    cartItems.forEach(item => {
        const product = item.products;
        const margin = parseFloat(item.margin_amount) || 0;
        const sellingPrice = parseFloat(product.mrp) + margin;
        const itemTotal = sellingPrice * item.quantity;
        
        subtotal += parseFloat(product.mrp) * item.quantity;
        totalMargin += margin * item.quantity;
        totalAmount += itemTotal;
    });
    
    const shipping = totalAmount >= 500 ? 0 : 49;
    const grandTotal = totalAmount + shipping;
    
    container.innerHTML = `
        <div class="container">
            <div class="page-header">
                <h1>Shopping Cart (${cartItems.length} items)</h1>
            </div>
            
            <div class="cart-layout">
                <div class="cart-items-list">
                    ${cartItems.map(item => {
                        const product = item.products;
                        const margin = parseFloat(item.margin_amount) || 0;
                        const maxMargin = product.mrp - product.base_price;
                        const sellingPrice = parseFloat(product.mrp) + margin;
                        
                        return `
                            <div class="cart-item" data-cart-id="${item.id}">
                                <a href="product.html?id=${product.slug || product.id}" class="item-image">
                                    <img src="${product.thumbnail || placeholderImage(product.name)}" alt="${product.name}">
                                </a>
                                <div class="item-details">
                                    <a href="product.html?id=${product.slug || product.id}">
                                        <div class="item-name">${product.name}</div>
                                    </a>
                                    <div class="item-price-row">
                                        <span class="item-selling-price">${formatCurrency(sellingPrice)}</span>
                                        <span class="item-mrp">${formatCurrency(product.mrp)}</span>
                                        ${margin > 0 ? `<span class="item-margin">+₹${margin} margin</span>` : ''}
                                    </div>
                                    <div class="item-actions">
                                        <div class="flex gap-1" style="align-items:center;">
                                            <div class="quantity-controls" style="display:inline-flex;">
                                                <button onclick="updateCartQty('${item.id}', ${item.quantity - 1})">−</button>
                                                <span class="qty-value" style="padding:6px 12px;font-size:14px;">${item.quantity}</span>
                                                <button onclick="updateCartQty('${item.id}', ${item.quantity + 1})">+</button>
                                            </div>
                                            <div class="margin-edit">
                                                <label>Margin ₹</label>
                                                <input type="number" value="${margin}" min="0" max="${maxMargin}" 
                                                       onchange="updateCartMargin('${item.id}', this.value)">
                                            </div>
                                        </div>
                                        <button class="remove-btn" onclick="removeCartItem('${item.id}')">🗑 Remove</button>
                                    </div>
                                </div>
                            </div>
                        `;
                    }).join('')}
                </div>
                
                <div class="cart-summary">
                    <h3>Order Summary</h3>
                    <div class="summary-row">
                        <span>Subtotal (MRP)</span>
                        <span class="value">${formatCurrency(subtotal)}</span>
                    </div>
                    <div class="summary-row margin">
                        <span>Total Margin</span>
                        <span class="value">+${formatCurrency(totalMargin)}</span>
                    </div>
                    <div class="summary-row">
                        <span>Shipping</span>
                        <span class="value">${shipping === 0 ? 'FREE' : formatCurrency(shipping)}</span>
                    </div>
                    <div class="summary-row total">
                        <span>Total</span>
                        <span class="value">${formatCurrency(grandTotal)}</span>
                    </div>
                    
                    ${totalMargin > 0 ? `
                        <div class="profit-preview mt-2">
                            <span class="profit-icon">💰</span>
                            <span>Your estimated profit: <strong>${formatCurrency(totalMargin)}</strong></span>
                        </div>
                    ` : ''}
                    
                    <a href="checkout.html" class="btn btn-primary btn-full btn-lg mt-2">
                        Proceed to Checkout
                    </a>
                    <a href="/" class="btn btn-ghost btn-full mt-1">
                        Continue Shopping
                    </a>
                </div>
            </div>
        </div>
    `;
}

async function updateCartQty(cartId, newQty) {
    if (newQty < 1) {
        removeCartItem(cartId);
        return;
    }
    
    await DB.updateCartItem(cartId, { quantity: newQty });
    loadCart();
}

async function updateCartMargin(cartId, newMargin) {
    await DB.updateCartItem(cartId, { margin_amount: parseFloat(newMargin) || 0 });
    loadCart();
}

async function removeCartItem(cartId) {
    if (!confirm('Remove this item from cart?')) return;
    await DB.removeFromCart(cartId);
    Toast.info('Item removed from cart');
    Auth.updateCartBadge();
    loadCart();
}
