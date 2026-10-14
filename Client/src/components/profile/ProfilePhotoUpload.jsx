import { useRef, useState } from "react";
import Swal from "sweetalert2";
import { Upload } from "lucide-react";
import { useAuth } from "../../context/useAuth";
import api from "../../utils/axios";
import { IMAGE_ACCEPT, uploadProfileImage } from "../../utils/profileUpload";

export default function ProfilePhotoUpload({ kind = "profile" }) {
  const isCover = kind === "cover";
  const { refreshUser } = useAuth();
  const input = useRef(null);
  const pending = useRef(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const choose = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || pending.current) return;
    pending.current = true;
    setUploading(true);
    setError("");
    try {
      const image = await uploadProfileImage(file, kind);
      await api.put(
        "/users/me",
        isCover
          ? { bannerImage: image.url, bannerImagePublicId: image.publicId }
          : {
              profilePicture: image.url,
              profilePicturePublicId: image.publicId,
            },
      );
      await refreshUser();
      Swal.fire({
        title: isCover ? "Banner updated" : "Photo updated",
        icon: "success",
        timer: 1200,
        showConfirmButton: false,
      });
    } catch (err) {
      setError(
        err.response?.data?.message ||
          err.message ||
          "Could not upload the image.",
      );
    } finally {
      pending.current = false;
      setUploading(false);
    }
  };
  return (
    <div>
      <input
        ref={input}
        type="file"
        accept={IMAGE_ACCEPT}
        aria-label={isCover ? "Upload profile banner" : "Upload profile photo"}
        className="hidden"
        disabled={uploading}
        onChange={choose}
      />
      <button
        type="button"
        disabled={uploading}
        onClick={() => input.current?.click()}
        className="flex items-center gap-1.5 rounded-lg border border-zinc-200 px-4 py-2 text-xs font-semibold text-zinc-600 hover:border-emerald-400 hover:text-emerald-700 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300"
      >
        <Upload className="h-3.5 w-3.5" />
        {uploading
          ? "Uploading..."
          : isCover
            ? "Change banner"
            : "Upload photo"}
      </button>
      {error && (
        <p role="alert" className="mt-2 text-xs text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}
