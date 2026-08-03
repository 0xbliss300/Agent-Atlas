/**
 * 端到端加密工具：使用 Web Crypto API 的 AES-GCM 与 PBKDF2。
 *
 * 密钥由用户口令派生，从不保存到 data/ 或业务数据。
 * 载荷结构（base64 文本，便于在 WebDAV 上以文本文件存储）：
 * {
 *   v: 1,                       // schemaVersion
 *   kdf: { iterations, salt },  // PBKDF2 参数（盐每次生成，存入载荷头）
 *   iv,                         // AES-GCM 初始向量（每次加密随机）
 *   ciphertext                  // 加密后的 base64 内容
 * }
 */

const SCHEMA_VERSION = 1;
const PBKDF2_ITERATIONS = 210000;
const SALT_BYTES = 16;
const IV_BYTES = 12;
const KEY_BITS = 256;

const subtle = globalThis.crypto?.subtle;

function ensureSubtle() {
  if (!subtle) {
    throw new Error("当前环境不支持 Web Crypto API，无法执行端到端加密。");
  }
}

function toBase64(bytes) {
  let binary = "";
  for (const byte of new Uint8Array(bytes)) {
    binary += String.fromCharCode(byte);
  }
  return globalThis.btoa(binary);
}

function fromBase64(text) {
  const binary = globalThis.atob(text);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

function getRandomBytes(length) {
  const bytes = new Uint8Array(length);
  globalThis.crypto.getRandomValues(bytes);
  return bytes.buffer;
}

function encodeText(text) {
  return new TextEncoder().encode(text);
}

function decodeText(bytes) {
  return new TextDecoder().decode(new Uint8Array(bytes));
}

export async function deriveKey(password, saltBuffer, iterations = PBKDF2_ITERATIONS) {
  ensureSubtle();
  const passwordKey = await subtle.importKey(
    "raw",
    encodeText(password),
    { name: "PBKDF2" },
    false,
    ["deriveKey"],
  );
  return subtle.deriveKey(
    { name: "PBKDF2", salt: saltBuffer, iterations, hash: "SHA-256" },
    passwordKey,
    { name: "AES-GCM", length: KEY_BITS },
    false,
    ["encrypt", "decrypt"],
  );
}

export async function encryptPayload(plaintext, password) {
  ensureSubtle();
  if (!password) throw new Error("加密口令不能为空。");
  const saltBuffer = getRandomBytes(SALT_BYTES);
  const ivBuffer = getRandomBytes(IV_BYTES);
  const key = await deriveKey(password, saltBuffer);
  const plaintextBuffer = encodeText(plaintext);
  const ciphertextBuffer = await subtle.encrypt(
    { name: "AES-GCM", iv: ivBuffer },
    key,
    plaintextBuffer,
  );
  return {
    v: SCHEMA_VERSION,
    kdf: {
      iterations: PBKDF2_ITERATIONS,
      salt: toBase64(saltBuffer),
    },
    iv: toBase64(ivBuffer),
    ciphertext: toBase64(ciphertextBuffer),
  };
}

export async function decryptPayload(payload, password) {
  ensureSubtle();
  if (!payload || typeof payload !== "object") {
    throw new Error("加密载荷结构无效。");
  }
  if (payload.v !== SCHEMA_VERSION) {
    throw new Error(`不支持的加密载荷版本：${payload.v}。`);
  }
  if (!password) throw new Error("解密口令不能为空。");
  try {
    const saltBuffer = fromBase64(payload.kdf?.salt ?? "");
    const ivBuffer = fromBase64(payload.iv ?? "");
    const ciphertextBuffer = fromBase64(payload.ciphertext ?? "");
    const key = await deriveKey(password, saltBuffer, payload.kdf?.iterations ?? PBKDF2_ITERATIONS);
    const plaintextBuffer = await subtle.decrypt(
      { name: "AES-GCM", iv: ivBuffer },
      key,
      ciphertextBuffer,
    );
    return decodeText(plaintextBuffer);
  } catch {
    throw new Error("解密失败：口令错误或载荷已损坏。");
  }
}

export async function encryptJson(jsonObject, password) {
  return encryptPayload(JSON.stringify(jsonObject), password);
}

export async function decryptJson(payload, password) {
  const text = await decryptPayload(payload, password);
  try {
    return JSON.parse(text);
  } catch {
    throw new Error("解密后的内容不是有效的 JSON。");
  }
}

export function generateDeviceId() {
  const bytes = new Uint8Array(8);
  globalThis.crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export const CRYPTO_SCHEMA_VERSION = SCHEMA_VERSION;
export const CRYPTO_PBKDF2_ITERATIONS = PBKDF2_ITERATIONS;
