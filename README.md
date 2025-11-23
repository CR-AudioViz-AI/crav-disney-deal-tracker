# Disney Deal Tracker

**Session Created: 2025-11-23 11:10:57 EST**

A personal Disney World resort deal tracker and price monitoring dashboard. Built for passholders to easily monitor deals, discounts, and special offers across all Disney resorts and partner hotels.

## ✨ Features

### 📅 Interactive Deal Calendar
- **Month View**: Full calendar grid with deals visible by date
- **Week View**: Detailed week layout with deal breakdowns
- **Year View**: Heat map overview showing deal density by month
- **Color-Coded Quality**: Visual indicators for deal quality (Excellent/Great/Good/Standard)
- **Click to Explore**: Click any date to see full list of deals

### 🎯 Smart Filtering & Search
- Search by check-in/check-out dates
- Filter by resort type (Value/Moderate/Deluxe/Villa/Partner)
- Filter by deal type (Room Discount/Free Dining/Upgrades)
- Minimum discount percentage filtering
- Passholder-exclusive deals highlighting

### 🔔 Price Alerts (Coming Soon)
- Set custom alerts for specific date ranges
- Email/push notifications when deals match criteria
- Price drop tracking
- Deal expiration reminders

### 📊 Deal Monitoring
- **Best Deal Today**: Highlights the highest discount currently available
- **Expiring Soon**: Shows deals ending within 7 days
- **New This Week**: Latest deals added to the system
- **Historical Pricing**: Track price trends over time

### 🏨 Resort Coverage
- All Disney Value Resorts (Pop Century, Art of Animation, All-Stars)
- All Disney Moderate Resorts (Caribbean Beach, Coronado Springs, Port Orleans)
- All Disney Deluxe Resorts (Grand Floridian, Contemporary, Polynesian, etc.)
- Disney Villa Resorts (Saratoga Springs, Old Key West, Riviera)
- Partner Hotels (via aggregator APIs)

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ installed
- Supabase account (free tier works)
- Git installed

### Installation

1. **Clone the repository**
```bash
git clone https://github.com/your-username/crav-disney-deal-tracker.git
cd crav-disney-deal-tracker
```

2. **Install dependencies**
```bash
npm install
```

3. **Set up Supabase**
   - Create a new project at [supabase.com](https://supabase.com)
   - Run the migration file: `supabase/migrations/20251123_initial_schema.sql`
   - Get your project URL and anon key from Settings > API

4. **Configure environment variables**
```bash
cp .env.example .env.local
```

Edit `.env.local` with your values:
```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

5. **Run the development server**
```bash
npm run dev
```

6. **Open your browser**
Navigate to [http://localhost:3000](http://localhost:3000)

## 📦 Deployment (Vercel)

### One-Click Deploy
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/your-username/crav-disney-deal-tracker)

### Manual Deploy
1. Push code to GitHub
2. Import project in Vercel
3. Add environment variables in Vercel dashboard
4. Deploy!

### Cron Jobs Setup
The app uses Vercel Cron Jobs to automatically aggregate deals:
- Runs every hour to check for new deals
- Refreshes calendar cache
- Updates price history

Configure in `vercel.json`.

## 🛠️ Technology Stack

- **Frontend**: Next.js 14 (App Router), React 18, TypeScript
- **Styling**: Tailwind CSS, Custom Disney theme
- **Database**: Supabase (PostgreSQL)
- **Deployment**: Vercel
- **Date Handling**: date-fns
- **Charts**: Recharts
- **Icons**: Lucide React

## 📁 Project Structure

```
crav-disney-deal-tracker/
├── app/                    # Next.js App Router pages
│   ├── page.tsx           # Main dashboard with calendar
│   ├── deals/             # All deals list page
│   ├── alerts/            # Alert management page
│   └── api/               # API routes
├── components/
│   ├── calendar/          # Calendar components
│   ├── deals/             # Deal display components
│   ├── layout/            # Layout components
│   └── common/            # Reusable components
├── lib/
│   ├── aggregators/       # Deal source scrapers
│   ├── supabase/          # Database clients
│   └── types/             # TypeScript types
├── supabase/
│   └── migrations/        # Database schema
└── public/                # Static assets
```

## 🔄 Deal Aggregation

The system monitors multiple sources for Disney deals:

### Monitored Sources
1. **Disney Parks Blog** (RSS Feed)
2. **Disney Special Offers Page** (Public website)
3. **MouseSavers** (Community deal site)
4. **Reddit r/WaltDisneyWorld** (Hot posts via API)
5. **Manual Email Forwarding** (Forward Disney promotional emails)

### How It Works
1. Cron job runs every hour
2. Checks all active deal sources
3. Parses new deals and updates database
4. Refreshes calendar cache for fast loading
5. Matches deals against user alerts
6. Sends notifications if enabled

### Adding New Deal Sources
See `lib/aggregators/` for existing scrapers. To add a new source:
1. Create a new scraper in `lib/aggregators/sources/`
2. Implement the `DealAggregator` interface
3. Add to `run-all.ts`
4. Update `deal_sources` table

## 🎨 Customization

### Theme Colors
Edit `tailwind.config.js` to customize the Disney-inspired color palette:
- `disney.blue`: Primary Disney blue
- `deal.excellent`: 30%+ discount color (red)
- `deal.great`: 20-29% discount color (orange)
- etc.

### Deal Quality Thresholds
Edit the `calculateDealQuality` function in `lib/utils/deals.ts`:
```typescript
// Current thresholds:
// Excellent: 30%+
// Great: 20-29%
// Good: 10-19%
// Standard: <10%
```

## 📊 Database Schema

### Core Tables
- **resorts**: Disney resorts and partner hotels
- **deals**: All discovered deals with validity dates
- **deal_calendar_cache**: Pre-computed calendar data for fast rendering
- **price_history**: Historical pricing for trend analysis
- **user_alerts**: Custom alert configurations
- **deal_sources**: External sources being monitored

See `supabase/migrations/20251123_initial_schema.sql` for full schema.

## 🔐 Security & Privacy

- **Private Use**: Not indexed by search engines (robots.txt)
- **Roy-Only Access**: No authentication currently (personal use)
- **Secure Headers**: HSTS, XSS protection, frame options
- **Environment Variables**: Sensitive data in .env files
- **RLS Policies**: Row-level security on Supabase tables

## 📈 Roadmap

### Phase 1: Core Features (Current)
- ✅ Interactive calendar with deal display
- ✅ Deal aggregation from multiple sources
- ✅ Database schema and API
- ✅ Responsive design

### Phase 2: Enhanced Features
- ⏳ User alerts system with email notifications
- ⏳ Historical price charts
- ⏳ Deal comparison tool
- ⏳ Export deals to calendar (iCal)

### Phase 3: Advanced Features
- 🔮 Machine learning price predictions
- 🔮 Deal quality scoring algorithm
- 🔮 Partner hotel API integration
- 🔮 Mobile app (React Native)

## 🤝 Contributing

This is a personal project, but suggestions are welcome!

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## 📝 License

This project is for personal use only. Not affiliated with Disney. All Disney trademarks belong to The Walt Disney Company.

## 🙏 Acknowledgments

- **Disney**: For creating magical vacations
- **MouseSavers**: Community deal tracking inspiration
- **Supabase**: Amazing backend platform
- **Vercel**: Seamless deployment

## 💬 Support

For issues or questions:
- Open an issue on GitHub
- Contact: Roy @ CR AudioViz AI, LLC

---

**Built with ❤️ for Disney passholders**

Session: 2025-11-23 11:10:57 EST
