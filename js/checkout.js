// js/checkout.js

let selectedAddressId = null;
let cartData = [];

document.addEventListener('DOMContentLoaded', async () => {
    await Auth.init();
    setupOTPInputs();
    setupUserDropdown();
    
    if (!Auth.requireAuth()) return;
    
    loadCheckout();
});

async function loadCheckout() {
    const container = document.getElementById('checkoutPage');
    container.innerHTML = `<div class="page-loader"><div class="loading-spinner"></div></div>`;
    
    const [cartRes, addressRes] = await Promise.all([
        DB.getCart(Auth.getUserId()),
        DB.getAddresses(Auth.getUserId())
    ]);
    
    cartData = cartRes.data || [];
    const addresses = addressRes.data || [];
    
    if (cartData.length === 0) {
        window.location.href = 'cart.html';
        return;
    }
    
    // Calculate totals
    let subtotal = 0, totalMargin = 0, totalAmount = 0;
    cartData.forEach(item => {
        const margin = parseFloat(item.margin_amount) || 0;
        const sellingPrice = parseFloat(item.products.mrp) + margin;
        subtotal += parseFloat(item.products.mrp) * item.quantity;
        totalMargin += margin * item.quantity;
        totalAmount += sellingPrice * item.quantity;
    });
    
    const shipping = totalAmount >= 500 ? 0 : 49;
    const grandTotal = totalAmount + shipping;
    
    selectedAddressId = addresses.find(a => a.is_default)?.id || addresses[0]?.id;
    
    container.innerHTML = `
        <div class="container">
            <button class="back-btn" onclick="history.back()">← Back to Cart</button>
            <div class="page-header">
                <h1>Checkout</h1>
            </div>
            
            <div class="checkout-layout">
                <div>
                    <!-- Shipping Address -->
                    <div class="checkout-section">
                        <h3><span class="step-number">1</span> Shipping Address</h3>
                        <div class="address-list" id="addressList">
                            ${addresses.length > 0 ? addresses.map(addr => `
                                <div class="address-card ${addr.id === selectedAddressId ? 'selected' : ''}" 
                                     onclick="selectAddress('${addr.id}')">
                                    <div class="radio-indicator"></div>
                                    <div class="address-label">${addr.label}</div>
                                    <div class="address-name">${addr.full_name}</div>
                                    <div class="address-text">${addr.address_line1}${addr.address_line2 ? ', ' + addr.address_line2 : ''}, ${addr.city}, ${addr.state} - ${addr.pincode}</div>
                                    <div class="address-phone">📞 ${addr.phone}</div>
                                </div>
                            `).join('') : '<p class="text-muted">No addresses found. Please add one.</p>'}
                        </div>
                        <button class="btn btn-outline btn-sm mt-2" onclick="showAddAddressForm()">+ Add New Address</button>
                        
                        <!-- Add Address Form (hidden) -->
                        <div id="addAddressForm" class="hidden mt-2">
                            <div class="card">
                                <h4 class="mb-2">New Address</h4>
                                <div class="product-form-grid">
                                    <div class="form-group">
                                        <label>Full Name</label>
                                        <input type="text" class="form-control" id="addrName" placeholder="Full name">
                                    </div>
                                    <div class="form-group">
                                        <label>Phone</label>
                                        <input type="tel" class="form-control" id="addrPhone" placeholder="Phone number">
                                    </div>
                                    <div class="form-group full-width">
                                        <label>Address Line 1</label>
                                        <input type="text" class="form-control" id="addrLine1" placeholder="House no, Street">
                                    </div>
                                    <div class="form-group full-width">
                                        <label>Address Line 2</label>
                                        <input type="text" class="form-control" id="addrLine2" placeholder="Landmark, Area">
                                    </div>
                                    <div class="form-group">
                                        <label>City</label>
                                        <input type="text" class="form-control" id="addrCity" placeholder="City">
                                    </div>
                                    <div class="form-group">
                                        <label>State</label>
                                        <input type="text" class="form-control" id="addrState" placeholder="State">
                                    </div>
                                    <div class="form-group">
                                        <label>Pincode</label>
                                        <input type="text" class="form-control" id="addrPincode" placeholder="Pincode">
                                    </div>
                                    <div class="form-group">
                                        <label>Label</label>
                                        <select class="form-control" id="addrLabel">
                                            <option value="Home">Home</option>
                                            <option value="Work">Work</option>
                                            <option value="Other">Other</option>
                                        </select>
                                    </div>
                                </div>
                                <div class="flex gap-1">
                                    <button class="btn btn-primary" onclick="saveNewAddress()">Save Address</button>
                                    <button class="btn btn-ghost" onclick="hideAddAddressForm()">Cancel</button>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Order Items -->
                    <div class="checkout-section">
                        <h3><span class="step-number">2</span> Order Items (${cartData.length})</h3>
                        ${cartData.map(item => {
                            const margin = parseFloat(item.margin_amount) || 0;
                            const sellingPrice = parseFloat(item.products.mrp) + margin;
                            return `
                                <div class="order-item-row">
                                    <div class="item-thumb">
                                        <img src="${item.products.thumbnail || placeholderImage('')}" alt="">
                                    </div>
                                    <div class="item-info">
                                        <div class="item-name">${item.products.name}</div>
                                        <div class="item-qty">Qty: ${item.quantity} ${margin > 0 ? `• Margin: ₹${margin}` : ''}</div>
                                    </div>
                                    <div class="item-price">${formatCurrency(sellingPrice * item.quantity)}</div>
                                </div>
                            `;
                        }).join('')}
                    </div>
                    
                    <!-- Customer Details -->
                    <div class="checkout-section">
                        <h3><span class="step-number">3</span> Customer Details</h3>
                        <div class="product-form-grid">
                            <div class="form-group">
                                <label>Customer Name</label>
                                <input type="text" class="form-control" id="custName" 
                                       value="${Auth.currentProfile?.full_name || ''}" placeholder="Customer's name">
                            </div>
                            <div class="form-group">
                                <label>Customer Phone</label>
                                <input type="tel" class="form-control" id="custPhone" 
                                       value="${Auth.currentProfile?.phone || ''}" placeholder="Customer's phone">
                            </div>
                            <div class="form-group full-width">
                                <label>Customer Email (optional)</label>
                                <input type="email" class="form-control" id="custEmail" placeholder="Customer's email">
                            </div>
                        </div>
                    </div>
                </div>
                
                <!-- Order Summary -->
                <div class="cart-summary">
                    <h3>Payment Summary</h3>
                    <div class="summary-row">
                        <span>Items Total (MRP)</span>
                        <span class="value">${formatCurrency(subtotal)}</span>
                    </div>
                    <div class="summary-row margin">
                        <span>Your Margin</span>
                        <span class="value">+${formatCurrency(totalMargin)}</span>
                    </div>
                    <div class="summary-row">
                        <span>Shipping</span>
                        <span class="value">${shipping === 0 ? 'FREE' : formatCurrency(shipping)}</span>
                    </div>
                    <div class="summary-row total">
                        <span>Total Payable</span>
                        <span class="value">${formatCurrency(grandTotal)}</span>
                    </div>
                    
                    <div class="profit-preview mt-2">
                        <span class="profit-icon">💰</span>
                        <span>Your profit: <strong>${formatCurrency(totalMargin)}</strong></span>
                    </div>
                    
                    <button class="btn btn-primary btn-full btn-lg mt-2" onclick="placeOrder(${grandTotal}, ${totalMargin}, ${shipping})" id="placeOrderBtn">
                        Pay ${formatCurrency(grandTotal)}
                    </button>
                    
                    <p class="text-muted text-center mt-1" style="font-size:12px;">
                        Secure payment via Razorpay
                    </p>
                </div>
            </div>
        </div>
    `;
}

function selectAddress(id) {
    selectedAddressId = id;
    document.querySelectorAll('.address-card').forEach(c => c.classList.remove('selected'));
    document.querySelector(`.address-card[onclick*="${id}"]`)?.classList.add('selected');
}

function showAddAddressForm() {
    document.getElementById('addAddressForm').classList.remove('hidden');
}

function hideAddAddressForm() {
    document.getElementById('addAddressForm').classList.add('hidden');
}

async function saveNewAddress() {
    const address = {
        user_id: Auth.getUserId(),
        full_name: document.getElementById('addrName').value.trim(),
        phone: document.getElementById('addrPhone').value.trim(),
        address_line1: document.getElementById('addrLine1').value.trim(),
        address_line2: document.getElementById('addrLine2').value.trim(),
        city: document.getElementById('addrCity').value.trim(),
        state: document.getElementById('addrState').value.trim(),
        pincode: document.getElementById('addrPincode').value.trim(),
        label: document.getElementById('addrLabel').value
    };
    
    if (!address.full_name || !address.phone || !address.address_line1 || !address.city || !address.state || !address.pincode) {
        Toast.error('Please fill all required fields');
        return;
    }
    
    const { data, error } = await DB.addAddress(address);
    if (error) {
        Toast.error('Failed to save address');
        return;
    }
    
    Toast.success('Address saved!');
    loadCheckout();
}

async function placeOrder(totalAmount, totalMargin, shipping) {
    if (!selectedAddressId) {
        Toast.error('Please select a shipping address');
        return;
    }
    
    const custName = document.getElementById('custName').value.trim();
    const custPhone = document.getElementById('custPhone').value.trim();
    const custEmail = document.getElementById('custEmail').value.trim();
    
    if (!custName || !custPhone) {
        Toast.error('Please fill customer name and phone');
        return;
    }
    
    const btn = document.getElementById('placeOrderBtn');
    btn.disabled = true;
    btn.innerHTML = '<span class="loading-spinner sm"></span> Processing...';
    
    try {
        // Get selected address
        const { data: addresses } = await DB.getAddresses(Auth.getUserId());
        const selectedAddress = addresses.find(a => a.id === selectedAddressId);
        
        if (!selectedAddress) {
            Toast.error('Address not found');
            btn.disabled = false;
            btn.textContent = `Pay ${formatCurrency(totalAmount)}`;
            return;
        }
        
        const addressJson = {
            full_name: selectedAddress.full_name,
            phone: selectedAddress.phone,
            address_line1: selectedAddress.address_line1,
            address_line2: selectedAddress.address_line2,
            city: selectedAddress.city,
            state: selectedAddress.state,
            pincode: selectedAddress.pincode
        };
        
        // Calculate subtotal
        let subtotal = 0;
        cartData.forEach(item => {
            const margin = parseFloat(item.margin_amount) || 0;
            subtotal += (parseFloat(item.products.mrp) + margin) * item.quantity;
        });
        
        // Initiate Razorpay payment
        const paymentResponse = await Payment.createOrder(totalAmount, 'checkout', {
            name: custName,
            phone: custPhone,
            email: custEmail
        });
        
        // Create order in database
        const orderData = {
            user_id: Auth.getUserId(),
            shipping_address: addressJson,
            billing_address: addressJson,
            subtotal: subtotal,
            total_margin: totalMargin,
            shipping_cost: shipping,
            total_amount: totalAmount,
            payment_status: 'paid',
            razorpay_payment_id: paymentResponse.razorpay_payment_id,
            customer_name: custName,
            customer_phone: custPhone,
            customer_email: custEmail,
            order_status: 'placed'
        };
        
        const { data: order, error: orderError } = await DB.createOrder(orderData);
        
        if (orderError) {
            Toast.error('Failed to create order. Payment was successful, please contact support.');
            return;
        }
        
        // Create order items
        const orderItems = cartData.map(item => ({
            order_id: order.id,
            product_id: item.product_id,
            product_name: item.products.name,
            product_thumbnail: item.products.thumbnail,
            quantity: item.quantity,
            mrp: item.products.mrp,
            base_price: item.products.base_price,
            margin_amount: item.margin_amount,
            selling_price: parseFloat(item.products.mrp) + parseFloat(item.margin_amount || 0),
            total_price: (parseFloat(item.products.mrp) + parseFloat(item.margin_amount || 0)) * item.quantity
        }));
        
        await DB.createOrderItems(orderItems);
        
        // Create settlements for margin
        for (const item of orderItems) {
            if (parseFloat(item.margin_amount) > 0) {
                await DB.createSettlement({
                    user_id: Auth.getUserId(),
                    order_id: order.id,
                    margin_amount: parseFloat(item.margin_amount) * item.quantity,
                    status: 'pending'
                });
            }
        }
        
        // Create notification
        await DB.createNotification({
            user_id: Auth.getUserId(),
            title: 'Order Placed Successfully!',
            message: `Your order #${order.order_number} has been placed. Total: ${formatCurrency(totalAmount)}`,
            type: 'order',
            link: `orders.html?id=${order.id}`
        });
        
        // Clear cart
        await DB.clearCart(Auth.getUserId());
        
        Toast.success('Order placed successfully!');
        
        // Redirect to orders page
        setTimeout(() => {
            window.location.href = `orders.html?id=${order.id}`;
        }, 1500);
        
    } catch (err) {
        if (err.message === 'Payment cancelled') {
            Toast.warning('Payment cancelled');
        } else {
            Toast.error('Payment failed: ' + err.message);
        }
        btn.disabled = false;
        btn.textContent = `Pay ${formatCurrency(totalAmount)}`;
    }
}
