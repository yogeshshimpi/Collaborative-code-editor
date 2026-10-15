import { pool, isDbConnected } from './index.js';

export const inMemoryUsers = new Map();
let inMemoryUserIdSeq = 1;

export async function createUser({ email, passwordHash, name }) {
  if (isDbConnected() && pool) {
    const query = `
      INSERT INTO users (email, password_hash, name)
      VALUES ($1, $2, $3)
      RETURNING id, email, name, created_at;
    `;
    const res = await pool.query(query, [email.toLowerCase().trim(), passwordHash, name.trim()]);
    return res.rows[0];
  }

  // Fallback in-memory
  const id = inMemoryUserIdSeq++;
  const user = {
    id,
    email: email.toLowerCase().trim(),
    password_hash: passwordHash,
    name: name.trim(),
    created_at: new Date()
  };
  inMemoryUsers.set(user.email, user);
  return { id: user.id, email: user.email, name: user.name, created_at: user.created_at };
}

export async function findUserByEmail(email) {
  if (!email) return null;
  const cleanEmail = email.toLowerCase().trim();

  if (isDbConnected() && pool) {
    const query = `
      SELECT id, email, password_hash, name, created_at
      FROM users
      WHERE LOWER(email) = $1;
    `;
    const res = await pool.query(query, [cleanEmail]);
    return res.rows[0] || null;
  }

  // Fallback in-memory
  return inMemoryUsers.get(cleanEmail) || null;
}

export async function findUserById(id) {
  if (!id) return null;

  if (isDbConnected() && pool) {
    const query = `
      SELECT id, email, name, created_at
      FROM users
      WHERE id = $1;
    `;
    const res = await pool.query(query, [id]);
    return res.rows[0] || null;
  }

  // Fallback in-memory
  for (const user of inMemoryUsers.values()) {
    if (user.id === id) {
      return { id: user.id, email: user.email, name: user.name, created_at: user.created_at };
    }
  }
  return null;
}

export async function findUserWithPasswordById(id) {
  if (!id) return null;

  if (isDbConnected() && pool) {
    const query = `
      SELECT id, email, password_hash, name, created_at
      FROM users
      WHERE id = $1;
    `;
    const res = await pool.query(query, [id]);
    return res.rows[0] || null;
  }

  // Fallback in-memory
  for (const user of inMemoryUsers.values()) {
    if (user.id === id) {
      return { ...user };
    }
  }
  return null;
}

export async function updateUserPassword(id, passwordHash) {
  if (!id || !passwordHash) return false;

  if (isDbConnected() && pool) {
    const query = `
      UPDATE users
      SET password_hash = $2
      WHERE id = $1;
    `;
    const res = await pool.query(query, [id, passwordHash]);
    return res.rowCount > 0;
  }

  // Fallback in-memory
  for (const user of inMemoryUsers.values()) {
    if (user.id === id) {
      user.password_hash = passwordHash;
      return true;
    }
  }
  return false;
}

export async function updateUserName(id, name) {
  if (!id || !name) return false;

  if (isDbConnected() && pool) {
    const query = `
      UPDATE users
      SET name = $2
      WHERE id = $1;
    `;
    const res = await pool.query(query, [id, name.trim()]);
    return res.rowCount > 0;
  }

  // Fallback in-memory
  for (const user of inMemoryUsers.values()) {
    if (user.id === id) {
      user.name = name.trim();
      return true;
    }
  }
  return false;
}

export async function deleteUserById(id) {
  if (!id) return false;

  if (isDbConnected() && pool) {
    const query = `
      DELETE FROM users
      WHERE id = $1;
    `;
    const res = await pool.query(query, [id]);
    return res.rowCount > 0;
  }

  // Fallback in-memory
  for (const [email, user] of inMemoryUsers.entries()) {
    if (user.id === id) {
      inMemoryUsers.delete(email);
      return true;
    }
  }
  return false;
}

export default {
  createUser,
  findUserByEmail,
  findUserById,
  findUserWithPasswordById,
  updateUserPassword,
  updateUserName,
  deleteUserById
};
