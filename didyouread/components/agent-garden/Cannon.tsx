"use client";

/**
 * The garden's delete target. Drag an agent into the muzzle, or press Remove and
 * watch the agent walk itself in. Either way the shot is what actually deletes it.
 */
export function Cannon({ armed, blastKey }: { armed: boolean; blastKey: number }) {
  return (
    <div
      aria-hidden="true"
      className={`relative transition-transform duration-200 ${armed ? "scale-110" : "scale-100"}`}
    >
      {/* Muzzle flash and smoke, replayed on every shot by keying off blastKey. */}
      {blastKey > 0 && (
        <div key={blastKey} className="pointer-events-none absolute left-[76px] top-[6px] z-20">
          <span className="absolute block size-14 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#ffd25e] mix-blend-screen [animation:cannonFlash_0.45s_ease-out_forwards]" />
          <span className="absolute block size-10 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#fff6d8]/90 [animation:cannonSmoke_0.9s_ease-out_forwards]" />
          <span className="absolute block size-8 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/70 [animation:cannonSmoke_1.1s_0.1s_ease-out_forwards]" />
        </div>
      )}

      <div key={`barrel-${blastKey}`} className={blastKey > 0 ? "[animation:cannonRecoil_0.5s_ease-out]" : ""}>
        <svg width="112" height="96" viewBox="0 0 112 96" className="overflow-visible drop-shadow-md">
          {/* wheel */}
          <circle cx="40" cy="74" r="17" fill="#6b4a2b" stroke="#2b1c0f" strokeWidth="3" />
          <circle cx="40" cy="74" r="5" fill="#d8b271" stroke="#2b1c0f" strokeWidth="2.5" />
          <path d="M40 57v34M23 74h34M28 62l24 24M52 62L28 86" stroke="#2b1c0f" strokeWidth="2.5" />
          {/* carriage */}
          <path d="M18 78 L30 52 L58 58 L48 82 Z" fill="#8a5a31" stroke="#2b1c0f" strokeWidth="3" strokeLinejoin="round" />
          {/* barrel, angled up and to the right */}
          <path
            d="M24 56 L74 12 L92 30 L44 76 Z"
            fill="#4b5563"
            stroke="#1f2630"
            strokeWidth="3.5"
            strokeLinejoin="round"
          />
          <path d="M31 49 L82 6 L96 20 L45 63 Z" fill="#6b7482" opacity="0.55" />
          {/* muzzle ring */}
          <ellipse cx="83" cy="21" rx="13" ry="10" transform="rotate(-42 83 21)" fill="#232a33" stroke="#1f2630" strokeWidth="3.5" />
          <ellipse cx="83" cy="21" rx="7.5" ry="5" transform="rotate(-42 83 21)" fill="#0d1117" />
          {/* breech cap */}
          <circle cx="27" cy="59" r="8" fill="#3b424c" stroke="#1f2630" strokeWidth="3" />
        </svg>
      </div>

      <span
        className={`pointer-events-none absolute -bottom-1 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-black shadow transition ${
          armed ? "bg-[#a43b32] text-white" : "bg-[#fffef9]/95 text-[#4a3524] ring-1 ring-[#c8b79f]"
        }`}
      >
        {armed ? "RELEASE TO FIRE!" : "Drop here to delete"}
      </span>
    </div>
  );
}
