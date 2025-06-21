#!/bin/bash

echo "🚀 Starting Property Search Platform Development Environment"

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker first."
    exit 1
fi

# Start infrastructure services
echo "📦 Starting database and cache services..."
docker-compose up -d postgres redis

# Wait for services to be ready
echo "⏳ Waiting for services to be ready..."
sleep 10

# Install dependencies for all services
echo "📥 Installing dependencies..."

# Frontend
cd property-search-frontend
npm install
cd ..

# API
cd property-search-api
npm install
cd ..

# Types package
cd property-search-types
npm install && npm run build
cd ..

# Install types package in other services
cd property-search-frontend && npm install ../property-search-types
cd ../property-search-api && npm install ../property-search-types
cd ..

# Start embedding service
echo "🧠 Starting embedding service..."
cd property-embedding-service
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python src/main.py &
cd ..

# Start API
echo "🔧 Starting API service..."
cd property-search-api
npm run dev &
cd ..

# Start frontend
echo "🎨 Starting frontend..."
cd property-search-frontend
npm run dev &
cd ..

echo "✅ All services started!"
echo ""
echo "🌐 Frontend: http://localhost:3000"
echo "🔧 API: http://localhost:8000"
echo "🧠 Embedding Service: http://localhost:8001"
echo ""
echo "Press Ctrl+C to stop all services"

# Wait for user interrupt
wait
