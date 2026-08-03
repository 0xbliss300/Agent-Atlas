import { useState } from "react";
import {
  ArrowsClockwise,
  CloudArrowUp,
  CloudArrowDown,
  Lock,
  ShieldWarning,
} from "@phosphor-icons/react";

export function E2eSyncSettings({
  enabled,
  syncConfig,
  lastSyncedAt = "",
  busy = false,
  error = "",
  onToggleEnabled,
  onSaveConfig,
  onPush,
  onPull,
}) {
  const [baseUrl, setBaseUrl] = useState(syncConfig.baseUrl ?? "");
  const [basePath, setBasePath] = useState(syncConfig.basePath ?? "/agent-atlas/");
  const [username, setUsername] = useState(syncConfig.username ?? "");
  const [filePath, setFilePath] = useState(syncConfig.filePath ?? "/sync.enc.json");
  const [password, setPassword] = useState("");
  const [configSaved, setConfigSaved] = useState(false);

  const handleSaveConfig = () => {
    onSaveConfig({ baseUrl, basePath, username, filePath });
    setConfigSaved(true);
  };

  const handlePush = () => {
    onPush(password);
  };

  const handlePull = () => {
    onPull(password);
  };

  return (
    <section className="display-settings" aria-labelledby="e2e-sync-title">
      <h3 id="e2e-sync-title">端到端加密同步（可选）</h3>
      <p>
        将本地数据以端到端加密方式同步到你自选的 WebDAV
        服务器。密钥由你持有，应用不接触明文同步内容。
      </p>
      <div className="local-safety">
        <ShieldWarning size={23} weight="duotone" />
        <p>
          口令不保存到本地数据；忘记口令将无法解密远端载荷。同步默认关闭，关闭后应用完全保持本地行为。
        </p>
      </div>
      <label className="toggle-setting">
        <span>启用端到端同步</span>
        <input
          type="checkbox"
          checked={enabled}
          onChange={(event) => onToggleEnabled(event.target.checked)}
        />
      </label>
      {enabled && (
        <>
          <div className="form-field">
            <span>WebDAV 服务器地址</span>
            <input
              type="url"
              value={baseUrl}
              onChange={(event) => {
                setBaseUrl(event.target.value);
                setConfigSaved(false);
              }}
              placeholder="https://dav.example.com"
            />
          </div>
          <div className="form-field">
            <span>基础路径</span>
            <input
              type="text"
              value={basePath}
              onChange={(event) => {
                setBasePath(event.target.value);
                setConfigSaved(false);
              }}
              placeholder="/agent-atlas/"
            />
          </div>
          <div className="form-field">
            <span>用户名（可选）</span>
            <input
              type="text"
              value={username}
              onChange={(event) => {
                setUsername(event.target.value);
                setConfigSaved(false);
              }}
              placeholder="WebDAV 用户名"
            />
          </div>
          <div className="form-field">
            <span>同步文件路径</span>
            <input
              type="text"
              value={filePath}
              onChange={(event) => {
                setFilePath(event.target.value);
                setConfigSaved(false);
              }}
              placeholder="/sync.enc.json"
            />
          </div>
          <button
            type="button"
            className="secondary-button"
            onClick={handleSaveConfig}
            disabled={busy}
          >
            <Lock size={18} />
            保存同步配置
          </button>
          {configSaved && (
            <p className="inline-empty" style={{ color: "var(--green)" }}>
              配置已保存（不含口令）。
            </p>
          )}
          <div className="form-field">
            <span>加密口令（本次同步使用）</span>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="输入口令以加密/解密"
              autoComplete="off"
            />
          </div>
          <div className="form-actions">
            <button
              type="button"
              className="secondary-button"
              onClick={handlePush}
              disabled={busy || !password}
            >
              <CloudArrowUp size={18} />
              推送到远端
            </button>
            <button
              type="button"
              className="secondary-button"
              onClick={handlePull}
              disabled={busy || !password}
            >
              <CloudArrowDown size={18} />
              从远端拉取
            </button>
          </div>
          {busy && (
            <p className="sync-loading" role="status">
              <ArrowsClockwise size={18} />
              正在同步…
            </p>
          )}
          {error && (
            <p className="form-submit-error" role="alert">
              {error}
            </p>
          )}
          {lastSyncedAt && <p className="previous-sync">上次同步：{lastSyncedAt}</p>}
        </>
      )}
    </section>
  );
}
