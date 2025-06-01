import { useEffect, useRef } from "react";
import * as THREE from "three";

// Exact default palette from Lib.cs
const FULL_VOXEL_PALETTE = [
  "#fcfbf3",
  "#fceba8",
  "#f5c47c",
  "#e39764",
  "#9d4343",
  "#813645",
  "#794e6d",
  "#3e4c7e",
  "#495f94",
  "#aaeeea",
  "#d5f893",
  "#96dc7f",
  "#6ec077",
  "#4e9363",
];

// Filtered palette for lighter colors
const LIGHT_VOXEL_PALETTE = FULL_VOXEL_PALETTE.filter((hex) => {
  // Basic heuristic: if the first character of R, G, B (after #) is high (e.g., > 7), it's likely light.
  // This is a simplification. A proper check would convert to HSL and check Lightness.
  const r = parseInt(hex.substring(1, 3), 16);
  const g = parseInt(hex.substring(3, 5), 16);
  const b = parseInt(hex.substring(5, 7), 16);
  // Average intensity, or check if any component is very low
  const average = (r + g + b) / 3;
  return average > 100; // Keep colors with an average component value greater than 100 (out of 255)
});

// Ensure there's at least one color if the filter is too aggressive
const VOXEL_PALETTE_TO_USE =
  LIGHT_VOXEL_PALETTE.length > 0
    ? LIGHT_VOXEL_PALETTE
    : FULL_VOXEL_PALETTE.slice(0, 1);

// Type for voxel userData
interface VoxelUserData {
  rotationSpeed: THREE.Vector3;
  bobSpeed: number;
  initialY: number;
  bobAmplitude: number;
}

export const FloatingVoxelsBackground = () => {
  const mountRef = useRef<HTMLDivElement>(null);
  const animationFrameId = useRef<number | null>(null);

  useEffect(() => {
    if (!mountRef.current) return;

    const currentMount = mountRef.current;

    // Scene setup
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(
      75,
      currentMount.clientWidth / currentMount.clientHeight,
      0.1,
      1000
    );
    camera.position.z = 50;

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setSize(currentMount.clientWidth, currentMount.clientHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    currentMount.appendChild(renderer.domElement);

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.8); // Increased ambient light intensity
    scene.add(ambientLight);
    // Hemisphere light for soft, even lighting (skyColor, groundColor, intensity)
    const hemisphereLight = new THREE.HemisphereLight(0xffffff, 0x888888, 1.7); // Increased hemisphere light intensity and ground color
    scene.add(hemisphereLight);
    // Removed DirectionalLight to rely on Hemisphere and Ambient for more even color
    // const directionalLight = new THREE.DirectionalLight(0xffffff, 0.5);
    // directionalLight.position.set(10, 15, 12);
    // scene.add(directionalLight);

    // Calculate visible dimensions at z=0 plane (where camera is looking towards)
    const vFOV_rad = camera.fov * (Math.PI / 180);
    // Distance from camera to z=0 plane is camera.position.z
    const heightAtZ0 = 2 * Math.tan(vFOV_rad / 2) * camera.position.z;
    const widthAtZ0 = heightAtZ0 * camera.aspect;
    const spreadFactor = 1.2; // Make distribution area slightly larger than viewport

    // Voxels
    const numVoxels = 50;
    const voxels: THREE.Mesh[] = [];
    const geometry = new THREE.BoxGeometry(1, 1, 1); // Base size

    // Helper to check if a new position is far enough from all previous voxels
    function isFarEnough(x: number, y: number, z: number, minDist: number) {
      return voxels.every((v) => {
        const dx = v.position.x - x;
        const dy = v.position.y - y;
        const dz = v.position.z - z;
        return Math.sqrt(dx * dx + dy * dy + dz * dz) >= minDist;
      });
    }

    const minDistance = 5; // Minimum allowed distance between voxel centers
    const maxAttempts = 100;
    const yBands: { min: number; max: number }[] = [];

    for (let i = 0; i < numVoxels; i++) {
      const colorHex = VOXEL_PALETTE_TO_USE[i % VOXEL_PALETTE_TO_USE.length];
      const material = new THREE.MeshStandardMaterial({
        color: new THREE.Color(colorHex),
        roughness: 0.8, // Higher roughness for a more matte/diffuse look, less shiny
        metalness: 0.0, // Non-metallic
      });
      const voxel = new THREE.Mesh(geometry, material);

      const scale = Math.random() * 3 + 1; // Size 1 to 4
      voxel.scale.set(scale, scale, scale);

      // Find a non-intersecting position
      let x = 0,
        y = 0,
        z = 0,
        attempts = 0;
      do {
        x = (Math.random() - 0.5) * widthAtZ0 * spreadFactor;
        y = (Math.random() - 0.5) * heightAtZ0 * spreadFactor;
        z = (Math.random() - 0.5) * 30 + 10;
        attempts++;
      } while (!isFarEnough(x, y, z, minDistance) && attempts < maxAttempts);
      voxel.position.set(x, y, z);

      voxel.rotation.set(
        Math.random() * Math.PI * 2,
        Math.random() * Math.PI * 2,
        Math.random() * Math.PI * 2
      );

      // Assign a non-overlapping Y band for bobbing
      let initialY = y;
      let bobAmplitude = Math.random() + 1;
      let bandFound = false;
      for (let bandTry = 0; bandTry < 20 && !bandFound; bandTry++) {
        initialY = (Math.random() - 0.5) * heightAtZ0 * spreadFactor;
        bobAmplitude = Math.random() + 1;
        const minY = initialY - bobAmplitude;
        const maxY = initialY + bobAmplitude;
        if (
          !yBands.some((b) => Math.max(b.min, minY) < Math.min(b.max, maxY))
        ) {
          yBands.push({ min: minY, max: maxY });
          bandFound = true;
        }
      }
      if (!bandFound) {
        // fallback: just use the last tried values
        yBands.push({
          min: initialY - bobAmplitude,
          max: initialY + bobAmplitude,
        });
      }

      // Store random speeds for animation
      (voxel.userData as VoxelUserData) = {
        rotationSpeed: new THREE.Vector3(
          Math.random() * 0.001,
          Math.random() * 0.001,
          Math.random() * 0.001
        ),
        bobSpeed: (Math.random() - 0.5) * 0.01,
        initialY,
        bobAmplitude,
      };

      voxels.push(voxel);
      scene.add(voxel);
    }

    // Animation loop
    let lastTimestamp = performance.now();
    let accumulatedTime = 0;
    const animate = (now: number) => {
      animationFrameId.current = requestAnimationFrame(animate);
      const delta = (now - lastTimestamp) / 1000; // seconds
      lastTimestamp = now;
      accumulatedTime += delta;

      voxels.forEach((voxel) => {
        const userData = voxel.userData as VoxelUserData;
        voxel.rotation.x += userData.rotationSpeed.x * delta * 60;
        voxel.rotation.y += userData.rotationSpeed.y * delta * 60;
        voxel.rotation.z += userData.rotationSpeed.z * delta * 60;

        voxel.position.y =
          userData.initialY +
          Math.sin(
            accumulatedTime * userData.bobSpeed * 50 + userData.initialY
          ) *
            userData.bobAmplitude;
      });

      renderer.render(scene, camera);
    };
    animationFrameId.current = requestAnimationFrame(animate);

    // Handle resize
    const handleResize = () => {
      if (currentMount) {
        camera.aspect = currentMount.clientWidth / currentMount.clientHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(currentMount.clientWidth, currentMount.clientHeight);
      }
    };
    window.addEventListener("resize", handleResize);

    // Cleanup
    return () => {
      window.removeEventListener("resize", handleResize);
      if (animationFrameId.current) {
        cancelAnimationFrame(animationFrameId.current);
      }
      voxels.forEach((voxel) => {
        scene.remove(voxel);
        voxel.geometry.dispose();
        if (Array.isArray(voxel.material)) {
          voxel.material.forEach((mat) => mat.dispose());
        } else {
          voxel.material.dispose();
        }
      });
      geometry.dispose(); // Dispose shared geometry
      ambientLight.dispose();
      hemisphereLight.dispose(); // Dispose hemisphereLight
      // directionalLight.dispose(); // Dispose directionalLight if it were still used
      renderer.dispose();
      if (currentMount && renderer.domElement) {
        currentMount.removeChild(renderer.domElement);
      }
    };
  }, []);

  return (
    <div
      ref={mountRef}
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100vw",
        height: "100vh",
        overflow: "hidden",
        zIndex: -10,
      }}
    />
  );
};
