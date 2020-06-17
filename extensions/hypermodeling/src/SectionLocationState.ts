/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import {
  Id64String,
} from "@bentley/bentleyjs-core";
import {
  ClipVector,
  Transform,
  XYZProps,
} from "@bentley/geometry-core";
import {
  Placement3d,
  SectionType,
} from "@bentley/imodeljs-common";
import {
  DrawingViewState,
  IModelConnection,
  SpatialViewState,
} from "@bentley/imodeljs-frontend";

/** JSON representation of a SectionLocationState. This is an amalgamation of data from several ECClasses.
 * @internal
 */
export interface SectionLocationStateProps {
  sectionType: SectionType;
  drawingToSpatialTransform: string; // stringified TransformProps
  spatialViewId: Id64String;
  clipJSON?: string; // stringified ClipVector json
  viewAttachmentId?: Id64String;
  sheetToSpatialTransform?: string; // stringified TransformProps
  sheetClip?: string; // stringified ClipVector json

  sectionLocationId: Id64String;
  sectionViewId: Id64String;
  categoryId: Id64String;
  origin?: XYZProps;
  yaw?: number;
  pitch?: number;
  roll?: number;
  bboxLow?: XYZProps;
  bboxHigh?: XYZProps;
  userLabel: string;
}

/** Hypermodeling representation of a SectionDrawingLocation and related elements.
 * @internal
 */
export class SectionLocationState {
  public readonly iModel: IModelConnection;
  public readonly id: Id64String;
  public readonly userLabel: string;
  public readonly category: Id64String;
  public readonly placement: Placement3d;
  public readonly sectionType: SectionType;
  public readonly drawingViewId: Id64String;
  public readonly spatialViewId: Id64String;
  public readonly clip: ClipVector;
  public readonly drawingToSpatialTransform: Transform;
  public readonly viewAttachment?: {
    id: Id64String;
    transformToSpatial: Transform;
    clip?: ClipVector;
  };

  public constructor(props: SectionLocationStateProps, iModel: IModelConnection) {
    this.iModel = iModel;
    this.id = props.sectionLocationId;
    this.userLabel = props.userLabel;
    this.category = props.categoryId;
    this.sectionType = props.sectionType;
    this.drawingViewId = props.sectionViewId;
    this.spatialViewId = props.spatialViewId;
    this.drawingToSpatialTransform = Transform.fromJSON(JSON.parse(props.drawingToSpatialTransform));

    const extractClip = (str: string | undefined) => {
      let clip;
      if (str) {
        try {
          clip = ClipVector.fromJSON(JSON.parse(str));
        } catch {
          //
        }
      }

      return clip;
    };

    this.clip = extractClip(props.clipJSON) ?? ClipVector.createEmpty();

    const placementProps = {
      origin: props.origin ?? { },
      angles: {
        yaw: props.yaw,
        pitch: props.pitch,
        roll: props.roll,
      },
      placement: (props.bboxLow && props.bboxHigh) ? { low: props.bboxLow, high: props.bboxHigh } : undefined,
    };
    this.placement = Placement3d.fromJSON(placementProps);

    if (props.viewAttachmentId && props.sheetToSpatialTransform) {
      this.viewAttachment = {
        id: props.viewAttachmentId,
        transformToSpatial: Transform.fromJSON(JSON.parse(props.sheetToSpatialTransform)),
        clip: extractClip(props.sheetClip),
      };
    }
  }

  public async tryLoadDrawingView(): Promise<DrawingViewState | undefined> {
    try {
      const view = await this.iModel.views.load(this.drawingViewId);
      if (view instanceof DrawingViewState)
        return view;
    } catch { }

    return undefined;
  }

  public async tryLoadSpatialView(): Promise<SpatialViewState | undefined> {
    try {
      const view = await this.iModel.views.load(this.spatialViewId);
      if (view instanceof SpatialViewState)
        return view;
    } catch { }

    return undefined;
  }
}
