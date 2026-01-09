# RangeX Platform - User Interface Documentation

**Document Version**: 1.0  
**Date**: January 7, 2026  
**Platform**: RangeX Cybersecurity Training Platform  
**Total Pages**: 35+ pages across 5 parts

---

## 📋 Overview

This comprehensive UI documentation explains every page in the RangeX platform, detailing what users can see and do on each screen. The documentation is organized by user role and feature area.

---

## 📚 Documentation Structure

### Part 1: Authentication & Core Pages
**File**: [UI_PART1_AUTH_CORE.md](UI_PART1_AUTH_CORE.md)  
**Pages**: 6 pages
- Login Page
- Dashboard (Home)
- Account Page
- Settings Page
- Notifications Page
- Help Page

### Part 2: Challenge & Learning Pages
**File**: [UI_PART2_CHALLENGES.md](UI_PART2_CHALLENGES.md)  
**Pages**: 8 pages
- Challenges Page
- Challenge Preview Page
- Launching Page
- In-Challenge Page (Main Challenge Interface)
- Playlists Page
- Playlist Detail Page
- Career Paths Page
- Career Path Detail Page

### Part 3: Social & Competition Pages
**File**: [UI_PART3_SOCIAL_EVENTS.md](UI_PART3_SOCIAL_EVENTS.md)  
**Pages**: 8 pages
- Events Page
- Event Detail Page
- Create Event Page
- Teams Page
- Team Detail Page
- Team Settings Page
- Leaderboards Page
- Badge Progress Page

### Part 4: Creator Pages
**File**: [UI_PART4_CREATOR.md](UI_PART4_CREATOR.md)  
**Pages**: 5 pages
- Scenario Builder (5-Step Wizard)
- My Scenarios Page
- Scenario Detail Page (Creator View)
- Requests Page (Approval Status)
- Favorites Page

### Part 5: Admin Pages
**File**: [UI_PART5_ADMIN.md](UI_PART5_ADMIN.md)  
**Pages**: 11 pages
- Admin Console (Dashboard)
- Scenario Approvals Page
- Admin Testing Page
- Deployment Management Page
- Container Management Page
- Admin System Settings
- Cost Dashboard
- Badge Management
- Career Paths Management
- Admin Tools & Links
- Admin Scenarios Page

---

## 🎯 User Roles

The RangeX platform has **3 primary user roles**:

### 1. Solver (All Users)
**Capabilities**:
- Browse and attempt challenges
- Join events and teams
- Track progress and earn badges
- View leaderboards and career paths

**Primary Pages**:
- Dashboard, Challenges, In-Challenge
- Events, Teams, Leaderboards
- Playlists, Career Paths, Badge Progress

### 2. Creator
**Capabilities**:
- All Solver capabilities PLUS:
- Create cybersecurity scenarios
- Upload assets and configure machines
- Submit scenarios for review
- Track scenario performance

**Primary Pages**:
- Scenario Builder
- My Scenarios
- Requests (Approval tracking)

### 3. Admin
**Capabilities**:
- All Solver + Creator capabilities PLUS:
- Review and approve scenarios
- Manage system configuration
- Monitor costs and resources
- Create badges and career paths
- Manage users and content

**Primary Pages**:
- Admin Console
- Scenario Approvals
- Admin Testing
- Deployment Management
- System Settings

---

## 🎨 UI Design System

### Color Scheme
```
Primary: Blue (#3B82F6)
Success: Green (#10B981)
Warning: Yellow (#F59E0B)
Danger: Red (#EF4444)
Purple: (#8B5CF6) - Creator elements
```

### Difficulty Colors
- **Easy**: Green
- **Intermediate**: Yellow
- **Hard**: Orange
- **Impossible**: Red

### Role Badge Colors
- **Solver**: Blue
- **Creator**: Purple
- **Admin**: Red

### UI Components
- **shadcn/ui**: 50+ components
- **Tailwind CSS**: Utility-first styling
- **Lucide Icons**: Consistent iconography
- **Recharts**: Data visualization

---

## 📊 Common UI Elements

### Navigation
**Sidebar Navigation** (Available on all pages except In-Challenge):
- Home (Dashboard)
- Challenges
- Playlists
- Career Paths
- Events
- Teams
- Leaderboards
- Create Scenario (Creator only)
- My Scenarios (Creator only)
- Admin (Admin only)

**Top Bar** (All pages):
- Search bar
- Notifications bell icon
- Account dropdown menu

### Cards
**Scenario Card** (Used throughout):
- Cover image
- Title and author
- Difficulty badge
- Duration estimate
- Star rating
- Tags
- Action buttons (Start/View/Continue)

**Event Card**:
- Event title
- Date range
- Participant count
- Registration status
- Action button

**Team Card**:
- Team name and avatar
- Member count
- Points/rank
- Join button

---

## 🔍 Search & Filters

### Global Search
Available on: Challenges, Playlists, Events, Teams

**Search Fields**:
- Title
- Description
- Tags
- Author

**Filter Options**:
- Difficulty (Easy, Intermediate, Hard, Impossible)
- Category (varies by page)
- Mode (Single Player, Multi Player)
- Date range (Events)
- Status (for admin pages)

---

## 📱 Responsive Design

All pages are responsive and mobile-friendly:
- **Desktop**: Full sidebar navigation, grid layouts
- **Tablet**: Collapsible sidebar, 2-column grids
- **Mobile**: Bottom navigation, single-column lists

---

## ⚡ Real-time Features

### WebSocket Updates
Pages with real-time updates:
- **Dashboard**: Session status updates
- **In-Challenge**: Container health, question validation
- **Leaderboards**: Live ranking changes
- **Events**: Participant updates
- **Admin**: Deployment status

### Live Indicators
- Session status (Provisioning, Running, Paused, Completed)
- Container health (Green/Yellow/Red)
- Budget usage (live cost tracking)
- Event countdown timers

---

## 🔐 Permission System

### Page Access Control
| Page Category | Solver | Creator | Admin |
|--------------|--------|---------|-------|
| Authentication | ✅ | ✅ | ✅ |
| Challenges | ✅ | ✅ | ✅ |
| Social/Events | ✅ | ✅ | ✅ |
| Creator Pages | ❌ | ✅ | ✅ |
| Admin Pages | ❌ | ❌ | ✅ |

### Action Restrictions
- **Start Challenge**: Requires solver role
- **Create Scenario**: Requires creator role
- **Approve Scenario**: Requires admin role
- **Modify System Settings**: Requires admin role

---

## 📖 How to Use This Documentation

### For New Users
1. Start with **Part 1** (Authentication & Core) to understand login and dashboard
2. Read **Part 2** (Challenges) to learn how to attempt challenges
3. Explore **Part 3** (Social) for events and competition

### For Creators
1. Review **Part 1** and **Part 2** first
2. Study **Part 4** (Creator) for scenario building
3. Reference **Part 2** to understand the solver experience

### For Admins
1. Review all parts 1-4 to understand user experience
2. Focus on **Part 5** (Admin) for management tools
3. Reference architecture docs for technical details

### For Developers
- Cross-reference with [ARCHITECTURE_OVERVIEW.md](../ARCHITECTURE_OVERVIEW.md)
- See [SEQUENCE_DIAGRAMS_COMPLETE.md](../SEQUENCE_DIAGRAMS_COMPLETE.md)
- Check [ACTIVITY_DIAGRAMS_COMPLETE.md](../ACTIVITY_DIAGRAMS_COMPLETE.md)

---

## 📄 Document Navigation

**Next**: [Part 1 - Authentication & Core Pages →](UI_PART1_AUTH_CORE.md)

**All Parts**:
1. [Authentication & Core Pages](UI_PART1_AUTH_CORE.md)
2. [Challenge & Learning Pages](UI_PART2_CHALLENGES.md)
3. [Social & Competition Pages](UI_PART3_SOCIAL_EVENTS.md)
4. [Creator Pages](UI_PART4_CREATOR.md)
5. [Admin Pages](UI_PART5_ADMIN.md)

---

## 📊 Documentation Statistics

- **Total Pages Documented**: 35+
- **Total Screenshots**: 0 (text-based descriptions)
- **User Roles Covered**: 3 (Solver, Creator, Admin)
- **Feature Areas**: 10+
- **Interactive Elements**: 200+

---

## 🔄 Document Updates

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | Jan 7, 2026 | Initial comprehensive UI documentation |

---

**Last Updated**: January 7, 2026  
**Status**: ✅ Complete  
**Maintained By**: RangeX Development Team
