from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # "production" (default, safe) or "development". In development ONLY, when no email
    # provider is configured, verification/reset tokens are returned in API responses so the
    # flows can be tested without a mailbox. Never set this to development on a public server.
    app_env: str = "production"

    database_url: str = "sqlite:///./api_nexus_dev.db"
    jwt_secret_key: str = "dev-secret-key-do-not-use-in-production"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 60
    refresh_token_expire_days: int = 7
    cors_origins: str = "http://localhost:5173"

    # The frontend URL used to build links inside emails (verify-email,
    # reset-password). Point this at your deployed frontend in production.
    frontend_base_url: str = "http://localhost:5173"

    # --- Email over HTTPS (works on Render's free plan, which blocks SMTP ports) ---
    # Brevo free plan: 300 emails/day. Create an API key, verify a sender address.
    brevo_api_key: str | None = None
    email_from_address: str | None = None   # must be a sender verified in Brevo
    email_from_name: str = "API Nexus"

    # --- Sign in with GitHub (free) ---
    github_client_id: str | None = None
    github_client_secret: str | None = None
    # Public URL of THIS backend, e.g. https://your-api.onrender.com (used for the OAuth callback)
    backend_base_url: str | None = None

    # Auth rate limits (per client IP, in-memory per server process)
    login_max_failures: int = 6          # per email+IP within the window below
    login_window_minutes: int = 15

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

    # API Explorer ("Try it out"). Requests are sent from THIS server, so a user could
    # otherwise point them at services only the server can reach. By default calls to
    # private, loopback and internal addresses are refused. Set this to true only when the
    # APIs you test really live on a private network (for example everything runs locally
    # on your own machine). Link-local addresses such as the 169.254.169.254 cloud
    # metadata service stay blocked either way.
    tryit_allow_private_networks: bool = False
    tryit_timeout_seconds: float = 15.0          # per request; clients can ask for less, up to 30
    tryit_max_request_bytes: int = 1_000_000
    tryit_max_response_bytes: int = 2_000_000    # longer responses are cut off and flagged
    tryit_rate_per_minute: int = 60              # per user, per server process

    @property
    def is_dev(self) -> bool:
        return self.app_env.lower() == "development"

    @property
    def github_enabled(self) -> bool:
        return bool(self.github_client_id and self.github_client_secret)

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


settings = Settings()

if not settings.is_dev and (
    settings.jwt_secret_key == "dev-secret-key-do-not-use-in-production" or len(settings.jwt_secret_key) < 32
):
    raise RuntimeError(
        "JWT_SECRET_KEY is missing or too short. Set a random value of 32+ characters "
        "(openssl rand -hex 32), or set APP_ENV=development for local work."
    )
