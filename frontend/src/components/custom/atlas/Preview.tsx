import { useEffect, useRef } from "react";
import "@/components/custom/color-picker.css";
import * as THREE from "three";
import { createVoxelMaterial } from "@/modeling/lib/shader";
import { faces } from "@/modeling/lib/voxel-constants";
import { getTextureCoordinates } from "@/modeling/lib/texture-coords";

interface FaceData {
  color: number | null;
  texture: ImageData | null;
}

export const CubePreview = ({ faces: faceData }: { faces: FaceData[] }) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<{
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    renderer: THREE.WebGLRenderer;
    cube: THREE.Mesh;
    material: THREE.ShaderMaterial;
  } | null>(null);
  const lastTimeRef = useRef<number>(0);
  const angleRef = useRef<number>(0);

  const createTextureAtlas = (
    faceData: FaceData[]
  ): {
    texture: THREE.Texture;
    atlasSize: number;
    cellSize: number;
  } => {
    const maxTextureSize = Math.max(
      ...faceData.map((face) =>
        face.texture ? Math.max(face.texture.width, face.texture.height) : 1
      )
    );

    const atlasSize = Math.ceil(Math.sqrt(6));
    const cellSize = maxTextureSize;
    const atlasPixelSize = atlasSize * cellSize;

    const canvas = document.createElement("canvas");
    canvas.width = atlasPixelSize;
    canvas.height = atlasPixelSize;
    const ctx = canvas.getContext("2d");

    if (!ctx) {
      throw new Error("Could not create canvas context");
    }

    ctx.imageSmoothingEnabled = false;

    for (let i = 0; i < 6; i++) {
      const face = faceData[i] || {};
      const col = i % atlasSize;
      const row = Math.floor(i / atlasSize);
      const x = col * cellSize;
      const y = row * cellSize;

      if (face.texture) {
        console.log("Texture face", i, face.texture);
        const tempCanvas = document.createElement("canvas");
        tempCanvas.width = face.texture.width;
        tempCanvas.height = face.texture.height;
        const tempCtx = tempCanvas.getContext("2d");
        if (tempCtx) {
          tempCtx.putImageData(face.texture, 0, 0);
          ctx.drawImage(tempCanvas, x, y, cellSize, cellSize);
        }
      } else if (face.color !== null) {
        console.log("Colored face", face.color);
        const color = new THREE.Color(face.color);
        ctx.fillStyle = `rgb(${Math.floor(color.r * 255)}, ${Math.floor(
          color.g * 255
        )}, ${Math.floor(color.b * 255)})`;
        ctx.fillRect(x, y, cellSize, cellSize);
      } else {
        console.log("White face");
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(x, y, cellSize, cellSize);
      }
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = THREE.NearestFilter;
    texture.magFilter = THREE.NearestFilter;
    texture.flipY = false;

    return { texture, atlasSize, cellSize };
  };

  const createCubeGeometry = (
    atlasSize: number,
    cellSize: number
  ): THREE.BufferGeometry => {
    const vertices = new Float32Array(6 * 4 * 3);
    const normals = new Float32Array(6 * 4 * 3);
    const uvs = new Float32Array(6 * 4 * 2);
    const indices = new Uint32Array(6 * 6);

    let vertexOffset = 0;
    let normalOffset = 0;
    let uvOffset = 0;
    let indexOffset = 0;

    for (let faceIndex = 0; faceIndex < 6; faceIndex++) {
      const face = faces[faceIndex];
      const textureCoords = getTextureCoordinates(
        faceIndex,
        atlasSize,
        cellSize
      );

      for (let j = 0; j < 4; j++) {
        const vertex = face.vertices[j];
        vertices[vertexOffset] = vertex[0];
        vertices[vertexOffset + 1] = vertex[1];
        vertices[vertexOffset + 2] = vertex[2];
        vertexOffset += 3;

        normals[normalOffset] = face.normal[0];
        normals[normalOffset + 1] = face.normal[1];
        normals[normalOffset + 2] = face.normal[2];
        normalOffset += 3;

        uvs[uvOffset] = textureCoords[j * 2];
        uvs[uvOffset + 1] = textureCoords[j * 2 + 1];
        uvOffset += 2;
      }

      const baseVertex = faceIndex * 4;
      indices[indexOffset] = baseVertex;
      indices[indexOffset + 1] = baseVertex + 1;
      indices[indexOffset + 2] = baseVertex + 2;
      indices[indexOffset + 3] = baseVertex;
      indices[indexOffset + 4] = baseVertex + 2;
      indices[indexOffset + 5] = baseVertex + 3;
      indexOffset += 6;
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(vertices, 3));
    geometry.setAttribute("normal", new THREE.BufferAttribute(normals, 3));
    geometry.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));
    geometry.setIndex(new THREE.BufferAttribute(indices, 1));

    return geometry;
  };

  useEffect(() => {
    if (!mountRef.current) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1a1a1a);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    const containerWidth = mountRef.current.clientWidth;
    const width = containerWidth;
    const height = width * 0.5;
    const aspectRatio = width / height;

    const camera = new THREE.PerspectiveCamera(75, aspectRatio, 0.1, 1000);

    renderer.setSize(width, height);

    const {
      texture: atlasTexture,
      atlasSize,
      cellSize,
    } = createTextureAtlas(faceData);
    const geometry = createCubeGeometry(atlasSize, cellSize);
    const material = createVoxelMaterial(atlasTexture);

    const cube = new THREE.Mesh(geometry, material);
    scene.add(cube);

    mountRef.current.appendChild(renderer.domElement);
    sceneRef.current = { scene, camera, renderer, cube, material };
    lastTimeRef.current = performance.now();

    const animate = (currentTime: number) => {
      if (!sceneRef.current) return;
      requestAnimationFrame(animate);

      const deltaTime = currentTime - lastTimeRef.current;
      lastTimeRef.current = currentTime;

      const rotationSpeed = 0.0003;
      angleRef.current += rotationSpeed * deltaTime;

      const radius = 1.5;
      const x = Math.cos(angleRef.current) * radius;
      const z = Math.sin(angleRef.current) * radius;
      const y = 0.75;

      sceneRef.current.camera.position.set(x, y, z);
      sceneRef.current.camera.lookAt(0, -0.1, 0);

      sceneRef.current.renderer.render(
        sceneRef.current.scene,
        sceneRef.current.camera
      );
    };

    animate(performance.now());

    return () => {
      if (sceneRef.current) {
        mountRef.current?.removeChild(sceneRef.current.renderer.domElement);
        sceneRef.current.renderer.dispose();
        geometry.dispose();
        atlasTexture.dispose();
      }
    };
  }, [faceData]);

  return (
    <div
      ref={mountRef}
      className="rounded-xs overflow-hidden border border-border"
    />
  );
};
