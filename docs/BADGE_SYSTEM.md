# Badge System Documentation

## Overview

The RangeX platform includes a comprehensive badge system that allows administrators to create badges and link them to specific scenario requirements. Users can track their progress toward earning badges and see which challenges they need to complete.

## System Architecture

### Database Tables

#### badge
- `id` (VARCHAR(36), PRIMARY KEY)
- `name` (VARCHAR(255)) - Badge name (e.g., "Penetration Tester")
- `description` (TEXT) - Badge description
- `iconUrl` (VARCHAR(255)) - URL to badge icon/avatar
- `criteria` (VARCHAR(255)) - Text description of requirements (e.g., "Complete 10 challenges")
- `createdAt` (DATETIME)
- `updatedAt` (DATETIME)

#### user_badge
- `id` (VARCHAR(36), PRIMARY KEY)
- `userId` (VARCHAR(36), FOREIGN KEY → user.id)
- `badgeId` (VARCHAR(36), FOREIGN KEY → badge.id)
- `earnedAt` (DATETIME) - When badge was awarded
- `createdAt` (DATETIME)

#### badge_requirement
- `id` (VARCHAR(36), PRIMARY KEY)
- `badgeId` (VARCHAR(36), FOREIGN KEY → badge.id) - CASCADE on delete
- `scenarioId` (VARCHAR(36), FOREIGN KEY → scenario.id) - SET NULL on delete
- `requirementType` (VARCHAR(50)) - Type of requirement (default: 'scenario_completion')
- `createdAt` (DATETIME)

### Backend Entities

#### BadgeRequirement Entity
```typescript
@Entity({ name: 'badge_requirement' })
export class BadgeRequirement {
  @PrimaryGeneratedColumn('uuid')
  id: string;
  
  @Column({ type: 'varchar', length: 36 })
  badgeId: string;
  
  @Column({ type: 'varchar', length: 36, nullable: true })
  scenarioId?: string;
  
  @Column({ type: 'varchar', length: 50, default: 'scenario_completion' })
  requirementType: string;
  
  @ManyToOne(() => Badge, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'badgeId' })
  badge?: Badge;
  
  @ManyToOne(() => Scenario, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'scenarioId' })
  scenario?: Scenario;
  
  @CreateDateColumn({ type: 'datetime' })
  createdAt: Date;
}
```

## API Endpoints

### Admin Badge Management (`/admin/badges`)

**GET /admin/badges**
- Returns all badges with their requirements
- Response: `Badge[]` with nested `requirements[]`

**GET /admin/badges/:id**
- Returns a single badge with requirements
- Response: `Badge` with nested `requirements[]`

**POST /admin/badges**
- Create a new badge
- Body: `{ name, description, iconUrl?, criteria }`
- Response: Created `Badge`

**PUT /admin/badges/:id**
- Update an existing badge
- Body: `{ name?, description?, iconUrl?, criteria? }`
- Response: Updated `Badge`

**DELETE /admin/badges/:id**
- Delete a badge (cascade deletes requirements and user badges)
- Response: `{ deleted: true }`

**POST /admin/badges/:id/upload-icon**
- Upload a custom icon for a badge
- Body: FormData with 'file' field
- Accepts: JPEG, PNG, GIF, WebP, SVG (max 2MB)
- Response: `{ iconUrl: string }`

**POST /admin/badges/:badgeId/requirements**
- Add a scenario requirement to a badge
- Body: `{ scenarioId }`
- Response: Created `BadgeRequirement`

**DELETE /admin/badges/requirements/:requirementId**
- Remove a scenario requirement
- Response: `{ deleted: true }`

**POST /admin/badges/:badgeId/grant/:userId**
- Manually grant a badge to a user
- Response: Created `UserBadge`

**GET /admin/badges/progress/:userId**
- Get detailed badge progress for a user (admin view)
- Response: Array of badge progress objects

### Public Badge Endpoints (`/badges`)

**GET /badges**
- List all available badges with requirements
- Response: `Badge[]` with nested `requirements[]`

**GET /badges/progress/:userId**
- Get badge progress for a specific user
- Response: Array of:
  ```typescript
  {
    badge: Badge,
    requirements: [
      {
        scenarioId: string,
        scenarioName: string,
        completed: boolean
      }
    ],
    earned: boolean,
    earnedAt?: Date,
    progress: number (0-100),
    completedCount: number,
    totalCount: number
  }
  ```

## Badge Auto-Grant Logic

The system automatically checks and grants badges when users complete scenarios. This happens in the `AccountController.checkAndGrantBadges()` method, which is called whenever `/account/me` is accessed.

### Two Badge Types

#### 1. Count-Based Badges (Legacy/Simple)
- No entries in `badge_requirement` table
- Criteria parsed from `badge.criteria` string (e.g., "Complete 10 challenges")
- Granted when user completes >= required number of challenges
- Example: "First Steps" badge for 1 challenge

#### 2. Scenario-Specific Badges (New System)
- Has entries in `badge_requirement` table linking to specific scenarios
- Granted when user has completed ALL required scenarios
- Example: "Penetration Tester" badge requiring SQL Injection, XSS, and CSRF scenarios

### Auto-Grant Algorithm

```typescript
private async checkAndGrantBadges(userId: string, challengesCompleted: number) {
  const badges = await this.badgeRepo.find();

  for (const badge of badges) {
    // Skip if user already has badge
    const existing = await this.userBadgeRepo.findOne({ 
      where: { userId, badgeId: badge.id } 
    });
    if (existing) continue;

    // Get requirements
    const requirements = await this.requirementRepo.find({
      where: { badgeId: badge.id },
    });

    if (requirements.length === 0) {
      // COUNT-BASED: Parse criteria string
      const criteriaMatch = badge.criteria?.match(/(\d+)\s*challenges?/i);
      if (criteriaMatch) {
        const requiredCount = parseInt(criteriaMatch[1]);
        if (challengesCompleted >= requiredCount) {
          // GRANT BADGE
          const userBadge = this.userBadgeRepo.create({ userId, badgeId: badge.id });
          await this.userBadgeRepo.save(userBadge);
        }
      }
    } else {
      // SCENARIO-SPECIFIC: Check all requirements
      let allRequirementsMet = true;

      for (const req of requirements) {
        if (req.scenarioId) {
          const completed = await this.sessionRepo.findOne({
            where: {
              userId,
              scenarioVersionId: req.scenarioId,
              status: 'terminated',
            },
          });

          if (!completed) {
            allRequirementsMet = false;
            break;
          }
        }
      }

      if (allRequirementsMet && requirements.length > 0) {
        // GRANT BADGE
        const userBadge = this.userBadgeRepo.create({ userId, badgeId: badge.id });
        await this.userBadgeRepo.save(userBadge);
      }
    }
  }
}
```

## Frontend Pages

### Badge Management Page (Admin)
**Route:** `/admin/badges`

**Features:**
- Create new badges with name, description, criteria, and icon
- Upload custom badge icons (images)
- Select multiple scenarios as requirements
- Edit existing badges
- Delete badges
- View all badge requirements

**Location:** `frontend/src/pages/BadgeManagementPage.tsx`

### Badge Progress Page (Users)
**Route:** `/badges/progress`

**Features:**
- View all badges with progress indicators
- Filter by: All, Earned, In Progress
- Progress bars showing scenario completion (X/Y scenarios)
- Checkmarks for completed requirements
- Lock icons for locked badges
- Earned date display
- Visual distinction for earned badges (golden gradient border)

**Location:** `frontend/src/pages/BadgeProgressPage.tsx`

## User Experience

### For Users

1. **View Badge Progress:**
   - Click avatar → "Badges" menu item
   - See all available badges
   - Filter earned/in-progress badges
   - View which scenarios are required for each badge
   - Track completion progress with visual indicators

2. **Earn Badges:**
   - Complete required scenarios
   - Badge automatically granted when all requirements met
   - Badge appears in profile and progress page
   - Earned badge shown with golden border and trophy icon

### For Admins

1. **Create Badge:**
   - Go to Admin Console → Badges tab
   - Click "Create Badge"
   - Enter name, description, criteria
   - Optionally add icon URL or upload custom icon
   - Select required scenarios (or leave empty for count-based)
   - Click "Create"

2. **Edit Badge:**
   - Click "Edit" on existing badge
   - Modify fields
   - Update scenario requirements
   - Click "Update"

3. **Upload Custom Icon:**
   - Click "Icon" button on badge card
   - Select image file (JPEG, PNG, GIF, WebP, SVG)
   - Icon automatically updated

4. **Delete Badge:**
   - Click trash icon
   - Confirm deletion
   - Badge, requirements, and user awards deleted

5. **Manually Grant Badge:**
   - Use API: `POST /admin/badges/:badgeId/grant/:userId`
   - Useful for special achievements or events

## Example Badge Configurations

### Simple Count-Based Badge
```json
{
  "name": "Rising Star",
  "description": "Complete your first 10 challenges",
  "criteria": "Complete 10 challenges",
  "iconUrl": "https://api.dicebear.com/7.x/icons/svg?seed=star&icon=shield",
  "requirements": []
}
```
**How it works:** Automatically granted when user completes 10 or more challenges (any scenarios).

### Scenario-Specific Badge
```json
{
  "name": "Penetration Tester",
  "description": "Master the fundamentals of penetration testing",
  "criteria": "Complete SQL Injection, XSS Attack, and CSRF Demo scenarios",
  "iconUrl": "https://example.com/pentester.png",
  "requirements": [
    { "scenarioId": "abc-123", "scenarioName": "SQL Injection 101" },
    { "scenarioId": "def-456", "scenarioName": "XSS Attack Lab" },
    { "scenarioId": "ghi-789", "scenarioName": "CSRF Demo" }
  ]
}
```
**How it works:** Only granted when user completes ALL three specific scenarios.

## Technical Notes

### Icon Storage
- Badge icons can be:
  - External URLs (e.g., DiceBear API)
  - Uploaded images stored in MinIO/S3 via `AssetStorageService`
  - Default: DiceBear placeholder if not specified

### Performance Considerations
- Badge auto-check runs on every `/account/me` call
- Consider caching user badge status if performance becomes an issue
- Scenario completion check uses indexed database queries

### Scenario Completion Detection
- A scenario is "completed" when `environment_session.status = 'terminated'`
- Matches on `scenarioVersionId` (not scenario name)
- Historical: If user completed scenario before requirement added, it counts

### Future Enhancements
1. **Badge Categories:** Group badges by type (Security, Networking, etc.)
2. **Badge Levels:** Bronze/Silver/Gold tiers for same badge
3. **Hidden Badges:** Secret badges revealed only when earned
4. **Badge Notifications:** Toast notification when badge earned
5. **Leaderboard Integration:** Show top badge earners
6. **Badge Sharing:** Share badges on social media
7. **Requirement Types:** Add "complete X scenarios in category Y" requirements
8. **Time-Based Requirements:** "Complete scenario in under 30 minutes"

## Troubleshooting

### Badge not granted after completing requirements
1. Check if requirements are linked to correct `scenarioVersionId`
2. Verify `environment_session.status = 'terminated'` for completed scenarios
3. Check if user already has badge (`user_badge` table)
4. Trigger auto-check by accessing `/account/me`

### Custom icon not displaying
1. Verify file is valid image format (JPEG, PNG, GIF, WebP, SVG)
2. Check file size < 2MB
3. Ensure MinIO/S3 bucket is publicly accessible
4. Check `badge.iconUrl` in database is correct

### Progress shows 0% despite completing scenarios
1. Verify `badge_requirement` entries exist for badge
2. Check `scenarioId` matches `scenarioVersionId` in requirements
3. Ensure scenario completion is recorded in `environment_session` table

## Security Considerations

- Badge creation/editing requires admin role
- Badge granting is automatic based on verified scenario completion
- Manual badge granting (admin only) auditable via API
- Icon uploads validated for file type and size
- No user-submitted badge names/descriptions (admin only)

## Data Integrity

- `badge_requirement.badgeId` CASCADE DELETE: Deleting badge removes all requirements
- `badge_requirement.scenarioId` SET NULL: Deleting scenario keeps requirement but nullifies link
- `user_badge.badgeId` CASCADE DELETE: Deleting badge removes all user awards
- `user_badge.userId` CASCADE DELETE: Deleting user removes all earned badges
