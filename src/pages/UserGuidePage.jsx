import { Component, useEffect, useMemo, useState } from "react";
import { ArrowLeft, BookOpenText } from "@phosphor-icons/react";
import { MarkdownRenderer } from "../components/MarkdownRenderer.jsx";
import { getGuideSections, loadUserGuideMarkdown } from "../data/guide.js";

function GuideErrorState({ navigate }) {
  return (
    <section className="guide-state guide-error" role="alert">
      <p className="eyebrow">GUIDE UNAVAILABLE</p>
      <h1>使用指南暂时无法载入</h1>
      <p>本地 Markdown 文件读取或渲染失败。项目数据未受影响，请返回概览后重试。</p>
      <button className="secondary-button" type="button" onClick={() => navigate("/")}>
        <ArrowLeft size={18} />
        返回项目概览
      </button>
    </section>
  );
}

class GuideRenderBoundary extends Component {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    if (this.state.failed) return <GuideErrorState navigate={this.props.navigate} />;
    return this.props.children;
  }
}

export function UserGuidePage({ navigate, loadMarkdown = loadUserGuideMarkdown }) {
  const [state, setState] = useState({ status: "loading", markdown: "" });
  const [announcement, setAnnouncement] = useState("");

  useEffect(() => {
    let active = true;
    setState({ status: "loading", markdown: "" });

    Promise.resolve()
      .then(() => loadMarkdown())
      .then((markdown) => {
        if (!active) return;
        if (typeof markdown !== "string" || !markdown.trim()) {
          throw new Error("使用指南内容为空。");
        }
        setState({ status: "ready", markdown });
      })
      .catch(() => {
        if (active) setState({ status: "error", markdown: "" });
      });

    return () => {
      active = false;
    };
  }, [loadMarkdown]);

  const sections = useMemo(() => getGuideSections(state.markdown), [state.markdown]);

  const jumpToSection = (section) => {
    const heading = document.getElementById(section.id);
    if (!heading) return;
    heading.scrollIntoView?.({ behavior: "smooth", block: "start" });
    heading.focus({ preventScroll: true });
    setAnnouncement(`已跳转到“${section.title}”。`);
  };

  if (state.status === "loading") {
    return (
      <main className="guide-page">
        <section className="guide-state" role="status" aria-live="polite">
          <BookOpenText size={34} />
          <p className="eyebrow">LOADING GUIDE</p>
          <h1>正在载入本地使用指南…</h1>
        </section>
      </main>
    );
  }

  if (state.status === "error") {
    return (
      <main className="guide-page">
        <GuideErrorState navigate={navigate} />
      </main>
    );
  }

  return (
    <main className="guide-page">
      <header className="guide-hero" aria-labelledby="guide-title">
        <div>
          <button className="back-link" type="button" onClick={() => navigate("/")}>
            <ArrowLeft size={18} />
            返回项目概览
          </button>
          <p className="eyebrow">LOCAL PRODUCT GUIDE · MARKDOWN</p>
          <h1 id="guide-title">项目使用指南</h1>
          <p>从录入项目到研究记录、执行跟踪与本地备份，按当前真实功能逐步说明。</p>
        </div>
        <BookOpenText size={68} weight="thin" aria-hidden="true" />
      </header>

      <div className="guide-layout">
        <aside className="guide-toc" aria-labelledby="guide-toc-title">
          <p className="eyebrow">ON THIS PAGE</p>
          <h2 id="guide-toc-title">指南目录</h2>
          <nav aria-label="使用指南章节">
            {sections.map((section, index) => (
              <button key={section.id} type="button" onClick={() => jumpToSection(section)}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                {section.title}
              </button>
            ))}
          </nav>
        </aside>

        <article className="guide-document" aria-label="项目使用指南正文">
          <GuideRenderBoundary navigate={navigate}>
            <MarkdownRenderer headingAnchors>{state.markdown}</MarkdownRenderer>
          </GuideRenderBoundary>
        </article>
      </div>

      <p className="sr-only" aria-live="polite">
        {announcement}
      </p>
    </main>
  );
}
