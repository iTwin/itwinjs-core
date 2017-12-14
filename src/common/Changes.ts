/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { ECInstanceKey } from "./EC";
import { RelationshipPathInfo } from "./Content";

/** Info about changed instances. */
export interface ChangedECInstanceInfo {
  primaryInstanceKey: ECInstanceKey;
  changedInstanceKey: ECInstanceKey;
  relationshipPath: RelationshipPathInfo;
}

/** ECInstance change status. */
export enum ECInstanceChangeStatus {
  Success = 0,
  Ignore = 1,
  Error = 2,
}

/** Result of a single ECInstance change. */
export interface ECInstanceChangeResult {
  status: ECInstanceChangeStatus;
  value: any;
  errorMessage: string;
}
