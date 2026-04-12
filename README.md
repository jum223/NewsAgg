# The Digestino

An AI-powered newsletter aggregator that connects to your Gmail, reads newsletters from sources you specify, and uses Claude Haiku to curate a single, beautiful daily digest.

## Features

- **Gmail Integration** — Automatically pulls newsletters from your inbox
- **AI Curation** — Claude Haiku selects the most relevant stories and removes duplicates
- **Smart Limits** — Up to 4 top stories, 4 quick hits, and 3 visuals (only what's worth reading)
- **Source Attribution** — Every piece shows where it came from
- **Daily Schedule** — Auto-curates at 8 PM Eastern, or refresh manually anytime
- **Weekly Review** — Sunday digest of the top 5 stories that mattered this week
- **Email Delivery** — Daily and weekly digests sent directly to your inbox via Resend
- **Digest History** — Browse past digests with version tracking

## Prerequisites

1. **Node.js** (v18 or higher)
2. **Google Cloud Project** with Gmail API enabled
3. **Anthropic API Key** for Claude Haiku

## Setup

### 1. Google Cloud (Gmail API)

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a project (or use existing)
3. Enable the **Gmail API**
4. Go to **Credentials** → Create **OAuth 2.0 Client ID**
   - Application type: **Web application**
   - Authorized redirect URI: `http://localhost:3001/auth/google/callback`
5. Copy the Client ID and Client Secret

### 2. Anthropic API Key

1. Go to [console.anthropic.com](https://console.anthropic.com/)
2. Create an API key
3. Claude Haiku is very affordable (~$0.001 per newsletter curation)

### 3. Configure & Run

```bash
# Clone / enter the project
cd "Newsletter Aggregator"

# Copy env file and fill in your keys
cp .env.example .env
# Edit .env with your actual keys

# Install all dependencies
npm run setup

# Start both server and client
npm run dev
```

The app will be available at **http://localhost:5173**

### 4. First Run

1. Click **Setup** → Connect Gmail
2. Authorize the app to read your emails
3. Go to **Sources** → Add newsletter sender emails
4. Hit **Refresh** to fetch and curate your first digest!

## Project Structure

```
├── server/
│   ├── index.js          # Express API server + cron jobs
│   ├── gmail.js          # Gmail API integration
│   ├── parser.js         # Newsletter HTML parser
│   ├── curator.js        # Claude Haiku daily curation
│   ├── weeklyCurator.js  # Claude Haiku weekly synthesis
│   ├── emailer.js        # Resend email delivery
│   └── database.js       # SQLite database layer
├── client/
│   ├── src/
│   │   ├── App.jsx           # Main app component
│   │   ├── components/
│   │   │   ├── Logo.jsx          # The Digestino SVG logo
│   │   │   ├── Header.jsx        # Navigation header
│   │   │   ├── SetupGuide.jsx    # First-run setup wizard
│   │   │   ├── SourceManager.jsx # Add/remove newsletter sources
│   │   │   ├── DigestView.jsx    # Main digest reader
│   │   │   ├── DigestHistory.jsx # Past digests browser
│   │   │   └── WeeklyDigestView.jsx # Week in Review
│   │   └── styles/
│   │       └── app.css           # Full stylesheet
│   └── vite.config.js
├── .env.example
└── package.json
```

## Tech Stack

- **Frontend**: React 18 + Vite + Lucide Icons
- **Backend**: Node.js + Express
- **Database**: SQLite (via better-sqlite3)
- **Email**: Gmail API (OAuth 2.0) + Resend (delivery)
- **AI**: Claude Haiku (Anthropic SDK)
- **Scheduling**: node-cron (daily 8 PM ET, weekly Sunday 9 AM ET)
- **Deployment**: Railway
