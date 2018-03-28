/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { Id64 } from "@bentley/bentleyjs-core";
import { NodeKey } from "./Key";

export default interface Node {
  nodeId: Id64;
  parentNodeId?: Id64;
  key: NodeKey;
  label: string;
  description?: string;
  imageId?: string;
  foreColor?: string;
  backColor?: string;
  fontStyle?: string;
  hasChildren: boolean;
  isSelectable: boolean;
  isEditable: boolean;
  isChecked: boolean;
  isExpanded: boolean;
  isCheckboxVisible: boolean;
  isCheckboxEnabled: boolean;
}
