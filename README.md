# Online Voting System (C) — Complete Guide

> Cursor-ready Markdown: a comprehensive implementation plan, data structures, file layout, features, security notes, build/run instructions, testing, and milestones for an extensive C project implementing an online voting system.

---

## Table of Contents

1. [Project Overview](#project-overview)
2. [Goals & Non-goals](#goals--non-goals)
3. [Features (core → advanced)](#features-core---advanced)
4. [System Requirements & Tools](#system-requirements--tools)
5. [High-level Architecture](#high-level-architecture)
6. [Project Structure (files)](#project-structure-files)
7. [Data Models & C `struct`s](#data-models--c-structs)
8. [Persistence & File Formats](#persistence--file-formats)
9. [Core Algorithms & Workflows](#core-algorithms--workflows)
10. [Security & Privacy](#security--privacy)
11. [CLI / UI design](#cli--ui-design)
12. [Admin & Maintenance Tools](#admin--maintenance-tools)
13. [Testing & QA Plan](#testing--qa-plan)
14. [Build / Run / Example Commands](#build--run--example-commands)
15. [Milestones / Implementation Roadmap](#milestones--implementation-roadmap)
16. [Extensions & Research Directions](#extensions--research-directions)
17. [Appendix: Helpful snippets and Makefile](#appendix-helpful-snippets-and-makefile)

---

## Project Overview

Build a robust, file-based **Online Voting System** in C implementing a full voting lifecycle: voter registration, authentication, ballot definition, secure vote casting, vote tallying, auditing/logging, and administrative controls. The system focuses on correctness, persistence, and layered security while remaining implementable using standard C and portable libraries (OpenSSL optional for cryptography).

This project is ideal for a semester-long course, capstone, or a portfolio project demonstrating systems programming, file I/O, data structures (hash tables, B-trees or indexes), and basic cryptography.

---

## Goals & Non-goals

**Goals**

- Build a single-process, CLI-based server-like application in C.
- Persistent storage in files (binary + JSON metadata optional).
- Strong separation: voters, admins, elections, ballots, votes, and logs.
- Robust input validation, transactional writes (simple WAL), and unit tests.

**Non-Goals**

- Not a production-grade internet-facing voting system.
- No distributed consensus, no full end-to-end cryptographic voting proofs (except optional advanced modules).

---

## Features (core → advanced)

### Core features (must-have)

- Voter registration with unique voter ID and password (salted hash).
- Admin user(s) to create elections, define ballots and candidates.
- Election phases: `CREATED` → `REGISTRATION_OPEN` → `VOTING_OPEN` → `VOTING_CLOSED` → `TALLY_COMPLETE`.
- Secure vote casting (one person, one vote per election).
- Persistent vote storage and audit log (append-only ledger file).
- Tallying with multiple election types: `FIRST_PAST_THE_POST` and `PLURALITY`.
- CLI with commands for admin and voter actions.

### Nice-to-have (medium complexity)

- Voter eligibility groups (e.g., by region, department).
- Anonymous ballots: separate voter identity file from vote file using ephemeral tokens.
- File-based index for fast lookup (hash index or simple B-tree).
- WAL (write-ahead log) to guarantee consistency on crash.
- Export of results to CSV/JSON.
- Unit tests for core modules.

### Advanced (research / optional)

- End-to-end verifiability with receipts (non-linkable proof tokens).
- Homomorphic tallying or mix-nets for anonymity.
- Blockchain-like append-only ledger with block headers and proof-of-work (educational only).
- Networked server mode (socket or REST) with TLS (requires more work & security review).

---

## System Requirements & Tools

- Language: C (C11 recommended)
- Compiler: `gcc` or `clang`
- Tools: `make`, `valgrind` for memory checking
- Optional: OpenSSL (`libcrypto`) for hashing (SHA-256) / RSA signatures
- Testing: `cmocka` or plain harness with assertions

---

## High-level Architecture

1. `core/` — core data structures and algorithms (hash table, index, record manager)
2. `storage/` — persistence layer: record I/O, WAL, compaction
3. `auth/` — password hashing, session tokens
4. `cli/` — user interface and command parsing
5. `admin/` — election creation, configuration
6. `audit/` — append-only logging and verification
7. `tests/` — unit and integration tests

Design pattern: tightly-structured modules with clearly defined APIs. Keep I/O isolated so later you can swap file formats or add a network interface.

---

## Project Structure (files)

```
online-vote-c/
├─ Makefile
├─ README.md  <- generated from this document
├─ src/
│  ├─ main.c
│  ├─ cli.c cli.h
│  ├─ core/
│  │  ├─ kv_store.c kv_store.h        # simple persistent key-value store
│  │  ├─ index.c index.h
│  │  └─ util.c util.h
│  ├─ auth/
│  │  ├─ auth.c auth.h                # password hashing, tokens
│  │  └─ crypto.c crypto.h            # wrappers for OpenSSL or builtin
│  ├─ models/
│  │  ├─ user.c user.h                # voter/admin structs
│  │  ├─ election.c election.h
│  │  └─ ballot.c ballot.h
│  ├─ storage/
│  │  ├─ storage.c storage.h          # low-level file read/write
│  │  └─ wal.c wal.h
│  ├─ audit/
│  │  └─ audit.c audit.h              # append-only audit log
│  └─ tests/
│     └─ test_core.c
├─ data/                              # runtime data files
│  ├─ users.bin
│  ├─ elections.bin
│  ├─ votes.bin
│  └─ audit.log
└─ docs/
   └─ design.md
```

---

## Data Models & C `struct`s

Below are recommended `struct`s. Use fixed-size fields or length-prefixed strings to simplify binary persistence.

```c
// models/user.h
#define MAX_NAME 64
#define SALT_LEN 16
#define HASH_LEN 32

typedef enum {ROLE_VOTER, ROLE_ADMIN} role_t;

typedef struct {
    uint64_t id;               // persistent unique id
    char name[MAX_NAME];
    char email[128];
    role_t role;
    uint8_t salt[SALT_LEN];    // random salt
    uint8_t pass_hash[HASH_LEN]; // e.g., SHA-256(salt || password)
    uint8_t active;            // 0/1
} user_rec_t;

// models/election.h
#define TITLE_LEN 128
#define DESC_LEN 512
#define MAX_CAND 128

typedef enum {ELECTION_CREATED, REGISTRATION_OPEN, VOTING_OPEN, VOTING_CLOSED, TALLY_COMPLETE} election_phase_t;

typedef struct {
    uint64_t id;
    char title[TITLE_LEN];
    char description[DESC_LEN];
    election_phase_t phase;
    time_t start_time;
    time_t end_time;
    uint32_t candidate_count;
    char candidates[MAX_CAND][64];
} election_rec_t;

// models/vote.h
typedef struct {
    uint64_t id;         // unique vote id (monotonic)
    uint64_t election_id;
    uint64_t voter_id;   // if storing voter link; for anonymous store 0 and token
    uint32_t choice;     // candidate index
    time_t timestamp;
    uint8_t signature[256]; // optional: signer info or proof
} vote_rec_t;
```

Notes: using fixed-length arrays makes binary record seeking and indexing easier.

---

## Persistence & File Formats

**Simple binary record files**

- Each record file starts with a small header (magic bytes, schema version, next-id counter)
- Records appended sequentially. Deleted records marked with tombstone flag.
- Use an in-memory index (hash table mapping `id -> file_offset`) rebuilt at startup from the file header + scan. This is fine for moderate dataset sizes.

**Write-Ahead Log (WAL)**

- Before committing changes to primary files, append operations to `wal.log` with an op-code and data.
- On clean shutdown, WAL is empty. On startup, replay WAL to recover uncommitted operations.

**Audit log**

- `audit.log` is an append-only text/binary file storing operations (JSON lines or binary entries): `timestamp, op, actor_id, target, metadata`.
- Sign audit log blocks with HMAC or RSA to detect tampering (optional).

---

## Core Algorithms & Workflows

### 1) Voter Registration

- Input: name, email, password
- Steps:
  1. Validate input, ensure uniqueness (email not registered)
  2. Generate salt (CSPRNG)
  3. Compute password hash: `hash = SHA256(salt || password)` or use PBKDF2 if available
  4. Assign `user_id = next_user_id++`
  5. Append `user_rec_t` to `users.bin`
  6. Update index: `email -> user_id`, `id -> offset`
  7. Append audit entry

### 2) Authentication (Login)

- Input: email, password
- Steps:
  1. Lookup `user_id` by email
  2. Read `user_rec` from file
  3. Compute hash with stored salt and compare
  4. If match, create a short-lived session token (random 128-bit, map token -> user_id in memory)

### 3) Create Election (Admin)

- Admin defines title, description, candidates, schedule.
- Persist `election_rec_t` to `elections.bin` and update index.

### 4) Cast Vote

- Preconditions: election.phase == VOTING_OPEN, voter eligible and not already voted
- Two flavors:
  - **Linked**: store `voter_id` in vote record and mark voter as `has_voted[election_id] = true` (simple for small systems)
  - **Anonymous**: issue one-time token during registration or registration phase. Token used to cast vote; vote record stores token hash but not voter.
- Append `vote_rec` to `votes.bin`, append audit entry, and optionally mark voter's record to prevent re-voting (or mark token as used).

### 5) Tallying

- Read all `votes` for the `election_id` and count per candidate.
- Provide intermediate checksums (e.g., SHA256 of concatenated votes) to aid verification.

---

## Security & Privacy

**Hashing & Passwords**

- Use PBKDF2, bcrypt, or Argon2 where available. If not, at minimum use `SHA-256` with a per-user random salt and many iterations (iterate the hash 100k+ times).
- Do not store plaintext passwords.

**Authentication tokens**

- Use cryptographically secure random tokens (CSPRNG from `/dev/urandom` or `RAND_bytes` from OpenSSL).
- Store token -> user mapping in memory with expiration.

**Auditing & Tamper-evidence**

- Use an append-only `audit.log` with HMAC per entry or periodically sign blocks with an admin-private key.
- Keep separate backups of `audit.log` and `votes.bin` for cross-checks.

**Anonymity**

- For anonymous voting, separate voter identity store from votes. Issue single-use tokens during registration. Ensure tokens cannot be correlated with voter IDs.

**File Locking & Concurrency**

- If running multi-threaded or multi-process (e.g., network mode), use file locks (POSIX `flock` or `fcntl`) during writes.

**Threats & Mitigations**

- Disk tampering: detect via signatures/HMACs.
- Replay attacks: use monotonic counters and timestamps.
- Privilege escalation: robust input validation and role checks.

---

## CLI / UI design

The system exposes a CLI with subcommands. Example UX using `onlinevote` binary:

```
# Admin flows
$ onlinevote admin create-election --title "CS Dept Rep" --cands "Alice,Bob,Carol" --start 2025-12-01T09:00 --end 2025-12-02T17:00
$ onlinevote admin open-registration --election 3
$ onlinevote admin open-voting --election 3
$ onlinevote admin close-voting --election 3
$ onlinevote admin tally --election 3 --out results.csv

# Voter flows
$ onlinevote register --name "Sam" --email sam@example.com
$ onlinevote login --email sam@example.com
$ onlinevote vote --election 3 --choice 1
$ onlinevote status --election 3
```

CLI architecture: `main()` parses `argv` and dispatches to `cli.c` handlers. Use `getopt_long` for parsing.

---

## Admin & Maintenance Tools

- `compact` — rewrite data files removing tombstones and rebuilding indices.
- `backup` — snapshot data files and sign backup manifest.
- `audit-verify` — verify audit.log signatures and integrity.
- `export` — export election and vote data to CSV/JSON for external analysis.

---

## Data Structure Usage Plan (course focus)

- Linked lists: candidate collections, audit buffers before flush, free lists of reclaimed offsets.
- Queues: audit flush queue, CLI batch command queue, background compaction tasks.
- Stacks: rollback frames for single-command undo and non-recursive tree traversals.
- Hash tables: in-memory indexes (`id -> offset`, `email_hash -> user_id`, `(election_id,voter_id) -> seen`, `token -> session`).
- Binary search trees: ordered views (e.g., elections by start time, users by email) for range listings.
- Selection (tournament) tree: fast winner/runner-up from candidate counts; O(log n) update per vote, O(n) build.

---

## Testing & QA Plan

- Unit tests for: hashing, record read/write, index rebuild, vote uniqueness enforcement, tallying correctness.
- Integration tests: full flow registration → vote → tally.
- Property tests: random sequences of operations to ensure invariants (one-vote, no negative counts).
- Use `valgrind` to detect memory leaks.

---

## Build / Run / Example Commands

### Build

```
make all
# Windows (MinGW): gcc -std=c11 -Wall -Wextra -O2 -Isrc -o bin/onlinevote.exe $(find src -name "*.c")
# Windows (MSVC): cl /std:c11 /W4 /Fe:bin\\onlinevote.exe (list all .c files)
```

### Run

```
./bin/onlinevote --help
./bin/onlinevote admin create-election --title "Demo" --cands "A,B,C"
```

---

## Milestones / Implementation Roadmap

**Week 1 — foundations**
- Project skeleton, Makefile, simple CLI, in-memory user and election structs.

**Week 2 — persistence**
- Implement binary record files, append/read by offset, id counters.

**Week 3 — auth & registration**
- Implement password hashing, registration, login, sessions.

**Week 4 — voting core**
- Implement vote casting, uniqueness checks, audit log.

**Week 5 — tally & export**
- Implement tally algorithm, export to CSV, admin CLI commands.

**Week 6 — polish**
- WAL, compaction, tests, documentation, and demo scripts.

---

## Extensions & Research Directions

- Replace storage with SQLite to simplify persistence.
- Add HTTPS REST API server with JWT tokens and TLS.
- Implement cryptographic proofs for end-to-end verifiability (advanced research topic).

---

## Appendix: Helpful snippets and Makefile

### Makefile (simple)

```makefile
CC = gcc
CFLAGS = -std=c11 -Wall -Wextra -O2
SRC = $(shell find src -name "*.c")
OBJ = $(SRC:.c=.o)
BIN = bin/onlinevote

all: $(BIN)

$(BIN): $(OBJ)
	@mkdir -p bin
	$(CC) $(CFLAGS) -o $(BIN) $(OBJ) -lcrypto

clean:
	rm -rf $(OBJ) $(BIN)

.PHONY: all clean
```

> Note: `-lcrypto` is optional; remove if not linking OpenSSL.

### Password hashing (conceptual C snippet)

```c
// crypto.c
#include <openssl/evp.h>

void hash_password(const uint8_t *salt, size_t salt_len, const char *password, uint8_t *out_hash) {
    // Example using SHA256: out_hash must be 32 bytes
    EVP_MD_CTX *mdctx = EVP_MD_CTX_new();
    EVP_DigestInit_ex(mdctx, EVP_sha256(), NULL);
    EVP_DigestUpdate(mdctx, salt, salt_len);
    EVP_DigestUpdate(mdctx, password, strlen(password));
    unsigned int len;
    EVP_DigestFinal_ex(mdctx, out_hash, &len);
    EVP_MD_CTX_free(mdctx);
}
```

### WAL entry format (example JSON-line)

```json
{"op":"create_user","id":42,"data":{...},"ts":1699999999}
```

---

## Deliverables for evaluation / demo

1. Source code with modular structure.
2. `bin/onlinevote` executable.
3. `data/` folder with example files.
4. Test suite and a script `demo.sh` showing registration → vote → tally.
5. Documentation (this README + design.md explaining on-disk formats).


