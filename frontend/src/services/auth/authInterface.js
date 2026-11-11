/**
 * Authentication Service Interface
 * 
 * Defines the contract that any authentication provider (Mock, Firebase, REST/GraphQL)
 * must implement. The UI layer communicates strictly through this interface.
 * 
 * @typedef {Object} UserSession
 * @property {string} token - Bearer or JWT session token
 * @property {number} expiresAt - Timestamp when token expires
 * 
 * @typedef {Object} UserProfile
 * @property {string} id - Unique student UUID
 * @property {string} username - Chosen pseudonym handle (e.g. quantum_dev)
 * @property {string} email - Verified college email (never shown to other peers)
 * @property {('student'|'admin')} [role] - User role ('student' or 'admin')
 * @property {string} [fullName] - Student legal name (kept in private vault)
 * @property {string} [dob] - Date of birth (YYYY-MM-DD)
 * @property {string} department - Academic department (full name, permanently linked to email)
 * @property {string} year - Academic year (1st, 2nd, 3rd, 4th, permanently linked to email)
 * @property {string} section - Academic section (A through H, private vault only)
 * @property {string} [bio] - Optional short profile bio
 * @property {string} [avatarInitials] - 2-letter monogram initials (e.g. QD)
 * @property {string[]} [interests] - Selected campus interest tags
 * @property {string[]} [following] - IDs of followed clubs or peers
 * @property {string} [branch] - Short branch code alias for UI backward compatibility
 * @property {boolean} [profilePublic] - Whether personal space is public
 * @property {string} createdAt - Account creation timestamp
 * 
 * @typedef {Object} AuthResult
 * @property {UserProfile} user - Authenticated user details
 * @property {UserSession} session - Active auth session
 */

export class AuthError extends Error {
  /**
   * @param {string} message - User-friendly error message
   * @param {string} code - Machine-readable error code
   * @param {number} [status] - HTTP status code equivalent
   * @param {Object} [details] - Additional lockout and rate limiting details
   * @param {boolean} [details.isLockedOut] - Whether the account is locked out
   * @param {number} [details.lockoutRemainingSeconds] - Seconds until lockout expires
   * @param {number} [details.consecutiveFailures] - Consecutive failed attempts
   */
  constructor(message, code, status = 400, details = {}) {
    super(message);
    this.name = 'AuthError';
    this.code = code;
    this.status = status;
    this.isLockedOut = details.isLockedOut || false;
    this.lockoutRemainingSeconds = details.lockoutRemainingSeconds || 0;
    this.consecutiveFailures = details.consecutiveFailures || 0;
  }
}

/**
 * Base Abstract Auth Service Interface
 */
export class IAuthService {
  /**
   * Register a new user account
   * @param {Object} params
   * @param {string} params.email - Verified college email address (.edu / college domain)
   * @param {string} params.password - Account password
   * @param {string} params.fullName - Student full name
   * @param {string} params.dob - Date of birth (YYYY-MM-DD)
   * @param {string} params.department - Academic department (full name)
   * @param {string} params.year - Academic year (1st, 2nd, 3rd, 4th)
   * @param {string} params.section - Academic section (A through H)
   * @param {string} params.username - Desired username handle
   * @param {string} [params.bio] - Optional bio text
   * @param {string} [params.avatarInitials] - Optional avatar initials
   * @param {string[]} [params.interests] - Selected interest tags
   * @param {string[]} [params.following] - Peer handles to follow
   * @returns {Promise<AuthResult>}
   */
  async signUp(_params) {
    throw new Error('Method signUp() must be implemented.');
  }

  /**
   * Authenticate an existing user
   * @param {Object} credentials
   * @param {string} credentials.identifier - Campus username or verified college email
   * @param {string} credentials.password - Account password
   * @returns {Promise<AuthResult>}
   */
  async logIn(_credentials) {
    throw new Error('Method logIn() must be implemented.');
  }

  /**
   * End current user session
   * @returns {Promise<void>}
   */
  async logOut() {
    throw new Error('Method logOut() must be implemented.');
  }

  /**
   * Retrieve active session if valid
   * @returns {Promise<AuthResult|null>}
   */
  async getSession() {
    throw new Error('Method getSession() must be implemented.');
  }

  /**
   * Check if a username is available in real-time
   * @param {string} _username - Handle to verify
   * @returns {Promise<{ available: boolean, suggestions?: string[] }>}
   */
  async checkUsernameAvailable(_username) {
    throw new Error('Method checkUsernameAvailable() must be implemented.');
  }

  /**
   * Update current user profile fields (immutable academic fields are rejected)
   * @param {Partial<UserProfile>} _updates
   * @returns {Promise<UserProfile>}
   */
  async updateProfile(_updates) {
    throw new Error('Method updateProfile() must be implemented.');
  }

  /**
   * Request password reset instructions
   * @param {string} _identifier - Campus username or verified college email
   * @returns {Promise<{ success: boolean, message: string }>}
   */
  async requestPasswordReset(_identifier) {
    throw new Error('Method requestPasswordReset() must be implemented.');
  }

  /**
   * Re-authenticate password for sensitive/dangerous actions
   * @param {string} _password - Plaintext password to verify
   * @returns {Promise<boolean>}
   */
  async verifyPassword(_password) {
    throw new Error('Method verifyPassword() must be implemented.');
  }
}
