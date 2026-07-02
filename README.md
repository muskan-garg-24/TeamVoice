# TeamVoice

TeamVoice is a Next.js 14 web application scaffolded with TypeScript, Tailwind CSS, shadcn/ui structural setup, Prisma ORM, and PostgreSQL support.

## Getting Started

### Setup Steps

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Configure environment variables:**
   ```bash
   cp .env.example .env
   ```
   *Edit `.env` to configure your actual database connection under `DATABASE_URL`.*

3. **Generate Prisma Client:**
   ```bash
   npx prisma generate
   ```

4. **Run database migrations:**
   ```bash
   npx prisma migrate dev --name init
   ```

5. **Start the development server:**
   ```bash
   npm run dev
   ```

### Verification Steps

- **Home Page:** Open [http://localhost:3000](http://localhost:3000) in your browser. It should display the heading **"Project Setup Successful"**.
- **Database Connection Check:** Query the health API at [http://localhost:3000/api/health](http://localhost:3000/api/health). If the database is connected, it returns status code `200` with:
  ```json
  {
    "status": "ok",
    "database": "connected",
    "timestamp": "..."
  }
  ```
- **Type Checking:** Run the TypeScript compiler check to verify no compiler errors:
  ```bash
  npx tsc --noEmit
  ```
