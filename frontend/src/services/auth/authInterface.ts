import type {
  AuthResult,
  LoginCredentials,
  SignUpPayload,
  UsernameCheckResult,
  UserProfile,
  UserSession,
} from '../../types/quad';

export type {
  AuthResult,
  LoginCredentials,
  SignUpPayload,
  UsernameCheckResult,
  UserProfile,
  UserSession,
};

export interface AuthErrorDetails {
  isLockedOut?: boolean;
  lockoutRemainingSeconds?: number;
  consecutiveFailures?: number;
}

/**
 * Authentication Service Interface
 *
 * Defines the contract that any authentication provider (Mock, Firebase, REST/GraphQL)
 * must implement. The UI layer communicates strictly through this interface.
 */
export class AuthError extends Error {
  code: string;
  status: number;
  isLockedOut: boolean;
  lockoutRemainingSeconds: number;
  consecutiveFailures: number;

  constructor(
    message: string,
    code: string,
    status = 400,
    details: AuthErrorDetails = {}
  ) {
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
   */
  async signUp(_params: SignUpPayload): Promise<AuthResult> {
    throw new Error('Method signUp() must be implemented.');
  }

  /**
   * Authenticate an existing user
   */
  async logIn(_credentials: LoginCredentials): Promise<AuthResult> {
    throw new Error('Method logIn() must be implemented.');
  }

  /**
   * End current user session
   */
  async logOut(): Promise<void> {
    throw new Error('Method logOut() must be implemented.');
  }

  /**
   * Retrieve active session if valid
   */
  async getSession(): Promise<AuthResult | null> {
    throw new Error('Method getSession() must be implemented.');
  }

  /**
   * Check if a username is available in real-time
   */
  async checkUsernameAvailable(_username: string): Promise<UsernameCheckResult> {
    throw new Error('Method checkUsernameAvailable() must be implemented.');
  }

  /**
   * Update current user profile fields (immutable academic fields are rejected)
   */
  async updateProfile(_updates: Partial<UserProfile>): Promise<UserProfile> {
    throw new Error('Method updateProfile() must be implemented.');
  }

  /**
   * Request password reset instructions
   */
  async requestPasswordReset(
    _identifier: string
  ): Promise<{ success: boolean; message: string }> {
    throw new Error('Method requestPasswordReset() must be implemented.');
  }

  /**
   * Re-authenticate password for sensitive/dangerous actions
   */
  async verifyPassword(_password: string): Promise<boolean> {
    throw new Error('Method verifyPassword() must be implemented.');
  }

  async exportMyData(): Promise<Record<string, unknown>> {
    throw new Error('Method exportMyData() is not supported by this auth provider.');
  }

  async deleteMyAccount(): Promise<Record<string, unknown>> {
    throw new Error('Method deleteMyAccount() is not supported by this auth provider.');
  }
}
