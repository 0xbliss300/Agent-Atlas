import ReactMarkdown, { defaultUrlTransform } from "react-markdown";
import remarkGfm from "remark-gfm";
import { rehypeGuideHeadingAnchors } from "../data/guide.js";

function safeUrlTransform(value) {
  const trimmed = String(value).trim();
  if (!trimmed) return "";
  if (/^(?:javascript|vbscript|data):/i.test(trimmed)) return "";
  return defaultUrlTransform(trimmed);
}

export function MarkdownRenderer({ children, headingAnchors = false }) {
  return (
    <div className="markdown-body">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={headingAnchors ? [rehypeGuideHeadingAnchors] : []}
        skipHtml
        urlTransform={safeUrlTransform}
        components={{
          a({ href, children: linkChildren }) {
            if (!href) return <span>{linkChildren}</span>;
            const external = /^https?:\/\//i.test(href ?? "");
            return (
              <a
                href={href}
                target={external ? "_blank" : undefined}
                rel={external ? "noopener noreferrer" : undefined}
              >
                {linkChildren}
              </a>
            );
          },
          img() {
            return <span className="markdown-image-disabled">[远程图片已禁用]</span>;
          },
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
