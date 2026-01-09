# Admin Console Guide

## Overview
The Admin Console has been completely restructured with a modern tabbed interface for better organization and navigation. All administrative functions are now accessible from a single page with 7 dedicated tabs.

## New Structure

### Main Admin Console Page
**Location:** `/pages/admin/AdminConsolePage.tsx`

The Admin Console now features a tabbed navigation system with 7 main sections:

#### 1. Dashboard Tab
- **Component:** `AdminDashboard.tsx`
- **Features:**
  - Key metrics cards (Pending Approvals, Active Sessions, Total Users, Total Scenarios)
  - Resource usage monitoring (CPU, Memory, Environment Capacity)
  - Budget tracking and cost monitoring
  - Quick overview tabs for approvals, sessions, and recent activity
  - Quick action buttons

#### 2. Sessions Tab
- **Component:** `SessionsMonitoringPage.tsx` (NEW)
- **Features:**
  - Real-time monitoring of all active environment sessions
  - Session statistics (Active, Total Today, Avg Duration, Total Cost)
  - Advanced filtering by status (Running, Completed, Error)
  - Search by user, scenario, or email
  - Session management actions (Restart, Terminate)
  - Detailed session information (Resource profile, Duration, Cost)

#### 3. Users Tab
- **Component:** `UsersManagementPage.tsx`
- **Features:**
  - User statistics (Total, Active, Pending, Suspended, by Role)
  - Advanced filtering by role and status
  - User search by username or email
  - User management actions (Edit, Suspend, Delete, Send Email)
  - User activity tracking (scenarios completed/created)
  - Export functionality

#### 4. Approvals Tab
- **Component:** `ScenarioApprovalsPage.tsx`
- **Features:**
  - Review pending scenario submissions
  - 5-tab detailed review interface (Overview, Topology, Questions, Testing, Feedback)
  - Test environment capability
  - Approve/Reject workflow with notes
  - Scenario metadata and creator information

#### 5. Images & Tools Tab
- **Component:** `ImagesToolsPage.tsx` (NEW - Replaces old VM Templates)
- **Features:**
  - **Docker Images Catalog:**
    - Add, edit, delete Docker images
    - Search and filter by category
    - Copy image names to clipboard
    - Toggle allowed/restricted status
    - Tag management
  - **Security Tools Catalog:** (NEW - Replaces VM Templates)
    - Pre-approved security tools library
    - Tool information (Name, Version, Category, Description)
    - Docker image or install command for each tool
    - Popularity tracking
    - Add, edit, delete tools
    - Category filtering
    - Includes popular tools: Nmap, Metasploit, Burp Suite, Wireshark, John the Ripper, etc.

#### 6. Settings Tab
- **Component:** `PlatformSettingsPage.tsx` (NEW)
- **Features:**
  - **General Settings:**
    - Platform name, URL, support email
    - Max concurrent sessions
    - Maintenance mode toggle
  - **Security Settings:**
    - Session timeout configuration
    - Password requirements
    - MFA enforcement
    - Public registration control
    - Email verification requirements
  - **Resource Management:**
    - Default resource profiles
    - Max session duration
    - Auto-terminate idle sessions
    - Per-user resource quotas
  - **Budget & Cost:**
    - Monthly budget limits
    - Cost alert thresholds
    - Budget alert email configuration
  - **Email Configuration:**
    - SMTP settings
    - Test email functionality
  - **Notifications:**
    - Slack webhook integration
    - Notification preferences for approvals, errors, budget alerts

#### 7. Audit Logs Tab
- **Component:** `AuditLogsPage.tsx` (NEW)
- **Features:**
  - Complete audit trail of all administrative actions
  - Log statistics (Total, Successful, Failed, Unique Users)
  - Comprehensive log details (Timestamp, User, Action, Category, Resource, IP Address, Status)
  - Advanced filtering by category (Scenario, User, Session, Settings, Image, Auth)
  - Search across all log fields
  - Export functionality
  - Color-coded action types and status indicators
  - Categories tracked:
    - Scenario approvals/rejections
    - User management actions
    - Session management
    - Platform settings changes
    - Image/tool modifications
    - Authentication events

## Navigation

### Accessing the Admin Console
- Click "Admin Console" in the sidebar (visible only to Admin users)
- Navigate to `/admin`

### Tab Navigation
- All tabs are accessible from the top navigation bar
- Pending approvals badge shows count when there are scenarios awaiting review
- Tabs are horizontally scrollable on mobile devices

### Removed Routes
The following standalone routes have been removed in favor of the tabbed interface:
- `/admin/sessions` (now a tab)
- `/admin/users` (now a tab)
- `/admin/images` (now a tab)
- `/admin/settings` (now a tab)
- `/admin/logs` (now a tab)

The `/admin/approvals` and `/admin/approvals/:id` routes remain for scenario review detail pages.

## Key Improvements

1. **Unified Interface:** All admin functions accessible from one page
2. **Better Organization:** Clear separation of concerns with dedicated tabs
3. **Enhanced Tools Management:** VM Templates replaced with comprehensive Security Tools catalog
4. **New Capabilities:**
   - Session monitoring and management
   - Platform-wide settings configuration
   - Complete audit logging
5. **Improved UX:**
   - Fewer page loads
   - Consistent navigation
   - Better mobile responsiveness
6. **Enhanced CRUD Operations:**
   - Full edit/delete capabilities for images and tools
   - Confirmation dialogs for destructive actions
   - Inline status toggles

## Security Tools (New Feature)

The Tools catalog includes pre-approved security tools that can be used in scenarios:

### Categories:
- Network Scanning (Nmap, etc.)
- Exploitation (Metasploit, etc.)
- Web Testing (Burp Suite, Gobuster, SQLMap, etc.)
- Network Analysis (Wireshark, etc.)
- Password Cracking (John the Ripper, Hashcat, etc.)

### Tool Information:
- Name and version
- Description
- Category
- Docker image (if available)
- Install command (if applicable)
- Popularity rating
- Allowed/Restricted status

This replaces the old VM Templates system with a more flexible and comprehensive tool management system.

## Design Consistency

All new components maintain the RangeX cyber theme:
- Gradient stat cards with color-coded metrics
- Cyber-border styling
- Consistent use of badges for status indicators
- Action menus with icons
- Search and filter capabilities
- Responsive grid layouts
