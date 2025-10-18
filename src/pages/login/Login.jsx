import React, { useState, useContext } from "react";
import { useNavigate } from "react-router-dom";
import { AuthContext } from "../../context/AuthContext";
import LoginLogo from "../../components/login/login-logo/LoginLogo";
import LoginHeader from "../../components/login/login-header/LoginHeader";
import LoginEmail from "../../components/login/login-email/LoginEmail";
import LoginPassword from "../../components/login/login-password/LoginPassword";
import LoginDikkat from "../../components/login/login-dikkat/LoginDikkat";
import LoginButton from "../../components/login/login-button/LoginButton";
import LoginBilgi from "../../components/login/login-bilgi/LoginBilgi";

const API_URL = import.meta.env.VITE_API_URL
  ? `${import.meta.env.VITE_API_URL}/api`
  : "http://localhost:5000/api";

export default function Login() {
  const navigate = useNavigate();
  const { login } = useContext(AuthContext);

  const [formData, setFormData] = useState({ email: "", password: "" });
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage("");
    setSuccessMessage("");
    setIsLoading(true);

    try {
      const res = await fetch(`${API_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const data = await res.json();

      if (!res.ok) throw new Error(data.message || "Giriş başarısız.");

      // 🎟️ Paket durumu kontrolü - Trial aktifse girişe izin ver
      if (data.package && data.package.status !== "active" && data.package.status !== "trial") {
        setErrorMessage("Paketiniz aktif değil. Ödeme yapmanız gerekiyor. Yönlendiriliyorsunuz...");
        setTimeout(() => navigate("/register"), 3000);
        return;
      }

      // 👥 Şube kontrolü
      if (!data.branches || data.branches.length === 0) {
        throw new Error("Bu restorana ait şube bulunamadı.");
      }

      await login(data.user, data.token, data.branches);
      setSuccessMessage("✅ Giriş başarılı! Yönlendiriliyorsunuz...");

      setTimeout(() => {
        const { role, restaurant_id, branch_id } = data.user;
        const targetBranch = branch_id || data.branches[0]?.id;
        if (role === "waiter") navigate(`/dashboard/${restaurant_id}/${targetBranch}/waiter`);
        else if (role === "kitchen") navigate(`/dashboard/${restaurant_id}/${targetBranch}/kitchen`);
        else navigate(`/dashboard/${restaurant_id}/${targetBranch}`);
      }, 1500);
    } catch (err) {
      console.error("Login error:", err);
      setErrorMessage(err.message || "Giriş başarısız.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-sky-500 to-blue-700 p-4">
      <div className="w-full max-w-md bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl p-8 sm:p-10 animate-fadeIn">
        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <div className="flex flex-col items-center mb-2">
            <LoginLogo />
            <LoginHeader />
          </div>

          {errorMessage && (
            <div className="bg-red-100 border border-red-400 text-red-700 text-center p-3 rounded-lg text-sm font-medium">
              {errorMessage}
            </div>
          )}
          {successMessage && (
            <div className="bg-green-100 border border-green-400 text-green-700 text-center p-3 rounded-lg text-sm font-medium">
              {successMessage}
            </div>
          )}

          <LoginEmail
            value={formData.email}
            onChange={handleChange}
            name="email"
            disabled={isLoading}
          />
          <LoginPassword
            value={formData.password}
            onChange={handleChange}
            name="password"
            disabled={isLoading}
          />
          <LoginDikkat />
          <div className="mt-4">
            <LoginButton disabled={isLoading} />
          </div>
          <LoginBilgi />
        </form>
      </div>
    </div>
  );
}
