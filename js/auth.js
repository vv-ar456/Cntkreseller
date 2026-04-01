const Auth = {
    otpSessionId: null,
    phoneNumber: null,
    currentUser: null,

    showLoginModal() {
        document.getElementById("authModal").style.display = "block";
    },

    hideLoginModal() {
        document.getElementById("authModal").style.display = "none";

        document.getElementById("phoneStep").classList.remove("hidden");
        document.getElementById("otpStep").classList.add("hidden");
        document.getElementById("nameStep").classList.add("hidden");
    },

    async sendLoginOTP() {
        let phone = document.getElementById("authPhone").value.trim();

        if (phone.length !== 10) {
            alert("Enter valid number");
            return;
        }

        phone = "91" + phone;
        this.phoneNumber = phone;

        const res = await OTP.sendOTP(phone);

        if (res.error) {
            alert(res.error);
            return;
        }

        this.otpSessionId = res.sessionId;

        document.getElementById("phoneStep").classList.add("hidden");
        document.getElementById("otpStep").classList.remove("hidden");

        alert("OTP Sent");
    },

    async verifyLoginOTP() {
        const otp = document.getElementById("otpInput").value.trim();

        if (otp.length !== 6) {
            alert("Invalid OTP");
            return;
        }

        const res = await OTP.verifyOTP(this.otpSessionId, otp);

        if (!res.verified) {
            alert("Wrong OTP");
            return;
        }

        // Check if user exists
        let users = JSON.parse(localStorage.getItem("users") || "{}");

        if (!users[this.phoneNumber]) {
            document.getElementById("otpStep").classList.add("hidden");
            document.getElementById("nameStep").classList.remove("hidden");
        } else {
            this.loginUser(users[this.phoneNumber]);
        }
    },

    completeRegistration() {
        const name = document.getElementById("authName").value.trim();

        if (!name) {
            alert("Enter name");
            return;
        }

        let users = JSON.parse(localStorage.getItem("users") || "{}");

        users[this.phoneNumber] = {
            name: name,
            phone: this.phoneNumber
        };

        localStorage.setItem("users", JSON.stringify(users));

        this.loginUser(users[this.phoneNumber]);
    },

    loginUser(user) {
        this.currentUser = user;

        localStorage.setItem("loggedInUser", JSON.stringify(user));

        document.getElementById("loginBtn").style.display = "none";
        document.getElementById("userMenuTrigger").classList.remove("hidden");

        document.getElementById("userName").innerText = user.name;
        document.getElementById("userAvatar").innerText = user.name[0];

        alert("Login Successful");
        this.hideLoginModal();
    }
};

// Auto login on reload
window.onload = () => {
    const user = JSON.parse(localStorage.getItem("loggedInUser"));

    if (user) {
        Auth.loginUser(user);
    }
};
