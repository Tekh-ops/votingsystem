# 🗳️ Election Management and Monitoring System - JavaScript Implementation

A full-featured election management and monitoring system built with **Bun** and **Hono**, showcasing comprehensive use of data structures: **LinkedList**, **HashTable**, **BinarySearchTree**, **Queue**, **Stack**, and **SelectionTree**.

## 🎯 Features

- **User Management**: Registration, authentication with admin PIN verification
- **Election Management**: Create elections, manage phases, add candidates
- **Manifesto System**: Candidates can create detailed manifestos with promises
- **Voting System**: Secure vote casting with one-vote-per-election enforcement
- **Real-time Predictions**: AI-powered predictions using online datasets
- **Tally System**: Efficient vote counting using SelectionTree
- **CSV Export**: Export votes for multi-machine aggregation
- **Data Persistence**: All data saved to CSV files

## 📚 Data Structures Showcase

### 1. **LinkedList** (`src/ds/LinkedList.js`)
**Purpose**: Store collections of users, elections, and votes in memory

**Time Complexity**: 
- Insert/Delete at head/tail: O(1)
- Search: O(n)

**Used For**:
- `app.users`: All registered users
- `app.elections`: All elections
- `app.votes`: All cast votes
- Sequential iteration for display/export

**Implementation Highlights**:
```javascript
// Adding a user
this.users.push(user);

// Iterating through elections
this.elections.forEach(election => {
  // Process election
});
```

---

### 2. **HashTable** (`src/ds/HashTable.js`)
**Purpose**: Fast O(1) average-case lookups

**Time Complexity**: 
- Insert/Get/Delete: O(1) average, O(n) worst case (collision)

**Used For**:
- `userById`: Quick user lookup by ID
- `userByEmail`: Fast email-based authentication
- `electionById`: Quick election access
- `hasVoted`: Track if voter has already voted (key: `electionId_voterId`)
- `sessions`: Map session tokens to user objects

**Implementation Highlights**:
```javascript
// O(1) user lookup
const user = this.userById.get(userId);

// Check if already voted
const key = `${electionId}_${voterId}`;
if (this.hasVoted.has(key)) {
  return { error: 'Already voted' };
}
```

---

### 3. **BinarySearchTree** (`src/ds/BinarySearchTree.js`)
**Purpose**: Maintain sorted order for efficient range queries

**Time Complexity**: 
- Insert/Search: O(log n) average, O(n) worst case (unbalanced)

**Used For**:
- `electionsByDate`: Elections sorted by start time for chronological display
- `usersByName`: Users sorted alphabetically
- Performance history tracking in prediction module

**Implementation Highlights**:
```javascript
// Insert election sorted by date
this.electionsByDate.insert(election, election.startTime);

// In-order traversal (sorted output)
this.electionsByDate.inOrder(election => {
  console.log(election.title);
});
```

---

### 4. **Queue** (`src/ds/Queue.js`)
**Purpose**: Process operations in FIFO order

**Time Complexity**: 
- Enqueue/Dequeue: O(1)

**Used For**:
- `auditQueue`: Buffer audit log entries before writing to disk
- `operationQueue`: Process async operations in order
- `predictionQueue`: Batch process prediction requests

**Implementation Highlights**:
```javascript
// Queue audit log entry
this.auditQueue.enqueue({
  type: 'VOTE_CAST',
  voteId: vote.id,
  timestamp: new Date().toISOString()
});

// Process queue later
while (!this.auditQueue.isEmpty()) {
  const entry = this.auditQueue.dequeue();
  // Process entry
}
```

---

### 5. **Stack** (`src/ds/Stack.js`)
**Purpose**: Manage undo/redo operations and WAL replay

**Time Complexity**: 
- Push/Pop/Peek: O(1)

**Used For**:
- `undoStack`: Store operations for undo functionality
- `redoStack`: Store undone operations for redo
- WAL (Write-Ahead Log) replay in correct order

**Implementation Highlights**:
```javascript
// Push operation to undo stack
this.undoStack.push({
  type: 'PHASE_CHANGE',
  electionId,
  oldPhase: election.phase,
  newPhase: phase
});

// Undo last operation
const lastOp = this.undoStack.pop();
// Restore state
```

---

### 6. **SelectionTree** (`src/ds/SelectionTree.js`)
**Purpose**: Efficiently find winner and top-k candidates

**Time Complexity**: 
- Build: O(n)
- Winner query: O(log n)
- Update: O(log n)

**Used For**:
- Finding election winner quickly after vote counting
- Maintaining top candidates during live voting
- Efficient winner determination without full sort

**Implementation Highlights**:
```javascript
// Build selection tree from vote counts
const selectionTree = new SelectionTree(counts);

// Get winner in O(log n) time
const winnerIndex = selectionTree.winner();

// Get top k candidates
const topCandidates = selectionTree.topK(3);
```

---

## 🏗️ Architecture

```
js-voting-system/
├── src/
│   ├── ds/                    # Data Structures
│   │   ├── LinkedList.js
│   │   ├── HashTable.js
│   │   ├── BinarySearchTree.js
│   │   ├── Queue.js
│   │   ├── Stack.js
│   │   └── SelectionTree.js
│   ├── models/                # Data Models
│   │   ├── User.js
│   │   ├── Election.js
│   │   └── Vote.js
│   ├── app/                   # Application State
│   │   └── AppState.js        # Integrates all data structures
│   ├── utils/                 # Utilities
│   │   ├── auth.js           # Authentication
│   │   ├── storage.js        # CSV persistence
│   │   └── prediction.js     # Prediction with online dataset
│   └── server/
│       └── index.js          # Bun + Hono server
├── public/                    # Frontend
│   ├── index.html
│   ├── css/
│   │   └── style.css
│   └── js/
│       └── app.js
└── data/                      # CSV data files
    ├── users.csv
    ├── elections.csv
    ├── votes.csv
    └── state.csv
```

## 🚀 Getting Started

### Prerequisites
- [Bun](https://bun.sh) installed

### Installation

```bash
cd js-voting-system
bun install
```

### Run

```bash
bun run src/server/index.js
```

Or for development with auto-reload:

```bash
bun run dev
```

Server runs on `http://localhost:3000`

## 📖 Usage

### Default Admin Credentials
- **Email**: `admin@example.com`
- **Password**: `admin`
- **Admin PIN**: `1234`

### Workflow

1. **Register/Login**: Create voter account or login as admin
2. **Admin**: Create elections, add candidates, set manifestos
3. **Admin**: Open voting phase
4. **Voter**: View elections, read manifestos, cast votes
5. **Admin**: View predictions, tally results, close voting

## 🎨 Features in Detail

### Manifesto System
- Candidates can create detailed manifestos with promises
- Manifestos are displayed when voters view candidates
- Manifesto length and quality affect prediction scores

### Prediction System
- Uses **online dataset** integration for historical patterns
- Factors considered:
  - Current vote counts
  - Historical win rates
  - Online popularity scores
  - Manifesto quality and length
  - Trend analysis (up/stable/down)
- Real-time confidence calculations
- Detailed analysis and insights

### Multi-Machine Support
- Export votes to CSV from each voting machine
- Aggregate CSVs on admin machine
- Maintains data integrity across machines

## 🔒 Security Features

- Password hashing with salt (SHA-256)
- Admin PIN verification
- One-vote-per-election enforcement (HashTable lookup)
- Session token management
- Audit logging (Queue-based buffering)

## 📊 Data Structures Usage Summary

| Data Structure | Primary Use | Complexity | Location |
|---------------|-------------|-----------|----------|
| **LinkedList** | Store users, elections, votes | O(1) insert, O(n) search | `AppState.js` |
| **HashTable** | Fast lookups (users, elections, votes) | O(1) average | `AppState.js` |
| **BinarySearchTree** | Sorted elections/users | O(log n) average | `AppState.js`, `prediction.js` |
| **Queue** | Audit log, async operations | O(1) enqueue/dequeue | `AppState.js`, `prediction.js` |
| **Stack** | Undo/redo, WAL replay | O(1) push/pop | `AppState.js` |
| **SelectionTree** | Winner determination | O(log n) winner query | `AppState.js`, `prediction.js` |

## 🧪 Testing

Test data structures individually:

```javascript
import { LinkedList } from './src/ds/LinkedList.js';
const list = new LinkedList();
list.push('test');
console.log(list.toArray());
```

## 📝 API Endpoints

- `POST /api/register` - Register user
- `POST /api/login` - Login
- `GET /api/elections` - List elections
- `POST /api/elections` - Create election (admin)
- `PUT /api/elections/:id/phase` - Update phase (admin)
- `PUT /api/elections/:id/manifesto` - Add manifesto (admin)
- `POST /api/votes` - Cast vote
- `GET /api/elections/:id/tally` - Get tally results
- `GET /api/elections/:id/prediction` - Get predictions
- `GET /api/export/votes` - Export votes CSV (admin)

## 🎓 Educational Value

This project demonstrates:
- Real-world application of data structures
- Trade-offs between different structures
- Integration of multiple structures in one system
- Performance considerations
- Clean architecture and separation of concerns

## 📄 License

MIT

## 👨‍💻 Development

Built with:
- **Bun**: Fast JavaScript runtime
- **Hono**: Lightweight web framework
- **Vanilla JavaScript**: No frontend framework dependencies

---

**Note**: This is an educational project showcasing data structures. For production use, additional security measures and testing would be required.

