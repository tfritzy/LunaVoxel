import * as THREE from "three";
import { createVoxelMaterial } from "@/modeling/lib/shader";
import { faces } from "@/modeling/lib/voxel-constants";
import { getTextureCoordinates } from "@/modeling/lib/texture-coords";

interface BlockTextureRendererOptions {
  atlas: {
    gridSize: number;
    cellPixelWidth: number;
  };
  textureAtlas: THREE.Texture;
  blocks: {
    blockFaceAtlasIndexes: number[][];
  };
  textureSize?: number;
}

class BlockTextureRenderer {
  private scene: THREE.Scene;
  private camera: THREE.OrthographicCamera;
  private renderer: THREE.WebGLRenderer;
  private renderTarget: THREE.WebGLRenderTarget;
  private mesh: THREE.Mesh;
  private material: THREE.ShaderMaterial;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private textureCache = new Map<string, string>();
  private currentAtlas: THREE.Texture | null = null;
  private currentBlocks: { blockFaceAtlasIndexes: number[][] } | null = null;

  constructor(options: BlockTextureRendererOptions) {
    const { atlas, textureAtlas, blocks, textureSize = 128 } = options;

    this.canvas = document.createElement("canvas");
    this.canvas.width = textureSize;
    this.canvas.height = textureSize;
    this.ctx = this.canvas.getContext("2d")!;

    this.scene = new THREE.Scene();

    const frustumSize = 1.6;
    const aspect = 1;
    this.camera = new THREE.OrthographicCamera(
      (-frustumSize * aspect) / 2,
      (frustumSize * aspect) / 2,
      frustumSize / 2,
      -frustumSize / 2,
      0.1,
      1000
    );
    this.camera.position.set(1, 1, 1);
    this.camera.lookAt(0, 0, 0);

    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      preserveDrawingBuffer: true,
    });
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.setSize(textureSize, textureSize);

    this.renderTarget = new THREE.WebGLRenderTarget(textureSize, textureSize, {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      format: THREE.RGBAFormat,
      type: THREE.UnsignedByteType,
    });

    const geometry = this.createCubeGeometry(0, atlas, blocks);
    this.material = createVoxelMaterial(textureAtlas);
    this.mesh = new THREE.Mesh(geometry, this.material);

    this.scene.add(this.mesh);

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    this.scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.4);
    directionalLight.position.set(1, 1, 1);
    this.scene.add(directionalLight);

    this.currentAtlas = textureAtlas;
    this.currentBlocks = blocks;
  }

  private createCubeGeometry(
    blockIndex: number,
    atlas: { gridSize: number; cellPixelWidth: number },
    blocks: { blockFaceAtlasIndexes: number[][] }
  ): THREE.BufferGeometry {
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

      const textureIndex = blocks.blockFaceAtlasIndexes[blockIndex][faceIndex];

      const textureCoords = getTextureCoordinates(
        textureIndex,
        atlas.gridSize,
        atlas.cellPixelWidth
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
  }

  public updateContext(
    atlas: { gridSize: number; cellPixelWidth: number },
    textureAtlas: THREE.Texture,
    blocks: { blockFaceAtlasIndexes: number[][] }
  ): void {
    if (this.currentAtlas !== textureAtlas) {
      this.currentAtlas = textureAtlas;
      if (this.material.uniforms?.map) {
        this.material.uniforms.map.value = textureAtlas;
      }
      this.textureCache.clear();
    }

    if (this.currentBlocks !== blocks) {
      this.currentBlocks = blocks;
      this.textureCache.clear();
    }
  }

  public renderBlockToTexture(
    blockIndex: number,
    atlas: { gridSize: number; cellPixelWidth: number },
    blocks: { blockFaceAtlasIndexes: number[][] }
  ): string {
    const cacheKey = `${blockIndex}-${atlas.gridSize}-${atlas.cellPixelWidth}`;

    if (this.textureCache.has(cacheKey)) {
      return this.textureCache.get(cacheKey)!;
    }

    const newGeometry = this.createCubeGeometry(blockIndex, atlas, blocks);
    this.mesh.geometry.dispose();
    this.mesh.geometry = newGeometry;

    this.renderer.setRenderTarget(this.renderTarget);
    this.renderer.render(this.scene, this.camera);
    this.renderer.setRenderTarget(null);

    const pixels = new Uint8Array(this.canvas.width * this.canvas.height * 4);
    this.renderer.readRenderTargetPixels(
      this.renderTarget,
      0,
      0,
      this.canvas.width,
      this.canvas.height,
      pixels
    );

    const imageData = new ImageData(
      new Uint8ClampedArray(pixels),
      this.canvas.width,
      this.canvas.height
    );

    this.ctx.putImageData(imageData, 0, 0);

    this.ctx.save();
    this.ctx.scale(1, -1);
    this.ctx.drawImage(this.canvas, 0, -this.canvas.height);
    this.ctx.restore();

    const dataUrl = this.canvas.toDataURL("image/png");
    this.textureCache.set(cacheKey, dataUrl);

    return dataUrl;
  }

  public clearCache(): void {
    this.textureCache.clear();
  }

  public dispose(): void {
    this.mesh.geometry?.dispose();
    this.material?.dispose();
    this.renderTarget?.dispose();
    this.renderer?.dispose();
    this.renderer?.forceContextLoss();
    this.textureCache.clear();
  }
}

let globalRenderer: BlockTextureRenderer | null = null;
let refCount = 0;

export const getBlockTextureRenderer = (
  options: BlockTextureRendererOptions
): BlockTextureRenderer => {
  if (!globalRenderer) {
    globalRenderer = new BlockTextureRenderer(options);
  } else {
    globalRenderer.updateContext(
      options.atlas,
      options.textureAtlas,
      options.blocks
    );
  }

  refCount++;
  return globalRenderer;
};

export const releaseBlockTextureRenderer = (): void => {
  refCount--;

  if (refCount <= 0 && globalRenderer) {
    globalRenderer.dispose();
    globalRenderer = null;
    refCount = 0;
  }
};
