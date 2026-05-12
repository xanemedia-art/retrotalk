import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { collection, onSnapshot, query } from "firebase/firestore";
import { db, createGroupChat, handleFirestoreError, OperationType } from "../lib/firebase";
import { useStore } from "../lib/store";
import { Users, User, Check, ArrowLeft, Send } from "lucide-react";

export default function CreateGroupScreen() {
  const navigate = useNavigate();
  const { user } = useStore();
  const [contacts, setContacts] = useState<any[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [groupName, setGroupName] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, "users", user.uid, "contacts"));
    const unsub = onSnapshot(q, (snap) => {
      setContacts(snap.docs.map(d => d.data()));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, "contacts");
    });
    return unsub;
  }, [user]);

  const toggleUser = (uid: string) => {
    if (selectedUsers.includes(uid)) {
      setSelectedUsers(selectedUsers.filter(id => id !== uid));
    } else {
      setSelectedUsers([...selectedUsers, uid]);
    }
  };

  const handleCreateGroup = async () => {
    if (!groupName.trim() || selectedUsers.length === 0 || !user) return;
    
    setLoading(true);
    try {
      const members = [user.uid, ...selectedUsers];
      const chatId = await createGroupChat(groupName, members);
      navigate(`/chat/${chatId}`);
    } catch (error) {
      console.error(error);
      setLoading(false);
    }
  };

  return (
    <div className="flex h-full flex-col p-4 bg-[var(--bg-color)] overflow-y-auto custom-scrollbar">
      <div className="flex items-center mb-6">
        <button onClick={() => navigate(-1)} className="mr-4 hover:bg-[var(--primary-color)] hover:text-[var(--bg-color)] p-1">
          <ArrowLeft size={20} />
        </button>
        <h2 className="text-xl font-bold uppercase underline">CREATE NEW BROADCAST</h2>
      </div>

      <div className="space-y-6">
        {/* Group Name Input */}
        <div className="space-y-2">
          <label className="text-xs opacity-70 uppercase font-mono">CHANNEL_DESIGNATION:</label>
          <input
            type="text"
            placeholder="ENTER GROUP NAME..."
            className="w-full bg-transparent border-2 border-[var(--primary-color)] p-3 focus:outline-none focus:shadow-[0_0_10px_var(--primary-color)] placeholder:opacity-30 font-mono"
            value={groupName}
            onChange={(e) => setGroupName(e.target.value)}
          />
        </div>

        {/* User Selection */}
        <div className="space-y-2">
          <label className="text-xs opacity-70 uppercase font-mono">SELECT_PARTICIPANTS ({selectedUsers.length}):</label>
          {contacts.length === 0 ? (
            <p className="text-xs opacity-50 italic">NO CONTACTS DETECTED. ADD FRIENDS FIRST.</p>
          ) : (
            <div className="space-y-2">
              {contacts.map((u) => (
                <div
                  key={u.uid}
                  onClick={() => toggleUser(u.uid)}
                  className={`border p-3 flex items-center justify-between cursor-pointer transition-colors ${
                    selectedUsers.includes(u.uid)
                      ? "border-[var(--primary-color)] bg-[var(--primary-color)] text-[var(--bg-color)]"
                      : "border-[var(--primary-color)] border-opacity-30 hover:border-opacity-100"
                  }`}
                >
                  <div className="flex items-center">
                    <User size={18} className="mr-3" />
                    <span className="font-bold text-sm uppercase">{u.username}</span>
                  </div>
                  {selectedUsers.includes(u.uid) && <Check size={18} />}
                </div>
              ))}
            </div>
          )}
        </div>

        <button
          onClick={handleCreateGroup}
          disabled={loading || !groupName.trim() || selectedUsers.length === 0}
          className="w-full border-2 border-[var(--primary-color)] p-4 font-bold uppercase hover:bg-[var(--primary-color)] hover:text-[var(--bg-color)] transition-all disabled:opacity-30 flex items-center justify-center gap-2"
        >
          {loading ? "INITIALIZING..." : <><Send size={20} /> INITIALIZE BROADCAST</>}
        </button>
      </div>
    </div>
  );
}
