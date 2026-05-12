import { useEffect, useState, useRef } from "react";
import { Outlet, useNavigate, useLocation } from "react-router-dom";
import { LogOut, Users, Settings, MessageSquare, Phone } from "lucide-react";
import { logout, db } from "../lib/firebase";
import { useStore } from "../lib/store";
import { collection, query, where, onSnapshot, doc, updateDoc, limit, orderBy } from "firebase/firestore";
import { LocalNotifications } from "@capacitor/local-notifications";

const playRetroBeep = () => {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "square";
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.1);
    gain.gain.setValueAtTime(0.1, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.1);
  } catch (e) {}
};

const playRingtone = () => {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "square";
    osc.frequency.setValueAtTime(440, ctx.currentTime);
    
    gain.gain.setValueAtTime(0, ctx.currentTime);
    for (let i = 0; i < 20; i++) {
      gain.gain.setValueAtTime(0.1, ctx.currentTime + i * 0.4);
      gain.gain.setValueAtTime(0, ctx.currentTime + i * 0.4 + 0.2);
    }
    
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 8);
    return { stop: () => { try { osc.stop(); ctx.close(); } catch(e){} } };
  } catch(e) { return { stop: () => {} }; }
};

const showNotification = (title: string, body: string, id: number) => {
  // Capacitor Native
  LocalNotifications.schedule({
    notifications: [{ title, body, id }]
  }).catch(() => {
    // Web Fallback
    if (window.Notification && Notification.permission === "granted") {
      new Notification(title, { body, icon: "/icon-192.png" });
    }
  });
};

export default function MainLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, profile } = useStore();
  const [incomingCall, setIncomingCall] = useState<any>(null);
  const ringtoneRef = useRef<any>(null);
  const lastMessageRef = useRef<Record<string, number>>({});

  useEffect(() => {
    // Request Notification Permissions
    const requestPerms = async () => {
      try {
        if (window.Notification) {
          await window.Notification.requestPermission();
        }
        await LocalNotifications.requestPermissions();
      } catch (e) {}
    };
    requestPerms();
    
    if (!user) return;

    // Incoming Call Listener
    const qCalls = query(
      collection(db, "calls"),
      where("calleeId", "==", user.uid),
    );
    const unsubCalls = onSnapshot(qCalls, (snap) => {
      const callDoc = snap.docs.find((d) => d.data().status === "calling");
      if (callDoc) {
        const callData = { id: callDoc.id, ...callDoc.data() };
        setIncomingCall(callData);
        
        if (!ringtoneRef.current) {
          ringtoneRef.current = playRingtone();
          showNotification(
            "INCOMING TRANSMISSION",
            `Incoming link from ${(callData as any).callerName || (callData as any).callerId?.substring(0, 8) || "UNKNOWN"}`,
            1
          );
        }
      } else {
        setIncomingCall(null);
        if (ringtoneRef.current) {
          ringtoneRef.current.stop();
          ringtoneRef.current = null;
        }
      }
    });

    // Global Message Listener (via Chats)
    const qChats = query(
      collection(db, "chats"),
      where("members", "array-contains", user.uid),
    );
    const unsubChats = onSnapshot(qChats, (snap) => {
      snap.docChanges().forEach((change) => {
        if (change.type === "modified") {
          const chat = change.doc.data();
          const lastMsgAt = chat.lastMessageAt?.toMillis();
          const chatId = change.doc.id;
          
          if (lastMsgAt && (!lastMessageRef.current[chatId] || lastMsgAt > lastMessageRef.current[chatId])) {
            if (chat.lastSenderId !== user.uid) {
              playRetroBeep();
              const senderName = chat.memberDetails?.[chat.lastSenderId]?.username || "USER";
              showNotification(
                `SIGNAL FROM ${senderName.toUpperCase()}`,
                chat.lastMessage || "Incoming data packet...",
                2
              );
            }
            lastMessageRef.current[chatId] = lastMsgAt;
          }
        }
      });
    });

    return () => {
      unsubCalls();
      unsubChats();
      if (ringtoneRef.current) ringtoneRef.current.stop();
    };
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
              FROM: {incomingCall.callerName || incomingCall.callerId?.substring(0, 8)}
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
