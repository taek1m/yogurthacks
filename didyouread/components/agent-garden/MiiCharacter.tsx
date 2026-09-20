"use client";

import React, { useEffect, useState } from "react";

// 서류 종류별 셔츠 색
const SHIRT_COLORS: Record<string, string> = {
  auto_insurance: "#316094",
  renters_insurance: "#5b5192",
  apartment_lease: "#e66025",
  school_payment: "#7a5c12",
  bank: "#2b7352",
  general: "#44783e",
};

interface MiiCharacterProps {
  isHeld: boolean;       // 길게 눌려 장갑에 잡혀있는 상태 (pressing 또는 dragging)
  docType?: string;      // 셔츠 색상 커스터마이징용
  isWalking?: boolean;   // 실제로 걸어가는 중인지 (멈추면 다리도 멈춤)
  isCrying?: boolean;    // 대포로 끌려갈 때 우는 표정
  isResting?: boolean;   // 일시정지 → 바닥에 앉아서 쉬는 자세
  hasWings?: boolean;    // 사이드바에서 선택되어 날아오르는 중
  flipped?: boolean;     // 왼쪽을 볼 때 부모가 좌우 반전 → 글자/말풍선만 되돌림
}

export function MiiCharacter({ isHeld, docType, isWalking = true, isCrying = false, isResting = false, hasWings = false, flipped = false }: MiiCharacterProps) {
const [step, setStep] = useState(0);

  // 평상시 걸어다니는 다리 교차 애니메이션 타이머
  useEffect(() => {
    if (isHeld || !isWalking) return;
    const interval = setInterval(() => {
      setStep((s) => (s + 1) % 4);
    }, 220);
    return () => clearInterval(interval);
  }, [isHeld, isWalking]);

  const shirtColor = SHIRT_COLORS[docType ?? "general"] ?? SHIRT_COLORS.general;

  const striding = !isHeld && isWalking && !isResting;
  const legLeftAngle = striding
    ? step === 1 ? 16 : step === 3 ? -16 : 0
    : 0;
  const legRightAngle = striding
    ? step === 1 ? -16 : step === 3 ? 16 : 0
    : 0;

  return (
    <div className="relative flex flex-col items-center select-none pointer-events-none">
      {/* 1. 잡혔을 때 머리 위에 뜨는 말풍선 */}
      {isHeld && (
        <div
          className="absolute -top-10 left-1/2 z-40 bg-white border-2 border-black rounded-2xl px-2.5 py-1 shadow-lg text-[11px] font-black text-red-600 whitespace-nowrap animate-pulse"
          // 머리 위 정중앙에 고정. 왼쪽을 볼 때 부모가 뒤집으므로 글자만 되돌린다.
          style={{ transform: flipped ? "translateX(-50%) scaleX(-1)" : "translateX(-50%)" }}
        >
          LET ME GO! 💦
          <div className="absolute left-1/2 -bottom-1.5 -ml-1 w-2 h-2 bg-white border-b-2 border-r-2 border-black rotate-45" />
        </div>
      )}

      {/* 2. Mii 캐릭터 본체 */}
      <div
        className={`relative transition-all duration-300 ${isHeld ? "-translate-y-6 scale-105" : ""} ${
          hasWings ? "[animation:miiFly_1.4s_ease-in-out_infinite]" : ""
        }`}
      >
        <svg width="76" height="96" viewBox="0 0 76 96" className="overflow-visible">
          {/* 날개 (사이드바에서 선택됐을 때만) */}
          {hasWings && (
            <g>
              <path
                d="M28 48 C17 31 4 26 1 35 C-2 43 6 50 13 52 C8 54 9 59 15 59 C11 62 15 66 20 63 C24 61 27 55 28 51 Z"
                fill="#ffffff"
                stroke="#3c5a47"
                strokeWidth="2.2"
                strokeLinejoin="round"
                className="origin-[28px_50px] [animation:miiFlap_0.32s_ease-in-out_infinite_alternate]"
              />
              <path
                d="M48 48 C59 31 72 26 75 35 C78 43 70 50 63 52 C68 54 67 59 61 59 C65 62 61 66 56 63 C52 61 49 55 48 51 Z"
                fill="#ffffff"
                stroke="#3c5a47"
                strokeWidth="2.2"
                strokeLinejoin="round"
                className="origin-[48px_50px] [animation:miiFlapRight_0.32s_ease-in-out_infinite_alternate]"
              />
            </g>
          )}
          {/* 바닥 그림자 */}
          <ellipse
            cx="38"
            cy="92"
            rx={isHeld ? 14 : isResting ? 19 : 22}
            ry={isHeld ? 4 : 6}
            fill="#1e3f24"
            opacity={isHeld ? 0.25 : 0.45}
            className="transition-all duration-200"
          />

          {/* 앉으면 그림자만 남기고 몸 전체가 바닥 쪽으로 내려간다 */}
          <g transform={isResting ? "translate(0,6)" : undefined}>
          {/* 왼팔 (잡혔을 때 고속 회전 버둥버둥) */}
          <g
            className={isHeld ? "origin-[24px_50px] animate-[miiFlailArm_0.14s_infinite_alternate]" : ""}
            style={{ transformOrigin: "24px 50px" }}
          >
            <path d="M24 50 Q12 56 10 64" stroke="#222" strokeWidth="7" strokeLinecap="round" fill="none" />
            <circle cx="9" cy="65" r="4.5" fill="#f8cfad" stroke="#222" strokeWidth="1.5" />
          </g>

          {/* 오른팔 (반대 위상으로 버둥버둥) */}
          <g
            className={isHeld ? "origin-[52px_50px] animate-[miiFlailArm_0.17s_infinite_alternate-reverse]" : ""}
            style={{ transformOrigin: "52px 50px" }}
          >
            <path d="M52 50 Q64 56 66 64" stroke="#222" strokeWidth="7" strokeLinecap="round" fill="none" />
            <circle cx="67" cy="65" r="4.5" fill="#f8cfad" stroke="#222" strokeWidth="1.5" />
          </g>

          {/* 왼다리 */}
          <g
            className={isHeld ? "origin-[31px_68px] animate-[miiFlailLeg_0.15s_infinite_alternate]" : ""}
            style={{
              transformOrigin: "31px 68px",
              transform: striding ? `rotate(${legLeftAngle}deg)` : undefined,
              transition: "transform 0.15s ease",
            }}
          >
            {isResting ? (
              <>
                <path d="M32 70 C22 73 15 80 20 85 C24 89 33 88 40 86" stroke="#443528" strokeWidth="6" strokeLinecap="round" fill="none" />
                <ellipse cx="41" cy="86" rx="4.4" ry="3" fill="#201712" />
              </>
            ) : (
              <>
                <path d="M31 68 L27 84" stroke="#443528" strokeWidth="6.5" strokeLinecap="round" />
                <ellipse cx="25" cy="85" rx="5.5" ry="3.5" fill="#201712" />
              </>
            )}
          </g>

          {/* 오른다리 */}
          <g
            className={isHeld ? "origin-[45px_68px] animate-[miiFlailLeg_0.13s_infinite_alternate-reverse]" : ""}
            style={{
              transformOrigin: "45px 68px",
              transform: striding ? `rotate(${legRightAngle}deg)` : undefined,
              transition: "transform 0.15s ease",
            }}
          >
            {isResting ? (
              <>
                <path d="M44 70 C54 73 61 80 56 85 C52 89 43 88 36 86" stroke="#443528" strokeWidth="6" strokeLinecap="round" fill="none" />
                <ellipse cx="35" cy="86" rx="4.4" ry="3" fill="#201712" />
              </>
            ) : (
              <>
                <path d="M45 68 L49 84" stroke="#443528" strokeWidth="6.5" strokeLinecap="round" />
                <ellipse cx="51" cy="85" rx="5.5" ry="3.5" fill="#201712" />
              </>
            )}
          </g>

          {/* 몸통 (셔츠) */}
          <path
            d="M26 48 Q38 45 50 48 L46 69 Q38 71 30 69 Z"
            fill={shirtColor}
            stroke="#222"
            strokeWidth="2.5"
            strokeLinejoin="round"
          />
          <circle cx="38" cy="48" r="3" fill="#fff" />

          {/* 머리 (잡히면 눈이 튀어나오고 땀방울이 맺힘) */}
          <g className={isHeld ? "animate-[miiHeadShake_0.2s_infinite]" : ""}>
            {/* 얼굴형 */}
            <path
              d="M20 28 C20 13 56 13 56 28 C56 42 48 46 38 46 C28 46 20 42 20 28 Z"
              fill="#fed7b2"
              stroke="#222"
              strokeWidth="2.5"
            />
            {/* 귀 */}
            <circle cx="19" cy="29" r="3" fill="#fed7b2" stroke="#222" strokeWidth="2" />
            <circle cx="57" cy="29" r="3" fill="#fed7b2" stroke="#222" strokeWidth="2" />

            {/* Mii 머리카락 */}
            <path
              d="M18 24 C18 10 32 6 38 6 C50 6 58 12 58 22 C52 18 44 20 38 18 C30 16 23 20 18 24 Z"
              fill="#2e1f13"
              stroke="#222"
              strokeWidth="2"
            />

            {/* 눈 & 표정 제어 */}
            {isHeld ? (
              <>
                {/* 패닉 눈 (동공 작아짐) */}
                <circle cx="31" cy="27" r="4.5" fill="#fff" stroke="#222" strokeWidth="1.8" />
                <circle cx="31" cy="27" r="1.5" fill="#000" />
                <circle cx="45" cy="27" r="4.5" fill="#fff" stroke="#222" strokeWidth="1.8" />
                <circle cx="45" cy="27" r="1.5" fill="#000" />
                {/* 찌그러진 입 */}
                <path d="M33 38 Q38 34 43 38" stroke="#222" strokeWidth="2" fill="none" strokeLinecap="round" />
                {/* 파란 식은땀 */}
                <path d="M49 19 Q52 16 52 23 Q52 25 49 25 Q47 25 47 23 Q47 20 49 19 Z" fill="#60a5fa" />
              </>
            ) : isCrying ? (
              <>
                {/* 울고 있는 눈 (아래로 처진 눈썹 + 눈물) */}
                <path d="M27 23 Q32 26 36 24" stroke="#222" strokeWidth="2" fill="none" strokeLinecap="round" />
                <path d="M49 23 Q44 26 40 24" stroke="#222" strokeWidth="2" fill="none" strokeLinecap="round" />
                <ellipse cx="32" cy="29" rx="2.5" ry="3" fill="#222" />
                <ellipse cx="44" cy="29" rx="2.5" ry="3" fill="#222" />
                {/* 흐르는 눈물 두 줄기 */}
                <path d="M31 32 Q30 37 31 41 Q32 37 31 32 Z" fill="#60a5fa" opacity="0.9" />
                <path d="M45 32 Q46 37 45 41 Q44 37 45 32 Z" fill="#60a5fa" opacity="0.9" />
                {/* 떨어지는 눈물방울 */}
                <circle cx="31" cy="41" r="2" fill="#60a5fa" className="[animation:agentTear_0.7s_linear_infinite]" />
                <circle cx="45" cy="41" r="2" fill="#60a5fa" className="[animation:agentTear_0.7s_0.35s_linear_infinite]" />
                {/* 우는 입 */}
                <ellipse cx="38" cy="38" rx="4" ry="3" fill="#7f1d1d" stroke="#222" strokeWidth="1.8" />
              </>
            ) : (
              <>
                {/* 기본 Mii 온화한 눈 */}
                <ellipse cx="32" cy="28" rx="2.5" ry="3.5" fill="#222" />
                <circle cx="33" cy="26.5" r="1" fill="#fff" />
                <ellipse cx="44" cy="28" rx="2.5" ry="3.5" fill="#222" />
                <circle cx="45" cy="26.5" r="1" fill="#fff" />
                {/* 볼터치 */}
                <ellipse cx="26" cy="33" rx="2" ry="1" fill="#f87171" opacity={0.6} />
                <ellipse cx="50" cy="33" rx="2" ry="1" fill="#f87171" opacity={0.6} />
                {/* 온화한 미소 입 */}
                <path d="M34 36 Q38 40 42 36" stroke="#222" strokeWidth="2" fill="none" strokeLinecap="round" />
              </>
            )}
          </g>
          </g>
        </svg>
      </div>

      <style jsx global>{`
        @keyframes miiFlailArm {
          0% { transform: rotate(-45deg); }
          100% { transform: rotate(55deg); }
        }
        @keyframes miiFlailLeg {
          0% { transform: rotate(-35deg); }
          100% { transform: rotate(40deg); }
        }
        @keyframes miiHeadShake {
          0%, 100% { transform: translateX(0px); }
          50% { transform: translateX(1.5px) rotate(2deg); }
        }
      `}</style>
    </div>
  );
}