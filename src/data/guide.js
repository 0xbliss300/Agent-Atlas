function cleanHeadingText(value) {
  return String(value ?? "")
    .replace(/[*_~`[\]]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function slugifyGuideHeading(value) {
  const slug = cleanHeadingText(value)
    .normalize("NFKC")
    .toLocaleLowerCase("zh-CN")
    .replace(/[^\p{Letter}\p{Number}]+/gu, "-")
    .replace(/^-+|-+$/g, "");
  return `guide-${slug || "section"}`;
}

export function createGuideHeadingIdAllocator() {
  const counts = new Map();
  return (value) => {
    const base = slugifyGuideHeading(value);
    const count = (counts.get(base) ?? 0) + 1;
    counts.set(base, count);
    return count === 1 ? base : `${base}-${count}`;
  };
}

export function getGuideSections(markdown) {
  if (typeof markdown !== "string") return [];
  const nextId = createGuideHeadingIdAllocator();
  const sections = [];

  for (const line of markdown.split(/\r?\n/)) {
    const match = line.match(/^(#{1,4})\s+(.+?)\s*#*\s*$/);
    if (!match) continue;
    const title = cleanHeadingText(match[2]);
    const id = nextId(title);
    if (match[1].length === 2) sections.push({ id, title });
  }

  return sections;
}

function getHastText(node) {
  if (node?.type === "text") return node.value ?? "";
  return Array.isArray(node?.children) ? node.children.map(getHastText).join("") : "";
}

export function rehypeGuideHeadingAnchors() {
  return (tree) => {
    const nextId = createGuideHeadingIdAllocator();

    const visit = (node) => {
      if (node?.type === "element" && /^h[1-4]$/.test(node.tagName)) {
        node.properties = {
          ...node.properties,
          id: nextId(getHastText(node)),
          tabIndex: -1,
        };
      }
      node?.children?.forEach(visit);
    };

    visit(tree);
  };
}

export async function loadUserGuideMarkdown() {
  const module = await import("../content/USER_GUIDE.md?raw");
  if (typeof module.default !== "string" || !module.default.trim()) {
    throw new Error("使用指南内容为空。");
  }
  return module.default;
}
