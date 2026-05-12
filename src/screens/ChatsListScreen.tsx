import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { MessageSquareDashed, User, Users, Plus } from "lucide-react";
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  orderBy,
  limit,
  getDoc,
  doc
} from "firebase/firestore";
import { db, handleFirestoreError, OperationType } from "../lib/firebase";
import { useStore } from "../lib/store";
import { format } from "date-fns";

export default function ChatsListScreen() {
  const navigate = useNavigate();
  const { user } = useStore();
  const [chats, setChats] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    // Fetch chats where the user is a member
    const q = query(
      collection(db, "chats"),
      where("members", "array-contains", user.uid),
      orderBy("lastMessageAt", "desc"),
      limit(20)
    );

    try {
      const unsub = onSnapshot(
        q,
        (snap) => {
          const c = snap.docs.map(d => ({ id: d.id, ...d.data() }));
          setChats(c);
          setLoading(false);
        },
        (error) => {
          handleFirestoreError(error, OperationType.LIST, "chats");
        }
      );
      return unsub;
    } catch (err) {
      handleFirestoreError(err, OperationType.LIST, "chats");
    }
  }, [user]);

  const [userMap, setUserMap] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!user || chats.length === 0) return;

    const missingUids = new Set<string>();
    chats.forEach(chat => {
      if (chat.type === "private") {
        const otherId = chat.members.find((m: string) => m !== user.uid);
        if (otherId && !chat.memberDetails?.[otherId] && !userMap[otherId]) {
          missingUids.add(otherId);
        }
      }
    });

    if (missingUids.size > 0) {
      const fetchProfiles = async () => {
        const newMap = { ...userMap };
        for (const uid of missingUids) {
          const docSnap = await getDoc(doc(db, "users", uid));
          if (docSnap.exists()) {
            newMap[uid] = docSnap.data().username;
          }
        }
        setUserMap(newMap);
      };
      fetchProfiles();
    }
  }, [chats, user, userMap]);

  return (
    <div className="flex h-full flex-col p-4 overflow-y-auto custom-scrollbar">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold uppercase underline tracking-tighter">
          RECENT SIGNALS
        </h2>
        <div className="flex gap-2">
          <button
            onClick={() => navigate("/create-group")}
            className="p-2 border border-[var(--primary-color)] hover:bg-[var(--primary-color)] hover:text-[var(--bg-color)] transition-colors"
            title="CREATE GROUP BROADCAST"
          >
            <Users size={20} />
          </button>
          <button
            onClick={() => navigate("/contacts")}
            className="p-2 border border-[var(--primary-color)] hover:bg-[var(--primary-color)] hover:text-[var(--bg-color)] transition-colors"
            title="INITIATE NEW LINK"
          >
            <Plus size={20} />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center p-12 opacity-50">
          <p className="animate-pulse font-mono text-xs">SYNCHRONIZING WITH SATELLITE...</p>
        </div>
      ) : chats.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-8 mt-10 border border-[var(--primary-color)] border-dashed opacity-70 group hover:opacity-100 transition-opacity">
          <MessageSquareDashed size={48} className="mb-4 animate-pulse group-hover:animate-none" />
          <p className="mb-6 text-center text-sm">NO ACTIVE FREQUENCIES DETECTED.</p>
          <button
            onClick={() => navigate("/contacts")}
            className="p-3 border border-[var(--primary-color)] hover:bg-[var(--primary-color)] hover:text-[var(--bg-color)] font-bold uppercase transition-colors"
          >
            OPEN DIRECTORY
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {chats.map((chat) => (
            <div
              key={chat.id}
              onClick={() => navigate(`/chat/${chat.id}`)}
              className="border border-[var(--primary-color)] p-4 flex justify-between items-center bg-[var(--secondary-bg)] hover:bg-[var(--primary-color)] hover:text-[var(--bg-color)] cursor-pointer transition-colors group"
            >
              <div className="flex items-center overflow-hidden">
                <div className="mr-4 p-2 border border-[var(--primary-color)] group-hover:border-[var(--bg-color)]">
                  {chat.type === "group" ? <Users size={20} /> : <User size={20} />}
                </div>
                <div className="overflow-hidden">
                  <div className="font-bold uppercase truncate">
                    {(() => {
                      if (chat.type === "group") return chat.name;
                      const otherId = chat.members.find((m: string) => m !== user.uid);
                      return chat.memberDetails?.[otherId]?.username || userMap[otherId] || "SECURE_CHANNEL_" + chat.id.substring(0, 4);
                    })()}
                  </div>
                  <div className="text-xs opacity-70 group-hover:opacity-100 truncate italic">
                    {chat.lastMessage || "STATION_IDLE"}
                  </div>
                </div>
              </div>
              <div className="text-[10px] opacity-50 shrink-0 ml-4 font-mono">
                {chat.lastMessageAt ? format(chat.lastMessageAt.toDate(), "HH:mm") : ""}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
