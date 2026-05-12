import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { db, handleFirestoreError, auth, OperationType } from "../lib/firebase";
import {
  collection,
  query,
  orderBy,
  limit,
  onSnapshot,
  addDoc,
  serverTimestamp,
  doc,
  getDoc,
  updateDoc,
} from "firebase/firestore";
import { Send, ArrowLeft, Phone, Users } from "lucide-react";
import { useStore } from "../lib/store";
import { format } from "date-fns";

export default function ChatScreen() {
  const { chatId } = useParams();
  const { user } = useStore();
  const navigate = useNavigate();
  const [messages, setMessages] = useState<any[]>([]);
  const [text, setText] = useState("");
  const [chatInfo, setChatInfo] = useState<any>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!chatId || !user) return;

    // Fetch chat metadata
    const chatRef = doc(db, "chats", chatId);
    const unsubChat = onSnapshot(chatRef, (docSnap) => {
      if (docSnap.exists()) {
        setChatInfo(docSnap.data());
      } else {
        // If chat doesn't exist at root, it might be an old 1v1 style ID or a direct user ID
        // For simplicity in this rework, we assume chatId is the document ID in 'chats'
        // If not found, we could try to find/create a 1v1 chat
      }
    });

    // Fetch messages
    const q = query(
      collection(db, "chats", chatId, "messages"),
      orderBy("createdAt", "asc"),
      limit(100),
    );
    const unsubMessages = onSnapshot(
      q,
      (snap) => {
        setMessages(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        setTimeout(() => {
          scrollRef.current?.scrollTo({
            top: scrollRef.current.scrollHeight,
            behavior: "smooth",
          });
        }, 100);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, "messages");
      },
    );

    return () => {
      unsubChat();
      unsubMessages();
    };
  }, [chatId, user]);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() || !user || !chatId) return;
    try {
      const msgData = {
        text,
        senderId: user.uid,
        senderName: user.displayName || "User",
        createdAt: serverTimestamp(),
      };
      
      await addDoc(collection(db, "chats", chatId, "messages"), msgData);
      
      // Update chat metadata for the list
      await updateDoc(doc(db, "chats", chatId), {
        lastMessage: text,
        lastMessageAt: serverTimestamp(),
      });

      setText("");
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, "messages");
    }
  };

  const getChatName = () => {
    if (!chatInfo) return "LOADING...";
    if (chatInfo.type === "group") return chatInfo.name;
    // For 1v1, name might need to be filtered (the other person's name)
    // For now we use the chat's stored name or a fallback
    return chatInfo.name || "SECURE CHANNEL";
  };

  return (
    <div className="flex h-full flex-col bg-[var(--bg-color)]">
      {/* Chat header */}
      <div className="flex items-center justify-between border-b border-[var(--primary-color)] p-4 bg-[var(--secondary-bg)]">
        <div className="flex items-center">
          <button
            onClick={() => navigate("/")}
            className="mr-4 hover:text-[var(--bg-color)] hover:bg-[var(--primary-color)] p-1"
          >
            <ArrowLeft size={20} />
          </button>
          <div className="flex items-center">
            <div className="mr-3 p-1.5 border border-[var(--primary-color)]">
              {chatInfo?.type === "group" ? <Users size={18} /> : <Phone size={18} />}
            </div>
            <div>
              <div className="font-bold uppercase tracking-tighter">
                {getChatName()}
              </div>
              <div className="text-[10px] opacity-70 uppercase">
                {chatInfo?.type === "group" 
                  ? `${chatInfo.members?.length || 0} NODES CONNECTED`
                  : "ENCRYPTED P2P LINK"}
              </div>
            </div>
          </div>
        </div>
        {chatInfo?.type !== "group" && (
          <button
            onClick={() => navigate(`/call/${chatId}`)}
            className="p-2 border border-[var(--primary-color)] hover:bg-[var(--primary-color)] hover:text-[var(--bg-color)]"
          >
            <Phone size={18} />
          </button>
        )}
      </div>

      {/* Message List */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-4 custom-scrollbar space-y-4"
      >
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full opacity-30 italic text-xs">
            [NO PRIOR LOGS DETECTED]
          </div>
        )}
        {messages.map((m) => {
          const isMe = m.senderId === user?.uid;
          return (
            <div
              key={m.id}
              className={`flex flex-col ${isMe ? "items-end" : "items-start"}`}
            >
              {!isMe && chatInfo?.type === "group" && (
                <span className="text-[10px] mb-1 opacity-70 font-bold">{m.senderName}</span>
              )}
              <div
                className={`max-w-[85%] p-3 border ${
                  isMe 
                    ? "border-[var(--primary-color)] bg-[var(--primary-color)] text-[var(--bg-color)] shadow-[0_0_10px_rgba(51,255,0,0.3)]" 
                    : "border-dashed border-[var(--primary-color)] bg-[var(--secondary-bg)] text-[var(--text-color)] opacity-90"
                }`}
              >
                <div className="text-sm font-mono whitespace-pre-wrap break-words">{m.text}</div>
              </div>
              <span className="text-[10px] mt-1 opacity-50 px-1">
                {m.createdAt ? format(m.createdAt.toDate(), "HH:mm") : "..."}
              </span>
            </div>
          );
        })}
      </div>

      {/* Input */}
      <form
        onSubmit={send}
        className="border-t border-[var(--primary-color)] p-4 flex gap-2"
      >
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="ENTER MESSAGE..."
          className="flex-1 bg-transparent border border-[var(--primary-color)] p-3 text-[var(--text-color)] outline-none focus:bg-[var(--secondary-bg)] placeholder:opacity-30 font-mono text-sm"
        />
        <button
          type="submit"
          className="p-3 border border-[var(--primary-color)] hover:bg-[var(--primary-color)] hover:text-[var(--bg-color)] transition-all"
        >
          <Send size={20} />
        </button>
      </form>
    </div>
  );
}
