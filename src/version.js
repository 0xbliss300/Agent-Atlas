// TODO-063：以 package.json 的 version 作为应用版本号的单一来源。
// Vite/Vitest 在构建与测试时会把 JSON 内联进 bundle，等价于构建时注入，
// 避免在页脚或关于信息中写死版本字符串。
import pkg from "../package.json";

export const APP_VERSION = String(pkg.version ?? "0.0.0");
