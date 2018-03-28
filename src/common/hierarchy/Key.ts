/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { ClassId, InstanceId } from "../EC";

export interface NodeKey {
  type: string;
  pathFromRoot: string[];
}
export interface ECInstanceNodeKey extends NodeKey {
  classId: ClassId;
  instanceId: InstanceId;
}

export type NodeKeyPath = NodeKey[];
