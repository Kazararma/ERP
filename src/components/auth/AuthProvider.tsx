import { useEffect } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { useAuthStore } from "@/stores/authStore";
import { useNavigate, useLocation } from "react-router-dom";

export default function AuthProvider({ children }: { children: React.ReactNode }) {
  const { setUser, setUserDoc, setLoading } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      try {
        if (firebaseUser) {
          setUser(firebaseUser);
          const userRef = doc(db, "users", firebaseUser.uid);
          const userSnap = await getDoc(userRef);

          if (userSnap.exists()) {
            const userData = userSnap.data();
            setUserDoc(userData);
            
            if (userData.status === "active" && (location.pathname === "/login" || location.pathname === "/pending" || location.pathname === "/")) {
              navigate("/dashboard");
            } else if (userData.status === "pending" && location.pathname !== "/pending") {
              navigate("/pending");
            }
          } else {
            // Create user document if it doesn't exist (status: pending)
            const newUserData = {
              uid: firebaseUser.uid,
              email: firebaseUser.email,
              displayName: firebaseUser.displayName,
              photoURL: firebaseUser.photoURL,
              role: "admin",
              status: "pending",
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            };
            await setDoc(userRef, newUserData);
            setUserDoc(newUserData);
            if (location.pathname !== "/pending") {
              navigate("/pending");
            }
          }
        } else {
          setUser(null);
          setUserDoc(null);
          if (location.pathname !== "/login") {
            navigate("/login");
          }
        }
      } catch (error) {
        console.error("Auth state change error:", error);
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [setUser, setUserDoc, setLoading, navigate, location.pathname]);

  return <>{children}</>;
}
