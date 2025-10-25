# Padel Pal

A modern padel session management application built with TanStack Start and Supabase authentication.

## Features

- 🔐 **Phone-based Authentication** - Secure login using phone numbers and OTP verification
- 🏓 **Session Management** - Create and manage padel sessions with time slots and player levels
- 👥 **Player Matching** - Vote for time slots and get matched with other players
- 📱 **Responsive Design** - Works seamlessly on desktop and mobile devices
- 🌙 **Dark Mode** - Built-in theme switching support

## Tech Stack

- **Frontend**: TanStack Start (React), TypeScript, Tailwind CSS
- **Authentication**: Supabase Auth with phone OTP
- **Database**: Supabase (PostgreSQL)
- **UI Components**: Radix UI + shadcn/ui
- **State Management**: TanStack Query
- **Routing**: TanStack Router

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn
- Supabase account and project

### Environment Setup

1. Create a `.env` file in the root directory with the following variables:

```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
VITE_SUPABASE_PRIVATE_KEY=your_supabase_service_role_key
```

2. Get these values from your Supabase project dashboard:
   - Go to Settings → API
   - Copy the Project URL for `VITE_SUPABASE_URL`
   - Copy the anon/public key for `VITE_SUPABASE_ANON_KEY`
   - Copy the service_role key for `VITE_SUPABASE_PRIVATE_KEY`

### Supabase Setup

1. Enable phone authentication in your Supabase project:
   - Go to Authentication → Settings
   - Enable "Phone" provider
   - Configure your SMS provider (Twilio, etc.)

2. Set up your database schema (if needed)

### Installation

```bash
# Install dependencies
npm install

# Start development server
npm run dev
```

The application will be available at `http://localhost:3000`

## Authentication Flow

The app uses Supabase's phone authentication:

1. **Phone Input**: Users enter their phone number
2. **OTP Verification**: Supabase sends an SMS with a 6-digit code
3. **Session Creation**: Upon successful verification, a user session is created
4. **Protected Routes**: Authenticated users can access session management features

## Project Structure

```
src/
├── components/          # Reusable UI components
│   ├── ui/             # shadcn/ui components
│   ├── login-form.tsx  # Phone number input form
│   ├── otp-form.tsx    # OTP verification form
│   └── protected-route.tsx # Route protection wrapper
├── contexts/           # React contexts
│   └── auth-context.tsx # Authentication state management
├── routes/             # Application routes
│   ├── login.tsx       # Authentication pages
│   ├── sessions/       # Session management pages
│   └── index.tsx       # Home page
└── utils/              # Utilities and configurations
    ├── supabase.ts     # Supabase client setup
    └── types.ts        # TypeScript type definitions
```

## Development

### Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run deploy` - Deploy to Cloudflare Workers

### Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

This project is licensed under the MIT License.
