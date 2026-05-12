import { initializeApp } from "firebase/app";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  RecaptchaVerifier,
  signInWithPhoneNumber,
  ConfirmationResult
} from "firebase/auth";
import { 
  getFirestore, 
  doc, 
  getDocFromServer, 
  setDoc, 
  getDocs, 
  collection, 
  query, 
  where, 
  limit,
  addDoc,
  serverTimestamp 
} from "firebase/firestore";
import firebaseConfigLocal from "../../firebase-applet-config.json";

const firebaseConfig = {
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || firebaseConfigLocal.projectId,
  appId: import.meta.env.VITE_FIREBASE_APP_ID || firebaseConfigLocal.appId,
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || firebaseConfigLocal.apiKey,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || firebaseConfigLocal.authDomain,
  firestoreDatabaseId: import.meta.env.VITE_FIREBASE_FIRESTORE_DB_ID || firebaseConfigLocal.firestoreDatabaseId,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || firebaseConfigLocal.storageBucket,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || firebaseConfigLocal.messagingSenderId,
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);

export const loginWithGoogle = async () => {
  const provider = new GoogleAuthProvider();
  return signInWithPopup(auth, provider);
};

export const setupRecaptcha = (containerId: string) => {
  return new RecaptchaVerifier(auth, containerId, {
    size: "invisible",
  });
};

export const loginWithPhone = async (phoneNumber: string, appVerifier: RecaptchaVerifier) => {
  return signInWithPhoneNumber(auth, phoneNumber, appVerifier);
};

export const logout = () => signOut(auth);

export enum OperationType {
  CREATE = "create",
  UPDATE = "update",
  DELETE = "delete",
  LIST = "list",
  GET = "get",
  WRITE = "write",
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null,
) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error("Firestore Error: ", JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export async function searchUsers(searchTerm: string) {
  const usersRef = collection(db, "users");
  const q = query(
    usersRef,
    where("email", "==", searchTerm),
    limit(1)
  );
  
  const querySnapshot = await getDocs(q);
  if (!querySnapshot.empty) {
    return querySnapshot.docs[0].data();
  }
  
  // Also try searching by username if email search fails
  const q2 = query(
    usersRef,
    where("usernameLower", "==", searchTerm.toLowerCase()),
    limit(1)
  );
  const querySnapshot2 = await getDocs(q2);
  if (!querySnapshot2.empty) {
    return querySnapshot2.docs[0].data();
  }

  // Finally try phone number
  const q3 = query(
    usersRef,
    where("phoneNumber", "==", searchTerm),
    limit(1)
  );
  const querySnapshot3 = await getDocs(q3);
  if (!querySnapshot3.empty) {
    return querySnapshot3.docs[0].data();
  }
  
  return null;
}

export async function addContact(currentUserUid: string, contactData: any) {
  const contactRef = doc(db, "users", currentUserUid, "contacts", contactData.uid);
  await setDoc(contactRef, {
    ...contactData,
    addedAt: Date.now()
  });
}

export async function createGroupChat(name: string, members: string[]) {
  const chatRef = await addDoc(collection(db, "chats"), {
    name,
    members,
    type: "group",
    createdAt: serverTimestamp(),
    lastMessage: "",
    lastMessageAt: serverTimestamp(),
  });
  return chatRef.id;
}

export async function getOrCreate1v1Chat(userA: any, userB: any) {
  const members = [userA.uid, userB.uid].sort();
  const q = query(
    collection(db, "chats"),
    where("members", "==", members),
    where("type", "==", "private"),
    limit(1)
  );
  
  const snap = await getDocs(q);
  if (!snap.empty) return snap.docs[0].id;
  
  const chatRef = await addDoc(collection(db, "chats"), {
    name: `${userB.username}`, // Usually you'd store both but keep it simple
    members,
    type: "private",
    createdAt: serverTimestamp(),
    lastMessage: "",
    lastMessageAt: serverTimestamp(),
  });
  return chatRef.id;
}
