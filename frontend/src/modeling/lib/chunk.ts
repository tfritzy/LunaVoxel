import * as THREE from "three";
import { DbConnection, Vector3, Chunk as ChunkData } from "@/module_bindings";
import { findExteriorFaces } from "./find-exterior-faces";
import { createVoxelMaterial } from "./shader";
import { MeshArrays } from "./mesh-arrays";
import { layers } from "./layers";
import { AtlasData } from "@/lib/useAtlas";
import { ChunkMesh } from "./chunk-mesh";
import { QueryRunner } from "@/lib/queryRunner";
import { ProjectManager } from "./project-manager";
import { ModificationMode } from "./tools";
import { decompressVoxelData } from "./voxel-data-utils";


export class Chunk {
    private mesh: ChunkMesh | undefined;
    private query: QueryRunner<ChunkData>;
    private scene: THREE.Scene;
    private modificationMode: ModificationMode;
    private atlasData: AtlasData;

    constructor(
        dbConn: DbConnection,
        scene: THREE.Scene,
        worldDimensions: Vector3,
        id: string,
        modificationMode: ModificationMode
    ) {
        this.scene = scene;
        this.query = new QueryRunner<ChunkData>(dbConn.db.chunk, this.dataUpdate, (chunk) => chunk.id === id);
        this.modificationMode = modificationMode;
    }

    dataUpdate(data: ChunkData[]) {
        const chunk = data[0];
        if (!this.mesh) {
            this.mesh = new ChunkMesh(this.scene, {x: chunk.startX, y: 0, z: chunk.startZ}, chunk.dimensions)
        }

        this.mesh.voxelData = decompressVoxelData(chunk.voxels);

        this.mesh.update(this.modificationMode, this.atlasData);
    }

    updateModificationMode(newMode: ModificationMode)
    {
        this.modificationMode = newMode;
    }

    updateAtlasData(atlasData: AtlasData)
    {
        this.atlasData = atlasData;
    }

    public getMesh(): THREE.Mesh | null {
    }

    dispose = () => {
    };
}
