/**
 * HASH TABLE DATA STRUCTURE
 * 
 * Purpose: Fast O(1) average-case lookups for users, elections, and vote tracking
 * Time Complexity: O(1) average, O(n) worst case (collision)
 * Space Complexity: O(n)
 * 
 * Used for:
 * - userById: Quick user lookup by ID
 * - userByEmail: Fast email-based authentication
 * - electionById: Quick election access
 * - hasVoted: Track if voter has already voted (election_id + voter_id -> boolean)
 * - sessionTokens: Map session tokens to user IDs
 */
export class HashTable {
  constructor(initialCapacity = 16, loadFactor = 0.75) {
    this.buckets = new Array(initialCapacity).fill(null).map(() => []);
    this.size = 0;
    this.capacity = initialCapacity;
    this.loadFactor = loadFactor;
  }

  /**
   * Hash function (djb2 variant)
   * @param {string|number} key - Key to hash
   * @returns {number} - Hash value
   */
  _hash(key) {
    const str = String(key);
    let hash = 5381;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) + hash) + str.charCodeAt(i);
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash) % this.capacity;
  }

  /**
   * Insert or update key-value pair
   * @param {string|number} key - Key
   * @param {*} value - Value
   */
  put(key, value) {
    const index = this._hash(key);
    const bucket = this.buckets[index];
    
    // Check if key already exists
    for (let i = 0; i < bucket.length; i++) {
      if (bucket[i][0] === key) {
        bucket[i][1] = value;
        return;
      }
    }
    
    // Add new entry
    bucket.push([key, value]);
    this.size++;
    
    // Resize if needed
    if (this.size > this.capacity * this.loadFactor) {
      this._resize();
    }
  }

  /**
   * Get value by key
   * @param {string|number} key - Key to lookup
   * @returns {*} - Value or undefined if not found
   */
  get(key) {
    const index = this._hash(key);
    const bucket = this.buckets[index];
    for (let i = 0; i < bucket.length; i++) {
      if (bucket[i][0] === key) {
        return bucket[i][1];
      }
    }
    return undefined;
  }

  /**
   * Check if key exists
   * @param {string|number} key - Key to check
   * @returns {boolean}
   */
  has(key) {
    return this.get(key) !== undefined;
  }

  /**
   * Remove key-value pair
   * @param {string|number} key - Key to remove
   * @returns {boolean} - True if removed, false if not found
   */
  delete(key) {
    const index = this._hash(key);
    const bucket = this.buckets[index];
    for (let i = 0; i < bucket.length; i++) {
      if (bucket[i][0] === key) {
        bucket.splice(i, 1);
        this.size--;
        return true;
      }
    }
    return false;
  }

  /**
   * Resize hash table when load factor exceeded
   */
  _resize() {
    const oldBuckets = this.buckets;
    this.capacity *= 2;
    this.buckets = new Array(this.capacity).fill(null).map(() => []);
    this.size = 0;
    
    // Rehash all entries
    for (const bucket of oldBuckets) {
      for (const [key, value] of bucket) {
        this.put(key, value);
      }
    }
  }

  /**
   * Get all keys
   * @returns {Array}
   */
  keys() {
    const keys = [];
    for (const bucket of this.buckets) {
      for (const [key] of bucket) {
        keys.push(key);
      }
    }
    return keys;
  }

  /**
   * Get all values
   * @returns {Array}
   */
  values() {
    const values = [];
    for (const bucket of this.buckets) {
      for (const [_, value] of bucket) {
        values.push(value);
      }
    }
    return values;
  }

  /**
   * Clear all entries
   */
  clear() {
    this.buckets = new Array(this.capacity).fill(null).map(() => []);
    this.size = 0;
  }
}

