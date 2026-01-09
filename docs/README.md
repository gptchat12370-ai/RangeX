# RangeX - Cybersecurity Training Platform

> **A comprehensive cyber training platform with a modern bluish theme, featuring role-based access control, Q&A challenges, and full environment provisioning.**

![RangeX](https://img.shields.io/badge/RangeX-Cyber%20Training-3b82f6?style=for-the-badge)
![React](https://img.shields.io/badge/React-18-61dafb?style=for-the-badge&logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178c6?style=for-the-badge&logo=typescript)
![Tailwind](https://img.shields.io/badge/Tailwind-4.0-38bdf8?style=for-the-badge&logo=tailwind-css)

## Features

### Core Features
- **Role-Based System**: Solver, Creator, and Admin roles with specific capabilities
- **4-Screen Challenge Flow**: Preview → Launching → Ready Modal → In-Challenge
- **Q&A Model**: MCQ, Short Answer, and Practical Tasks (no flag submissions)
- **Environment Provisioning**: Docker and VM support with auto-install tools
- **Real-time Sessions**: Timer, scoring, and machine management

### Pages & Views
- Dashboard (role-aware)
- Challenges Library with filters
- Challenge Preview Panel
- Launching Screen with progress tracking
- In-Challenge Environment with tabs (Overview, Questions, Servers, Score, Help)
- Playlists and Career Paths
- Events (PvP competitions)
- Leaderboards (global, monthly, weekly)
- Teams

### Technical Stack
- React with TypeScript
- Tailwind CSS with custom cyber theme
- Zustand for state management
- Shadcn/ui components
- Mock API layer
- Responsive design

## Theme

The platform uses a cybersecurity-inspired bluish color scheme with:
- Primary: Blue (#3b82f6)
- Accent: Cyan (#0ea5e9)
- Cyber glow effects and grid patterns
- Dark mode optimized

## Development

### Role Switcher
A dev tool is available in the bottom-right corner to switch between Solver, Creator, and Admin roles for testing.

### Mock Data
Comprehensive seed data includes:
- Introduction to Nmap scenario
- Web Security challenge
- SOC Career Path
- Multiple playlists
- CTF THREAT event
- Leaderboard entries
- Docker images and VM templates catalog

## Structure

The app uses a single-page architecture with view-based routing:
- `/` - Dashboard
- `/challenges` - Browse challenges
- `/challenge-preview/:id` - Challenge details
- `/launching/:id` - Environment setup
- `/in-challenge/:id` - Active challenge session
- `/playlists` - Challenge collections
- `/career-paths` - Structured learning paths
- `/events` - Competitive events
- `/leaderboards` - Rankings

## Key Components

- **Layout**: Top navigation + collapsible sidebar
- **ScenarioCard**: Challenge display with metadata
- **PlaylistCard**: Collection display
- **CommandPalette**: Global search (⌘K)
- **RoleSwitcher**: Dev tool for role testing

## Challenge Flow

1. **Preview**: View challenge details, requirements, environment info
2. **Launching**: Progress bar showing VM provisioning, network setup, tool installation
3. **Ready Modal**: Confirmation before starting
4. **In-Challenge**: Full environment with questions, servers, scoring

## Environment Features

- **Machines**: Attacker/Victim roles, Docker/VM support
- **Access Types**: SSH, RDP, Web
- **Credentials**: Masked passwords with copy-to-clipboard
- **Machine Controls**: Restart, Reset per machine
- **Network Config**: AttackerNet/VictimNet subnets

## Question Types

1. **MCQ**: Multiple choice with shuffle option
2. **Short Answer**: Text validation (exact, regex, lowercase trim)
3. **Practical Task**: Multi-step with partial scoring

## Scoring Policies

- **AllOrNothing**: Full points or zero
- **Partial**: Points per step/attempt
- **Validation**: Instant, OnSubmit, or Deferred
- **Hints**: Optional with penalty points

## Creator Tools

- Scenario wizard with 5 steps
- Environment & provisioning configuration
- Mission editor (rich text with images/tables)
- Question builder with policies
- Preview carousel
- Docker image and VM template selection
- Tools auto-install presets
- Artifact uploads

## Admin Features

- Images Catalog (Docker/VM management)
- User management
- Career Paths CRUD
- Moderation queue
- Audit log
- Analytics dashboard

## 🚀 Quick Start

### The app is ready to explore! Here's how to navigate:

#### 🔵 **As a Solver** (Default)
1. **Profile & Notifications** - Click avatar (top-right) for Account page, bell icon for notifications
2. **Browse Challenges** - Click "Challenges" in sidebar
3. **Try the Full Flow** - Select "Introduction to Nmap" → Click "Start" → Experience all 4 screens
4. **Explore**:
   - Career Paths - Structured learning journeys
   - Playlists - Curated collections
   - Events - Competitive challenges
   - Teams - Join or create teams
   - Leaderboards - See rankings

#### 🟣 **As a Creator** (Switch role using bottom-right switcher)
1. **Create Scenarios** - Click "Create Scenario" in the Creator Tools section
2. **Manage Content** - Click "My Scenarios" to view/edit your challenges
3. **5-Step Wizard**: Overview → Environment → Mission → Questions → Preview & Publish

#### 🔴 **As an Admin** (Switch role using bottom-right switcher)
1. **Admin Console** - User management, analytics, audit logs
2. **Images Catalog** - Manage Docker images and VM templates
3. **Full platform oversight**

### 📍 **Navigation Tips**
- **Sidebar**: All main pages (auto-hides on mobile)
- **Top Bar**: Search (⌘K), Notifications (bell icon), Profile (avatar)
- **Role Switcher**: Bottom-right corner - switch between roles instantly

## 📖 Documentation

- **[FEATURES.md](./FEATURES.md)** - Complete feature list and capabilities
- **[Attributions.md](./Attributions.md)** - Third-party resources and credits

## 🎯 Key Highlights

- ✅ Complete 4-screen challenge flow (Preview → Launching → Ready → In-Challenge)
- ✅ Q&A-based challenges (MCQ, Short Answer, Practical Tasks)
- ✅ Docker & VM environment provisioning
- ✅ 5-step Creator Wizard with machine topology builder
- ✅ Admin console with Images Catalog
- ✅ Real-time scoring and timer
- ✅ Leaderboards (global, monthly, weekly)
- ✅ Teams, Events, Career Paths, Playlists
- ✅ Role-based access control (Solver/Creator/Admin)

## 🏗️ Project Structure

```
/
├── components/         # Reusable UI components
│   ├── ui/            # Shadcn/ui components
│   ├── Layout.tsx     # Main layout wrapper
│   ├── Sidebar.tsx    # Navigation sidebar
│   └── ...
├── pages/             # Application pages
│   ├── creator/       # Creator tools
│   ├── admin/         # Admin pages
│   └── ...
├── lib/               # Utilities and APIs
│   ├── api.ts         # Mock API layer
│   ├── seed.ts        # Sample data
│   ├── store.ts       # Zustand state management
│   └── utils.ts       # Helper functions
├── types.ts           # TypeScript definitions
└── App.tsx            # Main application component
```

## 🎨 Technology Stack

- **React 18** - UI framework
- **TypeScript** - Type safety
- **Tailwind CSS 4.0** - Styling with cyber theme
- **Shadcn/ui** - Component library
- **Zustand** - State management
- **Lucide React** - Icon library
- **Sonner** - Toast notifications

## 🔧 Customization

### Theme Colors
Edit `/styles/globals.css` to customize the bluish cyber theme:
- `--primary`: Main brand color (blue)
- `--accent`: Secondary accent (cyan)
- `--cyber-glow`: Glow effect color

### Seed Data
Edit `/lib/seed.ts` to:
- Add more scenarios
- Create additional users
- Configure default playlists
- Set up sample events

### Mock API
Extend `/lib/api.ts` to:
- Add new endpoints
- Modify response delays
- Customize validation logic

Made with ❤️ for the cybersecurity community
