from fastapi import FastAPI, APIRouter, HTTPException, Depends, UploadFile, File, Request, Header
from fastapi.responses import FileResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr, ConfigDict
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timezone, timedelta
import bcrypt
import jwt
from enum import Enum
import secrets
import base64

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# JWT Config
JWT_SECRET = os.environ.get('JWT_SECRET', secrets.token_hex(32))
JWT_ALGORITHM = "HS256"
JWT_EXPIRATION_HOURS = 24

# Stripe integration
STRIPE_API_KEY = os.environ.get('STRIPE_API_KEY', 'sk_test_emergent')

# Create the main app
app = FastAPI(title="PRIVÉ API", version="1.0.0")
api_router = APIRouter(prefix="/api")

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Enums
class UserRole(str, Enum):
    USER = "user"
    CREATOR = "creator"
    ADMIN = "admin"

class VerificationStatus(str, Enum):
    PENDING = "pending"
    VERIFIED = "verified"
    REJECTED = "rejected"
    NONE = "none"

class CreatorTier(str, Enum):
    STANDARD = "standard"
    VERIFIED = "verified"
    ELITE = "elite"

class ContentType(str, Enum):
    FREE = "free"
    SUBSCRIPTION = "subscription"
    PPV = "ppv"

class PaymentType(str, Enum):
    SUBSCRIPTION = "subscription"
    TIP = "tip"
    PPV = "ppv"
    MESSAGE = "message"
    CALL = "call"

class PaymentStatus(str, Enum):
    INITIATED = "initiated"
    PAID = "paid"
    FAILED = "failed"
    EXPIRED = "expired"
    REFUNDED = "refunded"

# Pydantic Models
class UserBase(BaseModel):
    email: EmailStr
    username: str
    display_name: Optional[str] = None
    bio: Optional[str] = None
    avatar_url: Optional[str] = None

class UserCreate(BaseModel):
    email: EmailStr
    username: str
    password: str
    role: UserRole = UserRole.USER

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    email: str
    username: str
    display_name: Optional[str] = None
    bio: Optional[str] = None
    avatar_url: Optional[str] = None
    role: UserRole
    verification_status: VerificationStatus = VerificationStatus.NONE
    created_at: str

class CreatorProfile(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    user_id: str
    username: str
    display_name: str
    bio: Optional[str] = None
    avatar_url: Optional[str] = None
    cover_url: Optional[str] = None
    tier: CreatorTier = CreatorTier.STANDARD
    subscription_price: float = 9.99
    verification_status: VerificationStatus = VerificationStatus.NONE
    total_subscribers: int = 0
    total_earnings: float = 0.0
    is_online: bool = False
    call_rate_per_minute: float = 2.99
    message_price: float = 0.99

class ContentCreate(BaseModel):
    title: str
    description: Optional[str] = None
    content_type: ContentType = ContentType.SUBSCRIPTION
    price: Optional[float] = None
    media_urls: List[str] = []
    is_pinned: bool = False

class ContentResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    creator_id: str
    title: str
    description: Optional[str] = None
    content_type: ContentType
    price: Optional[float] = None
    media_urls: List[str] = []
    thumbnail_url: Optional[str] = None
    is_pinned: bool = False
    likes_count: int = 0
    comments_count: int = 0
    created_at: str
    is_unlocked: bool = False

class SubscriptionCreate(BaseModel):
    creator_id: str

class MessageCreate(BaseModel):
    recipient_id: str
    content: str
    is_paid: bool = False

class MessageResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    sender_id: str
    recipient_id: str
    content: str
    is_encrypted: bool = True
    is_paid: bool = False
    is_read: bool = False
    created_at: str

class TipCreate(BaseModel):
    creator_id: str
    amount: float
    message: Optional[str] = None

class VerificationCreate(BaseModel):
    id_type: str = "government_id"
    id_front_url: Optional[str] = None
    id_back_url: Optional[str] = None
    selfie_url: Optional[str] = None

class CheckoutRequest(BaseModel):
    payment_type: PaymentType
    creator_id: Optional[str] = None
    content_id: Optional[str] = None
    amount: Optional[float] = None
    origin_url: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse

# Helper Functions
def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()

def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode(), hashed.encode())

def create_token(user_id: str, role: str) -> str:
    expiration = datetime.now(timezone.utc) + timedelta(hours=JWT_EXPIRATION_HOURS)
    payload = {"sub": user_id, "role": role, "exp": expiration}
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

async def get_current_user(authorization: str = Header(None)) -> dict:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")
    token = authorization.split(" ")[1]
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user = await db.users.find_one({"id": payload["sub"]}, {"_id": 0, "password": 0})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

def generate_encryption_key() -> str:
    """Generate a mock E2EE key for demonstration"""
    return base64.b64encode(secrets.token_bytes(32)).decode()

# Auth Routes
@api_router.post("/auth/register", response_model=TokenResponse)
async def register(data: UserCreate):
    # Check existing user
    existing = await db.users.find_one({"$or": [{"email": data.email}, {"username": data.username}]})
    if existing:
        raise HTTPException(status_code=400, detail="Email or username already exists")
    
    user_id = str(uuid.uuid4())
    user_doc = {
        "id": user_id,
        "email": data.email,
        "username": data.username,
        "display_name": data.username,
        "password": hash_password(data.password),
        "role": data.role,
        "verification_status": VerificationStatus.NONE,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "bio": None,
        "avatar_url": None
    }
    await db.users.insert_one(user_doc)
    
    # Create creator profile if registering as creator
    if data.role == UserRole.CREATOR:
        creator_doc = {
            "id": str(uuid.uuid4()),
            "user_id": user_id,
            "username": data.username,
            "display_name": data.username,
            "bio": None,
            "avatar_url": None,
            "cover_url": None,
            "tier": CreatorTier.STANDARD,
            "subscription_price": 9.99,
            "verification_status": VerificationStatus.NONE,
            "total_subscribers": 0,
            "total_earnings": 0.0,
            "is_online": False,
            "call_rate_per_minute": 2.99,
            "message_price": 0.99,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.creators.insert_one(creator_doc)
    
    token = create_token(user_id, data.role)
    user_response = {k: v for k, v in user_doc.items() if k != "password"}
    return TokenResponse(access_token=token, user=UserResponse(**user_response))

@api_router.post("/auth/login", response_model=TokenResponse)
async def login(data: UserLogin):
    user = await db.users.find_one({"email": data.email}, {"_id": 0})
    if not user or not verify_password(data.password, user["password"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    token = create_token(user["id"], user["role"])
    user_response = {k: v for k, v in user.items() if k != "password"}
    return TokenResponse(access_token=token, user=UserResponse(**user_response))

@api_router.get("/auth/me", response_model=UserResponse)
async def get_me(current_user: dict = Depends(get_current_user)):
    return UserResponse(**current_user)

# Verification Routes
@api_router.post("/verification/submit")
async def submit_verification(data: VerificationCreate, current_user: dict = Depends(get_current_user)):
    verification_doc = {
        "id": str(uuid.uuid4()),
        "user_id": current_user["id"],
        "id_type": data.id_type,
        "id_front_url": data.id_front_url,
        "id_back_url": data.id_back_url,
        "selfie_url": data.selfie_url,
        "status": VerificationStatus.PENDING,
        "submitted_at": datetime.now(timezone.utc).isoformat(),
        "reviewed_at": None,
        "reviewer_notes": None
    }
    await db.verifications.insert_one(verification_doc)
    await db.users.update_one(
        {"id": current_user["id"]},
        {"$set": {"verification_status": VerificationStatus.PENDING}}
    )
    return {"message": "Verification submitted", "status": "pending", "id": verification_doc["id"]}

@api_router.get("/verification/status")
async def get_verification_status(current_user: dict = Depends(get_current_user)):
    verification = await db.verifications.find_one(
        {"user_id": current_user["id"]},
        {"_id": 0},
        sort=[("submitted_at", -1)]
    )
    return {
        "status": current_user.get("verification_status", "none"),
        "verification": verification
    }

# Creator Routes
@api_router.get("/creators", response_model=List[CreatorProfile])
async def list_creators(tier: Optional[str] = None, limit: int = 20, skip: int = 0):
    query = {}
    if tier:
        query["tier"] = tier
    creators = await db.creators.find(query, {"_id": 0}).skip(skip).limit(limit).to_list(limit)
    return [CreatorProfile(**c) for c in creators]

@api_router.get("/creators/{creator_id}", response_model=CreatorProfile)
async def get_creator(creator_id: str):
    creator = await db.creators.find_one({"id": creator_id}, {"_id": 0})
    if not creator:
        # Try by user_id
        creator = await db.creators.find_one({"user_id": creator_id}, {"_id": 0})
    if not creator:
        raise HTTPException(status_code=404, detail="Creator not found")
    return CreatorProfile(**creator)

@api_router.put("/creators/profile")
async def update_creator_profile(
    display_name: Optional[str] = None,
    bio: Optional[str] = None,
    subscription_price: Optional[float] = None,
    call_rate_per_minute: Optional[float] = None,
    message_price: Optional[float] = None,
    current_user: dict = Depends(get_current_user)
):
    if current_user["role"] != UserRole.CREATOR:
        raise HTTPException(status_code=403, detail="Not a creator")
    
    update_data = {}
    if display_name:
        update_data["display_name"] = display_name
    if bio is not None:
        update_data["bio"] = bio
    if subscription_price:
        update_data["subscription_price"] = subscription_price
    if call_rate_per_minute:
        update_data["call_rate_per_minute"] = call_rate_per_minute
    if message_price:
        update_data["message_price"] = message_price
    
    if update_data:
        await db.creators.update_one({"user_id": current_user["id"]}, {"$set": update_data})
    
    creator = await db.creators.find_one({"user_id": current_user["id"]}, {"_id": 0})
    return CreatorProfile(**creator)

# Content Routes
@api_router.post("/content", response_model=ContentResponse)
async def create_content(data: ContentCreate, current_user: dict = Depends(get_current_user)):
    if current_user["role"] != UserRole.CREATOR:
        raise HTTPException(status_code=403, detail="Only creators can post content")
    
    creator = await db.creators.find_one({"user_id": current_user["id"]}, {"_id": 0})
    if not creator:
        raise HTTPException(status_code=404, detail="Creator profile not found")
    
    content_doc = {
        "id": str(uuid.uuid4()),
        "creator_id": creator["id"],
        "title": data.title,
        "description": data.description,
        "content_type": data.content_type,
        "price": data.price if data.content_type == ContentType.PPV else None,
        "media_urls": data.media_urls,
        "thumbnail_url": data.media_urls[0] if data.media_urls else None,
        "is_pinned": data.is_pinned,
        "likes_count": 0,
        "comments_count": 0,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.content.insert_one(content_doc)
    return ContentResponse(**content_doc, is_unlocked=True)

@api_router.get("/content/feed", response_model=List[ContentResponse])
async def get_feed(limit: int = 20, skip: int = 0, current_user: dict = Depends(get_current_user)):
    # Get subscribed creators
    subscriptions = await db.subscriptions.find(
        {"user_id": current_user["id"], "status": "active"},
        {"_id": 0, "creator_id": 1}
    ).to_list(1000)
    subscribed_creator_ids = [s["creator_id"] for s in subscriptions]
    
    # Get content from subscribed creators
    content = await db.content.find(
        {"creator_id": {"$in": subscribed_creator_ids}},
        {"_id": 0}
    ).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    
    # Get unlocked PPV content
    unlocked = await db.unlocks.find(
        {"user_id": current_user["id"]},
        {"_id": 0, "content_id": 1}
    ).to_list(1000)
    unlocked_ids = [u["content_id"] for u in unlocked]
    
    result = []
    for c in content:
        is_unlocked = (
            c["content_type"] == ContentType.FREE or
            c["content_type"] == ContentType.SUBSCRIPTION or
            c["id"] in unlocked_ids
        )
        result.append(ContentResponse(**c, is_unlocked=is_unlocked))
    
    return result

@api_router.get("/content/creator/{creator_id}", response_model=List[ContentResponse])
async def get_creator_content(creator_id: str, limit: int = 20, skip: int = 0, authorization: str = Header(None)):
    current_user = None
    if authorization:
        try:
            current_user = await get_current_user(authorization)
        except:
            pass
    
    content = await db.content.find(
        {"creator_id": creator_id},
        {"_id": 0}
    ).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    
    # Check subscription status
    is_subscribed = False
    unlocked_ids = []
    if current_user:
        subscription = await db.subscriptions.find_one({
            "user_id": current_user["id"],
            "creator_id": creator_id,
            "status": "active"
        })
        is_subscribed = bool(subscription)
        
        unlocked = await db.unlocks.find(
            {"user_id": current_user["id"]},
            {"_id": 0, "content_id": 1}
        ).to_list(1000)
        unlocked_ids = [u["content_id"] for u in unlocked]
    
    result = []
    for c in content:
        is_unlocked = (
            c["content_type"] == ContentType.FREE or
            (c["content_type"] == ContentType.SUBSCRIPTION and is_subscribed) or
            c["id"] in unlocked_ids
        )
        result.append(ContentResponse(**c, is_unlocked=is_unlocked))
    
    return result

# Subscription Routes
@api_router.post("/subscriptions")
async def create_subscription(data: SubscriptionCreate, current_user: dict = Depends(get_current_user)):
    if current_user.get("verification_status") != VerificationStatus.VERIFIED:
        raise HTTPException(status_code=403, detail="Verification required for subscriptions")
    
    creator = await db.creators.find_one({"id": data.creator_id}, {"_id": 0})
    if not creator:
        raise HTTPException(status_code=404, detail="Creator not found")
    
    # Check existing subscription
    existing = await db.subscriptions.find_one({
        "user_id": current_user["id"],
        "creator_id": data.creator_id,
        "status": "active"
    })
    if existing:
        raise HTTPException(status_code=400, detail="Already subscribed")
    
    subscription_doc = {
        "id": str(uuid.uuid4()),
        "user_id": current_user["id"],
        "creator_id": data.creator_id,
        "price": creator["subscription_price"],
        "status": "active",
        "started_at": datetime.now(timezone.utc).isoformat(),
        "expires_at": (datetime.now(timezone.utc) + timedelta(days=30)).isoformat()
    }
    await db.subscriptions.insert_one(subscription_doc)
    
    # Update creator stats
    await db.creators.update_one(
        {"id": data.creator_id},
        {"$inc": {"total_subscribers": 1}}
    )
    
    return {"message": "Subscribed successfully", "subscription_id": subscription_doc["id"]}

@api_router.get("/subscriptions")
async def get_subscriptions(current_user: dict = Depends(get_current_user)):
    subscriptions = await db.subscriptions.find(
        {"user_id": current_user["id"], "status": "active"},
        {"_id": 0}
    ).to_list(100)
    
    # Get creator details
    result = []
    for sub in subscriptions:
        creator = await db.creators.find_one({"id": sub["creator_id"]}, {"_id": 0})
        if creator:
            result.append({**sub, "creator": creator})
    
    return result

# Messaging Routes (E2EE Simulated)
@api_router.post("/messages", response_model=MessageResponse)
async def send_message(data: MessageCreate, current_user: dict = Depends(get_current_user)):
    if current_user.get("verification_status") != VerificationStatus.VERIFIED:
        raise HTTPException(status_code=403, detail="Verification required for messaging")
    
    message_doc = {
        "id": str(uuid.uuid4()),
        "sender_id": current_user["id"],
        "recipient_id": data.recipient_id,
        "content": data.content,
        "is_encrypted": True,
        "encryption_key_hash": generate_encryption_key()[:16],  # Simulated
        "is_paid": data.is_paid,
        "is_read": False,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.messages.insert_one(message_doc)
    
    return MessageResponse(**{k: v for k, v in message_doc.items() if k != "encryption_key_hash"})

@api_router.get("/messages/conversations")
async def get_conversations(current_user: dict = Depends(get_current_user)):
    # Get unique conversation partners
    pipeline = [
        {"$match": {"$or": [
            {"sender_id": current_user["id"]},
            {"recipient_id": current_user["id"]}
        ]}},
        {"$sort": {"created_at": -1}},
        {"$group": {
            "_id": {
                "$cond": [
                    {"$eq": ["$sender_id", current_user["id"]]},
                    "$recipient_id",
                    "$sender_id"
                ]
            },
            "last_message": {"$first": "$$ROOT"},
            "unread_count": {
                "$sum": {
                    "$cond": [
                        {"$and": [
                            {"$eq": ["$recipient_id", current_user["id"]]},
                            {"$eq": ["$is_read", False]}
                        ]},
                        1,
                        0
                    ]
                }
            }
        }}
    ]
    
    conversations = await db.messages.aggregate(pipeline).to_list(100)
    
    result = []
    for conv in conversations:
        partner_id = conv["_id"]
        partner = await db.users.find_one({"id": partner_id}, {"_id": 0, "password": 0})
        if partner:
            result.append({
                "partner": partner,
                "last_message": {
                    "content": conv["last_message"]["content"][:50] + "...",
                    "created_at": conv["last_message"]["created_at"],
                    "is_encrypted": True
                },
                "unread_count": conv["unread_count"]
            })
    
    return result

@api_router.get("/messages/{partner_id}")
async def get_messages(partner_id: str, limit: int = 50, current_user: dict = Depends(get_current_user)):
    messages = await db.messages.find(
        {"$or": [
            {"sender_id": current_user["id"], "recipient_id": partner_id},
            {"sender_id": partner_id, "recipient_id": current_user["id"]}
        ]},
        {"_id": 0, "encryption_key_hash": 0}
    ).sort("created_at", -1).limit(limit).to_list(limit)
    
    # Mark as read
    await db.messages.update_many(
        {"sender_id": partner_id, "recipient_id": current_user["id"], "is_read": False},
        {"$set": {"is_read": True}}
    )
    
    return messages[::-1]  # Reverse for chronological order

# Payment Routes
@api_router.post("/payments/checkout")
async def create_checkout(data: CheckoutRequest, request: Request, current_user: dict = Depends(get_current_user)):
    from emergentintegrations.payments.stripe.checkout import (
        StripeCheckout, CheckoutSessionRequest, CheckoutSessionResponse
    )
    
    if current_user.get("verification_status") != VerificationStatus.VERIFIED:
        raise HTTPException(status_code=403, detail="Verification required for payments")
    
    # Determine amount based on payment type
    amount = 0.0
    metadata = {
        "user_id": current_user["id"],
        "payment_type": data.payment_type,
        "creator_id": data.creator_id or "",
        "content_id": data.content_id or ""
    }
    
    if data.payment_type == PaymentType.SUBSCRIPTION:
        creator = await db.creators.find_one({"id": data.creator_id}, {"_id": 0})
        if not creator:
            raise HTTPException(status_code=404, detail="Creator not found")
        amount = creator["subscription_price"]
    elif data.payment_type == PaymentType.TIP:
        if not data.amount or data.amount < 1:
            raise HTTPException(status_code=400, detail="Invalid tip amount")
        amount = data.amount
    elif data.payment_type == PaymentType.PPV:
        content = await db.content.find_one({"id": data.content_id}, {"_id": 0})
        if not content:
            raise HTTPException(status_code=404, detail="Content not found")
        amount = content.get("price", 0)
    elif data.payment_type == PaymentType.MESSAGE:
        creator = await db.creators.find_one({"id": data.creator_id}, {"_id": 0})
        if not creator:
            raise HTTPException(status_code=404, detail="Creator not found")
        amount = creator.get("message_price", 0.99)
    
    if amount <= 0:
        raise HTTPException(status_code=400, detail="Invalid amount")
    
    # Create Stripe checkout
    webhook_url = f"{str(request.base_url)}api/webhook/stripe"
    stripe_checkout = StripeCheckout(api_key=STRIPE_API_KEY, webhook_url=webhook_url)
    
    success_url = f"{data.origin_url}/payment/success?session_id={{CHECKOUT_SESSION_ID}}"
    cancel_url = f"{data.origin_url}/payment/cancel"
    
    checkout_request = CheckoutSessionRequest(
        amount=float(amount),
        currency="usd",
        success_url=success_url,
        cancel_url=cancel_url,
        metadata=metadata
    )
    
    session = await stripe_checkout.create_checkout_session(checkout_request)
    
    # Create payment transaction record
    transaction_doc = {
        "id": str(uuid.uuid4()),
        "session_id": session.session_id,
        "user_id": current_user["id"],
        "payment_type": data.payment_type,
        "creator_id": data.creator_id,
        "content_id": data.content_id,
        "amount": amount,
        "currency": "usd",
        "platform_fee": amount * 0.25,
        "creator_earnings": amount * 0.75,
        "status": PaymentStatus.INITIATED,
        "payment_status": "pending",
        "metadata": metadata,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.payment_transactions.insert_one(transaction_doc)
    
    return {"checkout_url": session.url, "session_id": session.session_id}

@api_router.get("/payments/status/{session_id}")
async def get_payment_status(session_id: str, current_user: dict = Depends(get_current_user)):
    from emergentintegrations.payments.stripe.checkout import StripeCheckout
    
    host_url = os.environ.get('REACT_APP_BACKEND_URL', 'http://localhost:8001')
    webhook_url = f"{host_url}/api/webhook/stripe"
    stripe_checkout = StripeCheckout(api_key=STRIPE_API_KEY, webhook_url=webhook_url)
    
    checkout_status = await stripe_checkout.get_checkout_status(session_id)
    
    # Update transaction status
    transaction = await db.payment_transactions.find_one({"session_id": session_id}, {"_id": 0})
    if transaction and transaction["status"] != PaymentStatus.PAID:
        new_status = PaymentStatus.PAID if checkout_status.payment_status == "paid" else transaction["status"]
        if checkout_status.status == "expired":
            new_status = PaymentStatus.EXPIRED
        
        if new_status == PaymentStatus.PAID and transaction["status"] != PaymentStatus.PAID:
            # Process the successful payment
            await process_successful_payment(transaction)
        
        await db.payment_transactions.update_one(
            {"session_id": session_id},
            {"$set": {"status": new_status, "payment_status": checkout_status.payment_status}}
        )
    
    return {
        "status": checkout_status.status,
        "payment_status": checkout_status.payment_status,
        "amount": checkout_status.amount_total / 100
    }

async def process_successful_payment(transaction: dict):
    """Process a successful payment - create subscription, unlock content, etc."""
    payment_type = transaction["payment_type"]
    user_id = transaction["user_id"]
    creator_id = transaction.get("creator_id")
    content_id = transaction.get("content_id")
    
    if payment_type == PaymentType.SUBSCRIPTION:
        # Create/renew subscription
        subscription_doc = {
            "id": str(uuid.uuid4()),
            "user_id": user_id,
            "creator_id": creator_id,
            "price": transaction["amount"],
            "status": "active",
            "started_at": datetime.now(timezone.utc).isoformat(),
            "expires_at": (datetime.now(timezone.utc) + timedelta(days=30)).isoformat(),
            "transaction_id": transaction["id"]
        }
        await db.subscriptions.insert_one(subscription_doc)
        await db.creators.update_one({"id": creator_id}, {"$inc": {"total_subscribers": 1}})
    
    elif payment_type == PaymentType.PPV:
        # Unlock content
        unlock_doc = {
            "id": str(uuid.uuid4()),
            "user_id": user_id,
            "content_id": content_id,
            "transaction_id": transaction["id"],
            "unlocked_at": datetime.now(timezone.utc).isoformat()
        }
        await db.unlocks.insert_one(unlock_doc)
    
    # Update creator earnings
    if creator_id:
        await db.creators.update_one(
            {"id": creator_id},
            {"$inc": {"total_earnings": transaction["creator_earnings"]}}
        )

@api_router.post("/webhook/stripe")
async def stripe_webhook(request: Request):
    from emergentintegrations.payments.stripe.checkout import StripeCheckout
    
    body = await request.body()
    signature = request.headers.get("Stripe-Signature", "")
    
    webhook_url = f"{str(request.base_url)}api/webhook/stripe"
    stripe_checkout = StripeCheckout(api_key=STRIPE_API_KEY, webhook_url=webhook_url)
    
    try:
        webhook_response = await stripe_checkout.handle_webhook(body, signature)
        
        if webhook_response.payment_status == "paid":
            transaction = await db.payment_transactions.find_one(
                {"session_id": webhook_response.session_id},
                {"_id": 0}
            )
            if transaction and transaction["status"] != PaymentStatus.PAID:
                await process_successful_payment(transaction)
                await db.payment_transactions.update_one(
                    {"session_id": webhook_response.session_id},
                    {"$set": {"status": PaymentStatus.PAID, "payment_status": "paid"}}
                )
        
        return {"status": "ok"}
    except Exception as e:
        logger.error(f"Webhook error: {e}")
        return {"status": "error", "message": str(e)}

# Earnings Routes (Creator Dashboard)
@api_router.get("/earnings")
async def get_earnings(current_user: dict = Depends(get_current_user)):
    if current_user["role"] != UserRole.CREATOR:
        raise HTTPException(status_code=403, detail="Not a creator")
    
    creator = await db.creators.find_one({"user_id": current_user["id"]}, {"_id": 0})
    if not creator:
        raise HTTPException(status_code=404, detail="Creator profile not found")
    
    # Get earnings breakdown
    transactions = await db.payment_transactions.find(
        {"creator_id": creator["id"], "status": PaymentStatus.PAID},
        {"_id": 0}
    ).to_list(1000)
    
    earnings_by_type = {}
    for t in transactions:
        ptype = t["payment_type"]
        if ptype not in earnings_by_type:
            earnings_by_type[ptype] = 0
        earnings_by_type[ptype] += t.get("creator_earnings", 0)
    
    # Monthly earnings (last 6 months)
    monthly = []
    for i in range(6):
        month_start = datetime.now(timezone.utc).replace(day=1) - timedelta(days=30*i)
        month_end = month_start + timedelta(days=30)
        month_earnings = sum(
            t.get("creator_earnings", 0) for t in transactions
            if month_start.isoformat() <= t["created_at"] < month_end.isoformat()
        )
        monthly.append({
            "month": month_start.strftime("%B %Y"),
            "earnings": month_earnings
        })
    
    return {
        "total_earnings": creator["total_earnings"],
        "total_subscribers": creator["total_subscribers"],
        "earnings_by_type": earnings_by_type,
        "monthly_earnings": monthly[::-1],
        "pending_payout": creator["total_earnings"] * 0.9  # 10% held for verification
    }

# Admin Routes
@api_router.get("/admin/verifications")
async def admin_list_verifications(status: Optional[str] = None, current_user: dict = Depends(get_current_user)):
    if current_user["role"] != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    query = {}
    if status:
        query["status"] = status
    
    verifications = await db.verifications.find(query, {"_id": 0}).sort("submitted_at", -1).to_list(100)
    
    # Get user details
    result = []
    for v in verifications:
        user = await db.users.find_one({"id": v["user_id"]}, {"_id": 0, "password": 0})
        result.append({**v, "user": user})
    
    return result

@api_router.post("/admin/verifications/{verification_id}/approve")
async def admin_approve_verification(verification_id: str, current_user: dict = Depends(get_current_user)):
    if current_user["role"] != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    verification = await db.verifications.find_one({"id": verification_id}, {"_id": 0})
    if not verification:
        raise HTTPException(status_code=404, detail="Verification not found")
    
    await db.verifications.update_one(
        {"id": verification_id},
        {"$set": {
            "status": VerificationStatus.VERIFIED,
            "reviewed_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    await db.users.update_one(
        {"id": verification["user_id"]},
        {"$set": {"verification_status": VerificationStatus.VERIFIED}}
    )
    
    # Update creator profile if exists
    await db.creators.update_one(
        {"user_id": verification["user_id"]},
        {"$set": {"verification_status": VerificationStatus.VERIFIED, "tier": CreatorTier.VERIFIED}}
    )
    
    return {"message": "Verification approved"}

@api_router.post("/admin/verifications/{verification_id}/reject")
async def admin_reject_verification(verification_id: str, reason: str = "", current_user: dict = Depends(get_current_user)):
    if current_user["role"] != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    verification = await db.verifications.find_one({"id": verification_id}, {"_id": 0})
    if not verification:
        raise HTTPException(status_code=404, detail="Verification not found")
    
    await db.verifications.update_one(
        {"id": verification_id},
        {"$set": {
            "status": VerificationStatus.REJECTED,
            "reviewed_at": datetime.now(timezone.utc).isoformat(),
            "reviewer_notes": reason
        }}
    )
    
    await db.users.update_one(
        {"id": verification["user_id"]},
        {"$set": {"verification_status": VerificationStatus.REJECTED}}
    )
    
    return {"message": "Verification rejected"}

@api_router.get("/admin/analytics")
async def admin_get_analytics(current_user: dict = Depends(get_current_user)):
    if current_user["role"] != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    total_users = await db.users.count_documents({})
    total_creators = await db.creators.count_documents({})
    verified_users = await db.users.count_documents({"verification_status": VerificationStatus.VERIFIED})
    pending_verifications = await db.verifications.count_documents({"status": VerificationStatus.PENDING})
    
    # Revenue stats
    transactions = await db.payment_transactions.find(
        {"status": PaymentStatus.PAID},
        {"_id": 0, "amount": 1, "platform_fee": 1, "created_at": 1}
    ).to_list(10000)
    
    total_revenue = sum(t["amount"] for t in transactions)
    platform_earnings = sum(t["platform_fee"] for t in transactions)
    
    return {
        "total_users": total_users,
        "total_creators": total_creators,
        "verified_users": verified_users,
        "pending_verifications": pending_verifications,
        "total_revenue": total_revenue,
        "platform_earnings": platform_earnings,
        "active_subscriptions": await db.subscriptions.count_documents({"status": "active"})
    }

# Call Routes (Simulated E2EE)
@api_router.post("/calls/initiate")
async def initiate_call(creator_id: str, call_type: str = "video", current_user: dict = Depends(get_current_user)):
    if current_user.get("verification_status") != VerificationStatus.VERIFIED:
        raise HTTPException(status_code=403, detail="Verification required for calls")
    
    creator = await db.creators.find_one({"id": creator_id}, {"_id": 0})
    if not creator:
        raise HTTPException(status_code=404, detail="Creator not found")
    
    if not creator.get("is_online"):
        raise HTTPException(status_code=400, detail="Creator is not available")
    
    call_doc = {
        "id": str(uuid.uuid4()),
        "caller_id": current_user["id"],
        "creator_id": creator_id,
        "call_type": call_type,
        "rate_per_minute": creator["call_rate_per_minute"],
        "status": "pending",
        "encryption_key": generate_encryption_key(),
        "started_at": None,
        "ended_at": None,
        "duration_minutes": 0,
        "total_charge": 0,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.calls.insert_one(call_doc)
    
    return {
        "call_id": call_doc["id"],
        "status": "pending",
        "encryption_key": call_doc["encryption_key"][:32],  # Truncated for display
        "is_encrypted": True
    }

@api_router.post("/calls/{call_id}/end")
async def end_call(call_id: str, current_user: dict = Depends(get_current_user)):
    call = await db.calls.find_one({"id": call_id}, {"_id": 0})
    if not call:
        raise HTTPException(status_code=404, detail="Call not found")
    
    if call["caller_id"] != current_user["id"] and call["creator_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Calculate duration and charge
    if call.get("started_at"):
        started = datetime.fromisoformat(call["started_at"])
        ended = datetime.now(timezone.utc)
        duration_minutes = max(1, int((ended - started).total_seconds() / 60))
        total_charge = duration_minutes * call["rate_per_minute"]
        
        await db.calls.update_one(
            {"id": call_id},
            {"$set": {
                "status": "ended",
                "ended_at": ended.isoformat(),
                "duration_minutes": duration_minutes,
                "total_charge": total_charge
            }}
        )
        
        return {
            "status": "ended",
            "duration_minutes": duration_minutes,
            "total_charge": total_charge
        }
    
    await db.calls.update_one({"id": call_id}, {"$set": {"status": "cancelled"}})
    return {"status": "cancelled"}

# Discover/Explore Routes
@api_router.get("/discover")
async def discover_creators(
    tier: Optional[str] = None,
    search: Optional[str] = None,
    limit: int = 20,
    skip: int = 0
):
    query = {"verification_status": VerificationStatus.VERIFIED}
    if tier:
        query["tier"] = tier
    if search:
        query["$or"] = [
            {"display_name": {"$regex": search, "$options": "i"}},
            {"username": {"$regex": search, "$options": "i"}}
        ]
    
    creators = await db.creators.find(query, {"_id": 0}).sort("total_subscribers", -1).skip(skip).limit(limit).to_list(limit)
    return creators

# Health check
@api_router.get("/")
async def root():
    return {"message": "PRIVÉ API v1.0.0", "status": "operational"}

@api_router.get("/health")
async def health():
    return {"status": "healthy", "timestamp": datetime.now(timezone.utc).isoformat()}

# Include router
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
