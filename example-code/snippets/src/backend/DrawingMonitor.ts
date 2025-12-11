/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { BriefcaseDb } from "@itwin/core-backend";
import { Id64Set, Id64String } from "@itwin/core-bentley";
import { createDrawingMonitor } from "./DrawingMonitorImpl";

export type DrawingUpdates = Map<Id64String, string>;

export interface DrawingMonitorCreateArgs {
  iModel: BriefcaseDb;
  getUpdateDelay: () => Promise<void>;
  computeUpdates(drawingsToRegenerate: Id64Set): Promise<DrawingUpdates>;
}

export interface DrawingMonitor {
  getUpdates(): Promise<DrawingUpdates>;
  terminate(): void;
}

export namespace DrawingMonitor {
  export function create(args: DrawingMonitorCreateArgs): DrawingMonitor {
    return createDrawingMonitor(args);
  }
}

