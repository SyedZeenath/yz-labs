import { Suspense, useMemo, useRef } from "react";
import { Canvas, useFrame, useLoader, useThree } from "@react-three/fiber";
import * as THREE from "three";

// Ambient dust drifting slowly through the scene — pure atmosphere, no
// interaction. Positions wrap around a box volume so it reads as a
// continuous, endless drift rather than a finite puff.
function Dust({ count = 260, reduceMotion }) {
  const points = useRef(null);
  const positions = useMemo(() => {
    const arr = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      arr[i * 3] = (Math.random() - 0.5) * 9;
      arr[i * 3 + 1] = (Math.random() - 0.5) * 5;
      arr[i * 3 + 2] = (Math.random() - 0.5) * 6;
    }
    return arr;
  }, [count]);

  useFrame((_, delta) => {
    if (reduceMotion || !points.current) return;
    const pos = points.current.geometry.attributes.position;
    for (let i = 0; i < count; i++) {
      let y = pos.getY(i) + delta * 0.06;
      if (y > 2.6) y = -2.6;
      pos.setY(i, y);
    }
    pos.needsUpdate = true;
  });

  return (
    <points ref={points}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial size={0.018} color="#d6d4cb" transparent opacity={0.3} depthWrite={false} />
    </points>
  );
}

// One textured plane per chapter, all permanently mounted and stacked at
// tiny z-offsets — visibility is driven purely by continuously lerping
// material opacity toward 0 or 1 each frame, never by mounting/unmounting.
// (This project hit a confirmed bug earlier where mount/unmount-driven
// crossfades silently got stuck in this environment; a per-frame lerp on
// an always-mounted mesh sidesteps that class of bug entirely.)
function ChapterPlane({ texture, index, activeIndex, reduceMotion }) {
  const mesh = useRef(null);
  const mat = useRef(null);
  const bob = useMemo(() => Math.random() * Math.PI * 2, []);

  useFrame((state, delta) => {
    if (!mat.current || !mesh.current) return;
    const target = index === activeIndex ? 1 : 0;
    mat.current.opacity += (target - mat.current.opacity) * Math.min(1, delta * 4);
    mesh.current.visible = mat.current.opacity > 0.01;

    if (!reduceMotion) {
      const t = state.clock.elapsedTime;
      mesh.current.position.y = Math.sin(t * 0.6 + bob) * 0.12;
      mesh.current.rotation.z = Math.sin(t * 0.4 + bob) * 0.03;
    }
  });

  const aspect = texture.image ? texture.image.width / texture.image.height : 1;
  const h = 2.25;
  const w = h * aspect;

  return (
    <mesh ref={mesh} position={[0, 0, index * -0.01]}>
      <planeGeometry args={[w, h]} />
      <meshBasicMaterial
        ref={mat}
        map={texture}
        transparent
        opacity={0}
        depthWrite={false}
        toneMapped={false}
      />
    </mesh>
  );
}

// Soft radial glow behind the product, generated on an offscreen canvas —
// no external asset needed. Tinted to match the site's own off-white
// foreground color (var(--fg)) rather than the accent blue — a neutral,
// gallery-lit pool of light instead of a colored glow, so the product reads
// against pitch black without introducing a color cast.
//
// Two things made this read as a filled rectangle ("a photo dropped into
// the page") rather than a soft light pool: the sprite's world scale was
// larger than the camera's visible frame at this distance, so its
// fully-transparent outer edge never actually appeared on screen — only
// its bright, opaque center did, filling the whole canvas edge-to-edge.
// And it was simply too bright. Fixed by shrinking it so the transparent
// edge sits well inside frame (leaving real, visible transparency at the
// canvas corners) and dimming the gradient itself.
function Glow({ reduceMotion }) {
  const texture = useMemo(() => {
    const size = 256;
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext("2d");
    const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    grad.addColorStop(0, "rgba(244,243,238,0.42)");
    grad.addColorStop(0.4, "rgba(244,243,238,0.14)");
    grad.addColorStop(1, "rgba(244,243,238,0)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);
    return new THREE.CanvasTexture(canvas);
  }, []);

  const ref = useRef(null);
  useFrame((state) => {
    if (reduceMotion || !ref.current) return;
    const s = 1.9 + Math.sin(state.clock.elapsedTime * 0.5) * 0.1;
    ref.current.scale.set(s, s, 1);
  });

  return (
    <sprite ref={ref} position={[0, 0.1, -0.5]} scale={[1.9, 1.9, 1]}>
      <spriteMaterial map={texture} transparent depthWrite={false} blending={THREE.AdditiveBlending} />
    </sprite>
  );
}

function Rig({ reduceMotion }) {
  const { camera } = useThree();
  useFrame((state) => {
    if (reduceMotion) return;
    const t = state.clock.elapsedTime;
    camera.position.x = Math.sin(t * 0.15) * 0.35;
    camera.position.y = 0.1 + Math.sin(t * 0.22) * 0.12;
    camera.lookAt(0, 0, 0);
  });
  return null;
}

function Scene({ chapters, activeIndex, reduceMotion }) {
  const textures = useLoader(
    THREE.TextureLoader,
    chapters.map((c) => c.cutout)
  );

  return (
    <>
      {/* No `<color attach="background">` — that forces an opaque fill for
          the whole canvas, which is exactly what made the 3D visual read as
          a rectangular "photo" dropped into the page instead of part of
          it. Leaving the canvas alpha-transparent lets the section's own
          background and grid-overlay show through everywhere the scene
          doesn't paint something, so there's no visible seam. */}
      <fog attach="fog" args={["#000000", 4, 9]} />
      {/* No lights — every material in this scene (basic/points/sprite) is
          unlit by design, so scene lights were pure dead weight here. The
          two colored point lights were also the literal source of the
          "bluish" cast this was built to remove. */}

      <Dust reduceMotion={reduceMotion} />
      <Rig reduceMotion={reduceMotion} />
      <Glow reduceMotion={reduceMotion} />

      {chapters.map((c, i) => (
        <ChapterPlane key={c.tag} texture={textures[i]} index={i} activeIndex={activeIndex} reduceMotion={reduceMotion} />
      ))}
    </>
  );
}

export default function Hero3D({ chapters, activeIndex, reduceMotion }) {
  return (
    <Canvas
      dpr={[1, 1.8]}
      camera={{ position: [0, 0.1, 4.4], fov: 34 }}
      gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
      style={{ width: "100%", height: "100%", display: "block" }}
    >
      <Suspense fallback={null}>
        <Scene chapters={chapters} activeIndex={activeIndex} reduceMotion={reduceMotion} />
      </Suspense>
    </Canvas>
  );
}
