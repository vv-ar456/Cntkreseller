// js/auth.js

const Auth = {
    currentUser: null,
    currentProfile: null,
    
    async init() {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
            this.currentUser = session.user;
            await this.loadProfile();
        }
        
        supabase.auth.onAuthStateChange(async (event, session) => {
            if (event === 'SIGNED_IN' && session) {
                this.currentUser = session.user;
                await this.loadProfile();
                this.updateUI();
            } else if (event === 'SIGNED_OUT') {
                this.currentUser = null;
                this.currentProfile = null;
                this.updateUI();
            }
        });
        
        this.updateUI();
    },
    
    async loadProfile() {
        if (!this.currentUser) return;
        const { data } = await DB.getProfile(this.currentUser.id);
        this.currentProfile = data;
    },
    
    isLoggedIn() {
        return !!this.currentUser;
    },
    
    requireAuth() {
        if (!this.isLoggedIn()) {
            this.showLoginModal();
            return false;
        }
        return true;
    },
    
    getUserId() {
        return this.currentUser?.id;
    },
    
    showLoginModal() {
        const overlay = document.getElementById('authModal');
        if (overlay) {
            overlay.classList.add('active');
            document.getElementById('authPhone')?.focus();
        }
    },
    
    hideLoginModal() {
        const overlay = document.getElementById('authModal');
        if (overlay) {
            overlay.classList.remove('active');
        }
        // Reset to phone step
        document.getElementById('phoneStep')?.classList.remove('hidden');
        document.getElementById('otpStep')?.classList.add('hidden');
        document.getElementById('nameStep')?.classList.add('hidden');
    },
    
    otpSessionId: null,
    phoneNumber: null,
    
    async sendLoginOTP() {
        const phoneInput = document.getElementById('authPhone');
        const phone = phoneInput?.value?.trim();
        
        if (!phone || phone.length < 10) {
            Toast.error('Please enter a valid 10-digit phone number');
            return;
        }
        
        const fullPhone = phone.startsWith('+91') ? phone : (phone.startsWith('91') ? phone : '91' + phone);
        this.phoneNumber = fullPhone;
        
        const sendBtn = document.getElementById('sendOtpBtn');
        sendBtn.disabled = true;
        sendBtn.innerHTML = '<span class="loading-spinner sm"></span> Sending...';
        
        const { sessionId, error } = await OTP.sendOTP(fullPhone);
        
        if (error) {
            Toast.error('Failed to send OTP: ' + error);
            sendBtn.disabled = false;
            sendBtn.textContent = 'Send OTP';
            return;
        }
        
        this.otpSessionId = sessionId;
        document.getElementById('phoneStep')?.classList.add('hidden');
        document.getElementById('otpStep')?.classList.remove('hidden');
        
        // Focus first OTP input
        document.querySelector('.otp-inputs input')?.focus();
        
        Toast.success('OTP sent successfully!');
        this.startResendTimer();
        
        sendBtn.disabled = false;
        sendBtn.textContent = 'Send OTP';
    },
    
    async verifyLoginOTP() {
        const otpInputs = document.querySelectorAll('#otpStep .otp-inputs input');
        let otp = '';
        otpInputs.forEach(input => otp += input.value);
        
        if (otp.length !== 6) {
            Toast.error('Please enter the complete 6-digit OTP');
            return;
        }
        
        const verifyBtn = document.getElementById('verifyOtpBtn');
        verifyBtn.disabled = true;
        verifyBtn.innerHTML = '<span class="loading-spinner sm"></span> Verifying...';
        
        const { verified, error } = await OTP.verifyOTP(this.otpSessionId, otp);
        
        if (!verified) {
            Toast.error(error || 'Invalid OTP. Please try again.');
            verifyBtn.disabled = false;
            verifyBtn.textContent = 'Verify OTP';
            return;
        }
        
        // OTP verified - sign in with Supabase
        const phone = this.phoneNumber.replace('91', '');
        const email = `${phone}@conitek.user`;
        const password = `conitek_${phone}_${this.otpSessionId}`;
        
        // Try to sign in first
        let { data, error: signInError } = await supabase.auth.signInWithPassword({
            email: email,
            password: password
        });
        
        if (signInError) {
            // User doesn't exist, create account
            const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
                email: email,
                password: password,
                options: {
                    data: {
                        phone: phone,
                        full_name: ''
                    }
                }
            });
            
            if (signUpError) {
                // Try alternate password for existing user
                const { data: retryData, error: retryError } = await supabase.auth.signInWithPassword({
                    email: email,
                    password: `conitek_${phone}_default`
                });
                
                if (retryError) {
                    // Last resort - update password and sign in
                    Toast.error('Authentication issue. Please try again.');
                    verifyBtn.disabled = false;
                    verifyBtn.textContent = 'Verify OTP';
                    return;
                }
                
                data = retryData;
            } else {
                data = signUpData;
                // Show name step for new users
                document.getElementById('otpStep')?.classList.add('hidden');
                document.getElementById('nameStep')?.classList.remove('hidden');
                document.getElementById('authName')?.focus();
                verifyBtn.disabled = false;
                verifyBtn.textContent = 'Verify OTP';
                return;
            }
        }
        
        Toast.success('Welcome back!');
        this.hideLoginModal();
        
        verifyBtn.disabled = false;
        verifyBtn.textContent = 'Verify OTP';
    },
    
    async completeRegistration() {
        const nameInput = document.getElementById('authName');
        const name = nameInput?.value?.trim();
        
        if (!name) {
            Toast.error('Please enter your name');
            return;
        }
        
        if (this.currentUser) {
            await DB.updateProfile(this.currentUser.id, {
                full_name: name,
                phone: this.phoneNumber?.replace('91', '')
            });
            await this.loadProfile();
        }
        
        Toast.success('Welcome to Conitek, ' + name + '!');
        this.hideLoginModal();
        this.updateUI();
    },
    
    async signOut() {
        await supabase.auth.signOut();
        this.currentUser = null;
        this.currentProfile = null;
        this.updateUI();
        Toast.info('Signed out successfully');
        window.location.href = '/';
    },
    
    resendTimer: null,
    
    startResendTimer() {
        let seconds = 30;
        const resendBtn = document.getElementById('resendOtpBtn');
        const timerSpan = document.getElementById('resendTimer');
        
        if (resendBtn) resendBtn.disabled = true;
        
        if (this.resendTimer) clearInterval(this.resendTimer);
        
        this.resendTimer = setInterval(() => {
            seconds--;
            if (timerSpan) timerSpan.textContent = `Resend in ${seconds}s`;
            
            if (seconds <= 0) {
                clearInterval(this.resendTimer);
                if (resendBtn) resendBtn.disabled = false;
                if (timerSpan) timerSpan.textContent = '';
            }
        }, 1000);
    },
    
    async resendOTP() {
        if (!this.phoneNumber) return;
        
        const { sessionId, error } = await OTP.sendOTP(this.phoneNumber);
        if (error) {
            Toast.error('Failed to resend OTP');
            return;
        }
        
        this.otpSessionId = sessionId;
        Toast.success('OTP resent!');
        this.startResendTimer();
    },
    
    updateUI() {
        // Update header
        const loginBtn = document.getElementById('loginBtn');
        const userMenu = document.getElementById('userMenuTrigger');
        const userAvatar = document.getElementById('userAvatar');
        const userName = document.getElementById('userName');
        
        if (this.isLoggedIn()) {
            if (loginBtn) loginBtn.classList.add('hidden');
            if (userMenu) userMenu.classList.remove('hidden');
            
            const name = this.currentProfile?.full_name || 'User';
            if (userAvatar) userAvatar.textContent = name.charAt(0).toUpperCase();
            if (userName) userName.textContent = name;
        } else {
            if (loginBtn) loginBtn.classList.remove('hidden');
            if (userMenu) userMenu.classList.add('hidden');
        }
        
        // Update cart badge
        this.updateCartBadge();
        this.updateNotifBadge();
    },
    
    async updateCartBadge() {
        if (!this.isLoggedIn()) return;
        const { count } = await DB.getCartCount(this.getUserId());
        const badges = document.querySelectorAll('.cart-badge');
        badges.forEach(b => {
            if (count > 0) {
                b.textContent = count;
                b.classList.remove('hidden');
            } else {
                b.classList.add('hidden');
            }
        });
    },
    
    async updateNotifBadge() {
        if (!this.isLoggedIn()) return;
        const { count } = await DB.getUnreadCount(this.getUserId());
        const badges = document.querySelectorAll('.notif-badge');
        badges.forEach(b => {
            if (count > 0) {
                b.textContent = count;
                b.classList.remove('hidden');
            } else {
                b.classList.add('hidden');
            }
        });
    }
};

// OTP input auto-focus behavior
function setupOTPInputs() {
    document.querySelectorAll('.otp-inputs').forEach(container => {
        const inputs = container.querySelectorAll('input');
        inputs.forEach((input, index) => {
            input.addEventListener('input', (e) => {
                if (e.target.value.length === 1 && index < inputs.length - 1) {
                    inputs[index + 1].focus();
                }
            });
            input.addEventListener('keydown', (e) => {
                if (e.key === 'Backspace' && !e.target.value && index > 0) {
                    inputs[index - 1].focus();
                }
            });
            input.addEventListener('paste', (e) => {
                e.preventDefault();
                const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
                pasted.split('').forEach((char, i) => {
                    if (inputs[i]) inputs[i].value = char;
                });
                if (inputs[pasted.length - 1]) inputs[pasted.length - 1].focus();
            });
        });
    });
  }
