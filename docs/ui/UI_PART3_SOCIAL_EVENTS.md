# Part 3: Social & Competition Pages

**Document**: UI Documentation - Social & Events  
**Pages Covered**: 8 pages  
**User Roles**: All users

---

## 📋 Table of Contents

1. [Events Page](#1-events-page)
2. [Event Detail Page](#2-event-detail-page)
3. [Create Event Page](#3-create-event-page)
4. [Teams Page](#4-teams-page)
5. [Team Detail Page](#5-team-detail-page)
6. [Team Settings Page](#6-team-settings-page)
7. [Leaderboards Page](#7-leaderboards-page)
8. [Badge Progress Page](#8-badge-progress-page)

---

## 1. Events Page

**Route**: `/events`  
**Access**: All authenticated users  
**Purpose**: Browse and register for competition events

### What Users Can Do

#### 1. Browse Events
- View all upcoming, ongoing, and past events
- See event cards with title, dates, participant count
- Filter by status (Upcoming, Active, Ended)
- Search by event name or organizer

#### 2. Register for Events
- Click "Register" button on event card
- Individual or team registration (depending on event)
- Confirmation dialog before registering
- Receive notification when registered

#### 3. View Event Details
- Click event card to open Event Detail page
- See full event information
- View leaderboard if event is active

---

## 2. Event Detail Page

**Route**: `/events/:id`  
**Access**: All authenticated users  
**Purpose**: View event details and participate

### What Users Can Do

#### 1. View Event Information
- Event title and description
- Start and end dates
- Countdown timer (if upcoming/active)
- Registration deadline
- Prizes and rewards
- Rules and eligibility

#### 2. Register/Unregister
- Register for event (if not registered)
- Unregister (before event starts)
- Team selection (if team event)

#### 3. View Scenarios
- List of challenges in the event
- Locked until event starts
- Click to attempt during event period

#### 4. Check Leaderboard
- Real-time rankings during event
- Your current rank highlighted
- Top performers displayed
- Filter by team/individual

---

## 3. Create Event Page

**Route**: `/events/new`  
**Access**: Admin only  
**Purpose**: Create new competition events

### What Users Can Do

#### 1. Fill Event Details
- Event name and description
- Start and end dates/times
- Registration deadline
- Event type (Individual/Team)
- Maximum participants

#### 2. Select Scenarios
- Search and add scenarios to event
- Set order and point values
- Configure time limits per scenario

#### 3. Configure Prizes
- Add prize tiers (1st, 2nd, 3rd, etc.)
- Specify rewards (badges, points, certificates)

#### 4. Publish Event
- Preview event before publishing
- Publish immediately or schedule
- Send notifications to users

---

## 4. Teams Page

**Route**: `/teams`  
**Access**: All authenticated users  
**Purpose**: Browse teams and manage memberships

### What Users Can Do

#### 1. Browse Teams
- View all public teams
- Search by team name
- Filter by size, activity, tags
- See team cards with member count and rank

#### 2. Join a Team
- Click "Join" button (if public team)
- Request to join (if private team)
- Wait for approval from team admin

#### 3. Create Team
- Click "+ Create Team" button
- Fill team details (name, description, avatar)
- Set privacy (Public/Private)
- Invite initial members

#### 4. Manage Your Teams
- View teams you're a member of
- Leave team button
- Access team settings (if admin)

---

## 5. Team Detail Page

**Route**: `/teams/:id`  
**Access**: All authenticated users  
**Purpose**: View team information and activity

### What Users Can Do

#### 1. View Team Information
- Team name, description, avatar
- Member list with roles
- Team statistics (total points, rank, challenges completed)
- Team activity feed

#### 2. View Leaderboard Rank
- Global team ranking
- Points breakdown
- Recent achievements

#### 3. Join/Leave Team
- Join button (if not a member)
- Leave button (if member)
- Request to join (if private)

#### 4. Access Settings (Team Admin)
- "Settings" button visible only to admins
- Manage team members
- Edit team details

---

## 6. Team Settings Page

**Route**: `/teams/:id/settings`  
**Access**: Team admins only  
**Purpose**: Manage team configuration

### What Users Can Do

#### 1. Edit Team Details
- Change team name
- Update description
- Upload new avatar
- Modify privacy settings

#### 2. Manage Members
- View all members with roles
- Promote to admin
- Remove members
- Accept/reject join requests

#### 3. Invite Members
- Search users by username
- Send invitation
- Copy invitation link

#### 4. Delete Team
- "Delete Team" button in danger zone
- Confirmation required
- All members removed
- Team data archived

---

## 7. Leaderboards Page

**Route**: `/leaderboards`  
**Access**: All authenticated users  
**Purpose**: View rankings and compete

### What Users Can Do

#### 1. Switch Leaderboard Types
**Tabs**:
- Global Leaderboard (all users)
- Scenario Leaderboards (per challenge)
- Event Leaderboards (per competition)
- Team Leaderboards

#### 2. View Rankings
- See top 100 users/teams
- Each entry shows:
  - Rank number
  - Username/Team name
  - Total points
  - Badges earned
  - Recent activity
- Your rank highlighted in gold

#### 3. Filter and Search
- Filter by time period (All Time, This Month, This Week)
- Search for specific user/team
- Category filter (for scenario leaderboards)

#### 4. Navigate to Profiles
- Click username → User profile
- Click team name → Team detail page
- Click scenario → Challenge preview

---

## 8. Badge Progress Page

**Route**: `/badges/progress`  
**Access**: All authenticated users  
**Purpose**: Track badge achievements

### What Users Can Do

#### 1. View All Badges
**Categories**:
- Skill Badges (e.g., SQL Master, Network Ninja)
- Completion Badges (e.g., 10 Challenges Complete)
- Special Badges (e.g., Event Winner, Early Adopter)

#### 2. Check Badge Status
**Per Badge**:
- Icon and name
- Description
- Requirements
- Status: Earned (unlocked) or Locked
- Progress bar (if partially complete)

#### 3. Track Progress
**For Locked Badges**:
- See requirements (e.g., "Complete 5 SQL challenges")
- Current progress (e.g., "3 of 5 complete - 60%")
- Visual progress bar
- "How to earn" tooltip

#### 4. View Earned Badges
**For Unlocked Badges**:
- Date earned
- Rarity indicator (Common, Rare, Epic, Legendary)
- Badge showcase (display on profile)
- Share badge button

---

**Next**: [Part 4 - Creator Pages →](UI_PART4_CREATOR.md)
