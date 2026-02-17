import { useRef, useEffect, useCallback } from "react";
import * as THREE from "three";
import type { Vector3, ChunkData } from "@/state/types";
import { stateStore } from "@/state/store";
import { BLOCK_TYPE_MASK } from "@/modeling/lib/voxel-constants";

interface AnchorPreview3DProps {
  currentDimensions: Vector3;
  newDimensions: Vector3;
  anchor: Vector3;
  onAnchorChange: (anchor: Vector3) => void;
  colors: number[];
}

type AnchorValue = 0 | 0.5 | 1;

const ANCHOR_VALUES: AnchorValue[] = [0, 0.5, 1];

const ANCHOR_RADIUS = 0.6;
const ANCHOR_COLOR_DEFAULT = 0x666688;
const ANCHOR_COLOR_HOVERED = 0x8888cc;
const ANCHOR_COLOR_SELECTED = 0x44bbff;

export const AnchorPreview3D = ({
  currentDimensions,
  newDimensions,
  anchor,
  onAnchorChange,
  colors,
}: AnchorPreview3DProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const anchorMeshesRef = useRef<THREE.Mesh[]>([]);
  const hoveredRef = useRef<THREE.Mesh | null>(null);
  const voxelGroupRef = useRef<THREE.Group | null>(null);
  const currentBoxRef = useRef<THREE.LineSegments | null>(null);
  const newBoxRef = useRef<THREE.LineSegments | null>(null);
  const anchorRef = useRef<Vector3>(anchor);
  const isDraggingRef = useRef(false);
  const lastMouseRef = useRef({ x: 0, y: 0 });
  const mouseDownPosRef = useRef({ x: 0, y: 0 });
  const phiRef = useRef(Math.PI / 4);
  const thetaRef = useRef(Math.PI / 4);
  const distanceRef = useRef(0);
  const targetRef = useRef(new THREE.Vector3());
  const onAnchorChangeRef = useRef(onAnchorChange);

  anchorRef.current = anchor;
  onAnchorChangeRef.current = onAnchorChange;

  const buildVoxelMesh = useCallback(
    (scene: THREE.Scene) => {
      if (voxelGroupRef.current) {
        scene.remove(voxelGroupRef.current);
        voxelGroupRef.current.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            child.geometry.dispose();
            (child.material as THREE.Material).dispose();
          }
        });
      }

      const group = new THREE.Group();
      const state = stateStore.getState();
      const chunks = state.chunks;
      const materialCache = new Map<number, THREE.MeshLambertMaterial>();

      const getMaterial = (colorIndex: number) => {
        if (materialCache.has(colorIndex)) return materialCache.get(colorIndex)!;
        const colorVal =
          colorIndex > 0 && colorIndex <= colors.length
            ? colors[colorIndex - 1]
            : 0x888888;
        const mat = new THREE.MeshLambertMaterial({ color: colorVal });
        materialCache.set(colorIndex, mat);
        return mat;
      };

      const boxGeo = new THREE.BoxGeometry(1, 1, 1);

      for (const chunk of chunks.values()) {
        addChunkVoxels(chunk, group, boxGeo, getMaterial);
      }

      boxGeo.dispose();
      scene.add(group);
      voxelGroupRef.current = group;
    },
    [colors]
  );

  const buildAnchorSpheres = useCallback(
    (scene: THREE.Scene, dims: Vector3) => {
      for (const mesh of anchorMeshesRef.current) {
        scene.remove(mesh);
        mesh.geometry.dispose();
        (mesh.material as THREE.Material).dispose();
      }
      anchorMeshesRef.current = [];

      const geo = new THREE.SphereGeometry(ANCHOR_RADIUS, 12, 8);

      for (const ax of ANCHOR_VALUES) {
        for (const ay of ANCHOR_VALUES) {
          for (const az of ANCHOR_VALUES) {
            const isSelected =
              anchorRef.current.x === ax &&
              anchorRef.current.y === ay &&
              anchorRef.current.z === az;
            const mat = new THREE.MeshLambertMaterial({
              color: isSelected ? ANCHOR_COLOR_SELECTED : ANCHOR_COLOR_DEFAULT,
              transparent: true,
              opacity: isSelected ? 0.95 : 0.5,
            });
            const sphere = new THREE.Mesh(geo, mat);
            sphere.position.set(
              ax * dims.x,
              ay * dims.y,
              az * dims.z
            );
            sphere.userData = { anchorX: ax, anchorY: ay, anchorZ: az };
            scene.add(sphere);
            anchorMeshesRef.current.push(sphere);
          }
        }
      }

      geo.dispose();
    },
    []
  );

  const updateAnchorColors = useCallback(() => {
    for (const mesh of anchorMeshesRef.current) {
      const { anchorX, anchorY, anchorZ } = mesh.userData;
      const isSelected =
        anchorRef.current.x === anchorX &&
        anchorRef.current.y === anchorY &&
        anchorRef.current.z === anchorZ;
      const isHovered = mesh === hoveredRef.current;
      const mat = mesh.material as THREE.MeshLambertMaterial;
      if (isSelected) {
        mat.color.setHex(ANCHOR_COLOR_SELECTED);
        mat.opacity = 0.95;
      } else if (isHovered) {
        mat.color.setHex(ANCHOR_COLOR_HOVERED);
        mat.opacity = 0.7;
      } else {
        mat.color.setHex(ANCHOR_COLOR_DEFAULT);
        mat.opacity = 0.5;
      }
    }
  }, []);

  const buildBoundsBoxes = useCallback(
    (scene: THREE.Scene, curDims: Vector3, newDims: Vector3, anch: Vector3) => {
      if (currentBoxRef.current) {
        scene.remove(currentBoxRef.current);
        currentBoxRef.current.geometry.dispose();
        (currentBoxRef.current.material as THREE.Material).dispose();
      }
      if (newBoxRef.current) {
        scene.remove(newBoxRef.current);
        newBoxRef.current.geometry.dispose();
        (newBoxRef.current.material as THREE.Material).dispose();
      }

      const curGeo = new THREE.BoxGeometry(curDims.x, curDims.y, curDims.z);
      const curEdges = new THREE.EdgesGeometry(curGeo);
      const curMat = new THREE.LineBasicMaterial({
        color: 0x888888,
        transparent: true,
        opacity: 0.6,
      });
      const curBox = new THREE.LineSegments(curEdges, curMat);
      curBox.position.set(curDims.x / 2, curDims.y / 2, curDims.z / 2);
      scene.add(curBox);
      currentBoxRef.current = curBox;
      curGeo.dispose();

      const dx = newDims.x - curDims.x;
      const dy = newDims.y - curDims.y;
      const dz = newDims.z - curDims.z;
      const offsetX = Math.round(dx * anch.x);
      const offsetY = Math.round(dy * anch.y);
      const offsetZ = Math.round(dz * anch.z);

      const newGeo = new THREE.BoxGeometry(newDims.x, newDims.y, newDims.z);
      const newEdges = new THREE.EdgesGeometry(newGeo);
      const newMat = new THREE.LineBasicMaterial({
        color: 0x44bbff,
        transparent: true,
        opacity: 0.8,
      });
      const newBox = new THREE.LineSegments(newEdges, newMat);
      newBox.position.set(
        newDims.x / 2 - offsetX,
        newDims.y / 2 - offsetY,
        newDims.z / 2 - offsetZ
      );
      scene.add(newBox);
      newBoxRef.current = newBox;
      newGeo.dispose();
    },
    []
  );

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x181826);
    sceneRef.current = scene;

    const ambient = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambient);
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight.position.set(1, 2, 1.5);
    scene.add(dirLight);

    const width = container.clientWidth;
    const height = container.clientHeight;
    const camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 2000);
    cameraRef.current = camera;

    const maxDim = Math.max(
      currentDimensions.x,
      currentDimensions.y,
      currentDimensions.z
    );
    const dist = maxDim * 1.6;
    distanceRef.current = dist;
    targetRef.current.set(
      currentDimensions.x / 2,
      currentDimensions.y / 2,
      currentDimensions.z / 2
    );

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(window.devicePixelRatio);
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    buildVoxelMesh(scene);
    buildAnchorSpheres(scene, currentDimensions);
    buildBoundsBoxes(scene, currentDimensions, newDimensions, anchor);

    const updateCamera = () => {
      const x =
        distanceRef.current *
        Math.sin(phiRef.current) *
        Math.sin(thetaRef.current);
      const y = distanceRef.current * Math.cos(phiRef.current);
      const z =
        distanceRef.current *
        Math.sin(phiRef.current) *
        Math.cos(thetaRef.current);
      camera.position.set(
        targetRef.current.x + x,
        targetRef.current.y + y,
        targetRef.current.z + z
      );
      camera.lookAt(targetRef.current);
    };
    updateCamera();

    const animate = () => {
      animFrameRef.current = requestAnimationFrame(animate);
      renderer.render(scene, camera);
    };
    animate();

    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    const onMouseDown = (e: MouseEvent) => {
      isDraggingRef.current = false;
      lastMouseRef.current = { x: e.clientX, y: e.clientY };
      mouseDownPosRef.current = { x: e.clientX, y: e.clientY };
    };

    const onMouseMove = (e: MouseEvent) => {
      const dx = e.clientX - lastMouseRef.current.x;
      const dy = e.clientY - lastMouseRef.current.y;
      const totalDx = e.clientX - mouseDownPosRef.current.x;
      const totalDy = e.clientY - mouseDownPosRef.current.y;

      if (
        e.buttons > 0 &&
        Math.sqrt(totalDx * totalDx + totalDy * totalDy) > 3
      ) {
        isDraggingRef.current = true;
      }

      if (e.buttons > 0 && isDraggingRef.current) {
        thetaRef.current -= dx * 0.005;
        phiRef.current = Math.max(
          0.1,
          Math.min(Math.PI - 0.1, phiRef.current - dy * 0.005)
        );
        updateCamera();
      }

      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(mouse, camera);
      const hits = raycaster.intersectObjects(anchorMeshesRef.current);
      const prev = hoveredRef.current;
      hoveredRef.current = hits.length > 0 ? (hits[0].object as THREE.Mesh) : null;
      if (prev !== hoveredRef.current) {
        updateAnchorColors();
        renderer.domElement.style.cursor = hoveredRef.current
          ? "pointer"
          : "grab";
      }

      lastMouseRef.current = { x: e.clientX, y: e.clientY };
    };

    const onMouseUp = () => {
      if (!isDraggingRef.current && hoveredRef.current) {
        const { anchorX, anchorY, anchorZ } = hoveredRef.current.userData;
        onAnchorChangeRef.current({ x: anchorX, y: anchorY, z: anchorZ });
      }
      isDraggingRef.current = false;
    };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? 1 : -1;
      const speed = distanceRef.current * 0.1;
      distanceRef.current = Math.max(
        maxDim * 0.5,
        distanceRef.current + delta * speed
      );
      updateCamera();
    };

    const onContext = (e: MouseEvent) => e.preventDefault();

    const el = renderer.domElement;
    el.addEventListener("mousedown", onMouseDown);
    el.addEventListener("mousemove", onMouseMove);
    el.addEventListener("mouseup", onMouseUp);
    el.addEventListener("wheel", onWheel, { passive: false });
    el.addEventListener("contextmenu", onContext);
    el.style.cursor = "grab";

    const ro = new ResizeObserver(() => {
      const w = container.clientWidth;
      const h = container.clientHeight;
      if (w > 0 && h > 0) {
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h);
      }
    });
    ro.observe(container);

    return () => {
      ro.disconnect();
      if (animFrameRef.current !== null)
        cancelAnimationFrame(animFrameRef.current);
      el.removeEventListener("mousedown", onMouseDown);
      el.removeEventListener("mousemove", onMouseMove);
      el.removeEventListener("mouseup", onMouseUp);
      el.removeEventListener("wheel", onWheel);
      el.removeEventListener("contextmenu", onContext);
      renderer.dispose();
      if (container.contains(el)) container.removeChild(el);
      sceneRef.current = null;
      rendererRef.current = null;
      cameraRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!sceneRef.current) return;
    buildAnchorSpheres(sceneRef.current, currentDimensions);
  }, [currentDimensions, buildAnchorSpheres]);

  useEffect(() => {
    updateAnchorColors();
  }, [anchor, updateAnchorColors]);

  useEffect(() => {
    if (!sceneRef.current) return;
    buildBoundsBoxes(
      sceneRef.current,
      currentDimensions,
      newDimensions,
      anchor
    );
  }, [newDimensions, anchor, currentDimensions, buildBoundsBoxes]);

  return (
    <div
      ref={containerRef}
      className="w-full rounded-lg overflow-hidden border border-border"
      style={{ height: 300 }}
    />
  );
};

function addChunkVoxels(
  chunk: ChunkData,
  group: THREE.Group,
  boxGeo: THREE.BoxGeometry,
  getMaterial: (colorIndex: number) => THREE.MeshLambertMaterial
) {
  const { minPos, size, voxels } = chunk;
  for (let lx = 0; lx < size.x; lx++) {
    for (let ly = 0; ly < size.y; ly++) {
      for (let lz = 0; lz < size.z; lz++) {
        const idx = lx * size.y * size.z + ly * size.z + lz;
        const val = voxels[idx];
        if (val === 0) continue;
        const blockType = val & BLOCK_TYPE_MASK;
        if (blockType === 0) continue;

        const mesh = new THREE.Mesh(boxGeo, getMaterial(blockType));
        mesh.position.set(
          minPos.x + lx + 0.5,
          minPos.y + ly + 0.5,
          minPos.z + lz + 0.5
        );
        group.add(mesh);
      }
    }
  }
}
