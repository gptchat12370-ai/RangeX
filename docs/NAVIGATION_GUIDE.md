# RangeX Navigation Guide

## 🎯 How to Access Everything

### Top Bar (Always Visible)

#### Left Side
- **☰ Menu** (Mobile only) - Opens/closes sidebar
- **🔍 Search** - Click or press `⌘K` / `Ctrl+K` for global search

#### Right Side
- **🔔 Bell Icon** → Notifications Page
  - View achievements, event reminders, system updates
  - Mark as read/unread
  - Filter by type
  
- **👤 Avatar** → User Menu Dropdown
  - **Account** - Profile, badges, history, settings
  - **Settings** - Same as Account
  - **Log out**

---

### Sidebar Navigation

#### 🔵 Main Navigation (All Users)
1. **Dashboard** - Overview, quick stats, recommended challenges
2. **Career Paths** - Structured learning journeys (e.g., SOC Analyst)
3. **Playlists** - Curated challenge collections
4. **Challenges** - Browse all available challenges
5. **Events** - Competitive PvP events
6. **Teams** - Join or create teams
7. **Leaderboards** - Global, Monthly, Weekly rankings
8. **Help** - FAQ, Getting Started, Troubleshooting

#### 🟣 Creator Tools Section (Creator & Admin Roles)
*Visible after switching to Creator or Admin role*

1. **Create Scenario** - 5-step wizard to build challenges
   - Step 1: Overview (title, description, tags, difficulty)
   - Step 2: Environment (Docker/VM machines, topology)
   - Step 3: Mission & Rules (briefing, code of ethics)
   - Step 4: Questions (MCQ, Short Answer, Practical)
   - Step 5: Preview & Publish
   
2. **My Scenarios** - Manage your created challenges
   - View all, published, drafts
   - Edit, duplicate, delete
   - View analytics (views, starts, completes)
   
3. **Events I Host** - Manage your hosted events

#### 🔴 Administration Section (Admin Role Only)
*Visible only after switching to Admin role*

1. **Admin Console** - Platform management
   - **Users Tab** - Manage users, change roles, toggle MFA
   - **Scenarios Tab** - Review pending scenarios
   - **Analytics Tab** - Platform metrics (DAU, MAU, completion rates)
   - **Audit Log Tab** - Track all platform actions
   
2. **Images Catalog** - Environment management
   - **Docker Images Tab** - Manage allowed container images
   - **VM Templates Tab** - Manage virtual machine templates
   - Add/remove images, set default availability

---

## 🎮 Role Switcher (Bottom-Right Corner)

### Floating Purple Button
Click to instantly switch between roles:
- **Solver** (Blue) - Default user experience
- **Creator** (Purple) - Content creation tools
- **Admin** (Red) - Full platform management

**Note**: This is a dev tool for testing. In production, roles would be assigned by admins.

---

## 🔍 Command Palette (⌘K)

Press `⌘K` (Mac) or `Ctrl+K` (Windows/Linux) anywhere to open global search:
- Search challenges
- Find playlists
- Navigate to pages
- Quick actions

---

## 🚀 Quick Navigation Paths

### To Start Your First Challenge
```
Sidebar → Challenges → "Introduction to Nmap" → Start
↓
Preview Screen (details, requirements)
↓
Click "Start" → Launching Screen (progress bar)
↓
Ready Modal → Click "Start"
↓
In-Challenge Environment (5 tabs: Overview, Questions, Servers, Score, Help)
```

### To Create a Scenario (as Creator)
```
1. Bottom-right → Switch to Creator role
2. Sidebar → Create Scenario (in Creator Tools section)
3. Complete 5 steps
4. Publish
5. View in "My Scenarios"
```

### To Manage Users (as Admin)
```
1. Bottom-right → Switch to Admin role
2. Sidebar → Admin Console (in Administration section)
3. Users Tab
4. Select user → Change role or toggle MFA
```

### To Add Docker Images (as Admin)
```
1. Bottom-right → Switch to Admin role
2. Sidebar → Images Catalog (in Administration section)
3. Docker Images Tab
4. Click "Add Image"
5. Fill details → Submit
```

---

## 📱 Mobile Navigation

### Opening Sidebar
- Tap **☰** icon (top-left) to open sidebar
- Tap outside or select a page to close

### Features
- All sidebar content accessible
- Responsive layout
- Touch-friendly buttons
- Auto-close after navigation

---

## 💡 Tips

### Keyboard Shortcuts
- `⌘K` / `Ctrl+K` - Open search
- `Esc` - Close modals/dialogs

### Visual Indicators
- **Blue glow** - Primary actions
- **Active page** - Blue highlight in sidebar with left border
- **Notification dot** - Red dot on bell icon when unread
- **Role badge** - Color-coded role display

### Common Actions
- **View Profile** - Avatar → Account
- **Check Notifications** - Bell icon
- **Switch Roles** - Bottom-right floating button
- **Search Anything** - ⌘K
- **Help & Support** - Sidebar → Help

---

## 🎯 Feature Locations

### Solver Features
| Feature | Location |
|---------|----------|
| Browse Challenges | Sidebar → Challenges |
| View Profile | Avatar → Account |
| Check Badges | Avatar → Account → Badges Tab |
| View History | Avatar → Account → History Tab |
| Join Team | Sidebar → Teams |
| View Rankings | Sidebar → Leaderboards |
| Follow Career Path | Sidebar → Career Paths |
| Get Help | Sidebar → Help |

### Creator Features
| Feature | Location |
|---------|----------|
| Create Scenario | Creator Tools → Create Scenario |
| Manage Scenarios | Creator Tools → My Scenarios |
| View Analytics | My Scenarios → Actions → View Analytics |
| Edit Scenario | My Scenarios → Actions → Edit |

### Admin Features
| Feature | Location |
|---------|----------|
| User Management | Administration → Admin Console → Users Tab |
| Change Roles | Admin Console → Users → Select dropdown |
| Docker Images | Administration → Images Catalog → Docker Tab |
| VM Templates | Administration → Images Catalog → VM Tab |
| Platform Analytics | Admin Console → Analytics Tab |
| Audit Log | Admin Console → Audit Log Tab |

---

## 🐛 Troubleshooting

### Can't find a page?
- Check if you're in the correct role (use Role Switcher)
- Some pages only visible to Creator/Admin roles
- Use ⌘K to search for the page

### Sidebar not showing?
- On mobile: Tap ☰ menu icon (top-left)
- On desktop: Should be always visible

### Button not clickable?
- All navigation is now wired up!
- Bell icon → Notifications
- Avatar → Account menu
- Sidebar items → Respective pages

---

**Happy exploring! 🎯**
