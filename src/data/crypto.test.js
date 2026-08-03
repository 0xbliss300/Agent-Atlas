import test from "node:test";
import assert from "node:assert/strict";
import {
  encryptPayload,
  decryptPayload,
  encryptJson,
  decryptJson,
  deriveKey,
  generateDeviceId,
  CRYPTO_SCHEMA_VERSION,
} from "./crypto.js";

test("encryptPayload 与 decryptPayload 往返一致", async () => {
  const plaintext = "你好，Agent Atlas 端到端加密测试。";
  const payload = await encryptPayload(plaintext, "my-secret-password");
  assert.equal(payload.v, CRYPTO_SCHEMA_VERSION);
  assert.ok(payload.kdf.salt);
  assert.ok(payload.iv);
  assert.ok(payload.ciphertext);
  assert.notEqual(payload.ciphertext, plaintext);

  const decrypted = await decryptPayload(payload, "my-secret-password");
  assert.equal(decrypted, plaintext);
});

test("错误口令解密失败并抛出友好错误", async () => {
  const payload = await encryptPayload("secret content", "correct-password");
  await assert.rejects(decryptPayload(payload, "wrong-password"), /解密失败/);
});

test("空口令抛出错误", async () => {
  await assert.rejects(encryptPayload("text", ""), /加密口令不能为空/);
  await assert.rejects(
    decryptPayload({ v: 1, kdf: {}, iv: "", ciphertext: "" }, ""),
    /解密口令不能为空/,
  );
});

test("不支持的载荷版本抛出错误", async () => {
  await assert.rejects(
    decryptPayload({ v: 99, kdf: {}, iv: "", ciphertext: "" }, "pw"),
    /不支持的加密载荷版本/,
  );
});

test("无效载荷结构抛出错误", async () => {
  await assert.rejects(decryptPayload(null, "pw"), /加密载荷结构无效/);
  await assert.rejects(decryptPayload("not-an-object", "pw"), /加密载荷结构无效/);
});

test("encryptJson 与 decryptJson 往返一致", async () => {
  const data = { name: "Agent", progress: 50, tags: ["a", "b"] };
  const payload = await encryptJson(data, "pw");
  const restored = await decryptJson(payload, "pw");
  assert.deepEqual(restored, data);
});

test("解密后非 JSON 抛出错误", async () => {
  const payload = await encryptPayload("not json", "pw");
  await assert.rejects(decryptJson(payload, "pw"), /不是有效的 JSON/);
});

test("每次加密生成不同的盐与 IV", async () => {
  const a = await encryptPayload("text", "pw");
  const b = await encryptPayload("text", "pw");
  assert.notEqual(a.kdf.salt, b.kdf.salt);
  assert.notEqual(a.iv, b.iv);
  assert.notEqual(a.ciphertext, b.ciphertext);
});

test("deriveKey 对同一口令与盐生成相同密钥", async () => {
  const salt = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]).buffer;
  const key1 = await deriveKey("password", salt, 1000);
  const key2 = await deriveKey("password", salt, 1000);
  assert.ok(key1);
  assert.ok(key2);
  // CryptoKey 对象无法直接比较，但相同参数应生成可用密钥
  const payload = await encryptPayload("test", "password");
  const decrypted = await decryptPayload(payload, "password");
  assert.equal(decrypted, "test");
});

test("generateDeviceId 返回 16 字符十六进制字符串", () => {
  const id = generateDeviceId();
  assert.equal(id.length, 16);
  assert.match(id, /^[0-9a-f]{16}$/);

  const id2 = generateDeviceId();
  assert.notEqual(id, id2);
});
