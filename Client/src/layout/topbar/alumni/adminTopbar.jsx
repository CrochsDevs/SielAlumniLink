import MemberTopbar from "../MemberTopbar";

export default function AdminTopbar(props) {
  return <MemberTopbar memberRole="admin" profilePath="/admin/settings" settingsPath="/admin/settings" {...props} />;
}
