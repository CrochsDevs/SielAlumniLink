import DOMPurify from "dompurify";

export function descriptionHtml(value = "", format) {
  if (format !== "html") {
    return String(value).split("\n").map((line) => `<p>${line.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;") || "<br>"}</p>`).join("");
  }
  return DOMPurify.sanitize(String(value), {
    ALLOWED_TAGS: ["p", "br", "h2", "h3", "strong", "b", "em", "i", "u", "s", "ul", "ol", "li", "blockquote", "a"],
    ALLOWED_ATTR: ["href", "title", "start"],
    ADD_URI_SAFE_ATTR: ["start"],
    ALLOW_DATA_ATTR: false,
    ALLOWED_URI_REGEXP: /^(?:https?:\/\/|mailto:)/i,
  });
}

export function descriptionText(value = "", format) {
  if (format !== "html") return String(value);
  const doc = new DOMParser().parseFromString(descriptionHtml(value, format), "text/html");
  doc.querySelectorAll("p,h2,h3,li,blockquote,br").forEach((node) => node.append("\n"));
  return doc.body.textContent || "";
}
