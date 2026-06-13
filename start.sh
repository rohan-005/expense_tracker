#!/bin/bash

# Ensure MongoDB is running
if ! pgrep -x "mongod" > /dev/null
then
    echo "Starting MongoDB..."
    mongod --dbpath ./mongodb_data --fork --logpath ./mongodb.log
else
    echo "MongoDB is already running."
fi

# Install backend dependencies
echo "Installing backend dependencies..."
cd backend && npm install && cd ..

# Install frontend dependencies
echo "Installing frontend dependencies..."
cd frontend && npm install && cd ..

# Seed database
echo "Seeding database..."
cd backend && npm run seed && cd ..

# Build frontend to support static serving if needed
echo "Building frontend for static serving..."
cd frontend && npm run build && cd ..

# Start concurrent servers
echo "Starting backend and frontend in dev mode..."
npx concurrently \
  -n "backend,frontend" \
  -c "yellow,blue" \
  "cd backend && npm run dev" \
  "cd frontend && npm run dev"
