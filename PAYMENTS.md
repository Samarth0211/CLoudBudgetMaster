# Payments (PayPal)

CloudBudgetMaster charges for the **Pro** plan ($29/mo) via PayPal. This is the
setup + how the flow works.

## Is it working right now?
Only if the **server** `backend/.env` has live PayPal credentials. If
`PAYPAL_CLIENT_ID` / `PAYPAL_CLIENT_SECRET` are missing, clicking **Upgrade to
Pro** fails with *"Failed to authenticate with PayPal."* (The promo-code path
still works without PayPal.)

## Turn it on
1. Go to https://developer.paypal.com → **Apps & Credentials**.
2. Switch to **Live**, create an app, copy the **Client ID** and **Secret**.
   (Your PayPal account must be a Business account to receive live payments.)
3. On the VPS, add to `backend/.env`:
   ```
   PAYPAL_CLIENT_ID=...
   PAYPAL_CLIENT_SECRET=...
   PAYPAL_MODE=live
   FRONTEND_URL=https://cloudbudgetmaster.com   # used for PayPal return/cancel URLs
   ```
4. Restart: `pm2 restart all`.
5. Test with a real small purchase (or set `PAYPAL_MODE=sandbox` + sandbox creds
   and a sandbox buyer account to test without real money).

## How the flow works
1. **Pricing → Upgrade** → `POST /v1/payments/create-order`. The backend creates a
   PayPal order, records `order_id → user_id + expected amount` in local SQLite
   (`backend/data/payments.db`), and returns the PayPal approval URL.
2. The browser redirects to PayPal; after approval PayPal returns to
   `…/dashboard?payment=success&token=<order_id>`.
3. The dashboard calls `POST /v1/payments/capture-order`, which **verifies the
   order belongs to this user, captures it, checks the amount/currency/custom_id
   match**, marks it captured (so it can't be replayed), and upgrades the user to
   Pro.

## Promo codes
Defined in `backend/api/payments.py` (`PROMO_CODES`). Redeeming sets the user's
plan to `pro`. Note: redemption is currently **permanent** — `duration_days` is
recorded but not enforced. Update the codes/expiry there as needed.

## Where payment records live
- `backend/data/payments.db` (SQLite, on the VPS, git-ignored) — order → user map.
- The user's `plan` field in the Supabase `profiles` table — source of truth for access.
