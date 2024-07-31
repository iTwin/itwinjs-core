import { GuidString } from "@itwin/core-bentley";
import { ChangesetIdWithIndex, IModelConnectionProps } from "@itwin/core-common";

export interface IModelOpenProps {
  readonly iTwinId: GuidString;
  readonly iModelId: GuidString;
  readonly changeset: ChangesetIdWithIndex;
}

export interface IModelAccessProps {
  readonly iModelId: GuidString;
  readonly changeset: ChangesetIdWithIndex;
}

export interface IModelRead {
  getConnectionProps(props: IModelOpenProps): Promise<IModelConnectionProps>;
  getToolTipMessage(iModelAccessProps: IModelAccessProps, elementId: string): Promise<string[]>;
}
