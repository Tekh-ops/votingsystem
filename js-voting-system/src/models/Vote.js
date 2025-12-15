/**
 * Vote Model
 */
export class Vote {
  constructor(id, electionId, voterId, choice, timestamp = null) {
    this.id = id;
    this.electionId = electionId;
    this.voterId = voterId;
    this.choice = choice; // Index of candidate in election.candidates array
    this.timestamp = timestamp || new Date().toISOString();
  }

  static fromJSON(json) {
    return new Vote(
      json.id,
      json.electionId,
      json.voterId,
      json.choice,
      json.timestamp
    );
  }

  toJSON() {
    return {
      id: this.id,
      electionId: this.electionId,
      voterId: this.voterId,
      choice: this.choice,
      timestamp: this.timestamp
    };
  }
}

