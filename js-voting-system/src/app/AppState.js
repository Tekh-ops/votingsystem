/**
 * APPLICATION STATE MANAGER
 * 
 * This is the core of the voting system that integrates all data structures:
 * - LinkedList: Store users, elections, votes
 * - HashTable: Fast lookups (userById, userByEmail, electionById, hasVoted, sessions)
 * - BinarySearchTree: Sorted elections by date, users by name
 * - Queue: Audit log buffering, async operations
 * - Stack: Undo/redo operations, WAL replay
 * - SelectionTree: Efficient winner determination
 */
import { LinkedList } from '../ds/LinkedList.js';
import { HashTable } from '../ds/HashTable.js';
import { BinarySearchTree } from '../ds/BinarySearchTree.js';
import { Queue } from '../ds/Queue.js';
import { Stack } from '../ds/Stack.js';
import { SelectionTree } from '../ds/SelectionTree.js';
import { User } from '../models/User.js';
import { Election } from '../models/Election.js';
import { Vote } from '../models/Vote.js';
import { Survey } from '../models/Survey.js';
import { hashPassword, verifyPassword, generateSessionToken } from '../utils/auth.js';
import { loadCSV, saveCSV, ensureDataDir } from '../utils/storage.js';
import { predictElection } from '../utils/prediction.js';

export class AppState {
  constructor() {
    // ========== DATA STRUCTURES ==========
    
    // LinkedList: Store all users, elections, votes, surveys in memory
    this.users = new LinkedList();
    this.elections = new LinkedList();
    this.votes = new LinkedList();
    this.surveys = new LinkedList();
    
    // HashTable: Fast O(1) lookups
    this.userById = new HashTable(64);        // user_id -> User object
    this.userByEmail = new HashTable(64);     // email_hash -> User object
    this.electionById = new HashTable(64);    // election_id -> Election object
    this.hasVoted = new HashTable(128);       // (election_id, voter_id) -> true
    this.sessions = new HashTable(128);       // token -> User object
    this.surveyById = new HashTable(64);      // survey_id -> Survey object
    this.surveysByElection = new HashTable(64); // election_id -> LinkedList of surveys
    this.hasResponded = new HashTable(128);   // (survey_id, voter_id) -> true
    
    // BinarySearchTree: Sorted data for efficient queries
    this.electionsByDate = new BinarySearchTree((a, b) => {
      const dateA = new Date(a.startTime || a.createdAt).getTime();
      const dateB = new Date(b.startTime || b.createdAt).getTime();
      return dateA - dateB;
    });
    this.usersByName = new BinarySearchTree((a, b) => {
      // a and b are the keys (strings), not the objects
      return a.localeCompare(b);
    });
    
    // Queue: Buffer operations before persistence
    this.auditQueue = new Queue();
    this.operationQueue = new Queue();
    
    // Stack: Undo/redo operations
    this.undoStack = new Stack();
    this.redoStack = new Stack();
    
    // State
    this.nextUserId = 1;
    this.nextElectionId = 1;
    this.nextVoteId = 1;
    this.nextSurveyId = 1;
    this.adminExists = false;
    this.adminPin = '1234';
  }

  /**
   * Load state from CSV files
   */
  async load() {
    await ensureDataDir();
    
    // Load users
    const userData = await loadCSV('users.csv');
    for (const row of userData) {
      if (row.id) {
        const user = User.fromJSON({
          id: parseInt(row.id),
          name: row.name,
          email: row.email,
          passwordHash: row.passwordHash,
          role: row.role,
          salt: row.salt,
          active: row.active === 'true',
          createdAt: row.createdAt
        });
        this._addUserToIndexes(user);
        if (user.role === 'admin') this.adminExists = true;
        if (parseInt(row.id) >= this.nextUserId) {
          this.nextUserId = parseInt(row.id) + 1;
        }
      }
    }
    
    // Load elections
    const electionData = await loadCSV('elections.csv');
    for (const row of electionData) {
      if (row.id) {
        let manifestos = {};
        if (row.manifestos && row.manifestos.trim() !== '') {
          try {
            manifestos = JSON.parse(row.manifestos);
          } catch (e) {
            console.warn(`Failed to parse manifestos for election ${row.id}:`, e.message);
            manifestos = {};
          }
        }
        const candidates = row.candidates ? row.candidates.split('|') : [];
        const election = Election.fromJSON({
          id: parseInt(row.id),
          title: row.title,
          description: row.description,
          candidates,
          manifestos,
          phase: row.phase,
          startTime: row.startTime,
          endTime: row.endTime,
          createdAt: row.createdAt
        });
        this._addElectionToIndexes(election);
        if (parseInt(row.id) >= this.nextElectionId) {
          this.nextElectionId = parseInt(row.id) + 1;
        }
      }
    }
    
    // Load votes
    const voteData = await loadCSV('votes.csv');
    for (const row of voteData) {
      if (row.id) {
        const vote = Vote.fromJSON({
          id: parseInt(row.id),
          electionId: parseInt(row.electionId),
          voterId: parseInt(row.voterId),
          choice: parseInt(row.choice),
          timestamp: row.timestamp
        });
        this.votes.push(vote);
        const key = `${vote.electionId}_${vote.voterId}`;
        this.hasVoted.put(key, true);
        if (parseInt(row.id) >= this.nextVoteId) {
          this.nextVoteId = parseInt(row.id) + 1;
        }
      }
    }
    
    // Load surveys
    const surveyData = await loadCSV('surveys.csv');
    for (const row of surveyData) {
      if (row.id) {
        let responses = [];
        if (row.responses && row.responses.trim() !== '') {
          try {
            responses = JSON.parse(row.responses);
          } catch (e) {
            console.warn(`Failed to parse responses for survey ${row.id}:`, e.message);
            responses = [];
          }
        }
        const survey = Survey.fromJSON({
          id: parseInt(row.id),
          electionId: parseInt(row.electionId),
          candidateName: row.candidateName,
          question: row.question,
          responses,
          createdAt: row.createdAt
        });
        this._addSurveyToIndexes(survey);
        if (parseInt(row.id) >= this.nextSurveyId) {
          this.nextSurveyId = parseInt(row.id) + 1;
        }
      }
    }
    
    // Load state
    const stateData = await loadCSV('state.csv');
    if (stateData.length > 0) {
      const state = stateData[0];
      if (state.adminExists) this.adminExists = state.adminExists === 'true';
      if (state.adminPin) this.adminPin = state.adminPin;
    }
    
    // Seed default admin if none exists
    if (!this.adminExists) {
      this.registerUser('Admin', 'admin@example.com', 'admin', 'admin');
    }
    
    // Seed sample data for previous elections (only if no elections exist)
    if (this.elections.length === 0) {
      await this._seedSampleData();
    }
  }

  /**
   * Save state to CSV files
   */
  async save() {
    await ensureDataDir();
    
    // Save users
    const userRows = [];
    this.users.forEach(user => {
      userRows.push({
        id: user.id.toString(),
        name: user.name,
        email: user.email,
        passwordHash: user.passwordHash,
        role: user.role,
        salt: user.salt,
        active: user.active.toString(),
        createdAt: user.createdAt
      });
    });
    await saveCSV('users.csv', ['id', 'name', 'email', 'passwordHash', 'role', 'salt', 'active', 'createdAt'], userRows);
    
    // Save elections
    const electionRows = [];
    this.elections.forEach(election => {
      electionRows.push({
        id: election.id.toString(),
        title: election.title,
        description: election.description,
        candidates: election.candidates.join('|'),
        manifestos: JSON.stringify(election.manifestos),
        phase: election.phase,
        startTime: election.startTime || '',
        endTime: election.endTime || '',
        createdAt: election.createdAt
      });
    });
    await saveCSV('elections.csv', ['id', 'title', 'description', 'candidates', 'manifestos', 'phase', 'startTime', 'endTime', 'createdAt'], electionRows);
    
    // Save votes
    const voteRows = [];
    this.votes.forEach(vote => {
      voteRows.push({
        id: vote.id.toString(),
        electionId: vote.electionId.toString(),
        voterId: vote.voterId.toString(),
        choice: vote.choice.toString(),
        timestamp: vote.timestamp
      });
    });
    await saveCSV('votes.csv', ['id', 'electionId', 'voterId', 'choice', 'timestamp'], voteRows);
    
    // Save surveys
    const surveyRows = [];
    this.surveys.forEach(survey => {
      surveyRows.push({
        id: survey.id.toString(),
        electionId: survey.electionId.toString(),
        candidateName: survey.candidateName,
        question: survey.question,
        responses: JSON.stringify(survey.responses),
        createdAt: survey.createdAt
      });
    });
    await saveCSV('surveys.csv', ['id', 'electionId', 'candidateName', 'question', 'responses', 'createdAt'], surveyRows);
    
    // Save state
    await saveCSV('state.csv', ['adminExists', 'adminPin'], [{
      adminExists: this.adminExists.toString(),
      adminPin: this.adminPin
    }]);
  }

  /**
   * Register a new user
   */
  async registerUser(name, email, password, role = 'voter') {
    // Check if admin already exists
    if (role === 'admin' && this.adminExists) {
      return { error: 'Only one admin is allowed' };
    }
    
    // Check if email already exists (using HashTable for O(1) lookup)
    if (this.userByEmail.has(email)) {
      return { error: 'Email already registered' };
    }
    
    // Hash password
    const { hash, salt } = hashPassword(password);
    
    // Create user
    const user = new User(this.nextUserId++, name, email, hash, role, salt);
    this._addUserToIndexes(user);
    
    if (role === 'admin') {
      this.adminExists = true;
    }
    
    // Queue audit log entry
    this.auditQueue.enqueue({
      type: 'USER_REGISTERED',
      userId: user.id,
      timestamp: new Date().toISOString()
    });
    
    await this.save();
    return { user: user.toJSON() };
  }

  /**
   * Login user
   */
  async login(email, password, adminPin = null) {
    // Find user by email (HashTable lookup)
    const user = this.userByEmail.get(email);
    if (!user) {
      return { error: 'Invalid email or password' };
    }
    
    // Verify password
    if (!verifyPassword(password, user.passwordHash, user.salt)) {
      return { error: 'Invalid email or password' };
    }
    
    // Check admin PIN if admin
    if (user.role === 'admin') {
      if (!adminPin || adminPin !== this.adminPin) {
        return { error: 'Invalid admin PIN' };
      }
    }
    
    // Generate session token
    const token = generateSessionToken();
    this.sessions.put(token, user);
    
    // Queue audit log
    this.auditQueue.enqueue({
      type: 'USER_LOGIN',
      userId: user.id,
      timestamp: new Date().toISOString()
    });
    
    return { user: user.toJSON(), token };
  }

  /**
   * Logout user
   */
  logout(token) {
    this.sessions.delete(token);
  }

  /**
   * Get user by session token
   */
  getUserByToken(token) {
    const user = this.sessions.get(token);
    return user ? user.toJSON() : null;
  }

  /**
   * Check if token belongs to admin
   */
  isAdmin(token) {
    const user = this.sessions.get(token);
    return user && user.role === 'admin';
  }

  /**
   * Create election (admin only)
   */
  async createElection(title, description, candidates, manifestos = {}) {
    if (!Array.isArray(candidates) || candidates.length === 0) {
      return { error: 'At least one candidate required' };
    }
    
    const election = new Election(this.nextElectionId++, title, description, candidates, manifestos);
    this._addElectionToIndexes(election);
    
    // Queue audit log
    this.auditQueue.enqueue({
      type: 'ELECTION_CREATED',
      electionId: election.id,
      timestamp: new Date().toISOString()
    });
    
    await this.save();
    return { election: election.toJSON() };
  }

  /**
   * Update election phase
   */
  async updateElectionPhase(electionId, phase) {
    const election = this.electionById.get(electionId);
    if (!election) {
      return { error: 'Election not found' };
    }
    
    // Push to undo stack
    this.undoStack.push({
      type: 'PHASE_CHANGE',
      electionId,
      oldPhase: election.phase,
      newPhase: phase
    });
    
    election.phase = phase;
    if (phase === 'VOTING_OPEN' && !election.startTime) {
      election.startTime = new Date().toISOString();
    }
    if (phase === 'VOTING_CLOSED' && !election.endTime) {
      election.endTime = new Date().toISOString();
    }
    
    await this.save();
    return { success: true };
  }

  /**
   * Set manifesto for candidate
   */
  async setManifesto(electionId, candidateName, manifesto) {
    const election = this.electionById.get(electionId);
    if (!election) {
      return { error: 'Election not found' };
    }
    
    if (!election.candidates.includes(candidateName)) {
      return { error: 'Candidate not found in election' };
    }
    
    election.setManifesto(candidateName, manifesto);
    
    await this.save();
    return { success: true };
  }

  /**
   * Cast vote
   */
  async castVote(token, electionId, choice) {
    const user = this.sessions.get(token);
    if (!user) {
      return { error: 'Not authenticated' };
    }
    
    const election = this.electionById.get(electionId);
    if (!election) {
      return { error: 'Election not found' };
    }
    
    if (election.phase !== 'VOTING_OPEN') {
      return { error: 'Election is not open for voting' };
    }
    
    if (choice < 0 || choice >= election.candidates.length) {
      return { error: 'Invalid candidate choice' };
    }
    
    // Check if already voted (HashTable lookup)
    const key = `${electionId}_${user.id}`;
    if (this.hasVoted.has(key)) {
      return { error: 'You have already voted in this election' };
    }
    
    // Create vote
    const vote = new Vote(this.nextVoteId++, electionId, user.id, choice);
    this.votes.push(vote);
    this.hasVoted.put(key, true);
    
    // Queue audit log
    this.auditQueue.enqueue({
      type: 'VOTE_CAST',
      voteId: vote.id,
      electionId,
      voterId: user.id,
      timestamp: new Date().toISOString()
    });
    
    await this.save();
    return { vote: vote.toJSON() };
  }

  /**
   * Tally election results using SelectionTree
   */
  tallyElection(electionId) {
    const election = this.electionById.get(electionId);
    if (!election) {
      return { error: 'Election not found' };
    }
    
    // Count votes for each candidate
    const counts = new Array(election.candidates.length).fill(0);
    this.votes.forEach(vote => {
      if (vote.electionId === electionId && vote.choice < counts.length) {
        counts[vote.choice]++;
      }
    });
    
    // Use SelectionTree to find winner efficiently
    const selectionTree = new SelectionTree(counts);
    const winnerIndex = selectionTree.winner();
    
    // Build results
    const results = {
      electionId,
      electionTitle: election.title,
      totalVotes: counts.reduce((sum, c) => sum + c, 0),
      candidates: election.candidates.map((name, idx) => ({
        name,
        votes: counts[idx],
        percentage: counts.reduce((sum, c) => sum + c, 0) > 0 
          ? ((counts[idx] / counts.reduce((sum, c) => sum + c, 0)) * 100).toFixed(2)
          : '0.00'
      })),
      winner: {
        index: winnerIndex,
        name: election.candidates[winnerIndex],
        votes: counts[winnerIndex]
      }
    };
    
    return results;
  }

  /**
   * Get prediction for election (async - uses real election data)
   */
  async getPrediction(electionId) {
    const election = this.electionById.get(electionId);
    if (!election) {
      return { error: 'Election not found' };
    }
    
    // Count current votes
    const counts = new Array(election.candidates.length).fill(0);
    this.votes.forEach(vote => {
      if (vote.electionId === electionId && vote.choice < counts.length) {
        counts[vote.choice]++;
      }
    });
    
    // Get survey data for candidates
    const surveyData = {};
    const surveys = this.getSurveysForElection(electionId);
    surveys.forEach(survey => {
      if (!surveyData[survey.candidateName]) {
        surveyData[survey.candidateName] = {
          avgRating: parseFloat(survey.averageRating) || 0,
          totalResponses: survey.totalResponses || 0
        };
      }
    });
    
    // Get previous elections data for pattern analysis
    const previousElections = [];
    this.elections.forEach(prevElection => {
      if (prevElection.id !== electionId && prevElection.phase === 'TALLY_COMPLETE') {
        const prevCounts = new Array(prevElection.candidates.length).fill(0);
        this.votes.forEach(vote => {
          if (vote.electionId === prevElection.id && vote.choice < prevCounts.length) {
            prevCounts[vote.choice]++;
          }
        });
        const prevSelectionTree = new SelectionTree(prevCounts);
        previousElections.push({
          candidates: prevElection.candidates,
          voteCounts: prevCounts,
          winnerIndex: prevSelectionTree.winner()
        });
      }
    });
    
    // Get prediction using prediction module (with real data)
    const prediction = await predictElection(
      election.candidates, 
      counts, 
      election.manifestos,
      surveyData,
      previousElections
    );
    
    return {
      electionId,
      electionTitle: election.title,
      ...prediction
    };
  }

  /**
   * List all elections
   */
  listElections() {
    return this.elections.toArray().map(e => e.toJSON());
  }

  /**
   * Get election by ID
   */
  getElection(id) {
    const election = this.electionById.get(id);
    return election ? election.toJSON() : null;
  }

  /**
   * Get votes for election
   */
  getVotesForElection(electionId) {
    const votes = [];
    this.votes.forEach(vote => {
      if (vote.electionId === electionId) {
        votes.push(vote.toJSON());
      }
    });
    return votes;
  }

  /**
   * Export votes to CSV
   */
  async exportVotesCSV() {
    const rows = ['id,election_id,voter_id,choice,timestamp'];
    this.votes.forEach(vote => {
      rows.push(`${vote.id},${vote.electionId},${vote.voterId},${vote.choice},${vote.timestamp}`);
    });
    return rows.join('\n');
  }

  /**
   * Create survey for a candidate
   */
  async createSurvey(electionId, candidateName, question) {
    const election = this.electionById.get(electionId);
    if (!election) {
      return { error: 'Election not found' };
    }
    
    if (!election.candidates.includes(candidateName)) {
      return { error: 'Candidate not found in election' };
    }
    
    const survey = new Survey(this.nextSurveyId++, electionId, candidateName, question);
    this._addSurveyToIndexes(survey);
    
    await this.save();
    return { survey: survey.toJSON() };
  }

  /**
   * Submit survey response
   */
  async submitSurveyResponse(token, surveyId, rating, comment = '') {
    const user = this.sessions.get(token);
    if (!user) {
      return { error: 'Not authenticated' };
    }
    
    const survey = this.surveyById.get(surveyId);
    if (!survey) {
      return { error: 'Survey not found' };
    }
    
    // Check if already responded (HashTable lookup)
    const key = `${surveyId}_${user.id}`;
    if (this.hasResponded.has(key)) {
      return { error: 'You have already responded to this survey' };
    }
    
    try {
      survey.addResponse(user.id, rating, comment);
      this.hasResponded.put(key, true);
      
      // Queue audit log
      this.auditQueue.enqueue({
        type: 'SURVEY_RESPONSE',
        surveyId,
        voterId: user.id,
        timestamp: new Date().toISOString()
      });
      
      await this.save();
      return { success: true, survey: survey.toJSON() };
    } catch (error) {
      return { error: error.message };
    }
  }

  /**
   * Get surveys for an election
   */
  getSurveysForElection(electionId) {
    const surveys = this.surveysByElection.get(electionId);
    if (!surveys) return [];
    return surveys.toArray().map(s => s.toJSON());
  }

  /**
   * Get all surveys
   */
  getAllSurveys() {
    return this.surveys.toArray().map(s => s.toJSON());
  }

  /**
   * Helper: Add user to all indexes
   */
  _addUserToIndexes(user) {
    this.users.push(user);
    this.userById.put(user.id, user);
    this.userByEmail.put(user.email, user);
    this.usersByName.insert(user, user.name);
  }

  /**
   * Helper: Add election to all indexes
   */
  _addElectionToIndexes(election) {
    this.elections.push(election);
    this.electionById.put(election.id, election);
    this.electionsByDate.insert(election, election.startTime || election.createdAt);
  }

  /**
   * Helper: Add survey to all indexes
   */
  _addSurveyToIndexes(survey) {
    this.surveys.push(survey);
    this.surveyById.put(survey.id, survey);
    
    // Add to election's survey list
    let electionSurveys = this.surveysByElection.get(survey.electionId);
    if (!electionSurveys) {
      electionSurveys = new LinkedList();
      this.surveysByElection.put(survey.electionId, electionSurveys);
    }
    electionSurveys.push(survey);
  }

  /**
   * Seed sample data for previous year elections
   */
  async _seedSampleData() {
    // Sample candidates and voters
    const sampleCandidates = ['John Smith', 'Sarah Johnson', 'Michael Chen', 'Emily Davis'];
    const sampleVoters = [
      { name: 'Alice Brown', email: 'alice@example.com' },
      { name: 'Bob Wilson', email: 'bob@example.com' },
      { name: 'Carol Martinez', email: 'carol@example.com' },
      { name: 'David Lee', email: 'david@example.com' },
      { name: 'Emma Taylor', email: 'emma@example.com' },
      { name: 'Frank Anderson', email: 'frank@example.com' },
      { name: 'Grace White', email: 'grace@example.com' },
      { name: 'Henry Garcia', email: 'henry@example.com' },
      { name: 'Ivy Thompson', email: 'ivy@example.com' },
      { name: 'Jack Moore', email: 'jack@example.com' }
    ];

    // Register sample voters
    for (const voter of sampleVoters) {
      await this.registerUser(voter.name, voter.email, 'password123', 'voter');
    }

    // Create previous year election (2023)
    const prevElection = await this.createElection(
      '2023 City Council Election',
      'Annual city council election for district representatives',
      sampleCandidates,
      {
        'John Smith': 'I promise to improve public transportation, increase funding for schools, and create more green spaces in our city.',
        'Sarah Johnson': 'My priorities include affordable housing, healthcare access, and supporting local businesses.',
        'Michael Chen': 'I will focus on technology infrastructure, job creation, and environmental sustainability.',
        'Emily Davis': 'I commit to transparency in government, community safety, and supporting arts and culture.'
      }
    );

    if (prevElection.election) {
      const electionId = prevElection.election.id;
      
      // Set election to completed with dates
      const election = this.electionById.get(electionId);
      if (election) {
        election.phase = 'TALLY_COMPLETE';
        election.startTime = '2023-11-01T08:00:00Z';
        election.endTime = '2023-11-01T20:00:00Z';
      }

      // Create sample votes (simulate voting patterns)
      const votePatterns = [
        { candidate: 0, count: 3 }, // John Smith: 3 votes
        { candidate: 1, count: 4 }, // Sarah Johnson: 4 votes
        { candidate: 2, count: 2 }, // Michael Chen: 2 votes
        { candidate: 3, count: 1 }  // Emily Davis: 1 vote
      ];

      let voterIndex = 0;
      for (const pattern of votePatterns) {
        for (let i = 0; i < pattern.count && voterIndex < sampleVoters.length; i++) {
          const voter = this.userByEmail.get(sampleVoters[voterIndex].email);
          if (voter) {
            const key = `${electionId}_${voter.id}`;
            if (!this.hasVoted.has(key)) {
              const vote = new Vote(this.nextVoteId++, electionId, voter.id, pattern.candidate);
              this.votes.push(vote);
              this.hasVoted.put(key, true);
            }
          }
          voterIndex++;
        }
      }

      // Create surveys for each candidate
      const surveyQuestions = {
        'John Smith': 'How would you rate John Smith\'s performance and policies?',
        'Sarah Johnson': 'What is your opinion about Sarah Johnson\'s leadership?',
        'Michael Chen': 'How do you evaluate Michael Chen\'s vision for the city?',
        'Emily Davis': 'How would you rate Emily Davis\'s commitment to transparency?'
      };

      for (const candidate of sampleCandidates) {
        const survey = new Survey(
          this.nextSurveyId++,
          electionId,
          candidate,
          surveyQuestions[candidate] || `What is your opinion about ${candidate}?`
        );

        // Add sample survey responses with realistic ratings
        const responsePatterns = {
          'John Smith': [
            { rating: 5, comment: 'Excellent leadership and clear vision' },
            { rating: 4, comment: 'Good policies, needs more community engagement' },
            { rating: 4, comment: 'Strong candidate with practical solutions' },
            { rating: 3, comment: 'Average performance' }
          ],
          'Sarah Johnson': [
            { rating: 5, comment: 'Outstanding commitment to affordable housing' },
            { rating: 5, comment: 'Best candidate for healthcare reform' },
            { rating: 4, comment: 'Strong advocate for local businesses' },
            { rating: 4, comment: 'Good understanding of community needs' },
            { rating: 3, comment: 'Needs more experience' }
          ],
          'Michael Chen': [
            { rating: 4, comment: 'Great focus on technology and innovation' },
            { rating: 3, comment: 'Good ideas but needs better communication' },
            { rating: 3, comment: 'Environmental policies are promising' }
          ],
          'Emily Davis': [
            { rating: 4, comment: 'Transparency is commendable' },
            { rating: 3, comment: 'Good candidate but limited experience' },
            { rating: 2, comment: 'Needs more concrete plans' }
          ]
        };

        const responses = responsePatterns[candidate] || [];
        let responseVoterIndex = 0;
        for (const response of responses) {
          if (responseVoterIndex < sampleVoters.length) {
            const voter = this.userByEmail.get(sampleVoters[responseVoterIndex].email);
            if (voter) {
              survey.addResponse(voter.id, response.rating, response.comment);
            }
            responseVoterIndex++;
          }
        }

        this._addSurveyToIndexes(survey);
      }
    }

    // Create another previous election (2022)
    const prevElection2 = await this.createElection(
      '2022 Mayoral Election',
      'City mayoral election for term 2022-2026',
      ['Robert Williams', 'Lisa Anderson', 'James Taylor'],
      {
        'Robert Williams': 'Focus on economic growth and infrastructure development.',
        'Lisa Anderson': 'Prioritizing education, healthcare, and social services.',
        'James Taylor': 'Emphasizing public safety and community development.'
      }
    );

    if (prevElection2.election) {
      const electionId2 = prevElection2.election.id;
      const election2 = this.electionById.get(electionId2);
      if (election2) {
        election2.phase = 'TALLY_COMPLETE';
        election2.startTime = '2022-10-15T08:00:00Z';
        election2.endTime = '2022-10-15T20:00:00Z';
      }

      // Add votes for 2022 election
      const votePatterns2 = [
        { candidate: 0, count: 5 }, // Robert Williams: 5 votes
        { candidate: 1, count: 3 }, // Lisa Anderson: 3 votes
        { candidate: 2, count: 2 }  // James Taylor: 2 votes
      ];

      let voterIndex2 = 0;
      for (const pattern of votePatterns2) {
        for (let i = 0; i < pattern.count && voterIndex2 < sampleVoters.length; i++) {
          const voter = this.userByEmail.get(sampleVoters[voterIndex2].email);
          if (voter) {
            const key = `${electionId2}_${voter.id}`;
            if (!this.hasVoted.has(key)) {
              const vote = new Vote(this.nextVoteId++, electionId2, voter.id, pattern.candidate);
              this.votes.push(vote);
              this.hasVoted.put(key, true);
            }
          }
          voterIndex2++;
        }
      }

      // Create surveys for 2022 election
      const surveyQuestions2 = {
        'Robert Williams': 'How would you rate Robert Williams\'s economic policies?',
        'Lisa Anderson': 'What is your opinion about Lisa Anderson\'s education initiatives?',
        'James Taylor': 'How do you evaluate James Taylor\'s public safety approach?'
      };

      for (const candidate of ['Robert Williams', 'Lisa Anderson', 'James Taylor']) {
        const survey = new Survey(
          this.nextSurveyId++,
          electionId2,
          candidate,
          surveyQuestions2[candidate] || `What is your opinion about ${candidate}?`
        );

        const responsePatterns2 = {
          'Robert Williams': [
            { rating: 5, comment: 'Strong economic vision' },
            { rating: 5, comment: 'Excellent infrastructure plans' },
            { rating: 4, comment: 'Good leadership skills' },
            { rating: 4, comment: 'Promising economic policies' },
            { rating: 4, comment: 'Well-planned development strategy' }
          ],
          'Lisa Anderson': [
            { rating: 5, comment: 'Outstanding education policies' },
            { rating: 4, comment: 'Great healthcare initiatives' },
            { rating: 4, comment: 'Cares about social services' }
          ],
          'James Taylor': [
            { rating: 4, comment: 'Strong focus on public safety' },
            { rating: 3, comment: 'Good community development ideas' },
            { rating: 3, comment: 'Needs more detailed plans' }
          ]
        };

        const responses = responsePatterns2[candidate] || [];
        let responseVoterIndex2 = 0;
        for (const response of responses) {
          if (responseVoterIndex2 < sampleVoters.length) {
            const voter = this.userByEmail.get(sampleVoters[responseVoterIndex2].email);
            if (voter) {
              survey.addResponse(voter.id, response.rating, response.comment);
            }
            responseVoterIndex2++;
          }
        }

        this._addSurveyToIndexes(survey);
      }
    }

    // Save all seeded data
    await this.save();
  }
}

