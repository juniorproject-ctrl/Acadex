const allowedUniversityDomainPattern = /@(?:(?:[a-z0-9-]+\.)*ac\.ae|aus\.edu)$/i;

export function isAllowedUniversityEmail(email: string) {
  return allowedUniversityDomainPattern.test(email.trim());
}

export function getAllowedUniversityEmailMessage() {
  return 'Please use a UAE university email from a .ac.ae campus domain or aus.edu.';
}

export function isStrongPassword(password: string) {
  return /^(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/.test(password);
}

export function getPasswordMessage() {
  return 'Password must be at least 8 characters and include a number and special character.';
}
