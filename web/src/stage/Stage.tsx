"use client";

import { Canvas, useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { ContactShadows, Environment, Html, Lightformer, OrbitControls, QuadraticBezierLine, RoundedBox } from "@react-three/drei";
import { BookOpen, ClipboardList, Database, Monitor, Package, Server, type LucideIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import type { RhEvent } from "../api";
import { look } from "./look";
import { DESK_Z, ROOM_D, ROOM_W, RoomModel, type Actor, type Desk, type DeskKind, type Tone } from "./model";
import {
  Armchair, Bookshelf, Containers, DeskBooks, DeskLamp, Door as DoorPanel, FilingCabinet, Floor, FloorLamp, Frame, Keyboard, Laptop,
  Mat, MeetingTable, Monitor as Screen, Mouse, Mug, OfficeDesk, Papers, Plant, Rack, Rug, RoundRug, SERVER_UNITS, STORAGE_UNITS,
  SideTable, SunPatch, Tower, WallRun, WallWindow, WaterCooler, Whiteboard,
} from "./props";

/**
 * The rehearsal room, rendered with react-three-fiber: a warm office seen from above, with workstations,
 * server racks and storage arrays at the stations. Every movement and label comes from a recorded event via
 * RoomModel; nothing moves on its own. Click a person or a desk to inspect it.
 */

export type Selection = { kind: "actor" | "desk"; id: string };

const TONE_HEX: Record<Tone, string> = { go: "#3ecf8e", stop: "#ff6363", cue: "#f5a524", plain: "#bccdff" };
const hex = (n: number) => "#" + n.toString(16).padStart(6, "0");
const ICON: Record<DeskKind, LucideIcon> = { desk: Monitor, books: BookOpen, images: Package, rack: Server, cabinet: Database, board: ClipboardList };
const SEATS: [number, number][] = [[9.6, 6.1], [12, 6.1], [14.4, 6.1], [9.6, 8.7], [12, 8.7], [14.4, 8.7]];

/** The office the rehearsal happens in: walls, windows, rugs, the meeting table, the validator's corner, and decoration. */
function Room({ mode, doorRef }: { mode: "episode" | "compiler"; doorRef: React.RefObject<THREE.Group | null> }) {
  const top = 0.795; // the meeting table's surface
  return (
    <group>
      <Floor width={ROOM_W} depth={ROOM_D} />
      <WallRun length={ROOM_W} position={[0, 0, 0]} />
      <WallRun length={ROOM_D} position={[0, 0, ROOM_D]} rotation={Math.PI / 2} />
      <WallRun length={ROOM_D} position={[ROOM_W, 0, 0]} rotation={-Math.PI / 2} />
      <WallRun length={ROOM_W} position={[ROOM_W, 0, ROOM_D]} rotation={Math.PI} low />

      <WallWindow position={[0, 1.85, 4.4]} rotation={Math.PI / 2} w={2.6} />
      <SunPatch position={[2.0, 0.011, 4.4]} size={[2.4, 2.8]} />
      <WallWindow position={[ROOM_W, 1.85, 7.4]} rotation={-Math.PI / 2} w={2.2} />
      <SunPatch position={[ROOM_W - 1.8, 0.011, 7.4]} size={[2.0, 2.4]} />
      <Frame position={[5.78, 2.35, 0.03]} picture="view" />
      <Frame position={[10.94, 2.4, 0.03]} w={0.7} h={0.5} picture="cork" />
      <Frame position={[16.1, 2.35, 0.03]} w={0.42} h={0.32} picture="certificate" />

      <Rug position={[12, 0.012, 7.4]} size={[9.6, 4.8]} />
      <MeetingTable position={[12, 0, 7.4]} />
      {SEATS.map(([x, z], i) => (
        <Laptop key={i} position={[x, top, z < 7.4 ? 6.92 : 7.88]} rotation={z < 7.4 ? Math.PI : 0} seed={i + 1} />
      ))}
      <Laptop position={[9.35, top, 7.4]} rotation={-Math.PI / 2} seed={2} />
      <Laptop position={[14.65, top, 7.4]} rotation={Math.PI / 2} seed={3} />
      <Mug position={[10.7, top, 7.25]} color="#ef5d70" />
      <Mug position={[13.25, top, 7.6]} />
      <Papers position={[11.2, top, 7.5]} rotation={0.3} />
      <Papers position={[13.0, top, 7.2]} rotation={-0.2} />
      <mesh position={[12, top + 0.02, 7.4]} castShadow>
        <cylinderGeometry args={[0.13, 0.15, 0.04, 3]} />
        <Mat color="#24272d" roughness={0.4} />
      </mesh>

      {/* the validator's corner */}
      <RoundRug position={[3.4, 0.012, 8.4]} radius={1.5} />
      <group position={[3.0, 0, 8.9]} rotation-y={Math.PI}>
        <OfficeDesk w={1.6} />
      </group>
      <Laptop position={[3.2, 0.79, 8.75]} rotation={Math.PI} seed={0} />
      <DeskLamp position={[2.35, 0.79, 9.05]} rotation={Math.PI} />
      <Papers position={[3.75, 0.79, 8.95]} rotation={0.4} />
      <Mug position={[2.75, 0.79, 8.65]} color="#3a66e8" />
      <FloorLamp position={[0.6, 0, 9.0]} />
      <Bookshelf position={[0.21, 0, 10.6]} rotation={Math.PI / 2} w={1.6} h={2.1} seed={3} />

      {/* corners */}
      <Plant position={[0.75, 0, 0.75]} size={1.6} seed={1} />
      <Plant position={[0.8, 0, 12.2]} size={1.4} seed={2} />
      <Plant position={[ROOM_W - 0.8, 0, 12.3]} size={1.5} seed={4} />
      <Bookshelf position={[ROOM_W - 0.21, 0, 4.4]} rotation={-Math.PI / 2} w={1.6} h={2.1} seed={9} />
      <RoundRug position={[21.5, 0.012, 10.7]} radius={1.25} />
      <Armchair position={[22.0, 0, 11.2]} rotation={-2.36} />
      <SideTable position={[20.95, 0, 11.45]} />
      <FilingCabinet position={[ROOM_W - 0.65, 0, 0.36]} />
      <Plant position={[ROOM_W - 0.65, 1.32, 0.36]} size={0.5} seed={7} />
      <WaterCooler position={[ROOM_W - 1.55, 0, 0.3]} />
      {mode === "episode" && <DoorPanel position={[19.9, 0, 0]} doorRef={doorRef} />}
    </group>
  );
}

// ---------------------------------------------------------------------------- stations

function DeskPiece({ desk, model, onSelect, selected, seed }: { desk: Desk; model: RoomModel; onSelect?: (s: Selection) => void; selected: boolean; seed: number }) {
  const screen = useRef<THREE.MeshStandardMaterial>(null);
  const leds = useRef<THREE.MeshStandardMaterial[]>([]);
  const [tone, setTone] = useState<Tone | null>(null);
  useFrame(({ clock }) => {
    const now = performance.now();
    const flash = desk.flash && desk.flash.until > now ? desk.flash.tone : null;
    const busy = [...model.actors.values()].some((a) => a.busyUntil > now && Math.abs(a.x - desk.x) < 1.2 && Math.abs(a.z - (DESK_Z + 1.1)) < 0.2);
    const t = flash ?? (busy ? "plain" : null);
    if (t !== tone) setTone(t);
    if (screen.current) {
      screen.current.emissive.set(t ? TONE_HEX[t] : "#c8d6f0");
      screen.current.emissiveIntensity = t ? (busy ? 0.9 + 0.35 * Math.sin(clock.elapsedTime * 11) : 1.3) : 0.55;
    }
    // drive-activity lights flicker at their own rates, faster while someone works at the rack
    const rate = busy ? 2 : 1;
    leds.current.forEach((m, j) => {
      if (m) m.emissiveIntensity = Math.sin(clock.elapsedTime * rate * (4 + (j % 7) * 2.3) + j * 1.7) > 0.55 ? 2.4 : 0.35;
    });
  });
  // without onSelect the room is a recording to watch, and nothing reacts to the pointer
  const hot = onSelect && {
    onClick: (e: ThreeEvent<MouseEvent>) => { e.stopPropagation(); onSelect({ kind: "desk", id: desk.id }); },
    onPointerOver: (e: ThreeEvent<PointerEvent>) => { e.stopPropagation(); document.body.style.cursor = "pointer"; },
    onPointerOut: () => { document.body.style.cursor = ""; },
  };
  let body: React.ReactNode;
  if (desk.kind === "rack") {
    body = (
      <group>
        <Rack position={[-0.33, 0, -0.1]} units={SERVER_UNITS} leds={leds} status={screen} />
        <Rack position={[0.33, 0, -0.1]} units={[...SERVER_UNITS].reverse()} leds={leds} ledFrom={100} />
      </group>
    );
  } else if (desk.kind === "cabinet") {
    body = (
      <group>
        <Rack position={[-0.33, 0, -0.1]} units={STORAGE_UNITS} h={1.5} leds={leds} status={screen} />
        <Rack position={[0.33, 0, -0.1]} units={STORAGE_UNITS} h={1.5} leds={leds} ledFrom={100} />
      </group>
    );
  } else {
    body = (
      <group>
        <OfficeDesk />
        {desk.kind === "board" ? (
          <>
            <Whiteboard position={[0, 1.75, -1.27]} />
            <Laptop position={[0.25, 0.79, -0.05]} screen={screen} seed={seed} />
            <Papers position={[-0.45, 0.79, 0.05]} rotation={0.2} />
            {["#ffe066", "#ff9ebb", "#a6e3a1"].map((c, i) => (
              <mesh key={c} position={[-0.7 + i * 0.09, 0.792, -0.2 + (i % 2) * 0.05]} rotation-y={i * 0.3}>
                <boxGeometry args={[0.076, 0.004, 0.076]} />
                <Mat color={c} />
              </mesh>
            ))}
          </>
        ) : (
          <>
            <Screen position={[0.25, 0.79, -0.18]} screen={screen} seed={seed} />
            <Keyboard position={[0.25, 0.79, 0.14]} />
            <Mouse position={[0.67, 0.808, 0.15]} />
            <Mug position={[0.78, 0.79, -0.18]} color={["#ef5d70", "#f4f1e8", "#3a66e8"][seed % 3]} />
          </>
        )}
        {desk.kind === "books" && <DeskBooks position={[-0.84, 0.79, -0.15]} />}
        {desk.kind === "images" && <Containers position={[-0.7, 0.79, -0.12]} />}
        {(desk.kind === "desk" || desk.kind === "images") && <Tower position={[1.08, 0, -0.05]} />}
        {desk.kind === "desk" && <Papers position={[-0.5, 0.79, 0.06]} rotation={-0.15} />}
      </group>
    );
  }
  const Icon = ICON[desk.kind];
  const pill = selected
    ? "border-primary bg-primary text-primary-foreground"
    : tone === "go" ? "border-[#2f9e6e] bg-[#d5f5e6] text-[#14532d]"
    : tone === "stop" ? "border-[#d64545] bg-[#ffe1e1] text-[#7f1d1d]"
    : tone === "cue" ? "border-[#d99a1e] bg-[#ffefcc] text-[#713f12]"
    : tone === "plain" ? "border-[#5b7fb5] bg-[#e3ecfa] text-[#1e3a5f]"
    : "border-[#4d6b94] bg-[#c9d8ec] text-[#22344d] hover:bg-[#d8e4f3]";
  const badge = selected ? "bg-primary-foreground/20" : tone === "go" ? "bg-[#2f9e6e]" : tone === "stop" ? "bg-[#d64545]" : tone === "cue" ? "bg-[#d99a1e]" : "bg-[#4d6b94]";
  return (
    <group position={[desk.x, 0, DESK_Z]} {...hot}>
      {body}
      <Html position={[0, 2.95, -0.3]} center zIndexRange={[20, 0]}>
        <button
          disabled={!onSelect}
          onClick={() => onSelect?.({ kind: "desk", id: desk.id })}
          className={`relative flex items-center gap-1.5 whitespace-nowrap rounded-lg border-2 py-0.5 pl-0.5 pr-2.5 text-[12px] font-semibold shadow-[0_3px_0_rgba(0,0,0,0.3)] transition-colors ${pill} ${onSelect ? "" : "pointer-events-none"}`}
        >
          <span className={`grid size-5 place-items-center rounded-md text-white ${badge}`}>
            <Icon className="size-3.5" strokeWidth={2.4} />
          </span>
          {desk.label}
          {/* the tail points at the station */}
          <span aria-hidden className="absolute left-1/2 top-full size-2 -translate-x-1/2 -translate-y-[3px] rotate-45 border-r-2 border-b-2 border-inherit bg-inherit" />
        </button>
      </Html>
    </group>
  );
}

// ---------------------------------------------------------------------------- people

type View = { activity: string; tone: Tone; bubble: string; task: string; badge: Tone | "" };

function Person({ actor, onSelect, selected }: { actor: Actor; onSelect?: (s: Selection) => void; selected: boolean }) {
  const group = useRef<THREE.Group>(null);
  const legL = useRef<THREE.Group>(null);
  const legR = useRef<THREE.Group>(null);
  const armL = useRef<THREE.Group>(null);
  const armR = useRef<THREE.Group>(null);
  const chip = useRef<THREE.Group>(null);
  const [hover, setHover] = useState(false);
  const [view, setView] = useState<View>({ activity: actor.activity, tone: actor.activityTone, bubble: "", task: "", badge: "" });
  const c = look(actor.id);
  useFrame(({ clock }) => {
    const now = performance.now();
    const g = group.current;
    if (!g) return;
    const moving = Math.hypot(actor.tx - actor.x, actor.tz - actor.z) > 0.01;
    g.position.set(actor.x, moving ? Math.abs(Math.sin(clock.elapsedTime * 9)) * 0.04 : 0, actor.z);
    if (chip.current) chip.current.position.y = THREE.MathUtils.lerp(chip.current.position.y, 2.0 + actor.lift * 0.8, 0.15);
    let diff = actor.facing - g.rotation.y;
    diff = Math.atan2(Math.sin(diff), Math.cos(diff));
    g.rotation.y += diff * 0.2;
    const swing = moving ? Math.sin(clock.elapsedTime * 9) * 0.6 : 0;
    const typing = !moving && actor.busyUntil > now;
    if (legL.current) legL.current.rotation.x = swing;
    if (legR.current) legR.current.rotation.x = -swing;
    if (armL.current) armL.current.rotation.x = typing ? -1.1 + Math.sin(clock.elapsedTime * 14) * 0.15 : -swing * 0.8;
    if (armR.current) armR.current.rotation.x = typing ? -1.1 + Math.cos(clock.elapsedTime * 14) * 0.15 : swing * 0.8;
    const bubble = actor.bubble && actor.bubble.until > now ? actor.bubble.text : "";
    const task = actor.task && !bubble ? `${actor.task.from}: ${actor.task.text}` : "";
    const badge = actor.badge && actor.badge.until > now ? actor.badge.tone : "";
    if (view.activity !== actor.activity || view.tone !== actor.activityTone || view.bubble !== bubble || view.task !== task || view.badge !== badge) {
      setView({ activity: actor.activity, tone: actor.activityTone, bubble, task, badge });
    }
  });
  const hot = onSelect && {
    onClick: (e: ThreeEvent<MouseEvent>) => { e.stopPropagation(); onSelect({ kind: "actor", id: actor.id }); },
    onPointerOver: (e: ThreeEvent<PointerEvent>) => { e.stopPropagation(); setHover(true); document.body.style.cursor = "pointer"; },
    onPointerOut: () => { setHover(false); document.body.style.cursor = ""; },
  };
  // a limb hangs from its joint; legs end in a shoe, arms in a hand
  const limb = (ref: React.RefObject<THREE.Group | null>, x: number, y: number, w: number, len: number, color: number, end: string, foot: boolean) => (
    <group ref={ref} position={[x, y, 0]}>
      <RoundedBox args={[w, len, w * 1.1]} radius={w * 0.45} position={[0, -len / 2, 0]} castShadow>
        <Mat color={hex(color)} roughness={0.85} />
      </RoundedBox>
      {foot ? (
        <RoundedBox args={[w * 1.1, 0.08, w * 1.6]} radius={0.035} position={[0, -len + 0.03, 0.04]} castShadow>
          <Mat color={end} roughness={0.6} />
        </RoundedBox>
      ) : (
        <mesh position={[0, -len - 0.02, 0]}>
          <sphereGeometry args={[w * 0.48, 14, 10]} />
          <Mat color={end} roughness={0.6} />
        </mesh>
      )}
    </group>
  );
  const dot = actor.kind === "customer" ? "#f5a524" : actor.kind === "verifier" ? "#3ecf8e" : hex(c.shirt);
  return (
    <group ref={group} {...hot}>
      {limb(legL, -0.11, 0.5, 0.17, 0.46, c.pants, "#2a2420", true)}
      {limb(legR, 0.11, 0.5, 0.17, 0.46, c.pants, "#2a2420", true)}
      <RoundedBox args={[0.48, 0.56, 0.3]} radius={0.12} position={[0, 0.8, 0]} castShadow><Mat color={hex(c.shirt)} roughness={0.9} /></RoundedBox>
      {limb(armL, -0.31, 1.0, 0.13, 0.44, c.shirt, hex(c.skin), false)}
      {limb(armR, 0.31, 1.0, 0.13, 0.44, c.shirt, hex(c.skin), false)}
      <mesh position={[0, 1.1, 0]}><cylinderGeometry args={[0.08, 0.1, 0.08, 14]} /><Mat color={hex(c.skin)} /></mesh>
      <mesh position={[0, 1.37, 0]} castShadow><sphereGeometry args={[0.26, 28, 20]} /><Mat color={hex(c.skin)} roughness={0.6} /></mesh>
      <mesh position={[0, 1.41, -0.015]} castShadow>
        <sphereGeometry args={[0.278, 28, 20, 0, Math.PI * 2, 0, Math.PI * 0.5]} />
        <meshStandardMaterial color={hex(c.hair)} roughness={0.9} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[0, 1.34, -0.07]}><sphereGeometry args={[0.255, 24, 18]} /><Mat color={hex(c.hair)} roughness={0.9} /></mesh>
      {[-0.09, 0.09].map((x) => (
        <mesh key={x} position={[x, 1.36, 0.238]}><sphereGeometry args={[0.032, 12, 10]} /><Mat color="#1b1714" roughness={0.3} /></mesh>
      ))}
      {actor.kind === "customer" && (
        <group position={[0, 1.66, 0]}>
          <mesh castShadow><cylinderGeometry args={[0.36, 0.36, 0.03, 28]} /><Mat color="#2b1d12" /></mesh>
          <mesh position={[0, 0.1, 0]} castShadow><cylinderGeometry args={[0.2, 0.22, 0.2, 24]} /><Mat color="#2b1d12" /></mesh>
        </group>
      )}
      {actor.kind === "verifier" && (
        <group position={[0.36, 0.72, 0.17]}>
          <RoundedBox args={[0.26, 0.34, 0.03]} radius={0.01}><Mat color="#8b5a2b" /></RoundedBox>
          <mesh position={[0, -0.01, 0.017]}><planeGeometry args={[0.21, 0.26]} /><Mat color="#f6f3ea" /></mesh>
          <mesh position={[0, 0.16, 0.02]}><boxGeometry args={[0.09, 0.03, 0.02]} /><meshStandardMaterial color="#b9bec6" metalness={0.8} roughness={0.3} /></mesh>
        </group>
      )}
      {(hover || selected) && (
        <mesh rotation-x={-Math.PI / 2} position={[0, 0.03, 0]}>
          <ringGeometry args={[0.5, 0.64, 40]} />
          <meshBasicMaterial color={selected ? "#6f95ff" : "#ffffff"} transparent opacity={selected ? 0.95 : 0.5} />
        </mesh>
      )}
      <group ref={chip} position={[0, 2.0, 0]}>
      <Html center zIndexRange={[30, 10]}>
        <div className="pointer-events-none flex w-max flex-col items-center gap-1">
          {view.bubble && <div className="max-w-[240px] rounded-xl border-2 border-slate-900 bg-[#fffdf6] px-3 py-1.5 text-center text-[13px] font-medium leading-snug text-slate-900 shadow-lg">{view.bubble}</div>}
          {!view.bubble && view.task && <div className="max-w-[230px] rounded-lg bg-warning px-2.5 py-1 text-center text-[12px] font-semibold leading-snug text-black shadow-md">Task from {view.task}</div>}
          <button
            disabled={!onSelect}
            onClick={() => onSelect?.({ kind: "actor", id: actor.id })}
            className={`flex items-center gap-1.5 rounded-md px-2 py-[3px] text-[12px] font-semibold shadow-md ring-1 ring-black/30 ${onSelect ? "pointer-events-auto" : ""} ${selected ? "bg-primary text-primary-foreground" : "bg-slate-900/85 text-white hover:bg-slate-900"}`}
          >
            <span className="size-2 rounded-full" style={{ background: dot }} />
            {actor.label}
            {view.badge === "go" && <span className="text-success">✓</span>}
            {view.badge === "stop" && <span className="text-destructive">✕</span>}
          </button>
          {/* two short lines, not one long one: seats are about one name chip apart, and a wide pill covers the neighbour's */}
          <div className="line-clamp-2 max-w-[112px] rounded px-1.5 py-0.5 text-center text-[11px] font-semibold leading-tight text-balance wrap-anywhere shadow" style={{ background: `${TONE_HEX[view.tone]}e6`, color: view.tone === "cue" || view.tone === "plain" ? "#0f1012" : "#fff" }}>
            {view.activity}
          </div>
        </div>
      </Html>
      </group>
    </group>
  );
}

// ---------------------------------------------------------------------------- links, flights, door, clock

function Links({ model }: { model: RoomModel }) {
  const [links, setLinks] = useState<{ key: string; a: Actor; b: Actor }[]>([]);
  const lines = useRef<Record<string, { material?: { dashOffset: number } } | null>>({});
  useFrame(({ clock }) => {
    const now = performance.now();
    const live = model.links
      .filter((l) => l.until > now)
      .map((l) => ({ key: `${l.a}-${l.b}-${l.until}`, a: model.actors.get(l.a), b: model.actors.get(l.b) }))
      .filter((l): l is { key: string; a: Actor; b: Actor } => !!l.a && !!l.b);
    if (live.map((l) => l.key).join() !== links.map((l) => l.key).join()) setLinks(live);
    Object.values(lines.current).forEach((line) => {
      if (line?.material) line.material.dashOffset = -clock.elapsedTime * 1.5;
    });
  });
  return (
    <>
      {links.map((l) => (
        <QuadraticBezierLine
          key={l.key}
          ref={(r: unknown) => { lines.current[l.key] = r as { material?: { dashOffset: number } } | null; }}
          start={[l.a.x, 1.15, l.a.z]}
          end={[l.b.x, 1.15, l.b.z]}
          mid={[(l.a.x + l.b.x) / 2, 2.4, (l.a.z + l.b.z) / 2]}
          color="#6f95ff"
          lineWidth={3}
          dashed
          dashScale={6}
          dashSize={1}
          gapSize={0.6}
        />
      ))}
    </>
  );
}

function Flights({ model }: { model: RoomModel }) {
  const [items, setItems] = useState<{ key: string; label?: string }[]>([]);
  const groups = useRef<Record<string, THREE.Group | null>>({});
  useFrame(() => {
    const now = performance.now();
    model.flights = model.flights.filter((f) => now - f.start < (f.label ? 1800 : 1000));
    const keyed = model.flights.map((f) => ({ key: `${f.start}-${f.fx}-${f.tx}`, label: f.label, f }));
    if (keyed.map((k) => k.key).join() !== items.map((k) => k.key).join()) setItems(keyed.map(({ key, label }) => ({ key, label })));
    keyed.forEach(({ key, f }) => {
      const g = groups.current[key];
      if (!g) return;
      const t = Math.min(1, (now - f.start) / (f.label ? 1800 : 1000));
      g.position.set(f.fx + (f.tx - f.fx) * t, 1.4 + Math.sin(t * Math.PI) * 1.6, f.fz + (f.tz - f.fz) * t);
      g.rotation.y = t * 6;
    });
  });
  return (
    <>
      {items.map((it) => (
        <group key={it.key} ref={(g) => { groups.current[it.key] = g; }}>
          <RoundedBox args={[0.36, 0.06, 0.26]} radius={0.02} castShadow><Mat color="#fbf8ef" /></RoundedBox>
          {it.label && (
            <Html position={[0, 0.4, 0]} center zIndexRange={[40, 20]}>
              <div className="pointer-events-none whitespace-nowrap rounded-md bg-[#dfe8ff] px-2 py-0.5 text-[12px] font-semibold text-slate-900 shadow-md">{it.label}</div>
            </Html>
          )}
        </group>
      ))}
    </>
  );
}

function Door({ model, doorRef }: { model: RoomModel; doorRef: React.RefObject<THREE.Group | null> }) {
  useFrame(() => {
    if (doorRef.current) doorRef.current.rotation.y = THREE.MathUtils.lerp(doorRef.current.rotation.y, performance.now() < model.doorOpenUntil ? -1.2 : 0, 0.1);
  });
  return null;
}

function Clock({ model, queue, onBeat, bump }: { model: React.RefObject<RoomModel>; queue: React.RefObject<RhEvent[]>; onBeat?: (ev: RhEvent) => void; bump: () => void }) {
  const next = useRef(0);
  const last = useRef(performance.now());
  useFrame(() => {
    const m = model.current;
    const now = performance.now();
    if (queue.current.length && now >= next.current) {
      const ev = queue.current.shift()!;
      const before = m.version + m.actors.size;
      m.apply(ev, now);
      onBeat?.(ev);
      if (m.version + m.actors.size !== before) bump();
      next.current = now + (queue.current.length > 3 ? 300 : 1000);
    }
    m.step(Math.max(0, now - last.current), false, now);
    last.current = now;
  });
  return null;
}

// ---------------------------------------------------------------------------- component

// looking down on the room from the front, steeper than eye level, so the whole floor plan reads at once
const VIEW_DIR = new THREE.Vector3(0, 13.5, 10.5).normalize();
// what must stay in frame: [x, y, z, half width incl. activity pill]: the desk row ends, the validator's corner,
// the outer seats, the door in episodes, and the room's walls (the near strip of floor may crop)
const WALLS: [number, number, number, number][] = [[0.3, 3.1, 0, 0], [ROOM_W - 0.3, 3.1, 0, 0], [2, 0.5, ROOM_D - 1.8, 0], [ROOM_W - 2, 0.5, ROOM_D - 1.8, 0]];
const KEEP: Record<"compiler" | "episode", [number, number, number, number][]> = {
  compiler: [[3.5, 2.9, 1.3, 0.4], [18.4, 2.9, 1.3, 0.4], [3.6, 2.2, 7.6, 1.9], [16.4, 2.2, 7.4, 1.9], ...WALLS],
  episode: [[3.5, 2.9, 1.3, 0.4], [18.4, 2.9, 1.3, 0.4], [3.6, 2.2, 7.6, 1.9], [16.4, 2.2, 7.4, 1.9], [20.6, 2.2, 2.9, 1.9], ...WALLS],
};
const TARGET = new THREE.Vector3(ROOM_W / 2, 0.4, 5.6);

/** The warm sun through the left window; it casts the room's shadows. */
function Sun() {
  const light = useRef<THREE.DirectionalLight>(null);
  useEffect(() => {
    // the target is not in the scene graph, so place it once by hand
    light.current?.target.position.set(ROOM_W / 2, 0, ROOM_D / 2);
    light.current?.target.updateMatrixWorld();
  }, []);
  return (
    <directionalLight
      ref={light}
      position={[2, 18, 12]}
      color="#ffeccc"
      intensity={1.9}
      castShadow
      shadow-mapSize={[2048, 2048]}
      shadow-camera-left={-17}
      shadow-camera-right={17}
      shadow-camera-top={13}
      shadow-camera-bottom={-13}
      shadow-camera-far={60}
      shadow-bias={-0.0004}
    />
  );
}

/** Pulls the camera back just far enough that the room, every desk, person, and name chip fit the canvas. */
function FitCamera({ mode }: { mode: "compiler" | "episode" }) {
  const camera = useThree((st) => st.camera);
  const size = useThree((st) => st.size);
  useEffect(() => {
    const cam = camera as THREE.PerspectiveCamera;
    const halfHeight = Math.tan(THREE.MathUtils.degToRad(cam.fov / 2));
    const halfWidth = halfHeight * (size.width / Math.max(1, size.height));
    const target = TARGET;
    // a point closer to the camera than the target sees a narrower slice, so it needs the camera further back;
    // the screen's up direction is VIEW_DIR turned a quarter turn in the y-z plane
    const need = KEEP[mode].flatMap(([x, y, z, half]) => {
      const dy = y - target.y;
      const dz = z - target.z;
      const toward = dy * VIEW_DIR.y + dz * VIEW_DIR.z;
      return [(Math.abs(x - target.x) + half) / halfWidth + toward, Math.abs(dy * VIEW_DIR.z - dz * VIEW_DIR.y) / halfHeight + toward];
    });
    const d = THREE.MathUtils.clamp(Math.max(...need), 16, 48);
    cam.position.copy(target).addScaledVector(VIEW_DIR, d);
    cam.lookAt(target); // OrbitControls re-reads the camera position on its next update
  }, [camera, size.width, size.height, mode]);
  return null;
}

export function Stage({
  events,
  mode,
  label,
  onBeat,
  onSelect,
  selected,
  height = "min(54vw, 60vh)",
}: {
  events: RhEvent[];
  mode: "episode" | "compiler";
  label: string;
  onBeat?: (ev: RhEvent) => void;
  onSelect?: (s: Selection | null) => void;
  selected?: Selection | null;
  height?: string;
}) {
  const model = useRef<RoomModel>(new RoomModel(mode));
  const applied = useRef(0);
  const queue = useRef<RhEvent[]>([]);
  const [, setVersion] = useState(0);
  const bump = () => setVersion((v) => v + 1);
  const doorRef = useRef<THREE.Group>(null);
  const [banner, setBanner] = useState<{ text: string; tone: Tone } | null>(null);
  // drei <Html> labels mounted in the canvas's first commit can lose their DOM to a React 19 root race; mount them after the first frame
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (model.current.mode !== mode || events.length < applied.current) {
      model.current = new RoomModel(mode);
      applied.current = 0;
      queue.current = [];
      bump();
    }
    const fresh = events.slice(applied.current);
    applied.current = events.length;
    // history lands instantly; only the newest beats animate so the room never lags
    const past = performance.now() - 600_000;
    const pending = [...queue.current, ...fresh];
    const before = model.current.version + model.current.actors.size;
    pending.slice(0, Math.max(0, pending.length - 6)).forEach((e) => model.current.apply(e, past));
    queue.current = pending.slice(-6);
    if (model.current.version + model.current.actors.size !== before) bump();
  }, [events, mode]);

  useEffect(() => {
    const t = setInterval(() => {
      const b = model.current.banner;
      const active = b && b.until > performance.now() ? { text: b.text, tone: b.tone } : null;
      setBanner((cur) => (cur?.text === active?.text ? cur : active));
    }, 250);
    return () => clearInterval(t);
  }, []);

  const select = (s: Selection | null) => onSelect?.(s);
  const m = model.current;
  return (
    <div className="relative overflow-hidden rounded-xl border bg-[#140f0b]" style={{ height }} role="img" aria-label={label}>
      <Canvas shadows dpr={[1, 2]} camera={{ position: [12, 16, 17], fov: 30 }} onPointerMissed={() => select(null)} onCreated={() => requestAnimationFrame(() => setReady(true))}>
        <color attach="background" args={["#140f0b"]} />
        <hemisphereLight args={["#fff1dc", "#5a3d26", 0.65]} />
        <Sun />
        <Environment resolution={256} frames={1}>
          <Lightformer intensity={2.0} position={[0, 6, 10]} scale={[18, 6, 1]} color="#fff0d8" />
          <Lightformer intensity={1.2} position={[-10, 3, 4]} rotation-y={Math.PI / 2} scale={[10, 4, 1]} color="#ffe2b8" />
          <Lightformer intensity={0.8} position={[10, 3, 4]} rotation-y={-Math.PI / 2} scale={[10, 4, 1]} color="#ffd9a8" />
        </Environment>
        <Room mode={mode} doorRef={doorRef} />
        {ready && m.desks.map((d, i) => (
          <DeskPiece key={`${d.id}-${m.version}`} desk={d} model={m} seed={i} onSelect={onSelect && select} selected={selected?.kind === "desk" && selected.id === d.id} />
        ))}
        {ready && [...m.actors.values()].map((a) => (
          <Person key={a.id} actor={a} onSelect={onSelect && select} selected={selected?.kind === "actor" && selected.id === a.id} />
        ))}
        <Links model={m} />
        <Flights model={m} />
        <Door model={m} doorRef={doorRef} />
        <ContactShadows position={[12, 0.02, 6.5]} scale={30} opacity={0.3} blur={2.4} far={4} />
        <Clock model={model} queue={queue} onBeat={onBeat} bump={bump} />
        <FitCamera mode={mode} />
        <OrbitControls makeDefault target={TARGET} enablePan={false} enableZoom={false} enableDamping minDistance={12} maxDistance={52} minPolarAngle={0.35} maxPolarAngle={1.2} minAzimuthAngle={-0.8} maxAzimuthAngle={0.8} />
      </Canvas>
      {banner && (
        <div className={`pointer-events-none absolute left-1/2 top-3 -translate-x-1/2 rounded-lg px-4 py-1.5 text-sm font-semibold shadow-lg ${banner.tone === "go" ? "bg-success text-white" : banner.tone === "stop" ? "bg-destructive text-white" : "bg-primary text-primary-foreground"}`}>
          {banner.text}
        </div>
      )}
      <div className="pointer-events-none absolute bottom-2 right-3 text-xs text-white/50">{onSelect ? "Click a person or desk to inspect; drag to look around" : "Drag to look around"}</div>
    </div>
  );
}
