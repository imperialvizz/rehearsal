"use client";

import { RoundedBox } from "@react-three/drei";
import { useMemo } from "react";
import * as THREE from "three";

/**
 * Furniture, hardware and decoration for the rehearsal room: a warm, lived-in office seen from above, with
 * workstations, server racks and storage arrays drawn in enough detail to read as the real thing. Surfaces are
 * painted once into canvas textures and shared. Nothing here moves on its own; Stage animates screens and lights.
 */

type V3 = [number, number, number];
type MatRef = React.Ref<THREE.MeshStandardMaterial>;

export function Mat({ color, ...rest }: { color: string } & Record<string, unknown>) {
  return <meshStandardMaterial color={color} roughness={0.75} {...rest} />;
}

/** A repeatable random sequence, so the room looks the same on every load. */
export function rand(seed: number) {
  let s = seed % 2147483647 || 1;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

// ---------------------------------------------------------------------------- painted textures

type Draw = (g: CanvasRenderingContext2D, r: () => number) => void;
const made = new Map<string, THREE.CanvasTexture>();

function paint(key: string, w: number, h: number, draw: Draw, repeat?: [number, number]) {
  const hit = made.get(key);
  if (hit) return hit;
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  let seed = 7;
  for (const ch of key) seed = (seed * 31 + ch.charCodeAt(0)) >>> 0;
  draw(c.getContext("2d")!, rand(seed));
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  if (repeat) {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(repeat[0], repeat[1]);
  }
  made.set(key, t);
  return t;
}

function speckle(g: CanvasRenderingContext2D, w: number, h: number, r: () => number, n: number, dark: string, light: string) {
  for (let i = 0; i < n; i++) {
    g.fillStyle = r() < 0.5 ? dark : light;
    g.fillRect(r() * w, r() * h, 2, 2);
  }
}

/** Oak planks, about 37 cm wide and 1.5 to 4 m long once repeated over the floor. */
export const floorTexture = () =>
  paint("floor", 1024, 1024, (g, r) => {
    const tones = ["#a8743f", "#b07c4a", "#9c6a3a", "#b58553", "#a5703f", "#966335"];
    for (let y = 0; y < 1024; y += 64) {
      let x = -Math.floor(r() * 400);
      while (x < 1024) {
        const len = 260 + Math.floor(r() * 380);
        g.fillStyle = tones[Math.floor(r() * tones.length)];
        g.fillRect(x, y, len, 64);
        g.strokeStyle = "rgba(94,59,31,0.14)";
        for (let k = 0; k < 7; k++) {
          const gy = y + 6 + r() * 52;
          g.lineWidth = 1 + r();
          g.beginPath();
          g.moveTo(x, gy);
          g.bezierCurveTo(x + len * 0.3, gy + (r() - 0.5) * 8, x + len * 0.6, gy + (r() - 0.5) * 8, x + len, gy + (r() - 0.5) * 4);
          g.stroke();
        }
        g.fillStyle = "#6e4526";
        g.fillRect(x + len - 2, y, 2, 64);
        x += len;
      }
      g.fillStyle = "#6e4526";
      g.fillRect(0, y + 62, 1024, 2);
    }
    speckle(g, 1024, 1024, r, 6000, "rgba(70,40,20,0.08)", "rgba(255,230,190,0.06)");
  }, [4, 2.2]);

const woodTexture = () =>
  paint("wood", 512, 512, (g, r) => {
    g.fillStyle = "#b07a4a";
    g.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 140; i++) {
      const y = r() * 512;
      g.strokeStyle = r() < 0.5 ? `rgba(90,55,28,${0.08 + r() * 0.14})` : `rgba(214,165,112,${0.08 + r() * 0.12})`;
      g.lineWidth = 1 + r() * 2;
      g.beginPath();
      g.moveTo(0, y);
      for (let x = 0; x <= 512; x += 64) g.lineTo(x, y + Math.sin(x / 90 + i) * 4 + (r() - 0.5) * 2);
      g.stroke();
    }
  });

const rugTexture = () =>
  paint("rug", 1024, 512, (g, r) => {
    g.fillStyle = "#e8d6b5";
    g.fillRect(0, 0, 1024, 512);
    const band = (inset: number, width: number, color: string) => {
      g.strokeStyle = color;
      g.lineWidth = width;
      g.strokeRect(inset, inset, 1024 - inset * 2, 512 - inset * 2);
    };
    band(16, 24, "#b8724a");
    band(44, 6, "#8c4f32");
    band(66, 16, "#d9a066");
    band(90, 4, "#8c4f32");
    const diamond = (x: number, y: number, s: number) => {
      g.beginPath();
      g.moveTo(x, y - s);
      g.lineTo(x + s, y);
      g.lineTo(x, y + s);
      g.lineTo(x - s, y);
      g.fill();
    };
    g.fillStyle = "#f1e4c8";
    for (let x = 34; x < 1000; x += 34) {
      diamond(x, 16, 7);
      diamond(x, 496, 7);
    }
    for (let y = 34; y < 490; y += 34) {
      diamond(16, y, 7);
      diamond(1008, y, 7);
    }
    g.fillStyle = "#d8b98f";
    diamond(512, 256, 120);
    g.fillStyle = "#e8d6b5";
    diamond(512, 256, 96);
    g.fillStyle = "#c98c5c";
    diamond(512, 256, 40);
    g.strokeStyle = "#c98c5c";
    g.lineWidth = 5;
    g.beginPath();
    g.ellipse(512, 256, 260, 130, 0, 0, Math.PI * 2);
    g.stroke();
    speckle(g, 1024, 512, r, 14000, "rgba(120,80,40,0.07)", "rgba(255,255,255,0.07)");
  });

const roundRugTexture = () =>
  paint("round-rug", 512, 512, (g, r) => {
    const rings: [string, number][] = [["#a94b29", 256], ["#d27a4a", 238], ["#b5532e", 224], ["#c8673b", 204], ["#e09a62", 128], ["#c8673b", 110], ["#b5532e", 44]];
    rings.forEach(([c, rad]) => {
      g.fillStyle = c;
      g.beginPath();
      g.arc(256, 256, rad, 0, Math.PI * 2);
      g.fill();
    });
    speckle(g, 512, 512, r, 6000, "rgba(90,40,20,0.08)", "rgba(255,220,180,0.08)");
  });

/** An editor with a file tree and highlighted code; the screen's colour tints it. */
const codeTexture = (seed: number) =>
  paint(`code-${seed}`, 512, 300, (g, r) => {
    g.fillStyle = "#0d1117";
    g.fillRect(0, 0, 512, 300);
    g.fillStyle = "#161b22";
    g.fillRect(0, 0, 512, 22);
    g.fillRect(0, 22, 92, 278);
    g.fillStyle = "#30507f";
    g.fillRect(96, 4, 70, 18);
    g.fillStyle = "#30363d";
    for (let y = 34; y < 290; y += 14) g.fillRect(10 + (r() < 0.35 ? 10 : 0), y, 30 + r() * 44, 6);
    const colors = ["#ff7b72", "#79c0ff", "#d2a8ff", "#7ee787", "#e6edf3", "#8b949e", "#ffa657"];
    let indent = 0;
    for (let y = 32; y < 292; y += 12) {
      g.fillStyle = "#3b434d";
      g.fillRect(100, y, 12, 5);
      indent = Math.max(0, Math.min(4, indent + (r() < 0.3 ? 1 : r() < 0.35 ? -1 : 0)));
      let x = 122 + indent * 16;
      const words = 1 + Math.floor(r() * 5);
      for (let w = 0; w < words && x < 500; w++) {
        const len = 14 + r() * 50;
        g.fillStyle = colors[Math.floor(r() * colors.length)];
        g.fillRect(x, y, Math.min(len, 506 - x), 5);
        x += len + 6;
      }
    }
  });

const keyboardTexture = () =>
  paint("keyboard", 256, 96, (g) => {
    g.fillStyle = "#1c1f24";
    g.fillRect(0, 0, 256, 96);
    g.fillStyle = "#3a3f47";
    for (let row = 0; row < 5; row++) for (let k = 0; k < 14; k++) g.fillRect(6 + k * 17.6 + (row % 2) * 4, 6 + row * 17, 14, 13);
    g.fillRect(70, 74, 110, 13);
  });

const grilleTexture = () =>
  paint("grille", 128, 256, (g) => {
    g.fillStyle = "#202329";
    g.fillRect(0, 0, 128, 256);
    g.fillStyle = "#0c0d10";
    for (let y = 8; y < 248; y += 7) for (let x = 8 + ((y / 7) % 2) * 3; x < 120; x += 7) g.fillRect(x, y, 4, 4);
  });

type UnitKind = "1u" | "2u" | "switch" | "storage" | "blank";
const UNIT_PX: Record<UnitKind, number> = { "1u": 40, "2u": 80, switch: 40, storage: 160, blank: 40 };

/** The front of one rack unit: drive bays with activity lights, switch ports, or vents. */
const unitTexture = (kind: UnitKind) =>
  paint(`unit-${kind}`, 512, UNIT_PX[kind], (g, r) => {
    const h = UNIT_PX[kind];
    const face = g.createLinearGradient(0, 0, 0, h);
    face.addColorStop(0, "#4a5058");
    face.addColorStop(1, "#2c3036");
    g.fillStyle = face;
    g.fillRect(0, 0, 512, h);
    g.fillStyle = "#1e2125";
    g.fillRect(0, 0, 16, h);
    g.fillRect(496, 0, 16, h);
    g.fillStyle = "#a3a9b1";
    for (const x of [8, 504]) for (let y = 12; y < h; y += 30) {
      g.beginPath();
      g.arc(x, y, 3, 0, Math.PI * 2);
      g.fill();
    }
    const vents = (x0: number, x1: number) => {
      g.fillStyle = "#16181b";
      for (let y = 6; y < h - 4; y += 6) for (let x = x0; x < x1; x += 7) g.fillRect(x, y, 4, 3);
    };
    const bay = (x: number, y: number, w: number, bh: number) => {
      g.fillStyle = "#1a1c20";
      g.fillRect(x, y, w, bh);
      g.fillStyle = "#6a717a";
      g.fillRect(x + 2, y + 2, w - 4, 3);
      g.fillStyle = "#2c2f35";
      for (let k = x + 4; k < x + w - 12; k += 5) g.fillRect(k, y + 8, 2, bh - 12);
      g.fillStyle = r() < 0.8 ? "#3ddc84" : "#ffb020";
      g.fillRect(x + w - 8, y + bh - 8, 4, 4);
    };
    const power = (x: number, y: number) => {
      g.fillStyle = "#0f1012";
      g.beginPath();
      g.arc(x, y, 7, 0, Math.PI * 2);
      g.fill();
      g.strokeStyle = "#4da3ff";
      g.lineWidth = 2;
      g.stroke();
    };
    if (kind === "blank") vents(30, 482);
    if (kind === "1u") {
      for (let i = 0; i < 8; i++) bay(28 + i * 34, 5, 30, 30);
      vents(310, 450);
      power(472, 20);
    }
    if (kind === "2u") {
      for (let row = 0; row < 2; row++) for (let i = 0; i < 6; i++) bay(28 + i * 52, 6 + row * 36, 48, 32);
      vents(350, 450);
      power(472, 40);
    }
    if (kind === "storage") for (let row = 0; row < 3; row++) for (let i = 0; i < 4; i++) bay(28 + i * 115, 8 + row * 50, 110, 46);
    if (kind === "switch") {
      for (let i = 0; i < 12; i++) for (let row = 0; row < 2; row++) {
        const x = 40 + i * 24 + Math.floor(i / 6) * 10;
        const y = 5 + row * 16;
        g.fillStyle = "#0e0f11";
        g.fillRect(x, y, 18, 13);
        g.fillStyle = r() < 0.7 ? "#3ddc84" : "#ffb020";
        g.fillRect(x + 2, y + 1, 3, 2);
      }
      g.fillStyle = "#0e0f11";
      for (let i = 0; i < 4; i++) g.fillRect(380 + i * 26, 9, 20, 22);
    }
  });

const viewTexture = () =>
  paint("view", 512, 320, (g, r) => {
    const sky = g.createLinearGradient(0, 0, 0, 200);
    sky.addColorStop(0, "#74bff0");
    sky.addColorStop(1, "#dcf2ff");
    g.fillStyle = sky;
    g.fillRect(0, 0, 512, 320);
    g.fillStyle = "rgba(255,255,255,0.85)";
    for (let i = 0; i < 5; i++) {
      const x = r() * 512;
      const y = 30 + r() * 70;
      for (let k = 0; k < 4; k++) {
        g.beginPath();
        g.ellipse(x + k * 18, y + (k % 2) * 6, 22, 12, 0, 0, Math.PI * 2);
        g.fill();
      }
    }
    const hill = (y: number, color: string, amp: number) => {
      g.fillStyle = color;
      g.beginPath();
      g.moveTo(0, 320);
      for (let x = 0; x <= 512; x += 16) g.lineTo(x, y + Math.sin(x / 70 + y) * amp);
      g.lineTo(512, 320);
      g.fill();
    };
    hill(170, "#a7cf8c", 14);
    hill(205, "#80b66b", 10);
    const greens = ["#4f8f46", "#3f7a3a", "#5ea54f", "#6fb35c"];
    for (let i = 0; i < 46; i++) {
      const x = r() * 512;
      const y = 220 + r() * 90;
      const s = 12 + r() * 20;
      g.fillStyle = "#5a3d22";
      g.fillRect(x - 2, y, 4, s * 0.8);
      g.fillStyle = greens[i % greens.length];
      g.beginPath();
      g.arc(x, y, s, 0, Math.PI * 2);
      g.fill();
    }
  });

/** Light from a window falling on the floor: four soft panes. */
const sunTexture = () =>
  paint("sun", 256, 256, (g) => {
    g.filter = "blur(10px)";
    g.fillStyle = "rgba(255,214,150,0.9)";
    for (const [x, y] of [[24, 24], [134, 24], [24, 134], [134, 134]]) g.fillRect(x, y, 98, 98);
  });

const boardTexture = () =>
  paint("board", 512, 290, (g) => {
    g.fillStyle = "#f8f9f7";
    g.fillRect(0, 0, 512, 290);
    g.lineWidth = 4;
    g.strokeStyle = "#2a5bd7";
    g.font = "bold 20px 'Comic Sans MS', 'Segoe Print', cursive";
    g.fillStyle = "#2a5bd7";
    ["login", "refund", "escalate"].forEach((word, i) => {
      g.strokeRect(30 + i * 150, 40, 120, 54);
      g.fillText(word, 44 + i * 150, 74);
    });
    g.strokeStyle = "#d64545";
    g.lineWidth = 3;
    for (let i = 0; i < 2; i++) {
      const x = 152 + i * 150;
      g.beginPath();
      g.moveTo(x, 67);
      g.lineTo(x + 26, 67);
      g.lineTo(x + 18, 60);
      g.moveTo(x + 26, 67);
      g.lineTo(x + 18, 74);
      g.stroke();
    }
    g.strokeStyle = "#2f9e6e";
    g.lineWidth = 4;
    for (let i = 0; i < 4; i++) {
      const y = 140 + i * 30;
      g.beginPath();
      g.moveTo(34, y);
      g.lineTo(42, y + 8);
      g.lineTo(56, y - 8);
      g.stroke();
      g.strokeStyle = "#555b66";
      g.lineWidth = 3;
      g.beginPath();
      g.moveTo(70, y);
      g.lineTo(150 + ((i * 53) % 120), y);
      g.stroke();
      g.strokeStyle = "#2f9e6e";
      g.lineWidth = 4;
    }
    const notes: [number, number, string][] = [[330, 130, "#ffe066"], [410, 140, "#ff9ebb"], [350, 205, "#a6e3a1"], [430, 212, "#ffe066"]];
    notes.forEach(([x, y, c]) => {
      g.fillStyle = c;
      g.fillRect(x, y, 62, 58);
      g.fillStyle = "rgba(0,0,0,0.25)";
      for (let k = 0; k < 3; k++) g.fillRect(x + 8, y + 14 + k * 12, 40 - k * 8, 3);
    });
  });

const corkTexture = () =>
  paint("cork", 256, 192, (g, r) => {
    g.fillStyle = "#b98a5a";
    g.fillRect(0, 0, 256, 192);
    speckle(g, 256, 192, r, 3000, "rgba(90,55,25,0.35)", "rgba(240,200,150,0.3)");
    const notes: [number, number, string, number][] = [[24, 20, "#fff4c2", -0.08], [120, 30, "#ffffff", 0.06], [40, 104, "#cde7ff", 0.05], [150, 110, "#ffd6e0", -0.06]];
    notes.forEach(([x, y, c, a]) => {
      g.save();
      g.translate(x + 40, y + 30);
      g.rotate(a);
      g.fillStyle = c;
      g.fillRect(-40, -30, 80, 60);
      g.fillStyle = "rgba(60,60,60,0.35)";
      for (let k = 0; k < 3; k++) g.fillRect(-30, -14 + k * 12, 56 - k * 10, 3);
      g.fillStyle = "#d64545";
      g.beginPath();
      g.arc(0, -24, 5, 0, Math.PI * 2);
      g.fill();
      g.restore();
    });
  });

const certificateTexture = () =>
  paint("certificate", 256, 192, (g) => {
    g.fillStyle = "#f6efdc";
    g.fillRect(0, 0, 256, 192);
    g.strokeStyle = "#b8923a";
    g.lineWidth = 6;
    g.strokeRect(12, 12, 232, 168);
    g.fillStyle = "#6b5a3a";
    g.fillRect(60, 40, 136, 10);
    for (let k = 0; k < 4; k++) g.fillRect(40, 72 + k * 16, 176 - (k % 2) * 30, 4);
    g.fillStyle = "#c0392b";
    g.beginPath();
    g.arc(196, 148, 16, 0, Math.PI * 2);
    g.fill();
  });

const ribsTexture = () =>
  paint("ribs", 256, 128, (g) => {
    g.fillStyle = "#ffffff";
    g.fillRect(0, 0, 256, 128);
    for (let x = 0; x < 256; x += 12) {
      g.fillStyle = "#c7c7c7";
      g.fillRect(x, 0, 4, 128);
      g.fillStyle = "#e6e6e6";
      g.fillRect(x + 4, 0, 3, 128);
    }
    g.fillStyle = "#9a9a9a";
    g.fillRect(0, 0, 256, 8);
    g.fillRect(0, 120, 256, 8);
  });

// ---------------------------------------------------------------------------- the room's shell

/** A wall from local x=0 to x=length; its inside face is at z=0 and faces +z. Low walls close the near side. */
export function WallRun({ length, position, rotation = 0, low = false }: { length: number; position: V3; rotation?: number; low?: boolean }) {
  const h = low ? 0.45 : 3.0;
  return (
    <group position={position} rotation-y={rotation}>
      <mesh position={[length / 2, h / 2, -0.15]} receiveShadow>
        <boxGeometry args={[length + 0.6, h, 0.3]} />
        <Mat color={low ? "#7a4f2e" : "#efe1c4"} roughness={0.95} />
      </mesh>
      {!low && (
        <>
          <mesh position={[length / 2, 0.5, 0.015]} receiveShadow>
            <boxGeometry args={[length, 1.0, 0.03]} />
            <Mat color="#9a6a43" />
          </mesh>
          <mesh position={[length / 2, 1.02, 0.03]}>
            <boxGeometry args={[length, 0.05, 0.05]} />
            <Mat color="#6b4423" />
          </mesh>
        </>
      )}
      <mesh position={[length / 2, 0.06, 0.035]}>
        <boxGeometry args={[length, 0.12, 0.04]} />
        <Mat color="#4a2e1b" />
      </mesh>
      <mesh position={[length / 2, h + 0.06, -0.15]} castShadow>
        <boxGeometry args={[length + 0.6, 0.12, 0.42]} />
        <Mat color="#5a3820" />
      </mesh>
    </group>
  );
}

export function Floor({ width, depth }: { width: number; depth: number }) {
  return (
    <group>
      <mesh rotation-x={-Math.PI / 2} position={[width / 2, -0.02, depth / 2]} receiveShadow>
        <planeGeometry args={[90, 70]} />
        <Mat color="#16110d" />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position={[width / 2, 0, depth / 2]} receiveShadow>
        <planeGeometry args={[width, depth]} />
        <meshStandardMaterial map={floorTexture()} roughness={0.7} />
      </mesh>
    </group>
  );
}

/** A window in a wall, with a view outside, blinds, mullions and a sill. Faces +z. */
export function WallWindow({ position, rotation = 0, w = 2.4, h = 1.4 }: { position: V3; rotation?: number; w?: number; h?: number }) {
  const slats = Math.floor((h * 0.32) / 0.045);
  return (
    <group position={position} rotation-y={rotation}>
      <mesh position={[0, 0, 0.005]}>
        <planeGeometry args={[w, h]} />
        <meshBasicMaterial map={viewTexture()} toneMapped={false} />
      </mesh>
      {[[0, h / 2, w + 0.16, 0.08], [0, -h / 2, w + 0.16, 0.08], [0, 0, 0.06, h], [0, 0, w, 0.05]].map(([x, y, bw, bh], i) => (
        <mesh key={i} position={[x, y, 0.04]} castShadow>
          <boxGeometry args={[bw, bh, 0.08]} />
          <Mat color="#6b4423" />
        </mesh>
      ))}
      {[-1, 1].map((s) => (
        <mesh key={s} position={[(s * (w + 0.08)) / 2, 0, 0.04]}>
          <boxGeometry args={[0.08, h + 0.16, 0.08]} />
          <Mat color="#6b4423" />
        </mesh>
      ))}
      {Array.from({ length: slats }, (_, i) => (
        <mesh key={i} position={[0, h / 2 - 0.05 - i * 0.045, 0.07]} rotation-x={0.35}>
          <boxGeometry args={[w - 0.04, 0.035, 0.006]} />
          <Mat color="#ece0c4" />
        </mesh>
      ))}
      <mesh position={[0, -h / 2 - 0.06, 0.09]} castShadow>
        <boxGeometry args={[w + 0.3, 0.05, 0.18]} />
        <Mat color="#7a4f2e" />
      </mesh>
    </group>
  );
}

/** Window light on the floor. */
export function SunPatch({ position, size, rotation = 0 }: { position: V3; size: [number, number]; rotation?: number }) {
  return (
    <mesh rotation={[-Math.PI / 2, 0, rotation]} position={position}>
      <planeGeometry args={size} />
      <meshBasicMaterial map={sunTexture()} transparent opacity={0.38} blending={THREE.AdditiveBlending} depthWrite={false} />
    </mesh>
  );
}

export function Frame({ position, rotation = 0, w = 0.5, h = 0.38, picture }: { position: V3; rotation?: number; w?: number; h?: number; picture: "view" | "cork" | "certificate" }) {
  const map = picture === "view" ? viewTexture() : picture === "cork" ? corkTexture() : certificateTexture();
  return (
    <group position={position} rotation-y={rotation}>
      <mesh castShadow>
        <boxGeometry args={[w + 0.07, h + 0.07, 0.03]} />
        <Mat color={picture === "cork" ? "#7a4f2e" : "#4a2e1b"} />
      </mesh>
      <mesh position={[0, 0, 0.016]}>
        <planeGeometry args={[w, h]} />
        <meshStandardMaterial map={map} roughness={0.6} />
      </mesh>
    </group>
  );
}

export function Rug({ position, size }: { position: V3; size: [number, number] }) {
  return (
    <mesh rotation-x={-Math.PI / 2} position={position} receiveShadow>
      <planeGeometry args={size} />
      <meshStandardMaterial map={rugTexture()} roughness={0.95} />
    </mesh>
  );
}

export function RoundRug({ position, radius }: { position: V3; radius: number }) {
  return (
    <mesh rotation-x={-Math.PI / 2} position={position} receiveShadow>
      <circleGeometry args={[radius, 48]} />
      <meshStandardMaterial map={roundRugTexture()} roughness={0.95} />
    </mesh>
  );
}

// ---------------------------------------------------------------------------- furniture

/** A walnut desk: top, a drawer pedestal on the left, a panel leg on the right, and a modesty panel. Front is +z. */
export function OfficeDesk({ w = 1.8, d = 0.8 }: { w?: number; d?: number }) {
  const wood = woodTexture();
  return (
    <group>
      <RoundedBox args={[w, 0.05, d]} radius={0.015} position={[0, 0.765, 0]} castShadow receiveShadow>
        <meshStandardMaterial map={wood} color="#c99a70" roughness={0.5} />
      </RoundedBox>
      <mesh position={[-w / 2 + 0.24, 0.37, 0]} castShadow>
        <boxGeometry args={[0.44, 0.74, d - 0.06]} />
        <meshStandardMaterial map={wood} color="#8a6448" roughness={0.6} />
      </mesh>
      {[0.6, 0.37, 0.14].map((y) => (
        <group key={y} position={[-w / 2 + 0.24, y, d / 2 - 0.025]}>
          <mesh>
            <boxGeometry args={[0.4, 0.2, 0.012]} />
            <meshStandardMaterial map={wood} color="#a07a58" roughness={0.6} />
          </mesh>
          <mesh position={[0, 0.04, 0.012]}>
            <boxGeometry args={[0.14, 0.018, 0.018]} />
            <meshStandardMaterial color="#c8a165" metalness={0.8} roughness={0.3} />
          </mesh>
        </group>
      ))}
      <mesh position={[w / 2 - 0.03, 0.37, 0]} castShadow>
        <boxGeometry args={[0.04, 0.74, d - 0.06]} />
        <meshStandardMaterial map={wood} color="#8a6448" />
      </mesh>
      <mesh position={[0.2, 0.45, -d / 2 + 0.04]}>
        <boxGeometry args={[w - 0.5, 0.5, 0.02]} />
        <meshStandardMaterial map={wood} color="#7a5638" />
      </mesh>
    </group>
  );
}

/** The long table in the middle of the room, on two trestles. */
export function MeetingTable({ position }: { position: V3 }) {
  const wood = woodTexture();
  return (
    <group position={position}>
      <RoundedBox args={[6.2, 0.07, 1.6]} radius={0.03} position={[0, 0.76, 0]} castShadow receiveShadow>
        <meshStandardMaterial map={wood} color="#b98d66" roughness={0.45} />
      </RoundedBox>
      {[-2.4, 2.4].map((x) => (
        <group key={x} position={[x, 0, 0]}>
          <mesh position={[0, 0.38, 0]} castShadow>
            <boxGeometry args={[0.08, 0.72, 0.9]} />
            <Mat color="#4f3220" />
          </mesh>
          <mesh position={[0, 0.03, 0]} castShadow>
            <boxGeometry args={[0.12, 0.06, 1.3]} />
            <Mat color="#3f2818" />
          </mesh>
        </group>
      ))}
      <mesh position={[0, 0.18, 0]}>
        <boxGeometry args={[4.8, 0.06, 0.06]} />
        <Mat color="#4f3220" />
      </mesh>
    </group>
  );
}

const BOOK_COLORS = ["#7b2d26", "#2f4b7c", "#3c6e47", "#c19a3f", "#5a3d6b", "#8c4a2f", "#2b5f6b", "#d8c8a8", "#1f2a44", "#a3412d"];

/** A row of books standing between bookends, a few lying flat. Starts at local x=0 and runs along +x. */
function BookRow({ width, seed, maxH = 0.28 }: { width: number; seed: number; maxH?: number }) {
  const books = useMemo(() => {
    const r = rand(seed);
    const out: { x: number; w: number; h: number; d: number; c: string; flat: boolean }[] = [];
    let x = 0;
    while (x < width - 0.08) {
      const flat = r() < 0.08;
      const w = flat ? 0.06 : 0.025 + r() * 0.035;
      out.push({ x, w, h: flat ? 0.05 : maxH * (0.62 + r() * 0.38), d: 0.16 + r() * 0.06, c: BOOK_COLORS[Math.floor(r() * BOOK_COLORS.length)], flat });
      x += (flat ? 0.2 : w) + 0.004;
      if (r() < 0.06) x += 0.06;
    }
    return out;
  }, [width, seed, maxH]);
  return (
    <group>
      {books.map((b, i) =>
        b.flat ? (
          <mesh key={i} position={[b.x + 0.1, 0.03, 0]}>
            <boxGeometry args={[0.2, 0.05, b.d]} />
            <Mat color={b.c} />
          </mesh>
        ) : (
          <mesh key={i} position={[b.x + b.w / 2, b.h / 2, 0]}>
            <boxGeometry args={[b.w, b.h, b.d]} />
            <Mat color={b.c} roughness={0.85} />
          </mesh>
        ),
      )}
    </group>
  );
}

/** A tall wooden bookcase, filled. Front faces +z. */
export function Bookshelf({ position, rotation = 0, w = 1.4, h = 2.0, seed = 3 }: { position: V3; rotation?: number; w?: number; h?: number; seed?: number }) {
  const shelves = 5;
  const gap = (h - 0.1) / shelves;
  const wood = woodTexture();
  return (
    <group position={position} rotation-y={rotation}>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[(s * (w - 0.04)) / 2, h / 2, 0]} castShadow>
          <boxGeometry args={[0.04, h, 0.38]} />
          <meshStandardMaterial map={wood} color="#7a5130" />
        </mesh>
      ))}
      <mesh position={[0, h / 2, -0.18]}>
        <boxGeometry args={[w, h, 0.02]} />
        <Mat color="#4f3220" />
      </mesh>
      {Array.from({ length: shelves + 1 }, (_, i) => (
        <mesh key={i} position={[0, 0.05 + i * gap, 0]} castShadow receiveShadow>
          <boxGeometry args={[w - 0.04, 0.03, 0.36]} />
          <meshStandardMaterial map={wood} color="#8a5c36" />
        </mesh>
      ))}
      {Array.from({ length: shelves }, (_, i) => (
        <group key={i} position={[-w / 2 + 0.05, 0.065 + i * gap, 0.02]}>
          <BookRow width={w - 0.1} seed={seed * 13 + i} maxH={gap - 0.06} />
        </group>
      ))}
      <Plant position={[w / 2 - 0.25, h + 0.005, 0]} size={0.55} seed={seed + 5} />
    </group>
  );
}

const GREENS = ["#3f8f4a", "#4fa35a", "#2f7a3c", "#5aae55"];

/** A potted plant: terracotta pot, soil, and broad leaves fanning out and up. */
export function Plant({ position, size = 1, seed = 1, pot = "#b5653d" }: { position: V3; size?: number; seed?: number; pot?: string }) {
  const leaves = useMemo(() => {
    const r = rand(seed * 977);
    return Array.from({ length: 11 }, (_, i) => ({ a: (i / 11) * Math.PI * 2 + r() * 0.6, up: 0.35 + r() * 0.9, len: 0.3 + r() * 0.22, y: r() * 0.12, c: GREENS[i % GREENS.length] }));
  }, [seed]);
  return (
    <group position={position} scale={size}>
      <mesh position={[0, 0.17, 0]} castShadow>
        <cylinderGeometry args={[0.2, 0.15, 0.34, 24]} />
        <Mat color={pot} roughness={0.9} />
      </mesh>
      <mesh position={[0, 0.35, 0]} castShadow>
        <cylinderGeometry args={[0.225, 0.21, 0.05, 24]} />
        <Mat color={pot} roughness={0.9} />
      </mesh>
      <mesh position={[0, 0.37, 0]}>
        <cylinderGeometry args={[0.19, 0.19, 0.01, 20]} />
        <Mat color="#3b2a1d" />
      </mesh>
      {leaves.map((l, i) => (
        <group key={i} position={[0, 0.38 + l.y, 0]} rotation-y={l.a}>
          <group rotation-x={-l.up}>
            <mesh position={[0, 0, l.len / 2]} scale={[0.085, 0.012, l.len / 2]} castShadow>
              <sphereGeometry args={[1, 14, 8]} />
              <Mat color={l.c} roughness={0.6} />
            </mesh>
          </group>
        </group>
      ))}
    </group>
  );
}

export function Armchair({ position, rotation = 0 }: { position: V3; rotation?: number }) {
  const fabric = "#e8dcc4";
  return (
    <group position={position} rotation-y={rotation}>
      <RoundedBox args={[0.9, 0.22, 0.8]} radius={0.06} position={[0, 0.34, 0.02]} castShadow><Mat color={fabric} roughness={0.95} /></RoundedBox>
      <RoundedBox args={[0.9, 0.62, 0.18]} radius={0.07} position={[0, 0.62, -0.33]} castShadow><Mat color={fabric} roughness={0.95} /></RoundedBox>
      {[-1, 1].map((s) => (
        <RoundedBox key={s} args={[0.16, 0.42, 0.78]} radius={0.06} position={[s * 0.45, 0.45, 0.02]} castShadow><Mat color="#ddd0b6" roughness={0.95} /></RoundedBox>
      ))}
      <RoundedBox args={[0.42, 0.34, 0.12]} radius={0.05} position={[0, 0.62, -0.2]} rotation-x={-0.2} castShadow><Mat color="#b5452f" roughness={0.9} /></RoundedBox>
      {[[-0.38, -0.32], [0.38, -0.32], [-0.38, 0.36], [0.38, 0.36]].map(([x, z]) => (
        <mesh key={`${x}${z}`} position={[x, 0.11, z]}>
          <cylinderGeometry args={[0.025, 0.02, 0.22, 8]} />
          <Mat color="#4a2e1b" />
        </mesh>
      ))}
    </group>
  );
}

export function SideTable({ position }: { position: V3 }) {
  return (
    <group position={position}>
      <mesh position={[0, 0.55, 0]} castShadow>
        <cylinderGeometry args={[0.3, 0.3, 0.04, 32]} />
        <meshStandardMaterial map={woodTexture()} color="#9a6a43" roughness={0.5} />
      </mesh>
      <mesh position={[0, 0.28, 0]}>
        <cylinderGeometry args={[0.04, 0.05, 0.52, 12]} />
        <Mat color="#4a2e1b" />
      </mesh>
      <mesh position={[0, 0.02, 0]}>
        <cylinderGeometry args={[0.18, 0.2, 0.04, 24]} />
        <Mat color="#4a2e1b" />
      </mesh>
      <Mug position={[0.1, 0.57, 0.05]} color="#f4f1e8" />
      <Plant position={[-0.1, 0.57, -0.05]} size={0.4} seed={21} />
    </group>
  );
}

export function FilingCabinet({ position, rotation = 0 }: { position: V3; rotation?: number }) {
  return (
    <group position={position} rotation-y={rotation}>
      <RoundedBox args={[0.5, 1.32, 0.6]} radius={0.015} position={[0, 0.66, 0]} castShadow><Mat color="#5d636b" metalness={0.5} roughness={0.45} /></RoundedBox>
      {[0, 1, 2, 3].map((i) => (
        <group key={i} position={[0, 0.2 + i * 0.31, 0.302]}>
          <mesh><boxGeometry args={[0.44, 0.28, 0.01]} /><Mat color="#6c737c" metalness={0.5} roughness={0.4} /></mesh>
          <mesh position={[0, 0.06, 0.01]}><boxGeometry args={[0.12, 0.05, 0.005]} /><Mat color="#e9e4d6" /></mesh>
          <mesh position={[0, -0.03, 0.015]}><boxGeometry args={[0.16, 0.02, 0.02]} /><meshStandardMaterial color="#b9bec6" metalness={0.9} roughness={0.25} /></mesh>
        </group>
      ))}
    </group>
  );
}

export function WaterCooler({ position }: { position: V3 }) {
  return (
    <group position={position}>
      <RoundedBox args={[0.34, 0.95, 0.34]} radius={0.03} position={[0, 0.475, 0]} castShadow><Mat color="#e7e9ec" roughness={0.4} /></RoundedBox>
      <mesh position={[0, 0.72, 0.172]}><planeGeometry args={[0.2, 0.14]} /><Mat color="#c9ced6" /></mesh>
      <mesh position={[-0.05, 0.76, 0.18]}><boxGeometry args={[0.03, 0.04, 0.03]} /><Mat color="#4da3ff" /></mesh>
      <mesh position={[0.05, 0.76, 0.18]}><boxGeometry args={[0.03, 0.04, 0.03]} /><Mat color="#e5484d" /></mesh>
      <mesh position={[0, 1.2, 0]} castShadow>
        <cylinderGeometry args={[0.14, 0.14, 0.42, 24]} />
        <meshStandardMaterial color="#8cc8f0" transparent opacity={0.65} roughness={0.08} metalness={0.1} />
      </mesh>
      <mesh position={[0, 1.43, 0]}>
        <cylinderGeometry args={[0.06, 0.12, 0.06, 20]} />
        <meshStandardMaterial color="#8cc8f0" transparent opacity={0.65} roughness={0.08} />
      </mesh>
    </group>
  );
}

/** A panel door with a glass pane, hinged at its left edge. The ref turns it. Faces +z. */
export function Door({ position, doorRef }: { position: V3; doorRef: React.RefObject<THREE.Group | null> }) {
  return (
    <group position={position}>
      <mesh position={[0.69, 1.25, -0.02]}>
        <boxGeometry args={[1.62, 2.58, 0.12]} />
        <Mat color="#3b2414" />
      </mesh>
      <group ref={doorRef} position={[0, 0, 0.06]}>
        <RoundedBox args={[1.38, 2.4, 0.06]} radius={0.015} position={[0.69, 1.2, 0]} castShadow>
          <meshStandardMaterial map={woodTexture()} color="#9a6a43" roughness={0.6} />
        </RoundedBox>
        <mesh position={[0.69, 1.75, 0.032]}>
          <planeGeometry args={[0.7, 0.5]} />
          <meshStandardMaterial color="#bfe3f7" emissive="#bfe3f7" emissiveIntensity={0.35} roughness={0.05} />
        </mesh>
        {[0.75, 0.35].map((y) => (
          <mesh key={y} position={[0.69, y + 0.2, 0.034]}>
            <boxGeometry args={[0.9, 0.4, 0.01]} />
            <meshStandardMaterial map={woodTexture()} color="#87593a" />
          </mesh>
        ))}
        <mesh position={[1.2, 1.1, 0.06]}>
          <sphereGeometry args={[0.045, 16, 12]} />
          <meshStandardMaterial color="#c8a165" metalness={0.8} roughness={0.3} />
        </mesh>
      </group>
      <mesh rotation-x={-Math.PI / 2} position={[0.69, 0.012, 0.75]} receiveShadow>
        <planeGeometry args={[1.2, 0.7]} />
        <Mat color="#9c4a2c" roughness={1} />
      </mesh>
    </group>
  );
}

// ---------------------------------------------------------------------------- desk things

export function Mug({ position, color = "#f4f1e8" }: { position: V3; color?: string }) {
  return (
    <group position={position}>
      <mesh position={[0, 0.045, 0]} castShadow>
        <cylinderGeometry args={[0.04, 0.036, 0.09, 20]} />
        <Mat color={color} roughness={0.35} />
      </mesh>
      <mesh position={[0, 0.086, 0]}>
        <cylinderGeometry args={[0.035, 0.035, 0.004, 20]} />
        <Mat color="#4a2a17" roughness={0.2} />
      </mesh>
      <mesh position={[0.045, 0.05, 0]} rotation-y={Math.PI / 2}>
        <torusGeometry args={[0.022, 0.007, 8, 16]} />
        <Mat color={color} roughness={0.35} />
      </mesh>
    </group>
  );
}

export function Papers({ position, rotation = 0 }: { position: V3; rotation?: number }) {
  return (
    <group position={position} rotation-y={rotation}>
      {[0, 1, 2].map((i) => (
        <mesh key={i} position={[i * 0.01, 0.002 + i * 0.002, i * 0.008]} rotation-y={i * 0.06}>
          <boxGeometry args={[0.21, 0.002, 0.297]} />
          <Mat color={i === 2 ? "#ffffff" : "#ecebe6"} />
        </mesh>
      ))}
    </group>
  );
}

/** A monitor on a stand. The screen's material is exposed so Stage can tint and pulse it. Faces +z. */
export function Monitor({ position, screen, seed = 0, w = 0.74 }: { position: V3; screen?: MatRef; seed?: number; w?: number }) {
  const h = w * 0.58;
  return (
    <group position={position}>
      <RoundedBox args={[0.28, 0.016, 0.2]} radius={0.006} position={[0, 0.008, 0]} castShadow>
        <Mat color="#2a2d33" metalness={0.6} roughness={0.35} />
      </RoundedBox>
      <mesh position={[0, 0.15, -0.05]} castShadow>
        <boxGeometry args={[0.05, 0.28, 0.025]} />
        <Mat color="#2a2d33" metalness={0.6} roughness={0.35} />
      </mesh>
      <RoundedBox args={[w, h, 0.035]} radius={0.008} position={[0, 0.27 + h / 2, -0.03]} castShadow>
        <Mat color="#16181c" metalness={0.3} roughness={0.5} />
      </RoundedBox>
      <mesh position={[0, 0.27 + h / 2 + 0.008, -0.011]}>
        <planeGeometry args={[w - 0.03, h - 0.045]} />
        <meshStandardMaterial ref={screen} color="#000000" emissive="#c8d6f0" emissiveMap={codeTexture(seed % 4)} emissiveIntensity={0.6} roughness={0.2} />
      </mesh>
    </group>
  );
}

export function Keyboard({ position }: { position: V3 }) {
  return (
    <group position={position}>
      <RoundedBox args={[0.44, 0.02, 0.15]} radius={0.006} position={[0, 0.01, 0]} castShadow><Mat color="#24272d" /></RoundedBox>
      <mesh position={[0, 0.0205, 0]} rotation-x={-Math.PI / 2}>
        <planeGeometry args={[0.42, 0.13]} />
        <meshStandardMaterial map={keyboardTexture()} roughness={0.6} />
      </mesh>
    </group>
  );
}

export function Mouse({ position }: { position: V3 }) {
  return (
    <mesh position={position} scale={[0.032, 0.018, 0.052]} castShadow>
      <sphereGeometry args={[1, 16, 12]} />
      <Mat color="#2a2d33" roughness={0.4} />
    </mesh>
  );
}

/** A PC tower standing on the floor, with a mesh front, power light, and a glass side lit from inside. */
export function Tower({ position }: { position: V3 }) {
  return (
    <group position={position}>
      <RoundedBox args={[0.21, 0.46, 0.46]} radius={0.01} position={[0, 0.25, 0]} castShadow><Mat color="#1d2026" metalness={0.4} roughness={0.45} /></RoundedBox>
      <mesh position={[0, 0.25, 0.231]}>
        <planeGeometry args={[0.17, 0.4]} />
        <meshStandardMaterial map={grilleTexture()} roughness={0.8} />
      </mesh>
      <mesh position={[0.06, 0.45, 0.232]}>
        <circleGeometry args={[0.009, 12]} />
        <meshStandardMaterial color="#4da3ff" emissive="#4da3ff" emissiveIntensity={2.5} />
      </mesh>
      <mesh position={[-0.106, 0.27, 0]} rotation-y={-Math.PI / 2}>
        <planeGeometry args={[0.38, 0.34]} />
        <meshStandardMaterial color="#0c0f14" emissive="#5b6cff" emissiveIntensity={0.3} roughness={0.08} metalness={0.3} />
      </mesh>
      {[[-0.08, -0.18], [0.08, -0.18], [-0.08, 0.18], [0.08, 0.18]].map(([x, z]) => (
        <mesh key={`${x}${z}`} position={[x, 0.01, z]}><cylinderGeometry args={[0.02, 0.02, 0.02, 10]} /><Mat color="#0f1012" /></mesh>
      ))}
    </group>
  );
}

/** An open laptop. Its screen faces +z; the material is exposed like a monitor's. */
export function Laptop({ position, rotation = 0, screen, seed = 1 }: { position: V3; rotation?: number; screen?: MatRef; seed?: number }) {
  return (
    <group position={position} rotation-y={rotation}>
      <RoundedBox args={[0.34, 0.016, 0.24]} radius={0.006} position={[0, 0.008, 0]} castShadow>
        <Mat color="#b9bec6" metalness={0.7} roughness={0.35} />
      </RoundedBox>
      <mesh position={[0, 0.0165, 0.02]} rotation-x={-Math.PI / 2}>
        <planeGeometry args={[0.3, 0.11]} />
        <meshStandardMaterial map={keyboardTexture()} roughness={0.6} />
      </mesh>
      <group position={[0, 0.016, -0.12]} rotation-x={-0.28}>
        <RoundedBox args={[0.34, 0.22, 0.008]} radius={0.004} position={[0, 0.11, 0]} castShadow>
          <Mat color="#b9bec6" metalness={0.7} roughness={0.35} />
        </RoundedBox>
        <mesh position={[0, 0.115, 0.0045]}>
          <planeGeometry args={[0.31, 0.19]} />
          <meshStandardMaterial ref={screen} color="#000000" emissive="#c8d6f0" emissiveMap={codeTexture(seed % 4)} emissiveIntensity={0.6} roughness={0.2} />
        </mesh>
      </group>
    </group>
  );
}

/** A desk lamp with a warm bulb that lights what is under it. */
export function DeskLamp({ position, rotation = 0, color = "#3e5a3a" }: { position: V3; rotation?: number; color?: string }) {
  return (
    <group position={position} rotation-y={rotation}>
      <mesh position={[0, 0.015, 0]} castShadow><cylinderGeometry args={[0.08, 0.09, 0.03, 20]} /><Mat color={color} metalness={0.5} roughness={0.4} /></mesh>
      <mesh position={[0, 0.2, -0.02]} rotation-x={-0.15}><cylinderGeometry args={[0.012, 0.012, 0.38, 8]} /><Mat color={color} metalness={0.5} roughness={0.4} /></mesh>
      <mesh position={[0, 0.39, 0.07]} rotation-x={1.1}><cylinderGeometry args={[0.012, 0.012, 0.22, 8]} /><Mat color={color} metalness={0.5} roughness={0.4} /></mesh>
      <group position={[0, 0.42, 0.17]} rotation-x={0.9}>
        <mesh castShadow>
          <coneGeometry args={[0.09, 0.14, 24, 1, true]} />
          <meshStandardMaterial color={color} metalness={0.5} roughness={0.4} side={THREE.DoubleSide} />
        </mesh>
        <mesh position={[0, -0.04, 0]}>
          <sphereGeometry args={[0.035, 16, 12]} />
          <meshStandardMaterial color="#fff3d6" emissive="#ffd28a" emissiveIntensity={3} />
        </mesh>
      </group>
      <pointLight position={[0, 0.3, 0.25]} color="#ffcf8a" intensity={2.2} distance={3} decay={2} />
    </group>
  );
}

export function FloorLamp({ position }: { position: V3 }) {
  return (
    <group position={position}>
      <mesh position={[0, 0.02, 0]} castShadow><cylinderGeometry args={[0.18, 0.2, 0.04, 24]} /><Mat color="#2b2420" metalness={0.5} /></mesh>
      <mesh position={[0, 0.8, 0]}><cylinderGeometry args={[0.015, 0.015, 1.56, 8]} /><Mat color="#2b2420" metalness={0.5} /></mesh>
      <mesh position={[0, 1.62, 0]} castShadow>
        <cylinderGeometry args={[0.16, 0.24, 0.3, 28, 1, true]} />
        <meshStandardMaterial color="#f2e6cc" emissive="#ffcf8a" emissiveIntensity={0.9} side={THREE.DoubleSide} roughness={0.9} />
      </mesh>
      <pointLight position={[0, 1.5, 0]} color="#ffcf8a" intensity={4} distance={5} decay={2} />
    </group>
  );
}

/** Books held between two bookends on a desk. Runs along +x from local x=0. */
export function DeskBooks({ position }: { position: V3 }) {
  return (
    <group position={position}>
      {[0, 0.5].map((x) => (
        <mesh key={x} position={[x, 0.08, 0]}><boxGeometry args={[0.015, 0.16, 0.14]} /><Mat color="#2a2d33" metalness={0.5} /></mesh>
      ))}
      <group position={[0.012, 0, 0]}>
        <BookRow width={0.5} seed={41} maxH={0.26} />
      </group>
      <mesh position={[0.25, 0.012, 0.22]} rotation-y={0.3}><boxGeometry args={[0.2, 0.025, 0.26]} /><Mat color="#2f4b7c" /></mesh>
    </group>
  );
}

/** Small corrugated shipping containers, stacked: container images. */
export function Containers({ position }: { position: V3 }) {
  const ribs = ribsTexture();
  const boxes: [number, number, number, string][] = [[0, 0, 0, "#2f6fb5"], [0.37, 0, 0.02, "#d9772b"], [0.18, 1, 0.01, "#3f8f4a"]];
  return (
    <group position={position}>
      {boxes.map(([x, level, z, c]) => (
        <mesh key={c} position={[x, 0.07 + level * 0.141, z]} castShadow>
          <boxGeometry args={[0.34, 0.14, 0.15]} />
          <meshStandardMaterial map={ribs} color={c} roughness={0.6} metalness={0.2} />
        </mesh>
      ))}
    </group>
  );
}

/** A whiteboard on the wall, with an aluminium frame and a marker tray. Faces +z. */
export function Whiteboard({ position, w = 1.8, h = 1.02 }: { position: V3; w?: number; h?: number }) {
  return (
    <group position={position}>
      <mesh castShadow><boxGeometry args={[w + 0.05, h + 0.05, 0.03]} /><meshStandardMaterial color="#c3c8cf" metalness={0.8} roughness={0.3} /></mesh>
      <mesh position={[0, 0, 0.016]}>
        <planeGeometry args={[w, h]} />
        <meshStandardMaterial map={boardTexture()} roughness={0.25} />
      </mesh>
      <mesh position={[0, -h / 2 - 0.03, 0.05]}><boxGeometry args={[w * 0.6, 0.025, 0.07]} /><meshStandardMaterial color="#c3c8cf" metalness={0.8} roughness={0.3} /></mesh>
      {["#2a5bd7", "#d64545", "#2f9e6e"].map((c, i) => (
        <mesh key={c} position={[-0.2 + i * 0.12, -h / 2 - 0.008, 0.05]} rotation-z={Math.PI / 2}><cylinderGeometry args={[0.009, 0.009, 0.1, 8]} /><Mat color={c} /></mesh>
      ))}
    </group>
  );
}

// ---------------------------------------------------------------------------- racks

type Unit = { kind: UnitKind; u: number };
const U = 0.0445; // one rack unit, in metres
export const SERVER_UNITS: Unit[] = [
  { kind: "switch", u: 1 }, { kind: "blank", u: 1 }, { kind: "1u", u: 1 }, { kind: "1u", u: 1 }, { kind: "1u", u: 1 },
  { kind: "2u", u: 2 }, { kind: "2u", u: 2 }, { kind: "blank", u: 1 }, { kind: "2u", u: 2 }, { kind: "1u", u: 1 },
  { kind: "1u", u: 1 }, { kind: "blank", u: 2 }, { kind: "2u", u: 2 }, { kind: "2u", u: 2 }, { kind: "blank", u: 1 },
  { kind: "storage", u: 4 }, { kind: "blank", u: 2 }, { kind: "storage", u: 4 }, { kind: "blank", u: 3 }, { kind: "1u", u: 1 },
];
export const STORAGE_UNITS: Unit[] = [
  { kind: "switch", u: 1 }, { kind: "2u", u: 2 }, { kind: "blank", u: 1 }, { kind: "storage", u: 4 }, { kind: "storage", u: 4 },
  { kind: "storage", u: 4 }, { kind: "storage", u: 4 }, { kind: "storage", u: 4 }, { kind: "blank", u: 2 },
];
const LED_COLORS = ["#3ddc84", "#4da3ff", "#3ddc84", "#ffb020"];

/**
 * A 19-inch rack cabinet: steel sides, roof and plinth, front rails, and the units mounted in it. Each unit
 * has a drive-activity light that Stage blinks through `leds`; `status` is a strip along the top that shows
 * the station's state. Front is +z.
 */
export function Rack({ position, units, h = 2.0, leds, ledFrom = 0, status }: {
  position: V3;
  units: Unit[];
  h?: number;
  leds: React.RefObject<THREE.MeshStandardMaterial[]>;
  ledFrom?: number;
  status?: MatRef;
}) {
  const W = 0.6;
  const D = 0.95;
  let y = h - 0.09;
  const placed = units.flatMap((unit) => {
    const uh = unit.u * U;
    if (y - uh < 0.1) return [];
    y -= uh;
    return [{ ...unit, y: y + uh / 2, uh }];
  });
  const steel = { color: "#1a1c20", metalness: 0.55, roughness: 0.45 };
  return (
    <group position={position}>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[(s * (W - 0.03)) / 2, h / 2, 0]} castShadow>
          <boxGeometry args={[0.03, h, D]} />
          <Mat {...steel} />
        </mesh>
      ))}
      <mesh position={[0, h - 0.02, 0]} castShadow><boxGeometry args={[W, 0.04, D]} /><Mat {...steel} /></mesh>
      <mesh position={[0, 0.045, 0]}><boxGeometry args={[W, 0.09, D]} /><Mat color="#101114" /></mesh>
      <mesh position={[0, h / 2, -D / 2 + 0.01]}><boxGeometry args={[W, h, 0.02]} /><Mat color="#141518" /></mesh>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * (W / 2 - 0.045), h / 2, D / 2 - 0.03]}>
          <boxGeometry args={[0.025, h - 0.12, 0.012]} />
          <meshStandardMaterial color="#9aa0a8" metalness={0.85} roughness={0.3} />
        </mesh>
      ))}
      {placed.map((p, i) => (
        <group key={i} position={[0, p.y, 0.02]}>
          <mesh>
            <boxGeometry args={[W - 0.12, p.uh - 0.003, D - 0.12]} />
            <Mat color="#23262b" metalness={0.4} />
          </mesh>
          <mesh position={[0, 0, (D - 0.12) / 2 + 0.012]}>
            <planeGeometry args={[W - 0.07, p.uh - 0.003]} />
            <meshStandardMaterial map={unitTexture(p.kind)} metalness={0.35} roughness={0.5} />
          </mesh>
          {p.kind !== "blank" && (
            <mesh position={[W / 2 - 0.075, p.uh / 2 - 0.012, (D - 0.12) / 2 + 0.016]}>
              <boxGeometry args={[0.012, 0.007, 0.004]} />
              <meshStandardMaterial
                ref={(m: THREE.MeshStandardMaterial | null) => { if (m) leds.current[ledFrom + i] = m; }}
                color={LED_COLORS[i % LED_COLORS.length]}
                emissive={LED_COLORS[i % LED_COLORS.length]}
                emissiveIntensity={1}
              />
            </mesh>
          )}
        </group>
      ))}
      <mesh position={[0, h - 0.06, D / 2 + 0.002]}>
        <planeGeometry args={[W - 0.12, 0.014]} />
        <meshStandardMaterial ref={status} color="#000000" emissive="#c8d6f0" emissiveIntensity={0.5} />
      </mesh>
    </group>
  );
}
