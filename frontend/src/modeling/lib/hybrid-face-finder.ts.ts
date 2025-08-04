import { Atlas, BlockModificationMode, ProjectBlocks } from "@/module_bindings";
import { VoxelFaces } from "./layer-mesh";
import { Block } from "./blocks";
import { WebGPUFaceFinder, createWebGPUFaceFinder } from "./webgpu-face-finder";

export class HybridFaceFinder {
    private webgpuFinder?: WebGPUFaceFinder;
    private preferredMethod: 'webgpu' | 'auto' = 'auto';

    constructor(preferredMethod: 'webgpu' | 'auto' = 'auto') {
        this.preferredMethod = preferredMethod;
    }

    async initialize(): Promise<void> {
        try {
            this.webgpuFinder = await createWebGPUFaceFinder();

        } catch (error) {
            console.warn('[HybridFaceFinder] WebGPU initialization failed:', error);

            if (this.preferredMethod === 'webgpu') {
                throw new Error(`WebGPU initialization failed: ${error}`);
            }
        }
    }

    private shouldUseWebGPU(totalBlocks: number): boolean {
        return totalBlocks > 50000;
    }

    async findExteriorFaces(
        realBlocks: (Block | undefined)[][][],
        previewBlocks: (Block | undefined)[][][],
        previewMode: BlockModificationMode,
        atlas: Atlas,
        blocks: ProjectBlocks,
        dimensions: { xDim: number; yDim: number; zDim: number }
    ): Promise<{
        meshFaces: Map<string, VoxelFaces>;
        previewFaces: Map<string, VoxelFaces>;
    }> {
        const { xDim, yDim, zDim } = dimensions;
        const totalBlocks = xDim * yDim * zDim;

        // Try WebGPU for large worlds
        if (this.webgpuFinder && (this.preferredMethod === 'webgpu' || this.shouldUseWebGPU(totalBlocks))) {
            try {
                console.log('[HybridFaceFinder] Using WebGPU for face finding');
                return await this.webgpuFinder.findExteriorFaces(
                    realBlocks, previewBlocks, previewMode, atlas, blocks, dimensions
                );
            } catch (error) {
                console.warn('[HybridFaceFinder] WebGPU failed, falling back:', error);
            }
        }

        // Fall back to CPU for small worlds - import the original optimized version
        const { findExteriorFaces } = await import('./find-exterior-faces');
        return findExteriorFaces(realBlocks, previewBlocks, previewMode, atlas, blocks, dimensions);
    }

    getAvailableMethods(): string[] {
        const methods: string[] = [];
        if (this.webgpuFinder) methods.push('WebGPU');
        methods.push('CPU Fallback');
        return methods;
    }

    getCurrentMethod(): string {
        if (this.preferredMethod === 'webgpu' && this.webgpuFinder) return 'WebGPU';
        return 'Auto (WebGPU → CPU)';
    }

    dispose(): void {
        this.webgpuFinder = undefined;
    }
}

export const createHybridFaceFinder = async (
    preferredMethod: 'webgpu' | 'auto' = 'auto'
): Promise<HybridFaceFinder> => {
    const finder = new HybridFaceFinder(preferredMethod);
    await finder.initialize();
    return finder;
};