"""
Default configuration values.
These serve as the base layer in the configuration hierarchy.
"""

DEFAULT_CONFIG = {
    "app": {
        "name": "MyApp",
        "version": "1.0.0",
        "debug": False,
        "environment": "development"
    },
    "database": {
        "host": "localhost",
        "port": 5432,
        "name": "myapp_db",
        "username": None,
        "password": None,
        "pool_size": 10
    },
    "logging": {
        "level": "INFO",
        "format": "json",
        "file": None,
        "max_bytes": 10485760,  # 10MB
        "backup_count": 5
    },
    "features": {
        "enable_caching": True,
        "cache_ttl": 3600,
        "enable_metrics": False,
        "enable_tracing": False,
        "rate_limit": None
    }
}

# Made with Bob
