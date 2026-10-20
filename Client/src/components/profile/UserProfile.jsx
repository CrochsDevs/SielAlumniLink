import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import Swal from "sweetalert2";
import { gooeyToast as toast } from 'goey-toast';
import {
  BadgeCheck,
  MapPin,
  Mail,
  Briefcase,
  GraduationCap,
  Plus,
  Check,
  Clock,
  Pencil,
  Sparkles,
  Award,
  Users,
  ArrowLeft,
  Share2,
  Trash2,
  X,
  Camera,
} from "lucide-react";
import { useAuth } from "../../context/useAuth";
import { useChat } from "../../context/useChat.js";
import AlumniSidebar from "../../layout/sidebar/alumni/alumniSidebar";
import AlumniTopbar from "../../layout/topbar/alumni/alumniTopbar";
import StudentSidebar from "../../layout/sidebar/student/studentSidebar";
import StudentTopbar from "../../layout/topbar/student/studentTopbar";
import api from "../../utils/axios";
import { getSocket } from "../../realtime/socket";
import {
  IMAGE_ACCEPT,
  validateProfileImage,
  uploadProfileImage,
} from "../../utils/profileUpload";
import SkillInput from "../../components/profile/SkillInput";
import { normalizeSkill } from "../../components/profile/skillSuggestions";

const UserProfile = ({ profileRole = "alumni" }) => {
  const { user, refreshUser } = useAuth();
  const { openChatByEmail } = useChat();
  const { id } = useParams();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [connectState, setConnectState] = useState("none");
  const [connectLoading, setConnectLoading] = useState(false);
  const [profile, setProfile] = useState(null);
  const [loadingOther, setLoadingOther] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [editing, setEditing] = useState(false);
  const [profilePicture, setProfilePicture] = useState(null);
  const [bannerImage, setBannerImage] = useState(null);
  const savedImages = useRef({ profilePicture: null, bannerImage: null });
  const savedFields = useRef({});
  const pendingImages = useRef({ avatar: null, banner: null });
  const savePending = useRef(false);
  const clearPendingImages = () => {
    Object.values(pendingImages.current).forEach((image) => {
      if (image?.preview) URL.revokeObjectURL(image.preview);
    });
    pendingImages.current = { avatar: null, banner: null };
  };
  useEffect(
    () => () => {
      Object.values(pendingImages.current).forEach((image) => {
        if (image?.preview) URL.revokeObjectURL(image.preview);
      });
    },
    [],
  );
  const avatarInputRef = useRef(null);
  const bannerInputRef = useRef(null);
  const [saving, setSaving] = useState(false);
  const deletionPending = useRef(false);
  const [showAddExp, setShowAddExp] = useState(false);
  const [showAddEdu, setShowAddEdu] = useState(false);
  const [editingExp, setEditingExp] = useState(null);
  const [editingEdu, setEditingEdu] = useState(null);
  const [editExpForm, setEditExpForm] = useState({
    position: "",
    company: "",
    location: "",
    startDate: "",
    endDate: "",
    current: false,
  });
  const [editEduForm, setEditEduForm] = useState({
    school: "",
    degree: "",
    year: "",
    location: "",
  });
  const [newSkill, setNewSkill] = useState("");
  const [addingSkill, setAddingSkill] = useState(false);
  const skillPending = useRef(false);
  const [connectionsCount, setConnectionsCount] = useState(0);
  const [form, setForm] = useState({
    name: "",
    program: "",
    batch: "",
    location: "",
    bio: "",
    skills: [],
  });
  const [expForm, setExpForm] = useState({
    position: "",
    company: "",
    location: "",
    startDate: "",
    endDate: "",
    current: false,
  });
  const [eduForm, setEduForm] = useState({
    school: "",
    degree: "",
    year: "",
    location: "",
  });

  const isOwn = !id || String(id) === String(user?._id);
  const profileEmail = profile?.email;

  const fetchConnectionState = useCallback(async () => {
    if (isOwn || !profileEmail) return;
    try {
      const res = await api.get("/connections/me");
      setConnectionsCount(
        (res.data.data || []).filter((c) => c.status === "accepted").length,
      );
      const found = (res.data.data || []).find(
        (c) =>
          c.requesterEmail === profileEmail ||
          c.recipientEmail === profileEmail,
      );
      if (found)
        setConnectState(found.status === "accepted" ? "connected" : "pending");
      else setConnectState("none");
    } catch {
      // ignore
    }
  }, [isOwn, profileEmail]);

  useEffect(() => {
    if (isOwn || !id) return;
    let cancelled = false;
    // Reset the loading state when navigating to another person's profile.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoadingOther(true);
    setNotFound(false);
    api
      .get(`/users/${id}`)
      .then((res) => {
        if (cancelled) return;
        setProfile(res.data.data);
        api.post(`/users/${id}/view`).catch(() => {});
      })
      .catch(() => {
        if (!cancelled) setNotFound(true);
      })
      .finally(() => {
        if (!cancelled) setLoadingOther(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id, isOwn]);

  useEffect(() => {
    if (isOwn) return;
    // This fetch sets state only after its API response arrives.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchConnectionState();

    const socket = getSocket();
    const onNotification = () => {
      fetchConnectionState();
    };
    socket.on("notification:new", onNotification);

    return () => {
      socket.off("notification:new", onNotification);
    };
  }, [isOwn, fetchConnectionState]);

  useEffect(() => {
    if (!isOwn) return;
    let cancelled = false;
    api
      .get("/connections/me")
      .then((res) => {
        if (!cancelled)
          setConnectionsCount(
            (res.data.data || []).filter(
              (connection) => connection.status === "accepted",
            ).length,
          );
      })
      .catch(() => {});
    api
      .get(`/users/${user?._id || user?.authId}`)
      .then((res) => {
        if (cancelled) return;
        const p = res.data.data || {};
        savedFields.current = {
          name: p.name || user?.name || "",
          program: p.program || "",
          batch: p.batch || "",
          location: p.location || "",
          bio: p.bio || "",
        };
        setForm({
          name: p.name || user?.name || "",
          program: p.program || "",
          batch: p.batch || "",
          location: p.location || "",
          bio: p.bio || "",
          skills: p.skills || [],
          employmentHistory: p.employmentHistory || [],
          education: p.education || [],
        });
        savedImages.current = {
          profilePicture: p.profilePicture || null,
          bannerImage: p.bannerImage || null,
        };
        setProfilePicture(p.profilePicture || null);
        setBannerImage(p.bannerImage || null);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [isOwn, user?._id, user?.authId, user?.name]);

  const handleConnect = async () => {
    if (connectState !== "none" || !profile?.email) return;
    setConnectLoading(true);
    try {
      await api.post("/connections", { email: profile.email });
      setConnectState("pending");
      toast.success("Request sent", { description: "They will be notified." });
    } catch (err) {
      toast.error("Error", { description: err.response?.data?.message || "Failed to send request" });
    } finally {
      setConnectLoading(false);
    }
  };

  const saveProfile = async () => {
    if (savePending.current || skillPending.current || saving) return;
    if (!form.name.trim()) {
      toast.warning("Missing name", { description: "Please enter your full name before saving." });
      return;
    }
    savePending.current = true;
    setSaving(true);
    try {
      const payload = {
        name: form.name,
        program: form.program,
        batch: form.batch,
        location: form.location,
        bio: form.bio,
      };
      const nextImages = { ...savedImages.current };
      for (const [kind, field, idField, route] of [
        ["avatar", "profilePicture", "profilePicturePublicId", "profile"],
        ["banner", "bannerImage", "bannerImagePublicId", "cover"],
      ]) {
        const image = pendingImages.current[kind];
        if (!image) continue;
        // Retain uploaded results if saving the profile fails, so retry saves
        // do not upload the same file to Cloudinary again.
        image.result ||= await uploadProfileImage(image.file, route);
        payload[field] = image.result.url;
        payload[idField] = image.result.publicId;
        nextImages[field] = image.result.url;
      }
      await api.put("/users/me", payload);
      savedFields.current = {
        name: form.name,
        program: form.program,
        batch: form.batch,
        location: form.location,
        bio: form.bio,
      };
      savedImages.current = nextImages;
      setProfilePicture(nextImages.profilePicture);
      setBannerImage(nextImages.bannerImage);
      clearPendingImages();
      setEditing(false);
      await refreshUser();
      toast.success("Saved", { description: "Profile updated." });
    } catch (err) {
      toast.error("Error", { description: err.response?.data?.message || "Failed to save" });
    } finally {
      savePending.current = false;
      setSaving(false);
    }
  };

  const addExperience = async () => {
    if (saving) return;
    if (!expForm.position.trim() || !expForm.company.trim()) {
      toast.warning("Missing details", { description: "Please enter a position and company." });
      return;
    }
    if (!expForm.startDate || (!expForm.current && !expForm.endDate)) {
      toast.warning("Missing date", { description: 'Please select a start date and an end date, or check "I currently work here".' });
      return;
    }
    if (!expForm.current && expForm.endDate < expForm.startDate) {
      toast.warning("Invalid dates", { description: "End date must be on or after the start date." });
      return;
    }
    setSaving(true);
    try {
      const response = await api.put("/users/me", {
        $push: {
          employmentHistory: {
            ...expForm,
            endDate: expForm.current ? "" : expForm.endDate,
          },
        },
      });
      setForm((prev) => ({
        ...prev,
        employmentHistory: response.data.data.employmentHistory || [],
      }));
      await refreshUser();
      setShowAddExp(false);
      setExpForm({
        position: "",
        company: "",
        location: "",
        startDate: "",
        endDate: "",
        current: false,
      });
      toast.success("Added", { description: "Experience added." });
    } catch (err) {
      toast.error("Error", { description: err.response?.data?.message || "Failed to add" });
    } finally {
      setSaving(false);
    }
  };

  const removeProfileEntry = async (field, index, label) => {
    if (saving || deletionPending.current) return;
    deletionPending.current = true;
    try {
      const confirmation = await Swal.fire({
        title: `Delete ${label}?`,
        text: "This will permanently remove the entry from your profile.",
        icon: "warning",
        showCancelButton: true,
        confirmButtonText: "Delete",
        cancelButtonText: "Cancel",
        confirmButtonColor: "#dc2626",
        cancelButtonColor: "#71717a",
        focusCancel: true,
      });
      if (!confirmation.isConfirmed) return;
      setSaving(true);
      const res = await api.get("/users/me");
      const entries = [...(res.data.data?.[field] || [])];
      const original = form[field]?.[index];
      // Find the displayed entry if another session has changed the array order.
      const matches = (entry) =>
        JSON.stringify(entry) === JSON.stringify(original);
      const target =
        original && matches(entries[index])
          ? index
          : entries.findIndex(matches);
      if (target < 0) {
        setForm((prev) => ({ ...prev, [field]: entries }));
        toast.info("Entry unavailable", { description: "This entry has already been removed or changed. Please review the updated list." });
        return;
      }
      entries.splice(target, 1);
      const response = await api.put("/users/me", { [field]: entries });
      setForm((prev) => ({
        ...prev,
        [field]: response.data.data[field] || [],
      }));
      if (field === "employmentHistory") setEditingExp(null);
      else setEditingEdu(null);
      await refreshUser();
      toast.success(`${label === "experience" ? "Experience" : "Education"} deleted`);
    } catch (err) {
      toast.error("Error", { description: err.response?.data?.message || "Failed to remove" });
    } finally {
      deletionPending.current = false;
      setSaving(false);
    }
  };
  const removeExperience = (index) =>
    removeProfileEntry("employmentHistory", index, "experience");

  const addEducation = async () => {
    if (saving) return;
    if (!eduForm.school.trim() || !eduForm.degree.trim()) {
      toast.warning("Missing details", { description: "Please enter a school and degree." });
      return;
    }
    setSaving(true);
    try {
      const response = await api.put("/users/me", {
        $push: { education: eduForm },
      });
      setForm((prev) => ({
        ...prev,
        education: response.data.data.education || [],
      }));
      await refreshUser();
      setShowAddEdu(false);
      setEduForm({ school: "", degree: "", year: "", location: "" });
      toast.success("Added", { description: "Education added." });
    } catch (err) {
      toast.error("Error", { description: err.response?.data?.message || "Failed to add" });
    } finally {
      setSaving(false);
    }
  };

  const removeEducation = (index) =>
    removeProfileEntry("education", index, "education");

  const updateExperience = async (index) => {
    if (saving) return;
    if (!editExpForm.position.trim() || !editExpForm.company.trim()) {
      toast.warning("Missing details", { description: "Please enter a position and company." });
      return;
    }
    if (
      !editExpForm.startDate ||
      (!editExpForm.current && !editExpForm.endDate)
    ) {
      toast.warning("Missing date", { description: 'Please select a start date and an end date, or check "I currently work here".' });
      return;
    }
    if (!editExpForm.current && editExpForm.endDate < editExpForm.startDate) {
      toast.warning("Invalid dates", { description: "End date must be on or after the start date." });
      return;
    }
    setSaving(true);
    try {
      const res = await api.get("/users/me");
      const history = res.data.data?.employmentHistory || [];
      history[index] = {
        ...history[index],
        ...editExpForm,
        endDate: editExpForm.current ? "" : editExpForm.endDate,
        period: "",
      };
      const response = await api.put("/users/me", {
        employmentHistory: history,
      });
      setForm((prev) => ({
        ...prev,
        employmentHistory: response.data.data.employmentHistory || [],
      }));
      await refreshUser();
      setEditingExp(null);
      toast.success("Updated", { description: "Experience updated." });
    } catch (err) {
      toast.error("Error", { description: err.response?.data?.message || "Failed to update" });
    } finally {
      setSaving(false);
    }
  };

  const updateEducation = async (index) => {
    if (saving) return;
    if (!editEduForm.school.trim() || !editEduForm.degree.trim()) {
      toast.warning("Missing details", { description: "Please enter a school and degree." });
      return;
    }
    setSaving(true);
    try {
      const res = await api.get("/users/me");
      const edu = res.data.data?.education || [];
      edu[index] = { ...edu[index], ...editEduForm };
      const response = await api.put("/users/me", { education: edu });
      setForm((prev) => ({
        ...prev,
        education: response.data.data.education || [],
      }));
      await refreshUser();
      setEditingEdu(null);
      toast.success("Updated", { description: "Education updated." });
    } catch (err) {
      toast.error("Error", { description: err.response?.data?.message || "Failed to update" });
    } finally {
      setSaving(false);
    }
  };

  const addSkill = async (value) => {
    const skill = value.trim();
    if (!skill || skill.length > 100 || skillPending.current) return false;
    if (
      (form.skills || []).some(
        (existing) => normalizeSkill(existing) === normalizeSkill(skill),
      )
    ) {
      setNewSkill("");
      return true;
    }
    if ((form.skills || []).length >= 10) return false;
    skillPending.current = true;
    setAddingSkill(true);
    try {
      const response = await api.put("/users/me", {
        $addToSet: { skills: skill },
      });
      setForm((prev) => ({ ...prev, skills: response.data.data.skills || [] }));
      setNewSkill("");
      return true;
    } catch (err) {
      toast.error("Error", { description: err.response?.data?.message || "Failed to add skill" });
      return false;
    } finally {
      skillPending.current = false;
      setAddingSkill(false);
    }
  };

  const removeSkill = async (skill) => {
    try {
      await api.put("/users/me", {
        $pull: { skills: skill },
      });
      setForm((prev) => ({
        ...prev,
        skills: prev.skills.filter((s) => s !== skill),
      }));
    } catch (err) {
      toast.error("Error", { description: err.response?.data?.message || "Failed to remove skill" });
    }
  };

  const toggleEditing = () => {
    if (savePending.current || saving || skillPending.current) return;
    if (editing) {
      // Cancel: discard unsaved image changes
      setProfilePicture(savedImages.current.profilePicture);
      setBannerImage(savedImages.current.bannerImage);
      clearPendingImages();
      setForm((prev) => ({ ...prev, ...savedFields.current }));
    }
    setEditing(!editing);
  };

  const handleImagePick = async (e, kind) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (savePending.current) return;
    try {
      validateProfileImage(file);
      if (pendingImages.current[kind]?.preview)
        URL.revokeObjectURL(pendingImages.current[kind].preview);
      const preview = URL.createObjectURL(file);
      pendingImages.current[kind] = { file, preview, result: null };
      if (kind === "avatar") setProfilePicture(preview);
      else setBannerImage(preview);
    } catch (err) {
      toast.error("Error", { description: err.message || "Failed to load image" });
    }
  };

  const computePeriod = (startDate, endDate, current) => {
    if (!startDate) return "";
    const start = new Date(startDate);
    const end = current ? new Date() : endDate ? new Date(endDate) : new Date();
    const months =
      (end.getFullYear() - start.getFullYear()) * 12 +
      (end.getMonth() - start.getMonth());
    const years = Math.floor(months / 12);
    const remainingMonths = months % 12;
    if (years === 0)
      return `${remainingMonths} mo${remainingMonths !== 1 ? "s" : ""}`;
    if (remainingMonths === 0) return `${years} yr${years !== 1 ? "s" : ""}`;
    return `${years} yr${years !== 1 ? "s" : ""} ${remainingMonths} mo${remainingMonths !== 1 ? "s" : ""}`;
  };

  const person = isOwn
    ? {
        ...user,
        ...form,
        employmentHistory: form.employmentHistory,
        education: form.education,
      }
    : profile;
  const avatarSrc = isOwn ? profilePicture : profile?.profilePicture;
  const bannerSrc = isOwn ? bannerImage : profile?.bannerImage;
  const isStudent =
    user?.role === "student" ||
    (user?.role === "admin" && profileRole === "student");
  const profileLabel = profileRole === "student" ? "Student" : "Alumni";
  const Sidebar = isStudent ? StudentSidebar : AlumniSidebar;
  const Topbar = isStudent ? StudentTopbar : AlumniTopbar;

  const inputClass =
    "w-full h-10 px-3.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-[13px] text-zinc-800 dark:text-zinc-100 outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/15";

  return (
    <div
      className={`${isStudent ? "student-page " : ""}min-h-screen bg-[#f3f6f3] dark:bg-zinc-950`}
    >
      <Sidebar
        user={user}
        mobileOpen={sidebarOpen}
        setMobileOpen={setSidebarOpen}
      />

      <div className="lg:pl-64">
        <Topbar
          user={user}
          title="Profile"
          onMenuClick={() => setSidebarOpen(true)}
        />

        <main className="mx-auto max-w-4xl space-y-4 p-4 sm:p-6 workspace-page">
          <header className="workspace-page-header">
            <h1>Profile</h1>
            <p className="mt-2">{isOwn ? "Manage your profile and the experience you share with the community." : "Get to know this member of the community."}</p>
          </header>
          {!isOwn && (
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="flex items-center gap-1.5 text-[12.5px] font-semibold text-zinc-500 dark:text-zinc-400 transition hover:text-brand"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </button>
          )}

          {!isOwn && loadingOther ? (
            <div className="rounded-3xl border border-brand/10 bg-white dark:bg-zinc-900 p-10 text-center shadow-sm">
              <svg
                className="mx-auto h-8 w-8 animate-spin text-brand dark:text-brand"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                  fill="none"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              <p className="mt-3 text-[13px] font-medium text-zinc-500 dark:text-zinc-400">
                Loading profile...
              </p>
            </div>
          ) : !isOwn && (notFound || !profile) ? (
            <div className="rounded-3xl border border-brand/10 bg-white dark:bg-zinc-900 p-10 text-center shadow-sm">
              <p className="text-[15px] font-bold text-zinc-800 dark:text-zinc-100">
                Profile not found
              </p>
              <p className="mt-1 text-[12.5px] text-zinc-500 dark:text-zinc-400">
                This {profileRole} profile does not exist.
              </p>
            </div>
          ) : (
            <>
              {/* Profile header */}
              <section className="overflow-hidden rounded-3xl border border-brand/10 bg-white dark:bg-zinc-900 shadow-sm">
                <div
                  className="relative h-32 overflow-hidden bg-gradient-to-br from-brand via-brand to-brand sm:h-40"
                  style={
                    bannerSrc
                      ? undefined
                      : {
                          backgroundImage:
                            "radial-gradient(circle at 15% 30%, rgba(255,255,255,0.18) 0 2px, transparent 3px), radial-gradient(circle at 30% 70%, rgba(255,255,255,0.12) 0 2px, transparent 3px), radial-gradient(circle at 70% 20%, rgba(255,255,255,0.15) 0 2px, transparent 3px), radial-gradient(circle at 85% 65%, rgba(255,255,255,0.18) 0 2px, transparent 3px), linear-gradient(to bottom right, #0F4C3A, #009639, #009639)",
                        }
                  }
                >
                  {bannerSrc && (
                    <img
                      src={bannerSrc}
                      alt="Profile banner"
                      className="absolute inset-0 h-full w-full object-cover"
                    />
                  )}
                  {isOwn && editing && (
                    <>
                      <input
                        ref={bannerInputRef}
                        type="file"
                        accept={IMAGE_ACCEPT}
                        aria-label="Upload profile banner"
                        disabled={saving}
                        className="hidden"
                        onChange={(e) => handleImagePick(e, "banner")}
                      />
                      <button
                        type="button"
                        onClick={() => bannerInputRef.current?.click()}
                        className="absolute right-3 top-3 flex items-center gap-1.5 rounded-full bg-black/50 px-3 py-1.5 text-[11.5px] font-semibold text-white backdrop-blur transition hover:bg-black/65"
                      >
                        <Camera className="h-3.5 w-3.5" />
                        Change banner
                      </button>
                    </>
                  )}
                </div>
                <div className="px-5 pb-5 sm:px-7">
                  <div className="-mt-10 flex flex-wrap items-end justify-between gap-3">
                    <div className="relative">
                      <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-full bg-white text-3xl font-extrabold text-brand shadow-lg ring-4 ring-white dark:bg-zinc-900 dark:text-brand">
                        {avatarSrc ? (
                          <img
                            src={avatarSrc}
                            alt={person?.name || "Profile"}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          (person?.name || "A").charAt(0).toUpperCase()
                        )}
                      </div>
                      {isOwn && editing ? (
                        <>
                          <input
                            ref={avatarInputRef}
                            type="file"
                            accept={IMAGE_ACCEPT}
                            disabled={saving}
                            className="hidden"
                            onChange={(e) => handleImagePick(e, "avatar")}
                          />
                          <button
                            type="button"
                            onClick={() => avatarInputRef.current?.click()}
                            aria-label="Change profile picture"
                            title="Change profile picture"
                            className="absolute -bottom-1 -right-1 flex h-8 w-8 items-center justify-center rounded-full bg-brand text-white shadow-md ring-2 ring-white transition hover:bg-brand dark:ring-zinc-900"
                          >
                            <Camera className="h-4 w-4" />
                          </button>
                        </>
                      ) : (
                        <span
                          className="absolute bottom-1 right-1 h-4 w-4 rounded-full border-2 border-white bg-brand"
                          title="Active"
                        />
                      )}
                    </div>
                    {isOwn && (
                      <button
                        type="button"
                        onClick={toggleEditing}
                        className="flex items-center gap-1.5 rounded-full border border-zinc-200 dark:border-zinc-700 px-3.5 py-1.5 text-[12px] font-semibold text-zinc-600 dark:text-zinc-300 transition hover:border-emerald-300 hover:text-brand"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                        {editing ? "Cancel" : "Edit profile"}
                      </button>
                    )}
                  </div>

                  {editing ? (
                    <div className="mt-4 space-y-3">
                      <div className="grid gap-3 sm:grid-cols-2">
                        <input
                          value={form.name}
                          onChange={(e) =>
                            setForm({ ...form, name: e.target.value })
                          }
                          placeholder="Full name"
                          className={inputClass}
                        />
                        <input
                          value={form.program}
                          onChange={(e) =>
                            setForm({ ...form, program: e.target.value })
                          }
                          placeholder="Program (e.g. BS Psychology)"
                          className={inputClass}
                        />
                        <input
                          value={form.batch}
                          onChange={(e) =>
                            setForm({ ...form, batch: e.target.value })
                          }
                          placeholder="Batch (e.g. 2015)"
                          className={inputClass}
                        />
                        <input
                          value={form.location}
                          onChange={(e) =>
                            setForm({ ...form, location: e.target.value })
                          }
                          placeholder="Location"
                          className={inputClass}
                        />
                      </div>
                      <button
                        type="button"
                        onClick={saveProfile}
                        disabled={saving}
                        className="flex items-center gap-1.5 rounded-xl bg-brand px-5 py-2 text-[13px] font-bold text-white transition hover:bg-brand disabled:opacity-50"
                      >
                        <Check className="h-4 w-4" />
                        {saving ? "Saving..." : "Save Profile"}
                      </button>
                    </div>
                  ) : (
                    <>
                      <h2 className="mt-3 flex items-center gap-1.5 text-2xl font-extrabold tracking-tight text-zinc-900 dark:text-zinc-100">
                        {person?.name || profileLabel}
                        <BadgeCheck className="h-5 w-5 shrink-0 text-brand dark:text-brand" />
                      </h2>
                      <p className="text-[13.5px] font-medium text-zinc-600 dark:text-zinc-300">
                        {person?.program}
                        {person?.batch ? ` • Batch ${person.batch}` : ""}
                      </p>
                      <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[12px] text-zinc-400 dark:text-zinc-500">
                        {person?.location && (
                          <span className="flex items-center gap-1">
                            <MapPin className="h-3.5 w-3.5" />
                            {person.location}
                          </span>
                        )}
                        <span className="flex items-center gap-1">
                          <Mail className="h-3.5 w-3.5" />
                          {person?.email || `${profileRole}@clsu.edu.ph`}
                        </span>
                      </p>
                    </>
                  )}

                  {isOwn && !editing && (
                    <div className="mt-4 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => setEditing(true)}
                        className="rounded-full border border-zinc-300 px-5 py-2 text-[13px] font-bold text-zinc-600 dark:text-zinc-300 transition hover:border-brand hover:text-brand"
                      >
                        Edit profile
                      </button>
                      <button
                        type="button"
                        className="flex items-center gap-1.5 rounded-full border border-zinc-300 px-5 py-2 text-[13px] font-bold text-zinc-600 dark:text-zinc-300 transition hover:border-brand hover:text-brand"
                      >
                        <Share2 className="h-4 w-4" />
                        Share profile
                      </button>
                    </div>
                  )}

                  {!isOwn && (
                    <div className="mt-4 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={handleConnect}
                        disabled={connectState !== "none" || connectLoading}
                        className={`flex items-center gap-1.5 rounded-full px-5 py-2 text-[13px] font-bold shadow-sm transition disabled:cursor-default ${
                          connectState === "connected"
                            ? "border border-brand text-brand"
                            : connectState === "pending"
                              ? "bg-amber-50 text-amber-700 ring-1 ring-amber-200"
                              : "bg-brand text-white shadow-emerald-900/20 hover:bg-brand"
                        }`}
                      >
                        {connectState === "connected" ? (
                          <>
                            <Check className="h-4 w-4" /> Connected
                          </>
                        ) : connectState === "pending" ? (
                          <>
                            <Clock className="h-4 w-4" /> Pending
                          </>
                        ) : (
                          <>
                            <Plus className="h-4 w-4" />{" "}
                            {connectLoading ? "Sending..." : "Connect"}
                          </>
                        )}
                      </button>
                      {connectState === "connected" && (
                        <button
                          type="button"
                          onClick={() =>
                            profile?.email && openChatByEmail(profile.email)
                          }
                          className="rounded-full border border-zinc-300 px-5 py-2 text-[13px] font-bold text-zinc-600 dark:text-zinc-300 transition hover:border-brand hover:text-brand"
                        >
                          Message
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {/* Stats strip */}
                <div className="grid grid-cols-3 divide-x divide-zinc-100 dark:divide-zinc-800 border-t border-zinc-100 dark:border-zinc-800 bg-emerald-50/40 dark:bg-zinc-800/50">
                  {[
                    {
                      icon: Users,
                      value: String(connectionsCount),
                      label: "Connections",
                    },
                    {
                      icon: Briefcase,
                      value: String(person?.employmentHistory?.length || 0),
                      label: "Experience",
                    },
                    {
                      icon: Award,
                      value: String(person?.skills?.length || 0),
                      label: "Skills",
                    },
                  ].map(({ icon, value, label }) => {
                    const Icon = icon;
                    return (
                      <div
                        key={label}
                        className="flex items-center justify-center gap-2.5 px-2 py-3.5"
                      >
                        <span className="hidden h-9 w-9 items-center justify-center rounded-xl bg-white dark:bg-zinc-900 text-brand dark:text-brand shadow-sm sm:flex">
                          <Icon className="h-4 w-4" />
                        </span>
                        <span className="text-center sm:text-left">
                          <span className="block text-[16px] font-extrabold leading-none text-zinc-900 dark:text-zinc-100">
                            {value}
                          </span>
                          <span className="block text-[10.5px] font-medium uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
                            {label}
                          </span>
                        </span>
                      </div>
                    );
                  })}
                </div>
              </section>

              {/* About */}
              <section className="rounded-3xl border border-brand/10 bg-white dark:bg-zinc-900 p-5 shadow-sm sm:p-6">
                <h3 className="flex items-center gap-2 text-[14px] font-bold text-zinc-900 dark:text-zinc-100">
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand/10 text-brand dark:text-brand">
                    <Sparkles className="h-3.5 w-3.5" />
                  </span>
                  About
                </h3>
                {editing ? (
                  <div className="mt-3 space-y-2.5">
                    <textarea
                      value={form.bio}
                      onChange={(e) =>
                        setForm({ ...form, bio: e.target.value })
                      }
                      placeholder="Write something about yourself..."
                      rows={5}
                      className={`${inputClass} h-auto resize-y py-2.5 leading-relaxed`}
                    />
                    <button
                      type="button"
                      onClick={saveProfile}
                      disabled={saving}
                      className="flex items-center gap-1.5 rounded-xl bg-brand px-5 py-2 text-[13px] font-bold text-white transition hover:bg-brand disabled:opacity-50"
                    >
                      <Check className="h-4 w-4" />
                      {saving ? "Saving..." : "Save Profile"}
                    </button>
                  </div>
                ) : (
                  <p className="mt-2.5 whitespace-pre-line text-[13px] leading-relaxed text-zinc-600 dark:text-zinc-300">
                    {person?.bio || "No bio yet."}
                  </p>
                )}

                {/* Skills */}
                <div className="mt-4">
                  <p className="text-[12px] font-bold text-zinc-700 dark:text-zinc-300">
                    Skills
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {(editing ? form.skills : person?.skills || []).map(
                      (skill) => (
                        <span
                          key={skill}
                          className="group flex items-center gap-1 rounded-full bg-emerald-50 dark:bg-emerald-950 px-3 py-1 text-[11px] font-semibold text-brand dark:text-brand ring-1 ring-emerald-100 dark:ring-brand"
                        >
                          {skill}
                          {editing && (
                            <button
                              type="button"
                              aria-label={`Remove ${skill}`}
                              onClick={() => removeSkill(skill)}
                              className="text-brand hover:text-red-600"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          )}
                        </span>
                      ),
                    )}
                  </div>
                  {editing && (
                    <SkillInput
                      value={newSkill}
                      onChange={setNewSkill}
                      onAdd={addSkill}
                      selected={form.skills || []}
                      disabled={addingSkill || saving}
                      inputClass={inputClass}
                    />
                  )}
                </div>
              </section>

              {/* Experience timeline */}
              <section className="rounded-3xl border border-brand/10 bg-white dark:bg-zinc-900 p-5 shadow-sm sm:p-6">
                <div className="flex items-center justify-between">
                  <h3 className="flex items-center gap-2 text-[14px] font-bold text-zinc-900 dark:text-zinc-100">
                    <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand/10 text-brand dark:text-brand">
                      <Briefcase className="h-3.5 w-3.5" />
                    </span>
                    Experience
                  </h3>
                  <div className="flex items-center gap-1.5">
                    {isOwn && !editing && (
                      <button
                        type="button"
                        onClick={() => setShowAddExp(!showAddExp)}
                        className="flex items-center gap-1 rounded-full bg-brand px-3 py-1.5 text-[11px] font-bold text-white transition hover:bg-brand"
                      >
                        <Plus className="h-3 w-3" />
                        Add
                      </button>
                    )}
                    {showAddExp && (
                      <button
                        type="button"
                        onClick={() => setShowAddExp(false)}
                        className="flex items-center gap-1 rounded-full border border-zinc-200 dark:border-zinc-700 px-3 py-1.5 text-[11px] font-bold text-zinc-500 dark:text-zinc-400 transition hover:bg-zinc-100 dark:hover:bg-zinc-800"
                      >
                        <X className="h-3 w-3" />
                        Cancel
                      </button>
                    )}
                  </div>
                </div>

                {showAddExp && (
                  <div className="mt-4 grid gap-2.5 rounded-2xl border border-zinc-200 dark:border-zinc-700 p-4 sm:grid-cols-2">
                    <input
                      value={expForm.position}
                      onChange={(e) =>
                        setExpForm({ ...expForm, position: e.target.value })
                      }
                      placeholder="Position"
                      className={inputClass}
                    />
                    <input
                      value={expForm.company}
                      onChange={(e) =>
                        setExpForm({ ...expForm, company: e.target.value })
                      }
                      placeholder="Company"
                      className={inputClass}
                    />
                    <input
                      value={expForm.location}
                      onChange={(e) =>
                        setExpForm({ ...expForm, location: e.target.value })
                      }
                      placeholder="Location"
                      className={inputClass}
                    />
                    <div className="grid grid-cols-2 gap-2.5 sm:col-span-2">
                      <label className="min-w-0">
                        <span className="mb-1.5 block text-[11px] font-bold text-zinc-500 dark:text-zinc-400">
                          Start Date
                        </span>
                        <input
                          type="date"
                          value={expForm.startDate}
                          onChange={(e) =>
                            setExpForm({
                              ...expForm,
                              startDate: e.target.value,
                            })
                          }
                          className={`${inputClass} w-full [color-scheme:light] dark:[color-scheme:dark]`}
                        />
                      </label>
                      <label className="min-w-0">
                        <span className="mb-1.5 block text-[11px] font-bold text-zinc-500 dark:text-zinc-400">
                          End Date
                        </span>
                        <input
                          type="date"
                          value={expForm.current ? "" : expForm.endDate}
                          min={expForm.startDate || undefined}
                          onChange={(e) =>
                            setExpForm({ ...expForm, endDate: e.target.value })
                          }
                          disabled={expForm.current}
                          className={`${inputClass} w-full disabled:opacity-50 [color-scheme:light] dark:[color-scheme:dark]`}
                        />
                      </label>
                    </div>
                    <label className="flex items-center gap-2 text-[12.5px] font-medium text-zinc-600 dark:text-zinc-300 sm:col-span-2">
                      <input
                        type="checkbox"
                        checked={expForm.current}
                        onChange={(e) =>
                          setExpForm({ ...expForm, current: e.target.checked })
                        }
                        className="h-4 w-4 rounded border-zinc-300 text-brand focus:ring-brand/30"
                      />
                      I currently work here
                    </label>
                    <button
                      type="button"
                      onClick={addExperience}
                      disabled={saving}
                      className="h-10 rounded-xl bg-brand text-[13px] font-bold text-white transition hover:bg-brand disabled:opacity-50 sm:col-span-2"
                    >
                      {saving ? "Adding..." : "Add Experience"}
                    </button>
                  </div>
                )}

                <ol className="mt-3 space-y-0">
                  {(person?.employmentHistory || []).length === 0 ? (
                    <li className="py-4 text-center text-[12.5px] text-zinc-400">
                      No experience yet.
                    </li>
                  ) : (
                    (person?.employmentHistory || []).map((job, i) => (
                      <li
                        key={i}
                        className="group relative flex gap-4 pb-6 last:pb-0"
                      >
                        {i < (person?.employmentHistory || []).length - 1 && (
                          <span className="absolute left-[15px] top-9 h-[calc(100%-2rem)] w-0.5 rounded bg-emerald-100 dark:bg-emerald-900" />
                        )}
                        <span
                          className={`relative z-10 mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ring-4 ring-white ${
                            job.current
                              ? "bg-brand text-white"
                              : "bg-emerald-50 text-brand"
                          }`}
                        >
                          <Briefcase className="h-3.5 w-3.5" />
                        </span>
                        <div className="min-w-0 flex-1 rounded-2xl bg-zinc-50 dark:bg-zinc-800/70 p-3.5 transition hover:bg-emerald-50/50">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="flex flex-wrap items-center gap-2 text-[13.5px] font-bold text-zinc-900 dark:text-zinc-100">
                                {job.position || job.role}
                                {job.current && (
                                  <span className="rounded-full bg-brand px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-white">
                                    Current
                                  </span>
                                )}
                              </p>
                              <p className="text-[12px] font-medium text-zinc-600 dark:text-zinc-300">
                                {job.company}
                              </p>
                              <p className="mt-0.5 text-[11px] text-zinc-400 dark:text-zinc-500">
                                {job.period ||
                                  computePeriod(
                                    job.startDate,
                                    job.endDate,
                                    job.current,
                                  )}
                                {job.location ? ` • ${job.location}` : ""}
                              </p>
                            </div>
                            {isOwn && !editing && editingExp !== i && (
                              <div className="flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingExp(i);
                                    setEditExpForm({
                                      position: job.position || job.role || "",
                                      company: job.company || "",
                                      location: job.location || "",
                                      startDate:
                                        job.startDate?.slice(0, 10) || "",
                                      endDate: job.endDate?.slice(0, 10) || "",
                                      current: job.current || false,
                                    });
                                  }}
                                  className="rounded-lg p-1.5 text-zinc-400 transition hover:bg-blue-50 hover:text-blue-600 sm:opacity-0 sm:group-hover:opacity-100 focus:opacity-100"
                                  aria-label="Edit experience"
                                >
                                  <Pencil className="h-4 w-4" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => removeExperience(i)}
                                  disabled={saving}
                                  className="rounded-lg p-1.5 text-zinc-400 transition hover:bg-red-50 hover:text-red-600 sm:opacity-0 sm:group-hover:opacity-100 focus:opacity-100 disabled:opacity-50"
                                  aria-label="Remove experience"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </div>
                            )}
                          </div>
                          {isOwn && editingExp === i && (
                            <div
                              role="group"
                              aria-label="Edit experience form"
                              className="mt-3 grid gap-2.5 rounded-2xl border border-zinc-200 dark:border-zinc-700 p-3 sm:grid-cols-2"
                            >
                              <input
                                aria-label="Position"
                                value={editExpForm.position}
                                onChange={(e) =>
                                  setEditExpForm({
                                    ...editExpForm,
                                    position: e.target.value,
                                  })
                                }
                                placeholder="Position"
                                className={inputClass}
                              />
                              <input
                                aria-label="Company"
                                value={editExpForm.company}
                                onChange={(e) =>
                                  setEditExpForm({
                                    ...editExpForm,
                                    company: e.target.value,
                                  })
                                }
                                placeholder="Company"
                                className={inputClass}
                              />
                              <input
                                aria-label="Location"
                                value={editExpForm.location}
                                onChange={(e) =>
                                  setEditExpForm({
                                    ...editExpForm,
                                    location: e.target.value,
                                  })
                                }
                                placeholder="Location"
                                className={`${inputClass} sm:col-span-2`}
                              />
                              <div className="grid grid-cols-2 gap-2.5 sm:col-span-2">
                                <label className="min-w-0">
                                  <span className="mb-1.5 block text-[11px] font-bold text-zinc-500 dark:text-zinc-400">
                                    Start Date
                                  </span>
                                  <input
                                    type="date"
                                    value={editExpForm.startDate}
                                    onChange={(e) =>
                                      setEditExpForm({
                                        ...editExpForm,
                                        startDate: e.target.value,
                                      })
                                    }
                                    className={`${inputClass} w-full [color-scheme:light] dark:[color-scheme:dark]`}
                                  />
                                </label>
                                <label className="min-w-0">
                                  <span className="mb-1.5 block text-[11px] font-bold text-zinc-500 dark:text-zinc-400">
                                    End Date
                                  </span>
                                  <input
                                    type="date"
                                    value={
                                      editExpForm.current
                                        ? ""
                                        : editExpForm.endDate
                                    }
                                    min={editExpForm.startDate || undefined}
                                    disabled={editExpForm.current}
                                    onChange={(e) =>
                                      setEditExpForm({
                                        ...editExpForm,
                                        endDate: e.target.value,
                                      })
                                    }
                                    className={`${inputClass} w-full disabled:opacity-50 [color-scheme:light] dark:[color-scheme:dark]`}
                                  />
                                </label>
                              </div>
                              <label className="flex items-center gap-2 text-[12.5px] font-medium text-zinc-600 dark:text-zinc-300 sm:col-span-2">
                                <input
                                  type="checkbox"
                                  checked={editExpForm.current}
                                  onChange={(e) =>
                                    setEditExpForm({
                                      ...editExpForm,
                                      current: e.target.checked,
                                    })
                                  }
                                  className="h-4 w-4 rounded border-zinc-300 text-brand"
                                />
                                I currently work here
                              </label>
                              <button
                                type="button"
                                onClick={() => updateExperience(i)}
                                disabled={saving}
                                className="h-10 rounded-xl bg-brand text-[13px] font-bold text-white hover:bg-brand disabled:opacity-50"
                              >
                                {saving ? "Saving..." : "Save Changes"}
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditingExp(null)}
                                disabled={saving}
                                className="h-10 rounded-xl border border-zinc-200 dark:border-zinc-700 text-[13px] font-bold text-zinc-600 dark:text-zinc-300 disabled:opacity-50"
                              >
                                Cancel
                              </button>
                            </div>
                          )}
                        </div>
                      </li>
                    ))
                  )}
                </ol>
              </section>

              {/* Education */}
              <section className="rounded-3xl border border-brand/10 bg-white dark:bg-zinc-900 p-5 shadow-sm sm:p-6">
                <div className="flex items-center justify-between">
                  <h3 className="flex items-center gap-2 text-[14px] font-bold text-zinc-900 dark:text-zinc-100">
                    <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand/10 text-brand dark:text-brand">
                      <GraduationCap className="h-3.5 w-3.5" />
                    </span>
                    Education
                  </h3>
                  <div className="flex items-center gap-1.5">
                    {isOwn && !editing && (
                      <button
                        type="button"
                        onClick={() => setShowAddEdu(!showAddEdu)}
                        className="flex items-center gap-1 rounded-full bg-brand px-3 py-1.5 text-[11px] font-bold text-white transition hover:bg-brand"
                      >
                        <Plus className="h-3 w-3" />
                        Add
                      </button>
                    )}
                    {showAddEdu && (
                      <button
                        type="button"
                        onClick={() => setShowAddEdu(false)}
                        className="flex items-center gap-1 rounded-full border border-zinc-200 dark:border-zinc-700 px-3 py-1.5 text-[11px] font-bold text-zinc-500 dark:text-zinc-400 transition hover:bg-zinc-100 dark:hover:bg-zinc-800"
                      >
                        <X className="h-3 w-3" />
                        Cancel
                      </button>
                    )}
                  </div>
                </div>

                {showAddEdu && (
                  <div className="mt-4 grid gap-2.5 rounded-2xl border border-zinc-200 dark:border-zinc-700 p-4 sm:grid-cols-2">
                    <input
                      value={eduForm.school}
                      onChange={(e) =>
                        setEduForm({ ...eduForm, school: e.target.value })
                      }
                      placeholder="School"
                      className={inputClass}
                    />
                    <input
                      value={eduForm.degree}
                      onChange={(e) =>
                        setEduForm({ ...eduForm, degree: e.target.value })
                      }
                      placeholder="Degree"
                      className={inputClass}
                    />
                    <input
                      value={eduForm.year}
                      onChange={(e) =>
                        setEduForm({ ...eduForm, year: e.target.value })
                      }
                      placeholder="Year (e.g. 2011 — 2015)"
                      className={inputClass}
                    />
                    <input
                      value={eduForm.location}
                      onChange={(e) =>
                        setEduForm({ ...eduForm, location: e.target.value })
                      }
                      placeholder="Location"
                      className={inputClass}
                    />
                    <button
                      type="button"
                      onClick={addEducation}
                      disabled={saving}
                      className="h-10 rounded-xl bg-brand text-[13px] font-bold text-white transition hover:bg-brand disabled:opacity-50 sm:col-span-2"
                    >
                      {saving ? "Adding..." : "Add Education"}
                    </button>
                  </div>
                )}

                <div className="mt-3 space-y-3">
                  {(person?.education || []).length === 0 ? (
                    <p className="py-4 text-center text-[12.5px] text-zinc-400">
                      No education yet.
                    </p>
                  ) : (
                    (person?.education || []).map((edu, i) => (
                      <div
                        key={i}
                        className="group flex flex-wrap items-center gap-3.5 rounded-2xl bg-gradient-to-r from-emerald-50 to-white dark:from-zinc-800 dark:to-zinc-900 p-4 ring-1 ring-emerald-100 dark:ring-brand"
                      >
                        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-brand text-white shadow-sm">
                          <GraduationCap className="h-5 w-5" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="text-[13.5px] font-bold text-zinc-900 dark:text-zinc-100">
                            {edu.school}
                          </p>
                          <p className="text-[12px] text-zinc-600 dark:text-zinc-300">
                            {edu.degree}
                          </p>
                          <p className="text-[11px] text-zinc-400 dark:text-zinc-500">
                            {edu.year}
                            {edu.location ? ` • ${edu.location}` : ""}
                          </p>
                        </div>
                        {isOwn && !editing && editingEdu !== i && (
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => {
                                setEditingEdu(i);
                                setEditEduForm({
                                  school: edu.school || "",
                                  degree: edu.degree || "",
                                  year: edu.year || "",
                                  location: edu.location || "",
                                });
                              }}
                              className="rounded-lg p-1.5 text-zinc-400 transition hover:bg-blue-50 hover:text-blue-600 sm:opacity-0 sm:group-hover:opacity-100 focus:opacity-100"
                              aria-label="Edit education"
                            >
                              <Pencil className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => removeEducation(i)}
                              disabled={saving}
                              className="rounded-lg p-1.5 text-zinc-400 transition hover:bg-red-50 hover:text-red-600 sm:opacity-0 sm:group-hover:opacity-100 focus:opacity-100 disabled:opacity-50"
                              aria-label="Remove education"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        )}
                        {isOwn && editingEdu === i && (
                          <div
                            role="group"
                            aria-label="Edit education form"
                            className="mt-3 grid w-full gap-2.5 rounded-2xl border border-zinc-200 dark:border-zinc-700 p-4 sm:grid-cols-2"
                          >
                            <input
                              value={editEduForm.school}
                              onChange={(e) =>
                                setEditEduForm({
                                  ...editEduForm,
                                  school: e.target.value,
                                })
                              }
                              placeholder="School"
                              className={inputClass}
                            />
                            <input
                              value={editEduForm.degree}
                              onChange={(e) =>
                                setEditEduForm({
                                  ...editEduForm,
                                  degree: e.target.value,
                                })
                              }
                              placeholder="Degree"
                              className={inputClass}
                            />
                            <input
                              value={editEduForm.year}
                              onChange={(e) =>
                                setEditEduForm({
                                  ...editEduForm,
                                  year: e.target.value,
                                })
                              }
                              placeholder="Year (e.g. 2011 — 2015)"
                              className={inputClass}
                            />
                            <input
                              value={editEduForm.location}
                              onChange={(e) =>
                                setEditEduForm({
                                  ...editEduForm,
                                  location: e.target.value,
                                })
                              }
                              placeholder="Location"
                              className={inputClass}
                            />
                            <button
                              type="button"
                              onClick={() => updateEducation(i)}
                              disabled={saving}
                              className="h-10 rounded-xl bg-brand text-[13px] font-bold text-white transition hover:bg-brand disabled:opacity-50 sm:col-span-2"
                            >
                              {saving ? "Saving..." : "Save Changes"}
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingEdu(null)}
                              disabled={saving}
                              className="h-10 rounded-xl border border-zinc-200 dark:border-zinc-700 text-[13px] font-bold text-zinc-600 dark:text-zinc-300 transition hover:bg-zinc-100 dark:hover:bg-zinc-800 sm:col-span-2 disabled:opacity-50"
                            >
                              Cancel
                            </button>
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </section>
            </>
          )}
        </main>
      </div>
    </div>
  );
};

export default UserProfile;
