import { descriptionHtml } from "./description";
import "./OpportunityEditor.css";

export default function JobDescription({ value, format, className = "" }) {
  return <div className={`opportunity-prose ${className}`} dangerouslySetInnerHTML={{ __html: descriptionHtml(value, format) }} />;
}
