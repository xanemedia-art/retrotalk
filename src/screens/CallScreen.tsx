import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { PhoneOff, Mic, MicOff } from "lucide-react";
import {
  doc,
  getDoc,
  collection,
  addDoc,
  onSnapshot,
  setDoc,
  updateDoc,
  serverTimestamp,
} from "firebase/firestore";
import { db, auth, handleFirestoreError, OperationType } from "../lib/firebase";
import { useStore } from "../lib/store";

const servers = {
  iceServers: [
    {
      urls: ["stun:stun1.l.google.com:19302", "stun:stun2.l.google.com:19302"],
    },
  ],
};

export default function CallScreen() {
  const { callId: chatId } = useParams(); 
  const { user } = useStore();
  const navigate = useNavigate();
  const [muted, setMuted] = useState(false);
  const [callStatus, setCallStatus] = useState("CONNECTING...");
  const [remoteUser, setRemoteUser] = useState<any>(null);
  const [otherUserId, setOtherUserId] = useState<string | null>(null);

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const peerConnection = useRef<RTCPeerConnection | null>(null);
  const localStream = useRef<MediaStream | null>(null);

  useEffect(() => {
    if (!chatId || !user) return;

    const callDoc = doc(db, "calls", chatId);
    let unsubCall: any = null;
    let unsubCandidates: any = null;

    const setup = async () => {
      setCallStatus("INITIALIZING SECURE CHANNEL...");

      let foundOtherId: string | null = null;
      try {
        const chatSnap = await getDoc(doc(db, "chats", chatId));
        if (!chatSnap.exists()) {
          setCallStatus("ERROR: SIGNALING CHANNEL NOT FOUND");
          return;
        }
        const chatData = chatSnap.data();
        foundOtherId = chatData.members.find((m: string) => m !== user.uid);
        
        if (!foundOtherId) {
          setCallStatus("ERROR: NO PEER DETECTED");
          return;
        }
        setOtherUserId(foundOtherId);

        // Fetch target user info
        getDoc(doc(db, "users", foundOtherId)).then((d) => {
          if (d.exists()) setRemoteUser(d.data());
        });

        const stream = await navigator.mediaDevices.getUserMedia({
          video: false,
          audio: true,
        });
        localStream.current = stream;
        // In this audio-only app, we don't need to show local video but keeping ref for consistency if needed
      } catch (err) {
        console.error("Mic access denied", err);
        setCallStatus("ERROR: HARDWARE ACCESS DENIED");
        return;
      }

      setCallStatus("NEGOTIATING HANDSHAKE...");
      const pc = new RTCPeerConnection(servers);
      peerConnection.current = pc;

      localStream.current!.getTracks().forEach((track) => {
        pc.addTrack(track, localStream.current!);
      });

      pc.ontrack = (event) => {
        const remoteAudio = new Audio();
        remoteAudio.srcObject = event.streams[0];
        remoteAudio.play();
      };

      const candidatesCollection = collection(callDoc, "candidates");
      pc.onicecandidate = async (event) => {
        if (event.candidate) {
          await addDoc(candidatesCollection, {
            candidate: event.candidate.candidate,
            sdpMid: event.candidate.sdpMid,
            sdpMLineIndex: event.candidate.sdpMLineIndex,
            senderId: user.uid,
          });
        }
      };

      const snapshot = await getDoc(callDoc);
      const data = snapshot.data();
      const isCaller =
        !snapshot.exists() ||
        data?.status === "ended" ||
        data?.status === "rejected" ||
        (data?.status === "calling" && data.callerId === user.uid);

      console.log("Call Role:", isCaller ? "CALLER" : "CALLEE");

      try {
        if (isCaller) {
          console.log("Generating Offer...");
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);

          console.log("Uploading Offer to Mainframe...");
          await setDoc(callDoc, {
            offer: { type: offer.type, sdp: offer.sdp },
            callerId: user.uid,
            callerName: profile?.username || "XANE_USER",
            calleeId: foundOtherId,
            status: "calling",
            updatedAt: serverTimestamp(),
          });

          setCallStatus("RINGING...");

          unsubCall = onSnapshot(callDoc, (docSnap) => {
            const docData = docSnap.data();
            if (!docData) return;
            console.log("Signal Status Update:", docData.status);
            
            if (
              docData.status === "answered" &&
              docData.answer &&
              pc.signalingState !== "stable"
            ) {
              console.log("Answer Received. Connecting...");
              pc.setRemoteDescription(new RTCSessionDescription(docData.answer))
                .then(() => setCallStatus("CONNECTED [SECURED]"))
                .catch(e => console.error("Remote desc error", e));
            }
            if (docData.status === "rejected") setCallStatus("CALL REJECTED");
            if (docData.status === "ended") {
              setCallStatus("ENDED");
              setTimeout(() => navigate(-1), 1500);
            }
          }, (err) => {
            console.error("Call Snapshot Error:", err);
            setCallStatus("ERROR: SIGNALING ACCESS DENIED");
          });
        } else {
          console.log("Incoming Call detected. Answering...");
          setCallStatus("ANSWERING...");
          if (data?.offer) {
            await pc.setRemoteDescription(new RTCSessionDescription(data.offer));
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);

            console.log("Uploading Answer...");
            await updateDoc(callDoc, {
              answer: { type: answer.type, sdp: answer.sdp },
              status: "answered",
              updatedAt: serverTimestamp(),
            });
            setCallStatus("CONNECTED [SECURED]");
          }

          unsubCall = onSnapshot(callDoc, (docSnap) => {
            const docData = docSnap.data();
            console.log("Signal Status Update (Callee):", docData?.status);
            if (docData?.status === "ended") {
              setCallStatus("ENDED");
              setTimeout(() => navigate(-1), 1500);
            }
          });
        }
      } catch (err) {
        console.error("Signaling Error:", err);
        setCallStatus("ERROR: SIGNALING FAILURE");
      }

      unsubCandidates = onSnapshot(candidatesCollection, (snap) => {
        snap.docChanges().forEach((change) => {
          if (change.type === "added") {
            const candData = change.doc.data();
            if (candData.senderId !== user.uid) {
              pc.addIceCandidate(new RTCIceCandidate(candData));
            }
          }
        });
      }, (err) => {
        console.error("Candidates Snapshot Error:", err);
      });
    };

    setup().catch(err => {
      console.error("FATAL SETUP ERROR:", err);
      setCallStatus("ERROR: SYSTEM FAILURE");
    });

    return () => {
      unsubCall && unsubCall();
      unsubCandidates && unsubCandidates();
      localStream.current?.getTracks().forEach((t) => t.stop());
      peerConnection.current?.close();
    };
  }, [chatId, user]);

  const toggleMute = () => {
    if (localStream.current) {
      localStream.current.getAudioTracks().forEach((t) => {
        t.enabled = !t.enabled;
      });
      setMuted(!localStream.current.getAudioTracks()[0].enabled);
    }
  };

  const endCall = async () => {
    if (!chatId || !user) return;
    const callDoc = doc(db, "calls", chatId);
    try {
      await updateDoc(callDoc, {
        status: "ended",
        updatedAt: serverTimestamp(),
      });
    } catch (e) {}
    navigate(-1);
  };

  return (
    <div className="flex h-screen flex-col items-center justify-center p-8 bg-black text-[var(--primary-color)]">
      <div className="w-full max-w-sm border-2 border-[var(--primary-color)] p-8 text-center flex flex-col items-center relative">
        <div className="absolute inset-0 border border-[var(--primary-color)] opacity-20 animate-ping rounded-full scale-110 -z-10"></div>

        <div className="mb-8 font-bold text-2xl uppercase tracking-widest">
          {remoteUser?.username || "UNKNOWN"}
        </div>

        <div className="mb-12 font-mono text-sm opacity-70 animate-pulse">
          [{callStatus}]
        </div>

        <div className="flex gap-8 mt-auto">
          <button
            onClick={toggleMute}
            className={`p-4 rounded-full border-2 border-[var(--primary-color)] ${muted ? "bg-[var(--primary-color)] text-black" : "hover:bg-[#111]"}`}
          >
            {muted ? <MicOff size={24} /> : <Mic size={24} />}
          </button>

          <button
            onClick={endCall}
            className="p-4 rounded-full border-2 border-red-500 text-red-500 hover:bg-red-500 hover:text-black"
          >
            <PhoneOff size={24} />
          </button>
        </div>
      </div>
    </div>
  );
}
