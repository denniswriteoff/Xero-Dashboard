# Quick Setup Guide

## 🚀 Dashboard Setup Complete!

Your Writeoff Dashboard is ready to use. Here's how to get started:

### 1. **Start the Dashboard**
```bash
cd /Users/cheatdreams/dashboard
./start.sh
```

Or manually:
```bash
cd /Users/cheatdreams/dashboard
npm install
npx prisma generate
npm run dev
```

### 2. **Access the Dashboard**
- **URL**: http://localhost:3001
- **Login**: Use the same credentials as your chatbot
- **Database**: Shares the same database as your chatbot

### 3. **Connect Xero**
1. Login to the dashboard
2. Click "Connect Xero" button
3. Authorize the connection in Xero
4. View your financial data!

### 4. **Features Available**
- ✅ **KPI Cards**: Revenue, Expenses, Net Profit, Cash Balance
- ✅ **Expense Breakdown**: Detailed category analysis
- ✅ **Timeframe Toggle**: Switch between MTD and YTD
- ✅ **Export Data**: Download CSV or JSON reports
- ✅ **Responsive Design**: Works on mobile and desktop
- ✅ **Dark Mode**: Matches your chatbot theme

### 5. **Port Configuration**
- **Chatbot**: http://localhost:3000
- **Dashboard**: http://localhost:3001

Both applications share the same database and user authentication.

### 6. **Troubleshooting**
- If you get module errors, run: `npm install`
- If database errors, check your `.env.local` file
- If Xero connection fails, verify your Xero API credentials

### 7. **Production Deployment**
Both applications can be deployed together:
- Use the same database URL
- Use the same environment variables
- Deploy to Vercel, Docker, or your preferred platform

## 🎉 You're All Set!

Your dashboard is now ready to provide real-time financial insights from your Xero data!
