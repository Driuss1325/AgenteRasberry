// scripts/get-jwt.js
import axios from "axios";
const BASE = process.env.BASE || "http://localhost:3001";
const EMAIL = process.env.EMAIL || "admin@example.com";
const PASSWORD = process.env.PASSWORD || "admin123";
(async () => {
  try {
    const { data } = await axios.post(`${BASE}/api/auth/login`, { email: EMAIL, password: PASSWORD });
    console.log(data.token);
  } catch (e) {
    console.error("Login failed:", e?.response?.status, e?.response?.data || e.message);
    process.exit(1);
  }
})();
