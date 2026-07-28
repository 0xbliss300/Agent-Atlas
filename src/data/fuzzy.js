function normalize(value) {
  return String(value ?? "")
    .trim()
    .toLocaleLowerCase("zh-CN");
}

export function fuzzyMatch(query, target) {
  const normalizedQuery = normalize(query);
  const normalizedTarget = normalize(target);
  if (!normalizedQuery) return { matched: true, score: 0 };
  if (!normalizedTarget) return { matched: false, score: 0 };

  const substringIndex = normalizedTarget.indexOf(normalizedQuery);
  if (substringIndex !== -1) {
    return { matched: true, score: 1000 - substringIndex };
  }

  let queryIndex = 0;
  let score = 0;
  let consecutive = 0;
  let lastMatchTargetIndex = -1;
  const matchedIndices = [];
  for (let targetIndex = 0; targetIndex < normalizedTarget.length; targetIndex += 1) {
    if (normalizedTarget[targetIndex] === normalizedQuery[queryIndex]) {
      matchedIndices.push(targetIndex);
      score += 10;
      if (targetIndex === lastMatchTargetIndex + 1) {
        consecutive += 1;
        score += 5 * consecutive;
      } else {
        consecutive = 0;
      }
      if (targetIndex === 0) score += 20;
      lastMatchTargetIndex = targetIndex;
      queryIndex += 1;
      if (queryIndex >= normalizedQuery.length) break;
    }
  }

  if (queryIndex < normalizedQuery.length) {
    return { matched: false, score: 0 };
  }

  score += Math.max(0, normalizedTarget.length - (matchedIndices[0] ?? 0));
  return { matched: true, score };
}

export function fuzzyFilter(items = [], query = "", getText = (item) => String(item)) {
  const normalizedQuery = normalize(query);
  if (!normalizedQuery) return [...items];
  return items
    .map((item, index) => {
      const { matched, score } = fuzzyMatch(normalizedQuery, getText(item));
      return { item, matched, score, index };
    })
    .filter((entry) => entry.matched)
    .sort((left, right) => right.score - left.score || left.index - right.index)
    .map((entry) => entry.item);
}
