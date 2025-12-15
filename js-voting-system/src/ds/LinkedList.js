/**
 * LINKED LIST DATA STRUCTURE
 * 
 * Purpose: Store collections of users, elections, and votes in memory
 * Time Complexity: O(1) insert/delete at head/tail, O(n) search
 * Space Complexity: O(n)
 * 
 * Used for:
 * - Maintaining lists of users, elections, votes
 * - Iterating through all records for display/export
 * - Sequential access patterns
 */
export class LinkedList {
  constructor() {
    this.head = null;
    this.tail = null;
    this.length = 0;
  }

  /**
   * Add node to the end of the list
   * @param {*} data - Data to store in the node
   * @returns {Node} - The created node
   */
  push(data) {
    const node = { data, next: null };
    if (!this.head) {
      this.head = node;
      this.tail = node;
    } else {
      this.tail.next = node;
      this.tail = node;
    }
    this.length++;
    return node;
  }

  /**
   * Remove and return the last node
   * @returns {*} - Data from the removed node
   */
  pop() {
    if (!this.head) return null;
    if (this.head === this.tail) {
      const data = this.head.data;
      this.head = null;
      this.tail = null;
      this.length = 0;
      return data;
    }
    let current = this.head;
    while (current.next !== this.tail) {
      current = current.next;
    }
    const data = this.tail.data;
    this.tail = current;
    this.tail.next = null;
    this.length--;
    return data;
  }

  /**
   * Add node to the beginning of the list
   * @param {*} data - Data to store
   * @returns {Node} - The created node
   */
  unshift(data) {
    const node = { data, next: this.head };
    if (!this.head) {
      this.tail = node;
    }
    this.head = node;
    this.length++;
    return node;
  }

  /**
   * Remove and return the first node
   * @returns {*} - Data from the removed node
   */
  shift() {
    if (!this.head) return null;
    const data = this.head.data;
    this.head = this.head.next;
    if (!this.head) this.tail = null;
    this.length--;
    return data;
  }

  /**
   * Find a node by predicate function
   * @param {Function} predicate - Function that returns true for matching node
   * @returns {*} - Found data or null
   */
  find(predicate) {
    let current = this.head;
    while (current) {
      if (predicate(current.data)) return current.data;
      current = current.next;
    }
    return null;
  }

  /**
   * Remove node matching predicate
   * @param {Function} predicate - Function that returns true for node to remove
   * @returns {boolean} - True if removed, false if not found
   */
  remove(predicate) {
    if (!this.head) return false;
    if (predicate(this.head.data)) {
      this.shift();
      return true;
    }
    let current = this.head;
    while (current.next) {
      if (predicate(current.next.data)) {
        current.next = current.next.next;
        if (!current.next) this.tail = current;
        this.length--;
        return true;
      }
      current = current.next;
    }
    return false;
  }

  /**
   * Convert list to array
   * @returns {Array} - Array of all data
   */
  toArray() {
    const arr = [];
    let current = this.head;
    while (current) {
      arr.push(current.data);
      current = current.next;
    }
    return arr;
  }

  /**
   * Iterate over all nodes
   * @param {Function} callback - Function called for each node
   */
  forEach(callback) {
    let current = this.head;
    let index = 0;
    while (current) {
      callback(current.data, index++);
      current = current.next;
    }
  }

  /**
   * Clear all nodes
   */
  clear() {
    this.head = null;
    this.tail = null;
    this.length = 0;
  }
}

