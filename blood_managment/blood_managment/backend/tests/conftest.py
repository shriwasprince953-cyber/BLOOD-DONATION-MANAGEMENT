import os

# Tests never use a local .env or connect to the configured production database.
os.environ.update({
    "DATABASE_URL": "sqlite+aiosqlite:///:memory:",
    "SUPABASE_URL": "https://test-project.supabase.co",
    "SUPABASE_ANON_KEY": "test-public-key",
    "SUPABASE_SERVICE_ROLE_KEY": "test-service-key",
    "AUTO_CREATE_TABLES": "false",
    "ENVIRONMENT": "test",
    "CORS_ORIGINS": "http://localhost:5173,https://frontend.example",
})
