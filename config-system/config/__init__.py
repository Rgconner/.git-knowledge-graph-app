"""
Configuration management package.
Provides YAML-based configuration with validation and environment support.
"""

from .config_manager import ConfigManager, ConfigurationError
from .schema import Config, AppConfig, DatabaseConfig, LoggingConfig, FeaturesConfig
from .defaults import DEFAULT_CONFIG

__all__ = [
    'ConfigManager',
    'ConfigurationError',
    'Config',
    'AppConfig',
    'DatabaseConfig',
    'LoggingConfig',
    'FeaturesConfig',
    'DEFAULT_CONFIG',
]

__version__ = '1.0.0'

# Made with Bob
