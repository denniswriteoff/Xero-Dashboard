# Writeoff Dashboard

A financial dashboard application that integrates with Xero API to provide real-time financial insights for small businesses. Built with Next.js, TypeScript, and Tailwind CSS.

## Features

- **Real-time Financial Data**: Fetches P&L and Balance Sheet data from Xero API
- **KPI Dashboard**: Revenue, Expenses, Net Profit, Cash Balance, and Net Margin
- **Expense Breakdown**: Detailed breakdown of operating expenses by category
- **Timeframe Toggle**: Switch between Month-to-Date (MTD) and Year-to-Date (YTD) views
- **Export Functionality**: Export financial data as CSV or JSON
- **Responsive Design**: Clean, modern UI that works on desktop and mobile
- **Dark/Light Mode**: Matches the chatbot website's black and white theme
- **Shared Database**: Uses the same database and user authentication as the chatbot

## Tech Stack

- **Framework**: Next.js 14 with App Router
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Database**: PostgreSQL with Prisma
- **Authentication**: NextAuth.js
- **API Integration**: Xero API
- **Charts**: Recharts (for future chart implementations)

## Getting Started

### Prerequisites

- Node.js 18+ 
- PostgreSQL database
- Xero Developer Account

### Installation

1. **Clone and navigate to the dashboard directory**:
   ```bash
   cd /Users/cheatdreams/dashboard
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Set up environment variables**:
   ```bash
   cp .env.example .env.local
   ```
   
   Fill in your environment variables:
   ```env
   # Database (same as chatbot)
   DATABASE_URL="postgresql://username:password@localhost:5432/writeoff_db"
   
   # NextAuth (same as chatbot)
   NEXTAUTH_SECRET="your-secret-key"
   NEXTAUTH_URL="http://localhost:3000"
   
   # Xero API
   XERO_CLIENT_ID="your-xero-client-id"
   XERO_CLIENT_SECRET="your-xero-client-secret"
   XERO_REDIRECT_URI="http://localhost:3000/api/xero/callback"
   ```

4. **Set up the database**:
   ```bash
   npx prisma generate
   npx prisma db push
   ```

5. **Run the development server**:
   ```bash
   npm run dev
   ```

6. **Open your browser**:
   Navigate to [http://localhost:3000](http://localhost:3000)

## Database Schema

The dashboard shares the same database schema as the chatbot application:

- **Users**: User authentication and profile data
- **XeroTokens**: Xero API tokens for each user/tenant
- **Conversations**: Chat conversations (from chatbot)
- **Messages**: Chat messages (from chatbot)
- **Widgets**: Dashboard widgets (from chatbot)

## API Endpoints

### Authentication
- `GET /api/auth/[...nextauth]` - NextAuth.js authentication

### Xero Integration
- `GET /api/xero/connect` - Get Xero authorization URL
- `GET /api/xero/callback` - Handle Xero OAuth callback

### Dashboard Data
- `GET /api/dashboard/data` - Fetch financial data from Xero
- `GET /api/dashboard/export` - Export data as CSV or JSON

## Key Components

### Dashboard Page (`app/page.tsx`)
- Main dashboard interface
- KPI cards showing key financial metrics
- Expense breakdown with progress bars
- Timeframe toggle (MTD/YTD)
- Export functionality

### Authentication (`app/login/page.tsx`)
- User login form
- Matches the chatbot's authentication system

### API Routes
- **Data fetching**: Retrieves P&L and Balance Sheet data from Xero
- **Export functionality**: Generates CSV and JSON exports
- **Xero integration**: Handles OAuth flow and token management

## Xero Integration

The dashboard integrates with Xero API to fetch:

1. **Profit & Loss Report**: Revenue, expenses, and net profit
2. **Balance Sheet**: Cash balance and other assets
3. **Expense Categories**: Detailed breakdown of operating expenses

### Required Xero Scopes
- `accounting.transactions`
- `accounting.contacts`
- `accounting.settings`
- `accounting.reports.read`
- `offline_access`

## Design System

The dashboard uses the same design system as the chatbot:

- **Colors**: Black and white theme with dark mode support
- **Typography**: Clean, readable fonts
- **Layout**: Card-based layout with consistent spacing
- **Icons**: Lucide React icons
- **Responsive**: Mobile-first design

## Deployment

The dashboard can be deployed alongside the chatbot application:

1. **Vercel**: Deploy to Vercel with the same environment variables
2. **Docker**: Use the same Docker setup as the chatbot
3. **Shared Database**: Both applications use the same PostgreSQL database

## Development

### Adding New Features

1. **New API endpoints**: Add to `app/api/` directory
2. **New components**: Add to `app/components/` directory
3. **Database changes**: Update `prisma/schema.prisma` and run migrations

### Testing

```bash
npm run lint
npm run build
```

## Contributing

1. Follow the same coding standards as the chatbot
2. Use TypeScript for type safety
3. Follow the existing design patterns
4. Test with real Xero data

## License

Same license as the main chatbot application.
