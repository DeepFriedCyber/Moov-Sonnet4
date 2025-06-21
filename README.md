# Property Search Platform

A next-generation property search platform with semantic search, AI chatbot, and WhatsApp integration.

## Architecture

- **Frontend**: Next.js 14 with TypeScript and Tailwind CSS
- **Backend API**: Node.js/Express with TypeScript
- **Embedding Service**: Python FastAPI with sentence-transformers
- **Database**: PostgreSQL with pgvector (Neon)
- **Cache**: Redis
- **Deployment**: Railway
- **Maps**: MapTiler + OpenStreetMap
- **Chat**: AI-powered chatbot with WhatsApp integration

## Quick Start

1. Clone the repository
2. Run the development setup:
   ```bash
   chmod +x dev.sh
   ./dev.sh
   ```

## Services

- **Frontend**: http://localhost:3000
- **API**: http://localhost:8000
- **Embedding Service**: http://localhost:8001

## Features

- 🔍 Semantic property search
- 🤖 AI-powered chatbot
- 📱 WhatsApp integration
- 🗺️ Interactive maps with POI data
- 👥 Multi-tier user system (users, agents, admin)
- 💳 Subscription management
- 📊 Analytics and insights
- 🏠 Property management for agents

## Development

Each service can be developed independently. See individual README files for service-specific instructions.
