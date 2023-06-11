/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Views
 */

import { CompressedId64Set, Id64Array, Id64String } from "@itwin/core-bentley";
import { AngleProps, Range3dProps, TransformProps, XYProps, XYZProps, YawPitchRollProps } from "@itwin/core-geometry";
import { CameraProps } from "./Camera";
import { DisplayStyleProps, DisplayStyleSettingsProps } from "./DisplayStyleSettings";
import { DefinitionElementProps, DisplayStyleLoadProps, ElementProps, RenderTimelineProps, SheetProps, ViewAttachmentProps } from "./ElementProps";
import { EntityQueryParams } from "./EntityProps";
import { ModelProps } from "./ModelProps";
import { SubCategoryAppearance } from "./SubCategoryAppearance";
import { ViewDetails3dProps, ViewDetailsProps } from "./ViewDetails";
import { ThumbnailProps } from "./Thumbnail";
import { RenderSchedule } from "./RenderSchedule";

/** The id of either an element or an entry in a ViewStore.
 * @public
 */
export type ViewIdString = Id64String | ViewStoreRpc.IdString;

/** As part of a [[ViewStateProps]], describes the [[SpatialViewDefinition]] from which a [SectionDrawing]($backend) was generated.
 * @see [[SectionDrawingProps]]
 * @public
 * @extensions
 */
export interface SectionDrawingViewProps {
  /** The Id of the spatial view from which the SectionDrawing was generated. */
  spatialView: Id64String;
  /** If true, the spatial view should be displayed in the context of the drawing view. */
  displaySpatialView: boolean;
  /** Transform from drawing coordinates to spatial coordinates. If undefined, use identity transform. */
  drawingToSpatialTransform?: TransformProps;
}

/** The response props from the getCustomViewState3dData RPC endpoint
 * @internal
 */
export interface CustomViewState3dProps {
  modelIds: CompressedId64Set;
  modelExtents: Range3dProps;
  categoryIds: CompressedId64Set;
}

/**
 * The options passed to the getCustomViewState3dData RPC endpoint.
 * @internal
 */
export interface CustomViewState3dCreatorOptions {
  modelIds?: CompressedId64Set;
}

/**
 * A result row from querying for subcategories
 * @internal
 */
export interface SubCategoryResultRow {
  parentId: Id64String;
  id: Id64String;
  appearance: SubCategoryAppearance.Props;
}

/**
 * Request props for the hydrateViewState RPC endpoint.
 * @internal
 */
export interface HydrateViewStateRequestProps {
  acsId?: string;
  notLoadedModelSelectorStateModels?: CompressedId64Set;
  /** @deprecated in 3.x. If loading categoryIds is necessary, see [IModelConnection.SubCategoriesCache.load]($frontend)*/
  notLoadedCategoryIds?: CompressedId64Set;
  sheetViewAttachmentIds?: CompressedId64Set;
  viewStateLoadProps?: ViewStateLoadProps;
  baseModelId?: Id64String;
  spatialViewId?: Id64String;
}

/** Response props from the hydrateViewState RPC endpoint.
 * @internal
 */
export interface HydrateViewStateResponseProps {
  acsElementProps?: ElementProps;
  modelSelectorStateModels?: ModelProps[];
  // cast this to viewAttachmentInfo[] on the frontend.
  sheetViewAttachmentProps?: ViewAttachmentProps[];
  sheetViewViews?: (ViewStateProps | undefined)[];
  baseModelProps?: ModelProps;
  spatialViewProps?: ViewStateProps;
  /** @deprecated in 3.x. If loading categoryIds is necessary, see [IModelConnection.SubCategoriesCache.load]($frontend)*/
  categoryIdsResult?: SubCategoryResultRow[];
}

/** Returned from [IModelDb.Views.getViewStateData]($backend).
 * @public
 * @extensions
 */
export interface ViewStateProps {
  viewDefinitionProps: ViewDefinitionProps;
  categorySelectorProps: CategorySelectorProps;
  modelSelectorProps?: ModelSelectorProps;
  displayStyleProps: DisplayStyleProps;
  /** Sheet-specific properties, if this is a view of a [SheetModel]($backend). */
  sheetProps?: SheetProps;
  /** The Ids of the [ViewAttachment]($backend)s contained within the [SheetModel]($backend), if this is a sheet view. */
  sheetAttachments?: Id64Array;
  /** For a [DrawingViewState]($frontend), the extents of the [DrawingModel]($backend), used for determining the upper limits of the view's extents. */
  modelExtents?: Range3dProps;
  /** Information about the [SectionDrawing]($backend) relevant to displaying a drawing view. */
  sectionDrawing?: SectionDrawingViewProps;
}

/** Options for loading a [[ViewStateProps]] via [IModelConnection.Views.load]($frontend) or [IModelDb.Views.getViewStateData]($backend).
 * @public
 * @extensions
 */
export interface ViewStateLoadProps {
  /** Options for loading the view's [[DisplayStyleProps]]. */
  displayStyle?: DisplayStyleLoadProps;
}

/** Properties that define a ModelSelector
 * @public
 * @extensions
 */
export interface ModelSelectorProps extends DefinitionElementProps {
  models: Id64Array;
}

/** Properties that define a CategorySelector
 * @public
 * @extensions
 */
export interface CategorySelectorProps extends DefinitionElementProps {
  categories: Id64Array;
}

/** Parameters for performing a query on [ViewDefinition]($backend) classes.
 * @public
 * @extensions
 */
export interface ViewQueryParams extends EntityQueryParams {
  readonly wantPrivate?: boolean;
}

/** Parameters used to construct a ViewDefinition
 * @public
 * @extensions
 */
export interface ViewDefinitionProps extends DefinitionElementProps {
  categorySelectorId: ViewIdString;
  displayStyleId: ViewIdString;
  description?: string;
  jsonProperties?: {
    /** Additional properties of the view. */
    viewDetails?: ViewDetailsProps;
  };
}

/** Parameters to construct a ViewDefinition3d
 * @public
 * @extensions
 */
export interface ViewDefinition3dProps extends ViewDefinitionProps {
  /** if true, camera is valid. */
  cameraOn: boolean;
  /** The lower left back corner of the view frustum. */
  origin: XYZProps;
  /** The extent of the view frustum. */
  extents: XYZProps;
  /** Rotation of the view frustum (could be undefined if going Matrix3d -> YawPitchRoll). */
  angles?: YawPitchRollProps;
  /** The camera used for this view. */
  camera: CameraProps;
  jsonProperties?: {
    /** Additional properties of the view. */
    viewDetails?: ViewDetails3dProps;
  };
}

/** Parameters to construct a SpatialViewDefinition
 * @public
 * @extensions
 */
export interface SpatialViewDefinitionProps extends ViewDefinition3dProps {
  modelSelectorId: ViewIdString;
}

/** Parameters used to construct a ViewDefinition2d
 * @public
 * @extensions
 */
export interface ViewDefinition2dProps extends ViewDefinitionProps {
  baseModelId: Id64String;
  origin: XYProps;
  delta: XYProps;
  angle: AngleProps;
}

/**
 * @public
 * @extensions
 */
export interface AuxCoordSystemProps extends ElementProps {
  type?: number;
  description?: string;
}

/**  Properties of AuxCoordSystem2d
 * @public
 * @extensions
 */
export interface AuxCoordSystem2dProps extends AuxCoordSystemProps {
  /** Origin of the AuxCoordSystem2d */
  origin?: XYProps;
  /** Rotation angle */
  angle?: AngleProps;
}

/** Properties of AuxCoordSystem3d
 * @public
 * @extensions
 */
export interface AuxCoordSystem3dProps extends AuxCoordSystemProps {
  /** Origin of the AuxCoordSystem3d */
  origin?: XYZProps;
  /** Yaw angle */
  yaw?: AngleProps;
  /** Pitch angle */
  pitch?: AngleProps;
  /** Roll angle */
  roll?: AngleProps;
}

export namespace ViewStoreRpc {

  /** @internal */
  export const version = "4.0.0" as const;

  /** an Id of a View, DisplayStyle, ModelSelector, CategorySelector, or Timeline in a ViewStore.
   * Will be a base-36 number with a leading "@".
   * @public
   */
  export type IdString = string;

  /**
   * A string identifying a group. This may either be a "group name path" or the RowString of a group (e.g. either "group1/design/issues" or "@4e3")
   * The syntax is not ambiguous because ViewStoreIdStrings always start with "@" and  Group names can never contain "@".
   * @beta
   */
  export type ViewGroupSpec = IdString | ViewGroupPath;

  /** The name for a view. */
  export type ViewName = string;

  export type TagName = string;

  export type ViewGroupPath = string;

  /** The name for a view group.
   * @beta
   */
  export type ViewGroupName = string;

  /** Determine if a string is an Id of an entry in a ViewStore (base-36 integer with a leading "@")
 * @beta
 */
  export const isViewStoreId = (id?: ViewIdString) => true === id?.startsWith("@");

  export interface QueryParams {
    readonly classNames?: string[]; // list of classFullNames
    /** Optional "LIMIT" clause to limit the number of rows returned. */
    readonly limit?: number;
    /** Optional "OFFSET" clause. Only valid if Limit is also present. */
    readonly offset?: number;
    readonly nameSearch?: string;
    /** The comparison operator for `nameSearch`. Default is `=` */
    readonly nameCompare?: "GLOB" | "LIKE" | "NOT GLOB" | "NOT LIKE" | "=" | "<" | ">";
    readonly group?: ViewStoreRpc.ViewGroupSpec;
    readonly tags?: string[];
    readonly owner?: string;
  }

  export interface ViewInfo {
    id: IdString;
    name?: ViewName;
    owner?: string;
    className: string;
    groupId: IdString;
    isPrivate: boolean;
    modelSel?: IdString;
    categorySel?: IdString;
    displayStyle?: IdString;
    tags?: string[];
  }

  export interface ViewGroupInfo {
    id: IdString;
    name: ViewGroupPath;
    parent?: IdString;
    defaultView?: IdString;
  }

  export interface AddViewArgs {
    viewDefinition: ViewDefinitionProps;
    categorySelectorProps?: CategorySelectorProps;
    modelSelectorProps?: ModelSelectorProps;
    displayStyleProps?: DisplayStyleProps;
    owner?: string;
    group?: ViewGroupSpec;
    isPrivate?: boolean;
    tags?: string[];
  }

  /**
   * Methods for reading from a ViewStore via Rpc from a frontend. These methods use the current ViewStore for the iModel, and
   * attempts to load the default ViewStore if no current ViewStore is loaded. They all require an accessToken, and
   * will throw exceptions if the request cannot be fulfilled.
   * @note The user's accessToken is validated against the ViewStore's container for every request.
   * @beta
   */
  export interface Reader {
    /** Find all "owned by" views. */
    findViewsByOwner(args: { owner: string }): Promise<ViewInfo[]>;

    getViewInfo(args: { id: IdString }): Promise<ViewInfo | undefined>;
    getViewGroupInfo(args: { id?: IdString }): Promise<ViewGroupInfo | undefined>;
    getViewGroups(args: { parent?: ViewGroupSpec }): Promise<{ id: IdString, name: string }[]>;
    getCategorySelector(args: { id: IdString }): Promise<CategorySelectorProps>;
    getDisplayStyle(args: { id: IdString, opts?: DisplayStyleLoadProps }): Promise<DisplayStyleProps>;
    getModelSelector(args: { id: IdString }): Promise<ModelSelectorProps>;
    getThumbnail(args: { viewId: IdString }): Promise<ThumbnailProps | undefined>;
    getTimeline(args: { id: IdString }): Promise<RenderTimelineProps>;
    getViewDefinition(args: { id: IdString }): Promise<ViewDefinitionProps>;
    queryViews(queryParams: ViewStoreRpc.QueryParams): Promise<ViewStoreRpc.ViewInfo[]>;
  }

  /** @beta */
  export interface Writer {
    addCategorySelector(args: { name?: string, categories: Id64Array, owner?: string }): Promise<IdString>;
    addDisplayStyle(args: { name?: string, className: string, settings: DisplayStyleSettingsProps, owner?: string }): Promise<IdString>;
    addModelSelector(args: { name?: string, models: Id64Array, owner?: string }): Promise<IdString>;
    addOrReplaceThumbnail(args: { viewId: IdString, thumbnail: ThumbnailProps, owner?: string }): Promise<IdString>;
    addTagsToView(args: { viewId: IdString, tags: string[], owner?: string }): Promise<void>;
    addTimeline(args: { name?: string, timeline: RenderSchedule.ScriptProps, owner?: string }): Promise<IdString>;
    addView(args: AddViewArgs): Promise<IdString>;
    addViewGroup(args: { name: string, parentId?: IdString, owner?: string }): Promise<IdString>;
    changeDefaultViewId(args: { defaultView: IdString, group?: ViewGroupSpec }): Promise<void>;
    deleteThumbnail(args: { id: IdString }): Promise<void>;
    deleteView(viewId: IdString): Promise<void>;
    deleteViewGroup(args: { name: ViewGroupSpec }): Promise<void>;
    removeTagFromView(args: { viewId: IdString, tag: string }): Promise<void>;
  }
}
