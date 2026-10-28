import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { LogOut } from "lucide-react";
import Swal from "sweetalert2";
import { useAuth } from "../context/useAuth";

const Logout = () => {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const done = useRef(false);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    if (done.current) return;
    done.current = true;

    Swal.fire({
      title: "Log out?",
      text: "Are you sure you want to log out of SielAlumni?",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Yes, log out",
      cancelButtonText: "Stay logged in",
      confirmButtonColor: "#009639",
      cancelButtonColor: "#71717a",
      reverseButtons: true,
    }).then(async (result) => {
      if (!result.isConfirmed) {
        navigate(-1);
        return;
      }

      setSigningOut(true);
      try {
        await logout();
      } catch (err) {
        console.error("Logout failed:", err);
      } finally {
        navigate("/login", { replace: true });
      }
    });
  }, [logout, navigate]);

  if (!signingOut) {
    return null;
  }

  return (
    <div className="min-h-screen bg-[#e6e6e6] flex items-center justify-center p-6 font-sans">
      <div className="w-full max-w-[320px] text-center">
        {/* Logo + spinner */}
        <div className="relative mx-auto mb-6 h-20 w-20">
          {/* Green glow */}
          <div className="absolute inset-0 rounded-full bg-brand blur-2xl opacity-40 scale-125"></div>

          {/* Spinner ring */}
          <div className="absolute inset-0 rounded-full border-[3px] border-zinc-200 border-t-[#009639] animate-spin"></div>

          {/* Center icon */}
          <div className="absolute inset-[10px] rounded-full bg-white flex items-center justify-center shadow-md">
            <LogOut className="w-7 h-7 text-brand" />
          </div>
        </div>

        {/* Text */}
        <h1 className="text-[18px] font-bold text-zinc-900 tracking-tight mb-1">
          Signing you out
        </h1>
        <p className="text-[12.5px] text-zinc-500 leading-relaxed">
          Ending your session securely...
        </p>

        {/* Progress dots */}
        <div className="flex items-center justify-center gap-1.5 mt-5">
          <span className="h-1.5 w-1.5 rounded-full bg-brand animate-pulse"></span>
          <span
            className="h-1.5 w-1.5 rounded-full bg-brand animate-pulse"
            style={{ animationDelay: "150ms" }}
          ></span>
          <span
            className="h-1.5 w-1.5 rounded-full bg-brand animate-pulse"
            style={{ animationDelay: "300ms" }}
          ></span>
        </div>
      </div>
    </div>
  );
};

export default Logout;
