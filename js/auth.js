// js/auth.js
// Conitek — Phone OTP Authentication via 2Factor.in + Supabase
// ─────────────────────────────────────────────────────────────────────────────
// HOW IT WORKS:
//   1. User enters phone → OTP sent via 2Factor.in
//   2. User enters OTP  → verified via 2Factor.in
//   3. We derive a STABLE password from phone: conitek_<phone>_v1
//      (same phone = same password always → existing users can always sign in)
//   4. Try signInWithPassword → if user not found → signUp → show name step
//   5. On new user: save name + phone in profiles table
// ─────────────────────────────────────────────────────────────────────────────

const Auth = {
    currentUser:    null,
    currentProfile: null,
    otpSessionId:   null,
    phoneNumber:    null,   // stored as "919876543210"
    resendTimer:    null,

    // ── Stable password — derived only from phone, never changes ──────────
    _makePassword(phone10digit) {
        // phone10digit = 10-digit number e.g. "9876543210"
        return `conitek_${phone10digit}_v1`;
    },

    // ── Supabase email alias (Supabase needs email, we fake it from phone) ─
    _makeEmail(phone10digit) {
        return `${phone10digit}@conitek.user`;
    },

    // ─────────────────────────────────────────────────────────────────────
    // INIT — call this on every page load
    // ─────────────────────────────────────────────────────────────────────
    async init() {
        try {
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
                    this.currentUser    = null;
                    this.currentProfile = null;
                    this.updateUI();
                }
            });
        } catch(e) {
            console.error('Auth init error:', e);
        }

        this.updateUI();
        setupOTPInputs();
    },

    async loadProfile() {
        if (!this.currentUser) return;
        try {
            const { data } = await DB.getProfile(this.currentUser.id);
            this.currentProfile = data;
        } catch(e) {
            console.error('Profile load error:', e);
        }
    },

    isLoggedIn()  { return !!this.currentUser; },
    getUserId()   { return this.currentUser?.id; },

    requireAuth() {
        if (!this.isLoggedIn()) { this.showLoginModal(); return false; }
        return true;
    },

    // ─────────────────────────────────────────────────────────────────────
    // MODAL CONTROLS
    // ─────────────────────────────────────────────────────────────────────
    showLoginModal() {
        const modal = document.getElementById('authModal');
        if (!modal) return;
        modal.classList.add('active');
        this._goToStep(1);
        setTimeout(() => document.getElementById('authPhone')?.focus(), 100);
    },

    hideLoginModal() {
        document.getElementById('authModal')?.classList.remove('active');
        this._goToStep(1);
    },

    goBackToPhone() {
        this._goToStep(1);
        document.getElementById('authPhone')?.focus();
    },

    // step = 1 (phone), 2 (otp), 3 (name)
    _goToStep(step) {
        document.getElementById('phoneStep')?.classList.toggle('hidden', step !== 1);
        document.getElementById('otpStep')  ?.classList.toggle('hidden', step !== 2);
        document.getElementById('nameStep') ?.classList.toggle('hidden', step !== 3);

        // Update step dots
        for (let i = 1; i <= 3; i++) {
            document.getElementById('dot' + i)?.classList.toggle('active', i <= step);
        }
    },

    // ─────────────────────────────────────────────────────────────────────
    // STEP 1 — Send OTP
    // ─────────────────────────────────────────────────────────────────────
    async sendLoginOTP() {
        const rawPhone = (document.getElementById('authPhone')?.value || '').replace(/\D/g, '').trim();

        if (rawPhone.length !== 10) {
            Toast.error('Please enter a valid 10-digit mobile number');
            document.getElementById('authPhone')?.focus();
            return;
        }

        const fullPhone    = '91' + rawPhone;   // "919876543210"
        this.phoneNumber   = fullPhone;

        const sendBtn = document.getElementById('sendOtpBtn');
        sendBtn.disabled = true;
        sendBtn.innerHTML = '<span class="loading-spinner sm"></span> Sending OTP...';

        try {
            const { sessionId, error } = await OTP.sendOTP(fullPhone);

            if (error) {
                Toast.error('OTP send failed: ' + error);
                return;
            }

            this.otpSessionId = sessionId;

            // Show phone number in OTP step
            const formatted = rawPhone.replace(/(\d{5})(\d{5})/, '$1 $2');
            const el = document.getElementById('displayPhone');
            if (el) el.textContent = '+91 ' + formatted;

            // Clear previous OTP inputs
            document.querySelectorAll('#otpBoxes input').forEach(i => {
                i.value = '';
                i.classList.remove('filled');
            });

            this._goToStep(2);
            setTimeout(() => document.querySelector('#otpBoxes input')?.focus(), 100);

            Toast.success('OTP sent to +91 ' + formatted);
            this.startResendTimer();

        } catch(e) {
            Toast.error('Something went wrong. Please try again.');
        } finally {
            sendBtn.disabled = false;
            sendBtn.textContent = 'Send OTP →';
        }
    },

    // ─────────────────────────────────────────────────────────────────────
    // STEP 2 — Verify OTP
    // ─────────────────────────────────────────────────────────────────────
    async verifyLoginOTP() {
        const inputs = document.querySelectorAll('#otpBoxes input');
        const otp    = [...inputs].map(i => i.value).join('');

        if (otp.length !== 6) {
            Toast.error('Please enter the complete 6-digit OTP');
            return;
        }

        const verifyBtn = document.getElementById('verifyOtpBtn');
        verifyBtn.disabled = true;
        verifyBtn.innerHTML = '<span class="loading-spinner sm"></span> Verifying...';

        try {
            const { verified, error } = await OTP.verifyOTP(this.otpSessionId, otp);

            if (!verified) {
                Toast.error(error || 'Incorrect OTP. Please try again.');
                // Shake effect
                document.getElementById('otpBoxes')?.classList.add('shake');
                setTimeout(() => document.getElementById('otpBoxes')?.classList.remove('shake'), 600);
                inputs.forEach(i => { i.value = ''; i.classList.remove('filled'); });
                inputs[0]?.focus();
                return;
            }

            // ── OTP verified → authenticate with Supabase ──────────────
            await this._authenticateUser();

        } catch(e) {
            Toast.error('Verification failed. Please try again.');
            console.error('OTP verify error:', e);
        } finally {
            verifyBtn.disabled = false;
            verifyBtn.textContent = 'Verify OTP ✓';
        }
    },

    // ─────────────────────────────────────────────────────────────────────
    // SUPABASE AUTH — sign in or sign up
    // ─────────────────────────────────────────────────────────────────────
    async _authenticateUser() {
        const phone10 = this.phoneNumber.replace(/^91/, '');   // "9876543210"
        const email    = this._makeEmail(phone10);
        const password = this._makePassword(phone10);

        // 1. Try sign in first (existing user)
        const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
            email, password
        });

        if (!signInError && signInData?.user) {
            // ✅ Existing user signed in
            Toast.success('Welcome back! 👋');
            this.hideLoginModal();
            return;
        }

        // 2. User not found → create new account
        const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
            email,
            password,
            options: {
                data: { phone: phone10, full_name: '' }
            }
        });

        if (signUpError) {
            // Edge case: account exists but password was different (old version)
            // Attempt with legacy password formats
            const legacyPasswords = [
                `conitek_${phone10}_default`,
                `conitek_${phone10}_secure`,
            ];

            for (const legacyPwd of legacyPasswords) {
                const { data: retryData, error: retryError } = await supabase.auth.signInWithPassword({
                    email, password: legacyPwd
                });
                if (!retryError && retryData?.user) {
                    // Found with legacy password → update to new stable password
                    await supabase.auth.updateUser({ password });
                    Toast.success('Welcome back! 👋');
                    this.hideLoginModal();
                    return;
                }
            }

            Toast.error('Login failed. Please try again.');
            console.error('Auth error:', signUpError);
            return;
        }

        // 3. New user signed up → show name step
        this._goToStep(3);
        setTimeout(() => document.getElementById('authName')?.focus(), 100);
    },

    // ─────────────────────────────────────────────────────────────────────
    // STEP 3 — Complete Registration (new users only)
    // ─────────────────────────────────────────────────────────────────────
    async completeRegistration() {
        const name     = document.getElementById('authName')?.value?.trim();
        const referral = document.getElementById('authReferral')?.value?.trim().toUpperCase() || null;

        if (!name || name.length < 2) {
            Toast.error('Please enter your name (at least 2 characters)');
            document.getElementById('authName')?.focus();
            return;
        }

        const regBtn = document.getElementById('registerBtn');
        regBtn.disabled = true;
        regBtn.innerHTML = '<span class="loading-spinner sm"></span> Creating account...';

        try {
            // Wait for auth state to settle if needed
            let uid = this.currentUser?.id;
            if (!uid) {
                await new Promise(r => setTimeout(r, 800));
                uid = this.currentUser?.id;
            }

            if (uid) {
                const phone10 = this.phoneNumber?.replace(/^91/, '') || '';
                await DB.updateProfile(uid, {
                    full_name:    name,
                    phone:        phone10,
                    referral_code: referral
                });
                await this.loadProfile();
            }

            Toast.success(`Welcome to Conitek, ${name}! 🎉`);
            this.hideLoginModal();
            this.updateUI();

            // Reload account page if we're on it
            if (typeof loadAccountPage === 'function') loadAccountPage();

        } catch(e) {
            Toast.error('Could not save profile. Please try again.');
            console.error('Registration error:', e);
        } finally {
            regBtn.disabled = false;
            regBtn.textContent = 'Create Account 🎉';
        }
    },

    // ─────────────────────────────────────────────────────────────────────
    // RESEND OTP
    // ─────────────────────────────────────────────────────────────────────
    async resendOTP() {
        if (!this.phoneNumber) return;

        const resendBtn  = document.getElementById('resendOtpBtn');
        resendBtn.disabled = true;
        resendBtn.textContent = 'Sending...';

        try {
            const { sessionId, error } = await OTP.sendOTP(this.phoneNumber);
            if (error) { Toast.error('Resend failed: ' + error); return; }

            this.otpSessionId = sessionId;
            Toast.success('OTP resent!');
            this.startResendTimer();

            // Clear inputs
            document.querySelectorAll('#otpBoxes input').forEach(i => {
                i.value = '';
                i.classList.remove('filled');
            });
            document.querySelector('#otpBoxes input')?.focus();

        } catch(e) {
            Toast.error('Resend failed. Please try again.');
        } finally {
            resendBtn.textContent = 'Resend OTP';
        }
    },

    startResendTimer(seconds = 30) {
        const resendBtn  = document.getElementById('resendOtpBtn');
        const timerSpan  = document.getElementById('resendTimer');

        if (resendBtn)  resendBtn.disabled = true;
        if (this.resendTimer) clearInterval(this.resendTimer);

        let s = seconds;
        const tick = () => {
            if (timerSpan) timerSpan.textContent = `Resend in ${s}s`;
            if (--s < 0) {
                clearInterval(this.resendTimer);
                if (resendBtn) resendBtn.disabled = false;
                if (timerSpan) timerSpan.textContent = '';
            }
        };
        tick();
        this.resendTimer = setInterval(tick, 1000);
    },

    // ─────────────────────────────────────────────────────────────────────
    // SIGN OUT
    // ─────────────────────────────────────────────────────────────────────
    async signOut() {
        try {
            await supabase.auth.signOut();
        } catch(e) {
            console.error('Sign out error:', e);
        }
        this.currentUser    = null;
        this.currentProfile = null;
        this.updateUI();
        Toast.info('Signed out. See you soon! 👋');
        setTimeout(() => window.location.href = 'index.html', 800);
    },

    // ─────────────────────────────────────────────────────────────────────
    // UPDATE UI — header login/user display
    // ─────────────────────────────────────────────────────────────────────
    updateUI() {
        const loginBtn  = document.getElementById('loginBtn');
        const userMenu  = document.getElementById('userMenuTrigger');
        const userAvatar = document.getElementById('userAvatar');
        const userName  = document.getElementById('userName');

        if (this.isLoggedIn()) {
            loginBtn?.classList.add('hidden');
            userMenu?.classList.remove('hidden');
            const name = this.currentProfile?.full_name || 'User';
            if (userAvatar) userAvatar.textContent = name.charAt(0).toUpperCase();
            if (userName)   userName.textContent   = name;
        } else {
            loginBtn?.classList.remove('hidden');
            userMenu?.classList.add('hidden');
        }

        // User menu dropdown toggle
        const trigger = document.getElementById('userMenuTrigger');
        const dropdown = document.getElementById('userDropdown');
        if (trigger && dropdown && !trigger._bound) {
            trigger._bound = true;
            trigger.addEventListener('click', (e) => {
                e.stopPropagation();
                dropdown.classList.toggle('active');
            });
            document.addEventListener('click', () => dropdown.classList.remove('active'));
        }

        this.updateCartBadge();
        this.updateNotifBadge();
    },

    async updateCartBadge() {
        if (!this.isLoggedIn()) return;
        try {
            const { count } = await DB.getCartCount(this.getUserId());
            document.querySelectorAll('.cart-badge').forEach(b => {
                b.textContent = count;
                b.classList.toggle('hidden', !count);
            });
        } catch(e) {}
    },

    async updateNotifBadge() {
        if (!this.isLoggedIn()) return;
        try {
            const { count } = await DB.getUnreadCount(this.getUserId());
            document.querySelectorAll('.notif-badge').forEach(b => {
                b.textContent = count;
                b.classList.toggle('hidden', !count);
            });
        } catch(e) {}
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// OTP INPUT — auto-focus, backspace, paste, filled class
// ─────────────────────────────────────────────────────────────────────────────
function setupOTPInputs() {
    document.querySelectorAll('.otp-inputs').forEach(container => {
        const inputs = [...container.querySelectorAll('input')];

        inputs.forEach((input, idx) => {

            // Auto-advance on input
            input.addEventListener('input', (e) => {
                const val = e.target.value.replace(/\D/g, '');
                e.target.value = val.slice(-1); // keep only last digit
                e.target.classList.toggle('filled', !!e.target.value);

                if (e.target.value && idx < inputs.length - 1) {
                    inputs[idx + 1].focus();
                }

                // Auto-submit if all filled
                if (inputs.every(i => i.value)) {
                    setTimeout(() => Auth.verifyLoginOTP(), 200);
                }
            });

            // Backspace → go back
            input.addEventListener('keydown', (e) => {
                if (e.key === 'Backspace') {
                    if (!e.target.value && idx > 0) {
                        inputs[idx - 1].value = '';
                        inputs[idx - 1].classList.remove('filled');
                        inputs[idx - 1].focus();
                    } else {
                        e.target.classList.remove('filled');
                    }
                }
                if (e.key === 'Enter') Auth.verifyLoginOTP();
            });

            // Select all on focus (easy replace)
            input.addEventListener('focus', (e) => e.target.select());

            // Paste full OTP
            input.addEventListener('paste', (e) => {
                e.preventDefault();
                const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
                pasted.split('').forEach((char, i) => {
                    if (inputs[i]) {
                        inputs[i].value = char;
                        inputs[i].classList.add('filled');
                    }
                });
                const nextEmpty = inputs.findIndex(i => !i.value);
                (nextEmpty >= 0 ? inputs[nextEmpty] : inputs[inputs.length - 1]).focus();

                if (pasted.length === 6) {
                    setTimeout(() => Auth.verifyLoginOTP(), 300);
                }
            });
        });
    });
}
