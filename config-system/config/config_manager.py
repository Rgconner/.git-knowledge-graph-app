"""
Configuration Manager for loading, merging, and managing YAML configurations.
Supports environment-specific configs with validation and type safety.
"""

import os
import yaml
from pathlib import Path
from typing import Any, Optional, Dict
from copy import deepcopy

from .schema import Config
from .defaults import DEFAULT_CONFIG


class ConfigurationError(Exception):
    """Custom exception for configuration-related errors."""
    pass


class ConfigManager:
    """
    Manages application configuration with support for:
    - YAML file loading
    - Environment-specific configurations
    - Configuration merging (defaults -> base -> environment)
    - Schema validation using Pydantic
    - Dot notation access to nested values
    """
    
    def __init__(
        self,
        base_path: str = "configs",
        env: Optional[str] = None,
        auto_load: bool = True
    ):
        """
        Initialize the configuration manager.
        
        Args:
            base_path: Directory containing configuration files
            env: Environment name (dev, staging, prod). If None, reads from APP_ENV
            auto_load: Automatically load configuration on initialization
        """
        self.base_path = Path(base_path)
        self.env = env or os.environ.get('APP_ENV', 'development')
        self._config_data: Dict[str, Any] = {}
        self._config_model: Optional[Config] = None
        
        if auto_load:
            self.load()
    
    def load(self) -> None:
        """
        Load and merge configurations from multiple sources.
        Priority: environment-specific > base > defaults
        """
        # Start with defaults
        merged_config = deepcopy(DEFAULT_CONFIG)
        
        # Load base configuration
        base_config = self._load_yaml_file("config.yaml")
        if base_config:
            merged_config = self._deep_merge(merged_config, base_config)
        
        # Load environment-specific configuration
        env_config = self._load_yaml_file(f"config.{self.env}.yaml")
        if env_config:
            merged_config = self._deep_merge(merged_config, env_config)
        
        # Store raw config data
        self._config_data = merged_config
        
        # Validate and create Pydantic model
        try:
            self._config_model = Config(**merged_config)
        except Exception as e:
            raise ConfigurationError(f"Configuration validation failed: {str(e)}")
    
    def _load_yaml_file(self, filename: str) -> Optional[Dict[str, Any]]:
        """
        Load a YAML file from the base path.
        
        Args:
            filename: Name of the YAML file to load
            
        Returns:
            Dictionary containing the YAML data, or None if file doesn't exist
        """
        filepath = self.base_path / filename
        
        if not filepath.exists():
            return None
        
        try:
            with open(filepath, 'r', encoding='utf-8') as f:
                data = yaml.safe_load(f)
                return data if data else {}
        except yaml.YAMLError as e:
            raise ConfigurationError(f"Error parsing YAML file {filename}: {str(e)}")
        except Exception as e:
            raise ConfigurationError(f"Error reading file {filename}: {str(e)}")
    
    def _deep_merge(self, base: Dict[str, Any], override: Dict[str, Any]) -> Dict[str, Any]:
        """
        Deep merge two dictionaries, with override taking precedence.
        
        Args:
            base: Base dictionary
            override: Dictionary with values to override
            
        Returns:
            Merged dictionary
        """
        result = deepcopy(base)
        
        for key, value in override.items():
            if key in result and isinstance(result[key], dict) and isinstance(value, dict):
                result[key] = self._deep_merge(result[key], value)
            else:
                result[key] = deepcopy(value)
        
        return result
    
    def get(self, key: str, default: Any = None) -> Any:
        """
        Get a configuration value using dot notation.
        
        Args:
            key: Configuration key in dot notation (e.g., "database.host")
            default: Default value if key doesn't exist
            
        Returns:
            Configuration value or default
            
        Examples:
            >>> config.get("app.name")
            "MyApp"
            >>> config.get("database.port")
            5432
        """
        keys = key.split('.')
        value = self._config_data
        
        try:
            for k in keys:
                value = value[k]
            return value
        except (KeyError, TypeError):
            return default
    
    def set(self, key: str, value: Any) -> None:
        """
        Set a configuration value using dot notation.
        
        Args:
            key: Configuration key in dot notation
            value: Value to set
            
        Examples:
            >>> config.set("app.debug", True)
            >>> config.set("database.port", 5433)
        """
        keys = key.split('.')
        data = self._config_data
        
        # Navigate to the parent of the target key
        for k in keys[:-1]:
            if k not in data:
                data[k] = {}
            data = data[k]
        
        # Set the value
        data[keys[-1]] = value
        
        # Re-validate configuration
        try:
            self._config_model = Config(**self._config_data)
        except Exception as e:
            raise ConfigurationError(f"Configuration validation failed after set: {str(e)}")
    
    def save(self, filename: Optional[str] = None) -> None:
        """
        Save current configuration to a YAML file.
        
        Args:
            filename: Output filename. If None, saves to config.{env}.yaml
        """
        if filename is None:
            filename = f"config.{self.env}.yaml"
        
        filepath = self.base_path / filename
        
        # Ensure directory exists
        filepath.parent.mkdir(parents=True, exist_ok=True)
        
        try:
            with open(filepath, 'w', encoding='utf-8') as f:
                yaml.dump(
                    self._config_data,
                    f,
                    default_flow_style=False,
                    sort_keys=False,
                    allow_unicode=True
                )
        except Exception as e:
            raise ConfigurationError(f"Error writing configuration to {filename}: {str(e)}")
    
    def reload(self) -> None:
        """Reload configuration from disk."""
        self.load()
    
    def validate(self) -> bool:
        """
        Validate current configuration against schema.
        
        Returns:
            True if valid, raises ConfigurationError if invalid
        """
        try:
            Config(**self._config_data)
            return True
        except Exception as e:
            raise ConfigurationError(f"Configuration validation failed: {str(e)}")
    
    def to_dict(self) -> Dict[str, Any]:
        """
        Get configuration as a dictionary.
        
        Returns:
            Dictionary containing all configuration values
        """
        return deepcopy(self._config_data)
    
    def get_model(self) -> Config:
        """
        Get the Pydantic configuration model.
        
        Returns:
            Validated Config model instance
        """
        if self._config_model is None:
            raise ConfigurationError("Configuration not loaded")
        return self._config_model
    
    @property
    def app(self):
        """Quick access to app configuration."""
        return self.get_model().app
    
    @property
    def database(self):
        """Quick access to database configuration."""
        return self.get_model().database
    
    @property
    def logging(self):
        """Quick access to logging configuration."""
        return self.get_model().logging
    
    @property
    def features(self):
        """Quick access to features configuration."""
        return self.get_model().features

# Made with Bob
