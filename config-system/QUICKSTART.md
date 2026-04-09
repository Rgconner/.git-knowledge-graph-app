# Quick Start Guide

Get up and running with the Python YAML Configuration System in 5 minutes!

## Installation

1. **Clone or download the project**
   ```bash
   cd config-system
   ```

2. **Install dependencies**
   ```bash
   pip install -r requirements.txt
   ```

## Basic Usage

### 1. Create Your First Configuration

The system comes with example configs. Let's use them:

```python
from config import ConfigManager

# Load development configuration
config = ConfigManager(base_path="configs", env="dev")

# Access values
print(f"App: {config.app.name}")
print(f"Debug: {config.app.debug}")
print(f"Database: {config.database.name}")
```

### 2. Run the Examples

See all features in action:

```bash
python examples/usage_example.py
```

### 3. Run the Tests

Verify everything works:

```bash
pytest tests/ -v
```

## Common Use Cases

### Load Configuration for Different Environments

```python
from config import ConfigManager

# Development
dev_config = ConfigManager(base_path="configs", env="dev")
print(f"Dev DB: {dev_config.database.name}")

# Production
prod_config = ConfigManager(base_path="configs", env="prod")
print(f"Prod DB: {prod_config.database.name}")
```

### Access Nested Values

```python
config = ConfigManager(base_path="configs", env="dev")

# Using dot notation
db_host = config.get("database.host")
cache_ttl = config.get("features.cache_ttl")

# Using properties
db_port = config.database.port
log_level = config.logging.level
```

### Modify and Save Configuration

```python
config = ConfigManager(base_path="configs", env="dev")

# Modify values
config.set("app.debug", False)
config.set("features.cache_ttl", 7200)

# Save changes
config.save()  # Saves to config.dev.yaml
```

### Use Environment Variables

```bash
# Set environment
export APP_ENV=production

# Or in Windows
set APP_ENV=production
```

```python
# ConfigManager automatically reads APP_ENV
config = ConfigManager(base_path="configs")
print(f"Environment: {config.env}")
```

## Project Structure

```
config-system/
├── config/              # Configuration package
│   ├── config_manager.py
│   ├── schema.py
│   └── defaults.py
├── configs/             # Your YAML files
│   ├── config.yaml      # Base config
│   ├── config.dev.yaml  # Dev overrides
│   └── config.prod.yaml # Prod overrides
├── examples/            # Usage examples
└── tests/               # Unit tests
```

## Next Steps

1. **Customize the schema** - Edit `config/schema.py` to match your needs
2. **Update configs** - Modify YAML files in `configs/` directory
3. **Read the full docs** - Check out `README.md` for detailed documentation
4. **Add your own configs** - Create environment-specific YAML files

## Troubleshooting

**Import errors?**
```bash
# Make sure you're in the right directory
cd config-system
python -c "from config import ConfigManager; print('Success!')"
```

**Dependencies not installed?**
```bash
pip install -r requirements.txt
```

**Need help?**
- Check `README.md` for detailed documentation
- Run `python examples/usage_example.py` to see working examples
- Look at `tests/test_config.py` for usage patterns

## Quick Reference

```python
from config import ConfigManager

# Initialize
config = ConfigManager(base_path="configs", env="dev")

# Read
value = config.get("key.nested.value")
value = config.get("key", "default")

# Write
config.set("key.nested.value", "new_value")

# Save
config.save()

# Reload
config.reload()

# Validate
config.validate()

# Export
config_dict = config.to_dict()

# Properties
config.app.name
config.database.host
config.logging.level
config.features.enable_caching
```

Happy configuring! 🎉