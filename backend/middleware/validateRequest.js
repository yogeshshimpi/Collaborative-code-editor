export function validateEmail(email) {
  if (typeof email !== 'string') return false;
  const clean = email.trim();
  return clean.length >= 3 && clean.includes('@') && clean.includes('.');
}

export function validatePassword(password) {
  return typeof password === 'string' && password.length >= 6;
}

export default {
  validateEmail,
  validatePassword
};
