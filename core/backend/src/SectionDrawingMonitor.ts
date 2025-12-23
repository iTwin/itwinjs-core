/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Elements
 */

import { Id64String } from "@itwin/core-bentley";
import { createSectionDrawingMonitor } from "./internal/SectionDrawingMonitorImpl";
import { BriefcaseDb } from "./IModelDb";
import { SectionDrawingProvenance } from "./SectionDrawingProvenance";

/** Contains the information necessary to (re-)generate the annotations within a SectionDrawing.
 * @public
 */
export interface SectionDrawingUpdate {
  /** The element Id of the SectionDrawing whose annotations are to be regenerated. */
  id: Id64String;
  /** The state of the iModel at the time that the need to regenerate the annotations was detected.
   * This provenance is supplied by the [[SectionDrawingMonitor]].
   * It should be persisted onto the SectionDrawing via [[SectionDrawingProvenance.store]] immediately
   * after the annotations are updated.
   */
  provenance: SectionDrawingProvenance;
  /* The information required to regenerate the annotations.
   * NOTE: Replace `string` with whatever type you will use to represent the data required to update the drawing's annotations.
   */
  payload: string;
}

/** Arguments supplied to [[SectionDrawingMonitor.create]].
 * @public
 */
export interface SectionDrawingMonitorCreateArgs {
  /** The iModel to monitor. */
  iModel: BriefcaseDb;
  /** A function that computes the information required to regenerate the annotations.
   * The input maps each drawing Id to its provenance.
   */
  computeUpdates(drawingsToRegenerate: Map<Id64String, SectionDrawingProvenance>): Promise<SectionDrawingUpdate[]>;
  /** Provides a delay between detection of a change requiring a drawing's annotations to be regenerated, before
   * [[computeUpdates]] is invoked to calculate the information required to generate new annotations.
   */
  getUpdateDelay: () => Promise<void>;
}

/** Watches an iModel for changes that may require regenerating SectionDrawing annotations.
 *
 * A SectionDrawing annotates a spatial view. The annotations can be automatically generated (e.g., by an AI/ML algorithm)
 * based on the contents of the spatial view. When the contents of the spatial view changes, the annotations may need to be regenerated.
 * When the monitor detects such changes, it invokes [[SectionDrawingMonitorCreateArgs.computeUpdates]] to calculate the information
 * required to produce new annotations.
 * Because that process may be expensive and/or time-consuming (e.g., calling a long-running cloud service), the updates are not computed
 * until either the user invokes [[getUpdates]], or a user-supplied delay expires. This ensures that if multiple edits happen within a short
 * time period, the updates are computed only once.
 *
 * The monitor caches the most recent set of updates until the user consumes them via [[getUpdates]], or until another change to the iModel
 * invalidates them. When consuming the updates, the user is expected to convert the payload of each [[SectionDrawingUpdate]] into
 * new annotations within each SectionDrawing, then record the SectionDrawing's provenance with [[SectionDrawingProvenance.store]].
 *
 * Upon construction, the monitor schedules a call to calculate new annotations for any SectionDrawings whose provenance is missing or out of date.
 *
 * The user **must** call [[terminate]] when finished using the monitor.
 * @public
 */
export interface SectionDrawingMonitor {
  /** Obtain the information required to regenerate annotations for all SectionDrawings that have become out of date.
   * @throws Error if called a second time while `await`ing the results of a previous call, or if [[terminate]] was previously called.
   */
  getUpdates(): Promise<SectionDrawingUpdate[]>;
  /** Stop monitoring the iModel. It is an error to call [[getUpdates]] after having called [[terminate]]. */
  terminate(): void;
}

/** @public */
export namespace SectionDrawingMonitor {
  /** Create a new SectionDrawingMonitor. */
  export function create(args: SectionDrawingMonitorCreateArgs): SectionDrawingMonitor {
    return createSectionDrawingMonitor(args);
  }
}

