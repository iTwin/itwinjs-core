/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/

// @todo:

export type ECClassId = string;
export interface ECInstanceKey {
  classId: string;
  instanceId: string;
}

export type ECInstanceKeysList = ECInstanceKey[];
