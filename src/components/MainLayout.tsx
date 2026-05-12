import { useEffect, useState } from "react";
import { Outlet, useNavigate, useLocation } from "react-router-dom";
import { LogOut, Users, Settings, MessageSquare, Phone } from "lucide-react";
import { logout, db } from "../lib/firebase";
import { useStore } from "../lib/store";
import { collection, query, where, onSnapshot, doc, updateDoc } from "firebase/firestore";

export default function MainLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, profile } = useStore();
  const [incomingCall, setIncomingCall] = useState<any>(null);

  useEffect(() => {
    if (!user) return;
    
    const q = query(
      collection(db, "calls"),
      where("calleeId", "==", user.uid),
    );
    const unsub = onSnapshot(q, (snap) => {
      // Find the first incoming call that is active
      const callDoc = snap.docs.find((d) => d.data().status === "calling");
      if (callDoc) {
        setIncomingCall({ id: callDoc.id, ...callDoc.data() });
      } else {
        setIncomingCall(null);
      }
    });
    return unsub;
  }, [user]);

  const acceptCall = () => {
    if (incomingCall) {
      navigate(`/call/${incomingCall.id}`);
      setIncomingCall(null);
    }
  };

  const declineCall = async () => {
    // Optionally update document status to 'rejected' here instead of CallScreen
    // Wait, let's keep it simple. CallScreen can handle rejecting if needed, or here.
    if (incomingCall) {
      import("firebase/firestore").then(
        ({ doc, updateDoc, serverTimestamp }) => {
          updateDoc(doc(db, "calls", incomingCall.id), {
            status: "rejected",
            updatedAt: serverTimestamp(),
          }).catch((e) => console.error(e));
        },
      );
      setIncomingCall(null);
    }
  };

  const navItems = [
    { icon: <MessageSquare size={20} />, path: "/", label: "CHATS" },
    { icon: <Users size={20} />, path: "/contacts", label: "CONTACTS" },
    { icon: <Settings size={20} />, path: "/settings", label: "CONFIG" },
  ];

  return (
    <div className="flex h-screen flex-col overflow-hidden relative">
      {/* Incoming Call Overlay */}
      {incomingCall && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black bg-opacity-90 p-4">
          <div className="border-2 border-[var(--primary-color)] p-8 text-center bg-[var(--bg-color)] shadow-[0_0_20px_var(--primary-color)] animate-pulse">
            <h2 className="text-xl font-bold mb-4">INCOMING CALL...</h2>
            <div className="mb-8">
              UNKNOWN ID: {incomingCall.callerId.substring(0, 8)}
            </div>
            <div className="flex gap-4">
              <button
                onClick={acceptCall}
                className="border-2 border-[var(--primary-color)] bg-[var(--primary-color)] text-[var(--bg-color)] p-4 hover:opacity-80"
              >
                <Phone size={24} />
              </button>
              <button
                onClick={declineCall}
                className="border-2 border-red-500 text-red-500 p-4 hover:bg-red-500 hover:text-black"
              >
                DECLINE
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Top Bar */}
      <header className="flex h-16 shrink-0 items-center justify-between border-b-2 border-[var(--primary-color)] px-4">
        <div className="flex items-center">
          <span className="text-xl font-bold tracking-widest">XANE Text</span>
        </div>
        <div className="flex items-center text-sm">
          <span className="mr-2 hidden sm:inline md:mr-4">
            UID: {profile?.username}
          </span>
          <button
            onClick={logout}
            className="p-2 hover:bg-[var(--primary-color)] hover:text-[var(--bg-color)]"
            title="Disconnect"
          >
            <LogOut size={20} />
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 overflow-hidden relative">
        <Outlet />
      </main>

      {/* Bottom Nav */}
      <nav className="flex h-16 shrink-0 items-center border-t-2 border-[var(--primary-color)]">
        {navItems.map((item) => (
          <button
            key={item.path}
            onClick={() => navigate(item.path)}
            className={`flex flex-1 flex-col items-center justify-center space-y-1 h-full transition-colors ${
              location.pathname === item.path ||
              (location.pathname.startsWith("/chat") && item.path === "/")
                ? "bg-[var(--primary-color)] text-[var(--bg-color)]"
                : "hover:bg-[var(--scanline-color)]"
            }`}
          >
            {item.icon}
            <span className="text-[10px] sm:text-xs font-bold">
              {item.label}
            </span>
          </button>
        ))}
      </nav>
    </div>
  );
}
