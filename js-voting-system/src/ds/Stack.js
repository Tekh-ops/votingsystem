/**
 * STACK DATA STRUCTURE (LIFO - Last In First Out)
 * 
 * Purpose: Manage undo/redo operations, WAL replay, and recursive algorithm simulation
 * Time Complexity: O(1) push/pop/peek
 * Space Complexity: O(n)
 * 
 * Used for:
 * - Undo/redo functionality for admin operations
 * - Write-ahead log (WAL) replay in correct order
 * - Simulating recursion in tree traversals
 * - Managing operation history
 */
export class Stack {
  constructor() {
    this.items = [];
    this.length = 0;
  }

  /**
   * Push item onto stack
   * @param {*} item - Item to push
   */
  push(item) {
    this.items.push(item);
    this.length = this.items.length;
  }

  /**
   * Pop and return top item
   * @returns {*} - Top item or null if empty
   */
  pop() {
    if (this.isEmpty()) return null;
    this.length = this.items.length - 1;
    return this.items.pop();
  }

  /**
   * Peek at top item without removing
   * @returns {*} - Top item or null if empty
   */
  peek() {
    if (this.isEmpty()) return null;
    return this.items[this.items.length - 1];
  }

  /**
   * Check if stack is empty
   * @returns {boolean}
   */
  isEmpty() {
    return this.items.length === 0;
  }

  /**
   * Get current size
   * @returns {number}
   */
  size() {
    return this.items.length;
  }

  /**
   * Clear all items
   */
  clear() {
    this.items = [];
    this.length = 0;
  }

  /**
   * Convert to array (top to bottom)
   * @returns {Array}
   */
  toArray() {
    return [...this.items].reverse();
  }
}

