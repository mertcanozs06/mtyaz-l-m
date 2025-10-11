import express from "express";
import { createPayment, handleCallback } from "../controllers/paymentsController.js";
import { calculateTotal, calculateAnnualFromMonthly, formatCurrency } from "../utils/priceCalculator.js";

const router = express.Router();

router.get("/calculate", (req, res) => {
  try {
    const { package_type = "basic", branches = 1 } = req.query;
    const total = calculateTotal(package_type, Number(branches));
    const annual = calculateAnnualFromMonthly(total.monthly);

    return res.json({
      package: package_type,
      branches: total.branches,
      perBranch: total.perBranch,
      monthly: total.monthly,
      annual,
      formatted: {
        perBranch: formatCurrency(total.perBranch),
        monthly: formatCurrency(total.monthly),
        annual: formatCurrency(annual)
      }
    });
  } catch (err) {
    console.error("Price calculation failed:", err);
    return res.status(500).json({ error: "Failed to calculate price" });
  }
});

router.post("/create", createPayment);
router.post("/callback", handleCallback);

export default router;
