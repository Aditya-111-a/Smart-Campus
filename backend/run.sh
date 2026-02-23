#!/bin/bash

# Script to run backend server with virtual environment
# Ensures venv is activated before running

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
VENV_DIR="$SCRIPT_DIR/venv"

# Check if virtual environment exists
if [ ! -d "$VENV_DIR" ]; then
    echo "Creating virtual environment..."
    python3 -m venv "$VENV_DIR"
    
    echo "Installing dependencies..."
    source "$VENV_DIR/bin/activate"
    pip install --upgrade pip
    pip install --trusted-host pypi.org --trusted-host pypi.python.org --trusted-host files.pythonhosted.org -r requirements.txt
    pip install --trusted-host pypi.org --trusted-host pypi.python.org --trusted-host files.pythonhosted.org email-validator cryptography bcrypt
else
    source "$VENV_DIR/bin/activate"
    
    # Check if dependencies are installed
    if ! python -c "import fastapi" 2>/dev/null; then
        echo "Installing dependencies..."
        pip install --upgrade pip
        pip install --trusted-host pypi.org --trusted-host pypi.python.org --trusted-host files.pythonhosted.org -r requirements.txt
        pip install --trusted-host pypi.org --trusted-host pypi.python.org --trusted-host files.pythonhosted.org email-validator cryptography bcrypt
    fi
fi

# Check if .env exists
if [ ! -f "$SCRIPT_DIR/.env" ]; then
    echo "Creating .env file from .env.example..."
    cp "$SCRIPT_DIR/.env.example" "$SCRIPT_DIR/.env"
fi

# Initialize database if needed
if [ ! -f "$SCRIPT_DIR/../smartcampus.db" ] && [ ! -f "$SCRIPT_DIR/smartcampus.db" ]; then
    echo "Initializing database..."
    python "$SCRIPT_DIR/init_db.py"
    echo "Seeding database..."
    python "$SCRIPT_DIR/seed_data.py"
fi

echo "Starting backend server..."
echo "Backend will be available at http://localhost:8000"
echo "API docs at http://localhost:8000/docs"
echo ""

uvicorn main:app --reload --host 0.0.0.0 --port 8000
