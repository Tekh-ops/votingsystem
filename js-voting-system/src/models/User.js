/**
 * User Model
 */
export class User {
  constructor(id, name, email, passwordHash, role, salt) {
    this.id = id;
    this.name = name;
    this.email = email;
    this.passwordHash = passwordHash;
    this.role = role; // 'admin' or 'voter'
    this.salt = salt;
    this.active = true;
    this.createdAt = new Date().toISOString();
  }

  static fromJSON(json) {
    const user = new User(
      json.id,
      json.name,
      json.email,
      json.passwordHash,
      json.role,
      json.salt
    );
    user.active = json.active ?? true;
    user.createdAt = json.createdAt;
    return user;
  }

  toJSON() {
    return {
      id: this.id,
      name: this.name,
      email: this.email,
      passwordHash: this.passwordHash,
      role: this.role,
      salt: this.salt,
      active: this.active,
      createdAt: this.createdAt
    };
  }
}

