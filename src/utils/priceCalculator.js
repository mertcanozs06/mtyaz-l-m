// utils/priceCalculator.js
/**
 * Price calculator helper for packages.
 * Uses environment variables for package base prices (KDV dahil).
 *
 * ENV variables (optional; defaults provided):
 *   PRICE_BASIC=360
 *   PRICE_ADVANCE=720
 *   PRICE_ELEVATE=1200
 */

const parseEnvPrice = (v, fallback) => {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
};

const PRICE_BASIC = parseEnvPrice(process.env.PRICE_BASIC, 360); // Basic paket (şube seçimi yok)
const PRICE_ADVANCE = parseEnvPrice(process.env.PRICE_ADVANCE, 720);
const PRICE_ELEVATE = parseEnvPrice(process.env.PRICE_ELEVATE, 1200);

/**
 * Get per-branch price for a package type.
 * @param {'basic'|'advance'|'elevate'} packageType
 * @returns {number}
 */
export const getPricePerBranch = (packageType) => {
  switch ((packageType || '').toLowerCase()) {
    case 'advance':
      return PRICE_ADVANCE;
    case 'elevate':
      return PRICE_ELEVATE;
    case 'basic':
    default:
      return PRICE_BASIC;
  }
};

/**
 * Calculate monthly total for a given package and branch count.
 * For 'basic', branchCount is ignored.
 */
export const calculateTotal = (packageType, branchCount = 1) => {
  const pkg = (packageType || 'basic').toLowerCase();
  const perBranch = getPricePerBranch(pkg);

  if (pkg === 'basic') {
    return {
      monthly: Number(perBranch.toFixed(2)),
      perBranch: Number(perBranch.toFixed(2)),
      branches: 0,
    };
  }

  const branches = Number.isFinite(Number(branchCount)) && Number(branchCount) > 0 ? Math.floor(branchCount) : 1;
  const monthly = Number((perBranch * branches).toFixed(2));
  return {
    monthly,
    perBranch: Number(perBranch.toFixed(2)),
    branches,
  };
};

/**
 * Calculate amount due for additional branches.
 */
export const calculateAddBranchesAmount = (packageType, currentBranches = 0, addBranches = 0) => {
  const pkg = (packageType || 'basic').toLowerCase();
  const perBranch = getPricePerBranch(pkg);

  if (pkg === 'basic') {
    return {
      amountDue: 0,
      perBranch: Number(perBranch.toFixed(2)),
      newTotalMonthly: Number(perBranch.toFixed(2)),
      oldTotalMonthly: Number(perBranch.toFixed(2)),
      note: 'basic package does not support additional branches',
    };
  }

  const curr = Number.isFinite(Number(currentBranches)) ? Math.floor(currentBranches) : 0;
  const add = Number.isFinite(Number(addBranches)) ? Math.floor(addBranches) : 0;

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
 * Convert monthly to annual (12×monthly)
 */
export const calculateAnnualFromMonthly = (monthly) => {
  const m = Number.isFinite(Number(monthly)) ? Number(monthly) : 0;
  return Number((m * 12).toFixed(2));
};

/**
 * Format TL currency
 */
export const formatCurrency = (amount) => {
  const n = Number.isFinite(Number(amount)) ? Number(amount) : 0;
  try {
    return new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(n);
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
