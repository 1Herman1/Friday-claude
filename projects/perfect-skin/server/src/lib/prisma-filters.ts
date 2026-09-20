// Base filters for all catalog queries
// Ensures inactive/deleted items never appear in customer-facing endpoints
export const ACTIVE = {
  isActive: true,
  deletedAt: null,
} as const
