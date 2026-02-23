# SmartCampus Utilities Dashboard

SmartCampus Utilities Dashboard is a comprehensive web application designed to help university administrators monitor and manage water and electricity consumption across campus buildings. The system provides real-time tracking, analytics, anomaly detection, and reporting capabilities to help institutions optimize their utility usage and reduce costs.

## About the Project

Managing utility consumption across a large campus with multiple buildings can be challenging. This application solves that problem by providing a centralized platform where administrators can:

- Track utility readings from multiple buildings in one place
- Identify consumption patterns and trends through interactive visualizations
- Detect anomalies and unusual usage patterns automatically
- Generate comprehensive reports for analysis and planning
- Manage alerts and respond to issues efficiently

The system is built with modern web technologies and follows best practices for security, scalability, and maintainability. It uses a RESTful API architecture with a clean separation between frontend and backend, making it easy to extend and customize.

## Features

**User Management**
- Secure JWT-based authentication system
- Role-based access control (Admin and User roles)
- User registration and profile management

**Building Management**
- Register and manage campus buildings
- Set custom consumption thresholds per building
- Track building metadata and descriptions

**Utility Monitoring**
- Submit periodic water and electricity readings
- Track consumption over time
- Filter and search readings by building, date, and utility type

**Analytics Dashboard**
- Interactive charts showing consumption trends
- Building-wise consumption rankings
- Time-based summaries (daily, weekly, monthly)
- Total consumption statistics

**Anomaly Detection**
- Automatic detection of consumption spikes
- Threshold breach alerts
- Continuous high usage warnings
- Statistical analysis using z-score calculations

**Alert Management**
- View all alerts in one place
- Filter by status (pending, acknowledged, resolved)
- Acknowledge and resolve alerts with notes
- Track alert history and resolution

**Report Generation**
- Generate monthly consumption reports
- Custom date range reports
- Building-wise breakdowns
- Top consumer analysis

## Technology Stack

**Backend**
- FastAPI - Modern Python web framework for building APIs
- SQLAlchemy - SQL toolkit and ORM for database operations
- SQLite - Lightweight database (PostgreSQL supported)
- Pydantic - Data validation using Python type annotations
- Python-JOSE - JWT token handling
- Passlib - Password hashing with bcrypt

**Frontend**
- React - JavaScript library for building user interfaces
- Vite - Fast build tool and development server
- Recharts - Composable charting library
- Tailwind CSS - Utility-first CSS framework
- Axios - HTTP client for API requests
- React Router - Declarative routing for React

## Project Structure

```
SmartCampus/
├── backend/                 # FastAPI backend application
│   ├── app/
│   │   ├── routers/        # API route handlers
│   │   ├── models.py       # Database models
│   │   ├── schemas.py      # Pydantic schemas
│   │   ├── auth.py         # Authentication logic
│   │   ├── database.py     # Database configuration
│   │   └── config.py       # Application settings
│   ├── main.py             # Application entry point
│   ├── init_db.py          # Database initialization
│   ├── seed_data.py        # Sample data seeding
│   ├── requirements.txt    # Python dependencies
│   └── run.sh              # Backend startup script
├── frontend/               # React frontend application
│   ├── src/
│   │   ├── pages/         # Page components
│   │   ├── components/    # Reusable components
│   │   ├── contexts/      # React contexts
│   │   └── services/      # API client
│   ├── package.json       # Node dependencies
│   └── run.sh             # Frontend startup script
├── run.sh                 # Single script to run backend + frontend (no install)
└── README.md              # This file
```

## Quick Start

From the project root, run (requires dependencies already installed):

```bash
./run.sh
```

Or run backend and frontend separately (see Installation below). Once either is running:

- Frontend application: http://localhost:5173
- Backend API: http://localhost:8000
- API documentation: http://localhost:8000/docs

## Prerequisites

- Python 3.10, 3.11, or 3.12 (3.13 supported with updated pandas in requirements)
- Node.js 18+
- npm (comes with Node.js)

SQLite is used by default; no extra database setup. Use PostgreSQL by setting `DATABASE_URL` in `.env`.

## Installation (one-time)

**Backend:**

```bash
cd backend
python3 -m venv venv
source venv/bin/activate   # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
python init_db.py
python seed_data.py
```

**Frontend:**

```bash
cd frontend
npm install
```

## How to run

From the project root (after installation above):

```bash
./run.sh
```

This starts backend and frontend; press Ctrl+C to stop both.

**Or run manually in two terminals:**

Terminal 1 (backend):

```bash
cd backend
source venv/bin/activate
uvicorn main:app --reload
```

Terminal 2 (frontend):

```bash
cd frontend
npm run dev
```

Then open http://localhost:5173 (login: admin@campus.edu / admin123).

## Configuration

The application uses environment variables for configuration. Copy `.env.example` to `.env` and modify as needed:

```env
DATABASE_URL=sqlite:///./smartcampus.db
SECRET_KEY=your-secret-key-change-this-in-production
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30
DEBUG=True
```

For PostgreSQL, update the DATABASE_URL:
```env
DATABASE_URL=postgresql://username:password@localhost:5432/smartcampus
```

## Default Credentials

After running the seed script, you can log in with:

- **Admin**: `admin@campus.edu` / `admin123`
- **User**: `user@campus.edu` / `user123`

## API Documentation

Interactive API documentation is available at http://localhost:8000/docs when the backend is running. This Swagger UI interface allows you to explore all available endpoints and test them directly.

### Main API Endpoints

**Authentication**
- `POST /api/auth/register` - Register a new user
- `POST /api/auth/login` - Authenticate and get access token
- `GET /api/auth/me` - Get current user information

**Buildings**
- `GET /api/buildings` - List all buildings
- `POST /api/buildings` - Create a new building
- `GET /api/buildings/{id}` - Get building details
- `PUT /api/buildings/{id}` - Update building information
- `DELETE /api/buildings/{id}` - Delete a building

**Readings**
- `POST /api/readings` - Submit a utility reading
- `GET /api/readings` - List readings with optional filters
- `GET /api/readings/{id}` - Get specific reading details

**Analytics**
- `GET /api/analytics/totals` - Get total consumption statistics
- `GET /api/analytics/rankings` - Get building consumption rankings
- `GET /api/analytics/summary` - Get time-based consumption summaries

**Alerts**
- `GET /api/alerts` - List all alerts with optional filters
- `PUT /api/alerts/{id}/acknowledge` - Acknowledge an alert
- `PUT /api/alerts/{id}/resolve` - Resolve an alert with notes

**Reports**
- `GET /api/reports/monthly` - Generate monthly consumption report
- `GET /api/reports/custom` - Generate custom date range report

## Development

### Running in Development Mode

Run the backend with `uvicorn main:app --reload` and the frontend with `npm run dev`. Both support hot-reload.

### Database Management

The database is automatically initialized on first run. To reset the database:

```bash
cd backend
source venv/bin/activate
rm smartcampus.db  # Remove existing database
python init_db.py
python seed_data.py
```

### Code Structure

The backend follows a modular structure with separate routers for each feature area. The frontend uses React functional components with hooks for state management. Both follow RESTful principles and maintain clear separation of concerns.

## Troubleshooting

**Port Already in Use**
If ports 8000 or 5173 are already in use, you can kill the processes:
```bash
lsof -ti:8000 | xargs kill -9
lsof -ti:5173 | xargs kill -9
```

**Dependencies Not Installing**
Ensure you have an active internet connection and try:
```bash
cd backend
source venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt
```

**Frontend Build Issues**
Clear node modules and reinstall:
```bash
cd frontend
rm -rf node_modules package-lock.json
npm install
```

## Security Considerations

- Passwords are hashed using bcrypt before storage
- JWT tokens are used for authentication
- CORS is configured to allow only specific origins
- Input validation is performed using Pydantic schemas
- SQL injection is prevented through SQLAlchemy ORM

For production deployment:
- Change the SECRET_KEY in `.env`
- Set DEBUG=False
- Use a production-grade database
- Configure proper CORS origins
- Use HTTPS
- Implement rate limiting
- Set up proper logging and monitoring

## License

This project is licensed under the MIT License.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
