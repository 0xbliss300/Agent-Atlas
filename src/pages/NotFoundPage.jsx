import { ArrowLeft } from "@phosphor-icons/react";

export function NotFoundPage({ projectMissing, noteMissing, navigate }) {
  const title = projectMissing ? "项目不存在" : noteMissing ? "研究笔记不存在" : "页面不存在";
  const detail = projectMissing
    ? "这个项目可能已被删除、尚未导入，或链接中的项目 ID 不正确。"
    : noteMissing
      ? "这篇研究笔记可能已被删除、尚未导入，或链接中的笔记 ID 不正确。"
      : "当前本地地址无法识别，请返回项目概览。";

  return (
    <main className="not-found-page">
      <section className="empty-state" aria-labelledby="not-found-title">
        <p className="eyebrow">404 · LOCAL ROUTE</p>
        <h1 id="not-found-title">{title}</h1>
        <p>{detail}</p>
        <button className="primary-button" onClick={() => navigate(noteMissing ? "/notes" : "/")}>
          <ArrowLeft size={18} />
          {noteMissing ? "返回研究笔记" : "返回项目概览"}
        </button>
      </section>
    </main>
  );
}
