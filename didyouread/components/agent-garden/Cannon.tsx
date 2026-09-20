"use client";

/**
 * The garden's delete target. Drag an agent into the muzzle, or press Remove and
 * watch the agent walk itself in. Either way the shot is what actually deletes it.
 */
export function Cannon({ armed, blastKey, kicked = false }: { armed: boolean; blastKey: number; kicked?: boolean }) {
  return (
    <div
      aria-hidden="true"
      className={`relative transition-transform duration-200 ${armed ? "scale-110" : "scale-100"} ${
        kicked ? "[animation:cannonKicked_0.9s_cubic-bezier(0.3,0.1,0.6,1)_forwards]" : ""
      }`}
    >
      {/* Muzzle flash and smoke, replayed on every shot by keying off blastKey. */}
      {blastKey > 0 && (
        <div key={blastKey} className="pointer-events-none absolute left-[84px] top-[20px] z-20">
          <span className="absolute block size-14 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#ffd25e] mix-blend-screen [animation:cannonFlash_0.45s_ease-out_forwards]" />
          <span className="absolute block size-10 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#fff6d8]/90 [animation:cannonSmoke_0.9s_ease-out_forwards]" />
          <span className="absolute block size-8 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/70 [animation:cannonSmoke_1.1s_0.1s_ease-out_forwards]" />
        </div>
      )}

      <div key={`barrel-${blastKey}`} className={blastKey > 0 ? "[animation:cannonRecoil_0.5s_ease-out]" : ""}>
        <svg width="112" height="96" viewBox="0 0 112 96" className="overflow-visible drop-shadow-md">
          {/* 포가 (받침대) — 뒤쪽 */}
          <path d="M20 86 L34 58 L60 66 L48 90 Z" fill="#8a5a31" stroke="#2b1c0f" strokeWidth="3" strokeLinejoin="round" />

          {/* 포신 — 뒤쪽(27,59)에서 포구(84,20)까지, 반지름 11 */}
          <path
            d="M20.8 49.9 L77.8 10.9 L90.2 29.1 L33.2 68.1 Z"
            fill="#4b5563"
            stroke="#1f2630"
            strokeWidth="3.5"
            strokeLinejoin="round"
          />
          {/* 포신 윗면 하이라이트 (포신 안쪽으로만) */}
          <path d="M22.8 52.8 L79.8 13.8 L82.3 17.5 L25.3 56.5 Z" fill="#6b7482" opacity="0.5" />

          {/* 폐쇄기 (뒤쪽 둥근 마감) */}
          <circle cx="24" cy="61" r="11" fill="#4b5563" stroke="#1f2630" strokeWidth="3.5" />
          <circle cx="17" cy="66" r="4" fill="#3b424c" stroke="#1f2630" strokeWidth="2.5" />

          {/* 포구 — 포신 단면과 같은 축(55.6°)으로 눕혀 테두리와 딱 맞춤 */}
          <ellipse
            cx="84"
            cy="20"
            rx="11"
            ry="4.6"
            transform="rotate(55.6 84 20)"
            fill="#3b424c"
            stroke="#1f2630"
            strokeWidth="3.5"
          />
          <ellipse cx="84" cy="20" rx="6.8" ry="2.6" transform="rotate(55.6 84 20)" fill="#0d1117" />

          {/* 바퀴 — 포가 바깥쪽에 달리므로 맨 앞에 그린다 */}
          <circle cx="33" cy="78" r="15" fill="#6b4a2b" stroke="#2b1c0f" strokeWidth="3" />
          <path d="M33 63v30M18 78h30M22.4 67.4l21.2 21.2M43.6 67.4L22.4 88.6" stroke="#2b1c0f" strokeWidth="2.5" />
          <circle cx="33" cy="78" r="4.5" fill="#d8b271" stroke="#2b1c0f" strokeWidth="2.5" />
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
