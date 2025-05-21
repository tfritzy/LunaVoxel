import * as THREE from "three";
import {
  DbConnection,
  EventContext,
  Palette,
  PlayerInWorld,
} from "../../module_bindings";

export class Builder {
  private domElement: HTMLElement;
  private dbConn: DbConnection;
  private world: string;
  private currentPalette: Palette | null = null;
  private currentPlayerState: PlayerInWorld | null = null;
  private playerId: string;

  private boundMouseDown: (event: MouseEvent) => void;
  private boundContextMenu: (event: MouseEvent) => void;

  private paletteUpdateListener:
    | ((ctx: EventContext, oldPalette: Palette, newPalette: Palette) => void)
    | null = null;
  private paletteInsertListener:
    | ((ctx: EventContext, newPalette: Palette) => void)
    | null = null;
  private playerUpdateListener:
    | ((
        ctx: EventContext,
        oldPlayer: PlayerInWorld,
        newPlayer: PlayerInWorld
      ) => void)
    | null = null;
  private playerInsertListener:
    | ((ctx: EventContext, newPlayer: PlayerInWorld) => void)
    | null = null;

  constructor(
    scene: THREE.Scene,
    dbConn: DbConnection,
    domElement: HTMLElement,
    world: string
  ) {
    this.domElement = domElement;
    this.dbConn = dbConn;
    this.world = world;

    if (!this.dbConn.identity) {
      console.error("No authenticated identity found");
      this.playerId = "";
    } else {
      this.playerId = `${this.dbConn.identity.toHexString()}_${this.world}`;
    }

    this.boundMouseDown = this.onMouseDown.bind(this);
    this.boundContextMenu = this.onContextMenu.bind(this);

    this.domElement.addEventListener("mousedown", this.boundMouseDown);
    this.domElement.addEventListener("contextmenu", this.boundContextMenu);

    this.setupCaching();
  }

  private setupCaching(): void {
    if (!this.dbConn.isActive || !this.playerId) return;

    this.currentPalette = this.dbConn.db.palette.world.find(this.world)!;
    this.currentPlayerState = this.dbConn.db.playerInWorld.id.find(
      this.playerId
    )!;

    this.paletteUpdateListener = (ctx, oldPalette, newPalette) => {
      if (newPalette.world === this.world) {
        this.currentPalette = newPalette;
      }
    };
    this.dbConn.db.palette.onUpdate(this.paletteUpdateListener);

    this.playerUpdateListener = (ctx, oldPlayer, newPlayer) => {
      if (newPlayer.id === this.playerId) {
        this.currentPlayerState = newPlayer;
      }
    };
    this.dbConn.db.playerInWorld.onUpdate(this.playerUpdateListener);

    this.paletteInsertListener = (ctx, newPalette) => {
      if (newPalette.world === this.world) {
        this.currentPalette = newPalette;
      }
    };
    this.dbConn.db.palette.onInsert(this.paletteInsertListener);

    this.playerInsertListener = (ctx, newPlayer) => {
      if (newPlayer.id === this.playerId) {
        this.currentPlayerState = newPlayer;
      }
    };
    this.dbConn.db.playerInWorld.onInsert(this.playerInsertListener);
  }

  private getSelectedColor(): string {
    if (
      this.currentPalette &&
      this.currentPlayerState &&
      this.currentPalette.colors.length > 0
    ) {
      const selectedIndex = this.currentPlayerState.selectedColorIndex || 0;
      return this.currentPalette.colors[
        selectedIndex % this.currentPalette.colors.length
      ];
    }
    return "#FFFFFF";
  }

  private onMouseDown(event: MouseEvent): void {
    if (event.button === 2) {
      this.rotateBlock();
    }
  }

  private onContextMenu(event: MouseEvent): void {
    event.preventDefault();
  }

  onMouseHover(position: THREE.Vector3) {
    if (!this.dbConn.isActive || !this.playerId) return;

    const selectedColor = this.getSelectedColor();

    this.dbConn.reducers.placeBlock(
      this.world,
      { tag: "Block" },
      position.x,
      position.z,
      position.y,
      selectedColor,
      true
    );
  }

  rotateBlock() {}

  onMouseClick(position: THREE.Vector3) {
    if (!this.dbConn.isActive || !this.playerId) return;

    const selectedColor = this.getSelectedColor();

    this.dbConn.reducers.placeBlock(
      this.world,
      { tag: "Block" },
      position.x,
      position.z,
      position.y,
      selectedColor,
      false
    );
  }

  dispose() {
    this.domElement.removeEventListener("mousedown", this.boundMouseDown);
    this.domElement.removeEventListener("contextmenu", this.boundContextMenu);

    if (this.dbConn && this.dbConn.isActive) {
      if (this.paletteUpdateListener) {
        this.dbConn.db.palette.removeOnUpdate(this.paletteUpdateListener);
      }
      if (this.paletteInsertListener) {
        this.dbConn.db.palette.removeOnInsert(this.paletteInsertListener);
      }
      if (this.playerUpdateListener) {
        this.dbConn.db.playerInWorld.removeOnUpdate(this.playerUpdateListener);
      }
      if (this.playerInsertListener) {
        this.dbConn.db.playerInWorld.removeOnInsert(this.playerInsertListener);
      }
    }

    this.currentPalette = null;
    this.currentPlayerState = null;
    this.paletteUpdateListener = null;
    this.paletteInsertListener = null;
    this.playerUpdateListener = null;
    this.playerInsertListener = null;
  }
}
