import { BookOpenText, Database, PresentationChart, ShareNetwork } from "@phosphor-icons/react";

const projectIcons = Object.freeze({
  showcase: ShareNetwork,
  auralis: Database,
  translator: BookOpenText,
  presentation: PresentationChart,
});

export function getProjectIcon(project) {
  return projectIcons[project.iconKey] ?? ShareNetwork;
}
