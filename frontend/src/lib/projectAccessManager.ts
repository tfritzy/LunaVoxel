import {
  globalStore,
  type UserProject,
  type Project,
  type AccessType,
} from "@/state";

export class ProjectAccessManager {
  private userProject?: UserProject;
  private project?: Project;
  private unsubscribe?: () => void;
  public hasWriteAccess: boolean = false;
  public accessLevel: AccessType | null = null;
  public isReadOnly: boolean = true;
  private onAccessChange?: (
    hasWriteAccess: boolean,
    accessLevel: AccessType | null,
    isReadOnly: boolean
  ) => void;

  constructor(
    private projectId: string,
    private userId?: string,
    onAccessChange?: (
      hasWriteAccess: boolean,
      accessLevel: AccessType | null,
      isReadOnly: boolean
    ) => void
  ) {
    this.onAccessChange = onAccessChange;
    this.initializeQueryRunners();
  }

  private initializeQueryRunners() {
    this.unsubscribe = globalStore.subscribe((state) => {
      if (this.userId) {
        const userProjectKey = `${this.projectId}:${this.userId}`;
        this.userProject = state.userProjects.get(userProjectKey);
      }
      
      this.project = state.projects.get(this.projectId);
      this.updateAccess();
    });
    
    const state = globalStore.getState();
    if (this.userId) {
      const userProjectKey = `${this.projectId}:${this.userId}`;
      this.userProject = state.userProjects.get(userProjectKey);
    }
    this.project = state.projects.get(this.projectId);
    this.updateAccess();
  }

  private updateAccess() {
    const oldWriteAccess = this.hasWriteAccess;
    const oldAccessLevel = this.accessLevel;
    const oldIsReadOnly = this.isReadOnly;

    if (this.userProject) {
      if (this.userProject.accessType.tag === "ReadWrite") {
        this.hasWriteAccess = true;
        this.accessLevel = this.userProject.accessType;
        this.isReadOnly = false;
      } else if (this.userProject.accessType.tag === "Read") {
        this.hasWriteAccess = false;
        this.accessLevel = this.userProject.accessType;
        this.isReadOnly = true;
      } else if (
        this.userProject.accessType.tag === "Inherited" &&
        this.project
      ) {
        if (this.project.publicAccess.tag === "ReadWrite") {
          this.hasWriteAccess = true;
          this.accessLevel = this.project.publicAccess;
          this.isReadOnly = false;
        } else if (this.project.publicAccess.tag === "Read") {
          this.hasWriteAccess = false;
          this.accessLevel = this.project.publicAccess;
          this.isReadOnly = true;
        } else {
          this.hasWriteAccess = false;
          this.accessLevel = this.project.publicAccess;
          this.isReadOnly = true;
        }
      } else {
        this.hasWriteAccess = false;
        this.accessLevel = this.userProject.accessType;
        this.isReadOnly = true;
      }
    } else if (this.project) {
      if (this.project.ownerId === this.userId) {
        this.hasWriteAccess = true;
        this.accessLevel = { tag: "ReadWrite" };
        this.isReadOnly = false;
      } else if (this.project.publicAccess.tag === "ReadWrite") {
        this.hasWriteAccess = true;
        this.accessLevel = this.project.publicAccess;
        this.isReadOnly = false;
      } else if (this.project.publicAccess.tag === "Read") {
        this.hasWriteAccess = false;
        this.accessLevel = this.project.publicAccess;
        this.isReadOnly = true;
      } else {
        this.hasWriteAccess = false;
        this.accessLevel = this.project.publicAccess;
        this.isReadOnly = true;
      }
    } else {
      this.hasWriteAccess = true;
      this.accessLevel = { tag: "ReadWrite" };
      this.isReadOnly = false;
    }

    if (
      oldWriteAccess !== this.hasWriteAccess ||
      oldAccessLevel?.tag !== this.accessLevel?.tag ||
      oldIsReadOnly !== this.isReadOnly
    ) {
      this.onAccessChange?.(
        this.hasWriteAccess,
        this.accessLevel,
        this.isReadOnly
      );
    }
  }
}
