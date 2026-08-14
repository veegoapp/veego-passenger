// Lightweight response-shape validation for REST API boundaries.
//
// These schemas are intentionally permissive (most fields optional) and are
// used in "diagnostic" mode: a failed safeParse only logs a dev warning so a
// backend contract change is caught early — it never blocks rendering, never
// replaces the existing mapper's output, and never throws. This mirrors the
// zod-based validation already used for ride socket events in
// src/hooks/car/useRide.ts, but stays non-blocking here since these are
// full-screen REST fetches (wallet, notifications, profile, trips) where
// dropping data on a schema mismatch would itself be a regression.
import { z } from 'zod';

/** POST /auth/login, /auth/register, /auth/verify-otp (token issuance). */
export const AuthTokenResponseSchema = z.object({
  accessToken: z.string().optional(),
  refreshToken: z.string().optional(),
  user: z.object({ id: z.union([z.string(), z.number()]).optional() }).optional(),
}).passthrough();

/** GET /users/me, PATCH /users/me. */
export const ProfileResponseSchema = z.object({
  id: z.union([z.string(), z.number()]).optional(),
  name: z.string().optional(),
  email: z.string().optional(),
  phone: z.string().optional(),
  gender: z.enum(['male', 'female']).nullable().optional(),
  avatar: z.string().nullable().optional(),
}).passthrough();

/** One item of GET /notifications. */
export const NotificationItemSchema = z.object({
  id: z.union([z.string(), z.number()]).optional(),
  type: z.string().optional(),
  title: z.string().optional(),
  body: z.string().optional(),
  createdAt: z.string().optional(),
  isRead: z.boolean().optional(),
}).passthrough();

/** GET /wallet. Backend contract: { userId, balance }. Only `balance` is the
 *  authoritative field — fallback aliases (walletBalance, amount, etc.) have
 *  been removed now that the backend shape is confirmed. */
export const WalletBalanceSchema = z.object({
  balance: z.union([z.number(), z.string()]).optional(),
  spent: z.union([z.number(), z.string()]).optional(),
  monthlySpent: z.union([z.number(), z.string()]).optional(),
  spentThisMonth: z.union([z.number(), z.string()]).optional(),
}).passthrough();

/** GET /shuttle/my-debt. */
export const DebtInfoSchema = z.object({
  hasDebt: z.boolean().optional(),
  debtAmount: z.union([z.number(), z.string()]).optional(),
  offenceCount: z.number().optional(),
}).passthrough();

/** One item of GET /wallet/transactions. */
export const TransactionItemSchema = z.object({
  id: z.union([z.string(), z.number()]).optional(),
  transactionType: z.string().optional(),
  amount: z.number().optional(),
  createdAt: z.string().optional(),
}).passthrough();

/** One item of GET /users/me/bookings (shuttle trip bookings). */
export const BookingItemSchema = z.object({
  id: z.union([z.string(), z.number()]).optional(),
  status: z.string().optional(),
  seatNumber: z.union([z.string(), z.number()]).optional(),
  totalPrice: z.number().optional(),
  trip: z.object({
    id: z.union([z.string(), z.number()]).optional(),
    departureTime: z.string().optional(),
  }).passthrough().optional(),
}).passthrough();

/**
 * Runs `schema.safeParse(raw)` purely for diagnostics: on mismatch it logs a
 * dev-only warning (so a backend contract drift is caught early) and always
 * returns `raw` unchanged. Existing mapping/error-handling code paths are
 * never affected by the validation result.
 */
export function checkContract<T>(label: string, raw: T, schema: z.ZodType<any>): T {
  if (__DEV__) {
    const result = schema.safeParse(raw);
    if (!result.success) {
      console.warn(`[Contract] ${label} response did not match the expected shape:`, result.error.issues);
    }
  }
  return raw;
}
