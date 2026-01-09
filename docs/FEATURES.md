# RangeX - Complete Feature List

## 🎨 Design Theme
- **Cyber-inspired bluish color scheme**
  - Primary: Blue (#3b82f6)
  - Accent: Cyan (#0ea5e9)
  - Custom cyber-glow effects
  - Grid pattern backgrounds
  - Dark mode optimized
- Responsive design for desktop and mobile
- Smooth animations and transitions

## 👥 Role-Based Access Control

### Solver (Default User)
- Browse and start challenges
- Track progress and scores
- Earn badges and points
- Follow playlists and career paths
- Join teams and events
- View leaderboards

### Creator
- All Solver capabilities
- **Create Scenario Wizard** (5-step process):
  1. Overview - Basic info, tags, difficulty, duration
  2. Environment - Machine topology, Docker/VM selection, tools auto-install
  3. Mission & Rules - Rich text editor, code of ethics, lab credentials
  4. Questions - MCQ/Short Answer/Practical tasks with policies
  5. Preview & Publish - Review and publish
- Manage scenarios (drafts, published)
- Host events
- View analytics

### Admin
- All Solver and Creator capabilities
- User management (role changes, MFA toggle)
- **Images Catalog** - Manage Docker images and VM templates
- Career Paths CRUD
- Moderation queue
- Audit log access
- Platform analytics

## 🎯 Challenge System

### 4-Screen Challenge Flow
1. **Preview Panel** - Challenge details, requirements, meta info
2. **Launching Screen** - Progress bar, mission preview, loading states
3. **Ready Modal** - Confirmation before starting
4. **In-Challenge Environment** - Full interactive workspace

### Question Types
- **MCQ** - Multiple choice with shuffle option
- **Short Answer** - Text validation (exact, regex, lowercase)
- **Practical Task** - Multi-step with per-step scoring

### Policies
- **Validation**: Instant, OnSubmit, Deferred
- **Scoring**: AllOrNothing, Partial
- **Hints**: Disabled, ShowOnRequest, TimedUnlock
- **Attempts**: Unlimited, Limited

## 🖥️ Environment Provisioning

### Machine Types
- **Docker Containers**
  - Image catalog selection (Ubuntu, Kali, Python, Node, Nginx)
  - Custom tags and versions
  - Port exposure
  - Environment variables
  - Volume mounting
  - Security options (cap-drop, read-only root)

- **Virtual Machines**
  - Template catalog (Kali 2024.2, Ubuntu 22.04, Windows Server 2022, Rocky 9)
  - CPU/RAM/Disk configuration
  - Network topology (AttackerNet/VictimNet)
  - Access controls

### Tools Auto-Install
- **Linux Presets**: nmap, wireshark-cli, tcpdump, curl, git, python3-pip, docker-cli, metasploit
- **Windows Presets**: Nmap, Wireshark, Sysinternals, 7zip, Chrome
- Custom package lists
- Provisioning scripts (Cloud-Init, Shell, PowerShell)

### Artifact Uploads
- File upload to machines
- Destination path configuration
- Overwrite controls
- chmod +x option
- Checksum verification

## 📚 Content Organization

### Career Paths
- Structured learning journeys
- SOC Career Path (pre-configured)
- Multiple scenarios in sequence
- Progress tracking

### Playlists
- Curated challenge collections
- Public/private options
- Follow/unfollow
- Rating system

### Events (PvP)
- Player vs Player competitions
- Schedule or live start
- Min/max participants
- Team swapping options
- Join policies (Auto/RequireApproval/AllowLateJoin)
- Privacy controls (Visible/PasswordProtected)
- Server reset options
- Answer feedback hiding
- Community events

## 🏆 Gamification

### Points System
- Per-question scoring
- Partial credit support
- Hint penalties
- Streak bonuses

### Badges
- Achievement system
- Earned through milestones
- Display on profile

### Leaderboards
- **Global rankings**
- **Monthly rankings**
- **Weekly rankings**
- Sort by:
  - Total points
  - Streaks
  - Average completion time
- Podium display for top 3

## 👥 Teams

### Features
- Create or join teams
- Team profiles with:
  - Name and motto
  - Country
  - Description
  - Member list
- Open/closed teams
- Registration controls
- Team avatars

## 🔍 Search & Discovery

### Command Palette (⌘K)
- Global search
- Quick navigation
- Find challenges, playlists, events, teams

### Filters
- Mode (Single/Multi)
- Type (Open Range/Cyber Challenge)
- Difficulty (Easy/Intermediate/Hard/Impossible)
- Category (15+ categories)
- Tags
- Author
- Duration range
- Rating
- Followers count

## 🛠️ In-Challenge Features

### Interface Tabs
1. **Overview** - Mission and rules
2. **Questions** - All Q&A challenges
3. **Servers** - Machine management
4. **Score** - Progress breakdown
5. **Help** - Resources and hints

### Machine Controls
- **Access**: SSH, RDP, Web
- **Credentials**: Masked passwords, copy-to-clipboard
- **Actions**: Restart, Reset per machine
- **Status**: Running, Stopped, Restarting
- **solverCanAccess**: Visibility control

### Timer & Scoring
- Live countdown timer
- Real-time score updates
- Progress percentage
- Question-by-question breakdown

### Exit Options
- **Exit & Keep Running** - Pause and resume later
- **Exit & Terminate** - End session completely

## 📊 Analytics

### Admin Analytics
- Daily/Monthly Active Users (DAU/MAU)
- Active sessions count
- Average runtime
- Top categories
- Completion rates

### Creator Analytics
- Views → Starts → Completes funnel
- Average score per challenge
- Average completion time
- Hardest questions (lowest success rate)

## 🔐 Security Features

### Authentication
- Multi-factor authentication (MFA)
- Password management
- Session management

### Authorization
- Role-based access control (RBAC)
- Resource-level permissions
- Audit logging

### Environment Security
- Docker security options
- Network isolation
- Egress controls
- IMDS blocking
- TTL auto-teardown

## 📱 Responsive Design
- Mobile-optimized layouts
- Collapsible sidebar
- Touch-friendly controls
- Adaptive grid systems

## 🎨 UI Components

### Cards
- ScenarioCard - Challenge display
- PlaylistCard - Collection display
- EventCard - Event listings
- TeamCard - Team profiles

### Navigation
- Sidebar with role-based items
- Top navigation bar
- Breadcrumbs
- Command palette

### Feedback
- Toast notifications
- Loading skeletons
- Empty states
- Error boundaries

## 🚀 Developer Features

### Role Switcher
- Dev tool for testing
- Quick role switching
- Bottom-right corner button
- Switch between Solver/Creator/Admin

### Mock API
- Complete backend simulation
- Realistic delays
- Full CRUD operations
- Session management

### Seed Data
- Introduction to Nmap scenario
- Web Security challenge
- SOC Career Path
- Multiple playlists
- CTF THREAT event
- Sample teams
- Leaderboard entries
- Docker images catalog
- VM templates catalog

## 📦 Data Models

### Comprehensive Types
- User profiles
- Scenarios with full metadata
- Questions (all types)
- Machine specifications
- Rich content blocks (headings, paragraphs, images, tables)
- Session state
- Leaderboard entries
- Teams
- Events
- Playlists

## 🎯 Key Differentiators

1. **Q&A Model** - No flag submissions, proper educational questions
2. **Environment Provisioning** - Full Docker/VM support with auto-install
3. **Multi-step Creator Wizard** - Professional scenario creation
4. **Admin Tools** - Images catalog, user management, audit logs
5. **Rich Mission Content** - Support for images, tables, formatted text
6. **Partial Scoring** - Granular credit for multi-step tasks
7. **Machine Management** - Individual restart/reset controls
8. **Policy System** - Configurable validation, scoring, hints, attempts

## 📈 Future Expansion Points
- Billing/subscription system (mocked)
- Chat/messaging (inbox placeholder)
- Help desk/tickets (help section)
- Status page
- Changelog tracking
- Legal pages (ToS, Privacy, Cookies)

---

**Built with React, TypeScript, Tailwind CSS, and Shadcn/ui**
