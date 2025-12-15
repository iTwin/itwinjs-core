/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { Id64Set, Id64String } from "@itwin/core-bentley";
import { createSectionDrawingMonitor } from "./internal/SectionDrawingMonitorImpl";
import { BriefcaseDb } from "./IModelDb";
import { SectionDrawingProvenance } from "./SectionDrawingProvenance";

export interface SectionDrawingUpdate {
  id: Id64String;
  provenance: SectionDrawingProvenance;
  // Replace `string` with whatever type you will use to represent the data required to update the drawing's annotations.
  payload: string;
}

export interface SectionDrawingMonitorCreateArgs {
  iModel: BriefcaseDb;
  getUpdateDelay: () => Promise<void>;
  computeUpdates(drawingsToRegenerate: Map<Id64String, SectionDrawingProvenance>): Promise<SectionDrawingUpdate[]>;
}

export interface SectionDrawingMonitor {
  getUpdates(): Promise<SectionDrawingUpdate[]>;
  terminate(): void;
}

export namespace SectionDrawingMonitor {
  export function create(args: SectionDrawingMonitorCreateArgs): SectionDrawingMonitor {
    return createSectionDrawingMonitor(args);
  }
}

