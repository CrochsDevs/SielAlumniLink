import MemberTopbar from "../MemberTopbar";
import "./adminTopbar.css";
import "../../../components/admin/AdminUI.css";

export default function AdminTopbar(props) {
  return <MemberTopbar memberRole="admin" profilePath="/admin/settings" settingsPath="/admin/settings" {...props} />;
}
