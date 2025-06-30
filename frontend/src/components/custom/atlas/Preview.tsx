import { useEffect, useRef } from "react";
import "@/components/custom/color-picker.css";
import * as THREE from "three";

const vertexShader = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const fragmentShader = `
  uniform vec3 color;
  uniform sampler2D map;
  uniform bool hasTexture;
  varying vec2 vUv;
  
  void main() {
    if (hasTexture) {
      vec4 texColor = texture2D(map, vUv);
      gl_FragColor = vec4(texColor.rgb * color, texColor.a);
    } else {
      gl_FragColor = vec4(color, 1.0);
    }
  }
`;

export const CubePreview = ({
  color,
  texture,
}: {
  color: number;
  texture: ImageData | null;
}) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<{
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    renderer: THREE.WebGLRenderer;
    cube: THREE.Mesh;
    material: THREE.ShaderMaterial;
  } | null>(null);
  const lastTimeRef = useRef<number>(0);

  useEffect(() => {
    if (!mountRef.current) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1a1a1a);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    const containerWidth = mountRef.current.clientWidth;
    const width = containerWidth;
    const height = width * 0.7;
    const aspectRatio = width / height;

    const camera = new THREE.PerspectiveCamera(75, aspectRatio, 0.1, 1000);
    camera.position.set(1, 0.75, 1);
    camera.lookAt(0, -0.1, 0);

    renderer.setSize(width, height);

    const geometry = new THREE.BoxGeometry(1, 1, 1);
    const material = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: {
        color: { value: new THREE.Color(color) },
        map: { value: null },
        hasTexture: { value: false },
      },
    });

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
      sceneRef.current.cube.rotation.y += rotationSpeed * deltaTime;

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
      }
    };
  }, []);

  useEffect(() => {
    if (!sceneRef.current) return;

    if (texture) {
      const canvas = document.createElement("canvas");
      canvas.width = texture.width;
      canvas.height = texture.height;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.putImageData(texture, 0, 0);
        const threeTexture = new THREE.CanvasTexture(canvas);
        threeTexture.minFilter = THREE.NearestFilter;
        threeTexture.magFilter = THREE.NearestFilter;
        threeTexture.flipY = false;

        sceneRef.current.material.uniforms.map.value = threeTexture;
        sceneRef.current.material.uniforms.hasTexture.value = true;
      }
    } else {
      sceneRef.current.material.uniforms.map.value = null;
      sceneRef.current.material.uniforms.hasTexture.value = false;
    }
    sceneRef.current.material.uniforms.color.value.setHex(color);
  }, [texture, color]);

  return (
    <div
      ref={mountRef}
      className="rounded-xs overflow-hidden border border-border"
    />
  );
};
