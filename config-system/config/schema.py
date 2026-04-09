"""
Configuration schema definitions using Pydantic models.
Provides type-safe configuration structure with automatic validation.
"""

from typing import Optional
from pydantic import BaseModel, Field, field_validator


class AppConfig(BaseModel):
    """Application-level configuration."""
    name: str = Field(default="MyApp", description="Application name")
    version: str = Field(default="1.0.0", description="Application version")
    debug: bool = Field(default=False, description="Enable debug mode")
    environment: str = Field(default="development", description="Runtime environment")


class DatabaseConfig(BaseModel):
    """Database connection configuration."""
    host: str = Field(default="localhost", description="Database host")
    port: int = Field(default=5432, ge=1, le=65535, description="Database port")
    name: str = Field(default="myapp_db", description="Database name")
    username: Optional[str] = Field(default=None, description="Database username")
    password: Optional[str] = Field(default=None, description="Database password")
    pool_size: int = Field(default=10, ge=1, description="Connection pool size")
    
    @field_validator('port')
    @classmethod
    def validate_port(cls, v: int) -> int:
        """Validate port is in valid range."""
        if not 1 <= v <= 65535:
            raise ValueError('Port must be between 1 and 65535')
        return v


class LoggingConfig(BaseModel):
    """Logging configuration."""
    level: str = Field(default="INFO", description="Log level")
    format: str = Field(default="json", description="Log format (json or text)")
    file: Optional[str] = Field(default=None, description="Log file path")
    max_bytes: int = Field(default=10485760, description="Max log file size in bytes (10MB)")
    backup_count: int = Field(default=5, description="Number of backup log files")
    
    @field_validator('level')
    @classmethod
    def validate_level(cls, v: str) -> str:
        """Validate log level is valid."""
        valid_levels = ['DEBUG', 'INFO', 'WARNING', 'ERROR', 'CRITICAL']
        v_upper = v.upper()
        if v_upper not in valid_levels:
            raise ValueError(f'Log level must be one of: {", ".join(valid_levels)}')
        return v_upper
    
    @field_validator('format')
    @classmethod
    def validate_format(cls, v: str) -> str:
        """Validate log format is valid."""
        valid_formats = ['json', 'text']
        v_lower = v.lower()
        if v_lower not in valid_formats:
            raise ValueError(f'Log format must be one of: {", ".join(valid_formats)}')
        return v_lower


class FeaturesConfig(BaseModel):
    """Feature flags configuration."""
    enable_caching: bool = Field(default=True, description="Enable caching")
    cache_ttl: int = Field(default=3600, ge=0, description="Cache TTL in seconds")
    enable_metrics: bool = Field(default=False, description="Enable metrics collection")
    enable_tracing: bool = Field(default=False, description="Enable distributed tracing")
    rate_limit: Optional[int] = Field(default=None, ge=1, description="API rate limit per minute")


class Config(BaseModel):
    """Root configuration model."""
    app: AppConfig = Field(default_factory=AppConfig)
    database: DatabaseConfig = Field(default_factory=DatabaseConfig)
    logging: LoggingConfig = Field(default_factory=LoggingConfig)
    features: FeaturesConfig = Field(default_factory=FeaturesConfig)
    
    class Config:
        """Pydantic configuration."""
        validate_assignment = True
        extra = 'forbid'  # Prevent extra fields

# Made with Bob
