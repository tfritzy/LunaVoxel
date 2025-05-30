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
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6); // Increased ambient light intensity
    scene.add(ambientLight);
    // Hemisphere light for soft, even lighting (skyColor, groundColor, intensity)
    const hemisphereLight = new THREE.HemisphereLight(0xffffff, 0x888888, 1.5); // Increased hemisphere light intensity and ground color
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

      voxel.position.set(
        (Math.random() - 0.5) * widthAtZ0 * spreadFactor, // x spread based on view width
        (Math.random() - 0.5) * heightAtZ0 * spreadFactor, // y spread based on view height
        (Math.random() - 0.5) * 30 + 10 // z (closer/further) - relative to z=0 plane
      );
      voxel.rotation.set(
        Math.random() * Math.PI * 2,
        Math.random() * Math.PI * 2,
        Math.random() * Math.PI * 2
      );

      // Store random speeds for animation
      (voxel as any).userData = {
        rotationSpeed: new THREE.Vector3(),
        bobSpeed: (Math.random() - 0.5) * 0.02,
        initialY: voxel.position.y,
        bobAmplitude: Math.random() * 5 + 2,
      };

      voxels.push(voxel);
      scene.add(voxel);
    }

    // Animation loop
    let time = 0;
    const animate = () => {
      animationFrameId.current = requestAnimationFrame(animate);
      time += 0.01;

      voxels.forEach((voxel) => {
        const userData = (voxel as any).userData;
        voxel.rotation.x += userData.rotationSpeed.x;
        voxel.rotation.y += userData.rotationSpeed.y;
        voxel.rotation.z += userData.rotationSpeed.z;

        voxel.position.y =
          userData.initialY +
          Math.sin(time * userData.bobSpeed * 50 + userData.initialY) *
            userData.bobAmplitude;
      });

      renderer.render(scene, camera);
    };
    animate();

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
