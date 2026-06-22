from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    PROJECT_NAME: str = "AIRA-X"
    VERSION: str = "1.0.0"
    API_V1_STR: str = "/api/v1"
    
    # Environment
    ENVIRONMENT: str = "development"
    
    # Database
    DATABASE_URL: str
    
    # Redis
    REDIS_URL: str
    
    # Neo4j
    NEO4J_URI: str
    NEO4J_USER: str
    NEO4J_PASSWORD: str
    
    # MLflow
    MLFLOW_TRACKING_URI: str
    
    # Security
    JWT_SECRET_KEY: str
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    
    class Config:
        case_sensitive = True
        env_file = ".env"

settings = Settings()
