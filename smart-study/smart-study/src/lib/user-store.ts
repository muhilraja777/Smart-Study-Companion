export interface StoredUser {
  username: string;
  email: string;
  encodedPassword: string;
}

export interface Session {
  username: string;
  email: string;
}

const USERS_KEY = "ssc_users";
const SESSION_KEY = "ssc_session";

function encode(password: string): string {
  return btoa(encodeURIComponent(password));
}

export function getUsers(): StoredUser[] {
  try {
    return JSON.parse(localStorage.getItem(USERS_KEY) ?? "[]");
  } catch {
    return [];
  }
}

export type RegisterResult = "ok" | "email_taken" | "username_taken";

export function registerUser(
  username: string,
  email: string,
  password: string
): RegisterResult {
  const users = getUsers();
  if (users.some((u) => u.email.toLowerCase() === email.toLowerCase())) {
    return "email_taken";
  }
  if (users.some((u) => u.username.toLowerCase() === username.toLowerCase())) {
    return "username_taken";
  }
  users.push({ username, email, encodedPassword: encode(password) });
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
  return "ok";
}

export function loginUser(email: string, password: string): StoredUser | null {
  const users = getUsers();
  const user = users.find(
    (u) =>
      u.email.toLowerCase() === email.toLowerCase() &&
      u.encodedPassword === encode(password)
  );
  return user ?? null;
}

export function setSession(user: StoredUser): void {
  const session: Session = { username: user.username, email: user.email };
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export function getSession(): Session | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as Session;
  } catch {
    return null;
  }
}

export function clearSession(): void {
  localStorage.removeItem(SESSION_KEY);
}
