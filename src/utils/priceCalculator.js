/**
 * 📦 Fiyat Hesaplama Yardımcıları
 * Sistem: MSSQL + JWT + Iyzico uyumlu
 */

const parseEnvPrice = (v, fallback) => {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
};

// 💰 .env'den gelen fiyatlar (Yoksa fallback değerler)
const PRICE_BASIC = parseEnvPrice(process.env.PRICE_BASIC, 360);
const PRICE_ADVANCE = parseEnvPrice(process.env.PRICE_ADVANCE, 720);
const PRICE_ELEVATE = parseEnvPrice(process.env.PRICE_ELEVATE, 1200);

/**
 * 📊 Paket tipine göre şube başına fiyatı döndürür
 */
export const getPricePerBranch = (packageType) => {
  switch ((packageType || "").toLowerCase()) {
    case "advance":
      return PRICE_ADVANCE;
    case "elevate":
      return PRICE_ELEVATE;
    case "basic":
    default:
      return PRICE_BASIC;
  }
};

/**
 * 🧮 Toplam aylık fiyat hesaplama
 */
export const calculateTotal = (packageType, branchCount = 1) => {
  const pkg = (packageType || "basic").toLowerCase();
  const perBranch = getPricePerBranch(pkg);

  if (pkg === "basic") {
  // 🧩 Basic pakette şube sayısı sabit 1
  const branches = 1;

  return {
    monthly: Number(perBranch.toFixed(2)),
    perBranch: Number(perBranch.toFixed(2)),
    branches, // ✅ her zaman 1
  };
}


  const branches =
    Number.isFinite(Number(branchCount)) && Number(branchCount) > 0
      ? Math.floor(branchCount)
      : 1;

  const monthly = Number((perBranch * branches).toFixed(2));

  return {
    monthly,
    perBranch: Number(perBranch.toFixed(2)),
    branches,
  };
};

/**
 * ➕ Ek şube ekleme fiyatı hesaplama
 */
export const calculateAddBranchesAmount = (
  packageType,
  currentBranches = 0,
  addBranches = 0
) => {
  const pkg = (packageType || "basic").toLowerCase();
  const perBranch = getPricePerBranch(pkg);

  if (pkg === "basic") {
    return {
      amountDue: 0,
      perBranch: Number(perBranch.toFixed(2)),
      newTotalMonthly: Number(perBranch.toFixed(2)),
      oldTotalMonthly: Number(perBranch.toFixed(2)),
      note: "Basic paket ek şube desteklemez.",
    };
  }

  const curr =
    Number.isFinite(Number(currentBranches)) && Number(currentBranches) >= 0
      ? Math.floor(currentBranches)
      : 0;

  const add =
    Number.isFinite(Number(addBranches)) && Number(addBranches) > 0
      ? Math.floor(addBranches)
      : 0;

  const amountDue = Number((perBranch * add).toFixed(2));
  const oldTotalMonthly = Number((perBranch * curr).toFixed(2));
  const newTotalMonthly = Number((perBranch * (curr + add)).toFixed(2));

  return {
    amountDue,
    perBranch: Number(perBranch.toFixed(2)),
    newTotalMonthly,
    oldTotalMonthly,
    addedBranches: add,
    previousBranches: curr,
  };
};

/**
 * 📅 Aylıktan yıllık fiyata geçiş hesaplama
 */
export const calculateAnnualFromMonthly = (monthly) => {
  const m = Number.isFinite(Number(monthly)) ? Number(monthly) : 0;
  return Number((m * 12).toFixed(2));
};

/**
 * 💵 TRY para formatı
 */
export const formatCurrency = (amount) => {
  const n = Number.isFinite(Number(amount)) ? Number(amount) : 0;
  try {
    return new Intl.NumberFormat("tr-TR", {
      style: "currency",
      currency: "TRY",
    }).format(n);
  } catch {
    return `${n.toFixed(2)} ₺`;
  }
};

export default {
  getPricePerBranch,
  calculateTotal,
  calculateAddBranchesAmount,
  calculateAnnualFromMonthly,
  formatCurrency,
};
