# Deep Pick - Sports Prediction Platform

A data-driven sports prediction platform for betting, fantasy sports, and daily fantasy platforms like DraftKings Pick 6 and PrizePicks.

## 🚀 Features

- **Sports Betting Picks**: Moneyline, spread, over/under predictions
- **Fantasy Sports**: Start/sit recommendations, player performance predictions  
- **Daily Fantasy**: DraftKings Pick 6, PrizePicks, and similar platform picks
- **Automated Grading**: Real-time result tracking and pick validation
- **Performance Analytics**: Unit tracking, ROI calculation, and historical analysis
- **ICO-Themed UI**: Dark interface with neon accents and heartbeat monitor visualizations
- **Real-time Updates**: Live pick generation and performance tracking

## 🛠 Tech Stack

### Frontend
- **Framework**: Next.js 14 (App Router) with TypeScript
- **Styling**: Tailwind CSS + Custom ICO theme
- **UI Components**: Radix UI + Custom components
- **State Management**: Zustand + React Query
- **Charts**: Recharts + Custom D3.js visualizations
- **Real-time**: Supabase Realtime subscriptions

### Backend
- **Database**: Supabase (PostgreSQL + Auth + Storage)
- **API**: Next.js API routes + Supabase Edge Functions
- **Background Jobs**: Supabase Edge Functions + pg_cron
- **Caching**: Redis (via Upstash on Vercel)
- **File Storage**: Supabase Storage

### DevOps
- **Hosting**: Vercel (Frontend + API)
- **CI/CD**: GitHub Actions
- **Monitoring**: Vercel Analytics + Sentry
- **Environment**: Multiple environments (dev, staging, prod)

## 📦 Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/deep-pick.git
   cd deep-pick
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp env.example .env.local
   ```
   
   Fill in your environment variables:
   - `NEXT_PUBLIC_SUPABASE_URL`: Your Supabase project URL
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Your Supabase anon key
   - `SUPABASE_SERVICE_ROLE_KEY`: Your Supabase service role key
   - `SPORTS_DATA_API_KEY`: Your sports data API key
   - `THE_ODDS_API_KEY`: Your odds API key
   - `REDIS_URL`: Your Redis URL (Upstash)

4. **Set up Supabase**
   ```bash
   # Install Supabase CLI
   npm install -g supabase
   
   # Start local Supabase
   supabase start
   
   # Run migrations
   supabase db push
   ```

5. **Start development server**
   ```bash
   npm run dev
   ```

## 🗄 Database Schema

The application uses PostgreSQL with the following main tables:

- `users` - User accounts and preferences
- `picks` - Generated predictions with metadata
- `games` - Sports games and matchups
- `pick_results` - Pick validation and scoring
- `performance_metrics` - Historical performance data
- `notifications` - User notifications
- `teams` - Sports teams data

## 🔧 Development

### Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint
- `npm run type-check` - Run TypeScript type checking
- `npm test` - Run tests
- `npm run db:generate` - Generate TypeScript types from Supabase
- `npm run db:reset` - Reset local database
- `npm run db:migrate` - Run database migrations

### Project Structure

```
src/
├── app/                    # Next.js App Router pages
├── components/             # React components
│   ├── ui/                # Reusable UI components
│   ├── auth/              # Authentication components
│   └── theme/             # Theme provider
├── lib/                   # Utility libraries
│   ├── supabase/          # Supabase client configuration
│   ├── api-client.ts      # API client
│   ├── utils.ts           # Utility functions
│   └── validations.ts     # Zod validation schemas
├── hooks/                 # Custom React hooks
├── store/                 # Zustand stores
├── types/                 # TypeScript type definitions
└── utils/                 # Additional utilities
```

## 🚀 Deployment

### Vercel Deployment

1. **Connect to Vercel**
   - Import your GitHub repository to Vercel
   - Configure environment variables in Vercel dashboard

2. **Set up Supabase**
   - Create a new Supabase project
   - Run migrations: `supabase db push`
   - Configure RLS policies

3. **Deploy**
   - Push to main branch triggers automatic deployment
   - Monitor deployment in Vercel dashboard

### Environment Variables

Required environment variables for production:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
SPORTS_DATA_API_KEY=your_sports_data_api_key
THE_ODDS_API_KEY=your_odds_api_key
REDIS_URL=your_redis_url
SENTRY_DSN=your_sentry_dsn
```

## 📊 API Integration

The platform integrates with various sports data APIs:

- **The Odds API**: Sports odds and betting lines
- **Sports Reference**: Historical data and statistics
- **ESPN API**: Game results and player stats
- **Weather APIs**: Environmental factors
- **DraftKings/PrizePicks**: Daily fantasy data

## 🎨 UI/UX Design

### ICO Theme Elements
- Dark background with neon green/blue accents
- Glowing borders and hover effects
- Monospace fonts for data display
- Grid-based layout with card components
- Animated charts resembling EKG/heartbeat monitors

### Key Screens
1. **Dashboard**: Live picks, performance overview, unit tracking
2. **Pick Generator**: Create new predictions with filters
3. **Results Tracker**: Real-time grading and performance
4. **Analytics**: Historical performance and trends
5. **Settings**: User preferences and betting units

## 🔮 Future Enhancements

- **Crypto/Stock Predictions**: Expand to financial markets
- **Machine Learning**: Advanced prediction algorithms
- **Social Features**: User rankings and community picks
- **Mobile App**: React Native or Flutter implementation
- **API Access**: Third-party integration capabilities

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit your changes: `git commit -m 'Add amazing feature'`
4. Push to the branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

For support, email support@deeppick.app or join our Discord community.

## 🙏 Acknowledgments

- Supabase for the backend infrastructure
- Vercel for hosting and deployment
- Radix UI for accessible components
- The sports data API providers
