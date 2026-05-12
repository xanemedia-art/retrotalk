import { useEffect, useState } from "react";

export default function BootScreen() {
  const [lines, setLines] = useState<string[]>([]);

  useEffect(() => {
    const bootSequence = [
      "BIOS Date 09/20/95 14:22:10 Ver 4.02",
      "CPU: Intel Pentium Processor 133MHz",
      "Memory Test : 32768K OK",
      "Award Plug and Play BIOS Extension v1.0A",
      "Initialize Plug and Play Cards...",
      "PNP Init Completed",
      "Detecting IDE Primary Master ... XANE Text OS",
      "Starting XANE Text Services...",
      "Establishing secure connection to mainframe...",
    ];

    let current = 0;
    const interval = setInterval(() => {
      if (current < bootSequence.length) {
        setLines((prev) => [...prev, bootSequence[current]]);
        current++;
      } else {
        clearInterval(interval);
      }
    }, 200);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen p-8 text-sm sm:text-base md:text-lg uppercase">
      {lines.map((line, i) => (
        <div key={i} className="mb-2">
          <span className="opacity-70 mr-4">{`>`}</span> {line}
        </div>
      ))}
      <div className="mt-4 flicker-text">_</div>
    </div>
  );
}
