"use client";

import { useEffect, useMemo, useState } from "react";
import { MiiCharacter } from "@/components/agent-garden/MiiCharacter";
import type { DocumentAgent, GardenPosition } from "@/types/agent";

/** A spot in the garden: percent for the coarse position, px for the fine grip. */
type Spot = { x: number; y: number; px?: number; py?: number };
type Scene = "enter" | "run" | "lift" | "haul" | "kick" | "boot" | "exit" | "done";

/** Every beat of the send-off, in order, with how long the move into it takes. */
const BEATS: Array<{ scene: Scene; ms: number }> = [
  { scene: "enter", ms: 60 },
  { scene: "run", ms: 1000 },
  { scene: "lift", ms: 700 },
  { scene: "haul", ms: 1700 },
  { scene: "kick", ms: 1300 },
  { scene: "boot", ms: 700 },
  { scene: "exit", ms: 700 },
  { scene: "done", ms: 0 },
];

// The agent lies across their hands. Rotated it is 96px wide, so its ends sit
// 48px out; a carrier's hands reach 29px from its own centre. 77px apart puts
// hand on limb. Pixels, not percent, so the grip holds at any garden width.
const GRIP_PX = 77;
// Hands hang 17px below a standing character's middle, so the load rides there.
const HAND_DROP_PX = 17;
// Being held lifts a character 24px up its own axis. Tipped on its side that
// lift points left, which would open a gap on the right. Push it back.
const HELD_LIFT_PX = 24;

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

/**
 * Deleting the very last agent is not a quiet affair: two masked characters run
 * in, carry it off between them, then boot the now-useless cannon out of the
 * garden before leaving. The empty home screen returns once the cannon is gone.
 */
export function LastAgentCutscene({
  victim,
  victimAt,
  onHauled,
  onCannonKicked,
  onFinished,
}: {
  victim: DocumentAgent;
  victimAt: GardenPosition;
  onHauled: () => void;
  onCannonKicked: () => void;
  onFinished: () => void;
}) {
  const [beat, setBeat] = useState(0);
  const scene = BEATS[beat].scene;

  const marks = useMemo(() => {
    const x = clamp(victimAt.xPercent, 22, 78);
    const y = clamp(victimAt.yPercent, 32, 74);
    const lifted = y - 4;
    // Head points left once the agent is tipped over, so this one has the arms.
    // It is also the one that boots the cannon afterwards.
    const left: Record<Scene, Spot> = {
      enter: { x: -18, y },
      run: { x, y, px: -GRIP_PX },
      lift: { x, y: lifted, px: -GRIP_PX },
      haul: { x: 140, y: lifted, px: -GRIP_PX },
      kick: { x: 13, y: 84 },
      boot: { x: 13, y: 84 },
      exit: { x: -22, y: 84 },
      done: { x: -22, y: 84 },
    };
    // Feet end up on the right, so this one carries the legs.
    const right: Record<Scene, Spot> = {
      enter: { x: 118, y },
      run: { x, y, px: GRIP_PX },
      lift: { x, y: lifted, px: GRIP_PX },
      haul: { x: 140, y: lifted, px: GRIP_PX },
      kick: { x: 150, y: lifted },
      boot: { x: 150, y: lifted },
      exit: { x: 150, y: lifted },
      done: { x: 150, y: lifted },
    };
    const carried: Record<Scene, Spot> = {
      enter: { x, y },
      run: { x, y },
      lift: { x, y: lifted, px: HELD_LIFT_PX, py: HAND_DROP_PX },
      haul: { x: 140, y: lifted, px: HELD_LIFT_PX, py: HAND_DROP_PX },
      kick: { x: 140, y: lifted, px: HELD_LIFT_PX, py: HAND_DROP_PX },
      boot: { x: 140, y: lifted, px: HELD_LIFT_PX, py: HAND_DROP_PX },
      exit: { x: 140, y: lifted, px: HELD_LIFT_PX, py: HAND_DROP_PX },
      done: { x: 140, y: lifted, px: HELD_LIFT_PX, py: HAND_DROP_PX },
    };
    return { left, right, carried };
  }, [victimAt]);

  useEffect(() => {
    const step = BEATS[beat];
    if (!step || step.ms === 0) return;
    const timer = window.setTimeout(() => {
      // Side effects fire from the timer, never from the effect body.
      const next = BEATS[beat + 1];
      if (step.scene === "haul") onHauled();
      if (next?.scene === "boot") onCannonKicked();
      if (next?.scene === "done") onFinished();
      setBeat((current) => current + 1);
    }, step.ms);
    return () => window.clearTimeout(timer);
  }, [beat, onHauled, onCannonKicked, onFinished]);

  const ms = BEATS[Math.min(beat + 1, BEATS.length - 1)].ms;
  const travel = (spot: Spot) => ({
    left: `${spot.x}%`,
    top: `${spot.y}%`,
    marginLeft: spot.px ? `${spot.px}px` : undefined,
    marginTop: spot.py ? `${spot.py}px` : undefined,
    transitionProperty: "left, top, margin-left, margin-top",
    transitionDuration: `${ms}ms`,
    transitionTimingFunction: "ease-in-out",
  });

  const hauling = scene === "lift" || scene === "haul";
  const gripping = scene === "run" || hauling;
  const showVictim = beat <= BEATS.findIndex((item) => item.scene === "haul");
  // Facing the load while carrying it, facing the way they travel otherwise.
  const leftFaces = gripping || scene === "enter" ? 1 : -1;
  const rightFaces = gripping ? -1 : 1;
  const face = (direction: number) => (direction < 0 ? { transform: "scaleX(-1)" } : undefined);

  return (
    <div className="pointer-events-none absolute inset-0 z-30 hidden md:block" aria-hidden="true">
      {/* 팔을 잡는 납치범 — 나중에 대포를 걷어찬다 */}
      <div className="absolute w-24 -translate-x-1/2 -translate-y-1/2" style={travel(marks.left[scene])}>
        <div
          className={scene === "run" || scene === "kick" ? "[animation:banditHop_0.3s_ease-in-out_infinite]" : ""}
          style={face(leftFaces)}
        >
          <MiiCharacter isHeld={false} isWalking={scene !== "boot"} isBandit shirt="#2f3336" />
        </div>
      </div>

      {/* 다리를 잡는 납치범 */}
      <div className="absolute w-24 -translate-x-1/2 -translate-y-1/2" style={travel(marks.right[scene])}>
        <div
          className={scene === "run" ? "[animation:banditHop_0.3s_ease-in-out_infinite]" : ""}
          style={face(rightFaces)}
        >
          <MiiCharacter isHeld={false} isWalking isBandit shirt="#4a3038" />
        </div>
      </div>

      {/* 들려 가는 마지막 에이전트 */}
      {showVictim && (
        <div className="absolute w-24 -translate-x-1/2 -translate-y-1/2" style={travel(marks.carried[scene])}>
          <div className={`transition-transform duration-500 ${hauling ? "-rotate-90" : ""}`}>
            <MiiCharacter
              isHeld={hauling}
              isWalking={false}
              isCrying={hauling}
              silent={hauling}
              docType={victim.documentType}
            />
          </div>
        </div>
      )}
    </div>
  );
}
