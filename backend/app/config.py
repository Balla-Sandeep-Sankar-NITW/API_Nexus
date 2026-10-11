from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "sqlite:///./api_nexus_dev.db"
    jwt_secret_key: str = "dev-secret-key-do-not-use-in-production"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 60
    refresh_token_expire_days: int = 7
    cors_origins: str = "http://localhost:5173"

    # The frontend URL used to build links inside emails (verify-email,
    # reset-password). Point this at your deployed frontend in production.
    frontend_base_url: str = "http://localhost:5173"

    # SMTP is optional. If smtp_host is unset, the app runs in "dev mode":
    # emails are logged to the backend console instead of being sent, and
    # verification/reset tokens are returned directly in the API response
    # so the flow is still testable without a real mailbox. Once smtp_host
    # is set, real emails are sent and tokens are NEVER included in API
    # responses (returning a reset token over the API once it's actually
    # been emailed would let anyone reset anyone's password without
    # owning their inbox).
    smtp_host: str | None = None
    smtp_port: int = 587
    smtp_username: str | None = None
    smtp_password: str | None = None
    smtp_from_email: str = "noreply@api-nexus.local"
    smtp_use_tls: bool = True

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


settings = Settings()
