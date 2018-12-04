/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Rendering */

import { Id64String } from "@bentley/bentleyjs-core";

export namespace RenderSchedule {

  export interface TimelineEntryProps {
    time: number;
    interpolation: number;
  }

  export interface VisibilityEntryProps extends TimelineEntryProps {
    value: number;
  }

  export interface ColorEntryProps extends TimelineEntryProps {
    value: { red: number, green: number, blue: number };
  }

  export interface TransformProps {
    rows: number[][];
  }
  export interface CuttingPlaneProps {
    position: number[];
    direction: number[];
  }
  export interface TransformEntryProps extends TimelineEntryProps {
    value: TransformProps;
  }
  export interface CuttingPlaneEntryProps extends TimelineEntryProps {
    value: CuttingPlaneProps;
  }
  export interface ElementTimelineProps {
    elementID: Id64String;
    visibilityTimeline?: VisibilityEntryProps[];
    colorTimeline?: ColorEntryProps[];
    transformTimeline?: TransformEntryProps[];
  }
}
