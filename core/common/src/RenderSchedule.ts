/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module DisplayStyles
 */

import { CompressedId64Set, Id64String } from "@bentley/bentleyjs-core";

/**
 * A schedule (or script)  for controlling the visibility, position and symbology of a series of elements over a period of time.
 * A schedule script is exposed through [[DisplayStyleSettingsProps]].
 * @beta
 */
export namespace RenderSchedule {

  /**
   * Properties included in each property entry.
   */
  export interface TimelineEntryProps {
    /** The time in Unix Epoch (POSIX) seconds */
    time: number;
    /** Interpolation value from synchro.  2 is linear, else currently treated as step.  */
    interpolation: number;
  }

  /**
   * Controls the visibility (inverse of transparency).  100 is completely visible, 0 is invisible.
   */
  export interface VisibilityEntryProps extends TimelineEntryProps {
    value: number;
  }

  /**
   * Controls geometry color. red, green and blue values between 0 and 255.
   * (0,0,0) is black (1,1,1) is white.
   */
  export interface ColorEntryProps extends TimelineEntryProps {
    value: { red: number, green: number, blue: number };
  }

  /**
   * Specifies properties for cutting plane.
   */
  export interface CuttingPlaneProps {
    /** (x,y,z) of the plane position */
    position: number[];
    /** (x, y, z) of the plane direction (towards the clip) */
    direction: number[];
    /**  if true geometry is completely visible (unclipped) */
    visible?: boolean;
    /** if true the geometry is completely hidden */
    hidden?: boolean;
  }
  /** Specifies properties for a transform specified as s separate pivot, rotate and rotation or single transform. */
  export interface TransformProps {
    /** (x, y, z) of position  - applied after rotation */
    position: number[];
    /** quaternion representing rotation  */
    orientation: number[];
    /** x, y, z) of pivot - applied before rotation */
    pivot: number[];
    /**
     * 3 X 4 transform.  Used directly rather than position, pivot and orientation if defined.
     */
    transform: number[][];
  }
  /**
   * Timeline entry controlling transform.
   */
  export interface TransformEntryProps extends TimelineEntryProps {
    value: TransformProps;
  }

  /**
   * Timeline entry controlling cutting plane.
   */
  export interface CuttingPlaneEntryProps extends TimelineEntryProps {
    value: CuttingPlaneProps;
  }

  /** Timeline properties (extended by element, model and reality model timelines. */
  export interface TimelineProps {
    visibilityTimeline?: VisibilityEntryProps[];
    colorTimeline?: ColorEntryProps[];
    transformTimeline?: TransformEntryProps[];
    cuttingPlaneTimeline?: CuttingPlaneEntryProps[];
  }

  /** Animation timeline entries that apply to one or more elements. */
  export interface ElementTimelineProps extends TimelineProps {
    batchId: number;
    /** The Ids of the elements to which this timeline applies.
     * @note For a [[DisplayStyleSettingsProps]] associated with a [DisplayStyleState]($frontend) obtained via [IModelConnection.Views.load]($frontend),
     * this property will be an empty `CompressedId64Set`. They are omitted to conserve bandwidth and memory - they are not needed for display on the frontend.
     */
    elementIds: Id64String[] | CompressedId64Set;
  }

  /** Animation timeline for a single model.  */
  export interface ModelTimelineProps extends TimelineProps {
    modelId: Id64String;
    realityModelUrl?: string;     // defined only for "context" reality models (attached through display style)
    elementTimelines: ElementTimelineProps[];
  }
}
