# Part 4: Creator Pages

**Document**: UI Documentation - Creator Tools  
**Pages Covered**: 5 pages  
**User Roles**: Creator and Admin

---

## 📋 Table of Contents

1. [Scenario Builder](#1-scenario-builder)
2. [My Scenarios Page](#2-my-scenarios-page)
3. [Scenario Detail Page (Creator View)](#3-scenario-detail-page-creator-view)
4. [Requests Page](#4-requests-page)
5. [Favorites Page](#5-favorites-page)

---

## 1. Scenario Builder

**Route**: `/creator/new`  
**Access**: Creator and Admin roles  
**Purpose**: Create new cybersecurity scenarios (5-step wizard)

### Step 1: Basic Information

#### What Users Can Do

##### 1. Enter Scenario Details
- **Title**: Scenario name (3-100 characters)
- **Short Description**: Brief summary (max 200 chars)
- **Category**: Dropdown (Web, Network, Crypto, etc.)
- **Difficulty**: Easy, Intermediate, Hard, Impossible
- **Estimated Time**: Duration in minutes
- **Scenario Type**: Challenge, CTF, Assessment
- **Mode**: Single Player or Multi Player

##### 2. Upload Cover Image
- Click "Upload Image" button
- Select JPG/PNG (max 5MB)
- Preview appears
- Crop/resize tool

##### 3. Write Mission Briefing
- Rich text editor
- Support for:
  - Bold, italic, underline
  - Headers (H1-H6)
  - Bullet and numbered lists
  - Code blocks
  - Images and links
- Preview tab to see formatted output

##### 4. Add Tags
- Type tag and press Enter
- Suggested tags appear
- Remove tag by clicking X
- Max 10 tags

##### 5. Set Code of Ethics
- Checkbox: "This scenario requires ethical use"
- Text area for custom ethics statement
- Default statement provided

**Next Button** → Step 2

---

### Step 2: Environment Configuration

#### What Users Can Do

##### 1. Add Machines
Click "+ Add Machine" button

**Machine Configuration Form**:
- **Machine Name**: e.g., "Kali Attacker"
- **Role**: Attacker, Victim, Internal Server
- **Base Image**: Select from dropdown
  - Kali Linux 2024
  - Ubuntu 22.04
  - Windows Server 2022
  - Custom (provide Docker image name)
- **Resources**:
  - vCPU: 1-4 cores
  - Memory: 512MB-4GB
  - Storage: 10GB-50GB

##### 2. Configure Machine Access
**Entry Points**:
- **SSH**: Enable/disable, specify port
- **RDP**: For Windows machines
- **Web**: HTTP/HTTPS ports
- **Custom Ports**: Add additional exposed ports

**Solver Access**:
- Checkbox: "Allow solver to access this machine directly"
- If unchecked: Machine is internal only

**Credentials**:
- **SSH Username**: e.g., root, kali
- **SSH Password**: Auto-generated or custom
- **Provide to Solver**: On session start, after hint, never

##### 3. Add Multiple Machines
- Repeat process for each machine
- Must have at least 1 machine
- Can add up to 10 machines

##### 4. Configure Network
**Network Topology**:
- View network diagram
- All machines in same network by default
- Advanced: Create multiple networks (subnets)

##### 5. Docker Compose Integration (Optional)
- Upload docker-compose.yml file
- System parses and creates machines
- Overrides manual machine config
- Validate button checks syntax

**Back Button** → Step 1  
**Next Button** → Step 3

---

### Step 3: Questions

#### What Users Can Do

##### 1. Add Questions
Click "+ Add Question" button

**Question Types Supported**: 6 types

##### Type 1: Multiple Choice
**Configuration**:
- Question text (rich text editor)
- Add options (A, B, C, D, ...)
- Mark correct answer(s)
- Single select or multi-select
- Points value
- Explanation (shown after answer)

**Example**:
```
Question: Which port is SSH by default?
○ A. 21
○ B. 22  ✓ Correct
○ C. 23
○ D. 80
Points: 10
```

##### Type 2: Short Answer
**Configuration**:
- Question text
- Expected answer (exact or fuzzy match)
- Case sensitive? Yes/No
- Alternative answers (synonyms)
- Points value
- Hint available? Yes/No

**Example**:
```
Question: What command lists files in Linux?
Expected Answer: ls
Alternatives: dir, ll
Case Sensitive: No
Points: 10
```

##### Type 3: True/False
**Configuration**:
- Question statement
- Correct answer (True or False)
- Points value
- Explanation

**Example**:
```
Statement: SQL injection can only affect SELECT queries.
Answer: False
Points: 5
```

##### Type 4: Matching
**Configuration**:
- Question text
- Add pairs:
  - Left column items
  - Right column items
  - Correct matches
- Randomize order? Yes/No
- Points value

**Example**:
```
Match the attack to its category:
SQL Injection  →  Input Validation
XSS            →  Code Injection
CSRF           →  Session Management
Points: 15
```

##### Type 5: Ordering
**Configuration**:
- Question text
- Add items in correct order
- Items will be randomized for solver
- Points: Full credit for perfect order, partial for close

**Example**:
```
Order the SQL injection steps:
1. Identify injection point
2. Test for vulnerability
3. Extract data
4. Exploit
Points: 20
```

##### Type 6: Practical Task
**Configuration**:
- Task description
- Validation method:
  - File content check
  - Command output match
  - Flag submission
  - Manual review (admin checks)
- Expected output
- File upload required? Yes/No
- Points value

**Example**:
```
Task: Extract the admin password from the database
Validation: Flag format (FLAG{...})
Expected: FLAG{admin_password_here}
Points: 50
```

##### 2. Manage Questions
- Reorder questions (drag and drop)
- Edit question (pencil icon)
- Delete question (trash icon)
- Duplicate question (copy icon)
- Preview question (eye icon)

##### 3. Configure Scoring
**Scoring Policy**:
- All or Nothing: 100% correct = full points
- Partial Credit: Proportional points
- Weighted: Different questions worth different weights

**Validation Mode**:
- Instant: Feedback immediately after each answer
- On Submit: Feedback after submitting all answers
- On Complete: Feedback after session ends

**Hint Policy**:
- Disabled: No hints
- Free: Hints with no penalty
- Penalized: Deduct points per hint (specify amount)

##### 4. Add Hints (if enabled)
For each question:
- Click "Add Hint"
- Enter hint text
- Set penalty points
- Can add multiple hints per question (progressive)

**Back Button** → Step 2  
**Next Button** → Step 4

---

### Step 4: Assets & Resources

#### What Users Can Do

##### 1. Upload Assets
**Asset Types**:
- Files (scripts, configs, flags)
- Images (screenshots, diagrams)
- Documents (PDFs, READMEs)

**Upload Process**:
1. Click "+ Upload Asset" button
2. Select file(s) from computer
3. Drag and drop also supported
4. Fill asset details:
   - Display name
   - Description
   - Visibility: Always, After Hint, On Completion

##### 2. Manage Assets
**Asset List Shows**:
- File name and type icon
- File size
- Upload date
- Visibility setting
- Actions: Download, Edit, Delete

**Edit Asset**:
- Change name/description
- Replace file
- Update visibility

##### 3. Organize Assets
- Create folders (optional)
- Move assets to folders
- Bulk select and delete

**Back Button** → Step 3  
**Next Button** → Step 5

---

### Step 5: Review & Submit

#### What Users Can Do

##### 1. Review All Details
**Summary View**:
- **Basic Info**: Title, category, difficulty, duration
- **Machines**: Count and names
- **Questions**: Count by type
- **Assets**: Count and total size
- **Scoring**: Policy and total points

##### 2. Preview Scenario
**Preview Button**:
- Opens read-only preview
- Shows how solvers will see it
- Test layout and formatting

##### 3. Validate Configuration
**Validation Checks**:
- ✓ At least 1 machine configured
- ✓ At least 1 question added
- ✓ All required fields filled
- ⚠️ Warnings (non-blocking):
  - No cover image
  - No tags added
  - Difficulty may be too high

##### 4. Save as Draft
**Save Draft Button**:
- Saves work in progress
- Can return later to edit
- Not visible to admins yet

##### 5. Submit for Review
**Submit Button**:
- Final confirmation dialog
- Submits to admin approval queue
- Status changes to "Pending Review"
- Notification sent to admins
- Cannot edit while pending (unless admin rejects)

**Confirmation Dialog**:
```
Submit Scenario for Review?

Your scenario will be reviewed by admins before
publication. You will be notified of the decision.

Ensure all information is correct as you cannot
edit while the scenario is under review.

[Cancel] [Submit for Review]
```

**Back Button** → Step 4

---

## 2. My Scenarios Page

**Route**: `/creator/scenarios`  
**Access**: Creator and Admin  
**Purpose**: Manage created scenarios

### What Users Can Do

#### 1. View Scenario List
**Scenario Cards Show**:
- Title and cover image
- Status badge
- Creation date
- Version number
- Statistics (views, completions, rating)

**Status Badges**:
- 🟡 **Draft**: Not submitted
- 🟠 **Pending Review**: Awaiting admin approval
- ✅ **Published**: Live and available
- ❌ **Rejected**: Not approved by admin
- 🔄 **Changes Requested**: Admin feedback provided

#### 2. Filter Scenarios
**Filter Options**:
- All Scenarios
- Drafts
- Pending Review
- Published
- Rejected

**Sort Options**:
- Newest First
- Oldest First
- Most Popular
- Highest Rated

#### 3. Take Actions on Scenarios

##### For Drafts
- **Edit**: Continue editing in Scenario Builder
- **Submit**: Submit for review
- **Delete**: Permanently remove
- **Duplicate**: Create copy

##### For Pending Review
- **View**: See submitted version (read-only)
- **Withdraw**: Cancel submission, return to draft

##### For Published
- **View Stats**: See analytics (views, completions, ratings)
- **Create New Version**: Edit and create v2, v3, etc.
- **Unpublish**: Remove from public access
- **Duplicate**: Create new scenario based on this

##### For Rejected
- **View Feedback**: See admin's rejection reason
- **Edit & Resubmit**: Fix issues and submit again
- **Delete**: Remove scenario

#### 4. View Scenario Statistics
**Analytics for Published Scenarios**:
- Total attempts
- Completion rate
- Average score
- Average time
- Rating distribution
- User feedback/reviews

---

## 3. Scenario Detail Page (Creator View)

**Route**: `/creator/scenarios/:id`  
**Access**: Creator (owner) and Admin  
**Purpose**: Detailed view with creator-specific actions

### What Users Can Do

#### 1. View Complete Information
- All scenario details (same as solver view)
- Plus creator-specific data:
  - Submission history
  - Admin feedback
  - Version history
  - Analytics dashboard

#### 2. View Analytics
**Performance Metrics**:
- Daily attempt chart
- Completion rate trend
- Average scores over time
- Popular questions (hardest/easiest)

**User Engagement**:
- Favorites count
- Reviews and ratings
- Time spent analysis
- Drop-off points

#### 3. Manage Versions
**Version List**:
- v1.0 (Published) - 150 attempts
- v2.0 (Published) - 45 attempts
- v3.0 (Draft) - Not published

**Actions**:
- View any version
- Compare versions
- Roll back to previous version
- Publish new version

#### 4. Take Actions
- **Edit**: Open in Scenario Builder
- **Create Version**: Make new version (v2, v3, etc.)
- **Duplicate**: Create copy with new name
- **Unpublish**: Remove from public
- **Delete**: Permanently remove (confirmation required)

---

## 4. Requests Page

**Route**: `/requests`  
**Access**: Creator and Admin  
**Purpose**: Track approval status and admin feedback

### What Users Can Do

#### 1. View Submission Queue
**List Shows**:
- Scenario title
- Submission date
- Status (Pending, Approved, Rejected, Changes Requested)
- Admin reviewer (if assigned)

#### 2. Check Status Details
**For Each Submission**:
- Current status
- Submission timestamp
- Expected review time (e.g., "Within 48 hours")
- Admin assigned (if any)

#### 3. View Admin Feedback
**If Rejected or Changes Requested**:
- Reviewer name
- Review date
- Detailed feedback
- Specific issues to fix
- Suggestions for improvement

**Example Feedback**:
```
Status: Changes Requested
Reviewed by: AdminUser
Date: Jan 5, 2026

Feedback:
1. Mission briefing is too vague. Please add more details
   about the learning objectives.
2. Question 3 has a typo in option B.
3. Consider adding one more practical task question.

Please address these issues and resubmit.
```

#### 4. Resubmit Scenario
**For Rejected/Changes Requested**:
1. Click "Edit and Resubmit" button
2. Opens Scenario Builder with current version
3. Make required changes
4. Submit again
5. Enters approval queue again

#### 5. Withdraw Submission
- Click "Withdraw" button
- Returns scenario to Draft status
- Can edit without resubmitting

---

## 5. Favorites Page

**Route**: `/favorites`  
**Access**: All authenticated users  
**Purpose**: Quick access to favorited challenges

### What Users Can Do

#### 1. View Favorited Challenges
- Grid of scenario cards
- All challenges marked as favorite
- Same card layout as Challenges page

#### 2. Filter Favorites
- By difficulty
- By category
- By completion status (Not started, In progress, Completed)

#### 3. Take Actions
- **Start**: Begin challenge
- **Continue**: Resume in-progress
- **View**: See details
- **Unfavorite**: Remove from favorites (heart icon)

#### 4. Sort Favorites
- Recently added
- Alphabetical
- Difficulty
- Not started first

---

**Next**: [Part 5 - Admin Pages →](UI_PART5_ADMIN.md)
