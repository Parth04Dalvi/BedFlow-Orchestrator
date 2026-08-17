from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    PROJECT_NAME: str = "BedFlow-Orchestrator"
    API_V1_STR: str = "/api/v1"
    DATABASE_URL: str = "postgresql+asyncpg://bedflow_user:bedflow_password@localhost:5432/bedflow_db"
    REDIS_URL: str = "redis://localhost:6379/0"

    class Config:
        case_sensitive = True

settings = Settings()
