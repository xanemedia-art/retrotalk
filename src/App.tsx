import { useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useStore } from "./lib/store";
import { auth, db, handleFirestoreError, OperationType } from "./lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";

import BootScreen from "./screens/BootScreen";
import LoginScreen from "./screens/LoginScreen";
import MainLayout from "./components/MainLayout";
import ContactsScreen from "./screens/ContactsScreen";
import ChatsListScreen from "./screens/ChatsListScreen";
import ChatScreen from "./screens/ChatScreen";
import SettingsScreen from "./screens/SettingsScreen";
import CallScreen from "./screens/CallScreen";
import CreateGroupScreen from "./screens/CreateGroupScreen";

export default function App() {
  const {
    theme,
    crtEnabled,
    isInitializing,
    setUser,
    setProfile,
    setInitializing,
    user,
  } = useStore();

  useEffect(() => {
    document.documentElement.className =
      theme === "terminal" ? "" : `theme-${theme}`;
  }, [theme]);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        try {
          const profileDoc = await getDoc(doc(db, "users", u.uid));
          if (!profileDoc.exists()) {
            const defaultName = u.displayName && u.displayName !== "Xane Media" 
              ? u.displayName 
              : "AGENT-" + u.uid.substring(0, 5).toUpperCase();
            
            await setDoc(doc(db, "users", u.uid), {
              uid: u.uid,
              username: defaultName,
              usernameLower: defaultName.toLowerCase(),
              photoUrl: u.photoURL,
              email: u.email,
              phoneNumber: u.phoneNumber,
              status: "online",
              lastSeen: Date.now(),
              createdAt: serverTimestamp(),
            });
            setProfile({
              uid: u.uid,
              username: defaultName,
              photoUrl: u.photoURL,
              status: "online",
              lastSeen: Date.now(),
            });
          } else {
            setProfile(profileDoc.data() as any);
          }
        } catch (error) {
          handleFirestoreError(error, OperationType.GET, `users/${u.uid}`);
        }
      } else {
        setProfile(null);
      }
      setTimeout(() => setInitializing(false), 2500); // Simulate retro boot seq
    });
    return unsub;
  }, []);

  return (
    <div
      className={`min-h-screen bg-[var(--bg-color)] text-[var(--primary-color)] transition-colors duration-500`}
    >
      {crtEnabled && (
        <div className="crt scanlines pointer-events-none fixed inset-0 z-50"></div>
      )}
      <BrowserRouter>
        {isInitializing ? (
          <BootScreen />
        ) : !user ? (
          <LoginScreen />
        ) : (
          <Routes>
            <Route element={<MainLayout />}>
              <Route path="/" element={<ChatsListScreen />} />
              <Route path="/contacts" element={<ContactsScreen />} />
              <Route path="/create-group" element={<CreateGroupScreen />} />
              <Route path="/chat/:chatId" element={<ChatScreen />} />
              <Route path="/settings" element={<SettingsScreen />} />
            </Route>
            <Route path="/call/:callId" element={<CallScreen />} />
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        )}
      </BrowserRouter>
    </div>
  );
}
