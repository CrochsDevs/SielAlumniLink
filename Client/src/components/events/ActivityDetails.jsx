import { Building2, CalendarDays, Clock, MapPin, Video, Pencil, ClipboardCheck } from "lucide-react";
import { FeedDialog } from "../feed/FeedComposer";
import ActivityAccess from "../student/ActivityAccess";
import EventDescription from "./EventDescription";
import { Link } from "react-router-dom";
import { useAuth } from "../../context/useAuth";
import { activityLabel, activityStyle, calendarDate, dateLabel, eventDateTime } from "../../utils/eventCalendar";
import "./ActivityDetails.css";

export default function ActivityDetails({ event, onClose, onRegistered }) {
  const { user } = useAuth();
  const date = calendarDate(event.startAt);
  const online = event.deliveryMode === "online";
  return (
    <FeedDialog title="Activity details" onClose={onClose} className="alumni-activity-dialog" header={
      <div className="activity-dialog-heading">
        <span className="activity-dialog-icon"><CalendarDays size={19} /></span>
        <div><p>University calendar</p><h3>Activity details</h3></div>
      </div>
    }>
      <div className="activity-details-body">
        <div className="activity-details-hero">
          <div className="activity-details-date" aria-hidden="true">
            <span>{dateLabel(date, { month: "short" })}</span>
            <strong>{date.getUTCDate()}</strong>
            <small>{dateLabel(date, { weekday: "short" })}</small>
          </div>
          <div className="activity-details-summary">
            <div className="activity-details-badges">
              <span data-activity-type={event.activityType || "event"} className={`activity-details-type ${activityStyle(event).card}`}>{activityLabel(event)}</span>
              <span className="activity-details-mode">{online ? <Video size={12} /> : <MapPin size={12} />}{online ? "Online" : "On-site"}</span>
            </div>
            <h3>{event.title}</h3>
            {event.organizer && <p className="activity-details-organizer"><Building2 size={13} /><span>{event.organizer}</span></p>}
          </div>
        </div>

        <dl className="activity-details-facts">
          <div className="activity-details-fact">
            <dt><Clock size={15} />Schedule</dt>
            <dd>{eventDateTime(event.startAt)}{event.endAt && <span className="activity-details-end">to {eventDateTime(event.endAt)}</span>}<span className="activity-details-timezone">Philippine time · GMT+8</span></dd>
          </div>
          <div className="activity-details-fact">
            <dt>{online ? <Video size={15} /> : <MapPin size={15} />}{online ? "Meeting access" : "Venue"}</dt>
            <dd>{online ? "Join through the app when meeting access opens." : event.location || "Register to view venue details."}</dd>
          </div>
        </dl>

        {event.description && <section className="activity-details-about">
          <h4>About this activity</h4>
          <EventDescription event={event} />
        </section>}
      </div>
      <div className="activity-details-access">
        <h4>{user?.role === "admin" ? "Manage activity" : "Registration & access"}</h4>
        {user?.role === "admin" ? <div className="flex flex-wrap gap-3">
          <Link to={`/admin/events?edit=${encodeURIComponent(event._id)}`} className="events-button activity-admin-action activity-admin-edit"><Pencil size={15} />Edit activity</Link>
          <Link to={`/admin/events/${event._id}/attendance`} className="events-button activity-admin-action activity-admin-attendance"><ClipboardCheck size={15} />Manage attendance</Link>
          {online && <Link to={`/meetings/${event._id}`} className="events-button activity-admin-action activity-admin-meeting"><Video size={15} />Open meeting</Link>}
        </div> : <ActivityAccess event={event} onRegistered={onRegistered} />}
      </div>
    </FeedDialog>
  );
}
