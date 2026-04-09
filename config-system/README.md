# Python YAML Configuration System

A robust, type-safe configuration management system for Python applications with support for environment-specific configurations, schema validation, and easy-to-use API.

## Features

✅ **YAML Format** - Human-readable configuration files with comment support  
✅ **Schema Validation** - Type-safe configuration using Pydantic models  
✅ **Environment Support** - Separate configs for dev, staging, and production  
✅ **Configuration Merging** - Intelligent priority-based merging (env-specific → base → defaults)  
✅ **Dot Notation Access** - Easy access to nested configuration values  
✅ **Error Handling** - Graceful fallbacks and clear validation error messages  
✅ **Hot Reloading** - Reload configuration from disk without restarting  
✅ **Type Safety** - Full IDE autocomplete and type checking support

## Installation

1. Install dependencies:
```bash
pip install -r requirements.txt
```

2. Set up your configuration files in the `configs/` directory

## Quick Start

### Basic Usage

```python
from config import ConfigManager

# Initialize with automatic loading
config = ConfigManager(base_path="configs", env="dev")

# Access configuration values
app_name = config.get("app.name")
db_host = config.get("database.host")
log_level = config.get("logging.level")

print(f"App: {app_name}, DB: {db_host}, Log: {log_level}")
```

### Using Property Access

```python
from config import ConfigManager

config = ConfigManager(base_path="configs", env="prod")

# Access using properties (returns Pydantic models with type safety)
print(f"App Name: {config.app.name}")
print(f"Debug Mode: {config.app.debug}")
print(f"Database: {config.database.name}@{config.database.host}")
print(f"Cache TTL: {config.features.cache_ttl}")
```

### Environment-Specific Configuration

```python
import os
from config import ConfigManager

# Set environment via environment variable
os.environ['APP_ENV'] = 'production'

# ConfigManager automatically reads APP_ENV
config = ConfigManager(base_path="configs")

print(f"Running in: {config.app.environment}")
```

### Modifying and Saving Configuration

```python
from config import ConfigManager

config = ConfigManager(base_path="configs", env="dev")

# Modify values
config.set("app.debug", False)
config.set("features.cache_ttl", 7200)

# Save to file
config.save()  # Saves to config.dev.yaml
# or
config.save("config.custom.yaml")  # Save to custom file
```

## Project Structure

```
config-system/
├── config/                      # Configuration package
│   ├── __init__.py             # Package exports
│   ├── config_manager.py       # Main ConfigManager class
│   ├── schema.py               # Pydantic validation models
│   └── defaults.py             # Default configuration values
├── configs/                     # Configuration files
│   ├── config.yaml             # Base configuration
│   ├── config.dev.yaml         # Development overrides
│   ├── config.staging.yaml     # Staging overrides
│   └── config.prod.yaml        # Production overrides
├── examples/                    # Usage examples
│   └── usage_example.py        # Comprehensive examples
├── tests/                       # Unit tests
│   └── test_config.py          # Configuration tests
└── requirements.txt             # Python dependencies
```

## Configuration Hierarchy

The system uses a three-layer configuration hierarchy:

```
Priority (highest to lowest):
1. Environment-specific config (config.{env}.yaml)
2. Base config (config.yaml)
3. Default values (defaults.py)
```

### Example

**defaults.py:**
```python
DEFAULT_CONFIG = {
    "app": {"name": "MyApp", "debug": False},
    "database": {"host": "localhost", "port": 5432}
}
```

**config.yaml:**
```yaml
app:
  name: "ProductionApp"
database:
  host: "prod-db.example.com"
```

**config.dev.yaml:**
```yaml
app:
  debug: true
database:
  host: "localhost"
```

**Result for dev environment:**
```python
{
    "app": {"name": "ProductionApp", "debug": True},  # name from base, debug from dev
    "database": {"host": "localhost", "port": 5432}   # host from dev, port from defaults
}
```

## Configuration Schema

The configuration is validated against Pydantic models defined in `config/schema.py`:

### App Configuration
```python
app:
  name: str              # Application name
  version: str           # Application version
  debug: bool            # Debug mode flag
  environment: str       # Runtime environment
```

### Database Configuration
```python
database:
  host: str              # Database host
  port: int              # Database port (1-65535)
  name: str              # Database name
  username: str          # Database username (optional)
  password: str          # Database password (optional)
  pool_size: int         # Connection pool size
```

### Logging Configuration
```python
logging:
  level: str             # Log level (DEBUG, INFO, WARNING, ERROR, CRITICAL)
  format: str            # Log format (json, text)
  file: str              # Log file path (optional)
  max_bytes: int         # Max log file size in bytes
  backup_count: int      # Number of backup log files
```

### Features Configuration
```python
features:
  enable_caching: bool   # Enable caching
  cache_ttl: int         # Cache TTL in seconds
  enable_metrics: bool   # Enable metrics collection
  enable_tracing: bool   # Enable distributed tracing
  rate_limit: int        # API rate limit per minute (optional)
```

## API Reference

### ConfigManager

#### `__init__(base_path: str, env: str = None, auto_load: bool = True)`
Initialize the configuration manager.

**Parameters:**
- `base_path`: Directory containing configuration files
- `env`: Environment name (dev, staging, prod). Defaults to `APP_ENV` environment variable
- `auto_load`: Automatically load configuration on initialization

#### `load() -> None`
Load and merge configurations from all sources.

#### `get(key: str, default: Any = None) -> Any`
Get a configuration value using dot notation.

**Example:**
```python
db_host = config.get("database.host")
cache_ttl = config.get("features.cache_ttl", 3600)
```

#### `set(key: str, value: Any) -> None`
Set a configuration value using dot notation. Validates after setting.

**Example:**
```python
config.set("app.debug", True)
config.set("database.port", 5433)
```

#### `save(filename: str = None) -> None`
Save current configuration to a YAML file.

**Parameters:**
- `filename`: Output filename. Defaults to `config.{env}.yaml`

#### `reload() -> None`
Reload configuration from disk, discarding in-memory changes.

#### `validate() -> bool`
Validate current configuration against schema. Returns `True` if valid, raises `ConfigurationError` if invalid.

#### `to_dict() -> Dict[str, Any]`
Get configuration as a dictionary.

#### `get_model() -> Config`
Get the validated Pydantic configuration model.

### Properties

Quick access to configuration sections:
- `config.app` - App configuration
- `config.database` - Database configuration
- `config.logging` - Logging configuration
- `config.features` - Features configuration

## Error Handling

The system provides clear error messages for common issues:

```python
from config import ConfigManager, ConfigurationError

try:
    config = ConfigManager(base_path="configs", env="dev")
    config.set("database.port", 99999)  # Invalid port
except ConfigurationError as e:
    print(f"Configuration error: {e}")
    # Output: Configuration error: Port must be between 1 and 65535
```

## Best Practices

### 1. Never Commit Sensitive Data
Use environment variables for secrets:

```yaml
# config.prod.yaml
database:
  username: ${DB_USERNAME}  # Read from environment
  password: ${DB_PASSWORD}  # Read from environment
```

### 2. Version Control
- ✅ Commit: `config.yaml`, `config.dev.yaml`, `config.staging.yaml`
- ❌ Don't commit: `config.prod.yaml` (if it contains secrets)
- ✅ Commit: `config.prod.example.yaml` (template without secrets)

### 3. Environment Variables
Set `APP_ENV` to automatically load the correct environment:

```bash
# Development
export APP_ENV=dev

# Production
export APP_ENV=prod
```

### 4. Validation
Always validate configuration after loading:

```python
config = ConfigManager(base_path="configs")
if config.validate():
    print("Configuration is valid")
```

### 5. Immutability
For thread-safe applications, load configuration once at startup and treat it as immutable.

## Running Examples

Run the comprehensive usage examples:

```bash
cd config-system
python examples/usage_example.py
```

This will demonstrate:
- Basic configuration loading
- Property access
- Environment-specific configs
- Modifying and saving
- Validation
- Default values
- Dictionary export
- Environment variables
- Hot reloading

## Running Tests

Run the test suite:

```bash
cd config-system
pytest tests/ -v
```

With coverage:

```bash
pytest tests/ --cov=config --cov-report=html
```

## Extending the System

### Adding New Configuration Sections

1. Update `config/schema.py`:
```python
class CacheConfig(BaseModel):
    redis_host: str = "localhost"
    redis_port: int = 6379

class Config(BaseModel):
    # ... existing fields ...
    cache: CacheConfig = Field(default_factory=CacheConfig)
```

2. Update `config/defaults.py`:
```python
DEFAULT_CONFIG = {
    # ... existing config ...
    "cache": {
        "redis_host": "localhost",
        "redis_port": 6379
    }
}
```

3. Add to configuration files:
```yaml
# config.yaml
cache:
  redis_host: "cache.example.com"
  redis_port: 6379
```

### Custom Validators

Add custom validation logic in `schema.py`:

```python
from pydantic import field_validator

class DatabaseConfig(BaseModel):
    host: str
    port: int
    
    @field_validator('host')
    @classmethod
    def validate_host(cls, v: str) -> str:
        if not v or v.strip() == "":
            raise ValueError('Host cannot be empty')
        return v
```

## Troubleshooting

### Import Errors
If you get import errors, ensure you're running from the correct directory:
```bash
cd config-system
python -c "from config import ConfigManager; print('Success!')"
```

### Validation Errors
Check that your YAML files match the schema defined in `config/schema.py`. The error message will indicate which field failed validation.

### File Not Found
Ensure your `base_path` is correct and configuration files exist:
```python
from pathlib import Path
print(Path("configs").exists())  # Should print True
```

## License

MIT License - feel free to use in your projects!

## Contributing

Contributions are welcome! Please ensure:
- Code follows PEP 8 style guidelines
- All tests pass
- New features include tests and documentation