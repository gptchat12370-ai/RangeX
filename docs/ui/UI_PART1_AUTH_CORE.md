# Part 1: Authentication & Core Pages

**Document**: UI Documentation - Authentication & Core  
**Pages Covered**: 6 pages  
**User Roles**: All users

---

## 📋 Table of Contents

1. [Login Page](#1-login-page)
2. [Dashboard (Home)](#2-dashboard-home)
3. [Account Page](#3-account-page)
4. [Settings Page](#4-settings-page)
5. [Notifications Page](#5-notifications-page)
6. [Help Page](#6-help-page)

---

## 1. Login Page

**Route**: `/login`  
**Access**: Public (unauthenticated users)  
**Purpose**: User authentication and registration

### Visual Layout

```
┌──────────────────────────────────────────┐
│        RangeX Platform Logo              │
│    Cybersecurity Training Platform       │
├──────────────────────────────────────────┤
│                                          │
│     ┌────────────────────────────┐       │
│     │ 📧 Email Address          │       │
│     └────────────────────────────┘       │
│                                          │
│     ┌────────────────────────────┐       │
│     │ 🔒 Password               │       │
│     └────────────────────────────┘       │
│                                          │
│     [ ] Remember Me                      │
│                                          │
│     ┌──────────────────────────┐        │
│     │     LOGIN BUTTON         │        │
│     └──────────────────────────┘        │
│                                          │
│     Don't have an account? Sign Up      │
│                                          │
└──────────────────────────────────────────┘
```

### What Users Can Do

#### Login Actions
1. **Enter Credentials**
   - Type email address in email field
   - Type password in password field
   - Check "Remember Me" to stay logged in

2. **Submit Login**
   - Click "Login" button to authenticate
   - System validates credentials
   - Redirects to Dashboard on success

3. **Navigate to Registration**
   - Click "Sign Up" link
   - Opens registration form (same page, different tab)

#### Registration Actions (If Available)
1. **Fill Registration Form**
   - Email address
   - Display name
   - Password (with confirmation)
   - Accept terms and conditions

2. **Submit Registration**
   - Creates new account
   - Automatically assigns Solver role
   - Redirects to Dashboard

### UI Elements

| Element | Type | Purpose |
|---------|------|---------|
| Email Field | Text Input | User email entry |
| Password Field | Password Input | Secure password entry |
| Remember Me | Checkbox | Persistent login |
| Login Button | Button | Submit credentials |
| Sign Up Link | Hyperlink | Navigate to registration |

### Validation Rules

**Email**:
- Must be valid email format
- Required field
- Shows error if invalid

**Password**:
- Minimum 8 characters
- Required field
- Shows error if too short

### Success/Error Messages

**Success**:
- "Login successful! Redirecting..."
- Green toast notification
- Auto-redirect in 1 second

**Errors**:
- "Invalid email or password"
- "Account locked. Contact admin"
- "Network error. Please try again"
- Red toast notifications

### Security Features
- Password masked by default
- CSRF token protection
- Rate limiting (5 attempts per 15 min)
- JWT token generation on success

---

## 2. Dashboard (Home)

**Route**: `/`  
**Access**: All authenticated users  
**Purpose**: Overview of user activity and quick access to features

### Visual Layout

```
┌────────────────────────────────────────────────────────┐
│  Welcome back, [Name]! [Role Badge]                    │
│  Continue your cybersecurity journey                   │
├────────────────────────────────────────────────────────┤
│                                                        │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐           │
│  │  Total   │  │  Badges  │  │  Rank    │           │
│  │  Points  │  │  Earned  │  │  Global  │           │
│  │  1,250   │  │    8     │  │   #42    │           │
│  └──────────┘  └──────────┘  └──────────┘           │
│                                                        │
├────────────────────────────────────────────────────────┤
│  🎯 In Progress (2)                                   │
│  ┌──────────────────────────────────────────┐         │
│  │ [Cover] SQL Injection Lab                │         │
│  │ Progress: 60% | Time: 15m left           │         │
│  │ [Continue] [Pause]                       │         │
│  └──────────────────────────────────────────┘         │
├────────────────────────────────────────────────────────┤
│  ⭐ Recommended for You                               │
│  [Scenario Card] [Scenario Card] [Scenario Card]     │
├────────────────────────────────────────────────────────┤
│  📊 Recent Activity                                    │
│  - Completed "XSS Challenge" - 2 hours ago            │
│  - Earned badge "Web Warrior" - 1 day ago            │
│  - Joined team "Cyber Ninjas" - 3 days ago           │
└────────────────────────────────────────────────────────┘
```

### What Users Can Do

#### 1. View Statistics
**Stats Cards** (Top row):
- **Total Points**: Lifetime points earned with weekly trend
- **Badges Earned**: Total badges with recent acquisitions
- **Global Rank**: Current ranking among all users
- **Challenges Completed**: Total completions

**Interaction**: Click any stat card to view detailed analytics

#### 2. Continue In-Progress Sessions
**In Progress Section**:
- See all active challenge sessions
- View progress percentage
- Check remaining time
- Quick access to resume

**Actions**:
- **Continue**: Resume the session (opens In-Challenge page)
- **Pause**: Temporarily pause the session
- **Stop**: End session and save progress
- Click anywhere on card to expand details

#### 3. Browse Recommended Challenges
**Recommended Section**:
- 3-6 personalized scenario suggestions
- Based on difficulty, category, and history
- Displays scenario cards with ratings

**Actions**:
- **View**: See full scenario details
- **Start**: Begin new session immediately
- **Favorite**: Add to favorites list
- Hover to see quick preview

#### 4. Review Recent Activity
**Activity Feed**:
- Latest 10 user actions
- Timestamped entries
- Includes completions, badges, team joins, event registrations

**Actions**:
- Click activity item to navigate to related page
- Scroll to see more history

#### 5. Quick Navigation
**Quick Action Buttons** (if present):
- "Browse All Challenges" → Challenges Page
- "Join an Event" → Events Page
- "Create Scenario" (Creator only) → Scenario Builder
- "Admin Panel" (Admin only) → Admin Console

### UI Elements

| Element | Interactive | Purpose |
|---------|-------------|---------|
| Role Badge | View only | Display user's primary role |
| Stat Cards | Clickable | View detailed analytics |
| Progress Cards | Multiple actions | Session management |
| Scenario Cards | Clickable | Start/view challenges |
| Activity Feed | Clickable items | Navigate to related content |

### Role-Specific Features

**Solver**:
- See recommended challenges
- Track personal progress
- View earned badges

**Creator** (Additional):
- Quick link to "Create Scenario"
- Stats on created scenarios
- Approval status notifications

**Admin** (Additional):
- System health indicators
- Pending approval count
- Budget usage warning (if over threshold)

### Real-Time Updates
- Session progress auto-refreshes every 10 seconds
- Activity feed updates on new actions
- Badge notifications appear as toast messages

---

## 3. Account Page

**Route**: `/account`  
**Access**: All authenticated users  
**Purpose**: Manage personal profile and account settings

### Visual Layout

```
┌────────────────────────────────────────────────────────┐
│  Account Settings                                      │
├────────────────────────────────────────────────────────┤
│  ┌──────────────────────────────────────────┐         │
│  │  Profile Information                     │         │
│  │  ┌────────────┐                          │         │
│  │  │ [Avatar]   │   Display Name: [____]   │         │
│  │  │            │   Email: user@mail.com   │         │
│  │  └────────────┘   Bio: [__________]      │         │
│  │                    [Upload Photo]        │         │
│  │                    [Save Changes]        │         │
│  └──────────────────────────────────────────┘         │
│                                                        │
│  ┌──────────────────────────────────────────┐         │
│  │  Security                                 │         │
│  │  Change Password: [***] [***] [Update]   │         │
│  │  Two-Factor Auth: [Disabled] [Enable]    │         │
│  │  Active Sessions: 2 devices              │         │
│  │  [View Sessions]                         │         │
│  └──────────────────────────────────────────┘         │
│                                                        │
│  ┌──────────────────────────────────────────┐         │
│  │  Roles & Permissions                      │         │
│  │  Current Roles:                           │         │
│  │  • Solver ✓                              │         │
│  │  • Creator ✓                             │         │
│  │  [Request Admin Access]                  │         │
│  └──────────────────────────────────────────┘         │
└────────────────────────────────────────────────────────┘
```

### What Users Can Do

#### 1. Edit Profile Information
**Profile Section**:
- **Display Name**: Update public username (3-30 characters)
- **Email**: View only (cannot change)
- **Bio**: Add personal description (max 500 characters)
- **Avatar**: Upload profile picture

**Actions**:
1. Click field to edit
2. Type new information
3. Click "Save Changes" to update
4. See success toast: "Profile updated"

**Avatar Upload**:
1. Click "Upload Photo" button
2. Select image file (JPG, PNG, max 5MB)
3. Preview appears
4. Confirm upload
5. Avatar updates across platform

#### 2. Manage Security Settings
**Password Change**:
1. Enter current password
2. Enter new password (min 8 chars)
3. Confirm new password
4. Click "Update Password"
5. Re-login required

**Two-Factor Authentication**:
1. Click "Enable 2FA"
2. Scan QR code with authenticator app
3. Enter verification code
4. Backup codes generated
5. Save backup codes securely

**Active Sessions**:
1. Click "View Sessions"
2. See list of logged-in devices
3. View: Device type, location, last active
4. Click "Revoke" to end specific session

#### 3. Manage Roles
**Current Roles Display**:
- Shows all active roles (Solver, Creator, Admin)
- Checkmark indicates active
- Grayed out indicates inactive

**Request Additional Roles**:
1. Click "Request Creator Access" (if Solver only)
2. Fill request form with justification
3. Submit to admin for approval
4. Receive notification on decision

**Note**: Admin role cannot be self-requested

#### 4. Delete Account
**Danger Zone**:
- Located at bottom of page
- Red border warning section

**Process**:
1. Click "Delete Account" button
2. Confirmation dialog appears
3. Type "DELETE" to confirm
4. Enter password
5. Account permanently deleted
6. Data removed after 30 days

### UI Elements

| Element | Type | Validation |
|---------|------|------------|
| Display Name | Text Input | 3-30 characters, alphanumeric |
| Bio | Textarea | Max 500 characters |
| Password | Password Input | Min 8 chars, complexity |
| Avatar Upload | File Input | JPG/PNG, max 5MB |
| Role Request | Form Dialog | Justification required |

### Validation Rules

**Display Name**:
- 3-30 characters
- Alphanumeric + spaces
- No profanity
- Must be unique

**Password**:
- Minimum 8 characters
- At least 1 uppercase
- At least 1 number
- At least 1 special character

**Bio**:
- Maximum 500 characters
- No links allowed (security)

### Success/Error Messages

**Success**:
- "Profile updated successfully!"
- "Password changed. Please log in again."
- "2FA enabled. Save your backup codes."

**Errors**:
- "Display name already taken"
- "Current password incorrect"
- "Image file too large (max 5MB)"
- "Bio contains prohibited content"

---

## 4. Settings Page

**Route**: `/settings`  
**Access**: All authenticated users  
**Purpose**: Configure application preferences and notifications

### Visual Layout

```
┌────────────────────────────────────────────────────────┐
│  Settings                                              │
├────────────────────────────────────────────────────────┤
│  [Preferences] [Notifications] [Privacy] [Advanced]   │
├────────────────────────────────────────────────────────┤
│  Preferences Tab:                                      │
│                                                        │
│  ┌──────────────────────────────────────────┐         │
│  │  Appearance                               │         │
│  │  Theme: [Dark ▼]                         │         │
│  │  Language: [English ▼]                   │         │
│  │  Timezone: [UTC+8 ▼]                     │         │
│  └──────────────────────────────────────────┘         │
│                                                        │
│  ┌──────────────────────────────────────────┐         │
│  │  Challenge Preferences                    │         │
│  │  [✓] Auto-save progress every 5 minutes  │         │
│  │  [✓] Show hints by default               │         │
│  │  [✓] Enable terminal auto-complete       │         │
│  │  Default timeout: [60 mins ▼]            │         │
│  └──────────────────────────────────────────┘         │
│                                                        │
│  [Save Settings]                                       │
└────────────────────────────────────────────────────────┘
```

### What Users Can Do

#### Tab 1: Preferences

##### Appearance Settings
1. **Theme Selection**
   - Options: Light, Dark, Auto (system)
   - Click dropdown to select
   - Changes apply immediately
   - Persists across sessions

2. **Language**
   - Options: English (more languages planned)
   - Select from dropdown
   - Reloads page on change

3. **Timezone**
   - Select from world timezones
   - Affects event times, leaderboard updates
   - Shows local time in brackets

##### Challenge Preferences
1. **Auto-save Interval**
   - Toggle on/off
   - Select interval: 5, 10, 15, 30 minutes
   - Saves progress automatically

2. **Hints Display**
   - Show hints by default (checked)
   - Hide hints until requested (unchecked)

3. **Terminal Features**
   - Auto-complete: Tab completion in SSH terminals
   - Command history: Arrow keys for history
   - Syntax highlighting: Color-coded commands

4. **Default Session Timeout**
   - Options: 30, 60, 90, 120 minutes
   - Auto-stop after inactivity
   - Prevents resource waste

#### Tab 2: Notifications

##### Email Notifications
1. **Event Reminders**
   - [ ] Event starting soon (24h before)
   - [ ] Event registration confirmed
   - [ ] Event results published

2. **Scenario Updates**
   - [ ] Creator: scenario approved/rejected
   - [ ] Solver: favorited scenario updated
   - [ ] New scenarios in followed categories

3. **Social Notifications**
   - [ ] Team invitation received
   - [ ] Team member completed challenge
   - [ ] New leaderboard rank achieved

##### In-App Notifications
1. **Real-time Alerts**
   - [ ] Session timeout warning
   - [ ] Badge earned
   - [ ] Answer validation result
   - [ ] System maintenance notice

2. **Notification Center**
   - View all notifications
   - Mark as read/unread
   - Delete individual notifications
   - Clear all button

#### Tab 3: Privacy

##### Data Sharing
1. **Profile Visibility**
   - Public: Anyone can see profile
   - Friends: Only team members
   - Private: Hidden from all

2. **Activity Visibility**
   - Show completed challenges
   - Show earned badges
   - Show team memberships
   - Show leaderboard participation

3. **Data Collection**
   - [ ] Allow analytics tracking
   - [ ] Share progress with researchers
   - [ ] Include in statistics

##### Privacy Controls
1. **Download My Data**
   - Click "Request Data Export"
   - Generates ZIP file with all user data
   - Includes: profile, sessions, answers, badges
   - Download link sent via email (24h process)

2. **Clear History**
   - Clear search history
   - Clear recently viewed
   - Does NOT delete completed sessions

#### Tab 4: Advanced

##### API Access (Creator/Admin)
1. **API Keys**
   - Generate personal API key
   - View existing keys
   - Revoke keys
   - Rate limits displayed

2. **Webhooks**
   - Configure webhook URLs
   - Receive events: scenario approved, session completed
   - Test webhook connectivity

##### Experimental Features
1. **Beta Features**
   - [ ] Enable AI hint assistant
   - [ ] Try new UI components
   - [ ] Join beta testing program

2. **Developer Mode**
   - [ ] Show debug information
   - [ ] Enable console logs
   - [ ] Display API response times

### UI Elements

| Element | Type | Options |
|---------|------|---------|
| Theme | Dropdown | Light, Dark, Auto |
| Language | Dropdown | English |
| Timezone | Dropdown | All UTC zones |
| Checkboxes | Toggle | On/Off |
| Save Button | Button | Submit changes |

### Save Behavior

**Auto-save**:
- Theme changes: Immediate
- Language changes: Immediate with reload

**Manual save**:
- Notification preferences
- Privacy settings
- Challenge preferences
- Requires "Save Settings" button click

### Success Messages
- "Settings saved successfully!"
- "Theme updated"
- "Notifications configured"
- Green toast notifications

---

## 5. Notifications Page

**Route**: `/notifications`  
**Access**: All authenticated users  
**Purpose**: View and manage notifications

### Visual Layout

```
┌────────────────────────────────────────────────────────┐
│  Notifications                    [Mark All Read]      │
├────────────────────────────────────────────────────────┤
│  [All] [Unread(5)] [Read] [System] [Social] [Events]  │
├────────────────────────────────────────────────────────┤
│  Today                                                 │
│  ┌────────────────────────────────────────────────┐   │
│  │ 🏆 You earned "SQL Master" badge!              │   │
│  │    2 hours ago                    [Mark Read]  │   │
│  └────────────────────────────────────────────────┘   │
│                                                        │
│  ┌────────────────────────────────────────────────┐   │
│  │ ⚡ "XSS Lab" session timeout in 10 minutes     │   │
│  │    3 hours ago                    [Dismiss]    │   │
│  └────────────────────────────────────────────────────┘   │
│                                                        │
│  Yesterday                                             │
│  ┌────────────────────────────────────────────────┐   │
│  │ 👥 Team invitation from "Cyber Warriors"       │   │
│  │    1 day ago          [Accept] [Decline]       │   │
│  └────────────────────────────────────────────────┘   │
│                                                        │
│  [Load More]                                          │
└────────────────────────────────────────────────────────┘
```

### What Users Can Do

#### 1. View Notifications
**Notification List**:
- Grouped by date (Today, Yesterday, This Week, Older)
- Shows icon based on type
- Displays timestamp
- Unread items highlighted

**Notification Types**:
- 🏆 **Badge Earned**: New achievement unlocked
- ⚡ **Session Warning**: Timeout approaching
- ✅ **Approval**: Scenario approved/rejected
- 👥 **Team**: Invitation, member activity
- 📅 **Event**: Registration, reminders, results
- ⚙️ **System**: Maintenance, updates
- 💬 **Social**: Comments, mentions

#### 2. Filter Notifications
**Filter Tabs**:
- **All**: Show everything
- **Unread**: Only unread items (count badge)
- **Read**: Previously viewed
- **System**: Platform announcements
- **Social**: Team/event related
- **Events**: Competition updates

**Interaction**: Click tab to filter list

#### 3. Manage Individual Notifications
**Actions per Notification**:
1. **Mark as Read/Unread**
   - Click notification body to toggle
   - Or use "Mark Read" button
   - Removes highlight

2. **Delete**
   - Click trash icon
   - Confirmation dialog appears
   - Permanently removes notification

3. **Quick Actions**
   - **Accept/Decline**: Team invitations
   - **View Details**: Opens related page
   - **Dismiss**: Removes from list

#### 4. Bulk Actions
**Top Bar Actions**:
1. **Mark All as Read**
   - Marks all visible notifications as read
   - Respects current filter

2. **Clear All**
   - Deletes all read notifications
   - Confirmation required
   - Unread items preserved

3. **Refresh**
   - Fetches latest notifications
   - Auto-refreshes every 30 seconds

#### 5. Notification Settings
**Quick Access**:
- Click gear icon → Opens Settings Page (Notifications tab)
- Configure which notifications to receive

### UI Elements

| Element | Interactive | Purpose |
|---------|-------------|---------|
| Filter Tabs | Clickable | Filter by category |
| Notification Card | Clickable | View details, mark read |
| Action Buttons | Clickable | Accept, decline, dismiss |
| Mark All Read | Button | Bulk mark as read |
| Delete | Icon button | Remove notification |

### Real-Time Behavior
- New notifications appear at top
- Bell icon in top bar shows count
- Desktop notifications (if enabled)
- Sound alert (if enabled in settings)

### Empty State
**No Notifications**:
```
  📭 No notifications
  You're all caught up!
```

---

## 6. Help Page

**Route**: `/help`  
**Access**: All authenticated users  
**Purpose**: User assistance and documentation

### Visual Layout

```
┌────────────────────────────────────────────────────────┐
│  Help & Support                                        │
├────────────────────────────────────────────────────────┤
│  [Search: How do I...?]                   [🔍]        │
├────────────────────────────────────────────────────────┤
│                                                        │
│  Popular Topics                                        │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐             │
│  │ Getting  │ │ Creating │ │ Events & │             │
│  │ Started  │ │ Scenarios│ │  Teams   │             │
│  └──────────┘ └──────────┘ └──────────┘             │
│                                                        │
│  Browse by Category                                    │
│  ▼ Account & Profile                                  │
│    • How to change password                           │
│    • How to upload avatar                            │
│    • Managing notifications                           │
│                                                        │
│  ▼ Challenges & Sessions                              │
│    • Starting a challenge                             │
│    • Connecting to machines                           │
│    • Submitting answers                               │
│    • Understanding scoring                            │
│                                                        │
│  ▼ Creator Tools (Creator/Admin)                      │
│    • Scenario creation workflow                       │
│    • Machine configuration                            │
│    • Question types explained                         │
│                                                        │
│  Still need help?                                      │
│  [Contact Support] [Community Forum] [Video Tutorials]│
└────────────────────────────────────────────────────────┘
```

### What Users Can Do

#### 1. Search Help Articles
**Search Bar**:
1. Type question or keywords
2. Auto-suggest appears (common questions)
3. Press Enter to search
4. Results ranked by relevance

**Search Examples**:
- "How to reset password"
- "SSH connection failed"
- "Event registration"
- "Badge requirements"

#### 2. Browse by Category
**Expandable Sections**:

##### Account & Profile
- Creating an account
- Changing password
- Uploading profile picture
- Managing email preferences
- Requesting creator access
- Two-factor authentication

##### Challenges & Sessions
- Browsing challenges
- Understanding difficulty levels
- Starting a session
- Connecting to containers (SSH/RDP/Web)
- Terminal usage tips
- Answering questions
- Using hints (if enabled)
- Pausing/resuming sessions
- Completing challenges
- Troubleshooting connection issues

##### Events & Teams
- Finding events
- Registering for events
- Creating a team
- Joining a team
- Team collaboration
- Event leaderboards
- Scoring in events

##### Badges & Career Paths
- How badges are earned
- Badge categories
- Viewing badge requirements
- Following career paths
- Tracking progress

##### Creator Tools (Creator/Admin only)
- Scenario creation workflow (5 steps)
- Defining machines and networks
- Creating question types (6 types)
- Uploading assets
- Submission process
- Review and approval system
- Scenario versioning

##### Admin Tools (Admin only)
- Reviewing scenarios
- Admin testing process
- Managing users
- System configuration
- Budget monitoring
- Container management

#### 3. View Popular Topics
**Quick Access Cards**:
- Most viewed articles
- Recent updates
- Trending topics
- Click card to view full article

#### 4. Contact Support
**Support Options**:

##### 1. Live Chat (if available)
- Click "Live Chat" button
- Chat widget opens
- Talk to support agent
- Available: Mon-Fri, 9am-5pm UTC+8

##### 2. Email Support
- Click "Contact Support"
- Fill form:
  - Subject
  - Category (Technical, Account, Billing, Other)
  - Description
  - Attachments (screenshots)
- Submit ticket
- Response within 24-48 hours

##### 3. Community Forum
- Link to external forum
- Browse user discussions
- Post questions
- Community-driven answers

##### 4. Video Tutorials
- Link to video library
- Step-by-step walkthroughs
- Organized by topic
- YouTube or embedded player

#### 5. FAQs
**Frequently Asked Questions**:

**General**:
- Q: What is RangeX?
- Q: Who can use the platform?
- Q: Is it free?

**Technical**:
- Q: What browsers are supported?
- Q: Why can't I connect to SSH?
- Q: How do I download session logs?

**Account**:
- Q: How do I reset my password?
- Q: Can I change my email?
- Q: How do I delete my account?

**Challenges**:
- Q: How is scoring calculated?
- Q: What happens if I timeout?
- Q: Can I retry a challenge?

### UI Elements

| Element | Type | Purpose |
|---------|------|---------|
| Search Bar | Text Input | Find help articles |
| Category Accordion | Expandable List | Browse topics |
| Article Link | Hyperlink | Open full article |
| Contact Form | Form Dialog | Submit support ticket |
| Video Player | Embedded | Watch tutorials |

### Help Article Structure
**Each Article Contains**:
- Title
- Last updated date
- Reading time estimate
- Step-by-step instructions
- Screenshots (if applicable)
- Related articles
- "Was this helpful?" feedback buttons

### Additional Resources
**External Links**:
- Official documentation
- API reference (Creator/Admin)
- Community Discord
- GitHub repository (for open-source components)
- Security policy
- Terms of service
- Privacy policy

### Search Tips
**Help Search Features**:
- Typo tolerance
- Synonym recognition
- Category filtering
- Sort by: Relevance, Date, Popularity
- No results → Suggest similar articles

---

## 🔄 Navigation Between Pages

### From Login Page
- Successful login → Dashboard
- Click "Sign Up" → Registration form
- Forgot password → Password reset flow

### From Dashboard
- Click challenge card → Challenge Preview
- "Browse All" → Challenges Page
- Bell icon → Notifications Page
- Avatar → Account dropdown menu
- Sidebar links → Any main page

### From Any Page
- Sidebar always visible (except In-Challenge)
- Top bar navigation consistent
- Breadcrumbs on nested pages
- Back button in browser works

---

## 📱 Mobile Experience

All pages responsive:
- **Login**: Full-screen form
- **Dashboard**: Stacked cards, swipeable
- **Account**: Vertical sections
- **Settings**: Accordion tabs
- **Notifications**: Full-width list
- **Help**: Collapsible categories

---

**Next**: [Part 2 - Challenge & Learning Pages →](UI_PART2_CHALLENGES.md)
