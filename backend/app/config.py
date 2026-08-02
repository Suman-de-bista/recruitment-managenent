from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "sqlite:///./data/recruitment.db"
    jwt_secret_key: str = "dev-secret-key-change-me"
    access_token_expire_minutes: int = 60
    cors_origins: str = "http://localhost:5173"
    cookie_secure: bool = False

    seed_admin_email: str = "admin@example.com"
    seed_admin_password: str = "admin@123"
    seed_reviewer_email: str = "reviewer@example.com"
    seed_reviewer_password: str = "reviewer@123"

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


settings = Settings()
