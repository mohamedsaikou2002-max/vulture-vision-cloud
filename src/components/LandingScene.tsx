import { useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Group, Vector3 } from "three";
import { Line } from "@react-three/drei";

function Contours({ color, reduced }: { color: string; reduced: boolean }) {
  const group = useRef<Group>(null);
  const paths = useMemo(() => Array.from({ length: 15 }, (_, row) =>
    Array.from({ length: 65 }, (_, column) => {
      const x = (column - 32) * .25;
      const z = (row - 7) * .34;
      return new Vector3(x, Math.sin(x * .6 + z * .3) * .38 + Math.cos(x * .9 - z) * .18, z);
    })), []);
  useFrame(({ pointer }, rawDelta) => {
    if (!group.current || reduced) return;
    const dt = Math.min(rawDelta, .05);
    group.current.rotation.y += (pointer.x * .1 - group.current.rotation.y) * (1 - Math.exp(-2 * dt));
    group.current.rotation.x += (pointer.y * .04 - group.current.rotation.x) * (1 - Math.exp(-2 * dt));
  });
  return <group ref={group} position={[0, -1.65, 0]}>{paths.map((points, i) =>
    <Line key={i} points={points} color={color} transparent opacity={.14 + i * .008} lineWidth={.65} />)}</group>;
}

export default function LandingScene({ color, reduced }: { color: string; reduced: boolean }) {
  return <Canvas dpr={1} camera={{ position: [0, 4.4, 7], fov: 48 }} gl={{ alpha: true, antialias: true }} frameloop={reduced ? "demand" : "always"}>
    <Contours color={color} reduced={reduced} />
  </Canvas>;
}