import type { AccessLevel } from "@/state/types";

export class ProjectAccessManager {
  public hasWriteAccess: boolean = true;
  public accessLevel: AccessLevel | null = { tag: "ReadWrite" };
  public isReadOnly: boolean = false;
  private onAccessChange?: (
    hasWriteAccess: boolean,
    accessLevel: AccessLevel | null,
    isReadOnly: boolean
  ) => void;

  constructor(
    _connection: unknown,
    _projectId: string,
    _userId?: string,
    onAccessChange?: (
      hasWriteAccess: boolean,
      accessLevel: AccessLevel | null,
      isReadOnly: boolean
    ) => void
  ) {
    this.onAccessChange = onAccessChange;
    this.onAccessChange?.(
      this.hasWriteAccess,
      this.accessLevel,
      this.isReadOnly
    );
  }
}
