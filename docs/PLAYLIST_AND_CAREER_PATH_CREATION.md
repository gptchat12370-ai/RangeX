# Playlist and Career Path Creation Features

## Overview
Enhanced playlist and career path management with dedicated creation pages and "Add to Playlist" functionality on every challenge.

## New Features

### 1. Create Playlist Page (`/playlists/new`)
**Available to**: All users

**Features**:
- Full-page dedicated creation form
- Accessible from:
  - "Create Playlist" button in Playlists page header
  - Empty state in "My Playlists" tab
- **Form Fields**:
  - Title (required)
  - Description (multi-line textarea)
  - Tags (comma-separated)
  - Public/Private toggle with Switch component
  - Challenge selection with checkboxes
- **Challenge Selection**:
  - Scrollable list of all available challenges
  - Shows challenge title, category, and difficulty badge
  - Visual highlighting when selected
  - Counter showing number of selected challenges
  - Search through 10+ mock challenges
- **Actions**:
  - Cancel (returns to playlists page)
  - Create Playlist (validates title is present)
  - Toast notification on success
  - Auto-navigation back to playlists page after creation

### 2. Create Career Path Page (`/admin/career-paths/new`)
**Available to**: Admins only

**Features**:
- Full-page dedicated creation form
- Accessible from:
  - "Create Path" button in Career Paths page header (admin only)
  - Admin console career paths management
- **Form Fields**:
  - Path Title (required)
  - Difficulty Level dropdown (Beginner, Intermediate, Advanced, Beginner to Advanced)
  - Theme Color dropdown (Blue, Red, Green, Purple, Orange, Cyan)
  - Estimated Duration (e.g., "12 weeks")
  - Description (multi-line textarea)
  - Tags (comma-separated)
- **Content Selection** (Tabbed Interface):
  - **Playlists Tab**: 
    - Multi-select existing playlists with checkboxes
    - Shows playlist title and scenario count
    - Visual highlighting when selected
  - **Challenges Tab**: 
    - Multi-select individual challenges with checkboxes
    - Shows challenge title and difficulty badge
    - Visual highlighting when selected
  - Tab headers show count of selected items
- **Actions**:
  - Cancel (returns to career paths page)
  - Create Career Path (validates title and at least one playlist/challenge)
  - Toast notification on success
  - Auto-navigation back to career paths page after creation

### 3. Add to Playlist Dialog
**Available on**: Every challenge card via ListPlus icon button

**Features**:
- Icon button with tooltip "Add to Playlist"
- Opens modal dialog with tabbed interface
- **Two Tabs**:
  
  **Tab 1: Add to Existing**
  - Scrollable list of user's existing playlists
  - Shows playlist title, public/private badge, and challenge count
  - Multi-select with custom checkbox styling (checkmark when selected)
  - Visual highlighting for selected playlists
  - Empty state if no playlists exist (with "Create Your First Playlist" button)
  - Button shows count: "Add to X Playlist(s)"
  - Disabled if no playlists selected
  
  **Tab 2: Create New**
  - Quick playlist creation form:
    - Title (required)
    - Description (optional)
    - Public/Private toggle
  - Info message: "This playlist will be created with [challenge name] as the first challenge"
  - "Create & Add" button (disabled if no title)
  - Automatically includes the current challenge in the new playlist

**Actions**:
- Cancel button in both tabs
- "Add to X Playlists" in existing tab
- "Create & Add" in new tab
- Toast notifications for success
- Dialog closes after action

### 4. Challenge Card Enhancement
**Component**: `ScenarioCard.tsx`

**New Elements**:
- Added ListPlus icon button in card footer
- Positioned between "Start" and "Heart" buttons
- Tooltip on hover: "Add to Playlist"
- Opens AddToPlaylistDialog when clicked
- Passes challenge ID and title to dialog

**Layout**:
```
[Start Button (full width)] [Add to Playlist] [Favorite] [Share]
```

## Routes Added

### New Routes:
- `/playlists/new` - Create Playlist Page
- `/admin/career-paths/new` - Create Career Path Page (updated from placeholder)

### Updated Routes:
- `/admin/career-paths/new` - Now uses CreateCareerPathPage component instead of placeholder

## Components Created

### 1. `/pages/CreatePlaylistPage.tsx`
- Full-page playlist creation form
- Challenge multi-select with ScrollArea
- Public/private toggle
- Tags input
- Navigation back to playlists

### 2. `/pages/CreateCareerPathPage.tsx`
- Full-page career path creation form
- Tabbed interface for playlists and challenges
- Theme color and difficulty selection
- Duration and tags inputs
- Navigation back to career paths

### 3. `/components/AddToPlaylistDialog.tsx`
- Reusable dialog component
- Two tabs: "Add to Existing" and "Create New"
- Handles both quick creation and adding to existing
- Empty state handling
- Toast notifications
- Can be used anywhere challenges are displayed

## User Flows

### Flow 1: Create Playlist from Playlists Page
1. User navigates to Playlists page
2. Clicks "Create Playlist" button in header (or in empty state)
3. Fills in title, description, tags
4. Toggles public/private as desired
5. Selects challenges from scrollable list
6. Clicks "Create Playlist"
7. Toast notification confirms creation
8. Redirected back to Playlists page

### Flow 2: Create Career Path (Admin)
1. Admin navigates to Career Paths page
2. Clicks "Create Path" button (only visible to admins)
3. Fills in path details (title, level, color, duration, description, tags)
4. Switches to Playlists tab, selects playlists to include
5. Switches to Challenges tab, selects individual challenges
6. Clicks "Create Career Path"
7. Toast notification confirms creation
8. Redirected back to Career Paths page

### Flow 3: Add Challenge to Playlist from Challenge Card
1. User browses challenges on Dashboard or Challenges page
2. Hovers over ListPlus icon (sees "Add to Playlist" tooltip)
3. Clicks ListPlus icon
4. Dialog opens with two options:
   
   **Option A: Add to Existing**
   - Selects one or more existing playlists
   - Clicks "Add to X Playlists"
   - Toast confirms addition
   - Dialog closes
   
   **Option B: Create New**
   - Fills in new playlist title
   - Optionally adds description
   - Toggles public/private
   - Clicks "Create & Add"
   - New playlist created with challenge included
   - Toast confirms creation
   - Dialog closes

### Flow 4: Create First Playlist via Challenge Card
1. User (with no playlists) clicks ListPlus on a challenge
2. Dialog opens to "Add to Existing" tab
3. Sees empty state: "You don't have any playlists yet"
4. Clicks "Create Your First Playlist" button
5. Redirected to full playlist creation page (`/playlists/new`)
6. Can create comprehensive playlist with multiple challenges

## Technical Details

### Data Management
- Mock data for challenges and playlists
- State management for form inputs
- Multi-select state for checkboxes
- Validation for required fields

### UI Components Used
- Dialog/AlertDialog for modals
- Tabs for organizing content
- ScrollArea for long lists
- Checkbox for multi-select
- Switch for toggles
- Badge for status indicators
- Tooltip for icon button hints
- Toast notifications (sonner)

### Styling
- Consistent cyber-border styling
- Visual highlighting for selected items
- Hover effects on interactive elements
- Responsive layouts
- Color-coded badges (difficulty, public/private)

### Accessibility
- Proper label associations with htmlFor
- Keyboard navigation support
- ARIA attributes via shadcn components
- Tooltip for icon-only button
- Clear visual feedback

## Integration Points
- Routes configured in App.tsx
- Career Paths page checks user role for "Create Path" button visibility
- Playlists page updated to navigate to creation page
- ScenarioCard enhanced with AddToPlaylistDialog
- All pages use consistent navigation patterns

## Future Enhancements
- Real API integration for CRUD operations
- Drag-and-drop reordering of challenges in playlists
- Bulk actions (add multiple challenges at once)
- Playlist/career path templates
- Import/export functionality
- Analytics on playlist usage
- Collaborative playlists
- Playlist recommendations based on user progress
