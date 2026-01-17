from fastapi import FastAPI, APIRouter, HTTPException, Depends, UploadFile, File, Request, Header, Body
from fastapi.responses import FileResponse, JSONResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr, ConfigDict
from typing import List, Optional, Dict, Any, Union
import uuid
from datetime import datetime, timezone, timedelta
import bcrypt
import jwt
from enum import Enum
import secrets
import base64
import hashlib
import json
import pyotp
import qrcode
from io import BytesIO
import aiofiles
import hmac

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

# Create the main app
app = FastAPI(title="PRIVÉ API", version="2.0.0")
api_router = APIRouter(prefix="/api")

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# ==================== ENUMS ====================
class UserRole(str, Enum):
    USER = "user"
    CREATOR = "creator"
    ADMIN = "admin"
    SUPER_ADMIN = "super_admin"

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

class KYCProvider(str, Enum):
    MOCK = "mock"
    JUMIO = "jumio"
    ONFIDO = "onfido"
    VERIFF = "veriff"

class StorageProvider(str, Enum):
    LOCAL = "local"
    S3 = "s3"
    CLOUDINARY = "cloudinary"

class PaymentProvider(str, Enum):
    STRIPE_TEST = "stripe_test"
    STRIPE_LIVE = "stripe_live"

# ==================== SYSTEM CONFIG ====================
class SystemConfig:
    """Dynamic system configuration loaded from database"""
    _instance = None
    _config = None
    
    @classmethod
    async def get_config(cls) -> dict:
        if cls._config is None:
            cls._config = await db.system_config.find_one({"type": "main"}, {"_id": 0})
            if not cls._config:
                # Initialize default config
                cls._config = {
                    "type": "main",
                    "storage": {
                        "provider": "local",
                        "s3_bucket": "",
                        "s3_region": "us-east-1",
                        "s3_access_key": "",
                        "s3_secret_key": "",
                        "cloudinary_cloud_name": "",
                        "cloudinary_api_key": "",
                        "cloudinary_api_secret": ""
                    },
                    "payment": {
                        "provider": "stripe_test",
                        "stripe_test_key": os.environ.get('STRIPE_API_KEY', 'sk_test_emergent'),
                        "stripe_live_key": "",
                        "stripe_connect_enabled": True,
                        "platform_fee_percent": 25.0
                    },
                    "kyc": {
                        "provider": "mock",
                        "jumio_api_key": "",
                        "jumio_api_secret": "",
                        "onfido_api_key": "",
                        "veriff_api_key": "",
                        "veriff_api_secret": ""
                    },
                    "encryption": {
                        "e2ee_enabled": True,
                        "use_libsignal": False,
                        "fallback_webcrypto": True
                    },
                    "referral": {
                        "enabled": True,
                        "creator_bonus_percent": 10.0,
                        "user_bonus_percent": 5.0,
                        "bonus_duration_months": 6,
                        "tiered_bonuses": {
                            "bronze": {"min_referrals": 1, "bonus_percent": 5.0},
                            "silver": {"min_referrals": 5, "bonus_percent": 7.5},
                            "gold": {"min_referrals": 10, "bonus_percent": 10.0},
                            "platinum": {"min_referrals": 25, "bonus_percent": 12.5}
                        }
                    },
                    "updated_at": datetime.now(timezone.utc).isoformat()
                }
                await db.system_config.insert_one(cls._config)
        return cls._config
    
    @classmethod
    async def update_config(cls, updates: dict):
        updates["updated_at"] = datetime.now(timezone.utc).isoformat()
        await db.system_config.update_one(
            {"type": "main"},
            {"$set": updates},
            upsert=True
        )
        cls._config = None  # Force reload

    @classmethod
    def invalidate_cache(cls):
        cls._config = None

# ==================== PYDANTIC MODELS ====================
class UserBase(BaseModel):
    email: EmailStr
    username: str
    display_name: Optional[str] = None

class UserCreate(BaseModel):
    email: EmailStr
    username: str
    password: str
    role: UserRole = UserRole.USER
    referral_code: Optional[str] = None

class UserLogin(BaseModel):
    email: EmailStr
    password: str
    totp_code: Optional[str] = None

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
    has_2fa: bool = False
    referral_code: Optional[str] = None
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
    pending_payout: float = 0.0
    is_online: bool = False
    call_rate_per_minute: float = 2.99
    message_price: float = 0.99
    stripe_connect_id: Optional[str] = None
    payout_enabled: bool = False

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse
    requires_2fa: bool = False

class TwoFactorSetup(BaseModel):
    secret: str
    qr_code: str
    backup_codes: List[str]

class SystemConfigUpdate(BaseModel):
    storage: Optional[dict] = None
    payment: Optional[dict] = None
    kyc: Optional[dict] = None
    encryption: Optional[dict] = None
    referral: Optional[dict] = None

class KYCSubmission(BaseModel):
    id_type: str = "government_id"
    id_front_data: Optional[str] = None  # Base64 encoded
    id_back_data: Optional[str] = None
    selfie_data: Optional[str] = None
    country: str = "US"

class StripeConnectOnboard(BaseModel):
    return_url: str
    refresh_url: str

class PayoutRequest(BaseModel):
    amount: float
    
class MessageCreate(BaseModel):
    recipient_id: str
    content: str
    encrypted_content: Optional[str] = None
    encryption_metadata: Optional[dict] = None

class EncryptionKeyExchange(BaseModel):
    recipient_id: str
    public_key: str
    signed_prekey: Optional[str] = None
    one_time_prekeys: Optional[List[str]] = None

# ==================== HELPER FUNCTIONS ====================
def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()

def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode(), hashed.encode())

def create_token(user_id: str, role: str, is_partial: bool = False) -> str:
    expiration = datetime.now(timezone.utc) + timedelta(hours=JWT_EXPIRATION_HOURS if not is_partial else 0.1)
    payload = {"sub": user_id, "role": role, "exp": expiration, "partial": is_partial}
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

def generate_referral_code() -> str:
    return secrets.token_urlsafe(8).upper()[:8]

def generate_backup_codes(count: int = 10) -> List[str]:
    return [secrets.token_hex(4).upper() for _ in range(count)]

async def get_current_user(authorization: str = Header(None)) -> dict:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")
    token = authorization.split(" ")[1]
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        if payload.get("partial"):
            raise HTTPException(status_code=401, detail="2FA verification required")
        user = await db.users.find_one({"id": payload["sub"]}, {"_id": 0, "password": 0})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

async def require_super_admin(current_user: dict = Depends(get_current_user)) -> dict:
    if current_user.get("role") != UserRole.SUPER_ADMIN:
        raise HTTPException(status_code=403, detail="Super admin access required")
    return current_user

async def require_admin(current_user: dict = Depends(get_current_user)) -> dict:
    if current_user.get("role") not in [UserRole.ADMIN, UserRole.SUPER_ADMIN]:
        raise HTTPException(status_code=403, detail="Admin access required")
    return current_user

# ==================== STORAGE SERVICE ====================
class StorageService:
    @staticmethod
    async def upload_file(file_data: bytes, filename: str, content_type: str = "image/jpeg") -> str:
        config = await SystemConfig.get_config()
        provider = config["storage"]["provider"]
        
        if provider == "s3":
            return await StorageService._upload_s3(file_data, filename, content_type, config["storage"])
        elif provider == "cloudinary":
            return await StorageService._upload_cloudinary(file_data, filename, config["storage"])
        else:
            return await StorageService._upload_local(file_data, filename)
    
    @staticmethod
    async def _upload_local(file_data: bytes, filename: str) -> str:
        upload_dir = ROOT_DIR / "uploads"
        upload_dir.mkdir(exist_ok=True)
        
        file_id = str(uuid.uuid4())
        ext = filename.split(".")[-1] if "." in filename else "jpg"
        file_path = upload_dir / f"{file_id}.{ext}"
        
        async with aiofiles.open(file_path, "wb") as f:
            await f.write(file_data)
        
        return f"/api/media/{file_id}.{ext}"
    
    @staticmethod
    async def _upload_s3(file_data: bytes, filename: str, content_type: str, config: dict) -> str:
        import boto3
        
        s3 = boto3.client(
            's3',
            aws_access_key_id=config["s3_access_key"],
            aws_secret_access_key=config["s3_secret_key"],
            region_name=config["s3_region"]
        )
        
        file_id = str(uuid.uuid4())
        ext = filename.split(".")[-1] if "." in filename else "jpg"
        key = f"uploads/{file_id}.{ext}"
        
        s3.put_object(
            Bucket=config["s3_bucket"],
            Key=key,
            Body=file_data,
            ContentType=content_type
        )
        
        return f"https://{config['s3_bucket']}.s3.{config['s3_region']}.amazonaws.com/{key}"
    
    @staticmethod
    async def _upload_cloudinary(file_data: bytes, filename: str, config: dict) -> str:
        import cloudinary
        import cloudinary.uploader
        
        cloudinary.config(
            cloud_name=config["cloudinary_cloud_name"],
            api_key=config["cloudinary_api_key"],
            api_secret=config["cloudinary_api_secret"]
        )
        
        result = cloudinary.uploader.upload(file_data)
        return result["secure_url"]

# ==================== KYC SERVICE ====================
class KYCService:
    @staticmethod
    async def submit_verification(user_id: str, data: KYCSubmission) -> dict:
        config = await SystemConfig.get_config()
        provider = config["kyc"]["provider"]
        
        if provider == "jumio":
            return await KYCService._submit_jumio(user_id, data, config["kyc"])
        elif provider == "onfido":
            return await KYCService._submit_onfido(user_id, data, config["kyc"])
        elif provider == "veriff":
            return await KYCService._submit_veriff(user_id, data, config["kyc"])
        else:
            return await KYCService._submit_mock(user_id, data)
    
    @staticmethod
    async def _submit_mock(user_id: str, data: KYCSubmission) -> dict:
        """Mock KYC - stores data and sets pending status"""
        verification_id = str(uuid.uuid4())
        
        # Store uploaded images
        id_front_url = None
        id_back_url = None
        selfie_url = None
        
        if data.id_front_data:
            file_data = base64.b64decode(data.id_front_data.split(",")[-1] if "," in data.id_front_data else data.id_front_data)
            id_front_url = await StorageService.upload_file(file_data, "id_front.jpg")
        
        if data.id_back_data:
            file_data = base64.b64decode(data.id_back_data.split(",")[-1] if "," in data.id_back_data else data.id_back_data)
            id_back_url = await StorageService.upload_file(file_data, "id_back.jpg")
        
        if data.selfie_data:
            file_data = base64.b64decode(data.selfie_data.split(",")[-1] if "," in data.selfie_data else data.selfie_data)
            selfie_url = await StorageService.upload_file(file_data, "selfie.jpg")
        
        doc = {
            "id": verification_id,
            "user_id": user_id,
            "provider": "mock",
            "external_id": f"mock_{verification_id}",
            "id_type": data.id_type,
            "country": data.country,
            "id_front_url": id_front_url,
            "id_back_url": id_back_url,
            "selfie_url": selfie_url,
            "status": VerificationStatus.PENDING,
            "submitted_at": datetime.now(timezone.utc).isoformat(),
            "reviewed_at": None,
            "reviewer_notes": None,
            "provider_response": None
        }
        
        await db.verifications.insert_one(doc)
        await db.users.update_one(
            {"id": user_id},
            {"$set": {"verification_status": VerificationStatus.PENDING}}
        )
        
        return {"verification_id": verification_id, "status": "pending", "provider": "mock"}
    
    @staticmethod
    async def _submit_jumio(user_id: str, data: KYCSubmission, config: dict) -> dict:
        """Jumio KYC integration"""
        import httpx
        
        async with httpx.AsyncClient() as client:
            # Initialize Jumio transaction
            auth = base64.b64encode(f"{config['jumio_api_key']}:{config['jumio_api_secret']}".encode()).decode()
            
            response = await client.post(
                "https://netverify.com/api/v4/initiate",
                headers={
                    "Authorization": f"Basic {auth}",
                    "Content-Type": "application/json"
                },
                json={
                    "customerInternalReference": user_id,
                    "userReference": user_id,
                    "workflowDefinition": {"key": "10001"}
                }
            )
            
            if response.status_code == 200:
                result = response.json()
                return {
                    "verification_id": result.get("transactionReference"),
                    "redirect_url": result.get("redirectUrl"),
                    "status": "pending",
                    "provider": "jumio"
                }
            else:
                # Fallback to mock
                return await KYCService._submit_mock(user_id, data)
    
    @staticmethod
    async def _submit_onfido(user_id: str, data: KYCSubmission, config: dict) -> dict:
        """Onfido KYC integration"""
        import httpx
        
        async with httpx.AsyncClient() as client:
            # Create applicant
            response = await client.post(
                "https://api.onfido.com/v3.6/applicants",
                headers={
                    "Authorization": f"Token token={config['onfido_api_key']}",
                    "Content-Type": "application/json"
                },
                json={"first_name": "User", "last_name": user_id[:8]}
            )
            
            if response.status_code == 201:
                applicant = response.json()
                
                # Create SDK token
                sdk_response = await client.post(
                    "https://api.onfido.com/v3.6/sdk_token",
                    headers={
                        "Authorization": f"Token token={config['onfido_api_key']}",
                        "Content-Type": "application/json"
                    },
                    json={"applicant_id": applicant["id"]}
                )
                
                if sdk_response.status_code == 200:
                    sdk_token = sdk_response.json()
                    return {
                        "verification_id": applicant["id"],
                        "sdk_token": sdk_token["token"],
                        "status": "pending",
                        "provider": "onfido"
                    }
            
            return await KYCService._submit_mock(user_id, data)
    
    @staticmethod
    async def _submit_veriff(user_id: str, data: KYCSubmission, config: dict) -> dict:
        """Veriff KYC integration"""
        import httpx
        
        async with httpx.AsyncClient() as client:
            response = await client.post(
                "https://stationapi.veriff.com/v1/sessions",
                headers={
                    "X-AUTH-CLIENT": config["veriff_api_key"],
                    "Content-Type": "application/json"
                },
                json={
                    "verification": {
                        "vendorData": user_id,
                        "timestamp": datetime.now(timezone.utc).isoformat()
                    }
                }
            )
            
            if response.status_code == 201:
                result = response.json()
                return {
                    "verification_id": result["verification"]["id"],
                    "session_url": result["verification"]["url"],
                    "status": "pending",
                    "provider": "veriff"
                }
            
            return await KYCService._submit_mock(user_id, data)

# ==================== STRIPE CONNECT SERVICE ====================
class StripeService:
    @staticmethod
    async def get_client():
        config = await SystemConfig.get_config()
        provider = config["payment"]["provider"]
        
        if provider == "stripe_live":
            api_key = config["payment"]["stripe_live_key"]
        else:
            api_key = config["payment"]["stripe_test_key"]
        
        import stripe
        stripe.api_key = api_key
        return stripe
    
    @staticmethod
    async def create_connect_account(user_id: str, email: str) -> dict:
        stripe = await StripeService.get_client()
        
        try:
            account = stripe.Account.create(
                type="express",
                email=email,
                capabilities={
                    "card_payments": {"requested": True},
                    "transfers": {"requested": True}
                },
                metadata={"user_id": user_id}
            )
            
            return {"account_id": account.id, "status": "created"}
        except Exception as e:
            logger.error(f"Stripe Connect error: {e}")
            return {"account_id": None, "status": "error", "message": str(e)}
    
    @staticmethod
    async def create_onboarding_link(account_id: str, return_url: str, refresh_url: str) -> str:
        stripe = await StripeService.get_client()
        
        link = stripe.AccountLink.create(
            account=account_id,
            refresh_url=refresh_url,
            return_url=return_url,
            type="account_onboarding"
        )
        
        return link.url
    
    @staticmethod
    async def create_payout(account_id: str, amount: float) -> dict:
        stripe = await StripeService.get_client()
        
        try:
            # Transfer to connected account
            transfer = stripe.Transfer.create(
                amount=int(amount * 100),  # Convert to cents
                currency="usd",
                destination=account_id
            )
            
            return {"transfer_id": transfer.id, "status": "success", "amount": amount}
        except Exception as e:
            logger.error(f"Payout error: {e}")
            return {"transfer_id": None, "status": "error", "message": str(e)}
    
    @staticmethod
    async def check_account_status(account_id: str) -> dict:
        stripe = await StripeService.get_client()
        
        try:
            account = stripe.Account.retrieve(account_id)
            return {
                "charges_enabled": account.charges_enabled,
                "payouts_enabled": account.payouts_enabled,
                "details_submitted": account.details_submitted
            }
        except Exception as e:
            return {"charges_enabled": False, "payouts_enabled": False, "error": str(e)}

# ==================== E2EE ENCRYPTION SERVICE ====================
class E2EEService:
    """End-to-End Encryption Service with libsignal-compatible architecture"""
    
    @staticmethod
    async def generate_identity_keys() -> dict:
        """Generate identity key pair for a user"""
        from cryptography.hazmat.primitives.asymmetric import x25519
        from cryptography.hazmat.primitives import serialization
        
        private_key = x25519.X25519PrivateKey.generate()
        public_key = private_key.public_key()
        
        private_bytes = private_key.private_bytes(
            encoding=serialization.Encoding.Raw,
            format=serialization.PrivateFormat.Raw,
            encryption_algorithm=serialization.NoEncryption()
        )
        
        public_bytes = public_key.public_bytes(
            encoding=serialization.Encoding.Raw,
            format=serialization.PublicFormat.Raw
        )
        
        return {
            "private_key": base64.b64encode(private_bytes).decode(),
            "public_key": base64.b64encode(public_bytes).decode()
        }
    
    @staticmethod
    async def generate_prekeys(count: int = 100) -> List[dict]:
        """Generate one-time prekeys"""
        prekeys = []
        for i in range(count):
            keys = await E2EEService.generate_identity_keys()
            prekeys.append({
                "id": i,
                "public_key": keys["public_key"]
            })
        return prekeys
    
    @staticmethod
    async def store_user_keys(user_id: str, identity_key: str, signed_prekey: str, prekeys: List[dict]):
        """Store user's public keys for key exchange"""
        await db.encryption_keys.update_one(
            {"user_id": user_id},
            {"$set": {
                "user_id": user_id,
                "identity_key": identity_key,
                "signed_prekey": signed_prekey,
                "prekeys": prekeys,
                "updated_at": datetime.now(timezone.utc).isoformat()
            }},
            upsert=True
        )
    
    @staticmethod
    async def get_user_prekey_bundle(user_id: str) -> Optional[dict]:
        """Get a user's prekey bundle for initiating encrypted session"""
        bundle = await db.encryption_keys.find_one({"user_id": user_id}, {"_id": 0})
        if bundle and bundle.get("prekeys"):
            # Return one prekey and remove it
            prekey = bundle["prekeys"].pop(0) if bundle["prekeys"] else None
            await db.encryption_keys.update_one(
                {"user_id": user_id},
                {"$set": {"prekeys": bundle["prekeys"]}}
            )
            return {
                "identity_key": bundle["identity_key"],
                "signed_prekey": bundle["signed_prekey"],
                "prekey": prekey
            }
        return None
    
    @staticmethod
    async def encrypt_message_webcrypto(message: str, shared_secret: bytes) -> dict:
        """Fallback encryption using Web Crypto compatible AES-GCM"""
        from cryptography.hazmat.primitives.ciphers.aead import AESGCM
        
        # Derive key from shared secret
        key = hashlib.sha256(shared_secret).digest()
        aesgcm = AESGCM(key)
        
        nonce = secrets.token_bytes(12)
        ciphertext = aesgcm.encrypt(nonce, message.encode(), None)
        
        return {
            "ciphertext": base64.b64encode(ciphertext).decode(),
            "nonce": base64.b64encode(nonce).decode(),
            "algorithm": "AES-GCM-256"
        }
    
    @staticmethod
    async def decrypt_message_webcrypto(encrypted_data: dict, shared_secret: bytes) -> str:
        """Decrypt message using AES-GCM"""
        from cryptography.hazmat.primitives.ciphers.aead import AESGCM
        
        key = hashlib.sha256(shared_secret).digest()
        aesgcm = AESGCM(key)
        
        ciphertext = base64.b64decode(encrypted_data["ciphertext"])
        nonce = base64.b64decode(encrypted_data["nonce"])
        
        plaintext = aesgcm.decrypt(nonce, ciphertext, None)
        return plaintext.decode()

# ==================== REFERRAL SERVICE ====================
class ReferralService:
    @staticmethod
    async def process_referral(new_user_id: str, referral_code: str):
        """Process a referral when a new user signs up"""
        config = await SystemConfig.get_config()
        if not config["referral"]["enabled"]:
            return
        
        # Find referrer
        referrer = await db.users.find_one({"referral_code": referral_code}, {"_id": 0})
        if not referrer:
            return
        
        # Determine bonus tier
        referrer_stats = await db.referrals.count_documents({"referrer_id": referrer["id"]})
        tier_bonuses = config["referral"]["tiered_bonuses"]
        
        bonus_percent = config["referral"]["user_bonus_percent"]
        tier = "bronze"
        
        for tier_name, tier_config in sorted(tier_bonuses.items(), key=lambda x: x[1]["min_referrals"], reverse=True):
            if referrer_stats >= tier_config["min_referrals"]:
                bonus_percent = tier_config["bonus_percent"]
                tier = tier_name
                break
        
        # Create referral record
        referral_doc = {
            "id": str(uuid.uuid4()),
            "referrer_id": referrer["id"],
            "referred_id": new_user_id,
            "referral_code": referral_code,
            "bonus_percent": bonus_percent,
            "tier": tier,
            "bonus_duration_months": config["referral"]["bonus_duration_months"],
            "expires_at": (datetime.now(timezone.utc) + timedelta(days=30 * config["referral"]["bonus_duration_months"])).isoformat(),
            "total_bonus_earned": 0.0,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        
        await db.referrals.insert_one(referral_doc)
        
        # Update referrer stats
        await db.users.update_one(
            {"id": referrer["id"]},
            {"$inc": {"total_referrals": 1}}
        )
    
    @staticmethod
    async def calculate_referral_bonus(transaction_amount: float, creator_id: str) -> float:
        """Calculate referral bonus for a transaction"""
        config = await SystemConfig.get_config()
        if not config["referral"]["enabled"]:
            return 0.0
        
        # Check if creator was referred and referral is still active
        creator = await db.users.find_one({"id": creator_id}, {"_id": 0})
        if not creator:
            return 0.0
        
        referral = await db.referrals.find_one({
            "referred_id": creator_id,
            "expires_at": {"$gt": datetime.now(timezone.utc).isoformat()}
        }, {"_id": 0})
        
        if not referral:
            return 0.0
        
        bonus = transaction_amount * (referral["bonus_percent"] / 100)
        
        # Update referral stats
        await db.referrals.update_one(
            {"id": referral["id"]},
            {"$inc": {"total_bonus_earned": bonus}}
        )
        
        # Credit bonus to referrer
        await db.users.update_one(
            {"id": referral["referrer_id"]},
            {"$inc": {"referral_earnings": bonus}}
        )
        
        return bonus

# ==================== AUTH ROUTES ====================
@api_router.post("/auth/register", response_model=TokenResponse)
async def register(data: UserCreate):
    existing = await db.users.find_one({"$or": [{"email": data.email}, {"username": data.username}]})
    if existing:
        raise HTTPException(status_code=400, detail="Email or username already exists")
    
    user_id = str(uuid.uuid4())
    referral_code = generate_referral_code()
    
    user_doc = {
        "id": user_id,
        "email": data.email,
        "username": data.username,
        "display_name": data.username,
        "password": hash_password(data.password),
        "role": data.role,
        "verification_status": VerificationStatus.NONE,
        "has_2fa": False,
        "totp_secret": None,
        "backup_codes": [],
        "referral_code": referral_code,
        "referred_by": data.referral_code,
        "total_referrals": 0,
        "referral_earnings": 0.0,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "bio": None,
        "avatar_url": None
    }
    await db.users.insert_one(user_doc)
    
    # Process referral if provided
    if data.referral_code:
        await ReferralService.process_referral(user_id, data.referral_code)
    
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
            "pending_payout": 0.0,
            "is_online": False,
            "call_rate_per_minute": 2.99,
            "message_price": 0.99,
            "stripe_connect_id": None,
            "payout_enabled": False,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.creators.insert_one(creator_doc)
    
    token = create_token(user_id, data.role)
    user_response = {k: v for k, v in user_doc.items() if k not in ["password", "totp_secret", "backup_codes"]}
    return TokenResponse(access_token=token, user=UserResponse(**user_response))

@api_router.post("/auth/login", response_model=TokenResponse)
async def login(data: UserLogin):
    user = await db.users.find_one({"email": data.email}, {"_id": 0})
    if not user or not verify_password(data.password, user["password"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    # Check 2FA
    if user.get("has_2fa") and user.get("totp_secret"):
        if not data.totp_code:
            # Return partial token for 2FA verification
            partial_token = create_token(user["id"], user["role"], is_partial=True)
            return TokenResponse(
                access_token=partial_token,
                user=UserResponse(**{k: v for k, v in user.items() if k not in ["password", "totp_secret", "backup_codes"]}),
                requires_2fa=True
            )
        
        # Verify TOTP
        totp = pyotp.TOTP(user["totp_secret"])
        if not totp.verify(data.totp_code):
            # Check backup codes
            if data.totp_code in user.get("backup_codes", []):
                # Remove used backup code
                await db.users.update_one(
                    {"id": user["id"]},
                    {"$pull": {"backup_codes": data.totp_code}}
                )
            else:
                raise HTTPException(status_code=401, detail="Invalid 2FA code")
    
    token = create_token(user["id"], user["role"])
    user_response = {k: v for k, v in user.items() if k not in ["password", "totp_secret", "backup_codes"]}
    return TokenResponse(access_token=token, user=UserResponse(**user_response))

@api_router.get("/auth/me", response_model=UserResponse)
async def get_me(current_user: dict = Depends(get_current_user)):
    return UserResponse(**current_user)

# ==================== 2FA ROUTES ====================
@api_router.post("/auth/2fa/setup", response_model=TwoFactorSetup)
async def setup_2fa(current_user: dict = Depends(get_current_user)):
    if current_user.get("has_2fa"):
        raise HTTPException(status_code=400, detail="2FA already enabled")
    
    secret = pyotp.random_base32()
    totp = pyotp.TOTP(secret)
    
    # Generate QR code
    provisioning_uri = totp.provisioning_uri(
        name=current_user["email"],
        issuer_name="PRIVÉ"
    )
    
    qr = qrcode.QRCode(version=1, box_size=10, border=5)
    qr.add_data(provisioning_uri)
    qr.make(fit=True)
    
    img = qr.make_image(fill_color="black", back_color="white")
    buffer = BytesIO()
    img.save(buffer, format="PNG")
    qr_code_b64 = base64.b64encode(buffer.getvalue()).decode()
    
    backup_codes = generate_backup_codes()
    
    # Store temporarily until confirmed
    await db.users.update_one(
        {"id": current_user["id"]},
        {"$set": {
            "pending_totp_secret": secret,
            "pending_backup_codes": backup_codes
        }}
    )
    
    return TwoFactorSetup(
        secret=secret,
        qr_code=f"data:image/png;base64,{qr_code_b64}",
        backup_codes=backup_codes
    )

@api_router.post("/auth/2fa/confirm")
async def confirm_2fa(totp_code: str = Body(..., embed=True), current_user: dict = Depends(get_current_user)):
    user = await db.users.find_one({"id": current_user["id"]}, {"_id": 0})
    
    if not user.get("pending_totp_secret"):
        raise HTTPException(status_code=400, detail="No pending 2FA setup")
    
    totp = pyotp.TOTP(user["pending_totp_secret"])
    if not totp.verify(totp_code):
        raise HTTPException(status_code=400, detail="Invalid verification code")
    
    await db.users.update_one(
        {"id": current_user["id"]},
        {
            "$set": {
                "has_2fa": True,
                "totp_secret": user["pending_totp_secret"],
                "backup_codes": user["pending_backup_codes"]
            },
            "$unset": {
                "pending_totp_secret": "",
                "pending_backup_codes": ""
            }
        }
    )
    
    return {"message": "2FA enabled successfully"}

@api_router.post("/auth/2fa/disable")
async def disable_2fa(
    totp_code: str = Body(..., embed=True),
    current_user: dict = Depends(get_current_user)
):
    user = await db.users.find_one({"id": current_user["id"]}, {"_id": 0})
    
    if not user.get("has_2fa"):
        raise HTTPException(status_code=400, detail="2FA not enabled")
    
    totp = pyotp.TOTP(user["totp_secret"])
    if not totp.verify(totp_code):
        raise HTTPException(status_code=400, detail="Invalid verification code")
    
    await db.users.update_one(
        {"id": current_user["id"]},
        {"$set": {
            "has_2fa": False,
            "totp_secret": None,
            "backup_codes": []
        }}
    )
    
    return {"message": "2FA disabled successfully"}

# ==================== SUPER ADMIN ROUTES ====================
@api_router.post("/super-admin/init")
async def initialize_super_admin():
    """Initialize SUPER_ADMIN account - can only be done once"""
    existing = await db.users.find_one({"role": UserRole.SUPER_ADMIN})
    if existing:
        raise HTTPException(status_code=400, detail="Super admin already exists")
    
    # Generate secure credentials
    admin_password = secrets.token_urlsafe(16)
    user_id = str(uuid.uuid4())
    totp_secret = pyotp.random_base32()
    backup_codes = generate_backup_codes()
    
    user_doc = {
        "id": user_id,
        "email": "superadmin@prive.internal",
        "username": "SUPER_ADMIN",
        "display_name": "Super Administrator",
        "password": hash_password(admin_password),
        "role": UserRole.SUPER_ADMIN,
        "verification_status": VerificationStatus.VERIFIED,
        "has_2fa": True,
        "totp_secret": totp_secret,
        "backup_codes": backup_codes,
        "referral_code": generate_referral_code(),
        "total_referrals": 0,
        "referral_earnings": 0.0,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "bio": "Platform Super Administrator",
        "avatar_url": None
    }
    
    await db.users.insert_one(user_doc)
    
    # Generate QR code for 2FA
    totp = pyotp.TOTP(totp_secret)
    provisioning_uri = totp.provisioning_uri(
        name="superadmin@prive.internal",
        issuer_name="PRIVÉ Admin"
    )
    
    return {
        "message": "Super Admin account created",
        "credentials": {
            "email": "superadmin@prive.internal",
            "password": admin_password,
            "totp_secret": totp_secret,
            "totp_uri": provisioning_uri,
            "backup_codes": backup_codes
        },
        "warning": "SAVE THESE CREDENTIALS SECURELY. They cannot be recovered."
    }

@api_router.get("/super-admin/config")
async def get_system_config(current_user: dict = Depends(require_super_admin)):
    """Get current system configuration"""
    config = await SystemConfig.get_config()
    # Mask sensitive keys
    masked_config = json.loads(json.dumps(config))
    
    for section in ["storage", "payment", "kyc"]:
        if section in masked_config:
            for key in masked_config[section]:
                if any(k in key.lower() for k in ["key", "secret", "password"]):
                    if masked_config[section][key]:
                        masked_config[section][key] = "***" + masked_config[section][key][-4:] if len(masked_config[section][key]) > 4 else "****"
    
    return masked_config

@api_router.put("/super-admin/config")
async def update_system_config(
    updates: SystemConfigUpdate,
    current_user: dict = Depends(require_super_admin)
):
    """Update system configuration"""
    update_dict = {}
    
    if updates.storage:
        for key, value in updates.storage.items():
            update_dict[f"storage.{key}"] = value
    
    if updates.payment:
        for key, value in updates.payment.items():
            update_dict[f"payment.{key}"] = value
    
    if updates.kyc:
        for key, value in updates.kyc.items():
            update_dict[f"kyc.{key}"] = value
    
    if updates.encryption:
        for key, value in updates.encryption.items():
            update_dict[f"encryption.{key}"] = value
    
    if updates.referral:
        for key, value in updates.referral.items():
            update_dict[f"referral.{key}"] = value
    
    if update_dict:
        await SystemConfig.update_config(update_dict)
        SystemConfig.invalidate_cache()
    
    # Log config change
    await db.audit_logs.insert_one({
        "id": str(uuid.uuid4()),
        "action": "config_update",
        "user_id": current_user["id"],
        "changes": list(update_dict.keys()),
        "timestamp": datetime.now(timezone.utc).isoformat()
    })
    
    return {"message": "Configuration updated successfully"}

@api_router.get("/super-admin/users")
async def list_all_users(
    skip: int = 0,
    limit: int = 50,
    role: Optional[str] = None,
    current_user: dict = Depends(require_super_admin)
):
    """List all users with full details"""
    query = {}
    if role:
        query["role"] = role
    
    users = await db.users.find(query, {"_id": 0, "password": 0, "totp_secret": 0}).skip(skip).limit(limit).to_list(limit)
    total = await db.users.count_documents(query)
    
    return {"users": users, "total": total}

@api_router.put("/super-admin/users/{user_id}")
async def update_user(
    user_id: str,
    updates: dict = Body(...),
    current_user: dict = Depends(require_super_admin)
):
    """Update any user's details"""
    # Prevent modifying another super admin
    target_user = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")
    
    if target_user.get("role") == UserRole.SUPER_ADMIN and user_id != current_user["id"]:
        raise HTTPException(status_code=403, detail="Cannot modify another super admin")
    
    # Sanitize updates
    allowed_fields = ["display_name", "bio", "role", "verification_status", "has_2fa"]
    sanitized = {k: v for k, v in updates.items() if k in allowed_fields}
    
    if sanitized:
        await db.users.update_one({"id": user_id}, {"$set": sanitized})
    
    return {"message": "User updated"}

@api_router.delete("/super-admin/users/{user_id}")
async def delete_user(user_id: str, current_user: dict = Depends(require_super_admin)):
    """Delete a user"""
    target_user = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")
    
    if target_user.get("role") == UserRole.SUPER_ADMIN:
        raise HTTPException(status_code=403, detail="Cannot delete super admin")
    
    await db.users.delete_one({"id": user_id})
    await db.creators.delete_one({"user_id": user_id})
    
    return {"message": "User deleted"}

@api_router.get("/super-admin/creators")
async def list_all_creators(
    skip: int = 0,
    limit: int = 50,
    current_user: dict = Depends(require_super_admin)
):
    """List all creators with payout info"""
    creators = await db.creators.find({}, {"_id": 0}).skip(skip).limit(limit).to_list(limit)
    return {"creators": creators}

@api_router.put("/super-admin/creators/{creator_id}/tier")
async def update_creator_tier(
    creator_id: str,
    tier: CreatorTier = Body(..., embed=True),
    current_user: dict = Depends(require_super_admin)
):
    """Update creator tier"""
    await db.creators.update_one({"id": creator_id}, {"$set": {"tier": tier}})
    return {"message": f"Creator tier updated to {tier}"}

@api_router.post("/super-admin/creators/{creator_id}/payout")
async def trigger_creator_payout(
    creator_id: str,
    amount: float = Body(..., embed=True),
    current_user: dict = Depends(require_super_admin)
):
    """Manually trigger a payout to creator"""
    creator = await db.creators.find_one({"id": creator_id}, {"_id": 0})
    if not creator:
        raise HTTPException(status_code=404, detail="Creator not found")
    
    if not creator.get("stripe_connect_id"):
        raise HTTPException(status_code=400, detail="Creator has no Stripe Connect account")
    
    if amount > creator.get("pending_payout", 0):
        raise HTTPException(status_code=400, detail="Insufficient pending payout balance")
    
    result = await StripeService.create_payout(creator["stripe_connect_id"], amount)
    
    if result["status"] == "success":
        await db.creators.update_one(
            {"id": creator_id},
            {"$inc": {"pending_payout": -amount}}
        )
        
        await db.payouts.insert_one({
            "id": str(uuid.uuid4()),
            "creator_id": creator_id,
            "amount": amount,
            "transfer_id": result["transfer_id"],
            "status": "completed",
            "created_at": datetime.now(timezone.utc).isoformat()
        })
    
    return result

@api_router.get("/super-admin/verifications")
async def list_all_verifications(
    status: Optional[str] = None,
    skip: int = 0,
    limit: int = 50,
    current_user: dict = Depends(require_super_admin)
):
    """List all verification requests"""
    query = {}
    if status:
        query["status"] = status
    
    verifications = await db.verifications.find(query, {"_id": 0}).sort("submitted_at", -1).skip(skip).limit(limit).to_list(limit)
    
    # Attach user info
    for v in verifications:
        user = await db.users.find_one({"id": v["user_id"]}, {"_id": 0, "password": 0})
        v["user"] = user
    
    return {"verifications": verifications}

@api_router.put("/super-admin/verifications/{verification_id}")
async def update_verification_status(
    verification_id: str,
    status: VerificationStatus = Body(..., embed=True),
    notes: str = Body("", embed=True),
    current_user: dict = Depends(require_super_admin)
):
    """Update verification status"""
    verification = await db.verifications.find_one({"id": verification_id}, {"_id": 0})
    if not verification:
        raise HTTPException(status_code=404, detail="Verification not found")
    
    await db.verifications.update_one(
        {"id": verification_id},
        {"$set": {
            "status": status,
            "reviewer_notes": notes,
            "reviewed_at": datetime.now(timezone.utc).isoformat(),
            "reviewed_by": current_user["id"]
        }}
    )
    
    await db.users.update_one(
        {"id": verification["user_id"]},
        {"$set": {"verification_status": status}}
    )
    
    if status == VerificationStatus.VERIFIED:
        await db.creators.update_one(
            {"user_id": verification["user_id"]},
            {"$set": {"verification_status": status, "tier": CreatorTier.VERIFIED}}
        )
    
    return {"message": "Verification updated"}

@api_router.get("/super-admin/analytics")
async def get_platform_analytics(current_user: dict = Depends(require_super_admin)):
    """Get comprehensive platform analytics"""
    total_users = await db.users.count_documents({})
    total_creators = await db.creators.count_documents({})
    verified_users = await db.users.count_documents({"verification_status": VerificationStatus.VERIFIED})
    pending_verifications = await db.verifications.count_documents({"status": VerificationStatus.PENDING})
    active_subscriptions = await db.subscriptions.count_documents({"status": "active"})
    
    # Revenue stats
    pipeline = [
        {"$match": {"status": PaymentStatus.PAID}},
        {"$group": {
            "_id": None,
            "total_revenue": {"$sum": "$amount"},
            "platform_fees": {"$sum": "$platform_fee"},
            "creator_earnings": {"$sum": "$creator_earnings"}
        }}
    ]
    revenue_stats = await db.payment_transactions.aggregate(pipeline).to_list(1)
    revenue = revenue_stats[0] if revenue_stats else {"total_revenue": 0, "platform_fees": 0, "creator_earnings": 0}
    
    # Referral stats
    total_referrals = await db.referrals.count_documents({})
    referral_earnings = await db.referrals.aggregate([
        {"$group": {"_id": None, "total": {"$sum": "$total_bonus_earned"}}}
    ]).to_list(1)
    
    return {
        "users": {
            "total": total_users,
            "creators": total_creators,
            "verified": verified_users,
            "pending_verification": pending_verifications
        },
        "subscriptions": {
            "active": active_subscriptions
        },
        "revenue": {
            "total": revenue.get("total_revenue", 0),
            "platform_fees": revenue.get("platform_fees", 0),
            "creator_earnings": revenue.get("creator_earnings", 0)
        },
        "referrals": {
            "total": total_referrals,
            "bonus_paid": referral_earnings[0]["total"] if referral_earnings else 0
        }
    }

@api_router.get("/super-admin/audit-logs")
async def get_audit_logs(
    skip: int = 0,
    limit: int = 100,
    current_user: dict = Depends(require_super_admin)
):
    """Get audit logs"""
    logs = await db.audit_logs.find({}, {"_id": 0}).sort("timestamp", -1).skip(skip).limit(limit).to_list(limit)
    return {"logs": logs}

# ==================== KYC ROUTES ====================
@api_router.post("/verification/submit")
async def submit_verification(data: KYCSubmission, current_user: dict = Depends(get_current_user)):
    result = await KYCService.submit_verification(current_user["id"], data)
    return result

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

# ==================== STRIPE CONNECT ROUTES ====================
@api_router.post("/creator/stripe-connect/setup")
async def setup_stripe_connect(current_user: dict = Depends(get_current_user)):
    """Initialize Stripe Connect account for creator"""
    if current_user["role"] != UserRole.CREATOR:
        raise HTTPException(status_code=403, detail="Only creators can setup payouts")
    
    creator = await db.creators.find_one({"user_id": current_user["id"]}, {"_id": 0})
    if not creator:
        raise HTTPException(status_code=404, detail="Creator profile not found")
    
    if creator.get("stripe_connect_id"):
        return {"account_id": creator["stripe_connect_id"], "status": "exists"}
    
    result = await StripeService.create_connect_account(current_user["id"], current_user["email"])
    
    if result["account_id"]:
        await db.creators.update_one(
            {"user_id": current_user["id"]},
            {"$set": {"stripe_connect_id": result["account_id"]}}
        )
    
    return result

@api_router.post("/creator/stripe-connect/onboard")
async def get_onboarding_link(data: StripeConnectOnboard, current_user: dict = Depends(get_current_user)):
    """Get Stripe Connect onboarding link"""
    creator = await db.creators.find_one({"user_id": current_user["id"]}, {"_id": 0})
    if not creator or not creator.get("stripe_connect_id"):
        raise HTTPException(status_code=400, detail="Setup Stripe Connect first")
    
    url = await StripeService.create_onboarding_link(
        creator["stripe_connect_id"],
        data.return_url,
        data.refresh_url
    )
    
    return {"onboarding_url": url}

@api_router.get("/creator/stripe-connect/status")
async def get_connect_status(current_user: dict = Depends(get_current_user)):
    """Check Stripe Connect account status"""
    creator = await db.creators.find_one({"user_id": current_user["id"]}, {"_id": 0})
    if not creator or not creator.get("stripe_connect_id"):
        return {"connected": False, "payouts_enabled": False}
    
    status = await StripeService.check_account_status(creator["stripe_connect_id"])
    
    # Update payout status
    if status.get("payouts_enabled"):
        await db.creators.update_one(
            {"user_id": current_user["id"]},
            {"$set": {"payout_enabled": True}}
        )
    
    return {
        "connected": True,
        "account_id": creator["stripe_connect_id"],
        **status
    }

@api_router.post("/creator/payout/request")
async def request_payout(data: PayoutRequest, current_user: dict = Depends(get_current_user)):
    """Request payout to Stripe Connect account"""
    creator = await db.creators.find_one({"user_id": current_user["id"]}, {"_id": 0})
    if not creator:
        raise HTTPException(status_code=404, detail="Creator not found")
    
    if not creator.get("stripe_connect_id") or not creator.get("payout_enabled"):
        raise HTTPException(status_code=400, detail="Payouts not enabled")
    
    if data.amount > creator.get("pending_payout", 0):
        raise HTTPException(status_code=400, detail="Insufficient balance")
    
    if data.amount < 10:
        raise HTTPException(status_code=400, detail="Minimum payout is $10")
    
    result = await StripeService.create_payout(creator["stripe_connect_id"], data.amount)
    
    if result["status"] == "success":
        await db.creators.update_one(
            {"id": creator["id"]},
            {"$inc": {"pending_payout": -data.amount}}
        )
        
        await db.payouts.insert_one({
            "id": str(uuid.uuid4()),
            "creator_id": creator["id"],
            "amount": data.amount,
            "transfer_id": result["transfer_id"],
            "status": "completed",
            "created_at": datetime.now(timezone.utc).isoformat()
        })
    
    return result

# ==================== E2EE ROUTES ====================
@api_router.post("/encryption/keys/generate")
async def generate_encryption_keys(current_user: dict = Depends(get_current_user)):
    """Generate and store encryption keys for E2EE"""
    identity_keys = await E2EEService.generate_identity_keys()
    signed_prekey = await E2EEService.generate_identity_keys()
    prekeys = await E2EEService.generate_prekeys(100)
    
    await E2EEService.store_user_keys(
        current_user["id"],
        identity_keys["public_key"],
        signed_prekey["public_key"],
        prekeys
    )
    
    return {
        "identity_key": identity_keys["public_key"],
        "signed_prekey": signed_prekey["public_key"],
        "prekey_count": len(prekeys),
        "private_identity_key": identity_keys["private_key"],  # Client stores this
        "private_signed_prekey": signed_prekey["private_key"]
    }

@api_router.get("/encryption/keys/{user_id}")
async def get_user_prekey_bundle(user_id: str, current_user: dict = Depends(get_current_user)):
    """Get another user's prekey bundle for initiating encrypted session"""
    bundle = await E2EEService.get_user_prekey_bundle(user_id)
    if not bundle:
        raise HTTPException(status_code=404, detail="User has no encryption keys")
    return bundle

@api_router.post("/encryption/session/init")
async def initialize_encrypted_session(
    data: EncryptionKeyExchange,
    current_user: dict = Depends(get_current_user)
):
    """Initialize an encrypted session with another user"""
    session_id = str(uuid.uuid4())
    
    await db.encryption_sessions.insert_one({
        "id": session_id,
        "initiator_id": current_user["id"],
        "recipient_id": data.recipient_id,
        "initiator_public_key": data.public_key,
        "status": "pending",
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    return {"session_id": session_id, "status": "pending"}

# ==================== MESSAGING ROUTES (E2EE) ====================
@api_router.post("/messages")
async def send_message(data: MessageCreate, current_user: dict = Depends(get_current_user)):
    if current_user.get("verification_status") != VerificationStatus.VERIFIED:
        raise HTTPException(status_code=403, detail="Verification required for messaging")
    
    config = await SystemConfig.get_config()
    
    message_doc = {
        "id": str(uuid.uuid4()),
        "sender_id": current_user["id"],
        "recipient_id": data.recipient_id,
        "content": data.encrypted_content or data.content,
        "is_encrypted": bool(data.encrypted_content),
        "encryption_metadata": data.encryption_metadata,
        "is_read": False,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.messages.insert_one(message_doc)
    
    return {
        "id": message_doc["id"],
        "sender_id": message_doc["sender_id"],
        "recipient_id": message_doc["recipient_id"],
        "is_encrypted": message_doc["is_encrypted"],
        "created_at": message_doc["created_at"]
    }

@api_router.get("/messages/conversations")
async def get_conversations(current_user: dict = Depends(get_current_user)):
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
                        1, 0
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
                    "content": "[Encrypted]" if conv["last_message"].get("is_encrypted") else conv["last_message"]["content"][:50],
                    "created_at": conv["last_message"]["created_at"],
                    "is_encrypted": conv["last_message"].get("is_encrypted", False)
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
        {"_id": 0}
    ).sort("created_at", -1).limit(limit).to_list(limit)
    
    await db.messages.update_many(
        {"sender_id": partner_id, "recipient_id": current_user["id"], "is_read": False},
        {"$set": {"is_read": True}}
    )
    
    return messages[::-1]

# ==================== REFERRAL ROUTES ====================
@api_router.get("/referral/stats")
async def get_referral_stats(current_user: dict = Depends(get_current_user)):
    """Get user's referral statistics"""
    referrals = await db.referrals.find(
        {"referrer_id": current_user["id"]},
        {"_id": 0}
    ).to_list(1000)
    
    config = await SystemConfig.get_config()
    tier_bonuses = config["referral"]["tiered_bonuses"]
    
    # Determine current tier
    total_referrals = len(referrals)
    current_tier = "bronze"
    next_tier = None
    referrals_to_next = 0
    
    sorted_tiers = sorted(tier_bonuses.items(), key=lambda x: x[1]["min_referrals"])
    for i, (tier_name, tier_config) in enumerate(sorted_tiers):
        if total_referrals >= tier_config["min_referrals"]:
            current_tier = tier_name
            if i < len(sorted_tiers) - 1:
                next_tier = sorted_tiers[i + 1][0]
                referrals_to_next = sorted_tiers[i + 1][1]["min_referrals"] - total_referrals
    
    total_earnings = sum(r.get("total_bonus_earned", 0) for r in referrals)
    active_referrals = len([r for r in referrals if r.get("expires_at", "") > datetime.now(timezone.utc).isoformat()])
    
    return {
        "referral_code": current_user.get("referral_code"),
        "total_referrals": total_referrals,
        "active_referrals": active_referrals,
        "total_earnings": total_earnings,
        "current_tier": current_tier,
        "current_bonus_percent": tier_bonuses[current_tier]["bonus_percent"],
        "next_tier": next_tier,
        "referrals_to_next_tier": max(0, referrals_to_next),
        "tier_bonuses": tier_bonuses
    }

@api_router.get("/referral/list")
async def list_referrals(current_user: dict = Depends(get_current_user)):
    """List all referrals made by user"""
    referrals = await db.referrals.find(
        {"referrer_id": current_user["id"]},
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    
    # Get referred user info
    for r in referrals:
        user = await db.users.find_one({"id": r["referred_id"]}, {"_id": 0, "password": 0})
        if user:
            r["referred_user"] = {
                "username": user.get("username"),
                "display_name": user.get("display_name"),
                "role": user.get("role")
            }
    
    return referrals

# ==================== CREATOR ROUTES ====================
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
        creator = await db.creators.find_one({"user_id": creator_id}, {"_id": 0})
    if not creator:
        raise HTTPException(status_code=404, detail="Creator not found")
    return CreatorProfile(**creator)

@api_router.put("/creators/profile")
async def update_creator_profile(
    display_name: Optional[str] = Body(None),
    bio: Optional[str] = Body(None),
    subscription_price: Optional[float] = Body(None),
    call_rate_per_minute: Optional[float] = Body(None),
    message_price: Optional[float] = Body(None),
    current_user: dict = Depends(get_current_user)
):
    if current_user["role"] not in [UserRole.CREATOR, "creator"]:
        raise HTTPException(status_code=403, detail="Not a creator")
    
    update_data = {}
    if display_name is not None:
        update_data["display_name"] = display_name
    if bio is not None:
        update_data["bio"] = bio
    if subscription_price is not None:
        update_data["subscription_price"] = subscription_price
    if call_rate_per_minute is not None:
        update_data["call_rate_per_minute"] = call_rate_per_minute
    if message_price is not None:
        update_data["message_price"] = message_price
    
    if update_data:
        await db.creators.update_one({"user_id": current_user["id"]}, {"$set": update_data})
    
    creator = await db.creators.find_one({"user_id": current_user["id"]}, {"_id": 0})
    if not creator:
        raise HTTPException(status_code=404, detail="Creator profile not found")
    return creator

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

# ==================== CONTENT ROUTES ====================
@api_router.post("/content")
async def create_content(
    title: str = Body(...),
    description: Optional[str] = Body(None),
    content_type: ContentType = Body(ContentType.SUBSCRIPTION),
    price: Optional[float] = Body(None),
    media_urls: List[str] = Body([]),
    current_user: dict = Depends(get_current_user)
):
    if current_user["role"] not in [UserRole.CREATOR, "creator"]:
        raise HTTPException(status_code=403, detail="Only creators can post content")
    
    creator = await db.creators.find_one({"user_id": current_user["id"]}, {"_id": 0})
    if not creator:
        raise HTTPException(status_code=404, detail="Creator profile not found")
    
    content_type_value = content_type.value if hasattr(content_type, 'value') else content_type
    
    content_doc = {
        "id": str(uuid.uuid4()),
        "creator_id": creator["id"],
        "title": title,
        "description": description,
        "content_type": content_type_value,
        "price": price if content_type_value == "ppv" else None,
        "media_urls": media_urls,
        "thumbnail_url": media_urls[0] if media_urls else None,
        "is_pinned": False,
        "likes_count": 0,
        "comments_count": 0,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.content.insert_one(content_doc)
    
    # Return without _id
    content_doc.pop("_id", None)
    return content_doc

@api_router.get("/content/feed")
async def get_feed(limit: int = 20, skip: int = 0, current_user: dict = Depends(get_current_user)):
    subscriptions = await db.subscriptions.find(
        {"user_id": current_user["id"], "status": "active"},
        {"_id": 0, "creator_id": 1}
    ).to_list(1000)
    
    subscribed_creator_ids = [s["creator_id"] for s in subscriptions]
    
    content = await db.content.find(
        {"creator_id": {"$in": subscribed_creator_ids}},
        {"_id": 0}
    ).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    
    unlocked = await db.unlocks.find(
        {"user_id": current_user["id"]},
        {"_id": 0, "content_id": 1}
    ).to_list(1000)
    unlocked_ids = [u["content_id"] for u in unlocked]
    
    for c in content:
        c["is_unlocked"] = (
            c["content_type"] == ContentType.FREE or
            c["content_type"] == ContentType.SUBSCRIPTION or
            c["id"] in unlocked_ids
        )
    
    return content

@api_router.get("/content/creator/{creator_id}")
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
    
    for c in content:
        c["is_unlocked"] = (
            c["content_type"] == ContentType.FREE or
            (c["content_type"] == ContentType.SUBSCRIPTION and is_subscribed) or
            c["id"] in unlocked_ids
        )
    
    return content

# ==================== PAYMENT ROUTES ====================
@api_router.post("/payments/checkout")
async def create_checkout(
    payment_type: PaymentType = Body(...),
    creator_id: Optional[str] = Body(None),
    content_id: Optional[str] = Body(None),
    amount: Optional[float] = Body(None),
    origin_url: str = Body(...),
    current_user: dict = Depends(get_current_user)
):
    from emergentintegrations.payments.stripe.checkout import (
        StripeCheckout, CheckoutSessionRequest
    )
    
    if current_user.get("verification_status") != VerificationStatus.VERIFIED:
        raise HTTPException(status_code=403, detail="Verification required for payments")
    
    config = await SystemConfig.get_config()
    api_key = config["payment"]["stripe_test_key"] if config["payment"]["provider"] == "stripe_test" else config["payment"]["stripe_live_key"]
    
    checkout_amount = 0.0
    metadata = {
        "user_id": current_user["id"],
        "payment_type": payment_type,
        "creator_id": creator_id or "",
        "content_id": content_id or ""
    }
    
    if payment_type == PaymentType.SUBSCRIPTION:
        creator = await db.creators.find_one({"id": creator_id}, {"_id": 0})
        if not creator:
            raise HTTPException(status_code=404, detail="Creator not found")
        checkout_amount = creator["subscription_price"]
    elif payment_type == PaymentType.TIP:
        if not amount or amount < 1:
            raise HTTPException(status_code=400, detail="Invalid tip amount")
        checkout_amount = amount
    elif payment_type == PaymentType.PPV:
        content = await db.content.find_one({"id": content_id}, {"_id": 0})
        if not content:
            raise HTTPException(status_code=404, detail="Content not found")
        checkout_amount = content.get("price", 0)
    
    if checkout_amount <= 0:
        raise HTTPException(status_code=400, detail="Invalid amount")
    
    platform_fee = checkout_amount * (config["payment"]["platform_fee_percent"] / 100)
    creator_earnings = checkout_amount - platform_fee
    
    # Calculate referral bonus
    referral_bonus = 0.0
    if creator_id:
        referral_bonus = await ReferralService.calculate_referral_bonus(checkout_amount, creator_id)
    
    webhook_url = f"{origin_url}/api/webhook/stripe"
    stripe_checkout = StripeCheckout(api_key=api_key, webhook_url=webhook_url)
    
    success_url = f"{origin_url}/payment/success?session_id={{CHECKOUT_SESSION_ID}}"
    cancel_url = f"{origin_url}/payment/cancel"
    
    checkout_request = CheckoutSessionRequest(
        amount=float(checkout_amount),
        currency="usd",
        success_url=success_url,
        cancel_url=cancel_url,
        metadata=metadata
    )
    
    session = await stripe_checkout.create_checkout_session(checkout_request)
    
    transaction_doc = {
        "id": str(uuid.uuid4()),
        "session_id": session.session_id,
        "user_id": current_user["id"],
        "payment_type": payment_type,
        "creator_id": creator_id,
        "content_id": content_id,
        "amount": checkout_amount,
        "currency": "usd",
        "platform_fee": platform_fee,
        "creator_earnings": creator_earnings,
        "referral_bonus": referral_bonus,
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
    
    config = await SystemConfig.get_config()
    api_key = config["payment"]["stripe_test_key"] if config["payment"]["provider"] == "stripe_test" else config["payment"]["stripe_live_key"]
    
    webhook_url = "https://placeholder.com/webhook"
    stripe_checkout = StripeCheckout(api_key=api_key, webhook_url=webhook_url)
    
    checkout_status = await stripe_checkout.get_checkout_status(session_id)
    
    transaction = await db.payment_transactions.find_one({"session_id": session_id}, {"_id": 0})
    if transaction and transaction["status"] != PaymentStatus.PAID:
        new_status = PaymentStatus.PAID if checkout_status.payment_status == "paid" else transaction["status"]
        if checkout_status.status == "expired":
            new_status = PaymentStatus.EXPIRED
        
        if new_status == PaymentStatus.PAID and transaction["status"] != PaymentStatus.PAID:
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
    payment_type = transaction["payment_type"]
    user_id = transaction["user_id"]
    creator_id = transaction.get("creator_id")
    content_id = transaction.get("content_id")
    
    if payment_type == PaymentType.SUBSCRIPTION:
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
        unlock_doc = {
            "id": str(uuid.uuid4()),
            "user_id": user_id,
            "content_id": content_id,
            "transaction_id": transaction["id"],
            "unlocked_at": datetime.now(timezone.utc).isoformat()
        }
        await db.unlocks.insert_one(unlock_doc)
    
    if creator_id:
        await db.creators.update_one(
            {"id": creator_id},
            {"$inc": {
                "total_earnings": transaction["creator_earnings"],
                "pending_payout": transaction["creator_earnings"]
            }}
        )

@api_router.post("/webhook/stripe")
async def stripe_webhook(request: Request):
    from emergentintegrations.payments.stripe.checkout import StripeCheckout
    
    config = await SystemConfig.get_config()
    api_key = config["payment"]["stripe_test_key"]
    
    body = await request.body()
    signature = request.headers.get("Stripe-Signature", "")
    
    webhook_url = f"{str(request.base_url)}api/webhook/stripe"
    stripe_checkout = StripeCheckout(api_key=api_key, webhook_url=webhook_url)
    
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

# ==================== EARNINGS ROUTES ====================
@api_router.get("/earnings")
async def get_earnings(current_user: dict = Depends(get_current_user)):
    if current_user["role"] != UserRole.CREATOR:
        raise HTTPException(status_code=403, detail="Not a creator")
    
    creator = await db.creators.find_one({"user_id": current_user["id"]}, {"_id": 0})
    if not creator:
        raise HTTPException(status_code=404, detail="Creator profile not found")
    
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
    
    payouts = await db.payouts.find(
        {"creator_id": creator["id"]},
        {"_id": 0}
    ).sort("created_at", -1).limit(10).to_list(10)
    
    return {
        "total_earnings": creator["total_earnings"],
        "pending_payout": creator.get("pending_payout", 0),
        "total_subscribers": creator["total_subscribers"],
        "earnings_by_type": earnings_by_type,
        "monthly_earnings": monthly[::-1],
        "recent_payouts": payouts,
        "payout_enabled": creator.get("payout_enabled", False),
        "stripe_connected": bool(creator.get("stripe_connect_id"))
    }

# ==================== SUBSCRIPTIONS ====================
@api_router.get("/subscriptions")
async def get_subscriptions(current_user: dict = Depends(get_current_user)):
    subscriptions = await db.subscriptions.find(
        {"user_id": current_user["id"], "status": "active"},
        {"_id": 0}
    ).to_list(100)
    
    result = []
    for sub in subscriptions:
        creator = await db.creators.find_one({"id": sub["creator_id"]}, {"_id": 0})
        if creator:
            result.append({**sub, "creator": creator})
    
    return result

# ==================== ADMIN ROUTES ====================
@api_router.get("/admin/verifications")
async def admin_list_verifications(status: Optional[str] = None, current_user: dict = Depends(require_admin)):
    query = {}
    if status:
        query["status"] = status
    
    verifications = await db.verifications.find(query, {"_id": 0}).sort("submitted_at", -1).to_list(100)
    
    for v in verifications:
        user = await db.users.find_one({"id": v["user_id"]}, {"_id": 0, "password": 0})
        v["user"] = user
    
    return verifications

@api_router.post("/admin/verifications/{verification_id}/approve")
async def admin_approve_verification(verification_id: str, current_user: dict = Depends(require_admin)):
    verification = await db.verifications.find_one({"id": verification_id}, {"_id": 0})
    if not verification:
        raise HTTPException(status_code=404, detail="Verification not found")
    
    await db.verifications.update_one(
        {"id": verification_id},
        {"$set": {
            "status": VerificationStatus.VERIFIED,
            "reviewed_at": datetime.now(timezone.utc).isoformat(),
            "reviewed_by": current_user["id"]
        }}
    )
    
    await db.users.update_one(
        {"id": verification["user_id"]},
        {"$set": {"verification_status": VerificationStatus.VERIFIED}}
    )
    
    await db.creators.update_one(
        {"user_id": verification["user_id"]},
        {"$set": {"verification_status": VerificationStatus.VERIFIED, "tier": CreatorTier.VERIFIED}}
    )
    
    return {"message": "Verification approved"}

@api_router.post("/admin/verifications/{verification_id}/reject")
async def admin_reject_verification(verification_id: str, reason: str = "", current_user: dict = Depends(require_admin)):
    verification = await db.verifications.find_one({"id": verification_id}, {"_id": 0})
    if not verification:
        raise HTTPException(status_code=404, detail="Verification not found")
    
    await db.verifications.update_one(
        {"id": verification_id},
        {"$set": {
            "status": VerificationStatus.REJECTED,
            "reviewed_at": datetime.now(timezone.utc).isoformat(),
            "reviewed_by": current_user["id"],
            "reviewer_notes": reason
        }}
    )
    
    await db.users.update_one(
        {"id": verification["user_id"]},
        {"$set": {"verification_status": VerificationStatus.REJECTED}}
    )
    
    return {"message": "Verification rejected"}

@api_router.get("/admin/analytics")
async def admin_get_analytics(current_user: dict = Depends(require_admin)):
    total_users = await db.users.count_documents({})
    total_creators = await db.creators.count_documents({})
    verified_users = await db.users.count_documents({"verification_status": VerificationStatus.VERIFIED})
    pending_verifications = await db.verifications.count_documents({"status": VerificationStatus.PENDING})
    
    pipeline = [
        {"$match": {"status": PaymentStatus.PAID}},
        {"$group": {
            "_id": None,
            "total_revenue": {"$sum": "$amount"},
            "platform_fees": {"$sum": "$platform_fee"}
        }}
    ]
    revenue_stats = await db.payment_transactions.aggregate(pipeline).to_list(1)
    revenue = revenue_stats[0] if revenue_stats else {"total_revenue": 0, "platform_fees": 0}
    
    return {
        "total_users": total_users,
        "total_creators": total_creators,
        "verified_users": verified_users,
        "pending_verifications": pending_verifications,
        "total_revenue": revenue.get("total_revenue", 0),
        "platform_earnings": revenue.get("platform_fees", 0),
        "active_subscriptions": await db.subscriptions.count_documents({"status": "active"})
    }

# ==================== MEDIA ROUTES ====================
@api_router.get("/media/{filename}")
async def serve_media(filename: str):
    file_path = ROOT_DIR / "uploads" / filename
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="File not found")
    return FileResponse(file_path)

@api_router.post("/media/upload")
async def upload_media(file: UploadFile = File(...), current_user: dict = Depends(get_current_user)):
    contents = await file.read()
    url = await StorageService.upload_file(contents, file.filename, file.content_type)
    return {"url": url}

# ==================== HEALTH CHECK ====================
@api_router.get("/")
async def root():
    return {"message": "PRIVÉ API v2.0.0", "status": "operational"}

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
