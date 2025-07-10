import { useEffect, useRef } from "react";
import * as THREE from "three";
import { useCurrentProject } from "@/contexts/CurrentProjectContext";
import { createVoxelMaterial } from "@/modeling/lib/shader";
import { faces } from "@/modeling/lib/voxel-constants";
import { getTextureCoordinates } from "@/modeling/lib/texture-coords";

interface BlockFacePreviewProps {
  faces: number[];
  showLabels?: boolean;
}

interface SceneRef {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  mesh: THREE.Mesh;
  material: THREE.ShaderMaterial;
  controls: any;
  labels: THREE.Sprite[];
}

export const BlockFacePreview = ({
  faces: faceTextures,
  showLabels = false,
}: BlockFacePreviewProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<SceneRef | null>(null);

  const { atlas, textureAtlas } = useCurrentProject();

  const createTextSprite = (text: string, color: string = "#ffffff") => {
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    if (!context) return null;

    const fontSize = 32;
    canvas.width = 64;
    canvas.height = 64;

    context.fillStyle = "rgba(0, 0, 0, 0.6)";
    context.beginPath();
    context.roundRect(4, 4, 56, 56, 8);
    context.fill();

    context.fillStyle = color;
    context.font = `bold ${fontSize}px Arial`;
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText(text, canvas.width / 2, canvas.height / 2);

    const texture = new THREE.CanvasTexture(canvas);
    const material = new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      opacity: 0.7,
    });
    const sprite = new THREE.Sprite(material);
    sprite.scale.set(0.25, 0.25, 1);

    return sprite;
  };

  const createCubeGeometry = (
    textureIndexes: number[]
  ): THREE.BufferGeometry => {
    const geometry = new THREE.BufferGeometry();

    const vertices: number[] = [];
    const normals: number[] = [];
    const uvs: number[] = [];
    const ao: number[] = [];
    const indices: number[] = [];

    let vertexIndex = 0;

    for (let faceIndex = 0; faceIndex < 6; faceIndex++) {
      const face = faces[faceIndex];
      const faceVertices = face.vertices;
      const faceNormal = face.normal;

      const textureIndex = textureIndexes[faceIndex];
      const textureCoords = getTextureCoordinates(
        textureIndex,
        Math.sqrt(atlas.size),
        atlas.cellSize
      );

      const startVertexIndex = vertexIndex;

      for (let j = 0; j < 4; j++) {
        const vertex = faceVertices[j];

        vertices.push(vertex[0], vertex[1], vertex[2]);
        normals.push(faceNormal[0], faceNormal[1], faceNormal[2]);
        uvs.push(textureCoords[j * 2], textureCoords[j * 2 + 1]);
        ao.push(1.0);

        vertexIndex++;
      }

      indices.push(
        startVertexIndex,
        startVertexIndex + 1,
        startVertexIndex + 2,
        startVertexIndex,
        startVertexIndex + 2,
        startVertexIndex + 3
      );
    }

    geometry.setAttribute(
      "position",
      new THREE.BufferAttribute(new Float32Array(vertices), 3)
    );
    geometry.setAttribute(
      "normal",
      new THREE.BufferAttribute(new Float32Array(normals), 3)
    );
    geometry.setAttribute(
      "uv",
      new THREE.BufferAttribute(new Float32Array(uvs), 2)
    );
    geometry.setAttribute(
      "aochannel",
      new THREE.BufferAttribute(new Float32Array(ao), 1)
    );
    geometry.setIndex(new THREE.BufferAttribute(new Uint32Array(indices), 1));

    return geometry;
  };

  const createFaceLabels = () => {
    const faceNames = ["R", "L", "T", "B", "F", "K"];
    const facePositions = [
      [0.65, 0, 0], // Right
      [-0.65, 0, 0], // Left
      [0, 0.65, 0], // Top
      [0, -0.65, 0], // Bottom
      [0, 0, 0.65], // Front
      [0, 0, -0.65], // Back
    ];

    const labels: THREE.Sprite[] = [];

    for (let i = 0; i < 6; i++) {
      const sprite = createTextSprite(faceNames[i]);
      if (sprite) {
        sprite.position.set(
          facePositions[i][0],
          facePositions[i][1],
          facePositions[i][2]
        );
        labels.push(sprite);
      }
    }

    return labels;
  };

  useEffect(() => {
    if (!containerRef.current || !textureAtlas) return;

    const container = containerRef.current;
    const width = container.clientWidth;
    const height = container.clientHeight;

    const scene = new THREE.Scene();

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    camera.position.set(4, 4, 4);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setClearColor(0x000000, 0);
    renderer.setSize(width, height);
    renderer.setPixelRatio(window.devicePixelRatio);
    container.appendChild(renderer.domElement);

    const geometry = createCubeGeometry(faceTextures);
    const material = createVoxelMaterial(textureAtlas);
    const mesh = new THREE.Mesh(geometry, material);
    scene.add(mesh);

    const labels = showLabels ? createFaceLabels() : [];
    labels.forEach((label) => scene.add(label));

    const initControls = async () => {
      const { OrbitControls } = await import(
        "three/examples/jsm/controls/OrbitControls.js"
      );
      const controls = new OrbitControls(camera, renderer.domElement);
      controls.enableDamping = true;
      controls.dampingFactor = 0.05;
      controls.enableZoom = true;
      controls.enablePan = false;
      controls.autoRotate = true;
      controls.autoRotateSpeed = 0.5;
      controls.minDistance = 1;
      controls.maxDistance = 50;

      sceneRef.current = {
        scene,
        camera,
        renderer,
        mesh,
        material,
        controls,
        labels,
      };

      const animate = () => {
        if (!sceneRef.current) return;
        requestAnimationFrame(animate);

        sceneRef.current.controls.update();

        sceneRef.current.renderer.render(
          sceneRef.current.scene,
          sceneRef.current.camera
        );
      };

      animate();
    };

    initControls();

    const handleResize = () => {
      if (!sceneRef.current || !container) return;
      const newWidth = container.clientWidth;
      const newHeight = container.clientHeight;

      sceneRef.current.camera.aspect = newWidth / newHeight;
      sceneRef.current.camera.updateProjectionMatrix();
      sceneRef.current.renderer.setSize(newWidth, newHeight);
    };

    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      if (sceneRef.current) {
        if (sceneRef.current.controls) {
          sceneRef.current.controls.dispose();
        }
        sceneRef.current.labels.forEach((label) => {
          if (label.material.map) {
            label.material.map.dispose();
          }
          label.material.dispose();
        });
        container.removeChild(sceneRef.current.renderer.domElement);
        sceneRef.current.renderer.dispose();
        geometry.dispose();
      }
    };
  }, [textureAtlas]);

  useEffect(() => {
    if (sceneRef.current && sceneRef.current.mesh) {
      const newGeometry = createCubeGeometry(faceTextures);
      sceneRef.current.mesh.geometry.dispose();
      sceneRef.current.mesh.geometry = newGeometry;
    }
  }, [faceTextures, atlas.cellSize, atlas.size]);

  useEffect(() => {
    if (!sceneRef.current) return;

    sceneRef.current.labels.forEach((label) => {
      sceneRef.current!.scene.remove(label);
      if (label.material.map) {
        label.material.map.dispose();
      }
      label.material.dispose();
    });

    if (showLabels) {
      const newLabels = createFaceLabels();
      newLabels.forEach((label) => sceneRef.current!.scene.add(label));
      sceneRef.current.labels = newLabels;
    } else {
      sceneRef.current.labels = [];
    }
  }, [showLabels]);

  return <div ref={containerRef} className="w-full h-full overflow-hidden" />;
};
