/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
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

    export interface CuttingPlaneProps {
        position: number[];
        direction: number[];
    }
    export interface TransformProps {
        position: number[];
        orientation: number[];
        pivot: number[];
        transform: number[][];
    }
    export interface TransformEntryProps extends TimelineEntryProps {
        value: TransformProps;
    }
    export interface CuttingPlaneEntryProps extends TimelineEntryProps {
        value: CuttingPlaneProps;
    }
    export interface ElementTimelineProps {
        batchId: number;
        elementIds: Id64String[];
        visibilityTimeline?: VisibilityEntryProps[];
        colorTimeline?: ColorEntryProps[];
        transformTimeline?: TransformEntryProps[];
        cuttingPlaneTimeline?: CuttingPlaneEntryProps[];
    }
    export interface ModelTimelineProps {
        modelId: Id64String;
        elementTimelines: ElementTimelineProps[];
    }
}
