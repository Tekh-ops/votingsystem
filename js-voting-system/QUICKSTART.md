# Quick Start Guide

## Installation

```bash
# Install Bun (if not already installed)
curl -fsSL https://bun.sh/install | bash

# Navigate to project
cd js-voting-system

# Install dependencies
bun install
```

## Running the Server

```bash
# Start server
bun run src/server/index.js

# Or with auto-reload
bun run dev
```

Server will start on `http://localhost:3000`

## Default Credentials

### Admin
- Email: `admin@example.com`
- Password: `admin`
- PIN: `1234`

### Register New Voter
- Use the Register tab on the login page
- Fill in name, email, and password

## Features to Try

1. **Login as Admin**
   - Create a new election
   - Add candidates (comma-separated: "Alice, Bob, Carol")
   - Add manifestos for candidates
   - Open voting phase

2. **Login as Voter**
   - View active elections
   - Read candidate manifestos
   - Cast your vote

3. **Admin Features**
   - View predictions (uses online dataset)
   - View tally results
   - Export votes to CSV
   - Close voting phase

## Data Structures Demonstrated

- **LinkedList**: Users, elections, votes stored in linked lists
- **HashTable**: Fast O(1) lookups for authentication and vote tracking
- **BinarySearchTree**: Sorted elections by date, users by name
- **Queue**: Audit log buffering, async operations
- **Stack**: Undo/redo operations (ready for implementation)
- **SelectionTree**: Efficient winner determination in O(log n)

## Project Structure

```
js-voting-system/
├── src/
│   ├── ds/              # All data structures
│   ├── models/          # User, Election, Vote models
│   ├── app/             # AppState (main application logic)
│   ├── utils/           # Auth, storage, prediction
│   └── server/          # Bun + Hono server
├── public/              # Frontend (HTML, CSS, JS)
└── data/                # CSV files (auto-created)
```

## API Testing

You can test the API directly:

```bash
# Register a user
curl -X POST http://localhost:3000/api/register \
  -H "Content-Type: application/json" \
  -d '{"name":"John Doe","email":"john@example.com","password":"password123","role":"voter"}'

# Login
curl -X POST http://localhost:3000/api/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"admin","adminPin":"1234"}'

# Get elections
curl http://localhost:3000/api/elections
```

## Troubleshooting

- **Port already in use**: Change PORT in `src/server/index.js` or set `PORT=3001 bun run src/server/index.js`
- **Data not persisting**: Check `data/` directory permissions
- **Module not found**: Run `bun install` again

## Next Steps

- Explore the code to see how each data structure is used
- Check `README.md` for detailed documentation
- Modify data structures to see how it affects the system
- Add new features using the existing data structures

