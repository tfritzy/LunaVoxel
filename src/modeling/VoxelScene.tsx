import React, { useRef, useEffect, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";
import { addGroundPlane } from "./lib/add-ground-plane";
import { GridRaycaster } from "./lib/grid-raycaster";
import { GridPosition } from "../types";
import { Builder } from "./lib/builder";

const VoxelScene: React.FC = () => {
  const mountRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const raycasterRef = useRef<GridRaycaster | null>(null);
  const builderRef = useRef<Builder | null>(null);

  const [gridPosition, setGridPosition] = useState<GridPosition | null>(null);

  useEffect(() => {
    if (!mountRef.current) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x111111);
    sceneRef.current = scene;

    builderRef.current = new Builder(scene);

    const width = mountRef.current.clientWidth;
    const height = mountRef.current.clientHeight;

    const camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
    camera.position.set(10, 8, 10);
    camera.lookAt(0, 0, 0);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(window.devicePixelRatio);
    mountRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;

    const { groundMaterial, groundGeometry, groundPlane } =
      addGroundPlane(scene);

    if (groundPlane && mountRef.current) {
      raycasterRef.current = new GridRaycaster(
        camera,
        groundPlane,
        mountRef.current,
        {
          onHover: (position) => {
            console.log("hover", position);
            if (position) builderRef.current!.onMouseHover(position);
          },
          onClick: (position) => {
            setGridPosition(position);
            console.log(
              `Grid Position Clicked: (${position?.x}, ${position?.z})`
            );
          },
        }
      );
    }

    const ambientLight = new THREE.AmbientLight(0xffffff);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
    directionalLight.position.set(1, 1, 1);
    scene.add(directionalLight);

    const handleResize = (): void => {
      if (!mountRef.current || !rendererRef.current || !cameraRef.current)
        return;

      const width = mountRef.current.clientWidth;
      const height = mountRef.current.clientHeight;

      cameraRef.current.aspect = width / height;
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(width, height);
    };

    window.addEventListener("resize", handleResize);

    const animate = (): void => {
      requestAnimationFrame(animate);
      controls.update();
      if (rendererRef.current && sceneRef.current && cameraRef.current) {
        rendererRef.current.render(sceneRef.current, cameraRef.current);
      }
    };

    animate();

    return () => {
      window.removeEventListener("resize", handleResize);

      raycasterRef.current?.dispose();

      if (rendererRef.current && mountRef.current) {
        mountRef.current.removeChild(rendererRef.current.domElement);
      }

      groundGeometry.dispose();
      groundMaterial.dispose();

      rendererRef.current?.dispose();
    };
  }, []);

  return (
    <div
      ref={mountRef}
      style={{
        width: "100%",
        height: "100%",
        position: "absolute",
        top: 0,
        left: 0,
        overflow: "hidden",
      }}
    />
  );
};

export default VoxelScene;
