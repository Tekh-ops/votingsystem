/**
 * Bun Server - Online Voting System
 * Uses Hono for routing and API endpoints
 */
import { Hono } from 'hono';
import { serveStatic } from 'hono/bun';
import { cors } from 'hono/cors';
import { AppState } from '../app/AppState.js';

const app = new Hono();

// Enable CORS
app.use('/*', cors({
  origin: '*',
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
}));

// Initialize application state (loads from CSV)
const appState = new AppState();
await appState.load();

// Serve static files
app.use('/*', serveStatic({ root: './public' }));

// ==================== API ROUTES ====================

// Health check
app.get('/api/health', (c) => {
  return c.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ==================== AUTH ROUTES ====================

// Register user
app.post('/api/register', async (c) => {
  try {
    const { name, email, password, role } = await c.req.json();
    if (!name || !email || !password) {
      return c.json({ error: 'Missing required fields' }, 400);
    }
    
    const result = await appState.registerUser(name, email, password, role || 'voter');
    if (result.error) {
      return c.json(result, 400);
    }
    
    return c.json({ success: true, user: result.user });
  } catch (error) {
    return c.json({ error: error.message }, 500);
  }
});

// Login
app.post('/api/login', async (c) => {
  try {
    const { email, password, adminPin } = await c.req.json();
    if (!email || !password) {
      return c.json({ error: 'Email and password required' }, 400);
    }
    
    const result = await appState.login(email, password, adminPin);
    if (result.error) {
      return c.json(result, 401);
    }
    
    return c.json({ success: true, user: result.user, token: result.token });
  } catch (error) {
    return c.json({ error: error.message }, 500);
  }
});

// Logout
app.post('/api/logout', async (c) => {
  const token = c.req.header('Authorization')?.replace('Bearer ', '');
  if (token) {
    appState.logout(token);
  }
  return c.json({ success: true });
});

// Get current user
app.get('/api/me', async (c) => {
  const token = c.req.header('Authorization')?.replace('Bearer ', '');
  if (!token) {
    return c.json({ error: 'Not authenticated' }, 401);
  }
  
  const user = appState.getUserByToken(token);
  if (!user) {
    return c.json({ error: 'Invalid token' }, 401);
  }
  
  return c.json({ user });
});

// ==================== ELECTION ROUTES ====================

// List all elections
app.get('/api/elections', async (c) => {
  const elections = appState.listElections();
  return c.json({ elections });
});

// Get election by ID
app.get('/api/elections/:id', async (c) => {
  const id = parseInt(c.req.param('id'));
  const election = appState.getElection(id);
  if (!election) {
    return c.json({ error: 'Election not found' }, 404);
  }
  return c.json({ election });
});

// Create election (admin only)
app.post('/api/elections', async (c) => {
  const token = c.req.header('Authorization')?.replace('Bearer ', '');
  if (!token || !appState.isAdmin(token)) {
    return c.json({ error: 'Admin access required' }, 403);
  }
  
  try {
    const { title, description, candidates, manifestos } = await c.req.json();
    if (!title || !candidates || !Array.isArray(candidates)) {
      return c.json({ error: 'Invalid election data' }, 400);
    }
    
    const result = await appState.createElection(title, description, candidates, manifestos || {});
    if (result.error) {
      return c.json(result, 400);
    }
    
    return c.json({ success: true, election: result.election });
  } catch (error) {
    return c.json({ error: error.message }, 500);
  }
});

// Update election phase (admin only)
app.put('/api/elections/:id/phase', async (c) => {
  const token = c.req.header('Authorization')?.replace('Bearer ', '');
  if (!token || !appState.isAdmin(token)) {
    return c.json({ error: 'Admin access required' }, 403);
  }
  
  try {
    const id = parseInt(c.req.param('id'));
    const { phase } = await c.req.json();
    
    const result = await appState.updateElectionPhase(id, phase);
    if (result.error) {
      return c.json(result, 400);
    }
    
    return c.json({ success: true });
  } catch (error) {
    return c.json({ error: error.message }, 500);
  }
});

// Add/update manifesto (admin only)
app.put('/api/elections/:id/manifesto', async (c) => {
  const token = c.req.header('Authorization')?.replace('Bearer ', '');
  if (!token || !appState.isAdmin(token)) {
    return c.json({ error: 'Admin access required' }, 403);
  }
  
  try {
    const id = parseInt(c.req.param('id'));
    const { candidateName, manifesto } = await c.req.json();
    
    const result = await appState.setManifesto(id, candidateName, manifesto);
    if (result.error) {
      return c.json(result, 400);
    }
    
    return c.json({ success: true });
  } catch (error) {
    return c.json({ error: error.message }, 500);
  }
});

// ==================== VOTE ROUTES ====================

// Cast vote
app.post('/api/votes', async (c) => {
  const token = c.req.header('Authorization')?.replace('Bearer ', '');
  if (!token) {
    return c.json({ error: 'Authentication required' }, 401);
  }
  
  try {
    const { electionId, choice } = await c.req.json();
    if (electionId === undefined || choice === undefined) {
      return c.json({ error: 'Election ID and choice required' }, 400);
    }
    
    const result = await appState.castVote(token, electionId, choice);
    if (result.error) {
      return c.json(result, 400);
    }
    
    return c.json({ success: true, vote: result.vote });
  } catch (error) {
    return c.json({ error: error.message }, 500);
  }
});

// Get votes for election (admin only)
app.get('/api/elections/:id/votes', async (c) => {
  const token = c.req.header('Authorization')?.replace('Bearer ', '');
  if (!token || !appState.isAdmin(token)) {
    return c.json({ error: 'Admin access required' }, 403);
  }
  
  const id = parseInt(c.req.param('id'));
  const votes = appState.getVotesForElection(id);
  return c.json({ votes });
});

// ==================== TALLY ROUTES ====================

// Tally election results
app.get('/api/elections/:id/tally', async (c) => {
  const id = parseInt(c.req.param('id'));
  const result = appState.tallyElection(id);
  if (result.error) {
    return c.json(result, 404);
  }
  return c.json(result);
});

// ==================== PREDICTION ROUTES ====================

// Get election prediction (async - uses online dataset)
app.get('/api/elections/:id/prediction', async (c) => {
  const id = parseInt(c.req.param('id'));
  const prediction = await appState.getPrediction(id);
  if (prediction.error) {
    return c.json(prediction, 404);
  }
  return c.json(prediction);
});

// ==================== SURVEY ROUTES ====================

// Create survey (admin only)
app.post('/api/surveys', async (c) => {
  const token = c.req.header('Authorization')?.replace('Bearer ', '');
  if (!token || !appState.isAdmin(token)) {
    return c.json({ error: 'Admin access required' }, 403);
  }
  
  try {
    const { electionId, candidateName, question } = await c.req.json();
    if (!electionId || !candidateName || !question) {
      return c.json({ error: 'Missing required fields' }, 400);
    }
    
    const result = await appState.createSurvey(electionId, candidateName, question);
    if (result.error) {
      return c.json(result, 400);
    }
    
    return c.json({ success: true, survey: result.survey });
  } catch (error) {
    return c.json({ error: error.message }, 500);
  }
});

// Get surveys for election
app.get('/api/elections/:id/surveys', async (c) => {
  const id = parseInt(c.req.param('id'));
  const surveys = appState.getSurveysForElection(id);
  return c.json({ surveys });
});

// Submit survey response
app.post('/api/surveys/:id/response', async (c) => {
  const token = c.req.header('Authorization')?.replace('Bearer ', '');
  if (!token) {
    return c.json({ error: 'Authentication required' }, 401);
  }
  
  try {
    const id = parseInt(c.req.param('id'));
    const { rating, comment } = await c.req.json();
    if (rating === undefined || rating < 1 || rating > 5) {
      return c.json({ error: 'Rating must be between 1 and 5' }, 400);
    }
    
    const result = await appState.submitSurveyResponse(token, id, rating, comment || '');
    if (result.error) {
      return c.json(result, 400);
    }
    
    return c.json({ success: true, survey: result.survey });
  } catch (error) {
    return c.json({ error: error.message }, 500);
  }
});

// Get all surveys
app.get('/api/surveys', async (c) => {
  const token = c.req.header('Authorization')?.replace('Bearer ', '');
  if (!token) {
    return c.json({ error: 'Authentication required' }, 401);
  }
  
  const surveys = appState.getAllSurveys();
  return c.json({ surveys });
});

// ==================== EXPORT ROUTES ====================

// Export votes to CSV
app.get('/api/export/votes', async (c) => {
  const token = c.req.header('Authorization')?.replace('Bearer ', '');
  if (!token || !appState.isAdmin(token)) {
    return c.json({ error: 'Admin access required' }, 403);
  }
  
  const csv = await appState.exportVotesCSV();
  return c.text(csv, 200, {
    'Content-Type': 'text/csv',
    'Content-Disposition': 'attachment; filename="votes.csv"'
  });
});

// Save state on shutdown
process.on('SIGINT', async () => {
  console.log('\nSaving state...');
  await appState.save();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\nSaving state...');
  await appState.save();
  process.exit(0);
});

// Start server
const port = process.env.PORT || 3000;
console.log(`🚀 Server running on http://localhost:${port}`);

export default {
  port,
  fetch: app.fetch,
};

