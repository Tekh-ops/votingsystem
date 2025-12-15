/**
 * QUEUE DATA STRUCTURE (FIFO - First In First Out)
 * 
 * Purpose: Process operations in order, manage audit logs, and handle async tasks
 * Time Complexity: O(1) enqueue/dequeue
 * Space Complexity: O(n)
 * 
 * Used for:
 * - Audit log buffering before writing to disk
 * - Processing vote submissions in order
 * - Managing background tasks
 * - Event queue for real-time updates
 */
export class Queue {
  constructor() {
    this.items = [];
    this.length = 0;
  }

  /**
   * Add item to the end of queue
   * @param {*} item - Item to enqueue
   */
  enqueue(item) {
    this.items.push(item);
    this.length = this.items.length;
  }

  /**
   * Remove and return first item
   * @returns {*} - First item or null if empty
   */
  dequeue() {
    if (this.isEmpty()) return null;
    this.length = this.items.length - 1;
    return this.items.shift();
  }

  /**
   * Peek at first item without removing
   * @returns {*} - First item or null if empty
   */
  front() {
    if (this.isEmpty()) return null;
    return this.items[0];
  }

  /**
   * Check if queue is empty
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
   * Convert to array
   * @returns {Array}
   */
  toArray() {
    return [...this.items];
  }
}

