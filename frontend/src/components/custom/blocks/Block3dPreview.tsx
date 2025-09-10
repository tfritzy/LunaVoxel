import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { faces } from "@/modeling/lib/voxel-constants";

interface Block3DPreviewProps {
  faceColors: string[];
}

const createColorMaterial = (opacity: number = 1) => {
  const vertexShader = `
    attribute vec3 color;
    attribute float aochannel;
    varying vec3 vColor;
    varying vec3 vNormal;
    varying float vAO;
    
    void main() {
      vColor = color;
      vNormal = normalize(mat3(modelMatrix) * normal);
      vAO = aochannel;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `;

  const fragmentShader = `
    uniform float opacity;
    varying vec3 vColor;
    varying vec3 vNormal;
    varying float vAO;
    
    void main() {
      vec3 normal = normalize(vNormal);
      
      float darknessFactor = 1.0;
      
      if (abs(normal.y - 1.0) < 0.1) {
        darknessFactor = 1.0;
      } else if (abs(normal.y + 1.0) < 0.1) {
        darknessFactor = 0.6;
      } else if (abs(normal.x) > 0.9) {
        darknessFactor = 0.9;
      } else if (abs(normal.z) > 0.9) {
        darknessFactor = 0.8;
      }
      
      vec3 finalColor = vColor * darknessFactor * vAO;
      
      gl_FragColor = vec4(finalColor, opacity);
    }
  `;

  return new THREE.ShaderMaterial({
    uniforms: {
      opacity: { value: opacity },
    },
    vertexShader,
    fragmentShader,
    side: THREE.FrontSide,
    vertexColors: true,
  });
};

export const Block3DPreview = ({ faceColors }: Block3DPreviewProps) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const meshRef = useRef<THREE.Mesh | null>(null);
  const materialRef = useRef<THREE.ShaderMaterial | null>(null);
  const frameRef = useRef<number | null>(null);
  const mouseRef = useRef({ x: 0, y: 0, isDown: false });
  const cameraRotationRef = useRef({ theta: Math.PI / 4, phi: Math.PI / 4 });
  const targetCameraRotationRef = useRef({
    theta: Math.PI / 4,
    phi: Math.PI / 4,
  });
  const lastTimeRef = useRef(0);

  const [isInitialized, setIsInitialized] = useState(false);

  const createCubeGeometry = (colors: string[]): THREE.BufferGeometry => {
    const geometry = new THREE.BufferGeometry();
    const vertices: number[] = [];
    const normals: number[] = [];
    const vertexColors: number[] = [];
    const ao: number[] = [];
    const indices: number[] = [];

    let vertexIndex = 0;

    for (let faceIndex = 0; faceIndex < 6; faceIndex++) {
      const face = faces[faceIndex];
      const faceVertices = face.vertices;
      const faceNormal = face.normal;

      const color = new THREE.Color(colors[faceIndex]);

      const startVertexIndex = vertexIndex;

      for (let j = 0; j < 4; j++) {
        const vertex = faceVertices[j];
        vertices.push(vertex[0], vertex[1], vertex[2]);
        normals.push(faceNormal[0], faceNormal[1], faceNormal[2]);
        vertexColors.push(color.r, color.g, color.b);
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
      "color",
      new THREE.BufferAttribute(new Float32Array(vertexColors), 3)
    );
    geometry.setAttribute(
      "aochannel",
      new THREE.BufferAttribute(new Float32Array(ao), 1)
    );
    geometry.setIndex(new THREE.BufferAttribute(new Uint32Array(indices), 1));

    return geometry;
  };

  const updateGeometry = () => {
    if (!meshRef.current) return;

    const newGeometry = createCubeGeometry(faceColors);
    const oldGeometry = meshRef.current.geometry;
    meshRef.current.geometry = newGeometry;
    oldGeometry.dispose();
  };

  const updateCameraPosition = () => {
    if (!cameraRef.current) return;

    const radius = 8;
    const theta = cameraRotationRef.current.theta;
    const phi = cameraRotationRef.current.phi;

    cameraRef.current.position.x = radius * Math.sin(phi) * Math.cos(theta);
    cameraRef.current.position.y = radius * Math.cos(phi);
    cameraRef.current.position.z = radius * Math.sin(phi) * Math.sin(theta);

    cameraRef.current.lookAt(0, 0, 0);
  };

  const animate = (time: number) => {
    if (!rendererRef.current || !sceneRef.current || !cameraRef.current) return;

    const deltaTime = (time - lastTimeRef.current) / 1000;
    lastTimeRef.current = time;

    const rotationSpeed = 5;
    const autoRotationSpeed = 0.05;

    cameraRotationRef.current.theta +=
      (targetCameraRotationRef.current.theta -
        cameraRotationRef.current.theta) *
      rotationSpeed *
      deltaTime;
    cameraRotationRef.current.phi +=
      (targetCameraRotationRef.current.phi - cameraRotationRef.current.phi) *
      rotationSpeed *
      deltaTime;

    if (!mouseRef.current.isDown) {
      targetCameraRotationRef.current.theta += autoRotationSpeed * deltaTime;
    }

    updateCameraPosition();

    rendererRef.current.render(sceneRef.current, cameraRef.current);
    frameRef.current = requestAnimationFrame(animate);
  };

  const handleMouseDown = (event: MouseEvent) => {
    mouseRef.current.isDown = true;
    mouseRef.current.x = event.clientX;
    mouseRef.current.y = event.clientY;
  };

  const handleMouseMove = (event: MouseEvent) => {
    if (!mouseRef.current.isDown) return;

    const deltaX = event.clientX - mouseRef.current.x;
    const deltaY = event.clientY - mouseRef.current.y;

    targetCameraRotationRef.current.theta += deltaX * 0.01;
    targetCameraRotationRef.current.phi -= deltaY * 0.01;

    targetCameraRotationRef.current.phi = Math.min(
      Math.PI - 0.01,
      targetCameraRotationRef.current.phi
    );

    mouseRef.current.x = event.clientX;
    mouseRef.current.y = event.clientY;
  };

  const handleMouseUp = () => {
    mouseRef.current.isDown = false;
  };

  const handleResize = () => {
    if (!rendererRef.current || !cameraRef.current || !mountRef.current) return;

    const container = mountRef.current;
    const width = container.clientWidth;
    const height = container.clientHeight;

    rendererRef.current.setSize(width, height);
    cameraRef.current.aspect = width / height;
    cameraRef.current.updateProjectionMatrix();
  };

  useEffect(() => {
    if (!mountRef.current) return;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 1000);
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      preserveDrawingBuffer: true,
    });

    renderer.setClearColor(0x000000, 0);
    renderer.setSize(400, 400);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    const geometry = createCubeGeometry(faceColors);
    const material = createColorMaterial();
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.y = 0.5;

    const gridHelper = new THREE.GridHelper(21, 21, 0x888888, 0x444444);
    gridHelper.position.y = 0;

    scene.add(mesh);
    scene.add(gridHelper);
    updateCameraPosition();

    mountRef.current.appendChild(renderer.domElement);

    sceneRef.current = scene;
    rendererRef.current = renderer;
    cameraRef.current = camera;
    meshRef.current = mesh;
    materialRef.current = material;

    const canvas = renderer.domElement;
    canvas.addEventListener("mousedown", handleMouseDown);
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);

    animate(performance.now());
    setIsInitialized(true);

    return () => {
      if (frameRef.current) {
        cancelAnimationFrame(frameRef.current);
      }

      canvas.removeEventListener("mousedown", handleMouseDown);
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);

      if (
        mountRef.current &&
        renderer.domElement.parentNode === mountRef.current
      ) {
        mountRef.current.removeChild(renderer.domElement);
      }

      geometry.dispose();
      material.dispose();
      renderer.dispose();
    };
  }, []);

  useEffect(() => {
    if (isInitialized) {
      updateGeometry();
    }
  }, [faceColors, isInitialized]);

  useEffect(() => {
    const resizeObserver = new ResizeObserver(handleResize);
    if (mountRef.current) {
      resizeObserver.observe(mountRef.current);
    }

    return () => {
      resizeObserver.disconnect();
    };
  }, [isInitialized]);

  return (
    <div
      ref={mountRef}
      className="w-full h-full cursor-grab active:cursor-grabbing"
      style={{ userSelect: "none" }}
    />
  );
};
