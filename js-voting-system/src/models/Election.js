/**
 * Election Model with Manifesto Support
 */
export class Election {
  constructor(id, title, description, candidates, manifestos = {}) {
    this.id = id;
    this.title = title;
    this.description = description;
    this.candidates = candidates; // Array of candidate names
    this.manifestos = manifestos; // Map: candidateName -> manifesto text
    this.phase = 'CREATED'; // CREATED, REGISTRATION_OPEN, VOTING_OPEN, VOTING_CLOSED, TALLY_COMPLETE
    this.startTime = null;
    this.endTime = null;
    this.createdAt = new Date().toISOString();
  }

  /**
   * Add or update manifesto for a candidate
   * @param {string} candidateName - Name of candidate
   * @param {string} manifesto - Manifesto text/promises
   */
  setManifesto(candidateName, manifesto) {
    if (!this.candidates.includes(candidateName)) {
      throw new Error(`Candidate ${candidateName} not found in election`);
    }
    this.manifestos[candidateName] = manifesto;
  }

  /**
   * Get manifesto for a candidate
   * @param {string} candidateName - Name of candidate
   * @returns {string|null} - Manifesto text or null
   */
  getManifesto(candidateName) {
    return this.manifestos[candidateName] || null;
  }

  static fromJSON(json) {
    const election = new Election(
      json.id,
      json.title,
      json.description,
      json.candidates,
      json.manifestos || {}
    );
    election.phase = json.phase || 'CREATED';
    election.startTime = json.startTime;
    election.endTime = json.endTime;
    election.createdAt = json.createdAt;
    return election;
  }

  toJSON() {
    return {
      id: this.id,
      title: this.title,
      description: this.description,
      candidates: this.candidates,
      manifestos: this.manifestos,
      phase: this.phase,
      startTime: this.startTime,
      endTime: this.endTime,
      createdAt: this.createdAt
    };
  }
}

