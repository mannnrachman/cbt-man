# CBT-MAN Upgrade

![License: NCU-1.0](https://img.shields.io/badge/license-NCU--1.0-red)
![Commercial Use](https://img.shields.io/badge/commercial%20use-prohibited-critical)
![Status](https://img.shields.io/badge/status-active-2ea44f)

CBT-MAN Upgrade is a school-oriented **Computer-Based Test (CBT)** application built with **TanStack Start, React, TypeScript, Prisma, and SQLite**.

This repository is an upgraded continuation of source material that was genuinely useful to me. I did not build it in isolation; I improved it because the earlier work gave me a meaningful head start. This project is my effort to refine that foundation into something more stable, more realistic for demonstration, and more maintainable for ongoing development.

It is intended for:
- internal evaluation
- product preview environments
- admin / teacher / student workflow testing
- non-commercial educational use
- iterative technical improvement

It now includes a realistic Indonesian-school demo dataset, allowing the application to behave like an active CBT deployment rather than an empty prototype.

> [!IMPORTANT]
> This repository is provided for learning, evaluation, internal use, and collaborative improvement.
> **Commercial sale, resale, paid hosting, paid distribution, and productized resale of this application are prohibited.**

---

## Table of Contents

- [Key Capabilities](#key-capabilities)
- [Technology Stack](#technology-stack)
- [Current Architectural Position](#current-architectural-position)
- [Core Domain Model](#core-domain-model)
- [Realistic Demo Seeding](#realistic-demo-seeding)
- [Demo Accounts](#demo-accounts)
- [Getting Started](#getting-started)
- [Useful Commands](#useful-commands)
- [Project Structure](#project-structure)
- [Application Data Flow](#application-data-flow)
- [Recommended Verification](#recommended-verification)
- [Contributing](#contributing)
- [License and Usage Restrictions](#license-and-usage-restrictions)
- [Acknowledgment and Source Context](#acknowledgment-and-source-context)

---

## Key Capabilities

- Structured question bank management using `Module → Topic → Question`
- Multiple supported question types:
  - single-choice (`pg`)
  - multiple-choice (`multi`)
  - true/false (`bs`)
  - essay (`essay`)
- Exam configuration with:
  - duration control
  - correct / incorrect / blank scoring
  - exam tokens
  - participant-group restrictions
  - question and answer shuffling
  - required fullscreen mode
  - tab-switch detection / basic anti-cheat protections
- Participant exam sessions with status tracking:
  - pending
  - in progress
  - finished
  - expired
- Manual essay evaluation for admin/operator flows
- Result views, evaluation screens, reports, leaderboard views, and participant monitoring
- SQLite-backed persistence through Prisma
- Realistic shared seed data for local demos, previews, and development

---

## Technology Stack

### Frontend
- [TanStack Start](https://tanstack.com/start)
- React 19
- TypeScript
- Tailwind CSS 4
- Radix UI
- Zustand

### Backend and Persistence
- Prisma
- SQLite
- TanStack server functions

### Tooling
- Vite
- ESLint
- Prettier

---

## Current Architectural Position

This project currently follows a **hybrid transitional architecture**.

- Core CBT data is persisted on the server through **Prisma + SQLite**.
- The UI still relies on a **client-side repository/cache facade** in `src/lib/cbt/repos.ts`.
- Most mutations are handled through **optimistic client updates**, then persisted asynchronously to the server.

In practical terms:
- the system is **no longer localStorage-only** for core business data;
- the system is **not yet fully server-driven on every route**.

This is a deliberate transitional state that preserves the existing interaction model while progressively moving the application toward a more robust server-backed architecture.

---

## Core Domain Model

The current application models include:

- `Group`
- `User`
- `Modul`
- `Topik`
- `Soal`
- `Jawaban`
- `Ujian`
- `TokenUjian`
- `SesiUjian`
- `AppConfig`

Primary schema location:
- `prisma/schema.prisma`

---

## Realistic Demo Seeding

The seeding system has been upgraded so the application can be demonstrated and tested using data that resembles an actual school deployment.

Seed coverage currently includes:
- multiple class groups
- admin, operator, teacher, and student accounts
- Mathematics, Physics, and Biology modules
- realistic topic distribution
- objective and essay questions
- multiple exams with different rules
- active and unused exam tokens
- participant sessions across several states:
  - not started
  - in progress
  - completed
  - graded
  - partially graded essay cases

Shared seed source:
- `src/lib/server/db/seed-shared.mjs`

Prisma seed entry:
- `prisma/seed.mjs`

This design ensures that the CLI seeding path and the server-side seeding path remain aligned over time.

---

## Demo Accounts

> These accounts reflect the current shared seed dataset and may evolve as the project grows.

### Admin
- `admin / admin123`

### Operator
- `operator1 / operator123`

### Teachers
- `guru_mtk / guru123`
- `guru_fisika / guru123`
- `guru_biologi / guru123`

### Students
- `alif.mahendra / peserta123`
- `nayla.putri / peserta123`
- `fajar.ramadhan / peserta123`
- `salma.azzahra / peserta123`
- `rizky.pratama / peserta123`
- `intan.permata / peserta123`
- `bagas.saputra / peserta123`
- `citra.lestari / peserta123`

---

## Getting Started

### 1. Install dependencies

```bash
npm install
```

### 2. Prepare the database

Ensure that `DATABASE_URL` points to a SQLite database.

Relevant configuration:
- `prisma.config.ts`

Run migrations if required:

```bash
npm run prisma:migrate
```

### 3. Seed the database

```bash
npm run prisma:seed
```

### 4. Start the development server

```bash
npm run dev
```

### 5. Build the project

```bash
npm run build
```

---

## Useful Commands

```bash
npm run dev
npm run build
npm run lint
npm run format
npm run prisma:validate
npm run prisma:migrate
npm run prisma:seed
```

Additional route validation:

```bash
node scripts/check-admin-routes.mjs
```

---

## Project Structure

```text
prisma/
  schema.prisma        # Database schema
  seed.mjs             # Prisma seeder entry point

src/
  components/          # UI and CBT-specific components
  lib/
    cbt/               # Types, repos, auth, exam logic
    server/            # Server functions, DB helpers, shared seed logic
  routes/              # TanStack Start file-based routes

scripts/
  check-admin-routes.mjs
```

Key files for understanding the system:
- `src/lib/cbt/repos.ts` — client cache / repository facade
- `src/lib/server/repos/functions.ts` — server persistence bridge
- `src/lib/cbt/exam.ts` — exam session creation and grading logic
- `src/lib/server/db/seed-shared.mjs` — primary realistic demo dataset
- `prisma/schema.prisma` — database model definitions

---

## Application Data Flow

1. The UI hydrates initial state from a server snapshot.
2. That snapshot is loaded into the client-side repository cache.
3. Admin and participant routes read data from the cache layer.
4. When data changes, the client cache is updated first.
5. The mutation is then persisted to SQLite through server functions.

Implications:
- the application feels responsive in the browser;
- the cache can become stale if persistence fails or if another tab/device changes the same records.

---

## Recommended Verification

After major changes, run:

```bash
npm run prisma:validate
npm run prisma:seed
npx tsc --noEmit
node scripts/check-admin-routes.mjs
npm run build
```

---

## Contributing

Please read [`CONTRIBUTING.md`](./CONTRIBUTING.md) before opening a pull request.

In short:
- contributions are welcome;
- contributions must respect the non-commercial nature of this repository;
- contributions should preserve the educational and maintenance-oriented purpose of the project.

---

## License and Usage Restrictions

This repository is licensed under the **mannnrachman Collaborative Non-Commercial Software License 1.0 (`NCU-1.0`)**.

This means, in summary:
- you may study, run, adapt, and improve the software for non-commercial purposes;
- you may not sell the software, resell copies, offer paid hosting, or commercialize it as a product or service without prior written permission.

For the full legal text, see:
- [`LICENSE`](./LICENSE)

---

## Acknowledgment and Source Context

This repository was not created in a vacuum.

It exists because previously available source material helped me substantially. Rather than merely copying it, I chose to invest time in upgrading the application: improving data persistence, strengthening runtime safety, making the seeded environment more realistic, and shaping the codebase into something easier to maintain.

That history matters.

Please respect the spirit of the project:
- acknowledge that it builds upon helpful prior work;
- use it to learn, evaluate, and improve;
- do not repackage or sell it as a commercial product.
