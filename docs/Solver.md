# Solver Role Documentation

## Overview

The **Solver** is the primary learner/player role in RangeX. Solvers engage with cybersecurity challenges, participate in events, join teams, and track their progress through the platform's training ecosystem.

---

## Core Capabilities

### 1. Challenge Solving

Solvers can discover, launch, and solve cybersecurity challenges using RangeX's Q&A-based challenge model.

#### Challenge Types
- **MCQ (Multiple Choice Questions)**: Select from predefined answer options
- **Short Answer**: Provide text-based responses
- **Practical Tasks**: Hands-on exercises requiring interaction with provisioned environments

#### Challenge Flow (4 Screens)

**Screen 1: Challenge Preview**
- View challenge details:
  - Challenge name, description, and full cover image
  - Difficulty level
  - Points available
  - Author information
  - Category/tags
  - Rating (average user rating)
  - Number of solvers
  - Environment requirements (Docker/VM specifications)
- See question count and types
- View prerequisites (if any)
- Check if challenge is part of a career path or playlist
- Access "Start Challenge" button

**Screen 2: Launching**
- Environment provisioning status
- Real-time feedback on Docker/VM setup
- Progress indicator
- Estimated time remaining

**Screen 3: Ready Modal**
- Confirmation that environment is ready
- Connection details (if applicable):
  - IP addresses
  - Ports
  - Access credentials
- "Enter Challenge" button

**Screen 4: In-Challenge Environment**
- Active challenge interface with:
  - Question panel (sequential or accessible)
  - Answer input fields (MCQ/short answer/task completion)
  - Environment controls:
    - **Restart**: Reboot the machine (preserves state)
    - **Reset**: Full environment reset (returns to initial state)
  - Timer (if time-limited)
  - Progress tracker
  - Submit answers functionality
  - Exit/pause options

#### Environment Management
- **Machine Types**: Docker containers or Virtual Machines
- **Restart**: Reboots the running instance without losing configuration
- **Reset**: Completely rebuilds the environment to initial state
- Machine status indicators (Running, Stopped, Restarting, Resetting)

#### Challenge Completion
- Automatic grading for MCQ and validated short answers
- Manual review status for subjective answers (if applicable)
- Points awarded upon successful completion
- Completion badge/achievement
- Option to rate the challenge (1-5 stars)

---

### 2. Career Paths

**Admin-curated learning paths** designed to guide Solvers through structured cybersecurity training.

#### Features
- Browse available career paths:
  - Web Application Security
  - Network Penetration Testing
  - Malware Analysis
  - Cloud Security
  - etc.
- View path details:
  - Description and objectives
  - Difficulty progression
  - Estimated completion time
  - Total points available
  - List of challenges in sequence
- Track progress:
  - Completed challenges
  - Current position in path
  - Percentage completion
  - Total points earned vs. available
- Sequential or flexible challenge order (depending on path configuration)
- Achievement/certificate upon path completion

---

### 3. Playlists

Personal and curated collections of challenges for custom learning experiences.

#### Playlist Types

**Custom Playlists**
- Create personal playlists
- Add challenges from the platform
- Name and describe playlists
- Organize challenges in preferred order
- Edit/delete owned playlists

**Favorites**
- Quick-save challenges to a favorites playlist
- One-click access to bookmarked challenges
- Auto-managed by the system

**Curated Playlists**
- Platform/admin-created collections
- Themed challenge sets (e.g., "OWASP Top 10", "Beginner CTF")
- Browse and follow curated playlists
- View curator information

#### Playlist Features
- View all challenges in a playlist
- See completion status per challenge
- Track total points earned from playlist
- Share playlists (if enabled)
- Follow/unfollow curated playlists

---

### 4. Events

Competitive or collaborative cybersecurity events with time constraints and leaderboards.

#### Event Participation

**Event Discovery**
- Browse upcoming, ongoing, and past events
- Filter by:
  - Event type (CTF, Training, Competition)
  - Difficulty
  - Date/time
  - Team/individual participation

**Event Details (Preview)**
- Full event cover image
- Event name and description
- Start and end date/time
- Participation mode:
  - Individual
  - Team-based
  - **Multiplayer** (if admin-configured, visible to all users)
- List of challenges included with:
  - Challenge name and full cover
  - Individual challenge points
  - Total event points available
- Rules and regulations
- Prizes/rewards (if applicable)
- Registration status

**Event Registration**
- Individual registration for solo events
- Team-based registration:
  - Join with your existing team
  - Team captain submits participation request
  - All team members must be part of the same team
- Request-based participation (requires admin approval)

**Active Event Participation**
- Access all event challenges during the event window
- Real-time leaderboard updates
- Point tracking:
  - Points per challenge
  - Total points earned
  - Current rank
- Time remaining indicator
- Team coordination features (if team event):
  - See which challenges teammates are working on
  - Shared event points

**Post-Event**
- View final rankings
- Access solutions/write-ups (if published)
- Download participation certificate
- Review performance metrics

---

### 5. Teams

Collaborative groups for team-based learning and competition.

#### Team Features

**Team Membership**
- **Single-team membership**: Each solver can only be a member of ONE team at a time
- Join existing teams:
  - Browse public teams
  - Request to join (requires approval)
  - Accept invitations from team captains
- View team profile:
  - Team name, logo, and description
  - Member list with roles (Captain, Member)
  - Team statistics:
    - Total points
    - Challenges solved by team members
    - Event participation history
  - Team rank on leaderboard

**Team Creation**
- Create a new team:
  - Set team name (must be unique)
  - Upload team logo/avatar
  - Write team description
  - Set team visibility (public/private)
- Become the team captain automatically
- Leave team (captain must transfer ownership or team is disbanded)

**Team Captain Capabilities** (if you're the captain)
- Manage team settings (via TeamDetailPage > Settings tab):
  - Edit team name, description, logo
  - Change team visibility
  - Set join policy (open, request-based, invite-only)
- Manage members:
  - View member list
  - Remove members
  - Accept/reject join requests
  - Send invitations
  - Transfer captain role
- Register team for events
- Disband team

**Team Navigation**
- Automatic redirect: TeamsPage redirects solvers to their own team detail page
- View team activity feed
- See team challenges and events

**Team Requests**
- Join requests sent to team captains
- View request status in RequestsPage:
  - Pending team join requests
  - Event participation requests (if team-based)

---

### 6. Leaderboards

Track rankings and compare performance with other solvers and teams.

#### Leaderboard Types

**Users Tab**
- Global user rankings based on:
  - Total points
  - Challenges completed
  - Time-based metrics
- View:
  - Rank position
  - Username/display name
  - Total points
  - Challenges solved
  - Profile avatar
- Your own rank highlighted
- Pagination for browsing

**Teams Tab**
- Global team rankings
- Metrics:
  - Team total points (aggregated from all members)
  - Team challenges completed
  - Event victories
- View:
  - Rank position
  - Team name and logo
  - Total points
  - Member count
  - Team captain
- Your team highlighted (if you're in a team)

#### Leaderboard Filters
- Time period filters:
  - All-time
  - This month
  - This week
- Category filters (if applicable)
- Search functionality

---

### 7. Challenge Ratings

Provide feedback on challenges to help improve content quality.

#### Rating Features
- Rate completed challenges on a scale of 1-5 stars
- Rating categories:
  - Overall quality
  - Difficulty accuracy
  - Learning value
  - Environment stability
- Optional text review/feedback
- View average ratings from other solvers
- Edit your own ratings

---

### 8. Profile & Settings

Manage personal information and platform preferences.

#### Profile Data
- Personal Information:
  - Username (unique identifier)
  - Display name
  - Email address
  - Avatar/profile picture
  - Bio/description
  - Country/location
- Statistics Dashboard:
  - Total points earned
  - Challenges completed
  - Current rank
  - Career paths progress
  - Event participation count
  - Team affiliation
- Activity Timeline:
  - Recent challenge completions
  - Event participations
  - Achievements unlocked

#### Settings

**Account Settings**
- Change password
- Update email
- Profile visibility options
- Notification preferences:
  - Email notifications
  - Platform notifications
  - Event reminders
  - Team activity alerts

**Appearance Settings**
- Theme selection:
  - Light theme
  - Dark theme (default with bluish cyber aesthetic)
- Accent color customization:
  - Properly applied in both light and dark themes
  - Brand "X" theming elements
- Font size preferences
- Layout density options

**Privacy Settings**
- Profile visibility
- Activity visibility
- Team visibility
- Challenge history privacy

**Notification Settings**
- Configure what notifications you receive
- Email vs. in-app notifications
- Event reminders and alerts

---

### 9. Requests Management

Track and manage participation requests through the platform.

#### RequestsPage Features

**Team Requests**
- View your outgoing team join requests:
  - Team name
  - Request date
  - Status (Pending, Accepted, Rejected)
- Cancel pending requests
- Accept invitations from teams

**Event Requests**
- View event participation requests:
  - Individual event requests
  - Team event requests (if you're a team captain)
- Request status tracking
- Event registration confirmations

---

## Data Access & Visibility

### What Solvers Can See

**Challenges**
- All published challenges (unless restricted by prerequisites)
- Challenge metadata (name, description, points, difficulty, author)
- Full challenge covers and images
- Environment specifications
- Question count and types
- Ratings and solver statistics
- Personal completion status
- Personal scores and time taken

**Career Paths**
- All available career paths
- Path progression and completion status
- Challenges within paths
- Personal progress metrics

**Playlists**
- Own custom playlists (full control)
- Followed curated playlists
- Public playlists from other users (if enabled)
- Favorites collection

**Events**
- All published events (upcoming, ongoing, past)
- Event details and challenge lists
- Full event covers and challenge covers within events
- Individual challenge points and total event points
- Participation mode (individual/team/multiplayer)
- Personal participation status
- Event leaderboards during and after events

**Teams**
- Own team details (full access)
- Public team profiles (limited information)
- Team leaderboard rankings
- Team member lists (for public teams)

**Leaderboards**
- Global user rankings
- Global team rankings
- Personal rank position
- Own team's rank position
- Public statistics for all ranked users/teams

**Profile & Statistics**
- Full access to own profile and statistics
- Public profiles of other users (based on privacy settings)
- Personal activity timeline
- Achievement/badge collection

### What Solvers Cannot See

**Platform Administration**
- Admin panel and controls
- User management features
- Platform analytics and metrics
- Content moderation tools

**Creator Tools**
- Challenge creation interface
- Scenario builder
- Environment configuration tools
- Validation policy setup
- Creator-specific analytics

**Other Users' Private Data**
- Private profiles (if privacy enabled)
- Private playlists
- Personal challenge attempts/scores (unless shared)
- Email addresses of other users
- Private team information

**Event Management**
- Event creation and editing
- Event approval workflows
- Event analytics for organizers

---

## Points & Progression System

### How Points Work

**Earning Points**
- Complete challenges to earn points
- Points vary by challenge difficulty
- Event participation may offer bonus points
- Career path completion bonuses
- First-time solver bonuses (if configured)

**Points Tracking**
- View total points on profile
- See points per challenge
- Track event points separately
- Career path points progression
- Team contribution points (for team leaderboard)

**Points Display**
- Individual challenge points shown on challenge cards
- Total event points displayed on event detail pages
- Running total in profile header
- Leaderboard rankings based on points

### Progression Tracking

**Challenge Progress**
- Not started / In progress / Completed
- Percentage completion for multi-question challenges
- Time spent tracking
- Attempt count

**Career Path Progress**
- Challenges completed vs. total challenges
- Current position in path
- Percentage completion
- Estimated time to completion

**Event Progress**
- Challenges completed vs. available
- Points earned vs. total points
- Current rank in event
- Time remaining

**Overall Profile Stats**
- Total challenges completed
- Total points earned
- Career paths completed
- Events participated in
- Team contributions
- Achievement badges

---

## Key Workflows

### 1. Starting a Challenge
1. Browse challenges or select from career path/playlist/event
2. Click on challenge card to view preview
3. Review challenge details, requirements, and environment specs
4. Click "Start Challenge"
5. Wait for environment provisioning (Launching screen)
6. Receive ready confirmation with connection details (Ready modal)
7. Enter challenge environment
8. Answer questions and interact with environment
9. Use restart/reset controls as needed
10. Submit answers
11. Receive results and points
12. Rate the challenge

### 2. Joining a Team
1. Navigate to Teams section
2. Browse available teams
3. Click on a team to view details
4. Click "Request to Join" (if request-based) or "Join" (if open)
5. Wait for captain approval (if required)
6. Receive confirmation
7. Automatic redirect to your team page on future visits

### 3. Participating in an Event
1. Browse events in Events section
2. Click on event to view full details (cover, challenges, points)
3. Review event rules and participation mode
4. Click "Register" (individual or team)
5. For team events: Team captain submits request
6. Wait for event start time
7. Access event challenges during event window
8. Complete challenges to earn points
9. Track real-time rank on leaderboard
10. View final results after event ends

### 4. Following a Career Path
1. Navigate to Career Paths
2. Select a path that interests you
3. Review path curriculum and objectives
4. Click "Start Path" or "Continue"
5. Work through challenges in sequence
6. Track progress on path dashboard
7. Complete all challenges
8. Receive path completion certificate/badge

### 5. Creating a Playlist
1. Navigate to Playlists section
2. Click "Create Playlist"
3. Set playlist name and description
4. Add challenges by searching or browsing
5. Arrange challenges in preferred order
6. Save playlist
7. Access from "My Playlists"

---

## Special Considerations

### Single-Team Membership
- You can only be a member of ONE team at a time
- Must leave current team before joining another
- Team captains must transfer ownership before leaving
- Team participation counts for events (note shown in event creation)

### Environment Management
- **Restart** preserves your progress but reboots the machine
- **Reset** completely wipes the environment (use carefully)
- Environments auto-shutdown after inactivity
- Some environments may have usage time limits

### Event Participation
- Individual events: You compete solo
- Team events: Your team competes as a unit, all points shared
- Multiplayer events: May have special collaboration features
- Event registration may require approval
- Team events require all members to be on the same team

### Rating System
- Can only rate challenges you've completed
- Ratings help improve content quality
- Anonymous ratings (username not shown publicly)
- Can update your rating anytime

### Request System
- Track all requests in RequestsPage
- Team join requests go to team captains
- Event requests go to event organizers
- Pending requests can be cancelled

---

## UI/UX Features

### Bluish Cyber Theme
- Dark theme default with bluish accents
- Light theme available with proper accent color application
- "X" brand element integrated throughout
- Consistent color scheme for roles and actions

### Navigation
- Auto-redirect to your team page from Teams section
- Breadcrumb navigation for complex workflows
- Quick access to active challenges
- Dashboard widgets for ongoing progress

### Responsive Design
- Full desktop experience
- Mobile-optimized views
- Touch-friendly controls
- Adaptive layouts

---

## Tips for Solvers

1. **Start with Career Paths**: Structured learning paths provide guided progression
2. **Join a Team**: Collaborate and compete with others for better learning
3. **Use Playlists**: Organize challenges around your learning goals
4. **Participate in Events**: Test skills in competitive environments
5. **Rate Challenges**: Help improve content for everyone
6. **Manage Environments Carefully**: Use restart instead of reset when possible
7. **Track Progress**: Regularly check your stats and leaderboard position
8. **Engage with Community**: Teams provide support and motivation
9. **Set Goals**: Use playlists and career paths to structure your learning
10. **Take Breaks**: Environment management allows pausing and resuming

---

## Summary

The **Solver** role in RangeX provides a comprehensive cybersecurity training experience with:
- **Q&A-based challenges** (MCQ, short answer, practical tasks)
- **4-screen challenge flow** with environment provisioning
- **Career paths** for structured learning
- **Playlists** for custom organization
- **Events** for competitive participation
- **Teams** for collaboration (single-team membership)
- **Leaderboards** tracking users and teams
- **Rating system** for content feedback
- **Full profile management** with appearance customization
- **Request tracking** for teams and events

Solvers have access to all learning content, can track their progress across multiple dimensions, compete individually or with teams, and customize their learning journey through playlists and career paths while engaging with the RangeX community.
