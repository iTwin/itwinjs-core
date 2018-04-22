/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/

export const enum PushOrPop {
  Push,
  Pop,
}

export const enum OpCode {
  DrawBatchPrimitive,
  DrawOvrPrimitive,
  PushBranch,
  PopBranch,
}
