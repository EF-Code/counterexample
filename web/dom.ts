export function element<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className = "",
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

export function button(
  label: string,
  onClick: () => void,
  variant = "secondary",
): HTMLButtonElement {
  const node = element("button", `button ${variant}`, label);
  node.type = "button";
  node.addEventListener("click", onClick);
  return node;
}

export function badge(label: string, variant = ""): HTMLSpanElement {
  return element("span", `badge ${variant}`, label);
}

export class MissingElementError extends Error {
  constructor(id: string) {
    super(`Missing interface element: ${id}`);
    this.name = "MissingElementError";
  }
}

export function requiredElement<K extends keyof HTMLElementTagNameMap>(
  id: string,
  tag: K,
): HTMLElementTagNameMap[K] {
  const node = Array.from(document.querySelectorAll(tag)).find((candidate) => candidate.id === id);
  if (node === undefined) throw new MissingElementError(id);
  return node;
}
