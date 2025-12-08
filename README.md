# Production-ready Creator Platform Backend (Dockerized)

This repository provides a production-minded backend scaffold for the Creator Platform,
including:
- Admin wallet with triple-factor access (PIN hashed with Argon2, device token, OTP)
- Stripe Connect checkout with 7% platform fee
- Stripe payouts & transfers endpoints (idempotent, audited)
- Prisma + Postgres, Dockerized for easy deployment
- Security basics: helmet, rate-limiting, webhook signature verification

## Setup (local / dev)
1. Copy `.env.example` -> `.env` and fill values (DATABASE_URL, SMTP, STRIPE keys, ADMIN creds).
2. Build & run with Docker Compose:
   ```
   docker compose build
   docker compose up
   ```
3. Use Stripe CLI to forward webhooks:
   ```
   stripe listen --forward-to http://localhost:4000/webhook
   ```

## Admin PIN setup
1. Login with the seeded admin user defined by `ADMIN_USER_EMAIL` and `ADMIN_USER_PASSWORD`.
2. Call `POST /admin/set-pin` (authenticated) with body `{ "pin": "1234" }` to set an Argon2-hashed admin PIN.
3. Register device via `POST /admin/register-device` and store the returned `deviceToken` securely on the admin device.

## Payout flows
- Use `/admin/wallet/payout/stripe` to create a Stripe payout to the platform bank account.
- Use `/admin/wallet/transfer-to-connected` to transfer to connected Stripe accounts.

## Production hardening (must do)
- Move secrets to a secret manager (AWS Secrets Manager, Vault).
- Use FIDO2 attestation for device binding if possible.
- Use an HSM or KMS for signing sensitive tokens.
- Enforce stricter rate limiting and IP allowlists for admin routes.
- Perform security audit & penetration test before live.

