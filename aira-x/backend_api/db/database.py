import ssl
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

# asyncpg doesn't support the 'sslmode' query parameter. Parse and strip it.
parsed_url = urlparse(db_url)
query_params = dict(parse_qsl(parsed_url.query))
query_params.pop("sslmode", None)
new_query = urlencode(query_params)
parsed_url = parsed_url._replace(query=new_query)
db_url = urlunparse(parsed_url)

# Render's free PostgreSQL uses a self-signed SSL certificate.
# Create a permissive SSL context so asyncpg doesn't reject it.
_ssl_context = ssl.create_default_context()
_ssl_context.check_hostname = False
_ssl_context.verify_mode = ssl.CERT_NONE

engine = create_async_engine(
    db_url,
    echo=False,
    future=True,
    connect_args={"ssl": _ssl_context},
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
