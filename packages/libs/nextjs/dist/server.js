// ../../contracts/dist/consent-data-governance.js
var CONSENT_MAX_AGE_DAYS = 390;
var CONSENT_MAX_AGE_MS = CONSENT_MAX_AGE_DAYS * 24 * 60 * 60 * 1e3;
function isConsentExpiryFresh(expiresAt, now = Date.now()) {
  if (!Number.isSafeInteger(expiresAt) || expiresAt <= 0)
    return false;
  if (!Number.isSafeInteger(now) || now < 0)
    return false;
  const latestPermittedExpiry = now + CONSENT_MAX_AGE_MS;
  if (!Number.isSafeInteger(latestPermittedExpiry))
    return false;
  return expiresAt >= now && expiresAt <= latestPermittedExpiry;
}

// ../../contracts/dist/consent-fastpath.js
var CONSENT_COOKIE_NAME = "1consent";
var CONSENT_COOKIE_VERSION = 2;
function isConsentDecision(x) {
  return x === "A" || x === "D" || x === "G";
}
var COOKIE_TOKEN_PATTERN = /^[A-Za-z0-9_-]+$/;
var STRUCTURAL_VERSION_PATTERN = /^[a-z0-9]+$/;
function isCookieIdentityToken(value) {
  return value.length > 0 && COOKIE_TOKEN_PATTERN.test(value);
}
function isStructuralVersionToken(value) {
  return value.length > 0 && STRUCTURAL_VERSION_PATTERN.test(value);
}
function isFrameworkType(value) {
  return value === "gdpr" || value === "tcf" || value === "us";
}
function isMachine(value) {
  return value === "P" || value === "S" || value === "D";
}
function isCanonicalConsentCookieValue(value) {
  return isConsentDecision(value.decision) && typeof value.appId === "string" && isCookieIdentityToken(value.appId) && typeof value.frameworkId === "string" && isCookieIdentityToken(value.frameworkId) && isFrameworkType(value.frameworkType) && isMachine(value.machine) && typeof value.primaryLanguage === "string" && isCookieIdentityToken(value.primaryLanguage) && typeof value.structuralVersion === "string" && isStructuralVersionToken(value.structuralVersion) && typeof value.consentEpoch === "number" && Number.isSafeInteger(value.consentEpoch) && value.consentEpoch >= 0 && typeof value.expiresAt === "number" && Number.isSafeInteger(value.expiresAt) && value.expiresAt > 0;
}
function parseCanonicalUnsignedInteger(value) {
  if (!/^(0|[1-9]\d*)$/.test(value))
    return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && String(parsed) === value ? parsed : null;
}
function parseConsentCookieValue(value) {
  if (!value)
    return null;
  const parts = value.split(".");
  if (parts.length !== 10 || parts[0] !== String(CONSENT_COOKIE_VERSION))
    return null;
  const decision = parts[1];
  const appId = parts[2];
  const frameworkId = parts[3];
  const frameworkType = parts[4];
  const machine = parts[5];
  const primaryLanguage = parts[6];
  const structuralVersion = parts[7];
  const rawEpoch = parts[8];
  const rawExpiry = parts[9];
  if (!rawEpoch || !rawExpiry)
    return null;
  const consentEpoch = parseCanonicalUnsignedInteger(rawEpoch);
  const expiresAt = parseCanonicalUnsignedInteger(rawExpiry);
  const parsed = {
    decision,
    appId,
    frameworkId,
    frameworkType,
    machine,
    primaryLanguage,
    structuralVersion,
    consentEpoch,
    expiresAt
  };
  return isCanonicalConsentCookieValue(parsed) ? parsed : null;
}
function isConsentCookieFreshFor(value, expected, now = Date.now()) {
  return value.appId === expected.appId && value.frameworkId === expected.frameworkId && value.frameworkType === expected.frameworkType && value.machine === expected.machine && value.primaryLanguage === expected.primaryLanguage && value.structuralVersion === expected.structuralVersion && value.consentEpoch === expected.consentEpoch && isConsentExpiryFresh(value.expiresAt, now);
}

// src/cookie.ts
var COOKIE_NAME = CONSENT_COOKIE_NAME;
function parseConsentCookie(value, expected, now = Date.now()) {
  return readConsentCookie(value, expected, now)?.decision ?? "none";
}
function readConsentCookie(value, expected, now = Date.now()) {
  const parsed = parseConsentCookieValue(value);
  return parsed && isConsentCookieFreshFor(parsed, expected, now) ? parsed : null;
}
export {
  COOKIE_NAME,
  parseConsentCookie,
  readConsentCookie
};
