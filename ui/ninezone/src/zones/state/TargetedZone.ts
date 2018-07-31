/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module Zone */

import { DropTarget } from "./Management";

export default interface TargetedZoneProps {
  readonly widgetId: number;
  readonly target: DropTarget;
}
