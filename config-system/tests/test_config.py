"""
Unit tests for the configuration management system.
Tests configuration loading, merging, validation, and error handling.
"""

import pytest
import os
import tempfile
import yaml
from pathlib import Path

import sys
sys.path.insert(0, str(Path(__file__).parent.parent))

from config import ConfigManager, ConfigurationError
from config.schema import Config


class TestConfigManager:
    """Test suite for ConfigManager class."""
    
    @pytest.fixture
    def temp_config_dir(self):
        """Create a temporary directory with test configuration files."""
        with tempfile.TemporaryDirectory() as tmpdir:
            config_dir = Path(tmpdir) / "configs"
            config_dir.mkdir()
            
            # Create base config
            base_config = {
                "app": {"name": "TestApp", "version": "1.0.0", "debug": False},
                "database": {"host": "localhost", "port": 5432, "name": "test_db"},
                "logging": {"level": "INFO", "format": "json"},
                "features": {"enable_caching": True, "cache_ttl": 3600}
            }
            with open(config_dir / "config.yaml", 'w') as f:
                yaml.dump(base_config, f)
            
            # Create dev config
            dev_config = {
                "app": {"debug": True},
                "database": {"name": "test_dev_db"},
                "logging": {"level": "DEBUG"}
            }
            with open(config_dir / "config.dev.yaml", 'w') as f:
                yaml.dump(dev_config, f)
            
            # Create prod config
            prod_config = {
                "app": {"debug": False},
                "database": {"host": "prod-db.example.com", "name": "test_prod_db"},
                "logging": {"level": "WARNING"}
            }
            with open(config_dir / "config.prod.yaml", 'w') as f:
                yaml.dump(prod_config, f)
            
            yield config_dir
    
    def test_basic_loading(self, temp_config_dir):
        """Test basic configuration loading."""
        config = ConfigManager(base_path=str(temp_config_dir), env="dev")
        
        assert config.get("app.name") == "TestApp"
        assert config.get("app.version") == "1.0.0"
        assert config.get("database.host") == "localhost"
    
    def test_environment_specific_loading(self, temp_config_dir):
        """Test environment-specific configuration loading."""
        # Test dev environment
        dev_config = ConfigManager(base_path=str(temp_config_dir), env="dev")
        assert dev_config.get("app.debug") is True
        assert dev_config.get("database.name") == "test_dev_db"
        assert dev_config.get("logging.level") == "DEBUG"
        
        # Test prod environment
        prod_config = ConfigManager(base_path=str(temp_config_dir), env="prod")
        assert prod_config.get("app.debug") is False
        assert prod_config.get("database.name") == "test_prod_db"
        assert prod_config.get("database.host") == "prod-db.example.com"
        assert prod_config.get("logging.level") == "WARNING"
    
    def test_configuration_merging(self, temp_config_dir):
        """Test that configurations are merged correctly."""
        config = ConfigManager(base_path=str(temp_config_dir), env="dev")
        
        # Values from base config
        assert config.get("app.name") == "TestApp"
        assert config.get("app.version") == "1.0.0"
        
        # Values overridden by dev config
        assert config.get("app.debug") is True
        assert config.get("database.name") == "test_dev_db"
        
        # Values not overridden (from base)
        assert config.get("database.host") == "localhost"
        assert config.get("database.port") == 5432
    
    def test_dot_notation_access(self, temp_config_dir):
        """Test accessing nested values with dot notation."""
        config = ConfigManager(base_path=str(temp_config_dir), env="dev")
        
        assert config.get("app.name") == "TestApp"
        assert config.get("database.host") == "localhost"
        assert config.get("logging.level") == "DEBUG"
        assert config.get("features.cache_ttl") == 3600
    
    def test_default_values(self, temp_config_dir):
        """Test default values for non-existent keys."""
        config = ConfigManager(base_path=str(temp_config_dir), env="dev")
        
        # Non-existent key with default
        assert config.get("non.existent.key", "default") == "default"
        
        # Existing key should return actual value, not default
        assert config.get("app.name", "default") == "TestApp"
    
    def test_set_and_get(self, temp_config_dir):
        """Test setting and getting configuration values."""
        config = ConfigManager(base_path=str(temp_config_dir), env="dev")
        
        # Set a value
        config.set("app.debug", False)
        assert config.get("app.debug") is False
        
        # Set a nested value
        config.set("features.cache_ttl", 7200)
        assert config.get("features.cache_ttl") == 7200
    
    def test_validation_success(self, temp_config_dir):
        """Test successful configuration validation."""
        config = ConfigManager(base_path=str(temp_config_dir), env="dev")
        
        # Should not raise an exception
        assert config.validate() is True
    
    def test_validation_failure_invalid_port(self, temp_config_dir):
        """Test validation failure with invalid port."""
        config = ConfigManager(base_path=str(temp_config_dir), env="dev")
        
        # Try to set invalid port
        with pytest.raises(ConfigurationError):
            config.set("database.port", 99999)
    
    def test_validation_failure_invalid_log_level(self, temp_config_dir):
        """Test validation failure with invalid log level."""
        config = ConfigManager(base_path=str(temp_config_dir), env="dev")
        
        # Try to set invalid log level
        with pytest.raises(ConfigurationError):
            config.set("logging.level", "INVALID")
    
    def test_property_access(self, temp_config_dir):
        """Test accessing configuration via properties."""
        config = ConfigManager(base_path=str(temp_config_dir), env="dev")
        
        assert config.app.name == "TestApp"
        assert config.app.debug is True
        assert config.database.host == "localhost"
        assert config.database.port == 5432
        assert config.logging.level == "DEBUG"
        assert config.features.enable_caching is True
    
    def test_to_dict(self, temp_config_dir):
        """Test converting configuration to dictionary."""
        config = ConfigManager(base_path=str(temp_config_dir), env="dev")
        
        config_dict = config.to_dict()
        
        assert isinstance(config_dict, dict)
        assert "app" in config_dict
        assert "database" in config_dict
        assert config_dict["app"]["name"] == "TestApp"
        assert config_dict["database"]["name"] == "test_dev_db"
    
    def test_save_configuration(self, temp_config_dir):
        """Test saving configuration to file."""
        config = ConfigManager(base_path=str(temp_config_dir), env="dev")
        
        # Modify configuration
        config.set("app.debug", False)
        config.set("features.cache_ttl", 9999)
        
        # Save to a new file
        config.save("config.test.yaml")
        
        # Verify file was created
        saved_file = temp_config_dir / "config.test.yaml"
        assert saved_file.exists()
        
        # Load and verify content
        with open(saved_file, 'r') as f:
            saved_config = yaml.safe_load(f)
        
        assert saved_config["app"]["debug"] is False
        assert saved_config["features"]["cache_ttl"] == 9999
    
    def test_reload_configuration(self, temp_config_dir):
        """Test reloading configuration from disk."""
        config = ConfigManager(base_path=str(temp_config_dir), env="dev")
        
        # Get initial value
        initial_ttl = config.get("features.cache_ttl")
        
        # Modify in memory
        config.set("features.cache_ttl", 9999)
        assert config.get("features.cache_ttl") == 9999
        
        # Reload from disk
        config.reload()
        
        # Should revert to original value
        assert config.get("features.cache_ttl") == initial_ttl
    
    def test_missing_config_file(self, temp_config_dir):
        """Test behavior when configuration file is missing."""
        # Remove base config file
        (temp_config_dir / "config.yaml").unlink()
        
        # Should still work with defaults
        config = ConfigManager(base_path=str(temp_config_dir), env="dev")
        
        # Should have default values
        assert config.get("app.name") is not None
    
    def test_environment_variable(self, temp_config_dir):
        """Test reading environment from environment variable."""
        os.environ['APP_ENV'] = 'prod'
        
        try:
            config = ConfigManager(base_path=str(temp_config_dir))
            
            # Should load prod environment
            assert config.env == 'prod'
            assert config.get("database.name") == "test_prod_db"
        finally:
            del os.environ['APP_ENV']
    
    def test_get_model(self, temp_config_dir):
        """Test getting Pydantic model."""
        config = ConfigManager(base_path=str(temp_config_dir), env="dev")
        
        model = config.get_model()
        
        assert isinstance(model, Config)
        assert model.app.name == "TestApp"
        assert model.database.port == 5432
    
    def test_deep_merge(self, temp_config_dir):
        """Test deep merging of nested dictionaries."""
        config = ConfigManager(base_path=str(temp_config_dir), env="dev")
        
        # Base has all database fields
        # Dev only overrides 'name'
        # Other fields should remain from base
        assert config.get("database.name") == "test_dev_db"  # From dev
        assert config.get("database.host") == "localhost"    # From base
        assert config.get("database.port") == 5432           # From base
    
    def test_invalid_yaml_file(self, temp_config_dir):
        """Test handling of invalid YAML file."""
        # Create invalid YAML file
        invalid_file = temp_config_dir / "config.invalid.yaml"
        with open(invalid_file, 'w') as f:
            f.write("invalid: yaml: content: [")
        
        # Should raise ConfigurationError
        with pytest.raises(ConfigurationError):
            ConfigManager(base_path=str(temp_config_dir), env="invalid")
    
    def test_auto_load_false(self, temp_config_dir):
        """Test initialization without auto-loading."""
        config = ConfigManager(
            base_path=str(temp_config_dir),
            env="dev",
            auto_load=False
        )
        
        # Should raise error when trying to access before loading
        with pytest.raises(ConfigurationError):
            config.get_model()
        
        # Load manually
        config.load()
        
        # Now should work
        assert config.get("app.name") == "TestApp"


class TestConfigSchema:
    """Test suite for configuration schema validation."""
    
    def test_valid_config(self):
        """Test creating a valid configuration."""
        config_data = {
            "app": {"name": "Test", "version": "1.0.0", "debug": False},
            "database": {"host": "localhost", "port": 5432, "name": "test"},
            "logging": {"level": "INFO", "format": "json"},
            "features": {"enable_caching": True, "cache_ttl": 3600}
        }
        
        config = Config(**config_data)
        
        assert config.app.name == "Test"
        assert config.database.port == 5432
    
    def test_invalid_port(self):
        """Test validation of invalid port."""
        config_data = {
            "app": {"name": "Test"},
            "database": {"port": 99999},  # Invalid port
            "logging": {},
            "features": {}
        }
        
        with pytest.raises(Exception):  # Pydantic ValidationError
            Config(**config_data)
    
    def test_invalid_log_level(self):
        """Test validation of invalid log level."""
        config_data = {
            "app": {"name": "Test"},
            "database": {},
            "logging": {"level": "INVALID"},  # Invalid level
            "features": {}
        }
        
        with pytest.raises(Exception):  # Pydantic ValidationError
            Config(**config_data)
    
    def test_default_values(self):
        """Test that default values are applied."""
        config = Config()
        
        assert config.app.name == "MyApp"
        assert config.database.port == 5432
        assert config.logging.level == "INFO"
        assert config.features.enable_caching is True


if __name__ == "__main__":
    pytest.main([__file__, "-v"])

# Made with Bob
