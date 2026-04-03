# LION's MARKET POS

LION's MARKET POS is a `Node.js` point-of-sale system designed around the student-project structure in the reference document. The app uses a three-tier layout:

- Presentation layer: HTML, CSS, and JavaScript in `public/`
- Application layer: Express routes and POS business logic in `server/`
- Data layer: PostgreSQL tables for `users`, `products`, `customers`, `sales`, `sale_items`, `inventory`, and `payments`

The intended production database is Supabase PostgreSQL. A local mock mode is still available for quick UI work when you do not want to hit the live database.

## Stack

- `Node.js` with `Express`
- `Supabase PostgreSQL` for persistent storage
- Plain `HTML`, `CSS`, and `JavaScript` on the client

## Features

- Server-backed login with session cookies
- Role-based access for Admin, Manager, and Cashier users
- Product management with create, edit, and delete
- Customer management with purchase history
- Inventory table with stock adjustments, low-stock checks, and audit logs
- Checkout flow with receipt generation
- Paystack card and mobile-money payments with server-side verification
- Recent sales view and receipt lookup
- Sales and performance reports

## Project Structure

- `public/`: frontend assets served by Express
- `server/`: backend routes, auth helpers, config, and POS logic
- `db/schema.sql`: Supabase/PostgreSQL schema
- `scripts/setup-db.js`: schema setup and seed script

## Setup

### Supabase mode

1. Open your Supabase project and copy the PostgreSQL pooler connection string from the database connection settings.
2. Copy the environment file:

```bash
cp .env.example .env
```

3. Edit `.env`:

```env
PORT=3000
MOCK_MODE=false
DATABASE_URL=YOUR_SUPABASE_POOLER_CONNECTION_STRING
PAYSTACK_PUBLIC_KEY=pk_test_your_public_key
PAYSTACK_SECRET_KEY=sk_test_your_secret_key
PAYSTACK_CURRENCY=GHS
```

4. Install dependencies:

```bash
npm install
```

5. Create the schema and seed the Supabase database:

```bash
npm run db:setup
```

6. Start the app:

```bash
npm run dev
```

7. Open `http://localhost:3000`

### Paystack checkout

To accept live or test online payments in the POS with Paystack:

1. Create a Paystack merchant account and obtain your public and secret keys
2. Add them to `.env` as `PAYSTACK_PUBLIC_KEY` and `PAYSTACK_SECRET_KEY`
3. Leave `PAYSTACK_CURRENCY=GHS` unless you configured another checkout currency in Paystack
4. Restart the app after changing `.env`

Card and `Mobile Money` checkouts now open Paystack in a secure popup. The POS verifies the returned transaction reference with Paystack before the sale is committed to the database, and the cashier no longer needs to collect a customer email at checkout.

The database schema follows the student-project document and persists the main POS entities in these core tables:

- `users`
- `products`
- `customers`
- `sales`
- `sale_items`
- `inventory`
- `payments`

### Local mock mode

The fastest way to work on the UI locally is still the seeded in-memory mode. This does not require Supabase or PostgreSQL.

1. Make sure `.env` contains `MOCK_MODE=true`
2. Install dependencies with `npm install`
3. Start the app with `npm run dev`
4. Open `http://localhost:3000`

Seeded logins:

- `admin` / `admin123`
- `manager` / `manager123`
- `cashier` / `cashier123`

Mock mode keeps data only while the server is running. Restarting the server resets it back to the seeded demo data.

## Seeded Login Accounts

- `admin` / `admin123`
- `manager` / `manager123`
- `cashier` / `cashier123`

## Useful Commands

- `npm run dev`: start the server in watch mode
- `npm start`: start the server normally
- `npm run db:setup`: create schema and seed if the database is empty
- `npm run db:reset`: clear and reseed the database
