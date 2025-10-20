import { createContext, useState, useEffect, useCallback } from "react";
import { jwtDecode } from "jwt-decode";

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [branches, setBranches] = useState([]);
  const [selectedBranch, setSelectedBranch] = useState(null);
  const [packageType, setPackageType] = useState("basic");
  const [loading, setLoading] = useState(true);

  // 🔐 Token geçerlilik kontrolü
  const isTokenValid = (token) => {
    try {
      const decoded = jwtDecode(token);
      return decoded.exp * 1000 > Date.now();
    } catch {
      return false;
    }
  };

  // 👤 Kullanıcı ve şube verilerini çek
  const fetchUserData = useCallback(
    async (token) => {
      try {
        const userRes = await fetch(`${API_URL}/api/auth/user`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!userRes.ok) throw new Error("Kullanıcı bilgileri alınamadı");
        const userData = await userRes.json();

        const branchesRes = await fetch(
          `${API_URL}/api/restaurant/${userData.restaurant_id}/branches`,
          { headers: { Authorization: `Bearer ${token}` } }
        );

        if (!branchesRes.ok) throw new Error("Şubeler alınamadı");
        const branchesData = await branchesRes.json();

        // State ve localStorage güncelle
        setUser(userData);
        setBranches(branchesData);
        setPackageType(userData.package_type || "basic");

        localStorage.setItem("package_type", userData.package_type || "basic");
        localStorage.setItem("branches", JSON.stringify(branchesData));

        const branchToSelect =
          selectedBranch ||
          userData.branch_id?.toString() ||
          branchesData?.[0]?.id?.toString() ||
          null;

        setSelectedBranch(branchToSelect);
        localStorage.setItem("selected_branch", branchToSelect);

        return { userData, branchesData };
      } catch (error) {
        console.error("❌ Veri çekme hatası:", error.message);
        logout();
        throw error;
      }
    },
    [API_URL, selectedBranch]
  );

  // 🔄 Uygulama açıldığında oturum kontrolü
  useEffect(() => {
    const initializeAuth = async () => {
      const storedToken = localStorage.getItem("token");
      const storedPackageType = localStorage.getItem("package_type");
      const storedBranches = JSON.parse(localStorage.getItem("branches") || "[]");
      const storedBranch = localStorage.getItem("selected_branch");

      if (!storedToken || !isTokenValid(storedToken)) {
        logout();
        setLoading(false);
        return;
      }

      try {
        const decoded = jwtDecode(storedToken);
        setToken(storedToken);
        setPackageType(storedPackageType || decoded.package_type || "basic");
        setBranches(storedBranches);
        setSelectedBranch(storedBranch || storedBranches?.[0]?.id?.toString() || null);

        await fetchUserData(storedToken);
      } catch (error) {
        console.error("🔁 Başlatma hatası:", error.message);
        logout();
      } finally {
        setLoading(false);
      }
    };

    initializeAuth();
  }, [fetchUserData]);

  // ✅ Login işlemi (düzenlenmiş)
  const login = async (userData, newToken, branchesData) => {
    try {
      localStorage.setItem("token", newToken);
      localStorage.setItem("package_type", userData.package_type || "basic");
      localStorage.setItem("branches", JSON.stringify(branchesData || []));

      setToken(newToken);
      setUser(userData);
      setBranches(branchesData || []);
      setPackageType(userData.package_type || "basic");

      const branchToSelect =
        userData.branch_id?.toString() ||
        branchesData?.[0]?.id?.toString() ||
        null;

      setSelectedBranch(branchToSelect);
      localStorage.setItem("selected_branch", branchToSelect);

      // Arka planda güncel verileri çek ama bekletme
      fetchUserData(newToken).catch(() => {});

      return Promise.resolve(true); // 🔥 Login işlemi tamamlandı sinyali
    } catch (error) {
      console.error("Login context hatası:", error.message);
      throw error;
    }
  };

  // 🚪 Çıkış işlemi
  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("package_type");
    localStorage.removeItem("branches");
    localStorage.removeItem("selected_branch");
    setUser(null);
    setToken(null);
    setBranches([]);
    setSelectedBranch(null);
    setPackageType("basic");
  };

  const updateUser = useCallback(async () => {
    if (token) await fetchUserData(token);
  }, [token, fetchUserData]);

  const addNewBranch = (newBranch) => {
    const updatedBranches = [...branches, newBranch];
    setBranches(updatedBranches);
    localStorage.setItem("branches", JSON.stringify(updatedBranches));

    if (!selectedBranch) {
      setSelectedBranch(newBranch.id.toString());
      localStorage.setItem("selected_branch", newBranch.id.toString());
    }
  };

  const value = {
    user,
    token,
    packageType,
    branches,
    selectedBranch,
    setSelectedBranch,
    login,
    logout,
    updateUser,
    addNewBranch,
    loading,
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};
