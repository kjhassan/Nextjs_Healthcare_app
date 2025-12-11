Smart Healthcare Appointment System

Overview:
- Next.js frontend (protected dashboards for doctor & patient)
- Three backend microservices: Auth, Appointment, Notification
- Event-driven via Redis Pub/Sub
- PostgreSQL as the relational database (runs in Docker)

Quick start (Windows PowerShell):

```powershell
cd "d:/sem 7/web/web_lab_terminal/healthcare-system"
docker-compose up --build
```

Services:
- Auth Service: http://localhost:4000
- Appointment Service: http://localhost:4001
- Notification Service: http://localhost:4002
- Frontend: http://localhost:3000

Notes:
- Uses HttpOnly cookies for auth tokens. Do not store secrets in frontend.
- Environment variables are set in `docker-compose.yml` for local/demo only. Change secrets for production.
