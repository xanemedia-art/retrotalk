import { useState, useEffect } from "react";
import {
  collection,
  query,
  onSnapshot,
} from "firebase/firestore";
import { db, handleFirestoreError, OperationType, searchUsers, addContact, getOrCreate1v1Chat } from "../lib/firebase";
import { useStore } from "../lib/store";
import { User, Phone, Search, UserPlus, X, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function ContactsScreen() {
  const [contacts, setContacts] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResult, setSearchResult] = useState<any | null>(null);
  const [searching, setSearching] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState("");
  const { user, profile } = useStore();
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) return;
    // Query the user's private contacts sub-collection
    const q = query(collection(db, "users", user.uid, "contacts"));
    try {
      const unsub = onSnapshot(
        q,
        (snap) => {
          const c: any[] = [];
          snap.forEach((d) => {
            c.push(d.data());
          });
          setContacts(c);
        },
        (error) => {
          handleFirestoreError(error, OperationType.LIST, `users/${user.uid}/contacts`);
        },
      );
      return unsub;
    } catch (err) {
      handleFirestoreError(err, OperationType.LIST, `users/${user.uid}/contacts`);
    }
  }, [user]);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchTerm.trim()) return;
    
    setSearching(true);
    setError("");
    setSearchResult(null);
    
    try {
      const result = await searchUsers(searchTerm);
      if (result) {
        if (result.uid === user?.uid) {
          setError("YOU CANNOT ADD YOURSELF TO THE DIRECTORY.");
        } else {
          setSearchResult(result);
        }
      } else {
        setError("NO MATCHING SIGNALS FOUND IN GLOBAL REGISTRY.");
      }
    } catch (err) {
      setError("SEARCH INTERRUPTED. SYSTEM ERROR.");
    } finally {
      setSearching(false);
    }
  };

  const handleAddContact = async () => {
    if (!user || !searchResult) return;
    try {
      await addContact(user.uid, searchResult);
      setSearchResult(null);
      setSearchTerm("");
    } catch (err) {
      setError("FAILED TO SECURE CONTACT IN REGISTRY.");
    }
  };

  const startChat = async (otherUser: any) => {
    if (!user || !profile) return;
    setActionLoading(true);
    try {
      const chatId = await getOrCreate1v1Chat(profile, otherUser);
      navigate(`/chat/${chatId}`);
    } catch (err) {
      setError("FAILED TO INITIALIZE P2P LINK.");
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="flex h-full flex-col p-4 overflow-y-auto custom-scrollbar relative">
      {actionLoading && (
        <div className="absolute inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center">
          <Loader2 className="animate-spin text-[var(--primary-color)]" size={48} />
        </div>
      )}
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold uppercase underline">
          ACTIVE DIRECTORY
        </h2>
      </div>

      {/* Search Section */}
      <form onSubmit={handleSearch} className="mb-6">
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="ENTER UNIQUE ID..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="flex-1 bg-black border border-[var(--primary-color)] p-4 font-mono text-[var(--primary-color)] focus:outline-none focus:ring-1 focus:ring-[var(--primary-color)]"
          />
          <button
            type="submit"
            disabled={searching}
            className="p-4 border border-[var(--primary-color)] hover:bg-[var(--primary-color)] hover:text-[var(--bg-color)] disabled:opacity-50 transition-colors"
          >
            {searching ? <Loader2 className="animate-spin" /> : <Search size={20} />}
          </button>
        </div>
        {error && <p className="text-red-500 text-xs mt-2 animate-pulse">{error}</p>}
      </form>

      {/* Search Result Overlay/Box */}
      {searchResult && (
        <div 
          className="mb-6 border-2 border-dashed border-[var(--primary-color)] p-4"
          style={{ backgroundColor: 'rgba(51, 255, 0, 0.05)' }}
        >
          <div className="flex justify-between items-start mb-2">
            <span className="text-xs font-bold uppercase">[RESULT FOUND]</span>
            <button onClick={() => setSearchResult(null)} className="hover:text-red-500">
              <X size={16} />
            </button>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <div className="w-10 h-10 border border-[var(--primary-color)] flex items-center justify-center mr-3">
                <User size={20} />
              </div>
              <div>
                <div className="font-bold">{searchResult.username}</div>
                <div className="text-xs opacity-70">{searchResult.email}</div>
              </div>
            </div>
            <button
              onClick={handleAddContact}
              className="flex items-center gap-2 border border-[var(--primary-color)] px-3 py-1 text-sm hover:bg-[var(--primary-color)] hover:text-[var(--bg-color)]"
            >
              <UserPlus size={16} /> ADD
            </button>
          </div>
        </div>
      )}

      {/* Contacts List */}
      <div className="space-y-4">
        {contacts.length === 0 && !searchResult && (
          <p className="opacity-70 italic text-center p-8 border border-dashed border-[var(--primary-color)] border-opacity-30">
            YOUR DIRECTORY IS EMPTY. INITIATE SEARCH TO ADD CONTACTS.
          </p>
        )}
        <ul className="space-y-4">
          {contacts.map((u) => (
            <li
              key={u.uid}
              className="border border-[var(--primary-color)] p-4 flex justify-between items-center bg-[var(--secondary-bg)] hover:bg-[var(--primary-color)] hover:text-[var(--bg-color)] cursor-pointer transition-colors group"
              onClick={() => startChat(u)}
            >
              <div className="flex items-center">
                <User size={24} className="mr-4" />
                <div>
                  <div className="font-bold">{u.username}</div>
                  <div className="text-xs opacity-70 group-hover:opacity-100 uppercase">
                    {u.status || "offline"}
                  </div>
                </div>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  navigate(`/call/${u.uid}`);
                }}
                className="p-2 border border-[var(--primary-color)] group-hover:border-[var(--bg-color)] hover:animate-pulse"
                title="Initialize Voice Protocol"
              >
                <Phone size={16} />
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
