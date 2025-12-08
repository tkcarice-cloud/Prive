require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const argon2 = require('argon2');
const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');
const crypto = require('crypto');
const Stripe = require('stripe');
const nodemailer = require('nodemailer');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { v4: uuidv4 } = require('uuid');

const prisma = new PrismaClient();
const stripe = Stripe(process.env.STRIPE_SECRET_KEY || '');
const app = express();

app.use(helmet());
app.use(cors());
app.use(bodyParser.json({ limit: '1mb' }));

// simple rate limiter for sensitive endpoints
const limiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 60 // limit each IP to 60 requests per windowMs
});
app.use(limiter);

const JWT_SECRET = process.env.JWT_SECRET || 'dev_jwt_secret';
const ADMIN_USER_EMAIL = process.env.ADMIN_USER_EMAIL;
const ADMIN_USER_PASSWORD = process.env.ADMIN_USER_PASSWORD;

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.example.com',
  port: Number(process.env.SMTP_PORT || 587),
  secure: false,
  auth: { user: process.env.SMTP_USER || '', pass: process.env.SMTP_PASS || '' }
});

async function ensureAdminUserSeeded() {
  if (!ADMIN_USER_EMAIL || !ADMIN_USER_PASSWORD) return;
  const existing = await prisma.user.findUnique({ where: { email: ADMIN_USER_EMAIL }});
  if (!existing) {
    const hashed = await bcrypt.hash(ADMIN_USER_PASSWORD, 12);
    await prisma.user.create({ data: { email: ADMIN_USER_EMAIL, password: hashed, role: 'ADMIN', name: 'Platform Admin' }});
    console.log('Seeded admin user:', ADMIN_USER_EMAIL);
  }
}

function randToken(len = 32) {
  return crypto.randomBytes(len).toString('hex');
}
function signToken(user) {
  return jwt.sign({ id: user.id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '30d' });
}

// auth middleware
async function authMiddleware(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth) return res.status(401).json({ error: 'Unauthorized' });
  const token = auth.split(' ')[1];
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = await prisma.user.findUnique({ where: { id: payload.id }});
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid token' });
  }
}
async function adminOnly(req, res, next) {
  if (!req.user || req.user.role !== 'ADMIN') return res.status(403).json({ error: 'Admin only' });
  next();
}

app.get('/', (req, res) => res.send({ ok: true }));

// Auth endpoints
app.post('/api/auth/register', async (req, res) => {
  const { email, password, name, role } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Missing' });
  const existing = await prisma.user.findUnique({ where: { email }});
  if (existing) return res.status(400).json({ error: 'User exists' });
  const hashed = await bcrypt.hash(password, 12);
  const user = await prisma.user.create({ data: { email, password: hashed, name, role: role || 'SUBSCRIBER' }});
  const token = signToken(user);
  res.json({ token, user: { id: user.id, email: user.email, name: user.name, role: user.role }});
});

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  const user = await prisma.user.findUnique({ where: { email }});
  if (!user) return res.status(401).json({ error: 'Invalid credentials' });
  const ok = await bcrypt.compare(password, user.password);
  if (!ok) return res.status(401).json({ error: 'Invalid credentials' });
  const token = signToken(user);
  res.json({ token, user: { id: user.id, email: user.email, name: user.name, role: user.role }});
});

app.get('/api/auth/me', authMiddleware, async (req, res) => {
  const user = req.user;
  res.json({ id: user.id, email: user.email, name: user.name, role: user.role });
});

// Admin: set PIN (server-side hashed with argon2) - one time or reset
app.post('/admin/set-pin', authMiddleware, adminOnly, async (req, res) => {
  const { pin } = req.body;
  if (!pin || pin.length < 4) return res.status(400).json({ error: 'PIN must be at least 4 digits' });
  const hash = await argon2.hash(pin);
  await prisma.user.update({ where: { id: req.user.id }, data: { adminPinHash: hash }});
  await prisma.auditLog.create({ data: { userId: req.user.id, action: 'admin.pin_set' }});
  res.json({ success: true });
});

// Admin device register
app.post('/admin/register-device', authMiddleware, adminOnly, async (req, res) => {
  const { label } = req.body;
  const deviceToken = randToken(32);
  const deviceTokenHash = crypto.createHash('sha256').update(deviceToken).digest('hex');
  const device = await prisma.device.create({ data: { userId: req.user.id, deviceToken: deviceTokenHash, label: label || 'Admin Device' }});
  await prisma.auditLog.create({ data: { userId: req.user.id, action: 'device.registered', meta: JSON.stringify({ deviceId: device.id }) }});
  res.json({ deviceId: device.id, deviceToken });
});

// OTP request
app.post('/admin/request-otp', authMiddleware, adminOnly, async (req, res) => {
  const code = String(100000 + Math.floor(Math.random() * 900000));
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000);
  await prisma.oTP.create({ data: { userId: req.user.id, code, expiresAt }});
  try {
    await transporter.sendMail({ from: process.env.OTP_EMAIL_FROM, to: req.user.email, subject: 'Your admin OTP', text: `Your admin OTP is ${code}. It expires in 5 minutes.` });
  } catch (err) {
    console.warn('email send failed', err.message);
  }
  await prisma.auditLog.create({ data: { userId: req.user.id, action: 'otp.requested' }});
  res.json({ success: true });
});

// Verify access (triple-factor): deviceId + deviceToken + pin + otp
app.post('/admin/verify-access', authMiddleware, adminOnly, async (req, res) => {
  const { deviceId, deviceToken, pin, otp } = req.body;
  if (!deviceId || !deviceToken || !pin || !otp) return res.status(400).json({ error: 'Missing fields' });
  const device = await prisma.device.findUnique({ where: { id: deviceId }});
  if (!device || device.userId !== req.user.id) return res.status(403).json({ error: 'Unknown device' });
  const deviceTokenHash = crypto.createHash('sha256').update(deviceToken).digest('hex');
  if (deviceTokenHash !== device.deviceToken) return res.status(403).json({ error: 'Invalid device token' });

  // verify admin PIN using argon2 (stored in adminPinHash)
  const adminRecord = await prisma.user.findUnique({ where: { id: req.user.id }});
  if (!adminRecord || !adminRecord.adminPinHash) return res.status(403).json({ error: 'Admin PIN not set' });
  const pinOk = await argon2.verify(adminRecord.adminPinHash, pin);
  if (!pinOk) return res.status(403).json({ error: 'Invalid PIN' });

  // verify OTP
  const otpRecord = await prisma.oTP.findFirst({ where: { userId: req.user.id, code: otp, used: false, expiresAt: { gt: new Date() } }, orderBy: { createdAt: 'desc' }});
  if (!otpRecord) return res.status(403).json({ error: 'Invalid or expired OTP' });
  await prisma.oTP.update({ where: { id: otpRecord.id }, data: { used: true }});

  // All good -> wallet session token
  const walletToken = jwt.sign({ uid: req.user.id, role: req.user.role, scope: 'wallet' }, JWT_SECRET, { expiresIn: '10m' });
  await prisma.auditLog.create({ data: { userId: req.user.id, action: 'wallet.access_granted', meta: JSON.stringify({ deviceId }) }});
  res.json({ walletToken, expiresIn: 600 });
});

// Wallet endpoints
app.get('/admin/wallet/balance', async (req, res) => {
  const auth = req.headers.authorization; if (!auth) return res.status(401).json({ error: 'Missing auth' });
  const token = auth.split(' ')[1];
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    if (payload.scope !== 'wallet') return res.status(403).json({ error: 'Invalid token scope' });
    const user = await prisma.user.findUnique({ where: { id: payload.uid }});
    if (!user || user.role !== 'ADMIN') return res.status(403).json({ error: 'Admin only' });
    const wallet = await prisma.wallet.findFirst({ where: { name: 'platform' }});
    return res.json({ balanceCents: (wallet ? wallet.balanceCents : 0) });
  } catch (err) { return res.status(401).json({ error: 'Invalid token' }); }
});

app.post('/admin/wallet/payout', async (req, res) => {
  const { amountCents, destination } = req.body; const auth = req.headers.authorization; if (!auth) return res.status(401).json({ error: 'Missing auth' });
  const token = auth.split(' ')[1];
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    if (payload.scope !== 'wallet') return res.status(403).json({ error: 'Invalid token scope' });
    const user = await prisma.user.findUnique({ where: { id: payload.uid }});
    if (!user || user.role !== 'ADMIN') return res.status(403).json({ error: 'Admin only' });
    const wallet = await prisma.wallet.findFirst({ where: { name: 'platform' }});
    if (!wallet || wallet.balanceCents < amountCents) return res.status(400).json({ error: 'Insufficient funds' });
    const updated = await prisma.wallet.update({ where: { id: wallet.id }, data: { balanceCents: wallet.balanceCents - amountCents }});
    await prisma.auditLog.create({ data: { userId: user.id, action: 'wallet.payout', meta: JSON.stringify({ amountCents, destination }) }});
    return res.json({ success: true, newBalanceCents: updated.balanceCents });
  } catch (err) { console.error(err); return res.status(401).json({ error: 'Invalid token' }); }
});

// Stripe helper - get available balance
async function getStripeAvailableBalance(currency = 'usd') {
  const bal = await stripe.balance.retrieve();
  if (!bal || !bal.available) return null;
  const entry = bal.available.find(e => e.currency === (currency || 'usd'));
  return entry ? entry.amount : 0;
}

// Stripe payouts: platform -> platform bank account
app.post('/admin/wallet/payout/stripe', async (req, res) => {
  const { amountCents, statementDescriptor } = req.body;
  const auth = req.headers.authorization; if (!auth) return res.status(401).json({ error: 'Missing auth' });
  const token = auth.split(' ')[1];
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    if (payload.scope !== 'wallet') return res.status(403).json({ error: 'Invalid token scope' });
    const admin = await prisma.user.findUnique({ where: { id: payload.uid }});
    if (!admin || admin.role !== 'ADMIN') return res.status(403).json({ error: 'Admin only' });

    const wallet = await prisma.wallet.findFirst({ where: { name: 'platform' }});
    if (!wallet || wallet.balanceCents < amountCents) return res.status(400).json({ error: 'Insufficient wallet funds' });

    const available = await getStripeAvailableBalance('usd');
    if (available === null) return res.status(500).json({ error: 'Unable to read Stripe balance' });
    if (available < amountCents) return res.status(400).json({ error: 'Insufficient Stripe available balance' });

    const idempotencyKey = `payout-${admin.id}-${Date.now()}-${Math.floor(Math.random()*10000)}`;
    const payout = await stripe.payouts.create({ amount: amountCents, currency: 'usd', statement_descriptor: statementDescriptor || 'Platform Payout' }, { idempotencyKey });

    const updatedWallet = await prisma.wallet.update({ where: { id: wallet.id }, data: { balanceCents: wallet.balanceCents - amountCents }});

    const payoutRecord = await prisma.payout.create({ data: { initiatedById: admin.id, amountCents, currency: 'usd', stripePayoutId: payout.id, type: 'STRIPE_PAYOUT', destination: 'platform-bank', status: payout.status || 'pending', meta: JSON.stringify({ idempotencyKey, stripeResponse: payout }) } });

    await prisma.auditLog.create({ data: { userId: admin.id, action: 'wallet.payout_stripe_created', meta: JSON.stringify({ payoutRecordId: payoutRecord.id, amountCents }) } });

    return res.json({ success: true, payoutRecord, newBalanceCents: updatedWallet.balanceCents, stripePayoutId: payout.id });
  } catch (err) {
    console.error('stripe payout error', err);
    return res.status(500).json({ error: 'payout_failed', message: err.message });
  }
});

// Transfer to connected account
app.post('/admin/wallet/transfer-to-connected', async (req, res) => {
  const { amountCents, connectedAccountId, description } = req.body;
  const auth = req.headers.authorization; if (!auth) return res.status(401).json({ error: 'Missing auth' });
  const token = auth.split(' ')[1];
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    if (payload.scope !== 'wallet') return res.status(403).json({ error: 'Invalid token scope' });
    const admin = await prisma.user.findUnique({ where: { id: payload.uid }});
    if (!admin || admin.role !== 'ADMIN') return res.status(403).json({ error: 'Admin only' });

    const wallet = await prisma.wallet.findFirst({ where: { name: 'platform' }});
    if (!wallet || wallet.balanceCents < amountCents) return res.status(400).json({ error: 'Insufficient wallet funds' });

    const available = await getStripeAvailableBalance('usd');
    if (available === null) return res.status(500).json({ error: 'Unable to read Stripe balance' });
    if (available < amountCents) return res.status(400).json({ error: 'Insufficient Stripe available balance' });

    const idempotencyKey = `transfer-${admin.id}-${Date.now()}-${Math.floor(Math.random()*10000)}`;
    const transfer = await stripe.transfers.create({ amount: amountCents, currency: 'usd', destination: connectedAccountId, description: description || 'Platform transfer' }, { idempotencyKey });

    const updatedWallet = await prisma.wallet.update({ where: { id: wallet.id }, data: { balanceCents: wallet.balanceCents - amountCents }});

    const rec = await prisma.payout.create({ data: { initiatedById: admin.id, amountCents, currency: 'usd', stripePayoutId: transfer.id, type: 'TRANSFER', destination: connectedAccountId, status: transfer.status || 'pending', meta: JSON.stringify({ idempotencyKey, stripeResponse: transfer }) } });

    await prisma.auditLog.create({ data: { userId: admin.id, action: 'wallet.transfer_to_connected', meta: JSON.stringify({ recId: rec.id }) } });
    return res.json({ success: true, transfer: transfer, newBalanceCents: updatedWallet.balanceCents, payoutRecord: rec });
  } catch (err) {
    console.error('transfer error', err);
    return res.status(500).json({ error: 'transfer_failed', message: err.message });
  }
});

// Webhook - verify signature if STRIPE_WEBHOOK_SECRET set; handle payout & transfer events
app.post('/webhook', bodyParser.raw({ type: 'application/json' }), async (req, res) => {
  let event;
  try {
    const sig = req.headers['stripe-signature'];
    if (process.env.STRIPE_WEBHOOK_SECRET) {
      event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
    } else {
      event = JSON.parse(req.body.toString('utf8'));
    }
  } catch (err) {
    console.error('webhook signature failed', err.message);
    return res.status(400).send('invalid webhook');
  }

  try {
    switch (event.type) {
      case 'payout.paid': {
        const payout = event.data.object;
        await prisma.payout.updateMany({ where: { stripePayoutId: payout.id }, data: { status: 'succeeded', meta: JSON.stringify({ stripe: payout }) } });
        await prisma.auditLog.create({ data: { action: 'stripe.payout_paid', meta: JSON.stringify({ id: payout.id }) } });
        break;
      }
      case 'payout.failed': {
        const payout = event.data.object;
        await prisma.payout.updateMany({ where: { stripePayoutId: payout.id }, data: { status: 'failed', meta: JSON.stringify({ stripe: payout }) } });
        await prisma.auditLog.create({ data: { action: 'stripe.payout_failed', meta: JSON.stringify({ id: payout.id }) } });
        break;
      }
      case 'transfer.paid': {
        const transfer = event.data.object;
        await prisma.payout.updateMany({ where: { stripePayoutId: transfer.id }, data: { status: 'succeeded', meta: JSON.stringify({ stripe: transfer }) } });
        await prisma.auditLog.create({ data: { action: 'stripe.transfer_paid', meta: JSON.stringify({ id: transfer.id }) } });
        break;
      }
      case 'checkout.session.completed': {
        const session = event.data.object;
        const meta = session.metadata || {};
        const amount_total = session.amount_total || 0;
        const platformFee = Math.round((amount_total || 0) * 0.07);
        let wallet = await prisma.wallet.findFirst({ where: { name: 'platform' }});
        if (!wallet) wallet = await prisma.wallet.create({ data: { name: 'platform', balanceCents: platformFee }});
        else wallet = await prisma.wallet.update({ where: { id: wallet.id }, data: { balanceCents: wallet.balanceCents + platformFee }});
        await prisma.auditLog.create({ data: { action: 'stripe.checkout_completed', meta: JSON.stringify({ sessionId: session.id, platformFee }) }});
        if (meta.kind === 'booking') {
          await prisma.booking.create({ data: { creatorId: meta.creatorId, userId: meta.subscriberId, day: new Date(meta.slotDay), time: meta.slotTime, durationMin: parseInt(meta.durationMin || '15', 10), priceCents: amount_total, status: 'CONFIRMED', stripePaymentIntentId: session.payment_intent || null }});
        }
        break;
      }
      default:
        break;
    }
  } catch (err) {
    console.error('webhook processing error', err);
  }

  res.json({ received: true });
});

// Booking checkout
app.post('/api/bookings/create-checkout', authMiddleware, async (req, res) => {
  const { creatorId, slotDay, slotTime, durationMin } = req.body;
  const creator = await prisma.creator.findUnique({ where: { id: creatorId }});
  if (!creator) return res.status(404).json({ error: 'Creator not found' });
  const amount = creator.callPriceMinCents || 1500;
  const platformFeeCents = Math.round(amount * 0.07);
  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      line_items: [{ price_data: { currency: 'usd', product_data: { name: `Call with ${creator.displayName}` }, unit_amount: amount }, quantity: 1 }],
      payment_intent_data: { application_fee_amount: platformFeeCents, transfer_data: { destination: creator.stripeAccountId } },
      success_url: `${process.env.BASE_URL}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.BASE_URL}/cancel`,
      metadata: { creatorId, subscriberId: req.user.id, kind: 'booking', slotDay, slotTime, durationMin: String(durationMin) }
    });
    res.json({ url: session.url });
  } catch (err) { console.error(err); res.status(500).json({ error: 'checkout failed' }); }
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, async () => { console.log('Server listening on', PORT); await ensureAdminUserSeeded(); });
