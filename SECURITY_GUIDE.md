# Security Guide: Environment Variables and Secrets Management

This guide explains how to securely manage secrets and environment variables in the Moov Property Search application.

## 🔒 Security Implementation

### ✅ What We've Fixed

1. **Removed Hardcoded Secrets**: No more fallback values in docker-compose.yml
2. **Environment Variable Management**: All secrets now come from .env file
3. **Automated Security Testing**: Script to detect hardcoded secrets

### 🚨 Before (Insecure)

```yaml
# docker-compose.yml - INSECURE
environment:
  POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:-moov123}  # ❌ Hardcoded fallback
  JWT_SECRET: ${JWT_SECRET:-dev_jwt_secret_fallback_12345678901234567890}  # ❌ Exposed secret
```

### ✅ After (Secure)

```yaml
# docker-compose.yml - SECURE
environment:
  POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}  # ✅ Must come from .env
  JWT_SECRET: ${JWT_SECRET}  # ✅ No fallback, fails fast if missing
```

## 📁 File Structure

```
project-root/
├── .env                    # ✅ Contains actual secrets (gitignored)
├── .env.example           # ✅ Template with placeholder values
├── docker-compose.yml     # ✅ References env vars without fallbacks
└── test_for_hardcoded_secrets.sh  # ✅ Security test script
```

## 🔧 Setup Instructions

### 1. Copy Environment Template

```bash
cp .env.example .env
```

### 2. Update .env with Real Values

```bash
# .env
POSTGRES_USER=moov
POSTGRES_PASSWORD=your_secure_password_here
POSTGRES_DB=moov_db
JWT_SECRET=your_super_secure_jwt_secret_at_least_32_characters_long
```

### 3. Run Security Test

```bash
bash test_for_hardcoded_secrets.sh
```

Expected output:
```
Checking for hardcoded secrets in docker-compose.yml...
PASS: No hardcoded secret fallbacks found.
```

## 🛡️ Security Best Practices

### Environment Variables

1. **Never commit .env files** to version control
2. **Use strong, unique secrets** for each environment
3. **Rotate secrets regularly** (quarterly recommended)
4. **Use different secrets** for dev/staging/production

### Secret Generation

```bash
# Generate secure JWT secret (32+ characters)
openssl rand -base64 32

# Generate secure database password
openssl rand -base64 24
```

### Production Deployment

For production, use secure secret management:

```bash
# Option 1: Environment variables in deployment platform
export POSTGRES_PASSWORD="$(vault kv get -field=password secret/postgres)"
export JWT_SECRET="$(vault kv get -field=jwt secret/api)"

# Option 2: Docker secrets
docker secret create postgres_password /path/to/postgres_password.txt
docker secret create jwt_secret /path/to/jwt_secret.txt
```

## 🧪 Automated Security Testing

### Test Script: `test_for_hardcoded_secrets.sh`

```bash
#!/bin/bash
echo "Checking for hardcoded secrets in docker-compose.yml..."

if grep -E 'POSTGRES_PASSWORD:-|JWT_SECRET:-' docker-compose.yml; then
    echo "FAIL: Found hardcoded secret fallbacks. Please move them to a .env file."
    exit 1
else
    echo "PASS: No hardcoded secret fallbacks found."
    exit 0
fi
```

### Integration with CI/CD

Add to your CI pipeline:

```yaml
# .github/workflows/security.yml
name: Security Check
on: [push, pull_request]

jobs:
  security:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Check for hardcoded secrets
        run: bash test_for_hardcoded_secrets.sh
```

## 🚨 Common Security Issues

### ❌ Don't Do This

```yaml
# Hardcoded secrets in docker-compose.yml
POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:-password123}

# Secrets in source code
const JWT_SECRET = "hardcoded_secret_123";

# Committing .env files
git add .env  # ❌ Never do this
```

### ✅ Do This Instead

```yaml
# Environment variables without fallbacks
POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}

# Load from environment in code
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is required');
}

# Use .env.example for templates
git add .env.example  # ✅ Safe to commit
```

## 🔍 Security Checklist

- [ ] No hardcoded secrets in docker-compose.yml
- [ ] .env file exists and contains all required secrets
- [ ] .env file is in .gitignore
- [ ] .env.example exists with placeholder values
- [ ] Security test script passes
- [ ] Secrets are strong and unique
- [ ] Production uses secure secret management
- [ ] CI/CD includes security checks

## 🆘 Emergency Response

If secrets are accidentally committed:

1. **Immediately rotate all exposed secrets**
2. **Remove from git history**: `git filter-branch` or BFG Repo-Cleaner
3. **Update all environments** with new secrets
4. **Review access logs** for potential unauthorized access
5. **Notify team** and document incident

## 📚 Additional Resources

- [OWASP Secrets Management Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html)
- [Docker Secrets Documentation](https://docs.docker.com/engine/swarm/secrets/)
- [GitHub Security Best Practices](https://docs.github.com/en/code-security/getting-started/securing-your-repository)

Remember: **Security is not optional** - it's a fundamental requirement for any production application!