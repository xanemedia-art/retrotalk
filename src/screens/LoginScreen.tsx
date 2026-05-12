import { useState, useEffect } from "react";
import { loginWithGoogle, setupRecaptcha, loginWithPhone } from "../lib/firebase";
import { Terminal, ShieldAlert, Phone, Key, Chrome, Globe } from "lucide-react";
import { ConfirmationResult } from "firebase/auth";
import { 
  AsYouType, 
  getCountryCallingCode, 
  CountryCode, 
  parsePhoneNumberFromString 
} from "libphonenumber-js";

const COMMON_COUNTRIES: { code: CountryCode; name: string }[] = [
  { code: "US", name: "USA" },
  { code: "GB", name: "UK" },
  { code: "IN", name: "INDIA" },
  { code: "CA", name: "CANADA" },
  { code: "AU", name: "AUSTRALIA" },
  { code: "DE", name: "GERMANY" },
  { code: "FR", name: "FRANCE" },
  { code: "JP", name: "JAPAN" },
  { code: "BR", name: "BRAZIL" },
  { code: "AE", name: "UAE" },
];

export default function LoginScreen() {
  const [loading, setLoading] = useState(false);
  const [phone, setPhone] = useState("");
  const [countryCode, setCountryCode] = useState<CountryCode>("US");
  const [otp, setOtp] = useState("");
  const [step, setStep] = useState<"phone" | "otp">("phone");
  const [confirmationResult, setConfirmationResult] = useState<ConfirmationResult | null>(null);
  const [error, setError] = useState("");

  const handlePhoneChange = (value: string) => {
    // Auto-format using AsYouType
    const formatter = new AsYouType(countryCode);
    setPhone(formatter.input(value));
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError("");
    try {
      await loginWithGoogle();
    } catch (e: any) {
      console.error(e);
      setError(e.message || "GOOGLE AUTHENTICATION FAILED.");
      setLoading(false);
    }
  };

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate and format to E.164
    const phoneNumber = parsePhoneNumberFromString(phone, countryCode);
    if (!phoneNumber || !phoneNumber.isValid()) {
      setError("INVALID SIGNAL FORMAT. VERIFY NUMBER.");
      return;
    }

    const fullPhone = phoneNumber.number; // e.g. +1555...
    
    setLoading(true);
    setError("");
    try {
      const appVerifier = setupRecaptcha("recaptcha-container");
      const result = await loginWithPhone(fullPhone, appVerifier);
      setConfirmationResult(result);
      setStep("otp");
    } catch (e: any) {
      console.error(e);
      setError("FAILED TO SEND SIGNAL. ACCESS BLOCKED.");
      const container = document.getElementById("recaptcha-container");
      if (container) container.innerHTML = "";
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otp.trim() || !confirmationResult) return;

    setLoading(true);
    setError("");
    try {
      await confirmationResult.confirm(otp);
    } catch (e: any) {
      console.error(e);
      setError("INVALID CLEARANCE CODE. ACCESS DENIED.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4">
      <div id="recaptcha-container"></div>
      
      <div className="w-full max-w-md border-2 border-[var(--primary-color)] p-8 shadow-[0_0_15px_var(--primary-color)] bg-[var(--bg-color)]">
        <div className="mb-8 flex flex-col items-center justify-center">
          <Terminal size={64} className="mb-4 animate-pulse" />
          <h1 className="text-4xl font-bold tracking-widest text-center">
            RETROTALK
          </h1>
          <p className="mt-2 text-xs opacity-70 text-center uppercase">
            v1.2.0 GLOBAL MAINFRAME
          </p>
        </div>

        <div className="mb-8 border border-[var(--primary-color)] border-opacity-50 p-4 bg-[var(--primary-color)] bg-opacity-5">
          <div className="flex items-start mb-2 text-sm">
            <ShieldAlert size={16} className="mr-2 mt-0.5 shrink-0" />
            <span className="font-mono text-xs">
              {step === "phone" 
                ? "SELECT REGION AND INPUT IDENTIFICATION NUMBER"
                : "INPUT 6-DIGIT CLEARANCE CODE SENT TO TERMINAL"}
            </span>
          </div>
        </div>

        {step === "phone" ? (
          <form onSubmit={handleSendOtp} className="space-y-4">
            <div className="flex gap-2">
              <div className="relative w-1/3">
                <Globe size={14} className="absolute left-2 top-1/2 -translate-y-1/2 opacity-50" />
                <select
                  className="w-full bg-[var(--bg-color)] border-2 border-[var(--primary-color)] p-3 pl-8 focus:outline-none text-xs font-mono appearance-none"
                  value={countryCode}
                  onChange={(e) => {
                    setCountryCode(e.target.value as CountryCode);
                    setPhone(""); // Clear phone on country change to avoid formatting mixups
                  }}
                >
                  {COMMON_COUNTRIES.map(c => (
                    <option key={c.code} value={c.code}>
                      {c.code} (+{getCountryCallingCode(c.code)})
                    </option>
                  ))}
                </select>
              </div>
              <div className="relative flex-1">
                <Phone size={16} className="absolute left-3 top-1/2 -translate-y-1/2 opacity-50" />
                <input
                  type="tel"
                  placeholder="ID NUMBER"
                  className="w-full bg-transparent border-2 border-[var(--primary-color)] p-3 pl-10 focus:outline-none focus:shadow-[0_0_10px_var(--primary-color)] placeholder:opacity-30 font-mono text-sm"
                  value={phone}
                  onChange={(e) => handlePhoneChange(e.target.value)}
                  disabled={loading}
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={loading || !phone}
              className="w-full border-2 border-[var(--primary-color)] bg-transparent p-4 font-bold uppercase transition-all hover:bg-[var(--primary-color)] hover:text-[var(--bg-color)] disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? "TRANSMITTING..." : "SEND SIGNAL"}
            </button>
          </form>
        ) : (
          <form onSubmit={handleVerifyOtp} className="space-y-4">
            <div className="relative">
              <Key size={18} className="absolute left-3 top-1/2 -translate-y-1/2 opacity-50" />
              <input
                type="text"
                placeholder="XXXXXX"
                maxLength={6}
                className="w-full bg-transparent border-2 border-[var(--primary-color)] p-4 pl-12 tracking-[1em] text-center focus:outline-none focus:shadow-[0_0_10px_var(--primary-color)] placeholder:opacity-30 font-mono"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                disabled={loading}
              />
            </div>
            <button
              type="submit"
              disabled={loading || otp.length !== 6}
              className="w-full border-2 border-[var(--primary-color)] bg-transparent p-4 font-bold uppercase transition-all hover:bg-[var(--primary-color)] hover:text-[var(--bg-color)] disabled:opacity-50"
            >
              {loading ? "VERIFYING..." : "INITIALIZE LOGIN"}
            </button>
            <button
              type="button"
              onClick={() => setStep("phone")}
              className="w-full text-xs opacity-50 hover:opacity-100 uppercase underline"
            >
              BACK TO IDENTIFICATION
            </button>
          </form>
        )}

        {error && (
          <div className="mt-4 p-2 border border-red-500 text-red-500 text-[10px] text-center animate-pulse uppercase">
            {error}
          </div>
        )}

        <div className="relative my-8">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-[var(--primary-color)] opacity-30"></div>
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-[var(--bg-color)] px-2 opacity-50">OR ALTERNATE PROTOCOL</span>
          </div>
        </div>

        <button
          onClick={handleGoogleLogin}
          disabled={loading}
          className="w-full border border-[var(--primary-color)] border-opacity-50 bg-transparent p-3 text-xs font-bold uppercase transition-all hover:bg-[var(--primary-color)] hover:text-[var(--bg-color)] disabled:opacity-50 flex items-center justify-center gap-2"
        >
          <Chrome size={14} /> LOGIN VIA GOOGLE SUBSYSTEM
        </button>
      </div>
    </div>
  );
}
