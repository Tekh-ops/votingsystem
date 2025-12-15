/**
 * Survey Model
 * Collects opinions about candidates
 */
export class Survey {
  constructor(id, electionId, candidateName, question, responses = []) {
    this.id = id;
    this.electionId = electionId;
    this.candidateName = candidateName;
    this.question = question;
    this.responses = responses; // Array of { voterId, rating, comment, timestamp }
    this.createdAt = new Date().toISOString();
  }

  /**
   * Add a response to the survey
   * @param {number} voterId - ID of voter responding
   * @param {number} rating - Rating 1-5
   * @param {string} comment - Optional comment
   */
  addResponse(voterId, rating, comment = '') {
    // Check if voter already responded
    if (this.responses.some(r => r.voterId === voterId)) {
      throw new Error('Voter has already responded to this survey');
    }
    
    if (rating < 1 || rating > 5) {
      throw new Error('Rating must be between 1 and 5');
    }
    
    this.responses.push({
      voterId,
      rating,
      comment,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Get average rating
   * @returns {number} - Average rating
   */
  getAverageRating() {
    if (this.responses.length === 0) return 0;
    const sum = this.responses.reduce((acc, r) => acc + r.rating, 0);
    return (sum / this.responses.length).toFixed(2);
  }

  /**
   * Get rating distribution
   * @returns {Object} - Count of each rating
   */
  getRatingDistribution() {
    const dist = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    this.responses.forEach(r => {
      dist[r.rating]++;
    });
    return dist;
  }

  static fromJSON(json) {
    const survey = new Survey(
      json.id,
      json.electionId,
      json.candidateName,
      json.question,
      json.responses || []
    );
    survey.createdAt = json.createdAt;
    return survey;
  }

  toJSON() {
    return {
      id: this.id,
      electionId: this.electionId,
      candidateName: this.candidateName,
      question: this.question,
      responses: this.responses,
      createdAt: this.createdAt,
      averageRating: this.getAverageRating(),
      totalResponses: this.responses.length
    };
  }
}

