export const KG_PER_QUINTAL = 100;
export const DEFAULT_CURRENCY = "INR";
export const CURRENCY_SYMBOL = "₹";
export const DATE_DISPLAY_FORMAT = "dd MMM yyyy";
export const ROLES = {
  SUPER_ADMIN: "superadmin",
  ADMIN: "admin",
} as const;
export const DEAL_STATUS = {
  PENDING_DELIVERY: "pending_delivery",
  DELIVERED: "delivered",
  STAGING: "staging",
  COMPLETED: "completed",
} as const;
export const ORDER_STATUS = {
  DRAFT: "draft",
  CONFIRMED: "confirmed",
  DELIVERED: "delivered",
} as const;
export const EMPLOYEE_TYPE = {
  MONTHLY: "monthly",
  DAILY: "daily",
} as const;
