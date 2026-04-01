const OTP = {
    apiKey: "2503bcf6-237e-11f1-bcb0-0200cd936042",

    async sendOTP(phone) {
        try {
            const res = await fetch(`https://2factor.in/API/V1/${this.apiKey}/SMS/${phone}/AUTOGEN`);
            const data = await res.json();

            if (data.Status === "Success") {
                return { sessionId: data.Details };
            } else {
                return { error: data.Details };
            }
        } catch {
            return { error: "Network error" };
        }
    },

    async verifyOTP(sessionId, otp) {
        try {
            const res = await fetch(`https://2factor.in/API/V1/${this.apiKey}/SMS/VERIFY/${sessionId}/${otp}`);
            const data = await res.json();

            if (data.Status === "Success") {
                return { verified: true };
            } else {
                return { verified: false, error: data.Details };
            }
        } catch {
            return { verified: false, error: "Network error" };
        }
    }
};
