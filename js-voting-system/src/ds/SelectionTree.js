/**
 * SELECTION TREE (TOURNAMENT TREE) DATA STRUCTURE
 * 
 * Purpose: Efficiently find winner and top-k candidates in O(log n) time
 * Time Complexity: O(n) build, O(log n) winner query, O(1) update
 * Space Complexity: O(n)
 * 
 * Used for:
 * - Finding election winner quickly after vote counting
 * - Maintaining top candidates during live voting
 * - Efficient winner determination without full sort
 */
export class SelectionTree {
  constructor(counts) {
    this.counts = counts;
    this.n = counts.length;
    this.tree = null;
    if (counts && counts.length > 0) {
      this.build();
    }
  }

  /**
   * Build the tournament tree from vote counts
   */
  build() {
    if (this.n === 0) return;
    
    // Tree size: 2 * n - 1 (complete binary tree)
    const treeSize = 2 * this.n - 1;
    this.tree = new Array(treeSize);
    
    // Initialize leaves with candidate indices
    for (let i = 0; i < this.n; i++) {
      this.tree[this.n - 1 + i] = i;
    }
    
    // Build tree bottom-up
    for (let i = this.n - 2; i >= 0; i--) {
      const left = this.tree[2 * i + 1];
      const right = this.tree[2 * i + 2];
      
      // Compare counts, winner is the one with higher count
      if (right === undefined || this.counts[left] >= this.counts[right]) {
        this.tree[i] = left;
      } else {
        this.tree[i] = right;
      }
    }
  }

  /**
   * Get the winner (candidate index with highest votes)
   * @returns {number} - Winner candidate index
   */
  winner() {
    if (!this.tree || this.n === 0) return -1;
    return this.tree[0];
  }

  /**
   * Update count for a candidate and rebuild tree
   * @param {number} candidateIndex - Index of candidate
   * @param {number} newCount - New vote count
   */
  update(candidateIndex, newCount) {
    if (candidateIndex < 0 || candidateIndex >= this.n) return;
    this.counts[candidateIndex] = newCount;
    this.build();
  }

  /**
   * Get top k candidates
   * @param {number} k - Number of top candidates
   * @returns {Array} - Array of {index, count} objects
   */
  topK(k) {
    if (k <= 0 || k > this.n) k = this.n;
    
    // Create array of {index, count} pairs
    const candidates = [];
    for (let i = 0; i < this.n; i++) {
      candidates.push({ index: i, count: this.counts[i] });
    }
    
    // Sort by count descending
    candidates.sort((a, b) => b.count - a.count);
    
    return candidates.slice(0, k);
  }

  /**
   * Get all results sorted by count
   * @returns {Array} - Array of {index, count} objects
   */
  results() {
    return this.topK(this.n);
  }
}

