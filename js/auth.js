// js/auth.js — Conitek OTP Auth + KYC flow

const Auth = {
    currentUser:    null,
    currentProfile: null,
    otpSessionId:   null,
    phoneNumber:    null,
    resendTimer:    null,

    _pwd(p)   { return `conitek_${p}_v1`; },
    _email(p) { return `${p}@conitek.user`; },

    // ── INIT ─────────────────────────────────────────────────────
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
                    this.currentUser = null;
                    this.currentProfile = null;
                    this.updateUI();
                }
            });
        } catch(e) { console.error('Auth init:', e); }
        this.updateUI();
        this._setupOTPInputs();
    },

    async loadProfile() {
        if (!this.currentUser) return;
        try {
            const { data } = await DB.getProfile(this.currentUser.id);
            this.currentProfile = data;
        } catch(e) {}
    },

    isLoggedIn()  { return !!this.currentUser; },
    getUserId()   { return this.currentUser?.id; },
    requireAuth() {
        if (!this.isLoggedIn()) { this.showLoginModal(); return false; }
        return true;
    },

    // ── MODAL ────────────────────────────────────────────────────
    showLoginModal() {
        const modal = document.getElementById('authModal');
        if (!modal) return;
        modal.classList.add('active');
        this._goToStep(1);
        setTimeout(() => document.getElementById('authPhone')?.focus(), 150);
    },
    hideLoginModal() {
        document.getElementById('authModal')?.classList.remove('active');
        this._goToStep(1);
    },
    goBackToPhone() {
        this._goToStep(1);
        setTimeout(() => document.getElementById('authPhone')?.focus(), 100);
    },

    _goToStep(step) {
        const ids = ['phoneStep','otpStep','nameStep'];
        ids.forEach((id, i) => {
            const el = document.getElementById(id);
            if (el) el.style.display = (i + 1 === step) ? '' : 'none';
        });
        for (let i = 1; i <= 3; i++) {
            const dot = document.getElementById('dot' + i);
            if (!dot) continue;
            dot.style.background = i <= step ? '#6c47ff' : '#e5e7eb';
            dot.style.width = i === step ? '20px' : '6px';
        }
    },

    // ── SEND OTP ─────────────────────────────────────────────────
    async sendLoginOTP() {
        const raw = (document.getElementById('authPhone')?.value || '').replace(/\D/g,'').trim();
        if (raw.length !== 10) {
            this._toast('Enter a valid 10-digit number', 'error'); return;
        }
        this.phoneNumber = '91' + raw;
        const btn = document.getElementById('sendOtpBtn');
        btn.disabled = true;
        btn.innerHTML = '<span class="mini-spin"></span> Sending...';

        try {
            const { sessionId, error } = await OTP.sendOTP(this.phoneNumber);
            if (error) throw new Error(error);

            this.otpSessionId = sessionId;
            const fmt = raw.replace(/(\d{5})(\d{5})/,'$1 $2');
            const dp  = document.getElementById('displayPhone');
            if (dp) dp.textContent = '+91 ' + fmt;

            // Reset OTP boxes
            document.querySelectorAll('#otpBoxes .otp-box').forEach(b => {
                b.value = '';
                b.style.borderColor = '#e5e7eb';
                b.style.background  = '#fafafa';
            });

            this._goToStep(2);
            setTimeout(() => document.querySelector('#otpBoxes .otp-box')?.focus(), 100);
            this._toast('OTP sent! 📱', 'success');
            this.startResendTimer();
        } catch(e) {
            this._toast('OTP send failed: ' + e.message, 'error');
        } finally {
            btn.disabled = false;
            btn.textContent = 'Send OTP →';
        }
    },

    // ── VERIFY OTP ───────────────────────────────────────────────
    async verifyLoginOTP() {
        const boxes = document.querySelectorAll('#otpBoxes .otp-box');
        const otp   = [...boxes].map(b => b.value).join('');

        if (otp.length !== 6) {
            // Don't show error if still typing
            if (otp.length > 0) this._toast('Enter all 6 digits', 'error');
            return;
        }

        const btn = document.getElementById('verifyOtpBtn');
        if (btn) { btn.disabled = true; btn.innerHTML = '<span class="mini-spin"></span> Verifying...'; }

        try {
            const { verified, error } = await OTP.verifyOTP(this.otpSessionId, otp);

            if (!verified) {
                this._toast(error || 'Incorrect OTP. Try again.', 'error');
                boxes.forEach(b => {
                    b.style.borderColor = '#ef4444';
                    b.value = '';
                    b.style.background = '#fafafa';
                });
                document.querySelector('#otpBoxes .otp-box')?.focus();
                if (btn) { btn.disabled = false; btn.textContent = 'Verify OTP ✓'; }
                return;
            }

            await this._authenticateUser();

        } catch(e) {
            this._toast('Error: ' + e.message, 'error');
            if (btn) { btn.disabled = false; btn.textContent = 'Verify OTP ✓'; }
        }
    },

    // ── SUPABASE AUTH ────────────────────────────────────────────
    async _authenticateUser() {
        const phone10  = this.phoneNumber.replace(/^91/,'');
        const email    = this._email(phone10);
        const password = this._pwd(phone10);

        // Try sign in existing user
        const { data: si, error: siErr } = await supabase.auth.signInWithPassword({ email, password });
        if (!siErr && si?.user) {
            this._toast('Welcome back! 👋', 'success');
            this.hideLoginModal();
            await this.loadProfile();
            this._checkKycOnLogin();
            return;
        }

        // New user signup
        const { data: su, error: suErr } = await supabase.auth.signUp({
            email, password,
            options: { data: { phone: phone10, full_name: '' } }
        });

        if (suErr) {
            // Legacy password fallback
            for (const lp of [`conitek_${phone10}_default`,`conitek_${phone10}_secure`]) {
                const { data: rd } = await supabase.auth.signInWithPassword({ email, password: lp });
                if (rd?.user) {
                    await supabase.auth.updateUser({ password });
                    this._toast('Welcome back! 👋', 'success');
                    this.hideLoginModal();
                    return;
                }
            }
            this._toast('Auth failed. Please try again.', 'error');
            const btn = document.getElementById('verifyOtpBtn');
            if (btn) { btn.disabled = false; btn.textContent = 'Verify OTP ✓'; }
            return;
        }

        // New user → show name step
        this._goToStep(3);
        const btn = document.getElementById('verifyOtpBtn');
        if (btn) { btn.disabled = false; btn.textContent = 'Verify OTP ✓'; }
        setTimeout(() => document.getElementById('authName')?.focus(), 100);
    },

    // ── NAME STEP → KYC ──────────────────────────────────────────
    async completeRegistration() {
        const name = document.getElementById('authName')?.value?.trim();
        if (!name || name.length < 2) {
            this._toast('Please enter your name (min 2 chars)', 'error'); return;
        }
        const btn = document.getElementById('registerBtn');
        btn.disabled = true;
        btn.innerHTML = '<span class="mini-spin"></span> Saving...';

        try {
            await new Promise(r => setTimeout(r, 700));
            const uid = this.currentUser?.id;
            if (uid) {
                await DB.updateProfile(uid, {
                    full_name:  name,
                    phone:      this.phoneNumber?.replace(/^91/,'') || '',
                    kyc_status: 'not_submitted',
                });
                await this.loadProfile();
            }
            this.hideLoginModal();
            this.updateUI();
            this._toast('Welcome, ' + name + '! 👋', 'success');

            // Open KYC modal after short delay
            setTimeout(() => {
                if (typeof showKycModal === 'function') showKycModal();
            }, 700);
        } catch(e) {
            this._toast('Error: ' + e.message, 'error');
        } finally {
            btn.disabled = false;
            btn.textContent = 'Continue to KYC →';
        }
    },

    _checkKycOnLogin() {
        const st = this.currentProfile?.kyc_status;
        if (!st || st === 'not_submitted') {
            setTimeout(() => {
                if (typeof showKycModal === 'function') showKycModal();
            }, 800);
        }
    },

    // ── RESEND ───────────────────────────────────────────────────
    async resendOTP() {
        if (!this.phoneNumber) return;
        const btn = document.getElementById('resendOtpBtn');
        if (btn) { btn.disabled = true; btn.textContent = 'Sending...'; }
        try {
            const { sessionId, error } = await OTP.sendOTP(this.phoneNumber);
            if (error) throw new Error(error);
            this.otpSessionId = sessionId;
            this._toast('OTP resent!', 'success');
            this.startResendTimer();
            document.querySelectorAll('#otpBoxes .otp-box').forEach(b => {
                b.value = ''; b.style.borderColor = '#e5e7eb'; b.style.background = '#fafafa';
            });
            document.querySelector('#otpBoxes .otp-box')?.focus();
        } catch(e) {
            this._toast('Resend failed', 'error');
        } finally {
            if (btn) btn.textContent = 'Resend OTP';
        }
    },

    startResendTimer(s = 30) {
        const btn  = document.getElementById('resendOtpBtn');
        const span = document.getElementById('resendTimer');
        if (btn) btn.disabled = true;
        if (this.resendTimer) clearInterval(this.resendTimer);
        let sec = s;
        const tick = () => {
            if (span) span.textContent = sec > 0 ? `Resend in ${sec}s` : '';
            if (--sec < 0) { clearInterval(this.resendTimer); if (btn) btn.disabled = false; }
        };
        tick();
        this.resendTimer = setInterval(tick, 1000);
    },

    // ── SIGN OUT ──────────────────────────────────────────────────
    async signOut() {
        try { await supabase.auth.signOut(); } catch(e) {}
        this.currentUser = null; this.currentProfile = null;
        this.updateUI();
        this._toast('Signed out 👋', 'info');
        setTimeout(() => location.href = 'index.html', 600);
    },

    // ── UPDATE UI ─────────────────────────────────────────────────
    updateUI() {
        const loginBtn   = document.getElementById('loginBtn');
        const userMenu   = document.getElementById('userMenuTrigger');
        const userAvatar = document.getElementById('userAvatar');
        const userName   = document.getElementById('userName');

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

        const trigger  = document.getElementById('userMenuTrigger');
        const dropdown = document.getElementById('userDropdown');
        if (trigger && dropdown && !trigger._dd) {
            trigger._dd = true;
            trigger.addEventListener('click', e => { e.stopPropagation(); dropdown.classList.toggle('active'); });
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
                b.textContent = count; b.classList.toggle('hidden', !count);
            });
        } catch(e) {}
    },

    async updateNotifBadge() {
        if (!this.isLoggedIn()) return;
        try {
            const { count } = await DB.getUnreadCount(this.getUserId());
            document.querySelectorAll('.notif-badge').forEach(b => {
                b.textContent = count; b.classList.toggle('hidden', !count);
            });
        } catch(e) {}
    },

    // ── TOAST ─────────────────────────────────────────────────────
    _toast(msg, type='info') {
        if (typeof Toast !== 'undefined') {
            if (type==='success') Toast.success(msg);
            else if (type==='error') Toast.error(msg);
            else Toast.info(msg);
            return;
        }
        let c = document.getElementById('_authToasts');
        if (!c) {
            c = document.createElement('div');
            c.id = '_authToasts';
            c.style.cssText = 'position:fixed;bottom:20px;left:50%;transform:translateX(-50%);z-index:9999;display:flex;flex-direction:column;gap:8px;align-items:center;pointer-events:none;';
            document.body.appendChild(c);
        }
        const t = document.createElement('div');
        const bg = type==='success' ? '#f0fdf4;color:#16a34a;border:1px solid #bbf7d0'
                 : type==='error'   ? '#fef2f2;color:#dc2626;border:1px solid #fecaca'
                 :                    '#eff6ff;color:#1d4ed8;border:1px solid #bfdbfe';
        t.style.cssText = `padding:10px 18px;border-radius:10px;font-size:13px;font-weight:600;box-shadow:0 4px 16px rgba(0,0,0,.12);white-space:nowrap;background:${bg};`;
        t.textContent = msg;
        c.appendChild(t);
        setTimeout(() => t.remove(), 3000);
    },

    // ── OTP INPUT SETUP ───────────────────────────────────────────
    _setupOTPInputs() {
        const container = document.getElementById('otpBoxes');
        if (!container) return;
        const inputs = [...container.querySelectorAll('.otp-box')];
        if (!inputs.length) return;

        inputs.forEach((inp, idx) => {
            inp.addEventListener('input', e => {
                const val = e.target.value.replace(/\D/g,'');
                e.target.value = val.slice(-1);
                e.target.style.borderColor = val ? '#6c47ff' : '#e5e7eb';
                e.target.style.background  = val ? '#f5f0ff' : '#fafafa';
                if (val && idx < inputs.length - 1) inputs[idx+1].focus();
                if (inputs.every(i => i.value)) setTimeout(() => Auth.verifyLoginOTP(), 250);
            });

            inp.addEventListener('keydown', e => {
                if (e.key === 'Backspace' && !e.target.value && idx > 0) {
                    inputs[idx-1].value = '';
                    inputs[idx-1].style.borderColor = '#e5e7eb';
                    inputs[idx-1].style.background  = '#fafafa';
                    inputs[idx-1].focus();
                }
                if (e.key === 'Enter') Auth.verifyLoginOTP();
            });

            inp.addEventListener('focus', e => e.target.select());

            inp.addEventListener('paste', e => {
                e.preventDefault();
                const pasted = e.clipboardData.getData('text').replace(/\D/g,'').slice(0,6);
                pasted.split('').forEach((ch,i) => {
                    if (inputs[i]) {
                        inputs[i].value = ch;
                        inputs[i].style.borderColor = '#6c47ff';
                        inputs[i].style.background  = '#f5f0ff';
                    }
                });
                const next = inputs.findIndex(i => !i.value);
                (next>=0 ? inputs[next] : inputs[inputs.length-1]).focus();
                if (pasted.length === 6) setTimeout(() => Auth.verifyLoginOTP(), 300);
            });
        });
    }
};

function setupOTPInputs() { Auth._setupOTPInputs(); }
