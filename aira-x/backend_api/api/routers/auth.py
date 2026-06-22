from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from datetime import timedelta
from jose import JWTError, jwt

from core.security import verify_password, get_password_hash, create_access_token
from core.config import settings
from db.database import get_db
from models.sql_models import User
from models.schemas import UserCreate, UserResponse, Token, TokenData
from core.logging import logger

router = APIRouter(prefix="/auth", tags=["auth"])
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="api/v1/auth/token")

from fastapi import Request

async def get_current_user(request: Request, db: AsyncSession = Depends(get_db)):
    auth_header = request.headers.get("Authorization")
    demo_role_header = request.headers.get("X-Demo-Role", "admin")
    
    if not auth_header or auth_header == "Bearer null" or auth_header == "Bearer":
        # Bypass authentication in demo mode
        logger.info(f"Demo mode active: Bypassing auth for role '{demo_role_header}'")
        # Match standard UserRole enum values (admin, analyst, citizen, enforcement)
        role_mapping = {
            "city administrator": "admin",
            "pollution control officer": "analyst",
            "enforcement officer": "enforcement",
            "urban planner": "analyst",
            "public health officer": "citizen"
        }
        mapped_role = role_mapping.get(demo_role_header.lower(), "admin")
        
        return User(
            id=9999,
            email=f"{mapped_role}@aira-x.gov.in",
            hashed_password="",
            role=mapped_role,
            is_active=True
        )
        
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        token = auth_header.replace("Bearer ", "")
        payload = jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])
        email: str = payload.get("sub")
        role: str = payload.get("role")
        if email is None:
            raise credentials_exception
        token_data = TokenData(email=email, role=role)
    except JWTError:
        raise credentials_exception
    
    result = await db.execute(select(User).filter(User.email == token_data.email))
    user = result.scalars().first()
    if user is None:
        raise credentials_exception
    return user

def require_role(allowed_roles: list):
    async def role_checker(current_user: User = Depends(get_current_user)):
        if current_user.role not in allowed_roles:
            raise HTTPException(status_code=403, detail="Not enough permissions")
        return current_user
    return role_checker

@router.post("/register", response_model=UserResponse)
async def register(user_in: UserCreate, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).filter(User.email == user_in.email))
    if result.scalars().first():
        raise HTTPException(status_code=400, detail="Email already registered")
    
    hashed_pw = get_password_hash(user_in.password)
    new_user = User(email=user_in.email, hashed_password=hashed_pw, role=user_in.role)
    db.add(new_user)
    await db.commit()
    await db.refresh(new_user)
    return new_user

@router.post("/token", response_model=Token)
async def login_for_access_token(form_data: OAuth2PasswordRequestForm = Depends(), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).filter(User.email == form_data.username))
    user = result.scalars().first()
    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Incorrect email or password")
    
    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.email, "role": user.role}, expires_delta=access_token_expires
    )
    return {"access_token": access_token, "token_type": "bearer"}
