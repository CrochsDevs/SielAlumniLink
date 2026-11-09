import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import GraduationCapLoader from "../components/ui/GraduationCapLoader";
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
      confirmButtonColor: "hsl(var(--primary))",
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
        navigate("/login", { replace: true });
      } catch (err) {
        setSigningOut(false);
        await Swal.fire({
          title: "Logout incomplete",
          text: err.response?.data?.message || "Unable to complete logout. Please try again.",
          icon: "error",
          confirmButtonText: "OK",
          confirmButtonColor: "hsl(var(--primary))",
        });
        navigate(-1);
      }
    });
  }, [logout, navigate]);

  if (!signingOut) {
    return null;
  }

  return (
    <GraduationCapLoader label="Signing you out" />
  );
};

export default Logout;
