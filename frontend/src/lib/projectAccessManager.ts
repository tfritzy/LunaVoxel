import {
  DbConnection,
  UserProject,
  Project,
  AccessType,
} from "@/module_bindings";
import { QueryRunner } from "./queryRunner";

export class ProjectAccessManager {
  private userProject?: UserProject;
  private project?: Project;
  private userQueryRunner?: QueryRunner<UserProject>;
  private projectQueryRunner?: QueryRunner<Project>;
  public hasWriteAccess: boolean = false;
  public accessLevel: AccessType | null = null;
  public isReadOnly: boolean = true;
  private onAccessChange?: (
    hasWriteAccess: boolean,
    accessLevel: AccessType | null,
    isReadOnly: boolean
  ) => void;

  constructor(
    private connection: DbConnection,
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
    if (this.userId) {
      this.userQueryRunner = new QueryRunner<UserProject>(
        this.connection.db.userProjects,
        (data) => {
          this.userProject = data.find(
            (up) =>
              up.user.toHexString() === this.userId &&
              up.projectId === this.projectId
          );
          this.updateAccess();
        },
        (p) =>
          p.user.toHexString() === this.userId && p.projectId === this.projectId
      );
    }

    this.projectQueryRunner = new QueryRunner<Project>(
      this.connection.db.projects,
      (data) => {
        this.project = data.find((p) => p.id === this.projectId);
        this.updateAccess();
      },
      (p) => p.id === this.projectId
    );
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
      this.accessLevel = null;
      this.isReadOnly = true;
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
