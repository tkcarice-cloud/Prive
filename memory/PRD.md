# PRIVÉ - Product Requirements Document

## Overview
PRIVÉ is a luxury, privacy-first creator monetization platform positioned above OnlyFans. Open access with premium enforcement via verification, encryption, moderation, and design.

## User Personas

### Creators
- Content creators seeking higher revenue share (75%)
- Require identity verification for trust
- Tiers: Standard → Verified → Elite
- Features: Profile, content uploads, paid DMs, paid calls, earnings dashboard

### Members/Patrons
- High-net-worth individuals seeking exclusive content
- Require identity verification for access
- Features: Subscriptions, messaging, content feed, transaction history

### Admins
- Platform operators managing verification queue
- Moderation, analytics, dispute handling
- Autonomous operations with minimal intervention

## Core Requirements (Static)

### Identity & Trust
- [x] Government ID + selfie verification flow
- [x] Verification required before content access/messaging/payments
- [x] Verification status badges

### Communication
- [x] E2EE messaging indicators (simulated)
- [x] Encrypted status displayed on all messages
- [x] Creator-controlled availability

### Business Model
- [x] 75% creator / 25% platform revenue split
- [x] Subscriptions (monthly recurring)
- [x] Pay-per-view (PPV) content
- [x] Tips
- [x] Paid DMs
- [x] Stripe payment integration

### Admin Operations
- [x] Verification approval/rejection queue
- [x] Platform analytics dashboard
- [x] Creator tier management

## What's Been Implemented (January 17, 2026)

### Backend (FastAPI)
- JWT authentication with role-based access (user/creator/admin)
- User registration and login
- Identity verification submission and admin approval
- Creator profiles with tier system
- Content management (create, list, unlock)
- Subscription system
- E2EE messaging (simulated encryption indicators)
- Stripe checkout integration for payments
- Earnings tracking and analytics
- Admin verification queue and analytics

### Frontend (React)
- Landing page with dark luxury aesthetic
- Authentication pages (login/register)
- Identity verification flow (ID upload + selfie capture)
- User dashboard with subscription feed
- Creator dashboard with earnings (privacy toggle)
- Discover/explore creators with tier filtering
- Creator profile pages with subscribe/tip/message
- E2EE messaging interface
- Payment success/cancel pages
- Admin panel for verification queue
- Settings page

### Design System
- Dark obsidian (#020202) background
- Metallic gold (#D4AF37) accents
- Playfair Display (headings), Manrope (body), JetBrains Mono (mono)
- Glassmorphism cards with subtle borders
- Sharp corners (no rounded-xl)

## Prioritized Backlog

### P0 (Critical - Not Started)
- Real E2EE implementation (Signal Protocol)
- Real-time WebRTC voice/video calls
- Actual ID verification integration (Jumio/Onfido)
- DMCA takedown workflow
- Content moderation AI

### P1 (High Priority)
- Media upload and CDN storage
- Watermarking system
- Payout management (Stripe Connect)
- Push notifications
- Content scheduling

### P2 (Medium Priority)
- Private requests marketplace
- Concierge services
- Referral program
- Creator analytics dashboard
- Mobile-responsive improvements

### P3 (Nice to Have)
- 2FA authentication
- Dark/light mode toggle
- Custom creator URLs
- Promotional tools

## Technical Stack
- **Frontend**: React 19 + Tailwind CSS + Shadcn UI
- **Backend**: FastAPI (Python)
- **Database**: MongoDB
- **Payments**: Stripe (test mode)
- **Auth**: JWT with bcrypt password hashing

## Next Action Items
1. Implement real media upload to cloud storage (S3/Cloudinary)
2. Add content watermarking for creator protection
3. Implement Stripe Connect for creator payouts
4. Add real-time notifications (WebSocket)
5. Build content moderation queue
