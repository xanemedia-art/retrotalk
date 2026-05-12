import { useStore, Theme } from "../lib/store";
import { Monitor, Volume2, Power } from "lucide-react";
import { logout } from "../lib/firebase";

export default function SettingsScreen() {
  const {
    theme,
    setTheme,
    crtEnabled,
    toggleCrt,
    soundEnabled,
    toggleSound,
    profile,
  } = useStore();

  const themes: { id: Theme; name: string }[] = [
    { id: "terminal", name: "Green Terminal" },
    { id: "amber", name: "Amber DOS" },
    { id: "win98", name: "OS/98 Blue" },
    { id: "cyber", name: "Cyber Neon" },
    { id: "cassette", name: "Cassette Black" },
  ];

  return (
    <div className="flex h-full flex-col p-4 overflow-y-auto custom-scrollbar">
      <h2 className="mb-6 text-xl font-bold uppercase underline">
        SYSTEM CONFIGURATION
      </h2>

      <div className="mb-8 border border-[var(--primary-color)] p-4">
        <h3 className="mb-4 font-bold border-b border-[var(--primary-color)] pb-2 flex items-center">
          <Monitor size={18} className="mr-2" /> DISPLAY
        </h3>

        <div className="mb-4">
          <div className="mb-2 text-sm opacity-70">COLOR PALETTE:</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {themes.map((t) => (
              <button
                key={t.id}
                onClick={() => setTheme(t.id)}
                className={`p-2 border border-[var(--primary-color)] text-left ${theme === t.id ? "bg-[var(--primary-color)] text-[var(--bg-color)] font-bold" : "hover:bg-[var(--secondary-bg)]"}`}
              >
                [{theme === t.id ? "X" : " "}] {t.name}
              </button>
            ))}
          </div>
        </div>

        <div>
          <button
            onClick={toggleCrt}
            className="flex w-full items-center justify-between p-3 border border-[var(--primary-color)] hover:bg-[var(--secondary-bg)]"
          >
            <span>CRT OVERLAY / SCANLINES</span>
            <span>{crtEnabled ? "[ENABLED]" : "[DISABLED]"}</span>
          </button>
        </div>
      </div>

      <div className="mb-8 border border-[var(--primary-color)] p-4">
        <h3 className="mb-4 font-bold border-b border-[var(--primary-color)] pb-2 flex items-center">
          <Volume2 size={18} className="mr-2" /> AUDIO
        </h3>
        <button
          onClick={toggleSound}
          className="flex w-full items-center justify-between p-3 border border-[var(--primary-color)] hover:bg-[var(--secondary-bg)]"
        >
          <span>SYSTEM SOUND EFFECTS</span>
          <span>{soundEnabled ? "[ON]" : "[OFF]"}</span>
        </button>
      </div>

      <div className="mt-auto">
        <button
          onClick={logout}
          className="flex w-full items-center justify-center p-4 border-2 border-red-500 text-red-500 font-bold hover:bg-red-500 hover:text-black transition-colors"
        >
          <Power size={20} className="mr-2" />
          INITIATE SYSTEM SHUTDOWN
        </button>
      </div>
    </div>
  );
}
