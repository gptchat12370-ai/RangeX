# Part 5: Admin Pages

**Document**: UI Documentation - Admin Tools  
**Pages Covered**: 11 pages  
**User Roles**: Admin only

---

## 📋 Table of Contents

1. [Admin Console](#1-admin-console)
2. [Scenario Approvals Page](#2-scenario-approvals-page)
3. [Admin Testing Page](#3-admin-testing-page)
4. [Deployment Management Page](#4-deployment-management-page)
5. [Container Management Page](#5-container-management-page)
6. [Admin System Settings](#6-admin-system-settings)
7. [Cost Dashboard](#7-cost-dashboard)
8. [Badge Management](#8-badge-management)
9. [Career Paths Management](#9-career-paths-management)
10. [Admin Tools & Links](#10-admin-tools--links)
11. [Admin Scenarios Page](#11-admin-scenarios-page)

---

## 1. Admin Console

**Route**: `/admin`  
**Access**: Admin only  
**Purpose**: System overview dashboard

### What Users Can Do

#### 1. View System Statistics
**Overview Cards**:
- **Pending Approvals**: Count of scenarios awaiting review
- **Active Sessions**: Current running sessions
- **Total Users**: User count (Solvers, Creators, Admins)
- **System Health**: Green/Yellow/Red status
- **Budget Usage**: RM XXX / RM XXX (percentage)
- **Container Usage**: X of Y containers running

#### 2. Quick Actions
**Action Buttons**:
- "Review Scenarios" → Scenario Approvals
- "Monitor Costs" → Cost Dashboard
- "View Containers" → Container Management
- "System Settings" → Admin Settings

#### 3. View Recent Activity
**Activity Feed**:
- Last 20 admin actions
- Scenario submissions
- User registrations
- System events
- Timestamp and admin username

#### 4. Check Alerts
**Alert Panel**:
- 🔴 Critical: Budget exceeded, System errors
- 🟡 Warning: High resource usage, Pending reviews
- 🟢 Info: Successful deployments, Completed reviews

---

## 2. Scenario Approvals Page

**Route**: `/admin/approvals` or `/admin/scenario-approvals`  
**Access**: Admin only  
**Purpose**: Review and approve/reject creator scenarios

### What Users Can Do

#### 1. View Approval Queue
**Scenario List**:
- Scenario title and creator
- Submission date
- Category and difficulty
- Preview button
- Assign to me button

**Filters**:
- All pending
- Assigned to me
- Unassigned
- Priority (based on waiting time)

#### 2. Preview Scenario
**Click scenario card**:
- View all details (mission, machines, questions)
- Read-only mode
- See creator's submission notes
- Check for completeness

#### 3. Test Scenario
**"Test Scenario" Button**:
- Deploys scenario in admin test mode
- Opens Admin Testing Page
- Admin can attempt questions
- Verify environment works correctly

#### 4. Approve Scenario
**After review**:
1. Click "Approve" button
2. Optional: Add admin notes (visible to creator)
3. Confirm approval
4. Scenario status → Published
5. Creator receives approval notification
6. Scenario appears in Challenges page

**Approval Confirmation**:
```
Approve "SQL Injection Lab"?

This scenario will be published and available to all users.

Admin Notes (optional):
[Great scenario! Well-structured questions.]

[Cancel] [Approve]
```

#### 5. Reject Scenario
**If scenario has issues**:
1. Click "Reject" button
2. **Required**: Provide detailed feedback
3. List specific issues
4. Suggest improvements
5. Confirm rejection
6. Scenario status → Rejected
7. Creator receives feedback notification

**Rejection Form**:
```
Reject "SQL Injection Lab"?

Please provide detailed feedback for the creator.
This is required.

Rejection Reason:
[Issues found:
1. Mission briefing lacks clear objectives
2. Question 3 has incorrect answer marked
3. Docker image name is invalid

Please fix these issues and resubmit.]

[Cancel] [Reject with Feedback]
```

#### 6. Request Changes
**For minor issues**:
1. Click "Request Changes" button
2. Provide specific feedback
3. Scenario status → Changes Requested
4. Creator can edit and resubmit
5. Returns to queue after resubmission

---

## 3. Admin Testing Page

**Route**: `/admin/testing`  
**Access**: Admin only  
**Purpose**: Test scenarios before approval

### What Users Can Do

#### 1. Deploy Test Environment
- Same as In-Challenge page
- Marked as "Admin Test Session"
- Does not count toward statistics
- Can be terminated anytime

#### 2. Test All Features
**Environment Access**:
- Connect to all machines
- Test SSH, RDP, Web access
- Verify credentials work
- Check network connectivity

**Question Testing**:
- Attempt all questions
- Verify correct answers
- Test validation logic
- Check hints (if enabled)

#### 3. Take Admin Notes
**Notes Panel** (unique to admin):
- Text area for observations
- Save notes to scenario
- Visible during approval decision
- Notes shown: "Tested on Jan 7, 2026 by AdminUser"

#### 4. Report Issues
**If Problems Found**:
- Click "Report Issue" button
- Describe problem
- Attach screenshots
- Issue sent to creator with rejection

#### 5. Approve/Reject from Test
**Quick Actions**:
- "Approve Now" button (if test passes)
- "Reject with Notes" (if issues found)
- Notes auto-populated from admin notes

---

## 4. Deployment Management Page

**Route**: `/admin/deployments`  
**Access**: Admin only  
**Purpose**: Monitor and manage all active deployments

### What Users Can Do

#### 1. View All Deployments
**Deployment List Shows**:
- Deployment ID
- User (who started it)
- Scenario name
- Status (Provisioning, Running, Stopping, Failed)
- Start time
- Duration
- Resource usage
- Containers count

#### 2. Filter Deployments
**Filter Options**:
- Status: All, Running, Provisioning, Failed
- Environment: Local Docker, AWS Fargate
- User: Search by username
- Scenario: Search by scenario name

#### 3. Monitor Individual Deployment
**Click deployment row**:
- View detailed status
- See all containers
- Check health status
- View logs (last 100 lines)
- Resource usage graphs (CPU, Memory)

#### 4. Take Actions
**Per Deployment**:
- **Stop**: Gracefully stop session
- **Force Stop**: Immediately terminate
- **Restart**: Stop and start again
- **View Logs**: Download full logs
- **Extend Time**: Add more time (if requested by user)

#### 5. Manage Failed Deployments
**For Failed Status**:
- View error message
- See failure reason
- Retry button (attempts deployment again)
- Contact user button (send notification)

---

## 5. Container Management Page

**Route**: `/admin/containers`  
**Access**: Admin only  
**Purpose**: Low-level container monitoring

### What Users Can Do

#### 1. View All Containers
**Container List**:
- Container ID
- Name (scenario + machine name)
- Status (Running, Stopped, Error)
- Image name
- Created time
- Uptime
- Resource usage (CPU%, Memory%)

#### 2. Filter Containers
- Platform: All, Local Docker, AWS Fargate
- Status: All, Running, Stopped, Error
- Search by name or ID

#### 3. View Container Details
**Click container**:
- Full container ID
- Image details
- Network configuration
- Port mappings
- Environment variables
- Resource limits
- Volume mounts

#### 4. Access Container
**Actions**:
- **Logs**: View container logs (real-time)
- **Stats**: CPU, Memory, Network, Disk I/O graphs
- **Shell**: Open terminal inside container (debug)
- **Restart**: Restart container
- **Stop**: Stop container
- **Remove**: Delete container (confirmation required)

#### 5. Bulk Actions
- Select multiple containers (checkboxes)
- Stop selected
- Remove selected (dangerous)
- Export logs for selected

#### 6. Cleanup Orphaned Containers
**"Cleanup" Button**:
- Finds containers without associated sessions
- Lists orphaned containers
- Allows bulk deletion
- Frees up resources

---

## 6. Admin System Settings

**Route**: `/admin/system-settings`  
**Access**: Admin only  
**Purpose**: Configure platform parameters

### What Users Can Do

#### 1. General Settings
**Configuration Options**:
- **Platform Name**: Display name
- **Admin Email**: Contact email
- **Max Concurrent Sessions per User**: Default 3
- **Session Timeout**: Default 90 minutes
- **Registration**: Open, Closed, Invite-only

#### 2. Feature Flags
**Enable/Disable Features**:
- ☑ User registration
- ☑ Creator applications
- ☑ Team creation
- ☑ Event creation (admin only)
- ☑ Leaderboards
- ☑ Badge system
- ☑ Notifications

#### 3. Container Limits
**Resource Constraints**:
- Max containers system-wide: 50
- Max containers per user: 5
- Max session duration: 120 minutes
- Auto-cleanup idle time: 30 minutes

#### 4. Deployment Settings
**AWS Configuration**:
- Default region: ap-southeast-1
- Fargate vs Local preference
- Spot instances: Enable/disable
- VPC settings (read-only)

#### 5. Notification Settings
**Email Templates**:
- Approval notification
- Rejection notification
- Welcome email
- Password reset
- Customize subject and body

#### 6. Maintenance Mode
**System Maintenance**:
- Toggle maintenance mode
- Display message to users
- Allow admin access only
- Schedule maintenance window

**Activation**:
```
Enable Maintenance Mode?

All non-admin users will be logged out and prevented
from accessing the platform. Display this message:

[System maintenance in progress. Expected completion: 2 hours]

[Cancel] [Enable Maintenance Mode]
```

#### 7. Save Settings
- "Save Changes" button
- Confirmation for critical changes
- Settings applied immediately

---

## 7. Cost Dashboard

**Route**: `/admin/costs`  
**Access**: Admin only  
**Purpose**: Monitor and optimize AWS spending

### What Users Can Do

#### 1. View Cost Summary
**Overview Cards**:
- **Current Month**: RM XXX
- **Last Month**: RM XXX
- **Budget**: RM XXX / RM XXX (percentage bar)
- **Projected**: RM XXX (based on current usage)
- **Savings**: RM XXX (from optimizations)

#### 2. View Cost Breakdown
**Charts**:
- Pie chart: Cost by service (ECS, ECR, VPC, Data Transfer)
- Line graph: Daily spending trend (last 30 days)
- Bar chart: Cost by scenario (top 10 expensive)

#### 3. Analyze Resource Usage
**Fargate Usage**:
- Total vCPU hours
- Total Memory GB-hours
- On-Demand vs Spot split (show savings)
- Task count trend

**ECR Usage**:
- Storage size (GB)
- Image count
- Data transfer out
- Cost per image

**Data Transfer**:
- Internet egress
- VPC endpoints
- Cross-region (if any)

#### 4. Set Budget Alerts
**Alert Configuration**:
- Monthly budget: RM XXX
- Alert at: 80%, 100%
- Email recipients: admin@rangex.com
- Send daily reports: Yes/No

**Alert Rules**:
```
Budget Alert Rule #1:
When monthly cost reaches 80% (RM 160 of RM 200),
send email to admin@rangex.com

[Edit] [Delete]

+ Add New Rule
```

#### 5. Optimize Costs
**Optimization Suggestions**:
- "Delete unused Docker images (save RM 15/month)"
- "Increase Spot usage from 80% to 90% (save RM 8/month)"
- "Remove old task definitions (save RM 2/month)"

**Actions**:
- One-click apply suggestions
- Manual cleanup tools
- Schedule cleanups

#### 6. Export Cost Reports
- Download CSV (last 30 days)
- Generate PDF report
- Email report to stakeholders

---

## 8. Badge Management

**Route**: `/admin/badges`  
**Access**: Admin only  
**Purpose**: Create and manage achievement badges

### What Users Can Do

#### 1. View All Badges
**Badge List**:
- Icon preview
- Badge name
- Category (Skill, Completion, Special)
- Rarity (Common, Rare, Epic, Legendary)
- Earned count (how many users have it)
- Edit/Delete buttons

#### 2. Create New Badge
**Click "+ Create Badge"**:

**Badge Details**:
- **Name**: e.g., "SQL Master"
- **Description**: "Complete 10 SQL challenges with 90%+ score"
- **Category**: Skill, Completion, Event, Special
- **Rarity**: Common, Rare, Epic, Legendary
- **Icon**: Upload image (PNG, 256x256px)

**Requirements**:
- **Type**: Scenario completion, Score threshold, Challenge count, etc.
- **Criteria**: Define specific rules

**Examples**:
```
Requirement Type: Challenge Completion Count
Category: Web Security
Count: 10
Min Score: 90

OR

Requirement Type: Specific Scenario
Scenario: "SQL Injection Lab"
Min Score: 100
```

#### 3. Edit Badge
- Click Edit button
- Modify details
- Cannot change requirements if users already earned it
- Save changes

#### 4. Delete Badge
- Click Delete button
- Warning: "X users have this badge. Delete anyway?"
- Confirmation required
- Badge removed from all user profiles

#### 5. Award Badge Manually
**Manual Award**:
- Search for user
- Select badge
- Click "Award Badge"
- Reason (optional)
- User receives notification

**Use Case**: Special recognition, event prizes

---

## 9. Career Paths Management

**Route**: `/admin/career-paths` or `/admin/career-paths/new`  
**Access**: Admin only  
**Purpose**: Create learning pathways

### What Users Can Do

#### 1. View All Career Paths
**Path List**:
- Title and description
- Scenario count
- Enrolled users
- Completion rate
- Edit/Delete buttons

#### 2. Create New Career Path
**Click "+ Create Career Path"**:

**Basic Info**:
- **Title**: e.g., "Web Security Professional"
- **Description**: Full description
- **Difficulty**: Beginner, Intermediate, Advanced
- **Duration**: Estimated weeks

**Milestones**:
1. Add milestone (e.g., "Fundamentals")
2. Add scenarios to milestone
3. Set order
4. Repeat for each milestone

**Example Structure**:
```
Career Path: Web Security Professional

Milestone 1: Fundamentals (4 scenarios)
- HTTP Basics
- Web App Architecture
- HTML & JS Essentials
- Browser Security

Milestone 2: Injection Attacks (5 scenarios)
- SQL Injection Basics
- Advanced SQL Injection
- NoSQL Injection
- Command Injection
- LDAP Injection

Milestone 3: XSS & CSRF (3 scenarios)
...
```

#### 3. Edit Career Path
- Modify title/description
- Add/remove scenarios
- Reorder milestones
- Change progression (linear vs free)

#### 4. Delete Career Path
- Removes path
- Users enrolled will see "Path discontinued"
- Progress preserved

---

## 10. Admin Tools & Links

**Route**: `/admin/tools`  
**Access**: Admin only  
**Purpose**: Quick access to external tools

### What Users Can Do

#### 1. Database Management
**phpMyAdmin** (or similar):
- Link to database interface
- View tables, run queries
- Backup database
- **Warning**: Direct access - be careful!

#### 2. Object Storage
**MinIO Console**:
- Link to MinIO dashboard (port 9001)
- View buckets (rangex-assets, etc.)
- Upload/download files manually
- Monitor storage usage

#### 3. AWS Console
**Quick Links**:
- ECS Cluster dashboard
- ECR Repositories
- CloudWatch Logs
- VPC Configuration
- Billing Dashboard

#### 4. Logs Viewer
**Application Logs**:
- Backend API logs (last 1000 lines)
- Frontend errors (if centralized)
- Search logs by keyword
- Filter by level (Info, Warn, Error)
- Download logs

#### 5. System Information
**Platform Info**:
- Frontend version
- Backend version
- Database version
- Docker version
- Uptime
- Last deployment date

---

## 11. Admin Scenarios Page

**Route**: `/admin/scenarios`  
**Access**: Admin only  
**Purpose**: Manage all scenarios with admin privileges

### What Users Can Do

#### 1. View All Scenarios
**List includes**:
- All scenarios (any status)
- Draft, Pending, Published, Rejected
- From all creators

**Columns**:
- Title
- Creator
- Status
- Created date
- Last updated
- Attempts count
- Rating

#### 2. Filter and Search
- Status: All, Draft, Pending, Published, Rejected
- Creator: Search by username
- Category: All categories
- Difficulty: All difficulties
- Sort: Newest, Oldest, Most Popular, Highest Rated

#### 3. Take Admin Actions

##### Force Publish
- Override approval process
- Publish scenario immediately
- Use for urgent scenarios or admin-created

##### Unpublish
- Remove from public access
- Scenario still exists
- Creator can see and edit

##### Feature Scenario
- Mark as "Featured"
- Shows on homepage
- Special badge on card

##### Delete Scenario
- Permanently remove
- All versions deleted
- Associated data removed
- Confirmation with password required

**Deletion Confirmation**:
```
⚠️ Delete "SQL Injection Lab"?

This will permanently delete the scenario and all
associated data (attempts, ratings, etc.).

This action CANNOT be undone!

Type the scenario title to confirm:
[_____________________________]

Enter your admin password:
[_____________________________]

[Cancel] [Permanently Delete]
```

#### 4. View Scenario Analytics
**System-wide Stats**:
- Total attempts across all users
- Completion rate
- Average score
- Time spent analysis
- User feedback

#### 5. Bulk Operations
- Select multiple scenarios
- Bulk publish
- Bulk unpublish
- Bulk category change
- Bulk delete (very dangerous)

---

## 🔒 Admin Security Features

### Permission Checks
- All admin pages verify admin role
- Session must be valid
- Sensitive actions require password confirmation
- Audit log for all admin actions

### Audit Logging
**All Admin Actions Logged**:
- Who (admin username)
- What (action performed)
- When (timestamp)
- Where (page/resource)
- Details (e.g., "Approved scenario #123")

**View Audit Logs**:
- Searchable by admin, action, date
- Export to CSV
- Retention: 1 year

### Two-Factor Authentication (Optional)
- Require 2FA for admin accounts
- TOTP-based (Google Authenticator)
- Backup codes generated

---

**Navigation**: [← Back to Index](UI_DOCUMENTATION_INDEX.md)

---

**End of UI Documentation**  
**Total Pages Documented**: 35+  
**Last Updated**: January 7, 2026  
**Status**: ✅ Complete
