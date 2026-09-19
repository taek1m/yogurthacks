"use client";

import { Check, MoreHorizontal, Pause, Pencil, Trash2, X } from "lucide-react";
import Link from "next/link";
import type { CSSProperties, PointerEvent as ReactPointerEvent, RefObject } from "react";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { getStablePosition } from "@/lib/agent-utils";
import type { DocumentAgent, GardenPosition } from "@/types/agent";
import { MiiCharacter } from "@/components/agent-garden/MiiCharacter";

// How long a press must be held before the agent can be dragged.
const HOLD_TO_DRAG_MS = 150;
// A press that travels farther than this before the hold completes is a click or a scroll.
const HOLD_SLOP_PX = 10;
// A first click waits this long for a second one before it counts as a stop/go toggle.
const DOUBLE_CLICK_MS = 240;

// Percent-of-garden box the agents stay inside while roaming.
const BOUNDS = { minX: 8, maxX: 92, minY: 16, maxY: 86 };
const STROLL_SPEED = 2.6; // percent per second
const MARCH_SPEED = 17; // percent per second, walking to the cannon
const LOAD_MS = 420; // climbing into the muzzle
const FIRE_MS = 760; // in flight, before the delete request

type LaunchPhase = "march" | "load" | "fire";

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

export function AgentObject({
  agent,
  index,
  gardenRef,
  cannonRef,
  onCannonArm,
  onCannonFire,
  onSavePosition,
  onRename,
  onRemove,
}: {
  agent: DocumentAgent;
  index: number;
  gardenRef: RefObject<HTMLDivElement | null>;
  cannonRef: RefObject<HTMLDivElement | null>;
  onCannonArm: (armed: boolean) => void;
  onCannonFire: () => void;
  onSavePosition: (id: string, position: GardenPosition) => Promise<void>;
  onRename: (id: string, name: string) => Promise<void>;
  onRemove: (id: string) => Promise<void>;
}) {
  const [home, setHome] = useState(agent.position ?? getStablePosition(index));
  const [menuOpen, setMenuOpen] = useState(false);
  const [mode, setMode] = useState<"edit" | "remove" | null>(null);
  const [name, setName] = useState(agent.name);
  const [saving, setSaving] = useState(false);
  const [pressing, setPressing] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState("");
  const [walking, setWalking] = useState(true);
  const [stepping, setStepping] = useState(false);
  const [facing, setFacing] = useState(1);
  const [launch, setLaunch] = useState<LaunchPhase | null>(null);

  const wrap = useRef<HTMLDivElement>(null);
  const position = useRef({ ...home });
  const steppingRef = useRef(false);
  const facingRef = useRef(1);
  const target = useRef<GardenPosition | null>(null);
  const restUntil = useRef(0);
  const suppressClick = useRef(false);
  const clickTimer = useRef<number | undefined>(undefined);
  const overCannon = useRef(false);
  const drag = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    x: number;
    y: number;
    moved: boolean;
    active: boolean;
    canceled: boolean;
    timer?: number;
  }>({ pointerId: -1, startX: 0, startY: 0, x: 0, y: 0, moved: false, active: false, canceled: false });

  // March = always striding; any other launch phase = still. Otherwise follow the stroll.
  const legsMoving =
    launch === "march" ? true : launch !== null ? false : stepping && walking && !dragging && !pressing;
  const statusTone = agent.status === "error" ? "text-[#a33b32]" : agent.attentionCount ? "text-[#9a551e]" : "text-[#3a6948]";
  const launching = launch !== null;

  // The live position is written straight to the DOM so roaming never re-renders.
  const paint = useCallback(() => {
    const element = wrap.current;
    if (!element) return;
    element.style.setProperty("--agent-x", `${position.current.xPercent}%`);
    element.style.setProperty("--agent-y", `${position.current.yPercent}%`);
  }, []);

  useLayoutEffect(paint, [paint]);

  // Only the memoized value React knows about, so our imperative writes survive re-renders.
  const style = useMemo(
    () => ({ "--agent-x": `${home.xPercent}%`, "--agent-y": `${home.yPercent}%` }) as CSSProperties,
    [home],
  );

  const faceTowards = useCallback((dx: number) => {
    const next = dx === 0 ? facingRef.current : dx > 0 ? 1 : -1;
    if (facingRef.current === next) return;
    facingRef.current = next;
    setFacing(next);
  }, []);

  // Only ever called from animation callbacks, so effect bodies stay side-effect free.
  const setSteps = useCallback((value: boolean) => {
    if (steppingRef.current === value) return;
    steppingRef.current = value;
    setStepping(value);
  }, []);

  /** Centre of the cannon muzzle, in the same percent space as the agents. */
  const cannonPoint = useCallback((): GardenPosition | null => {
    const garden = gardenRef.current;
    const cannon = cannonRef.current;
    if (!garden || !cannon) return null;
    const bounds = garden.getBoundingClientRect();
    const muzzle = cannon.getBoundingClientRect();
    // The cannon is hidden on the stacked mobile layout, where it has no box.
    if (!bounds.width || !bounds.height || !muzzle.width || !muzzle.height) return null;
    return {
      xPercent: ((muzzle.left + muzzle.width * 0.66 - bounds.left) / bounds.width) * 100,
      yPercent: ((muzzle.top + muzzle.height * 0.3 - bounds.top) / bounds.height) * 100,
    };
  }, [cannonRef, gardenRef]);

  // Idle strolling. Runs only on the layout where agents are absolutely positioned.
  useEffect(() => {
    if (!walking || launching || dragging || pressing) return;
    if (!window.matchMedia("(min-width: 768px)").matches) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let frame = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const delta = Math.min(64, now - last) / 1000;
      last = now;

      if (!target.current && now >= restUntil.current) {
        target.current = {
          xPercent: clamp(position.current.xPercent + (Math.random() - 0.5) * 38, BOUNDS.minX, BOUNDS.maxX),
          yPercent: clamp(position.current.yPercent + (Math.random() - 0.5) * 22, BOUNDS.minY, BOUNDS.maxY),
        };
      }

      const destination = target.current;
      if (destination) {
        const dx = destination.xPercent - position.current.xPercent;
        const dy = destination.yPercent - position.current.yPercent;
        const distance = Math.hypot(dx, dy);
        if (distance < 0.35) {
          target.current = null;
          restUntil.current = now + 900 + Math.random() * 2600;
          setSteps(false);
        } else {
          const stride = Math.min(distance, STROLL_SPEED * delta);
          position.current = {
            xPercent: position.current.xPercent + (dx / distance) * stride,
            yPercent: position.current.yPercent + (dy / distance) * stride,
          };
          faceTowards(dx);
          setSteps(true);
          paint();
        }
      }
      frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [walking, launching, dragging, pressing, paint, faceTowards, setSteps]);

  // Launch step 1: cry, then walk into the cannon under its own power.
  useEffect(() => {
    if (launch !== "march") return;
    let frame = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const delta = Math.min(64, now - last) / 1000;
      last = now;
      const destination = cannonPoint();
      if (!destination) {
        setLaunch("load");
        return;
      }
      const dx = destination.xPercent - position.current.xPercent;
      const dy = destination.yPercent - position.current.yPercent;
      const distance = Math.hypot(dx, dy);
      if (distance < 0.8) {
        position.current = destination;
        paint();
        setLaunch("load");
        return;
      }
      const stride = Math.min(distance, MARCH_SPEED * delta);
      position.current = {
        xPercent: position.current.xPercent + (dx / distance) * stride,
        yPercent: position.current.yPercent + (dy / distance) * stride,
      };
      faceTowards(dx);
      setSteps(true);
      paint();
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [launch, cannonPoint, paint, faceTowards, setSteps]);

  // Launch step 2: drop into the muzzle, then step 3: the shot, then the delete.
  useEffect(() => {
    if (launch !== "load") return;
    const destination = cannonPoint();
    if (destination) {
      position.current = destination;
      paint();
    }
    const timer = window.setTimeout(() => {
      onCannonFire();
      setLaunch("fire");
    }, LOAD_MS);
    return () => window.clearTimeout(timer);
  }, [launch, cannonPoint, paint, onCannonFire]);

  useEffect(() => {
    if (launch !== "fire") return;
    let canceled = false;
    const timer = window.setTimeout(async () => {
      try {
        await onRemove(agent.id);
      } catch (removeError) {
        if (canceled) return;
        setError(removeError instanceof Error ? removeError.message : "Agent was not removed");
        setLaunch(null);
      }
    }, FIRE_MS);
    return () => {
      canceled = true;
      window.clearTimeout(timer);
    };
  }, [launch, agent.id, onRemove]);

  useEffect(() => () => window.clearTimeout(clickTimer.current), []);

  function beginDrag(event: ReactPointerEvent<HTMLAnchorElement>) {
    if (launching) return;
    if (!window.matchMedia("(min-width: 768px)").matches || event.button !== 0) return;
    const target = event.currentTarget;
    drag.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      x: position.current.xPercent,
      y: position.current.yPercent,
      moved: false,
      active: false,
      canceled: false,
    };
    target.setPointerCapture(event.pointerId);
    setPressing(true);
    drag.current.timer = window.setTimeout(() => {
      if (drag.current.pointerId !== event.pointerId) return;
      drag.current.active = true;
      suppressClick.current = true;
      setPressing(false);
      setDragging(true);
    }, HOLD_TO_DRAG_MS);
  }

  function moveDrag(event: ReactPointerEvent<HTMLAnchorElement>) {
    if (drag.current.pointerId !== event.pointerId) return;
    const distance = Math.abs(event.clientX - drag.current.startX) + Math.abs(event.clientY - drag.current.startY);
    if (!drag.current.active) {
      if (distance > HOLD_SLOP_PX) cancelPendingDrag();
      return;
    }
    if (!gardenRef.current) return;
    const bounds = gardenRef.current.getBoundingClientRect();
    const dx = ((event.clientX - drag.current.startX) / bounds.width) * 100;
    const dy = ((event.clientY - drag.current.startY) / bounds.height) * 100;
    if (distance > 5) drag.current.moved = true;
    faceTowards(event.clientX - drag.current.startX);
    position.current = {
      xPercent: clamp(drag.current.x + dx, 7, 93),
      yPercent: clamp(drag.current.y + dy, 14, 88),
    };
    paint();

    const cannon = cannonRef.current?.getBoundingClientRect();
    const inside = Boolean(
      cannon &&
        event.clientX >= cannon.left - 12 &&
        event.clientX <= cannon.right + 12 &&
        event.clientY >= cannon.top - 12 &&
        event.clientY <= cannon.bottom + 12,
    );
    if (inside !== overCannon.current) {
      overCannon.current = inside;
      onCannonArm(inside);
    }
  }

  async function endDrag(event: ReactPointerEvent<HTMLAnchorElement>) {
    if (drag.current.pointerId !== event.pointerId) return;
    if (drag.current.timer) window.clearTimeout(drag.current.timer);
    const wasActive = drag.current.active;
    const wasMoved = drag.current.moved;
    const wasCanceled = drag.current.canceled;
    const droppedInCannon = overCannon.current;
    setPressing(false);
    setDragging(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    drag.current.pointerId = -1;
    drag.current.active = false;
    if (overCannon.current) {
      overCannon.current = false;
      onCannonArm(false);
    }
    if (!wasActive) {
      if (wasCanceled) {
        suppressClick.current = true;
        window.setTimeout(() => { suppressClick.current = false; }, 0);
      }
      return;
    }
    if (droppedInCannon) {
      // Already at the muzzle: skip the walk and load the shot straight away.
      window.setTimeout(() => { suppressClick.current = false; }, 0);
      setLaunch("load");
      return;
    }
    if (!wasMoved) {
      window.setTimeout(() => { suppressClick.current = false; }, 0);
      return;
    }
    setError("");
    const dropped = { ...position.current };
    try {
      await onSavePosition(agent.id, dropped);
      setHome(dropped);
    } catch {
      const previous = agent.position ?? getStablePosition(index);
      position.current = previous;
      paint();
      setHome(previous);
      setError("Position was not saved");
    }
    window.setTimeout(() => { suppressClick.current = false; }, 0);
  }

  function cancelPendingDrag() {
    if (drag.current.active) return;
    if (drag.current.timer) window.clearTimeout(drag.current.timer);
    drag.current.timer = undefined;
    drag.current.canceled = true;
    setPressing(false);
  }

  function cancelDrag(event: ReactPointerEvent<HTMLAnchorElement>) {
    if (drag.current.timer) window.clearTimeout(drag.current.timer);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    drag.current.pointerId = -1;
    drag.current.active = false;
    if (overCannon.current) {
      overCannon.current = false;
      onCannonArm(false);
    }
    setPressing(false);
    setDragging(false);
    suppressClick.current = false;
  }

  /** One click stops or restarts the stroll; two clicks open the conversation. */
  function handleClick(event: React.MouseEvent<HTMLAnchorElement>) {
    if (suppressClick.current || launching) {
      event.preventDefault();
      return;
    }
    // Keyboard activation reports no click count, and a second click opens the
    // conversation; both just follow the link.
    if (event.detail === 0 || event.detail >= 2) {
      window.clearTimeout(clickTimer.current);
      clickTimer.current = undefined;
      return;
    }
    event.preventDefault();
    window.clearTimeout(clickTimer.current);
    clickTimer.current = window.setTimeout(() => {
      clickTimer.current = undefined;
      target.current = null;
      restUntil.current = 0;
      setWalking((value) => !value);
    }, DOUBLE_CLICK_MS);
  }

  async function saveName(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      await onRename(agent.id, name.trim());
      setMode(null);
    } catch (renameError) {
      setError(renameError instanceof Error ? renameError.message : "Name was not saved");
    } finally {
      setSaving(false);
    }
  }

  function remove() {
    setMode(null);
    setError("");
    setWalking(false);
    setLaunch(cannonPoint() ? "march" : "load");
  }

  return (
    <div
      ref={wrap}
      className="relative flex min-w-0 flex-col items-center md:absolute md:left-[var(--agent-x)] md:top-[var(--agent-y)] md:w-52 md:-translate-x-1/2 md:-translate-y-1/2"
      style={style}
    >
      <div
        data-agent-launch={launch ?? undefined}
        className={`relative flex w-full min-w-0 flex-col items-center ${
          launch === "fire" ? "[animation:agentLaunch_0.76s_cubic-bezier(0.2,0.6,0.5,1)_forwards]" : ""
        } ${launch === "load" ? "scale-[0.34] opacity-90 transition-transform duration-[420ms] ease-in" : ""}`}
      >
        <Link
          href={`/agents/${agent.id}`}
          aria-label={`Open ${agent.name}, ${agent.statusLabel}${walking ? "" : ", paused"}`}
          onPointerDown={beginDrag}
          onPointerMove={moveDrag}
          onPointerUp={endDrag}
          onPointerCancel={cancelDrag}
          onDragStart={(event) => event.preventDefault()}
          onContextMenu={(event) => { if (pressing || dragging) event.preventDefault(); }}
          onClick={handleClick}
          className={`group flex w-full min-w-0 select-none flex-col items-center text-center focus-visible:outline-none md:touch-none ${dragging ? "cursor-grabbing" : "cursor-pointer"}`}
        >
          <div className="relative flex flex-col items-center">
            {/* Wii Mii 캐릭터 (누르는 중이거나 드래그 중일 때 허우적거림 활성화) */}
            <div style={{ transform: facing < 0 ? "scaleX(-1)" : undefined }}>
              <MiiCharacter
                isHeld={pressing || dragging}
                isWalking={legsMoving}
                isCrying={launching}
                docType={agent.documentType}
              />
            </div>
            {!walking && !launching && (
              <span className="absolute -right-1 -top-1 grid size-6 place-items-center rounded-full bg-[#fffef9] text-[#4a6a55] shadow ring-1 ring-[#c7d5c3]">
                <Pause size={12} fill="currentColor" />
              </span>
            )}
          </div>
          <span className="mt-3 w-full rounded-md bg-[#fffef9]/95 px-2 py-1.5 shadow-sm ring-1 ring-[#d6e1d2]">
            <span className="block truncate text-sm font-bold text-[#193a28]">{agent.name}</span>
            <span className="block truncate text-xs text-[#5d7465]">{agent.documentName}</span>
            <span className={`mt-0.5 block truncate text-xs font-semibold ${statusTone}`}>{agent.statusLabel}</span>
          </span>
        </Link>

        <button type="button" aria-label={`Manage ${agent.name}`} aria-expanded={menuOpen} onClick={() => setMenuOpen((value) => !value)} className="absolute right-0 top-0 grid size-8 place-items-center rounded-full border border-[#c7d5c3] bg-white text-[#345942] shadow hover:bg-[#eef5eb] md:-right-1 md:-top-1">
          <MoreHorizontal size={17} />
        </button>
        {menuOpen && (
          <div className="absolute right-0 top-9 z-20 w-36 rounded-md border border-[#d4dfd1] bg-white p-1.5 text-left shadow-xl">
            <button type="button" onClick={() => { setMode("edit"); setMenuOpen(false); }} className="flex w-full items-center gap-2 rounded px-2.5 py-2 text-sm font-semibold hover:bg-[#eef6ec]"><Pencil size={15} />Edit</button>
            <button type="button" onClick={() => { setMode("remove"); setMenuOpen(false); }} className="flex w-full items-center gap-2 rounded px-2.5 py-2 text-sm font-semibold text-[#a43b32] hover:bg-[#fff0ed]"><Trash2 size={15} />Remove</button>
          </div>
        )}
      </div>
      {error && <span role="alert" className="absolute top-full z-10 mt-2 whitespace-nowrap rounded bg-[#8f332c] px-2 py-1 text-xs text-white shadow">{error}</span>}

      {mode && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#10291d]/45 p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) setMode(null); }}>
          <div role="dialog" aria-modal="true" aria-labelledby={`${mode}-${agent.id}-title`} className={`w-[92vw] rounded-lg border border-[#d4dfd1] bg-[#fffef9] p-6 text-left shadow-2xl sm:p-8 ${mode === "edit" ? "max-w-3xl" : "max-w-2xl"}`}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase text-[#4b765a]">Agent settings</p>
                <h2 id={`${mode}-${agent.id}-title`} className="mt-1 font-display text-2xl font-semibold">{mode === "edit" ? "Rename agent" : "Remove agent?"}</h2>
              </div>
              <button type="button" disabled={saving} onClick={() => setMode(null)} aria-label="Close" className="grid size-9 place-items-center rounded hover:bg-[#edf3ea]"><X size={18} /></button>
            </div>
            {mode === "edit" ? (
              <form onSubmit={saveName}>
                <label htmlFor={`agent-name-${agent.id}`} className="mt-5 block text-sm font-bold">Agent name</label>
                <input id={`agent-name-${agent.id}`} value={name} onChange={(event) => setName(event.target.value)} minLength={2} maxLength={60} autoFocus className="mt-2 h-12 w-full rounded-md border border-[#b7cbb5] bg-white px-4 text-base outline-none focus:border-[#4f865e] focus:ring-2 focus:ring-[#c4dfc9]" />
                <button type="submit" disabled={saving || name.trim().length < 2} className="mt-5 inline-flex h-10 w-full items-center justify-center gap-2 rounded-md bg-[#225f3b] px-4 text-sm font-semibold text-white disabled:opacity-50"><Check size={16} />Save changes</button>
              </form>
            ) : (
              <div>
                <p className="mt-4 text-sm leading-6 text-[#607267]">This permanently removes <strong>{agent.name}</strong> and its saved conversation. It will walk itself into the cannon first.</p>
                <div className="mt-5 flex justify-end gap-3">
                  <button type="button" disabled={saving} onClick={() => setMode(null)} className="h-10 rounded-md border border-[#cad8c7] px-4 text-sm font-semibold">Cancel</button>
                  <button type="button" disabled={saving} onClick={remove} className="inline-flex h-10 items-center gap-2 rounded-md bg-[#a43b32] px-4 text-sm font-semibold text-white disabled:opacity-50"><Trash2 size={16} />Remove</button>
                </div>
              </div>
            )}
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}
