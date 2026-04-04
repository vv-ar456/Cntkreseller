// js/auth.js

const Auth = {
    currentUser: null, currentProfile: null,
    otpSessionId: null, phoneNumber: null, resendTimer: null,

    _pwd(p)   { return `conitek_${p}_v1`; },
    _email(p) { return `${p}@conitek.user`; },

    // ── INIT ──────────────────────────────────────────────────────
    async init() {
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (session) { this.currentUser = session.user; await this.loadProfile(); }

            supabase.auth.onAuthStateChange(async (event, session) => {
                if (event === 'SIGNED_IN' && session) {
                    this.currentUser = session.user;
                    await this.loadProfile();
                    this.updateUI();
                } else if (event === 'SIGNED_OUT') {
                    this.currentUser = null; this.currentProfile = null;
                    this.updateUI();
                }
            });
        } catch(e) { console.error('Auth init:', e); }
        this.updateUI();
    },

    async loadProfile() {
        if (!this.currentUser) return;
        try { const { data } = await DB.getProfile(this.currentUser.id); this.currentProfile = data; } catch(e) {}
    },

    isLoggedIn()  { return !!this.currentUser; },
    getUserId()   { return this.currentUser?.id; },
    requireAuth() { if (!this.isLoggedIn()) { this.showLoginModal(); return false; } return true; },

    // ── MODAL ─────────────────────────────────────────────────────
    showLoginModal() {
        const m = document.getElementById('authModal');
        if (!m) return;
        m.classList.add('active');
        this._step(1);
        setTimeout(() => document.getElementById('authPhone')?.focus(), 150);
    },
    hideLoginModal() {
        document.getElementById('authModal')?.classList.remove('active');
        this._step(1);
    },
    goBackToPhone() {
        this._step(1);
        setTimeout(() => document.getElementById('authPhone')?.focus(), 100);
    },
    _step(n) {
        ['phoneStep','otpStep','nameStep'].forEach((id, i) => {
            const el = document.getElementById(id);
            if (el) el.style.display = (i + 1 === n) ? '' : 'none';
        });
        for (let i = 1; i <= 3; i++) {
            const d = document.getElementById('dot' + i);
            if (d) { d.classList.toggle('on', i <= n); }
        }
        // Focus OTP input when going to step 2
        if (n === 2) setTimeout(() => {
            if (typeof focusOtpInput === 'function') focusOtpInput();
        }, 150);
    },

    // ── SEND OTP ──────────────────────────────────────────────────
    async sendLoginOTP() {
        const raw = (document.getElementById('authPhone')?.value || '').replace(/\D/g,'').trim();
        if (raw.length !== 10) { this._toast('Enter a valid 10-digit number', 'err'); return; }

        this.phoneNumber = '91' + raw;
        const btn = document.getElementById('sendOtpBtn');
        btn.disabled = true;
        btn.innerHTML = '<span class="a-spin"></span> Sending...';

        try {
            const { sessionId, error } = await OTP.sendOTP(this.phoneNumber);
            if (error) throw new Error(error);
            this.otpSessionId = sessionId;

            const fmt = raw.replace(/(\d{5})(\d{5})/, '$1 $2');
            const dp  = document.getElementById('displayPhone');
            if (dp) dp.textContent = '+91 ' + fmt;

            // Clear OTP cells
            if (typeof clearOTP === 'function') clearOTP();

            this._step(2);
            this._toast('OTP sent! 📱', 'ok');
            this.startResendTimer();
        } catch(e) {
            this._toast('Failed to send OTP: ' + e.message, 'err');
        } finally {
            btn.disabled = false; btn.textContent = 'Send OTP →';
        }
    },

    // ── VERIFY OTP ────────────────────────────────────────────────
    async verifyLoginOTP() {
        // Get OTP from the div-cell system or fallback to old input
        const otp = typeof getOTPValue === 'function'
            ? getOTPValue()
            : [...document.querySelectorAll('#otpBoxes .otp-box')].map(b => b.value).join('');

        if (otp.length !== 6) {
            if (otp.length > 0) this._toast('Enter all 6 digits', 'err');
            return;
        }

        const btn = document.getElementById('verifyOtpBtn');
        if (btn) { btn.disabled = true; btn.innerHTML = '<span class="a-spin"></span> Verifying...'; }

        try {
            const { verified, error } = await OTP.verifyOTP(this.otpSessionId, otp);

            if (!verified) {
                this._toast(error || 'Incorrect OTP. Try again.', 'err');
                if (typeof shakeOTP === 'function') shakeOTP();
                if (typeof clearOTP === 'function') clearOTP();
                if (btn) { btn.disabled = false; btn.textContent = 'Verify OTP ✓'; }
                return;
            }

            await this._auth();

        } catch(e) {
            this._toast('Error: ' + e.message, 'err');
            if (btn) { btn.disabled = false; btn.textContent = 'Verify OTP ✓'; }
        }
    },

    // ── SUPABASE AUTH ─────────────────────────────────────────────
    async _auth() {
        const p10  = this.phoneNumber.replace(/^91/, '');
        const email = this._email(p10), pwd = this._pwd(p10);

        // Existing user
        const { data: si, error: siErr } = await supabase.auth.signInWithPassword({ email, password: pwd });
        if (!siErr && si?.user) {
            this._toast('Welcome back! 👋', 'ok');
            this.hideLoginModal();
            await this.loadProfile();
            this._kycCheck();
            return;
        }

        // New user
        const { error: suErr } = await supabase.auth.signUp({
            email, password: pwd, options: { data: { phone: p10, full_name: '' } }
        });

        if (suErr) {
            // Legacy password fallback
            for (const lp of [`conitek_${p10}_default`, `conitek_${p10}_secure`]) {
                const { data: rd } = await supabase.auth.signInWithPassword({ email, password: lp });
                if (rd?.user) {
                    await supabase.auth.updateUser({ password: pwd });
                    this._toast('Welcome back! 👋', 'ok');
                    this.hideLoginModal();
                    return;
                }
            }
            this._toast('Auth failed. Try again.', 'err');
            const btn = document.getElementById('verifyOtpBtn');
            if (btn) { btn.disabled = false; btn.textContent = 'Verify OTP ✓'; }
            return;
        }

        // New user — name step
        this._step(3);
        const btn = document.getElementById('verifyOtpBtn');
        if (btn) { btn.disabled = false; btn.textContent = 'Verify OTP ✓'; }
        setTimeout(() => document.getElementById('authName')?.focus(), 100);
    },

    // ── NAME → KYC ───────────────────────────────────────────────
    async completeRegistration() {
        const name = document.getElementById('authName')?.value?.trim();
        if (!name || name.length < 2) { this._toast('Please enter your name', 'err'); return; }

        const btn = document.getElementById('registerBtn');
        btn.disabled = true; btn.innerHTML = '<span class="a-spin"></span> Saving...';

        try {
            await new Promise(r => setTimeout(r, 700));
            const uid = this.currentUser?.id;
            if (uid) {
                await DB.updateProfile(uid, {
                    full_name: name,
                    phone: this.phoneNumber?.replace(/^91/, '') || '',
                    kyc_status: 'not_submitted',
                });
                await this.loadProfile();
            }
            this.hideLoginModal();
            this.updateUI();
            this._toast('Welcome, ' + name + '! 👋', 'ok');
            setTimeout(() => { if (typeof showKycModal === 'function') showKycModal(); }, 700);
        } catch(e) {
            this._toast('Error: ' + e.message, 'err');
        } finally {
            btn.disabled = false; btn.textContent = 'Continue →';
        }
    },

    _kycCheck() {
        const st = this.currentProfile?.kyc_status;
        if (!st || st === 'not_submitted') {
            setTimeout(() => { if (typeof showKycModal === 'function') showKycModal(); }, 900);
        }
    },

    // ── RESEND ────────────────────────────────────────────────────
    async resendOTP() {
        if (!this.phoneNumber) return;
        const btn = document.getElementById('resendOtpBtn');
        if (btn) { btn.disabled = true; btn.textContent = 'Sending...'; }
        try {
            const { sessionId, error } = await OTP.sendOTP(this.phoneNumber);
            if (error) throw new Error(error);
            this.otpSessionId = sessionId;
            if (typeof clearOTP === 'function') clearOTP();
            if (typeof focusOtpInput === 'function') focusOtpInput();
            this._toast('OTP resent!', 'ok');
            this.startResendTimer();
        } catch(e) { this._toast('Resend failed', 'err'); }
        finally { if (btn) btn.textContent = 'Resend OTP'; }
    },

    startResendTimer(s = 30) {
        const btn = document.getElementById('resendOtpBtn');
        const span = document.getElementById('resendTimer');
        if (btn) btn.disabled = true;
        if (this.resendTimer) clearInterval(this.resendTimer);
        let sec = s;
        const tick = () => {
            if (span) span.textContent = sec > 0 ? `Resend in ${sec}s` : '';
            if (--sec < 0) { clearInterval(this.resendTimer); if (btn) btn.disabled = false; }
        };
        tick(); this.resendTimer = setInterval(tick, 1000);
    },

    // ── SIGN OUT ──────────────────────────────────────────────────
    async signOut() {
        try { await supabase.auth.signOut(); } catch(e) {}
        this.currentUser = null; this.currentProfile = null;
        this.updateUI();
        this._toast('Signed out 👋', 'inf');
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

        const trig = document.getElementById('userMenuTrigger');
        const drop = document.getElementById('userDropdown');
        if (trig && drop && !trig._dd) {
            trig._dd = true;
            trig.addEventListener('click', e => { e.stopPropagation(); drop.classList.toggle('active'); });
            document.addEventListener('click', () => drop.classList.remove('active'));
        }

        this.updateCartBadge(); this.updateNotifBadge();
    },

    async updateCartBadge() {
        if (!this.isLoggedIn()) return;
        try { const { count } = await DB.getCartCount(this.getUserId()); document.querySelectorAll('.cart-badge').forEach(b => { b.textContent = count; b.classList.toggle('hidden', !count); }); } catch(e) {}
    },
    async updateNotifBadge() {
        if (!this.isLoggedIn()) return;
        try { const { count } = await DB.getUnreadCount(this.getUserId()); document.querySelectorAll('.notif-badge').forEach(b => { b.textContent = count; b.classList.toggle('hidden', !count); }); } catch(e) {}
    },

    // ── TOAST ─────────────────────────────────────────────────────
    _toast(msg, type = 'inf') {
        // Use page's aToast if available
        if (typeof aToast === 'function') { aToast(msg, type); return; }
        // Use global Toast if available
        if (typeof Toast !== 'undefined') {
            if (type==='ok')  Toast.success(msg);
            else if (type==='err') Toast.error(msg);
            else Toast.info(msg);
            return;
        }
        // Fallback
        let c = document.getElementById('_atoasts');
        if (!c) { c = document.createElement('div'); c.id='_atoasts'; c.style.cssText='position:fixed;bottom:16px;left:50%;transform:translateX(-50%);z-index:99999;display:flex;flex-direction:column;gap:7px;align-items:center;pointer-events:none;'; document.body.appendChild(c); }
        const t = document.createElement('div');
        const cls = type==='ok' ? 'a-toast-ok' : type==='err' ? 'a-toast-err' : 'a-toast-inf';
        t.className = 'a-toast ' + cls;
        t.style.cssText = 'padding:9px 18px;border-radius:10px;font-size:13px;font-weight:600;white-space:nowrap;font-family:Inter,sans-serif;box-shadow:0 4px 16px rgba(0,0,0,.12);';
        if (type==='ok')  { t.style.background='#f0fdf4';t.style.color='#16a34a';t.style.border='1px solid #bbf7d0'; }
        if (type==='err') { t.style.background='#fef2f2';t.style.color='#dc2626';t.style.border='1px solid #fecaca'; }
        if (type==='inf') { t.style.background='#eff6ff';t.style.color='#1d4ed8';t.style.border='1px solid #bfdbfe'; }
        t.textContent = msg;
        c.appendChild(t);
        setTimeout(() => t.remove(), 3000);
    }
};

// Legacy compat
function setupOTPInputs() {} // no-op, handled by account.html inline script
