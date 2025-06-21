# 🤝 Contributing to PropertySearch UK

Thank you for your interest in contributing to PropertySearch UK! This guide will help you get started with contributing to our AI-powered property search platform.

## 🌟 Ways to Contribute

- 🐛 **Bug Reports**: Help us identify and fix issues
- 🚀 **Feature Requests**: Suggest new features and improvements
- 💻 **Code Contributions**: Submit pull requests with bug fixes or new features
- 📝 **Documentation**: Improve documentation and guides
- 🧪 **Testing**: Help test new features and report issues
- 🎨 **Design**: Contribute to UI/UX improvements

## 🚀 Getting Started

### 1. Fork the Repository

```bash
# Fork the repository on GitHub, then clone your fork
git clone https://github.com/YOUR_USERNAME/Moov-Sonnet4.git
cd Moov-Sonnet4
```

### 2. Set Up Development Environment

```bash
# Install dependencies
npm run install:all

# Set up environment variables
cp property-search-frontend/.env.local.example property-search-frontend/.env.local
cp property-search-api/.env.example property-search-api/.env
cp property-embedding-service/.env.example property-embedding-service/.env

# Start development servers
npm run dev
```

### 3. Create a Branch

```bash
git checkout -b feature/your-feature-name
# or
git checkout -b fix/your-bug-fix
```

## 📋 Development Guidelines

### 🏗️ Code Style

We maintain consistent code style across the project:

**JavaScript/TypeScript:**
- Use ESLint and Prettier for formatting
- Follow TypeScript strict mode guidelines
- Use meaningful variable and function names
- Add JSDoc comments for complex functions

**Python:**
- Use Black for code formatting
- Follow PEP 8 style guide
- Use type hints where appropriate
- Add docstrings for functions and classes

### 🧪 Testing

All contributions must include appropriate tests:

```bash
# Run all tests
npm test

# Run specific test suites
npm run test:frontend
npm run test:api
npm run test:ai
```

**Testing Requirements:**
- Unit tests for new functions/components
- Integration tests for API endpoints
- E2E tests for critical user flows
- All existing tests must pass

### 📝 Commit Messages

Use conventional commit format:

```
type(scope): description

feat(frontend): add property filtering by price range
fix(api): resolve database connection timeout issue
docs(readme): update installation instructions
test(ai): add unit tests for embedding service
```

**Types:**
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `test`: Adding or modifying tests
- `refactor`: Code refactoring
- `style`: Code formatting changes
- `chore`: Maintenance tasks

## 🏗️ Architecture Overview

### Frontend (Next.js 15)
- **Location**: `property-search-frontend/`
- **Tech Stack**: Next.js, TypeScript, Tailwind CSS
- **Key Components**: SearchBox, PropertyCard, Header, Footer

### Backend API (Node.js)
- **Location**: `property-search-api/`
- **Tech Stack**: Node.js, Express, TypeScript, PostgreSQL
- **Key Features**: RESTful API, Authentication, Database integration

### AI Service (Python)
- **Location**: `property-embedding-service/`
- **Tech Stack**: Python, FastAPI, sentence-transformers
- **Key Features**: Natural language processing, Property embeddings

## 🐛 Bug Reports

When reporting bugs, please include:

1. **Clear description** of the issue
2. **Steps to reproduce** the problem
3. **Expected vs actual behavior**
4. **Environment details** (OS, browser, versions)
5. **Screenshots** if applicable
6. **Error messages** or console logs

Use our [bug report template](.github/ISSUE_TEMPLATE/bug_report.md).

## 🚀 Feature Requests

For new features, please include:

1. **Problem statement** - what problem does this solve?
2. **Proposed solution** - how should it work?
3. **User impact** - who benefits from this feature?
4. **Technical considerations** - any constraints or requirements?

Use our [feature request template](.github/ISSUE_TEMPLATE/feature_request.md).

## 💻 Pull Request Process

### 1. Before Submitting

- [ ] Fork the repository and create a feature branch
- [ ] Write tests for your changes
- [ ] Ensure all tests pass
- [ ] Update documentation if needed
- [ ] Run linting and formatting tools
- [ ] Test your changes thoroughly

### 2. Submitting Your PR

1. **Fill out the PR template** completely
2. **Link related issues** using "Fixes #123" syntax
3. **Add clear description** of your changes
4. **Include screenshots** for UI changes
5. **Request review** from maintainers

### 3. Review Process

- Maintainers will review your PR within 48 hours
- Address any feedback or requested changes
- Once approved, your PR will be merged
- Your contribution will be included in the next release

## 🔧 Development Scripts

```bash
# Development
npm run dev                    # Start all services
npm run dev:frontend          # Start frontend only
npm run dev:api              # Start API only
npm run dev:embedding        # Start AI service only

# Building
npm run build                # Build all projects
npm run build:frontend       # Build frontend
npm run build:api           # Build API

# Testing
npm run test                 # Run all tests
npm run test:frontend        # Test frontend
npm run test:api            # Test API
npm run test:ai             # Test AI service

# Code Quality
npm run lint                 # Lint all code
npm run format              # Format all code
npm run type-check          # TypeScript type checking

# Docker
npm run docker:build        # Build Docker images
npm run docker:up           # Start with Docker
npm run docker:down         # Stop Docker containers
```

## 🏆 Recognition

Contributors are recognized in several ways:

- **Contributors section** in README.md
- **Release notes** mention significant contributions
- **GitHub contributors** page shows all contributors
- **Special thanks** in major releases

## 📞 Getting Help

If you need help contributing:

1. **Check existing issues** and discussions
2. **Ask in GitHub discussions** for general questions
3. **Create an issue** for specific problems
4. **Join our community** (Discord/Slack if available)

## 📋 Code of Conduct

We are committed to providing a welcoming and inclusive environment for all contributors. Please:

- **Be respectful** in all interactions
- **Use inclusive language** in code and communication
- **Focus on constructive feedback** during reviews
- **Help newcomers** learn and contribute
- **Report inappropriate behavior** to maintainers

## 🔒 Security

If you discover security vulnerabilities:

1. **Do not** create public issues for security bugs
2. **Email security concerns** to security@propertysearch.uk
3. **Provide detailed information** about the vulnerability
4. **Allow time** for the issue to be resolved before disclosure

## 📚 Resources

- [Project Documentation](README.md)
- [API Documentation](property-search-api/README.md)
- [Frontend Guide](property-search-frontend/README.md)
- [AI Service Guide](property-embedding-service/README.md)
- [Deployment Guide](docs/deployment.md)

## 🎯 Current Priorities

Check our [project roadmap](https://github.com/DeepFriedCyber/Moov-Sonnet4/projects) for current priorities:

- 🔍 Enhanced search functionality
- 📱 Mobile app development
- 🤖 AI improvements
- 🔌 API enhancements
- 📊 Analytics dashboard
- 🏠 Property management features

## 🙏 Thank You

Thank you for contributing to PropertySearch UK! Your contributions help make property searching better for everyone in the UK. 

**Together, we're building the future of property search! 🏠✨**

---

For questions about contributing, please [create an issue](https://github.com/DeepFriedCyber/Moov-Sonnet4/issues/new) or reach out to the maintainers.