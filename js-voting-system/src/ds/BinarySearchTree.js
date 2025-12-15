/**
 * BINARY SEARCH TREE (BST) DATA STRUCTURE
 * 
 * Purpose: Maintain sorted order for elections by date, users by name, etc.
 * Time Complexity: O(log n) average, O(n) worst case (unbalanced)
 * Space Complexity: O(n)
 * 
 * Used for:
 * - Elections sorted by start_time for chronological display
 * - Users sorted by name for alphabetical listing
 * - Range queries (elections between dates)
 * - In-order traversal for sorted output
 */
export class BinarySearchTree {
  constructor(compareFn = (a, b) => a - b) {
    this.root = null;
    this.compare = compareFn;
    this.size = 0;
  }

  /**
   * Insert a value into the tree
   * @param {*} value - Value to insert
   * @param {*} key - Optional key for comparison
   */
  insert(value, key = null) {
    const node = { value, key: key !== null ? key : value, left: null, right: null };
    this.root = this._insertRec(this.root, node);
    this.size++;
  }

  _insertRec(root, node) {
    if (!root) return node;
    
    const cmp = this.compare(node.key, root.key);
    if (cmp < 0) {
      root.left = this._insertRec(root.left, node);
    } else if (cmp > 0) {
      root.right = this._insertRec(root.right, node);
    }
    return root;
  }

  /**
   * Search for a value
   * @param {*} key - Key to search for
   * @returns {*} - Found value or null
   */
  search(key) {
    return this._searchRec(this.root, key);
  }

  _searchRec(root, key) {
    if (!root) return null;
    const cmp = this.compare(key, root.key);
    if (cmp === 0) return root.value;
    if (cmp < 0) return this._searchRec(root.left, key);
    return this._searchRec(root.right, key);
  }

  /**
   * In-order traversal (sorted order)
   * @param {Function} callback - Function called for each node
   */
  inOrder(callback) {
    this._inOrderRec(this.root, callback);
  }

  _inOrderRec(root, callback) {
    if (root) {
      this._inOrderRec(root.left, callback);
      callback(root.value);
      this._inOrderRec(root.right, callback);
    }
  }

  /**
   * Get all values in sorted order
   * @returns {Array}
   */
  toArray() {
    const arr = [];
    this.inOrder(value => arr.push(value));
    return arr;
  }

  /**
   * Find minimum value
   * @returns {*} - Minimum value or null
   */
  min() {
    if (!this.root) return null;
    let current = this.root;
    while (current.left) {
      current = current.left;
    }
    return current.value;
  }

  /**
   * Find maximum value
   * @returns {*} - Maximum value or null
   */
  max() {
    if (!this.root) return null;
    let current = this.root;
    while (current.right) {
      current = current.right;
    }
    return current.value;
  }

  /**
   * Clear the tree
   */
  clear() {
    this.root = null;
    this.size = 0;
  }
}

