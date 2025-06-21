# 🏠 PropertySearch UK - AI-Powered Property Search Platform

[![Next.js](https://img.shields.io/badge/Next.js-15.3.4-black?logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue?logo=typescript)](https://www.typescriptlang.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16+-blue?logo=postgresql)](https://www.postgresql.org/)
[![Python](https://img.shields.io/badge/Python-3.9+-green?logo=python)](https://www.python.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

An intelligent property search platform for the UK market, featuring AI-powered natural language search, interactive property cards, and real-time chat functionality.

## 🌟 Features

- **🔍 AI-Powered Search**: Natural language property search using advanced embedding models
- **🏡 Interactive Property Cards**: Beautiful, responsive property listings with detailed information
- **💬 Real-time Chat**: Interactive chat widget for user assistance
- **📱 Responsive Design**: Mobile-first design that works on all devices
- **🗄️ Database Integration**: PostgreSQL with Neon cloud hosting
- **🚀 Modern Tech Stack**: Next.js 15, TypeScript, Tailwind CSS
- **🤖 ML Integration**: Python-based AI service for property matching

## 🏗️ Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │   API Server    │    │  AI Service     │
│   Next.js 15    │◄──►│   TypeScript    │◄──►│   Python        │
│   Port: 3000    │    │   Port: 3001    │    │   Port: 8001    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         │                       ▼                       │
         │              ┌─────────────────┐              │
         │              │   PostgreSQL    │              │
         └──────────────►│   (Neon Cloud)  │◄─────────────┘
                        └─────────────────┘
```

## 🚀 Quick Start

### Prerequisites

- **Node.js** 18+ and npm
- **Python** 3.9+ and pip
- **PostgreSQL** database (we use Neon)
- **Git**

### 1. Clone the Repository

```bash
git clone https://github.com/DeepFriedCyber/Moov-Sonnet4.git
cd Moov-Sonnet4
```

### 2. Install Dependencies

```bash
# Install root dependencies
npm install

# Install frontend dependencies
cd property-search-frontend
npm install
cd ..

# Install API dependencies
cd property-search-api
npm install
cd ..

# Install Python dependencies
cd property-embedding-service
pip install -r requirements.txt
cd ..
```

### 3. Environment Configuration

#### Frontend (.env.local)
```bash
cd property-search-frontend
cp .env.local.example .env.local
```

Edit `.env.local`:
```env
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_EMBEDDING_SERVICE_URL=http://localhost:8001
```

#### API Server (.env)
```bash
cd property-search-api
cp .env.example .env
```

Edit `.env`:
```env
NODE_ENV=development
PORT=3001
DATABASE_URL=your_neon_postgresql_connection_string
REDIS_URL=redis://localhost:6379
FRONTEND_URL=http://localhost:3000
EMBEDDING_SERVICE_URL=http://localhost:8001
JWT_SECRET=your_jwt_secret_key
```

#### AI Service (.env)
```bash
cd property-embedding-service
cp .env.example .env
```

Edit `.env`:
```env
MODEL_NAME=all-MiniLM-L6-v2
CACHE_DIR=./model_cache
API_HOST=0.0.0.0
API_PORT=8001
```

### 4. Database Setup

1. **Create a Neon PostgreSQL database**: https://neon.tech/
2. **Copy the connection string** to your API `.env` file
3. **Run migrations** (when available):
   ```bash
   cd property-search-api
   npm run migrate
   ```

### 5. Start All Services

#### Option A: Start All Services at Once
```bash
npm run dev
```

#### Option B: Start Services Individually

**Terminal 1 - API Server:**
```bash
cd property-search-api
npm run dev
```

**Terminal 2 - Frontend:**
```bash
cd property-search-frontend
npm run dev
```

**Terminal 3 - AI Service:**
```bash
cd property-embedding-service
python src/main.py
```

### 6. Access the Application

- **🌐 Frontend**: http://localhost:3000
- **🔌 API**: http://localhost:3001
- **🤖 AI Service**: http://localhost:8001

## 📁 Project Structure

```
Moov-Sonnet4/
├── property-search-frontend/     # Next.js 15 frontend
│   ├── src/
│   │   ├── app/                 # App router pages
│   │   ├── components/          # React components
│   │   ├── hooks/               # Custom React hooks
│   │   ├── lib/                 # Utility functions
│   │   └── types/               # TypeScript types
│   ├── public/                  # Static assets
│   └── package.json
│
├── property-search-api/         # Node.js/TypeScript API
│   ├── src/
│   │   ├── routes/              # API routes
│   │   ├── middleware/          # Express middleware
│   │   ├── models/              # Database models
│   │   ├── services/            # Business logic
│   │   └── utils/               # Utility functions
│   └── package.json
│
├── property-embedding-service/  # Python AI service
│   ├── src/
│   │   ├── main.py             # FastAPI application
│   │   ├── models/             # ML models
│   │   └── utils/              # Utility functions
│   └── requirements.txt
│
├── property-search-types/       # Shared TypeScript types
│   └── src/index.ts
│
├── .github/                     # GitHub Actions workflows
├── docker-compose.yml           # Docker configuration
└── package.json                 # Root package configuration
```

## 🛠️ Development

### Available Scripts

```bash
# Root level
npm run dev              # Start all services
npm run build           # Build all projects
npm run test            # Run all tests
npm run lint            # Lint all projects

# Frontend specific
npm run dev:frontend    # Start frontend only
npm run build:frontend  # Build frontend
npm run test:frontend   # Test frontend

# API specific
npm run dev:api         # Start API only
npm run build:api       # Build API
npm run test:api        # Test API

# AI service specific
npm run dev:embedding   # Start AI service only
```

### Code Style

- **ESLint** and **Prettier** for TypeScript/JavaScript
- **Black** and **isort** for Python
- **Husky** for pre-commit hooks
- **TypeScript** strict mode enabled

## 🧪 Testing

```bash
# Run all tests
npm test

# Run frontend tests
cd property-search-frontend && npm test

# Run API tests
cd property-search-api && npm test

# Run Python tests
cd property-embedding-service && pytest
```

## 🐳 Docker Support

```bash
# Start all services with Docker
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

## 🚀 Deployment

### Frontend (Vercel/Netlify)

1. **Connect your GitHub repository**
2. **Set environment variables**:
   - `NEXT_PUBLIC_API_URL`
   - `NEXT_PUBLIC_EMBEDDING_SERVICE_URL`
3. **Deploy automatically on push**

### API Server (Railway/Heroku)

1. **Connect your repository**
2. **Set environment variables**:
   - `DATABASE_URL`
   - `REDIS_URL`
   - `JWT_SECRET`
3. **Deploy the `property-search-api` folder**

### AI Service (Python hosting)

1. **Deploy to Python hosting service**
2. **Install requirements**: `pip install -r requirements.txt`
3. **Start service**: `python src/main.py`

## 🔧 Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `NODE_ENV` | Environment mode | `development` |
| `DATABASE_URL` | PostgreSQL connection string | Required |
| `REDIS_URL` | Redis connection string | Optional |
| `JWT_SECRET` | Secret for JWT tokens | Required |
| `FRONTEND_URL` | Frontend application URL | `http://localhost:3000` |
| `EMBEDDING_SERVICE_URL` | AI service URL | `http://localhost:8001` |

## 📊 Performance

- **Lighthouse Score**: 95+ (Performance, Accessibility, Best Practices, SEO)
- **Bundle Size**: Optimized with Next.js automatic code splitting
- **Database**: Connection pooling with PostgreSQL
- **Caching**: Redis for API responses and session management
- **AI Models**: Efficient sentence transformers with caching

## 🤝 Contributing

1. **Fork the repository**
2. **Create a feature branch**: `git checkout -b feature/amazing-feature`
3. **Commit changes**: `git commit -m 'Add amazing feature'`
4. **Push to branch**: `git push origin feature/amazing-feature`
5. **Open a Pull Request**

### Development Guidelines

- Write tests for new features
- Follow existing code style
- Update documentation
- Add type definitions
- Test on multiple devices

## 🐛 Troubleshooting

### Common Issues

**Frontend not loading:**
```bash
# Clear Next.js cache
cd property-search-frontend
rm -rf .next node_modules
npm install
npm run dev
```

**Database connection issues:**
```bash
# Check your DATABASE_URL in .env
# Ensure Neon database is running
# Verify connection string format
```

**AI service not starting:**
```bash
# Install Python dependencies
pip install -r requirements.txt

# Check Python version (3.9+ required)
python --version
```

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **Next.js Team** for the amazing framework
- **Neon** for PostgreSQL hosting
- **Hugging Face** for AI models
- **Tailwind CSS** for styling
- **TypeScript** for type safety

## 📞 Support

- **Issues**: [GitHub Issues](https://github.com/DeepFriedCyber/Moov-Sonnet4/issues)
- **Discussions**: [GitHub Discussions](https://github.com/DeepFriedCyber/Moov-Sonnet4/discussions)
- **Email**: support@propertysearch.uk

---

**Made with ❤️ for the UK property market**

⭐ **Star this repository if you find it helpful!**
