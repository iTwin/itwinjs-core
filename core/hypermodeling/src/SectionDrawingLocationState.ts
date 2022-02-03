/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module HyperModeling
 */

import type { Id64String } from "@itwin/core-bentley";
import type { SectionType } from "@itwin/core-common";
import { Placement3d, QueryRowFormat } from "@itwin/core-common";
import type { IModelConnection} from "@itwin/core-frontend";
import { DrawingViewState, SheetViewState, SpatialViewState } from "@itwin/core-frontend";
import type { XYZProps } from "@itwin/core-geometry";
import { ClipVector, Transform } from "@itwin/core-geometry";

const selectSectionDrawingLocationStatesECSql = `
  SELECT
    bis.SectionDrawingLocation.ECInstanceId as sectionLocationId,
    bis.SectionDrawingLocation.Model.Id as sectionLocationModelId,
    bis.SectionDrawingLocation.SectionView.Id as sectionViewId,
    bis.SectionDrawingLocation.Category.Id as categoryId,
    bis.SectionDrawingLocation.Origin as origin,
    bis.SectionDrawingLocation.Yaw as yaw,
    bis.SectionDrawingLocation.Pitch as pitch,
    bis.SectionDrawingLocation.Roll as roll,
    bis.SectionDrawingLocation.BBoxLow as bboxLow,
    bis.SectionDrawingLocation.BBoxHigh as bboxHigh,
    bis.SectionDrawingLocation.UserLabel as userLabel,

    bis.SectionDrawing.SectionType as sectionType,
    json_extract(bis.SectionDrawing.jsonProperties, '$.drawingToSpatialTransform') as drawingToSpatialTransform,
    bis.SectionDrawing.SpatialView.Id as spatialViewId,
    json_extract(bis.SectionDrawing.jsonProperties, '$.sheetToSpatialTransform') as sheetToSpatialTransform,
    json_extract(bis.SectionDrawing.jsonProperties, '$.drawingBoundaryClip') as sheetClip,

    json_extract(bis.SpatialViewDefinition.jsonProperties, '$.viewDetails.clip') as clipJSON,
    bis.ViewAttachment.ECInstanceId as viewAttachmentId,
    bis.SheetViewDefinition.ECInstanceId as sheetViewId
  FROM bis.SectionDrawingLocation
  INNER JOIN bis.ViewDefinition2d on bis.SectionDrawingLocation.SectionView.Id = bis.ViewDefinition2d.ECInstanceId
  INNER JOIN bis.SectionDrawing on bis.ViewDefinition2d.BaseModel.Id = bis.SectionDrawing.ECInstanceId
  LEFT JOIN  bis.ViewAttachment on bis.ViewDefinition2d.ECInstanceId = bis.ViewAttachment.View.Id
  LEFT JOIN bis.SheetViewDefinition on bis.SheetViewDefinition.BaseModel.Id = bis.ViewAttachment.Model.Id
  INNER JOIN bis.SpatialViewDefinition on bis.SpatialViewDefinition.ECInstanceId = bis.SectionDrawing.SpatialView.Id
`;

/** Raw data representing a [[SectionDrawingLocationState]]. This is an amalgamation of data from several related ECClasses.
 * @internal
 */
export interface SectionDrawingLocationStateData {
  sectionType: SectionType;
  drawingToSpatialTransform: string; // stringified TransformProps
  spatialViewId: Id64String;
  clipJSON?: string; // stringified ClipVector json
  viewAttachmentId?: Id64String;
  sheetToSpatialTransform?: string; // stringified TransformProps
  sheetClip?: string; // stringified ClipVector json
  sheetViewId?: Id64String;

  sectionLocationId: Id64String;
  sectionLocationModelId: Id64String;
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

/** Represents a [ViewAttachment]($backend) that attaches a [[SectionDrawingLocationState]] to a [Sheet]($backend) model.
 * @public
 */
export interface SectionViewAttachment {
  /** The view attachment's element Id. */
  readonly id: Id64String;
  /** The Id of a [SheetViewDefinition]($backend) that displays this view attachment.
   * This is used when navigating from the spatial view to the view attachment.
   */
  readonly viewId?: Id64String;
  /** The transform from the [Sheet]($backend) coordinate space to the spatial coordinate space. */
  readonly transformToSpatial: Transform;
  /** Optional 2d clip vector used to clip out portions of the [Sheet]($backend) containing annotations not relevant to this section drawing. */
  readonly clip?: ClipVector;
}

/** Represents a [SectionDrawingLocation]($backend), including data from related elements like [SectionDrawing]($backend) used in a hyper-modeling context.
 * @see [[SectionMarker]] for a widget that allows the user to interact with a section drawing location.
 * @public
 */
export class SectionDrawingLocationState {
  /** The iModel in which this section drawing location resides. */
  public readonly iModel: IModelConnection;
  /** The element Id of the section drawing location. */
  public readonly id: Id64String;
  /** The Id of the [GeometricModel3d]($backend) in which this section drawing location resides. */
  public readonly model: Id64String;
  /** A user-friendly label for the section drawing location. */
  public readonly userLabel: string;
  /** The Id of the [SpatialCategory]($backend) to which this section drawing location belongs. */
  public readonly category: Id64String;
  /** The section drawing location's spatial placement. */
  public readonly placement: Placement3d;
  /** The type of section that generated the associated [SectionDrawing]($backend). */
  public readonly sectionType: SectionType;
  /** The Id of the [ViewDefinition]($backend) that can display the section graphics. */
  public readonly drawingViewId: Id64String;
  /** The Id of the [SpatialViewDefinition]($backend) from which the section drawing was generated. */
  public readonly spatialViewId: Id64String;
  /** The section clip from the [SpatialViewDefinition]($backend) from which the section drawing was generated. */
  public readonly clip: ClipVector;
  /** The transform from the [GeometricModel]($backend) containing the section graphics to the spatial coordinate space.
   * This is used to position the 2d graphics in the context of a spatial view.
   */
  public readonly drawingToSpatialTransform: Transform;
  /** If the section drawing is attached to a [Sheet]($backend), details about the corresponding [ViewAttachment]($backend).
   * When this section drawing location is displayed in a spatial context, annotations in the sheet model can be displayed along with the section graphics.
   */
  public readonly viewAttachment?: SectionViewAttachment;

  /** @internal */
  public constructor(props: SectionDrawingLocationStateData, iModel: IModelConnection) {
    this.iModel = iModel;
    this.id = props.sectionLocationId;
    this.model = props.sectionLocationModelId;
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
        } catch { }
      }

      return clip;
    };

    this.clip = extractClip(props.clipJSON) ?? ClipVector.createEmpty();

    const placementProps = {
      origin: props.origin ?? {},
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
        viewId: props.sheetViewId,
      };
    }
  }

  /** Return a promise that resolves to the [DrawingViewState]($frontend) corresponding to `this.drawingViewId`, or undefined if an exception occurs. */
  public async tryLoadDrawingView(): Promise<DrawingViewState | undefined> {
    try {
      const view = await this.iModel.views.load(this.drawingViewId);
      if (view instanceof DrawingViewState)
        return view;
    } catch { }

    return undefined;
  }

  /** Return a promise that resolves to the [SpatialViewState]($frontend) corresponding to `this.spatialViewId`, or undefined if an exception occurs. */
  public async tryLoadSpatialView(): Promise<SpatialViewState | undefined> {
    try {
      const view = await this.iModel.views.load(this.spatialViewId);
      if (view instanceof SpatialViewState)
        return view;
    } catch { }

    return undefined;
  }

  /** Return a promise that resolves to the [SheetViewState]($frontend) corresponding to `this.viewAttachment.viewId`; or undefined if there is no corresponding [ViewAttachment]($backend) or an exception occurs. */
  public async tryLoadSheetView(): Promise<SheetViewState | undefined> {
    if (undefined === this.viewAttachment || undefined === this.viewAttachment.viewId)
      return undefined;

    try {
      const view = await this.iModel.views.load(this.viewAttachment.viewId);
      if (view instanceof SheetViewState)
        return view;
    } catch { }

    return undefined;
  }

  /** Query the specified iModel for [SectionDrawingLocation]($backend)s and return a list of corresponding [[SectionDrawingLocationState]]s. */
  public static async queryAll(iModel: IModelConnection): Promise<SectionDrawingLocationState[]> {
    const states: SectionDrawingLocationState[] = [];
    try {
      for await (const row of iModel.query(selectSectionDrawingLocationStatesECSql, undefined, { rowFormat: QueryRowFormat.UseJsPropertyNames }))
        states.push(new SectionDrawingLocationState(row as SectionDrawingLocationStateData, iModel));
    } catch {
      // If the iModel contains a version of BisCore schema older than 1.12.0, the query will produce an exception due to missing SectionDrawingLocation class. That's fine.
    }

    return states;
  }
}
