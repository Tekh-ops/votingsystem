/**
 * Election Prediction Module
 * Uses historical data and current vote patterns to predict winners
 * 
 * Data Structures Used:
 * - HashTable: Store prediction cache and historical patterns
 * - SelectionTree: Analyze vote distribution patterns
 * - Queue: Process prediction requests
 * - BinarySearchTree: Store sorted historical performance data
 */
import { SelectionTree } from '../ds/SelectionTree.js';
import { HashTable } from '../ds/HashTable.js';
import { Queue } from '../ds/Queue.js';
import { BinarySearchTree } from '../ds/BinarySearchTree.js';

// Historical data cache (HashTable for O(1) lookups)
const HISTORICAL_DATA = {
  patterns: new HashTable(),
  trends: new HashTable(),
  performanceHistory: new BinarySearchTree((a, b) => a.date - b.date) // Sorted by date
};

// Prediction request queue
const predictionQueue = new Queue();

/**
 * Fetch online dataset for election predictions
 * Uses mock API simulation - in production, replace with real API endpoint
 */
async function fetchOnlineDataset(candidateName) {
  try {
    // Simulate API call with timeout
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Mock online dataset - simulates data from external election prediction service
    const mockDataset = {
      'Alice': { winRate: 0.68, avgVotes: 1250, trend: 'up', popularity: 0.75, manifestoScore: 0.82 },
      'Bob': { winRate: 0.42, avgVotes: 780, trend: 'stable', popularity: 0.58, manifestoScore: 0.65 },
      'Carol': { winRate: 0.58, avgVotes: 980, trend: 'up', popularity: 0.68, manifestoScore: 0.74 },
      'David': { winRate: 0.32, avgVotes: 550, trend: 'down', popularity: 0.45, manifestoScore: 0.52 },
      'Emma': { winRate: 0.51, avgVotes: 890, trend: 'up', popularity: 0.62, manifestoScore: 0.69 },
      'Frank': { winRate: 0.38, avgVotes: 680, trend: 'stable', popularity: 0.52, manifestoScore: 0.58 }
    };
    
    // Return data if available, otherwise return default
    return mockDataset[candidateName] || {
      winRate: 0.30,
      avgVotes: 500,
      trend: 'stable',
      popularity: 0.50,
      manifestoScore: 0.50
    };
  } catch (error) {
    console.error('Error fetching online dataset:', error);
    // Fallback to cached data
    return HISTORICAL_DATA.patterns.get(candidateName) || {
      winRate: 0.30,
      avgVotes: 500,
      trend: 'stable',
      popularity: 0.50,
      manifestoScore: 0.50
    };
  }
}

/**
 * Initialize historical data from online dataset
 */
async function initializeHistoricalData(candidates) {
  for (const candidate of candidates) {
    if (!HISTORICAL_DATA.patterns.has(candidate)) {
      const onlineData = await fetchOnlineDataset(candidate);
      HISTORICAL_DATA.patterns.put(candidate, onlineData);
      
      // Store in performance history (BST for chronological queries)
      HISTORICAL_DATA.performanceHistory.insert({
        candidate,
        date: Date.now(),
        ...onlineData
      }, Date.now());
    }
  }
}

/**
 * Calculate prediction based on current votes and historical patterns
 * Uses real election data from current and previous elections
 * @param {Array} candidates - Array of candidate names
 * @param {Array} voteCounts - Current vote counts per candidate
 * @param {Object} manifestos - Manifesto data (affects popularity)
 * @param {Object} surveyData - Survey ratings for candidates { candidateName: { avgRating, totalResponses } }
 * @param {Array} previousElections - Previous election results for pattern analysis
 * @returns {Promise<Object>} - Prediction results
 */
export async function predictElection(candidates, voteCounts, manifestos = {}, surveyData = {}, previousElections = []) {
  // Initialize historical data from online dataset
  await initializeHistoricalData(candidates);
  
  const results = {
    predictions: [],
    confidence: 0,
    winner: null,
    analysis: [],
    dataSource: 'Online Dataset + Historical Patterns'
  };

  // Use SelectionTree to find current leader efficiently
  const selectionTree = new SelectionTree(voteCounts);
  const currentWinner = selectionTree.winner();
  const totalVotes = voteCounts.reduce((sum, count) => sum + count, 0);

  // Process each candidate (using Queue for async processing simulation)
  for (let i = 0; i < candidates.length; i++) {
    const candidate = candidates[i];
    const currentVotes = voteCounts[i];
    const currentPercentage = totalVotes > 0 ? (currentVotes / totalVotes) * 100 : 0;
    
    // Get historical pattern from online dataset (HashTable lookup O(1))
    let pattern = HISTORICAL_DATA.patterns.get(candidate);
    
    // If not in cache, fetch from online dataset
    if (!pattern) {
      pattern = await fetchOnlineDataset(candidate);
      HISTORICAL_DATA.patterns.put(candidate, pattern);
    }
    
    // Analyze previous elections for this candidate
    let historicalPerformance = { winRate: 0, totalElections: 0, avgVoteShare: 0 };
    if (previousElections.length > 0) {
      let wins = 0;
      let totalVoteShare = 0;
      previousElections.forEach(election => {
        const candidateIndex = election.candidates.indexOf(candidate);
        if (candidateIndex >= 0) {
          const totalVotes = election.voteCounts.reduce((sum, c) => sum + c, 0);
          if (totalVotes > 0) {
            const voteShare = election.voteCounts[candidateIndex] / totalVotes;
            totalVoteShare += voteShare;
            if (election.winnerIndex === candidateIndex) wins++;
            historicalPerformance.totalElections++;
          }
        }
      });
      if (historicalPerformance.totalElections > 0) {
        historicalPerformance.winRate = wins / historicalPerformance.totalElections;
        historicalPerformance.avgVoteShare = totalVoteShare / historicalPerformance.totalElections;
      }
    }
    
    // Get survey data for candidate
    const survey = surveyData[candidate] || { avgRating: 0, totalResponses: 0 };
    const surveyImpact = survey.totalResponses > 0 ? (survey.avgRating / 5) * 0.15 : 0; // Max 15% impact

    // Manifesto impact analysis
    const manifestoLength = manifestos[candidate]?.length || 0;
    const manifestoWords = manifestos[candidate]?.split(/\s+/).length || 0;
    const manifestoBonus = Math.min(manifestoLength / 1000, 0.15); // Max 15% bonus
    const manifestoQuality = manifestoWords > 100 ? 0.1 : 0; // Quality bonus for detailed manifestos

    // Calculate predicted win probability using multiple factors
    let winProbability = pattern.winRate || 0.3;
    
    // Factor 1: Current performance (30% weight)
    if (totalVotes > 0 && pattern.avgVotes > 0) {
      const performanceRatio = currentVotes / pattern.avgVotes;
      winProbability = winProbability * 0.7 + (performanceRatio * 0.3);
    }
    
    // Factor 2: Historical performance from previous elections (25% weight)
    if (historicalPerformance.totalElections > 0) {
      winProbability = winProbability * 0.75 + (historicalPerformance.winRate * 0.25);
      // Adjust based on historical vote share
      if (totalVotes > 0) {
        const currentShare = currentVotes / totalVotes;
        const shareDiff = currentShare - historicalPerformance.avgVoteShare;
        winProbability += shareDiff * 0.1; // Adjust based on deviation from historical average
      }
    }
    
    // Factor 3: Survey ratings (20% weight)
    winProbability += surveyImpact;
    
    // Factor 4: Online popularity score (10% weight)
    if (pattern.popularity) {
      winProbability = winProbability * 0.9 + (pattern.popularity * 0.1);
    }
    
    // Factor 5: Manifesto impact (10% weight)
    winProbability += manifestoBonus + manifestoQuality;
    
    // Factor 6: Trend adjustment (5% weight)
    if (pattern.trend === 'up') winProbability *= 1.05;
    if (pattern.trend === 'down') winProbability *= 0.95;
    
    // Cap probability
    winProbability = Math.min(winProbability, 0.95);
    winProbability = Math.max(winProbability, 0.05); // Minimum 5%

    // Queue prediction for batch processing
    predictionQueue.enqueue({ 
      candidate, 
      probability: winProbability,
      timestamp: Date.now()
    });

    results.predictions.push({
      candidate,
      currentVotes,
      currentPercentage: currentPercentage.toFixed(2),
      winProbability: (winProbability * 100).toFixed(2),
      manifestoLength,
      manifestoWords,
      trend: pattern.trend,
      popularity: pattern.popularity ? (pattern.popularity * 100).toFixed(2) : 'N/A',
      manifestoScore: pattern.manifestoScore ? (pattern.manifestoScore * 100).toFixed(2) : 'N/A',
      surveyRating: survey.avgRating || 'N/A',
      surveyResponses: survey.totalResponses || 0,
      historicalWinRate: historicalPerformance.totalElections > 0 
        ? (historicalPerformance.winRate * 100).toFixed(2) 
        : 'N/A',
      historicalAvgVoteShare: historicalPerformance.totalElections > 0
        ? (historicalPerformance.avgVoteShare * 100).toFixed(2)
        : 'N/A'
    });
  }

  // Sort by win probability (descending)
  results.predictions.sort((a, b) => parseFloat(b.winProbability) - parseFloat(a.winProbability));
  
  // Determine winner
  results.winner = results.predictions[0];
  
  // Calculate overall confidence (based on vote distribution and prediction spread)
  if (totalVotes > 0) {
    const topTwoDiff = parseFloat(results.predictions[0].currentPercentage) - 
                      (parseFloat(results.predictions[1]?.currentPercentage) || 0);
    const predictionSpread = parseFloat(results.predictions[0].winProbability) - 
                            (parseFloat(results.predictions[1]?.winProbability) || 0);
    
    // Confidence combines vote margin and prediction certainty
    results.confidence = Math.min(50 + (topTwoDiff * 0.5) + (predictionSpread * 0.3), 95).toFixed(2);
  } else {
    results.confidence = '30.00'; // Low confidence with no votes
  }

  // Generate detailed analysis
  results.analysis.push(`📊 Total votes cast: ${totalVotes}`);
  results.analysis.push(`🏆 Current leader: ${results.winner.candidate} (${results.winner.currentPercentage}%)`);
  results.analysis.push(`🔮 Predicted winner: ${results.winner.candidate} (${results.winner.winProbability}% probability)`);
  results.analysis.push(`📈 Confidence level: ${results.confidence}%`);
  
  if (results.predictions.length > 1) {
    const second = results.predictions[1];
    const gap = (parseFloat(results.winner.winProbability) - parseFloat(second.winProbability)).toFixed(2);
    results.analysis.push(`🥈 Close competitor: ${second.candidate} (${second.winProbability}% probability, ${gap}% gap)`);
  }
  
  // Add manifesto insights
  const topManifesto = results.predictions
    .filter(p => p.manifestoWords > 0)
    .sort((a, b) => b.manifestoWords - a.manifestoWords)[0];
  if (topManifesto) {
    results.analysis.push(`📝 Most detailed manifesto: ${topManifesto.candidate} (${topManifesto.manifestoWords} words)`);
  }

  return results;
}

/**
 * Update historical patterns (for learning from actual results)
 * @param {string} candidate - Candidate name
 * @param {Object} data - New pattern data
 */
export function updateHistoricalPattern(candidate, data) {
  HISTORICAL_DATA.patterns.put(candidate, data);
  
  // Also store in performance history BST (sorted by date)
  HISTORICAL_DATA.performanceHistory.insert({
    candidate,
    date: Date.now(),
    ...data
  }, Date.now());
}

/**
 * Get all historical patterns
 * @returns {Array} - Array of pattern objects
 */
export function getHistoricalPatterns() {
  return HISTORICAL_DATA.patterns.keys().map(key => ({
    candidate: key,
    ...HISTORICAL_DATA.patterns.get(key)
  }));
}

/**
 * Get performance history for a candidate (from BST)
 * @param {string} candidate - Candidate name
 * @param {number} days - Number of days to look back
 * @returns {Array} - Historical performance data
 */
export function getPerformanceHistory(candidate, days = 30) {
  const cutoff = Date.now() - (days * 24 * 60 * 60 * 1000);
  const history = [];
  
  HISTORICAL_DATA.performanceHistory.inOrder(item => {
    if (item.candidate === candidate && item.date >= cutoff) {
      history.push(item);
    }
  });
  
  return history;
}

/**
 * Process queued predictions (batch processing)
 * @returns {Array} - Processed predictions
 */
export function processPredictionQueue() {
  const processed = [];
  while (!predictionQueue.isEmpty()) {
    processed.push(predictionQueue.dequeue());
  }
  return processed;
}

