import { useCallback, useEffect, useRef } from "react";
import * as THREE from "three";
import { useCurrentProject } from "@/contexts/CurrentProjectContext";
import { createVoxelMaterial } from "@/modeling/lib/shader";
import { faces } from "@/modeling/lib/voxel-constants";
import { getTextureCoordinates } from "@/modeling/lib/texture-coords";

const frustumSize = 2;

interface BlockPreviewProps {
  blockIndex: number;
  size: "small" | "large";
  className?: string;
}

export const BlockPreview = ({
  blockIndex,
  size,
  className,
}: BlockPreviewProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<{
    scene: THREE.Scene;
    camera: THREE.Camera;
    renderer: THREE.WebGLRenderer;
    mesh: THREE.Mesh;
    material: THREE.ShaderMaterial;
  } | null>(null);

  const { atlas, textureAtlas, blocks } = useCurrentProject();

  const createCubeGeometry = useCallback((): THREE.BufferGeometry => {
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

      const blockBlueprint = blocks.blockFaceAtlasIndexes[blockIndex];
      const textureIndex = blockBlueprint[faceIndex];

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
  }, [atlas.cellSize, atlas.size, blockIndex, blocks.blockFaceAtlasIndexes]);

  const setupScene = useCallback(() => {
    if (!containerRef.current || !textureAtlas) return;

    const container = containerRef.current;
    const width = container.clientWidth;
    const height = container.clientHeight;

    const scene = new THREE.Scene();

    let camera: THREE.Camera;
    if (size === "small") {
      const aspect = width / height;
      camera = new THREE.OrthographicCamera(
        (-frustumSize * aspect) / 2,
        (frustumSize * aspect) / 2,
        frustumSize / 2,
        -frustumSize / 2,
        0.1,
        1000
      );
      camera.position.set(1, Math.sqrt(2), 1);
    } else {
      camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
      camera.position.set(4, 4, 4);
    }

    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
    });
    renderer.setClearColor(0x000000, 0);
    renderer.setSize(width, height);
    renderer.setPixelRatio(window.devicePixelRatio);
    container.appendChild(renderer.domElement);

    const geometry = createCubeGeometry();
    const material = createVoxelMaterial(textureAtlas);
    const mesh = new THREE.Mesh(geometry, material);

    scene.add(mesh);

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.4);
    directionalLight.position.set(1, 1, 1);
    scene.add(directionalLight);

    sceneRef.current = { scene, camera, renderer, mesh, material };

    sceneRef.current.renderer.render(
      sceneRef.current.scene,
      sceneRef.current.camera
    );
  }, [textureAtlas, size, createCubeGeometry]);

  const handleResize = useCallback(() => {
    if (!containerRef.current || !sceneRef.current) return;

    const container = containerRef.current;
    const width = container.clientWidth;
    const height = container.clientHeight;

    sceneRef.current.renderer.setSize(width, height);

    if (sceneRef.current.camera instanceof THREE.PerspectiveCamera) {
      sceneRef.current.camera.aspect = width / height;
      sceneRef.current.camera.updateProjectionMatrix();
    } else if (sceneRef.current.camera instanceof THREE.OrthographicCamera) {
      const aspect = width / height;
      sceneRef.current.camera.left = (-frustumSize * aspect) / 2;
      sceneRef.current.camera.right = (frustumSize * aspect) / 2;
      sceneRef.current.camera.top = frustumSize / 2;
      sceneRef.current.camera.bottom = -frustumSize / 2;
      sceneRef.current.camera.updateProjectionMatrix();
    }
  }, []);

  useEffect(() => {
    setupScene();

    const handleResizeEvent = handleResize;
    window.addEventListener("resize", handleResizeEvent);

    return () => {
      window.removeEventListener("resize", handleResizeEvent);
      if (sceneRef.current) {
        sceneRef.current.renderer.dispose();
        sceneRef.current.mesh.geometry?.dispose();
        sceneRef.current.material?.dispose();
        if (
          containerRef.current?.contains(sceneRef.current.renderer.domElement)
        ) {
          containerRef.current.removeChild(
            sceneRef.current.renderer.domElement
          );
        }
      }
    };
  }, [setupScene, handleResize]);

  useEffect(() => {
    if (sceneRef.current && textureAtlas) {
      const newGeometry = createCubeGeometry();
      sceneRef.current.mesh.geometry.dispose();
      sceneRef.current.mesh.geometry = newGeometry;
    }
  }, [atlas, blocks, createCubeGeometry, textureAtlas]);

  return (
    <div
      ref={containerRef}
      className={`w-full h-full pointer-events-none ${className || ""}`}
    />
  );
};
