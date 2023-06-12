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
export type ViewIdString = Id64String; // should also include ViewStoreRpc.IdString when that's @public

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

/**
 * Access to a [ViewStore]($learning/ViewStore) from the frontend.
 * @beta
 */
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
   */
  export type ViewGroupSpec = IdString | ViewGroupPath;

  /** The name for a view. */
  export type ViewName = string;

  export type TagName = string;

  export type OwnerName = string;

  export type ViewGroupPath = string;

  /** The name for a view group.   */
  export type ViewGroupName = string;

  /** Determine if a string is an Id of an entry in a ViewStore (base-36 integer with a leading "@") */
  export const isViewStoreId = (id?: ViewIdString) => true === id?.startsWith("@");

  export interface QueryParams {
    /** a list of classFullNames to filter the query by. */
    readonly classNames?: string[];
    /** Optional "LIMIT" clause to limit the number of rows returned. */
    readonly limit?: number;
    /** Optional "OFFSET" clause. Only valid if Limit is also present. */
    readonly offset?: number;
    /** A string to filter view names. May include wildcards if the `nameCompare` operator supports them. */
    readonly nameSearch?: string;
    /** The comparison operator for `nameSearch`. Default is `=` */
    readonly nameCompare?: "GLOB" | "LIKE" | "NOT GLOB" | "NOT LIKE" | "=" | "<" | ">";
    readonly group?: ViewStoreRpc.ViewGroupSpec;
    readonly tags?: TagName[];
    readonly owner?: OwnerName;
  }

  export interface ViewInfo {
    id: IdString;
    name?: ViewName;
    owner?: OwnerName;
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
    owner?: OwnerName;
    group?: ViewGroupSpec;
    isPrivate?: boolean;
    tags?: TagName[];
  }

  /**
   * Methods for reading from a ViewStore via Rpc from a frontend. These methods use the *current* ViewStore for the iModel, and
   * attempt to load the default ViewStore if no ViewStore is currently loaded. They will throw exceptions if the request cannot be fulfilled.
   * @note The user's accessToken is validated against the ViewStore for every request. For each of these
   * methods, the user only needs read permission to the ViewStore.
   */
  export interface Reader {
    /** Find all views owned by the supplied owner name. */
    findViewsByOwner(args: { owner: OwnerName }): Promise<ViewInfo[]>;
    /** Get a category selector by Id. Throws if it does not exist. */
    getCategorySelector(args: { id: IdString }): Promise<CategorySelectorProps>;
    /** Get a display style by Id. Throws if it does not exist. */
    getDisplayStyle(args: { id: IdString, opts?: DisplayStyleLoadProps }): Promise<DisplayStyleProps>;
    /** Get a model selector by Id. Throws if it does not exist. */
    getModelSelector(args: { id: IdString }): Promise<ModelSelectorProps>;
    /** Get a thumbnail for a view. */
    getThumbnail(args: { viewId: IdString }): Promise<ThumbnailProps | undefined>;
    /** Get a render timeline by Id. Throws if it does not exist. */
    getTimeline(args: { id: IdString }): Promise<RenderTimelineProps>;
    /** Get a view by name. The name can include the *view group path*, if no `groupId` is supplied. */
    getViewByName(arg: { name: ViewStoreRpc.ViewName, groupId?: IdString }): Promise<ViewStoreRpc.ViewInfo | undefined>;
    getViewDefinition(args: { id: IdString }): Promise<ViewDefinitionProps>;
    /** get the properties of a ViewGroup by id. This will include the defaultViewId, if one exists. */
    getViewGroupInfo(args: { id?: IdString }): Promise<ViewGroupInfo | undefined>;
    getViewGroups(args: { parent?: ViewGroupSpec }): Promise<{ id: IdString, name: string }[]>;
    getViewInfo(args: { id: IdString }): Promise<ViewInfo | undefined>;
    /** @note The array will be sorted by name, ascending. */
    queryViews(queryParams: ViewStoreRpc.QueryParams): Promise<ViewStoreRpc.ViewInfo[]>;
  }

  /**
   * Methods for writing to a ViewStore via Rpc from a frontend. These methods use the *current* ViewStore for the iModel, and
   * attempt to load the default ViewStore if no ViewStore is currently loaded. They will throw exceptions if the request cannot be fulfilled.
   * @note The user's accessToken is validated against the ViewStore for every request. For each of these
   * methods, the user must have write permission to the ViewStore.
   */
  export interface Writer {
    addCategorySelector(args: { name?: string, categories: Id64Array, owner?: OwnerName }): Promise<IdString>;
    addDisplayStyle(args: { name?: string, className: string, settings: DisplayStyleSettingsProps, owner?: OwnerName }): Promise<IdString>;
    addModelSelector(args: { name?: string, models: Id64Array, owner?: OwnerName }): Promise<IdString>;
    addOrReplaceThumbnail(args: { viewId: IdString, thumbnail: ThumbnailProps, owner?: OwnerName }): Promise<IdString>;
    addTagsToView(args: { viewId: IdString, tags: TagName[], owner?: OwnerName }): Promise<void>;
    addTimeline(args: { name?: string, timeline: RenderSchedule.ScriptProps, owner?: OwnerName }): Promise<IdString>;

    /** Add a new view to a ViewStore. If no group is supplied, the new view is added to the root view group.
     * @returns the Id of new view
     */
    addView(args: AddViewArgs): Promise<IdString>;

    /** Add a new view group to a ViewStore. If no parent is supplied, the new group is added to the root view group.
     * @returns the Id of new view group
     */
    addViewGroup(args: { name: string, parentId?: IdString, owner?: OwnerName }): Promise<IdString>;

    /** Change the default view for a view group. If no group is supplied, this changes the default view for the root view group. */
    changeDefaultViewId(args: { defaultView: IdString, group?: ViewGroupSpec }): Promise<void>;

    /** delete the thumbnail for a view. */
    deleteThumbnail(args: { id: IdString }): Promise<void>;

    /**
     * Delete a view from a ViewStore. If this is the default view for a view group, it cannot be deleted until another view is set as the default.
     * @note If this view references a category selector, model selector, or display style that is not referenced by any other view,
     * *and do not have a name*, they will each also be deleted.
     */
    deleteView(args: { viewId: IdString }): Promise<void>;

    /** Delete a view group from a ViewStore. This will also delete all views in the group. */
    deleteViewGroup(args: { name: ViewGroupSpec }): Promise<void>;

    /** Delete a display style from a ViewStore. If the display style is referenced by any view, it cannot be deleted and an exception will be thrown. */
    deleteDisplayStyle(args: { id: IdString }): Promise<void>;

    /** Delete a model selector from a ViewStore. If the model selector is referenced by any view, it cannot be deleted and an exception will be thrown. */
    deleteModelSelector(args: { id: IdString }): Promise<void>;

    /** Delete a category selector from a ViewStore. If the category selector is referenced by any view, it cannot be deleted and an exception will be thrown. */
    deleteCategorySelector(args: { id: IdString }): Promise<void>;

    /** Delete a render timeline from a ViewStore. */
    deleteTimeline(args: { id: IdString }): Promise<void>;

    /** Delete a tag. This removes it from all views where it was used. */
    deleteTag(args: { name: TagName }): Promise<void>;

    /** remove a tag from a view. */
    removeTagFromView(args: { viewId: IdString, tag: TagName }): Promise<void>;

    // /** Update the properties of a category selector. */
    // updateCategorySelector(args: { id: IdString, categories: Id64Array }): Promise<void>;

    // /** Update the properties of a display style. */
    // updateDisplayStyle(args: { id: IdString, style: DisplayStyleSettingsProps, owner?: OwnerName }): Promise<void>;

    // /** Update the properties of a model selector. */
    // updateModelSelector(args: { id: IdString, selector: ModelSelectorProps, owner?: OwnerName }): Promise<void>;

    // /** Update the properties of a render timeline. */
    // updateTimeline(args: { id: IdString, timeline: RenderTimelineProps, owner?: OwnerName }): Promise<void>;

    // /** Update the properties of a view. */
    // updateView(args: { viewId: IdString, viewDefinition: ViewDefinitionProps, owner?: OwnerName }): Promise<void>;

    // updateViewShared(arg: { viewId: IdString, isShared: boolean, owner: string }): Promise<void>;

    // /** Set the name of a category selector. */
    // renameCategorySelector(args: { id: IdString, name: string }): Promise<void>;

    // /** Set the name of a display style. */
    // renameDisplayStyle(args: { id: IdString, name: string }): Promise<void>;

    // /** Set the name of a model selector. */
    // renameModelSelector(args: { id: IdString, name: string }): Promise<void>;

    // /** Set the name of a render timeline. */
    // renameTimeline(args: { id: IdString, name: string }): Promise<void>;

    // /** Set the name of a view. */
    // renameView(args: { id: IdString, name: string }): Promise<void>;

    // /** Set the name of a view group. */
    // renameViewGroup(args: { id: IdString, name: string }): Promise<void>;

    // /** rename an existing tag. */
    // renameTag(args: { oldName: TagName, newName: TagName }): Promise<void>;
  }
}
