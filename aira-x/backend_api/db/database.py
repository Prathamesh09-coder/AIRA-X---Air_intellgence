from urllib.parse import urlparse, urlunparse, parse_qsl, urlencode
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.orm import declarative_base
from core.config import settings

# Sanitize URL to ensure it uses the async driver (asyncpg)
db_url = settings.DATABASE_URL
if db_url.startswith("postgresql://"):
    db_url = db_url.replace("postgresql://", "postgresql+asyncpg://", 1)
elif db_url.startswith("postgres://"):
    db_url = db_url.replace("postgres://", "postgresql+asyncpg://", 1)

# asyncpg doesn't support the 'sslmode' query parameter. Parse and extract it.
parsed_url = urlparse(db_url)
query_params = dict(parse_qsl(parsed_url.query))
sslmode = query_params.pop("sslmode", None)

new_query = urlencode(query_params)
parsed_url = parsed_url._replace(query=new_query)
db_url = urlunparse(parsed_url)

connect_args = {}
if sslmode in ("require", "prefer", "allow", "verify-ca", "verify-full") or settings.ENVIRONMENT == "production":
    connect_args["ssl"] = True

engine = create_async_engine(
    db_url,
    echo=False,
    future=True,
    connect_args=connect_args
)

AsyncSessionLocal = async_sessionmaker(
    engine, 
    class_=AsyncSession, 
    expire_on_commit=False
)

Base = declarative_base()

async def get_db():
    async with AsyncSessionLocal() as session:
        yield session
