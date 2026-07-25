import { ArrowRight } from "@phosphor-icons/react";

export function ResourceAction({
  Icon,
  label,
  detail,
  href,
  copyValue,
  copyKey,
  copyStatus,
  onCopy,
  compact = false,
}) {
  const className = compact ? "resource-compact" : "resource-row";
  const isCopied = copyStatus?.key === copyKey;
  const content = compact ? (
    <>
      <Icon size={19} />
      {isCopied ? copyStatus.message : label}
    </>
  ) : (
    <>
      <Icon size={20} />
      <span>
        <strong>{label}</strong>
        <small>{detail}</small>
      </span>
      {isCopied ? (
        <small className="resource-result">{copyStatus.message}</small>
      ) : (
        <ArrowRight size={18} />
      )}
    </>
  );

  if (href) {
    const external = /^https?:\/\//i.test(href);
    return (
      <a
        className={className}
        href={href}
        target={external ? "_blank" : undefined}
        rel={external ? "noreferrer" : undefined}
      >
        {content}
      </a>
    );
  }

  return (
    <button
      className={className}
      disabled={!copyValue}
      onClick={() => copyValue && onCopy(copyKey, copyValue)}
      title={copyValue ?? label + "暂未配置"}
    >
      {copyValue ? (
        content
      ) : (
        <>
          <Icon size={compact ? 19 : 20} />
          {compact ? (
            label + "暂未配置"
          ) : (
            <>
              <span>
                <strong>{label}</strong>
                <small>暂未配置</small>
              </span>
              <small className="resource-result">不可用</small>
            </>
          )}
        </>
      )}
    </button>
  );
}
