import { descriptionHtml } from "../career/description";
import "../career/OpportunityEditor.css";

export default function EventDescription({ event, className = "" }) {
  return <div className={`opportunity-prose ${className}`} dangerouslySetInnerHTML={{ __html: descriptionHtml(event.description, event.descriptionFormat) }} />;
}
