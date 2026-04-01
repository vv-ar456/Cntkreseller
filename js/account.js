// js/account.js

let currentSection = 'profile';

document.addEventListener('DOMContentLoaded', async () => {
    await Auth.init();
    setupOTPInputs();
    setupUserDropdown();
    
    if (!Auth.requireAuth()) return;
    
    loadAccountPage();
});

async function loadAccountPage() {
    const container = document.getElementById('accountPage');
    
    const [profileData, addressesData, bankData] = await Promise.all([
        Auth.currentProfile || (await DB.getProfile(Auth.getUserId())).data,
        (await DB.getAddresses(Auth.getUserId())).data || [],
        (await DB.getBankAccount(Auth.getUserId())).data
    ]);
    
    container.innerHTML = `
        <div class="container">
            <div class="page-header"><h1>Account Centre</h1></div>
            
            <div class="account-layout">
                <div class="account-sidebar">
                    <button class="sidebar-item active" data-section="profile" onclick="switchSection('profile')">
                        <span class="item-icon">👤</span> Profile
                    </button>
                    <button class="sidebar-item" data-section="addresses" onclick="switchSection('addresses')">
                        <span class="item-icon">📍</span> Addresses
                    </button>
                    <button class="sidebar-item" data-section="bank" onclick="switchSection('bank')">
                        <span class="item-icon">🏦</span> Bank Account
                    </button>
                </div>
                
                <div class="account-content">
                    <!-- Profile Section -->
                    <div class="account-section active" id="section-profile">
                        <div class="card">
                            <div class="card-header">
                                <h2>Personal Information</h2>
                            </div>
                            <form onsubmit="saveProfile(event)">
                                <div class="product-form-grid">
                                    <div class="form-group">
                                        <label>Full Name</label>
                                        <input type="text" class="form-control" id="profileName" 
                                               value="${profileData?.full_name || ''}" placeholder="Enter your name">
                                    </div>
                                    <div class="form-group">
                                        <label>Phone</label>
                                        <input type="tel" class="form-control" id="profilePhone" 
                                               value="${profileData?.phone || ''}" placeholder="Phone number" readonly>
                                        <span class="form-hint">Phone number cannot be changed</span>
                                    </div>
                                    <div class="form-group full-width">
                                        <label>Email</label>
                                        <input type="email" class="form-control" id="profileEmail" 
                                               value="${profileData?.email?.includes('@conitek.user') ? '' : (profileData?.email || '')}" 
                                               placeholder="Email address">
                                    </div>
                                </div>
                                <button type="submit" class="btn btn-primary">Save Changes</button>
                            </form>
                        </div>
                    </div>
                    
                    <!-- Addresses Section -->
                    <div class="account-section" id="section-addresses">
                        <div class="card">
                            <div class="card-header">
                                <h2>Saved Addresses</h2>
                                <button class="btn btn-primary btn-sm" onclick="showAddressModal()">+ Add Address</button>
                            </div>
                            <div id="addressesList">
                                ${addressesData.length > 0 ? addressesData.map(addr => `
                                    <div class="address-card mb-1" style="cursor:default;">
                                        <div class="address-label">${addr.label} ${addr.is_default ? '(Default)' : ''}</div>
                                        <div class="address-name">${addr.full_name}</div>
                                        <div class="address-text">${addr.address_line1}${addr.address_line2 ? ', ' + addr.address_line2 : ''}, ${addr.city}, ${addr.state} - ${addr.pincode}</div>
                                        <div class="address-phone">📞 ${addr.phone}</div>
                                        <div class="flex gap-1 mt-1">
                                            <button class="btn btn-ghost btn-sm" onclick="editAddress('${addr.id}')">Edit</button>
                                            <button class="btn btn-ghost btn-sm text-danger" onclick="deleteAddress('${addr.id}')">Delete</button>
                                            ${!addr.is_default ? `<button class="btn btn-ghost btn-sm" onclick="setDefaultAddress('${addr.id}')">Set Default</button>` : ''}
                                        </div>
                                    </div>
                                `).join('') : '<p class="text-muted">No addresses saved yet.</p>'}
                            </div>
                        </div>
                    </div>
                    
                    <!-- Bank Account Section -->
                    <div class="account-section" id="section-bank">
                        <div class="card">
                            <div class="card-header">
                                <h2>Settlement Bank Account</h2>
                            </div>
                            <p class="text-muted mb-2" style="font-size:14px;">
                                Your margin earnings will be settled to this bank account. OTP verification required for changes.
                            </p>
                            
                            ${bankData ? `
                                <div class="card mb-2" style="background:var(--success-bg); border-color:var(--success);">
                                    <p><strong>${bankData.account_holder_name}</strong></p>
                                    <p style="font-size:14px;">${bankData.bank_name} - ${bankData.branch_name || ''}</p>
                                    <p style="font-size:14px;">A/C: ****${bankData.account_number.slice(-4)} | IFSC: ${bankData.ifsc_code}</p>
                                </div>
                            ` : ''}
                            
                            <div id="bankFormWrapper">
                                <div id="bankOtpStep">
                                    <p class="mb-1" style="font-size:14px;">Verify your identity to ${bankData ? 'update' : 'add'} bank details:</p>
                                    <button class="btn btn-primary" onclick="sendBankOTP()" id="bankOtpBtn">
                                        Send OTP to ${Auth.currentProfile?.phone ? '****' + Auth.currentProfile.phone.slice(-4) : 'phone'}
                                    </button>
                                </div>
                                
                                <div id="bankOtpVerify" class="hidden">
                                    <div class="form-group">
                                        <label>Enter OTP</label>
                                        <div class="otp-inputs">
                                            <input type="text" maxlength="1">
                                            <input type="text" maxlength="1">
                                            <input type="text" maxlength="1">
                                            <input type="text" maxlength="1">
                                            <input type="text" maxlength="1">
                                            <input type="text" maxlength="1">
                                        </div>
                                    </div>
                                    <button class="btn btn-primary" onclick="verifyBankOTP()" id="verifyBankOtpBtn">Verify & Continue</button>
                                </div>
                                
                                <div id="bankForm" class="hidden mt-2">
                                    <form onsubmit="saveBankDetails(event)">
                                        <div class="product-form-grid">
                                            <div class="form-group">
                                                <label>Account Holder Name</label>
                                                <input type="text" class="form-control" id="bankHolderName" 
                                                       value="${bankData?.account_holder_name || ''}" required>
                                            </div>
                                            <div class="form-group">
                                                <label>Account Number</label>
                                                <input type="text" class="form-control" id="bankAccountNumber" 
                                                       value="${bankData?.account_number || ''}" required>
                                            </div>
                                            <div class="form-group">
                                                <label>IFSC Code</label>
                                                <input type="text" class="form-control" id="bankIfsc" 
                                                       value="${bankData?.ifsc_code || ''}" required>
                                            </div>
                                            <div class="form-group">
                                                <label>Bank Name</label>
                                                <input type="text" class="form-control" id="bankName" 
                                                       value="${bankData?.bank_name || ''}" required>
                                            </div>
                                            <div class="form-group">
                                                <label>Branch Name</label>
                                                <input type="text" class="form-control" id="bankBranch" 
                                                       value="${bankData?.branch_name || ''}">
                                            </div>
                                        </div>
                                        <button type="submit" class="btn btn-primary">Save Bank Details</button>
                                    </form>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    setupOTPInputs();
}

function switchSection(section) {
    currentSection = section;
    document.querySelectorAll('.account-section').forEach(s => s.classList.remove('active'));
    document.querySelectorAll('.sidebar-item').forEach(s => s.classList.remove('active'));
    
    document.getElementById(`section-${section}`)?.classList.add('active');
    document.querySelector(`.sidebar-item[data-section="${section}"]`)?.classList.add('active');
}

async function saveProfile(e) {
    e.preventDefault();
    
    const updates = {
        full_name: document.getElementById('profileName').value.trim(),
        email: document.getElementById('profileEmail').value.trim() || Auth.currentProfile?.email
    };
    
    const { error } = await DB.updateProfile(Auth.getUserId(), updates);
    if (error) {
        Toast.error('Failed to update profile');
        return;
    }
    
    Auth.currentProfile = { ...Auth.currentProfile, ...updates };
    Auth.updateUI();
    Toast.success('Profile updated!');
}

let bankOtpSession = null;

async function sendBankOTP() {
    const phone = Auth.currentProfile?.phone;
    if (!phone) {
        Toast.error('No phone number found. Please update your profile first.');
        return;
    }
    
    const btn = document.getElementById('bankOtpBtn');
    btn.disabled = true;
    btn.innerHTML = '<span class="loading-spinner sm"></span> Sending...';
    
    const fullPhone = phone.startsWith('91') ? phone : '91' + phone;
    const { sessionId, error } = await OTP.sendOTP(fullPhone);
    
    if (error) {
        Toast.error('Failed to send OTP');
        btn.disabled = false;
        btn.textContent = 'Send OTP';
        return;
    }
    
    bankOtpSession = sessionId;
    document.getElementById('bankOtpStep').classList.add('hidden');
    document.getElementById('bankOtpVerify').classList.remove('hidden');
    Toast.success('OTP sent!');
    
    btn.disabled = false;
    btn.textContent = 'Send OTP';
}

async function verifyBankOTP() {
    const otpInputs = document.querySelectorAll('#bankOtpVerify .otp-inputs input');
    let otp = '';
    otpInputs.forEach(i => otp += i.value);
    
    if (otp.length !== 6) {
        Toast.error('Enter complete OTP');
        return;
    }
    
    const btn = document.getElementById('verifyBankOtpBtn');
    btn.disabled = true;
    
    const { verified, error } = await OTP.verifyOTP(bankOtpSession, otp);
    
    if (!verified) {
        Toast.error('Invalid OTP');
        btn.disabled = false;
        return;
    }
    
    document.getElementById('bankOtpVerify').classList.add('hidden');
    document.getElementById('bankForm').classList.remove('hidden');
    Toast.success('Verified! Now fill your bank details.');
    
    btn.disabled = false;
}

async function saveBankDetails(e) {
    e.preventDefault();
    
    const bankData = {
        user_id: Auth.getUserId(),
        account_holder_name: document.getElementById('bankHolderName').value.trim(),
        account_number: document.getElementById('bankAccountNumber').value.trim(),
        ifsc_code: document.getElementById('bankIfsc').value.trim().toUpperCase(),
        bank_name: document.getElementById('bankName').value.trim(),
        branch_name: document.getElementById('bankBranch').value.trim(),
        is_verified: true
    };
    
    const { error } = await DB.upsertBankAccount(bankData);
    if (error) {
        Toast.error('Failed to save bank details');
        return;
    }
    
    Toast.success('Bank details saved successfully!');
    loadAccountPage();
}

async function deleteAddress(id) {
    if (!confirm('Delete this address?')) return;
    const { error } = await DB.deleteAddress(id);
    if (error) { Toast.error('Failed to delete'); return; }
    Toast.success('Address deleted');
    loadAccountPage();
}

async function setDefaultAddress(id) {
    // First unset all defaults
    const { data: addresses } = await DB.getAddresses(Auth.getUserId());
    for (const addr of addresses) {
        if (addr.is_default) {
            await DB.updateAddress(addr.id, { is_default: false });
        }
    }
    await DB.updateAddress(id, { is_default: true });
    Toast.success('Default address updated');
    loadAccountPage();
}
