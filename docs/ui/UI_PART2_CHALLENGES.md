# Part 2: Challenge & Learning Pages

**Document**: UI Documentation - Challenges & Learning  
**Pages Covered**: 8 pages  
**User Roles**: All users (Solver, Creator, Admin)

---

## 📋 Table of Contents

1. [Challenges Page](#1-challenges-page)
2. [Challenge Preview Page](#2-challenge-preview-page)
3. [Launching Page](#3-launching-page)
4. [In-Challenge Page](#4-in-challenge-page)
5. [Playlists Page](#5-playlists-page)
6. [Playlist Detail Page](#6-playlist-detail-page)
7. [Career Paths Page](#7-career-paths-page)
8. [Career Path Detail Page](#8-career-path-detail-page)

---

## 1. Challenges Page

**Route**: `/challenges`  
**Access**: All authenticated users  
**Purpose**: Browse and search all available cybersecurity challenges

### Visual Layout

```
┌────────────────────────────────────────────────────────┐
│  Challenges                                            │
│  Explore and practice with 150 cybersecurity challenges│
├────────────────────────────────────────────────────────┤
│  [🔍 Search challenges...]  [Difficulty▼] [Mode▼] [Category▼] │
├────────────────────────────────────────────────────────┤
│  Showing 42 of 150 challenges                         │
├────────────────────────────────────────────────────────┤
│  ┌──────────┐  ┌──────────┐  ┌──────────┐            │
│  │[Cover]   │  │[Cover]   │  │[Cover]   │            │
│  │SQL Inject│  │XSS Master│  │Buffer    │            │
│  │⭐4.5 🏷Web│  │⭐4.8 🏷Web│  │⭐4.2 🏷Bin│            │
│  │🟢Easy 60m│  │🟠Hard 90m│  │🔴Impos..│            │
│  │[Start]   │  │[Continue]│  │[View]    │            │
│  └──────────┘  └──────────┘  └──────────┘            │
│                                                        │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐            │
│  │ ... more scenario cards ...              │        │
│  └──────────┘  └──────────┘  └──────────┘            │
│                                                        │
│  [Load More]                                          │
└────────────────────────────────────────────────────────┘
```

### What Users Can Do

#### 1. Search Challenges
**Search Bar**:
- Type keywords to search
- Searches in: Title, description, tags, author
- Real-time filtering as you type
- Clear button (X) to reset search

**Search Examples**:
- "SQL" → Shows SQL injection challenges
- "beginner" → Shows easy challenges
- "web" → Shows web security challenges
- "John Doe" → Shows challenges by author John

#### 2. Filter Challenges
**Filter Options**:

##### Difficulty Filter
- All Difficulties (default)
- 🟢 Easy
- 🟡 Intermediate
- 🟠 Hard
- 🔴 Impossible

**Effect**: Shows only scenarios matching selected difficulty

##### Mode Filter
- All Modes (default)
- Single Player
- Multi Player

**Effect**: Filters by collaboration mode

##### Category Filter
- All Categories (default)
- Web Security
- Network Security
- Cryptography
- Binary Exploitation
- Forensics
- Reverse Engineering
- Other

**Effect**: Shows only scenarios in selected category

**Combine Filters**: All filters work together (AND logic)

#### 3. View Scenario Cards
**Scenario Card Information**:
- **Cover Image**: Visual preview
- **Title**: Challenge name
- **Author**: Creator username
- **Rating**: Average star rating (0-5) + total ratings
- **Difficulty Badge**: Color-coded difficulty
- **Duration**: Estimated completion time
- **Category Tags**: Quick category identification
- **Followers**: Number of users who favorited

**Card Interactions**:
- **Hover**: Shows expanded preview
- **Click anywhere**: Opens Challenge Preview page
- **Favorite icon**: Add to favorites (heart icon)

#### 4. Take Actions on Challenges
**Action Buttons**:

##### Start Button (Green)
- Appears if: No active session for this challenge
- Click action:
  1. Creates new session
  2. Navigates to Launching Page
  3. Deploys containers
  4. Opens In-Challenge page when ready

##### Continue Button (Blue)
- Appears if: User has in-progress session
- Shows progress percentage
- Click action:
  1. Resumes existing session
  2. Goes directly to In-Challenge page
  3. Restores previous state

##### View Button (Gray)
- Always available
- Click action:
  1. Opens Challenge Preview page
  2. Shows full details without starting

**Important**: Cannot start if already have active session

#### 5. Sort Results
**Sort Options** (Dropdown):
- Newest First
- Oldest First
- Highest Rated
- Most Popular
- Difficulty (Easy → Hard)
- Difficulty (Hard → Easy)

**Click sort dropdown** to change order

#### 6. Load More Challenges
**Pagination**:
- Initially shows 12-24 challenges
- "Load More" button at bottom
- Loads next 12-24 on click
- Infinite scroll (optional)

### UI Elements

| Element | Interactive | Purpose |
|---------|-------------|---------|
| Search Bar | Text Input | Find challenges |
| Filter Dropdowns | Select Menus | Filter by criteria |
| Scenario Card | Clickable Card | View/start challenge |
| Favorite Icon | Toggle Button | Add to favorites |
| Start/Continue/View | Action Buttons | Initiate or view challenge |

### Results Display

**Results Counter**:
- "Showing X of Y challenges"
- Updates dynamically with filters
- "No results found" if filters too restrictive

**Empty State**:
```
  No challenges found
  Try adjusting your filters or search term
  [Clear All Filters]
```

### Scenario Card Details

#### Cover Image
- 16:9 aspect ratio
- Placeholder if no image
- Author uploaded or default

#### Badges
- **Difficulty**: Green/Yellow/Orange/Red dot + text
- **Mode**: "SP" (Single) or "MP" (Multi)
- **New**: If published within 7 days

#### Metadata
- ⭐ Rating: 4.5 (120 ratings)
- 👤 Author: Username
- ⏱️ Duration: 60 minutes
- 👁️ Views: 1,250
- ❤️ Favorites: 85

### Session Indicators

**In Progress Indicator**:
- Blue border around card
- Progress bar: 60% complete
- Time remaining: "15m left"
- "Continue" button prominent

**Completed Indicator**:
- Green checkmark badge
- Score displayed: "95/100"
- "Retry" button option

---

## 2. Challenge Preview Page

**Route**: `/challenges/:id`  
**Access**: All authenticated users  
**Purpose**: View detailed challenge information before starting

### Visual Layout

```
┌────────────────────────────────────────────────────────┐
│  ← Back to Challenges                                  │
├────────────────────────────────────────────────────────┤
│  ┌──────────────────┐                                  │
│  │                  │  SQL Injection Fundamentals      │
│  │   Cover Image    │  by John Doe                     │
│  │                  │  ⭐ 4.5 (120) | ❤️ 85 favorites   │
│  └──────────────────┘                                  │
│                                                        │
│  🟢 Easy | ⏱️ 60 min | 🏷️ Web Security               │
│  👥 Single Player | 🎯 1,250 attempts                 │
│                                                        │
│  [🚀 Start Challenge]  [❤️ Favorite]  [📤 Share]     │
├────────────────────────────────────────────────────────┤
│  [Overview] [Machines] [Questions] [Reviews]          │
├────────────────────────────────────────────────────────┤
│  Overview Tab:                                         │
│                                                        │
│  Mission                                               │
│  Learn SQL injection techniques by exploiting a        │
│  vulnerable web application. Extract hidden data...    │
│                                                        │
│  Learning Objectives                                   │
│  • Understand SQL injection vulnerabilities            │
│  • Practice different injection techniques             │
│  • Learn prevention methods                            │
│                                                        │
│  Prerequisites                                         │
│  • Basic SQL knowledge                                 │
│  • Understanding of web applications                   │
│                                                        │
│  Tags                                                  │
│  [SQL] [Web] [OWASP Top 10] [Database]               │
└────────────────────────────────────────────────────────┘
```

### What Users Can Do

#### 1. View Challenge Details
**Hero Section**:
- Large cover image
- Challenge title
- Author name (clickable → author profile)
- Average rating with total ratings
- Favorite count
- Metadata badges

**Metadata Display**:
- **Difficulty**: Color-coded badge
- **Duration**: Estimated time
- **Category**: Primary category
- **Mode**: Single/Multi player
- **Attempts**: Total user attempts
- **Success Rate**: % of completions

#### 2. Take Primary Actions
**Action Buttons**:

##### Start Challenge (Primary Button)
- Large, prominent green button
- Click action:
  1. Validates no active session exists
  2. Shows confirmation dialog
  3. Navigates to Launching Page
  4. Begins deployment

**Confirmation Dialog**:
```
Start "SQL Injection Fundamentals"?

This will deploy containers and start your session.
Estimated time: 60 minutes

[Cancel] [Start Session]
```

##### Favorite (Heart Icon)
- Toggle: Filled (favorited) or outline (not favorited)
- Click to add/remove from favorites
- Updates favorite count immediately
- Syncs to Favorites page

##### Share Button
- Opens share dialog
- Options:
  - Copy link to clipboard
  - Share to social media (if integrated)
  - Share to team (if in team)

#### 3. Navigate Tabs
**Tab 1: Overview**

##### Mission Section
- Full mission briefing
- HTML formatted (supports images, lists, code blocks)
- Scenario backstory
- Objectives to accomplish

##### Learning Objectives
- Bulleted list of skills to learn
- Knowledge areas covered
- Techniques practiced

##### Prerequisites
- Required knowledge
- Recommended background
- Suggested preparation

##### Tags
- Clickable tag pills
- Click tag → Filters challenges by tag
- Returns to Challenges page with filter applied

**Tab 2: Machines**

##### Machine List
- Shows all containers in scenario
- For each machine:
  - Name (e.g., "Attacker Kali", "Victim Ubuntu")
  - Role (Attacker, Victim, Internal Server)
  - OS and version
  - Exposed services/ports
  - Access methods (SSH, RDP, Web)
  - Solver can access? (Yes/No)

**Example**:
```
Attacker Machine
• Name: Kali Linux
• OS: Kali 2024.1
• Resources: 2 vCPU, 2GB RAM
• Access: SSH (solver can access)
• Credentials: Provided on session start

Victim Machine
• Name: Vulnerable Web Server
• OS: Ubuntu 22.04
• Services: HTTP (80), MySQL (3306)
• Access: Web interface
• Credentials: N/A (public web app)
```

**Tab 3: Questions**

##### Question Overview
- Total number of questions
- Question types breakdown:
  - 3 Multiple Choice
  - 2 Short Answer
  - 1 True/False
  - 2 Practical Task
  - (etc.)

**Note**: Actual questions not shown until session starts

##### Scoring Information
- Total possible points
- Scoring policy (All or Nothing, Partial, Weighted)
- Hint policy (Disabled, Enabled with penalty, Free)
- Validation mode (Instant, On Submit, On Complete)

##### Hints (if enabled)
- "Hints available: Yes (with 5 point penalty)"
- "3 hints provided for this challenge"

**Tab 4: Reviews** (if enabled)

##### Rating Distribution
- Bar chart showing:
  - 5 stars: 60 reviews
  - 4 stars: 40 reviews
  - 3 stars: 15 reviews
  - 2 stars: 3 reviews
  - 1 star: 2 reviews

##### User Reviews
- Most recent/helpful reviews
- Each review shows:
  - Username
  - Star rating
  - Date
  - Review text
  - Upvote count (helpful?)

**Add Review** (if user completed):
- Star rating selector
- Text area for review
- "Submit Review" button

#### 4. View Related Information
**Sidebar** (Desktop):
- **Author Card**:
  - Avatar
  - Name
  - Total scenarios: 12
  - Average rating: 4.6
  - "View Profile" button

- **Statistics**:
  - Total attempts: 1,250
  - Completions: 890 (71%)
  - Average time: 52 minutes
  - Average score: 78/100

- **Related Challenges**:
  - "Users who completed this also tried..."
  - 3 scenario cards
  - Similar difficulty/category

### UI Elements

| Element | Interactive | Purpose |
|---------|-------------|---------|
| Back Button | Link | Return to Challenges |
| Start Button | Primary Action | Begin session |
| Favorite Icon | Toggle | Add to favorites |
| Share Button | Opens Dialog | Share challenge |
| Tabs | Navigation | Switch content views |
| Tags | Clickable Chips | Filter by tag |
| Review Stars | Input | Submit rating |

### Permission Checks

**Before Starting**:
1. User must be logged in
2. No active session for this challenge
3. No conflicting active sessions (if limit exists)
4. Event scenarios may require registration

**If Checks Fail**:
- "You already have an active session" → Show Continue button
- "Event registration required" → Show Register button
- "Session limit reached" → Show error message

### Loading States
- Cover image: Skeleton loader
- Tabs: Loading spinner while fetching data
- Reviews: Paginated, "Load More" button

---

## 3. Launching Page

**Route**: `/launching/:scenarioId`  
**Access**: Authenticated users starting a session  
**Purpose**: Show deployment progress while containers are starting

### Visual Layout

```
┌────────────────────────────────────────────────────────┐
│                                                        │
│          Preparing Your Challenge Environment         │
│          "SQL Injection Fundamentals"                  │
│                                                        │
│  ┌────────────────────────────────────────────────┐   │
│  │  ████████████░░░░░░░░░░░░░░░░░░░░  60%        │   │
│  └────────────────────────────────────────────────┘   │
│                                                        │
│  Current Step: Deploying containers...                │
│                                                        │
│  ✓ Session created                                    │
│  ✓ Machines configured                                │
│  ⏳ Deploying containers (2 of 3)                     │
│  ⏳ Waiting for health checks                         │
│  ⏳ Establishing network connections                  │
│  ⏳ Finalizing environment                            │
│                                                        │
│  Estimated time remaining: 30 seconds                 │
│                                                        │
│  [Cancel]                                             │
└────────────────────────────────────────────────────────┘
```

### What Users Can Do

#### 1. Watch Deployment Progress
**Progress Indicator**:
- Animated progress bar (0-100%)
- Current step description
- Estimated time remaining
- Real-time updates via WebSocket

**Deployment Steps**:
1. ✓ **Session Created** (Instant)
   - Database record created
   - Session ID generated

2. ✓ **Machines Configured** (2-5 seconds)
   - Task definitions prepared
   - Security groups validated
   - Network topology confirmed

3. ⏳ **Deploying Containers** (15-30 seconds)
   - Pulling Docker images
   - Starting Fargate tasks or Docker containers
   - Shows: "Deploying 2 of 3 machines"

4. ⏳ **Health Checks** (10-20 seconds)
   - Waiting for containers to be healthy
   - SSH/RDP/Web services ready
   - Port availability confirmed

5. ⏳ **Network Connections** (5-10 seconds)
   - Internal networking established
   - Gateway proxy configured
   - Access credentials generated

6. ✓ **Environment Ready** (Instant)
   - All systems operational
   - Access URLs generated
   - Redirecting to In-Challenge page

#### 2. Monitor Status
**Visual Indicators**:
- ✓ Green checkmark: Step completed
- ⏳ Spinner icon: Step in progress
- ⏸️ Gray: Step pending
- ❌ Red X: Step failed (rare)

**Status Messages**:
- "Pulling Docker image: kali-linux:latest..."
- "Waiting for container health check..."
- "Configuring network gateway..."
- "Almost ready! Finalizing setup..."

#### 3. Cancel Deployment
**Cancel Button**:
- Available throughout deployment
- Click action:
  1. Shows confirmation dialog
  2. Stops deployment process
  3. Cleans up partial resources
  4. Returns to Challenge Preview page

**Confirmation Dialog**:
```
Cancel Deployment?

This will stop the deployment and return you to
the challenge page. No session will be created.

[Continue Deploying] [Cancel Deployment]
```

### Deployment Timing

**Local Docker** (Development):
- Total time: 20-40 seconds
- Fastest if images are cached

**AWS Fargate** (Production):
- Total time: 40-90 seconds
- Depends on image size and region

**If Deployment Fails**:
- Error message displayed
- Reason shown (e.g., "Resource limit exceeded")
- "Try Again" button
- "Contact Support" link

### UI Elements

| Element | Type | Purpose |
|---------|------|---------|
| Progress Bar | Animated | Visual progress |
| Step List | Status Icons | Detailed steps |
| Timer | Live Countdown | Time remaining |
| Cancel Button | Secondary Action | Abort deployment |

### Real-Time Updates
- Progress updates every 2-3 seconds
- WebSocket connection to backend
- Auto-redirect when complete
- No user interaction required (unless cancel)

### Error Handling

**Common Errors**:
- **Timeout**: "Deployment taking longer than expected. Please wait..."
- **Resource Limit**: "Container limit reached. Try again later."
- **Image Pull Failed**: "Failed to pull Docker image. Contact support."
- **Network Error**: "Connection lost. Reconnecting..."

**Recovery Options**:
- Automatic retry (3 attempts)
- Manual retry button
- Cancel and return to Challenges

---

## 4. In-Challenge Page

**Route**: `/in-challenge/:sessionId/:scenarioId`  
**Access**: Users with active session  
**Purpose**: Main challenge interface - environment access and questions

**Note**: This is the **most complex page** in the platform

### Visual Layout

```
┌────────────────────────────────────────────────────────┐
│ SQL Injection Lab  ⏱️ 45:30  🎯 25/100  [Pause][Exit] │
├────────────────────────────────────────────────────────┤
│ [Mission] [Machines] [Questions] [Assets] [Hints]     │
├──────────────┬─────────────────────────────────────────┤
│ Left Panel   │ Right Panel                            │
│ (Resizable)  │                                        │
│              │                                        │
│ Mission Tab: │ SSH Terminal (if machine selected):   │
│              │ ┌────────────────────────────────────┐ │
│ Mission text │ │ root@kali:~# ls -la               │ │
│ objectives   │ │ total 48                          │ │
│ scenario     │ │ drwx------ 5 root root 4096 ...   │ │
│ details      │ │ -rw-r--r-- 1 root root  220 ...   │ │
│              │ │ root@kali:~# _                    │ │
│              │ └────────────────────────────────────┘ │
│              │ [Copy Session Log] [Download Log]    │
│              │                                        │
│ Questions:   │ Web Browser (if web access):          │
│              │ ┌────────────────────────────────────┐ │
│ Q1. Multiple │ │ 🌐 http://192.168.1.10            │ │
│ Choice       │ ├────────────────────────────────────┤ │
│ [Submit]     │ │ [Vulnerable Web App UI]           │ │
│              │ │                                    │ │
│ Q2. Short    │ │                                    │ │
│ Answer       │ └────────────────────────────────────┘ │
│ [Submit]     │                                        │
└──────────────┴─────────────────────────────────────────┘
```

### What Users Can Do

#### 1. Monitor Session Status (Top Bar)

##### Session Timer
- **Display**: "45:30" (minutes:seconds remaining)
- **Color Coding**:
  - Green: > 15 minutes left
  - Yellow: 5-15 minutes left
  - Red: < 5 minutes left
- **Behavior**:
  - Counts down in real-time
  - Flashes when < 5 minutes
  - Warning toast at 10 min, 5 min, 1 min

##### Score Display
- **Format**: "25/100 points"
- **Updates**: Real-time after each correct answer
- **Color**: Green if above 70%, yellow if 50-70%, red if below 50%

##### Session Controls
- **Pause Button**:
  - Pauses timer and containers
  - Click again to resume
  - Icon changes: ⏸️ ↔️ ▶️

- **Exit Button**:
  - Opens exit dialog
  - Options: Keep session or terminate
  - See details in "Exit Session" section below

#### 2. Navigate Content Tabs (Left Panel)

**Tab 1: Mission**
- Full mission briefing (HTML formatted)
- Objectives list
- Success criteria
- Code of ethics reminder
- Scrollable if long content

**Tab 2: Machines**
- List of all environment machines
- For each machine:
  - Name and icon
  - Status indicator (Green=Running, Yellow=Starting, Red=Error)
  - Access methods available
  - Connection buttons

**Machine Card Example**:
```
┌────────────────────────────────┐
│ 💻 Kali Linux (Attacker)       │
│ Status: ● Running              │
│ IP: 192.168.1.5                │
│                                │
│ [🖥️ SSH Terminal]              │
│ Credentials:                   │
│ User: root                     │
│ Pass: ••••• [👁️ Show] [📋 Copy] │
└────────────────────────────────┘

┌────────────────────────────────┐
│ 🌐 Web Server (Victim)         │
│ Status: ● Running              │
│ IP: 192.168.1.10               │
│                                │
│ [🌐 Open Browser]              │
│ URL: http://192.168.1.10       │
└────────────────────────────────┘
```

**Tab 3: Questions**
- All challenge questions listed
- Numbered sequentially
- Color-coded status:
  - Gray: Unanswered
  - Yellow: Partially answered (for multi-part)
  - Green: Correct
  - Red: Incorrect (if instant validation)
- Click to jump to specific question

**Tab 4: Assets**
- Downloadable files provided by creator
- Each asset shows:
  - File name
  - File size
  - Description
  - Download button
- Click to download to local machine

**Asset Example**:
```
📄 database_schema.sql (12 KB)
Database schema for the web application
[Download]

📄 wordlist.txt (245 KB)
Common password wordlist
[Download]
```

**Tab 5: Hints** (if enabled)
- Shows available hints
- Each hint:
  - Hint number
  - Point penalty (if applicable)
  - "View Hint" button (locked until clicked)
  - Once viewed: Hint text displayed

**Hint Interaction**:
1. Click "View Hint 1"
2. Confirmation: "This will deduct 5 points. Continue?"
3. Click "Yes" → Hint revealed
4. Hint text appears
5. Points deducted immediately

#### 3. Access Environment Machines (Right Panel)

##### SSH Terminal Access
**For machines with SSH**:
1. Click "SSH Terminal" button in Machines tab
2. Terminal opens in right panel
3. Auto-connects to container
4. Full terminal emulation (xterm.js)

**Terminal Features**:
- Full shell access (bash/sh)
- Copy/paste support (Ctrl+Shift+C/V)
- Tab completion
- Command history (arrow keys)
- Multiple terminal tabs (if multiple machines)

**Terminal Actions**:
- **Copy Session Log**: Copies all terminal output
- **Download Log**: Downloads .txt file of session
- **Clear Terminal**: Clears screen (doesn't affect session)
- **Reconnect**: If connection drops

##### Web Browser Access
**For machines with HTTP/HTTPS**:
1. Click "Open Browser" button
2. Embedded iframe loads web application
3. Interact with vulnerable app

**Browser Features**:
- Address bar (shows URL)
- Refresh button
- Open in new tab (pop-out)
- Responsive within panel

##### RDP Access (if applicable)
**For Windows machines**:
1. Click "RDP Connect" button
2. Opens RDP client (guacamole integration)
3. Full desktop experience
4. Mouse and keyboard input

#### 4. Answer Questions (Left Panel Questions Tab)

**Question Display**:
- Each question in expandable card
- Question number and type badge
- Point value
- Instructions
- Answer input fields
- Submit button per question

##### Question Type 1: Multiple Choice
**UI**:
- Radio buttons for single-select
- Checkboxes for multi-select
- Options labeled A, B, C, D...

**Interaction**:
1. Select one or more options
2. Click "Submit Answer"
3. Validation feedback (if instant validation)
4. Points awarded if correct

**Example**:
```
Q1. Which of the following is a SQL injection technique?
(Select all that apply)

☐ A. UNION-based injection
☐ B. Cross-site scripting
☐ C. Time-based blind injection
☐ D. Buffer overflow

[Submit Answer]
```

##### Question Type 2: Short Answer
**UI**:
- Text input field
- Character limit displayed
- Placeholder text (if provided)

**Interaction**:
1. Type answer
2. Click "Submit Answer"
3. System validates (exact match or fuzzy match)

**Example**:
```
Q2. What is the SQL function to extract database version?

Answer: [___________________________]
      (e.g., SELECT VERSION())

[Submit Answer]
```

##### Question Type 3: True/False
**UI**:
- Two radio buttons: True / False
- Simple binary choice

**Example**:
```
Q3. SQL injection can only exploit SELECT statements.

● True
○ False

[Submit Answer]
```

##### Question Type 4: Matching
**UI**:
- Two columns: Left (items), Right (matches)
- Dropdown selectors or drag-and-drop
- Match each left item to right item

**Example**:
```
Q4. Match the attack to the technique:

SQL Injection  →  [Select technique ▼]
XSS            →  [Select technique ▼]
CSRF           →  [Select technique ▼]

Options: Input validation bypass, Session hijacking,
         Script injection, etc.

[Submit Answer]
```

##### Question Type 5: Ordering
**UI**:
- List of items
- Drag handles to reorder
- Up/Down arrow buttons

**Example**:
```
Q5. Order the SQL injection steps:

1. [Identify injection point     ↕]
2. [Test for vulnerability       ↕]
3. [Extract database information ↕]
4. [Exploit the vulnerability    ↕]

Drag to reorder or use arrow buttons

[Submit Answer]
```

##### Question Type 6: Practical Task
**UI**:
- Task description
- File upload (if required)
- Command output field
- Validation instructions

**Example**:
```
Q6. Extract the admin password from the database.

Task: Use SQL injection to retrieve the password
      from the 'users' table where username='admin'

Answer: [___________________________]

Or upload result file: [Choose File]

[Submit Answer]
```

#### 5. Manage Session

##### Pause Session
1. Click "Pause" button in top bar
2. Timer stops
3. Containers pause (if supported) or remain running
4. Click "Resume" to continue
5. Timer resumes from where it stopped

##### Exit Session
1. Click "Exit" button in top bar
2. Exit dialog appears:

```
┌────────────────────────────────────┐
│ Exit Challenge?                    │
├────────────────────────────────────┤
│ Choose an option:                  │
│                                    │
│ ● Keep session running             │
│   Your environment will remain     │
│   active. You can resume later.    │
│                                    │
│ ○ Terminate session                │
│   This will stop all containers    │
│   and end your session. Progress   │
│   will be saved.                   │
│                                    │
│ [Cancel] [Confirm Exit]            │
└────────────────────────────────────┘
```

**Options**:
- **Keep Running**: Session stays active, can resume from Dashboard
- **Terminate**: Stops containers, saves answers, ends session

##### Automatic Session End
**When timer reaches 0:00**:
1. Auto-save all answers
2. Submit incomplete questions
3. Calculate final score
4. Terminate containers
5. Show completion dialog

#### 6. View Progress and Hints

##### Progress Indicator
- Shows: "3 of 8 questions answered"
- Progress bar: Visual completion
- Score updates in real-time

##### Hint System (if enabled)
1. Navigate to Hints tab
2. See list of available hints
3. Click "View Hint X"
4. Confirm point penalty
5. Hint appears
6. Penalty deducted from score

**Hint Example**:
```
Hint 1 (Cost: 5 points)
[View Hint]

After viewing:
─────────────────────
Try using ' OR '1'='1
in the username field
─────────────────────
Points remaining: 95/100
```

#### 7. Download Session Data

**Available Downloads**:
- **Terminal Logs**: Full command history
- **Assets**: Challenge files
- **Session Summary**: PDF report (after completion)

### UI Elements

| Element | Type | Purpose |
|---------|------|---------|
| Tab Navigation | Tabs | Switch content |
| Timer | Live Counter | Session time |
| Score Display | Live Value | Current points |
| Question Cards | Forms | Answer input |
| Terminal | Terminal Emulator | SSH access |
| Browser Panel | Iframe | Web access |
| Pause/Exit Buttons | Actions | Session control |

### Session States

**Running** (Green):
- Timer counting down
- Containers active
- Questions answerable

**Paused** (Yellow):
- Timer stopped
- Containers may be paused
- Questions read-only

**Completing** (Blue):
- Submitting final answers
- Calculating score
- Preparing results

**Completed** (Gray):
- Session ended
- Containers stopped
- Results available

### Answer Validation Modes

**Instant Validation**:
- Submit answer → Immediate feedback (Correct/Incorrect)
- Green checkmark or red X
- Points awarded immediately
- Can retry if incorrect (policy dependent)

**On Submit Validation**:
- Submit all answers at once
- Validation after session ends
- Results shown in completion dialog

**On Complete Validation**:
- Auto-submit when timer expires
- Validation after containers stop

### Completion Dialog

**When session ends**:
```
┌────────────────────────────────────┐
│ Challenge Completed! 🎉            │
├────────────────────────────────────┤
│ SQL Injection Fundamentals         │
│                                    │
│ Final Score: 85/100 points         │
│ Time Taken: 47 minutes             │
│ Questions Correct: 6 of 8          │
│                                    │
│ Badges Earned:                     │
│ 🏆 SQL Novice                      │
│                                    │
│ [View Leaderboard]                 │
│ [Try Again]                        │
│ [Back to Challenges]               │
└────────────────────────────────────┘
```

### Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| Ctrl + P | Pause/Resume |
| Ctrl + E | Exit dialog |
| Ctrl + H | View hints |
| Ctrl + M | Focus machines tab |
| Ctrl + Q | Focus questions tab |

---

## 5. Playlists Page

**Route**: `/playlists`  
**Access**: All authenticated users  
**Purpose**: Browse curated challenge collections

### Visual Layout

```
┌────────────────────────────────────────────────────────┐
│  Playlists                        [+ Create Playlist]  │
│  Curated challenge collections                         │
├────────────────────────────────────────────────────────┤
│  [🔍 Search playlists...]  [Category ▼] [Sort ▼]      │
├────────────────────────────────────────────────────────┤
│  Featured Playlists                                    │
│  ┌──────────────────────────────────────────┐         │
│  │ 🌟 Web Security Basics                   │         │
│  │ By: RangeX Team                          │         │
│  │ 5 challenges | 🟢 Beginner               │         │
│  │ Master web security fundamentals...      │         │
│  │ [View Playlist]                          │         │
│  └──────────────────────────────────────────┘         │
│                                                        │
│  Your Playlists (Creator only)                        │
│  ┌──────────────────┐  ┌──────────────────┐          │
│  │ SQL Mastery      │  │ Network Hacking  │          │
│  │ 8 challenges     │  │ 6 challenges     │          │
│  │ [Edit] [View]    │  │ [Edit] [View]    │          │
│  └──────────────────┘  └──────────────────┘          │
│                                                        │
│  All Playlists                                        │
│  [Playlist cards grid...]                            │
└────────────────────────────────────────────────────────┘
```

### What Users Can Do

#### 1. Browse Playlists
**Playlist Card Shows**:
- Title
- Creator name
- Number of challenges
- Difficulty level
- Description preview
- Completion progress (if started)

**Card Interaction**:
- Click anywhere → Opens Playlist Detail
- Hover → Shows expanded preview

#### 2. Search and Filter
**Search**:
- Search by title, creator, description
- Real-time filtering

**Filters**:
- Category (Web, Network, Forensics, etc.)
- Difficulty (Beginner, Intermediate, Advanced)
- Sort by: Newest, Popular, Most Challenges

#### 3. Create Playlist (Creator/Admin)
**Click "+ Create Playlist"**:
1. Opens creation form
2. Enter details:
   - Title
   - Description
   - Category
   - Difficulty
3. Add challenges (search and select)
4. Set order (drag to reorder)
5. Save playlist

**Only Creators and Admins can create**

#### 4. Manage Your Playlists (Creator)
**Your Playlists Section**:
- Shows playlists you created
- Edit button: Modify title, description, challenges
- Delete button: Remove playlist
- View button: See as users see it

#### 5. Track Progress
**On Playlist Cards**:
- Progress bar: "3 of 5 completed"
- Percentage: "60% complete"
- "Continue" button if in progress

---

## 6. Playlist Detail Page

**Route**: `/playlists/:id`  
**Access**: All authenticated users  
**Purpose**: View playlist details and start challenges

### Visual Layout

```
┌────────────────────────────────────────────────────────┐
│  ← Back to Playlists                                   │
├────────────────────────────────────────────────────────┤
│  Web Security Basics                                   │
│  By RangeX Team | 5 challenges | 🟢 Beginner          │
│                                                        │
│  Progress: ████████░░░░░░░░ 60% (3 of 5 complete)    │
│                                                        │
│  Master web security fundamentals through practical    │
│  challenges covering injection, XSS, and more.         │
│                                                        │
│  [▶ Start Next Challenge]  [❤️ Favorite]              │
├────────────────────────────────────────────────────────┤
│  Challenges in This Playlist                           │
│                                                        │
│  1. ✅ SQL Injection Basics (Completed)               │
│     Score: 95/100 | Time: 45 mins                     │
│     [View Results]                                     │
│                                                        │
│  2. ✅ XSS Fundamentals (Completed)                   │
│     Score: 88/100 | Time: 52 mins                     │
│     [View Results]                                     │
│                                                        │
│  3. ✅ CSRF Attack & Defense (Completed)              │
│     Score: 92/100 | Time: 38 mins                     │
│     [View Results]                                     │
│                                                        │
│  4. ⏳ Command Injection (In Progress)                │
│     Progress: 50% | 30 mins remaining                 │
│     [Continue]                                         │
│                                                        │
│  5. ⭕ Authentication Bypass (Not Started)            │
│     Estimated time: 60 mins                           │
│     [Start Challenge]                                  │
└────────────────────────────────────────────────────────┘
```

### What Users Can Do

#### 1. View Playlist Overview
**Header Information**:
- Playlist title
- Creator name (clickable)
- Total challenges count
- Overall difficulty level
- Description

#### 2. Track Playlist Progress
**Progress Bar**:
- Visual completion bar
- Percentage complete
- "X of Y completed"
- Updates after each challenge completion

#### 3. Navigate Challenges
**Challenge List**:
- Shows all challenges in order
- Each challenge displays:
  - Number and title
  - Status icon (✅ Complete, ⏳ In Progress, ⭕ Not Started)
  - Your score (if completed)
  - Time taken (if completed)
  - Action button

**Action Buttons**:
- **Start Challenge**: Begin new challenge
- **Continue**: Resume in-progress
- **View Results**: See completion details
- **Retry**: Attempt again (if allowed)

#### 4. Sequential Progression
**Linear Progression** (optional):
- Some playlists require completing in order
- Locked challenges show 🔒 icon
- Unlock after completing previous challenge

**Free Progression**:
- Can start any challenge
- Complete in any order

#### 5. Take Actions
**Start Next Challenge**:
- Automatically starts next incomplete challenge
- Skips completed ones
- Convenient for sequential completion

**Favorite Playlist**:
- Add to favorites for quick access
- Heart icon toggles on/off

**Share Playlist**:
- Copy link
- Share to team

---

## 7. Career Paths Page

**Route**: `/career-paths`  
**Access**: All authenticated users  
**Purpose**: Browse structured learning paths

### Visual Layout

```
┌────────────────────────────────────────────────────────┐
│  Career Paths                                          │
│  Structured learning journeys for cybersecurity skills │
├────────────────────────────────────────────────────────┤
│  ┌────────────────────────────────────────────────┐   │
│  │ 🎯 Web Application Security                    │   │
│  │ 12 challenges | 6 weeks | Intermediate         │   │
│  │                                                │   │
│  │ Progress: ██████░░░░░░░░░░ 50%               │   │
│  │ 6 of 12 completed                              │   │
│  │                                                │   │
│  │ Become proficient in web security through     │   │
│  │ hands-on practice with OWASP Top 10...        │   │
│  │                                                │   │
│  │ [Continue Path]                                │   │
│  └────────────────────────────────────────────────┘   │
│                                                        │
│  ┌────────────────────────────────────────────────┐   │
│  │ 🔐 Network Security Engineer                   │   │
│  │ 15 challenges | 8 weeks | Advanced             │   │
│  │ Not Started                                    │   │
│  │ [Start Path]                                   │   │
│  └────────────────────────────────────────────────┘   │
│                                                        │
│  [More career paths...]                               │
└────────────────────────────────────────────────────────┘
```

### What Users Can Do

#### 1. Browse Career Paths
**Path Card Shows**:
- Path title and icon
- Total challenges
- Estimated duration
- Difficulty level
- Description
- Your progress (if started)

#### 2. View Path Details
**Click card** → Opens Career Path Detail page

#### 3. Track Progress
**Progress Indicators**:
- Progress bar
- "X of Y completed"
- Estimated time remaining
- Current milestone

---

## 8. Career Path Detail Page

**Route**: `/career-paths/:id`  
**Access**: All authenticated users  
**Purpose**: View structured learning path with milestones

### Visual Layout

```
┌────────────────────────────────────────────────────────┐
│  ← Back to Career Paths                                │
├────────────────────────────────────────────────────────┤
│  🎯 Web Application Security                           │
│  12 challenges | 6 weeks | Intermediate               │
│                                                        │
│  Your Progress: ██████░░░░░░░░░░ 50% (6 of 12)       │
│  [▶ Continue Learning]                                │
├────────────────────────────────────────────────────────┤
│  Milestone 1: Fundamentals (✅ Complete)              │
│  ┌────────────────────────────────────────────────┐   │
│  │ 1. ✅ HTTP Basics                              │   │
│  │ 2. ✅ Web Application Architecture             │   │
│  │ 3. ✅ HTML & JavaScript Essentials             │   │
│  └────────────────────────────────────────────────┘   │
│                                                        │
│  Milestone 2: Injection Attacks (⏳ In Progress)      │
│  ┌────────────────────────────────────────────────┐   │
│  │ 4. ✅ SQL Injection Basics                     │   │
│  │ 5. ✅ Advanced SQL Injection                   │   │
│  │ 6. ⏳ NoSQL Injection (Current)                │   │
│  │ 7. ⭕ Command Injection                        │   │
│  └────────────────────────────────────────────────┘   │
│                                                        │
│  Milestone 3: Cross-Site Attacks (🔒 Locked)          │
│  Complete Milestone 2 to unlock                        │
│                                                        │
│  Milestone 4: Advanced Topics (🔒 Locked)             │
└────────────────────────────────────────────────────────┘
```

### What Users Can Do

#### 1. View Path Structure
**Milestones**:
- Grouped challenges by topic
- Sequential progression
- Status per milestone (Complete, In Progress, Locked)

#### 2. Navigate Challenges
**Per Challenge**:
- Status icon
- Title
- Action button (Start/Continue/Locked)
- Completion details

#### 3. Track Milestone Progress
**Progress Tracking**:
- Overall path progress
- Progress per milestone
- Next recommended challenge
- Achievements/badges earned

#### 4. Continue Learning
**Continue Button**:
- Automatically starts next incomplete challenge
- Follows recommended order
- Unlocks milestones sequentially

---

**Next**: [Part 3 - Social & Competition Pages →](UI_PART3_SOCIAL_EVENTS.md)
