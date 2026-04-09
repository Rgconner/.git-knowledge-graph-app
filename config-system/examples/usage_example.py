"""
Example usage of the ConfigManager for Python applications.
Demonstrates various features including loading, accessing, and modifying configurations.
"""

import os
import sys
from pathlib import Path

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from config import ConfigManager, ConfigurationError


def example_basic_usage():
    """Basic configuration loading and access."""
    print("=" * 60)
    print("Example 1: Basic Usage")
    print("=" * 60)
    
    # Initialize config manager for development environment
    config = ConfigManager(base_path="configs", env="dev")
    
    # Access configuration using dot notation
    print(f"App Name: {config.get('app.name')}")
    print(f"App Debug: {config.get('app.debug')}")
    print(f"Database Host: {config.get('database.host')}")
    print(f"Database Port: {config.get('database.port')}")
    print(f"Log Level: {config.get('logging.level')}")
    print()


def example_property_access():
    """Access configuration using property shortcuts."""
    print("=" * 60)
    print("Example 2: Property Access")
    print("=" * 60)
    
    config = ConfigManager(base_path="configs", env="dev")
    
    # Access using properties (returns Pydantic models)
    print(f"App Name: {config.app.name}")
    print(f"App Version: {config.app.version}")
    print(f"App Debug: {config.app.debug}")
    print(f"Database Name: {config.database.name}")
    print(f"Database Pool Size: {config.database.pool_size}")
    print(f"Cache Enabled: {config.features.enable_caching}")
    print()


def example_environment_specific():
    """Load different environment configurations."""
    print("=" * 60)
    print("Example 3: Environment-Specific Configurations")
    print("=" * 60)
    
    environments = ['dev', 'staging', 'prod']
    
    for env in environments:
        config = ConfigManager(base_path="configs", env=env)
        print(f"\n{env.upper()} Environment:")
        print(f"  Debug Mode: {config.app.debug}")
        print(f"  Database: {config.database.name}")
        print(f"  Log Level: {config.logging.level}")
        print(f"  Cache TTL: {config.features.cache_ttl}s")
        print(f"  Rate Limit: {config.features.rate_limit}")
    print()


def example_modify_and_save():
    """Modify configuration and save to file."""
    print("=" * 60)
    print("Example 4: Modify and Save Configuration")
    print("=" * 60)
    
    config = ConfigManager(base_path="configs", env="dev")
    
    print("Original values:")
    print(f"  Debug: {config.get('app.debug')}")
    print(f"  Cache TTL: {config.get('features.cache_ttl')}")
    
    # Modify configuration
    config.set('app.debug', False)
    config.set('features.cache_ttl', 7200)
    
    print("\nModified values:")
    print(f"  Debug: {config.get('app.debug')}")
    print(f"  Cache TTL: {config.get('features.cache_ttl')}")
    
    # Save to a new file (don't overwrite the original)
    config.save('config.dev.modified.yaml')
    print("\nConfiguration saved to: configs/config.dev.modified.yaml")
    print()


def example_validation():
    """Demonstrate configuration validation."""
    print("=" * 60)
    print("Example 5: Configuration Validation")
    print("=" * 60)
    
    config = ConfigManager(base_path="configs", env="dev")
    
    # Valid configuration
    try:
        config.validate()
        print("✓ Configuration is valid")
    except ConfigurationError as e:
        print(f"✗ Configuration error: {e}")
    
    # Try to set an invalid value
    print("\nAttempting to set invalid port (99999)...")
    try:
        config.set('database.port', 99999)
        print("✓ Port set successfully")
    except ConfigurationError as e:
        print(f"✗ Validation error: {e}")
    
    # Try to set invalid log level
    print("\nAttempting to set invalid log level (INVALID)...")
    try:
        config.set('logging.level', 'INVALID')
        print("✓ Log level set successfully")
    except ConfigurationError as e:
        print(f"✗ Validation error: {e}")
    print()


def example_default_values():
    """Access configuration with default values."""
    print("=" * 60)
    print("Example 6: Default Values")
    print("=" * 60)
    
    config = ConfigManager(base_path="configs", env="dev")
    
    # Get existing value
    existing = config.get('app.name', 'DefaultApp')
    print(f"Existing value: {existing}")
    
    # Get non-existing value with default
    non_existing = config.get('app.non_existing_key', 'DefaultValue')
    print(f"Non-existing value with default: {non_existing}")
    
    # Get nested non-existing value
    nested = config.get('some.nested.key', 'NestedDefault')
    print(f"Nested non-existing value: {nested}")
    print()


def example_to_dict():
    """Export configuration as dictionary."""
    print("=" * 60)
    print("Example 7: Export to Dictionary")
    print("=" * 60)
    
    config = ConfigManager(base_path="configs", env="dev")
    
    # Get full configuration as dictionary
    config_dict = config.to_dict()
    
    print("Full configuration:")
    import json
    print(json.dumps(config_dict, indent=2))
    print()


def example_environment_variable():
    """Load configuration based on environment variable."""
    print("=" * 60)
    print("Example 8: Environment Variable")
    print("=" * 60)
    
    # Set environment variable
    os.environ['APP_ENV'] = 'staging'
    
    # ConfigManager will automatically read APP_ENV
    config = ConfigManager(base_path="configs")
    
    print(f"Environment from APP_ENV: {config.env}")
    print(f"App Environment: {config.app.environment}")
    print(f"Database Name: {config.database.name}")
    
    # Clean up
    del os.environ['APP_ENV']
    print()


def example_reload():
    """Reload configuration from disk."""
    print("=" * 60)
    print("Example 9: Reload Configuration")
    print("=" * 60)
    
    config = ConfigManager(base_path="configs", env="dev")
    
    print(f"Initial cache TTL: {config.get('features.cache_ttl')}")
    
    # Modify in memory
    config.set('features.cache_ttl', 9999)
    print(f"Modified cache TTL: {config.get('features.cache_ttl')}")
    
    # Reload from disk (reverts changes)
    config.reload()
    print(f"After reload cache TTL: {config.get('features.cache_ttl')}")
    print()


def main():
    """Run all examples."""
    print("\n" + "=" * 60)
    print("ConfigManager Usage Examples")
    print("=" * 60 + "\n")
    
    try:
        example_basic_usage()
        example_property_access()
        example_environment_specific()
        example_modify_and_save()
        example_validation()
        example_default_values()
        example_to_dict()
        example_environment_variable()
        example_reload()
        
        print("=" * 60)
        print("All examples completed successfully!")
        print("=" * 60)
        
    except Exception as e:
        print(f"\n✗ Error running examples: {e}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    main()

# Made with Bob
