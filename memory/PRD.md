# PRIVÉ - Product Requirements Document v2.0

## Overview
PRIVÉ is a luxury, privacy-first creator monetization platform positioned above OnlyFans. Features production-ready architecture with swappable service integrations (storage, payments, KYC, encryption) via admin-controlled configuration panel.

## User Personas

### Creators
- Content creators seeking higher revenue share (75%)
- Require identity verification for trust
- Tiers: Standard → Verified → Elite
- Features: Profile, content uploads, paid DMs, Stripe Connect payouts, earnings dashboard

### Members/Patrons  
- High-net-worth individuals seeking exclusive content
- Require identity verification for access
- Features: Subscriptions, messaging, content feed, referral program

### Admins
- Platform operators managing verification queue
- Moderation, analytics, dispute handling

### Super Admin
- Full system control via configuration panel
- API key management, user management, payout triggers
- 2FA mandatory with backup codes

## What's Been Implemented (January 17, 2026)

### Backend Services (Production-Ready Architecture)

#### SystemConfig Service
- [x] Dynamic configuration stored in MongoDB
- [x] Real-time switching between providers without redeployment
- [x] Audit logging for config changes

#### StorageService
- [x] Local storage (default/demo)
- [x] AWS S3 ready (needs keys)
- [x] Cloudinary ready (needs keys)

#### KYCService
- [x] Mock provider (default) with full UI flow
- [x] Jumio integration ready
- [x] Onfido integration ready  
- [x] Veriff integration ready

#### StripeService
- [x] Test mode (default)
- [x] Live mode ready
- [x] Stripe Connect for creator payouts
- [x] Express account onboarding
- [x] Payout transfers to connected accounts

#### E2EEService
- [x] X25519 key pair generation
- [x] Prekey bundle system (libsignal-compatible)
- [x] AES-GCM-256 encryption (Web Crypto fallback)
- [x] Session management

#### ReferralService
- [x] Tiered bonus system (Bronze/Silver/Gold/Platinum)
- [x] 5-12.5% bonus on referred earnings
- [x] 6-month bonus duration (configurable)
- [x] Both creator and user referrals

### Super Admin Panel
- [x] `/api/super-admin/init` - One-time account creation with 2FA
- [x] Configuration panel for all service providers
- [x] User management (list, update, delete)
- [x] Creator management with tier control
- [x] Manual payout triggers
- [x] Verification status management
- [x] Platform analytics dashboard
- [x] Audit log viewer

### Two-Factor Authentication
- [x] TOTP setup with QR code
- [x] Backup codes generation
- [x] 2FA verification on login
- [x] Enable/disable 2FA

### Frontend Pages
- [x] Landing page (dark luxury theme)
- [x] Login with 2FA support
- [x] Register with referral code
- [x] Identity Verification flow
- [x] Dashboard
- [x] Creator Dashboard with earnings
- [x] Discover creators
- [x] Creator Profile with subscribe/tip
- [x] E2EE Messages
- [x] Settings with 2FA & Stripe Connect
- [x] Referrals page with tier progress
- [x] Super Admin Panel
- [x] Payment success/cancel

## Service Configuration (Swappable via Super Admin)

| Service | Default | Production-Ready Options |
|---------|---------|-------------------------|
| Storage | Local | AWS S3, Cloudinary |
| Payments | Stripe Test | Stripe Live |
| KYC | Mock | Jumio, Onfido, Veriff |
| Encryption | Web Crypto | libsignal (architecture ready) |

## SUPER_ADMIN Credentials
- Email: `superadmin@prive.internal`
- Password: Auto-generated on init
- 2FA: Mandatory (TOTP secret provided)
- Backup codes: 10 codes provided

## Referral Tier System
| Tier | Min Referrals | Bonus % |
|------|---------------|---------|
| Bronze | 1 | 5% |
| Silver | 5 | 7.5% |
| Gold | 10 | 10% |
| Platinum | 25 | 12.5% |

## Technical Stack
- **Frontend**: React 19 + Tailwind CSS + Shadcn UI
- **Backend**: FastAPI (Python)
- **Database**: MongoDB
- **Payments**: Stripe + Stripe Connect
- **Auth**: JWT + bcrypt + TOTP (pyotp)
- **Encryption**: cryptography (X25519, AES-GCM)

## Next Action Items
1. Deploy and test with real Stripe Connect account
2. Configure real KYC provider (Jumio/Onfido/Veriff)
3. Add AWS S3 bucket for media storage
4. Implement WebSocket for real-time messaging
5. Add libsignal for full Signal Protocol E2EE
6. Build mobile-responsive improvements
7. Add DMCA takedown workflow
