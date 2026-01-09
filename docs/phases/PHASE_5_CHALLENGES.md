# Phase 5: Challenge System & Question Management

**Duration**: 4 weeks  
**Status**: ✅ Complete  
**Completion**: 100%

[← Back to Phase 4](./PHASE_4_SECURITY.md) | [Phase Index](../RANGEX_PROJECT_PHASES.md) | [Continue to Phase 6 →](./PHASE_6_DOCKER.md)

---

## 📋 Phase Overview

Phase 5 implemented the complete educational content system including scenario creation wizard, question types, career paths, playlists, events, and gamification features.

---

## 🎯 Objectives

- ✅ 5-step scenario creation wizard
- ✅ 6 question types (MCQ, Short Answer, Practical Task, True/False, Matching, Ordering)
- ✅ Validation & scoring policies
- ✅ Career paths & playlists
- ✅ Events & competitions
- ✅ Badge & achievement system
- ✅ Leaderboards & rankings
- ✅ Team collaboration

---

## 📝 Scenario Creation Wizard

### Step 1: Overview
- Title & description
- Difficulty (Easy/Intermediate/Hard/Impossible)
- Category & tags
- Estimated duration
- Cover image upload

### Step 2: Environment
- Machine topology builder
- Docker container selection
- VM template selection
- Network configuration
- Resource profiles
- Tool auto-installation

### Step 3: Mission & Rules
- Rich text editor (TipTap)
- Mission objectives
- Code of ethics
- Lab credentials
- Hints & resources

### Step 4: Questions
- Add multiple questions
- MCQ with 2-6 options
- Short answer with regex validation
- Practical tasks with subtasks
- Points allocation
- Validation policies
- Scoring policies
- Hint systems

### Step 5: Preview & Publish
- Review all configuration
- Test locally (optional)
- Publish or save as draft
- Version management

---

## ❓ Question Types (6 Types)

### 1. Multiple Choice (MCQ)
```typescript
{
  type: 'MCQ',
  text: 'Which port is used for HTTPS?',
  options: [
    { text: '80', isCorrect: false },
    { text: '443', isCorrect: true },
    { text: '8080', isCorrect: false },
    { text: '3000', isCorrect: false }
  ],
  shuffleOptions: true,
  points: 10
}
```

**Features:**
- 2-6 answer options
- Multiple correct answers support
- Shuffle options to prevent cheating
- Partial credit scoring

### 2. Short Answer
```typescript
{
  type: 'ShortAnswer',
  text: 'What is the flag in /etc/passwd?',
  acceptedAnswers: ['FLAG{abc123}', 'FLAG{ABC123}'],
  useRegexMatching: false,
  caseSensitiveMatching: false,
  points: 20
}
```

**Features:**
- Multiple accepted answers
- Optional case sensitivity
- Regex pattern matching support
- Whitespace normalization
- Input sanitization (10,000 char limit)

**Advanced Example with Regex:**
```typescript
{
  type: 'ShortAnswer',
  text: 'Enter any valid IP address in the 192.168.1.x range',
  acceptedAnswers: ['^192\\.168\\.1\\.(1|10|100)$'],
  useRegexMatching: true,
  points: 15
}
```

### 3. True/False
```typescript
{
  type: 'TrueFalse',
  text: 'SQL injection is a client-side attack',
  correctAnswer: false,
  points: 5
}
```

**Features:**
- Simple boolean validation
- Quick assessment questions
- Low point value (typically 5-10 points)

### 4. Matching
```typescript
{
  type: 'Matching',
  text: 'Match the tools with their purposes',
  matchingPairs: [
    { id: '1', left: 'Nmap', right: 'Port Scanning' },
    { id: '2', left: 'Wireshark', right: 'Packet Analysis' },
    { id: '3', left: 'Metasploit', right: 'Exploitation Framework' },
    { id: '4', left: 'John the Ripper', right: 'Password Cracking' }
  ],
  points: 20
}
```

**Features:**
- Pair validation (not order-dependent)
- Structure checking for security
- Type validation
- Configurable pair count

**Validation:**
- Checks all pairs exist
- Validates correct left-right matches
- Prevents injection via malformed data

### 5. Ordering
```typescript
{
  type: 'Ordering',
  text: 'Arrange the steps of the TCP handshake in correct order',
  orderingItems: [
    { id: '1', text: 'SYN', correctOrder: 1 },
    { id: '2', text: 'SYN-ACK', correctOrder: 2 },
    { id: '3', text: 'ACK', correctOrder: 3 }
  ],
  points: 15
}
```

**Features:**
- Sequential order validation
- ID-based comparison (ignores properties)
- Array size limit (max 100 items)
- Length matching verification

**Student Submits:** `['2', '1', '3']` (IDs in their chosen order)  
**System Checks:** Compares with correct order `['1', '2', '3']`

### 6. Practical Task
```typescript
{
  type: 'PracticalTask',
  text: 'Exploit the web server and gain root access',
  subtasks: [
    { 
      id: '1',
      text: 'Find the SQL injection vulnerability', 
      points: 10,
      verifier: 'manual' 
    },
    { 
      id: '2',
      text: 'Execute the exploit to bypass authentication', 
      points: 15,
      verifier: 'script'
    },
    { 
      id: '3',
      text: 'Escalate privileges to root', 
      points: 15,
      verifier: 'script'
    },
    { 
      id: '4',
      text: 'Retrieve the flag from /root/flag.txt', 
      points: 10,
      verifier: 'text'
    }
  ],
  totalPoints: 50
}
```

**Features:**
- Multi-step challenges
- Per-step scoring (partial credit)
- Multiple verification methods:
  - `manual`: Creator marks completion
  - `script`: Automated verification script
  - `text`: Flag/answer submission
- Progress tracking

---

## 🎓 Career Paths

### Implementation
```typescript
@Entity()
export class CareerPath {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  title: string; // e.g., "SOC Analyst Track"

  @Column('text')
  description: string;

  @OneToMany(() => CareerPathItem, item => item.careerPath)
  items: CareerPathItem[];
}

@Entity()
export class CareerPathItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => CareerPath)
  careerPath: CareerPath;

  @ManyToOne(() => ScenarioVersion)
  scenarioVersion: ScenarioVersion;

  @Column()
  order: number;

  @Column({ default: false })
  required: boolean;
}
```

---

## 📚 Playlists

### Features
- Public/private visibility
- Follow/unfollow
- Add/remove scenarios
- Rating system
- Creator attribution

---

## 🏆 Events & Competitions

### Event Types
- **Scheduled**: Future start time
- **Live**: Currently running
- **Ended**: Completed events

### Event Features
```typescript
@Entity()
export class Event {
  @PrimaryGeneratedColumn('uuid')
  id6 question types with validation:
  - MCQ (Multiple Choice)
  - Short Answer (with regex & case sensitivity options)
  - True/False
  - Matching (pair validation)
  - Ordering (sequence validation)
  - Practical Task (multi-step with verifiers)
- ✅ Advanced validation features:
  - Regex pattern matching for short answers
  - Whitespace normalization
  - Case sensitivity toggle
  - Security safeguards (ReDoS prevention, input limits)

  @Column()
  title: string;

  @Column()
  startTime: Date;

  @Column()
  endTime: Date;

  @Column()
  minParticipants: number;

  @Column()
  maxParticipants: number;

  @Column('enum')
  joinPolicy: 'Auto' | 'RequireApproval' | 'AllowLateJoin';

  @Column('enum')
  privacy: 'Visible' | 'PasswordProtected';

  @Column({ nullable: true })
  password: string;

  @OneToMany(() => EventScenario, es => es.event)
  scenarios: EventScenario[];
}
```

---

## 🎮 Gamification

### Badge System
```typescript
@Entity()
export class Badge {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string; // "First Blood", "Speed Demon", etc.

  @Column('text')
  description: string;

  @Column()
  iconUrl: string;

  @OneToMany(() => BadgeRequirement, req => req.badge)
  requirements: BadgeRequirement[];
}

@Entity()
export class BadgeRequirement {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Badge)
  badge: Badge;

  @Column()
  criterion: string; // "complete_scenarios", "earn_points", etc.

  @Column()
  threshold: number; // e.g., 10 scenarios, 1000 points
}
```

### Leaderboards
- Global rankings
- Monthly rankings
- Weekly rankings
- Event-specific leaderboards
- Team leaderboards

---

## 👥 Team System

### Team Features
```typescript
@Entity()
export class Team {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ nullable: true })
  motto: string;

  @Column()
  country: string;

  @Column('text', { nullable: true })
  description: string;

  @Column({ default: true })
  openRegistration: boolean;

  @Column()
  createdById: string;

  @OneToMany(() => TeamMember, member => member.team)
  members: TeamMember[];
}
```

---

## 📊 Phase Deliverables

- ✅ 5-step scenario wizard (frontend + backend)
- ✅ 3 question types with validation
- ✅ Career path system
- ✅ Playlist system
- ✅ Event/competition system
- ✅ Badge & achievement system
- ✅ Leaderboard system
- ✅ Team collaboration
- ✅ Scoring & validation logic
- ✅ Content organization

---

**Last Updated**: January 6, 2026  
**Phase Status**: ✅ Complete