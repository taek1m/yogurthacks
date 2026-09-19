"use client";

import { Check, Grip, MoreHorizontal, Pencil, Trash2, X } from "lucide-react";
import Link from "next/link";
import type { CSSProperties, PointerEvent as ReactPointerEvent, RefObject } from "react";
import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import { agentIconMap } from "@/components/agent-garden/agentIconMap";
import { getStablePosition } from "@/lib/agent-utils";
import type { DocumentAgent, GardenPosition } from "@/types/agent";

export function AgentObject({
  agent,
  index,
  gardenRef,
  onSavePosition,
  onRename,
  onRemove,
}: {
  agent: DocumentAgent;
  index: number;
  gardenRef: RefObject<HTMLDivElement | null>;
  onSavePosition: (id: string, position: GardenPosition) => Promise<void>;
  onRename: (id: string, name: string) => Promise<void>;
  onRemove: (id: string) => Promise<void>;
}) {
  const visual = agentIconMap[agent.documentType];
  const Icon = visual.icon;
  const [position, setPosition] = useState(agent.position ?? getStablePosition(index));
  const positionRef = useRef(position);
  const [menuOpen, setMenuOpen] = useState(false);
  const [mode, setMode] = useState<"edit" | "remove" | null>(null);
  const [name, setName] = useState(agent.name);
  const [saving, setSaving] = useState(false);
  const [pressing, setPressing] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState("");
  const suppressClick = useRef(false);
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
    target: HTMLAnchorElement | null;
  }>({ pointerId: -1, startX: 0, startY: 0, x: 0, y: 0, moved: false, active: false, canceled: false, target: null });
  const statusTone = agent.status === "error" ? "text-[#a33b32]" : agent.attentionCount ? "text-[#9a551e]" : "text-[#3a6948]";

  function beginDrag(event: ReactPointerEvent<HTMLAnchorElement>) {
    if (!window.matchMedia("(min-width: 768px)").matches || event.button !== 0) return;
    const target = event.currentTarget;
    drag.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      x: positionRef.current.xPercent,
      y: positionRef.current.yPercent,
      moved: false,
      active: false,
      canceled: false,
      target,
    };
    target.setPointerCapture(event.pointerId);
    setPressing(true);
    drag.current.timer = window.setTimeout(() => {
      if (drag.current.pointerId !== event.pointerId) return;
      drag.current.active = true;
      suppressClick.current = true;
      setPressing(false);
      setDragging(true);
    }, 450);
  }

  function moveDrag(event: ReactPointerEvent<HTMLAnchorElement>) {
    if (drag.current.pointerId !== event.pointerId) return;
    const distance = Math.abs(event.clientX - drag.current.startX) + Math.abs(event.clientY - drag.current.startY);
    if (!drag.current.active) {
      if (distance > 7) cancelPendingDrag();
      return;
    }
    if (!gardenRef.current) return;
    const bounds = gardenRef.current.getBoundingClientRect();
    const dx = ((event.clientX - drag.current.startX) / bounds.width) * 100;
    const dy = ((event.clientY - drag.current.startY) / bounds.height) * 100;
    if (distance > 5) drag.current.moved = true;
    const next = {
      xPercent: Math.max(7, Math.min(93, drag.current.x + dx)),
      yPercent: Math.max(14, Math.min(88, drag.current.y + dy)),
    };
    positionRef.current = next;
    setPosition(next);
  }

  async function endDrag(event: ReactPointerEvent<HTMLAnchorElement>) {
    if (drag.current.pointerId !== event.pointerId) return;
    if (drag.current.timer) window.clearTimeout(drag.current.timer);
    const wasActive = drag.current.active;
    const wasMoved = drag.current.moved;
    const wasCanceled = drag.current.canceled;
    setPressing(false);
    setDragging(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    drag.current.pointerId = -1;
    drag.current.active = false;
    if (!wasActive) {
      if (wasCanceled) {
        suppressClick.current = true;
        window.setTimeout(() => { suppressClick.current = false; }, 0);
      }
      return;
    }
    if (!wasMoved) {
      window.setTimeout(() => { suppressClick.current = false; }, 0);
      return;
    }
    setError("");
    try {
      await onSavePosition(agent.id, positionRef.current);
    } catch {
      const previous = agent.position ?? getStablePosition(index);
      setPosition(previous);
      positionRef.current = previous;
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
    setPressing(false);
    setDragging(false);
    suppressClick.current = false;
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

  async function remove() {
    setSaving(true);
    setError("");
    try {
      await onRemove(agent.id);
      setMode(null);
    } catch (removeError) {
      setError(removeError instanceof Error ? removeError.message : "Agent was not removed");
      setSaving(false);
    }
  }

  const style = {
    "--agent-x": `${position.xPercent}%`,
    "--agent-y": `${position.yPercent}%`,
  } as CSSProperties;

  return (
    <div className="relative flex min-w-0 flex-col items-center md:absolute md:left-[var(--agent-x)] md:top-[var(--agent-y)] md:w-52 md:-translate-x-1/2 md:-translate-y-1/2" style={style}>
      <Link
        href={`/agents/${agent.id}`}
        aria-label={`Open ${agent.name}, ${agent.statusLabel}`}
        onPointerDown={beginDrag}
        onPointerMove={moveDrag}
        onPointerUp={endDrag}
        onPointerCancel={cancelDrag}
        onDragStart={(event) => event.preventDefault()}
        onContextMenu={(event) => { if (pressing || dragging) event.preventDefault(); }}
        onClick={(event) => { if (suppressClick.current) event.preventDefault(); }}
        className={`group flex w-full min-w-0 select-none flex-col items-center text-center focus-visible:outline-none md:touch-none ${dragging ? "cursor-grabbing" : "cursor-pointer"}`}
      >
        <span className={`relative grid size-20 place-items-center rounded-lg border-2 shadow-[0_8px_0_rgba(41,81,46,0.12)] transition duration-200 group-hover:-translate-y-1 group-hover:shadow-[0_12px_0_rgba(41,81,46,0.10)] group-focus-visible:outline-3 group-focus-visible:outline-offset-4 group-focus-visible:outline-[#265f3b] motion-reduce:transform-none ${pressing ? "scale-[1.03] ring-2 ring-[#3d7b50]/40" : ""} ${dragging ? "scale-105 ring-2 ring-[#2d6b43]" : ""} ${visual.objectClass}`}>
          <Icon size={43} strokeWidth={1.8} className={visual.iconClass} aria-hidden="true" />
          <Grip size={14} className="absolute bottom-1 right-1 hidden text-black/35 md:block" aria-hidden="true" />
        </span>
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
                <p className="mt-4 text-sm leading-6 text-[#607267]">This permanently removes <strong>{agent.name}</strong> and its saved conversation.</p>
                <div className="mt-5 flex justify-end gap-3">
                  <button type="button" disabled={saving} onClick={() => setMode(null)} className="h-10 rounded-md border border-[#cad8c7] px-4 text-sm font-semibold">Cancel</button>
                  <button type="button" disabled={saving} onClick={remove} className="inline-flex h-10 items-center gap-2 rounded-md bg-[#a43b32] px-4 text-sm font-semibold text-white disabled:opacity-50"><Trash2 size={16} />{saving ? "Removing..." : "Remove"}</button>
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
