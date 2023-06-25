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

  /**
   * bindings for query-based selectors
   * @beta
   */
  queryBindings?: {
    modelSelector?: ViewStoreRpc.QueryBindings;
    categorySelector?: ViewStoreRpc.QueryBindings;
  };
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
  wantPrivate?: boolean;
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
 * Access to a ViewStore from the frontend.
 * @beta
 */
export namespace ViewStoreRpc {

  /**
   * Version of the Rpc interface. If any methods or interfaces of this API change, this number should
   * be incremented according to the rules of semantic versioning. See .\rpc\README-RpcInterfaceVersioning.md for more information.
   *  @internal
   */
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

  /** The name for a Tag. */
  export type TagName = string;

  /** The name of an "owner". Should come from the authentication system, so it will be guaranteed unique.
   * This name should be chosen by the user rather than their email address.
   */
  export type OwnerName = string;

  /** The path name of a view group (e.g. "group1/design/issues"). Does not include the "root" group. */
  export type ViewGroupPath = string;

  /** The name for a view group.  */
  export type ViewGroupName = string;

  /** The name for a view group.  */
  export type ClassFullName = string;

  /** Determine if a string is an Id of an entry in a ViewStore (base-36 integer with a leading "@") */
  export const isViewStoreId = (id?: ViewIdString) => true === id?.startsWith("@");

  /** Parameters for querying for views in a ViewStore. */
  export interface QueryParams {
    /** a list of classFullNames to accept. If not present, all classes are returned. */
    readonly classNames?: ClassFullName[];
    /** Optional "LIMIT" clause to limit the number of views returned. */
    readonly limit?: number;
    /** Optional "OFFSET" clause. Only valid if Limit is also present. */
    readonly offset?: number;
    /** A string to filter view names. May include wildcards if the `nameCompare` uses LIKE or GLOB (see SQLite documentation for LIKE and GLOB). */
    readonly nameSearch?: string;
    /** The comparison operator for `nameSearch`. Default is `=` */
    readonly nameCompare?: "GLOB" | "LIKE" | "NOT GLOB" | "NOT LIKE" | "=" | "<" | ">";
    /* the Id of the view group to query. If not present, the root group is used. There is no way to query for views from multiple view groups in one request. */
    readonly group?: IdString;
    /** A list of tags to filter views. If present, only views that have one or more of the tags will be returned. */
    readonly tags?: TagName[];
    /* The name of an owner for private views. If present, private views owned by the owner will also be returned. Shared views are always returned. */
    readonly owner?: OwnerName;
  }

  /** Parameters for specifying a Query to select Categories or Models. */
  export interface SelectorQuery {
    /**
     * The full ClassName from which to select. If this SelectorQuery is for Categories, this must be or derive from "BisCore:Category".
     * If this SelectorQuery is for Models, this must be or derive from "BisCore:Model".
     */
    from: ClassFullName;
    /** If true, only return instances of `from`. Otherwise, return instances of `from` and any subclasses of `from`. */
    only?: boolean;
    /**
     * filter for query. If present, only instances of `from` that satisfy the filter will be returned.
     * If not supplied, all instances of `from` are returned.
     * @note
     * This value is used into the ECQuery:`SELECT ECInstanceId FROM ${query.from} WHERE ${query.where}`.
     */
    where?: string;
    /** List of Model or Category ids to add to the query results.
     * @note This is only valid if there is a `where` clause. Otherwise all instances of `from` will be returned so there is no value in adding ids.
    */
    adds?: Id64Array | CompressedId64Set;
    /** List of Model or Category Ids to remove from the query results. */
    removes?: Id64Array | CompressedId64Set;
  }

  /** A Model or Category selector may either be a query or a list of Ids. */
  export type SelectorProps = { query: SelectorQuery, ids?: never } | { query?: never, ids: Id64Array | CompressedId64Set };

  /** Information about a View in a ViewStore. */
  export interface ViewInfo {
    /** The Id of the view. */
    id: IdString;
    /** The name of the view. */
    name?: ViewName;
    /** The name of the owner of the view. */
    owner?: OwnerName;
    /** The className of the view. */
    className: ClassFullName;
    /** The Id of the view group containing the view. */
    groupId: IdString;
    /** If true, the view is private (unshared) and will only be returned by queries that specify the owner's name. */
    isPrivate: boolean;
    /** The Id of a ModelSelector, if the view has one. */
    modelSelectorId?: IdString;
    /** The Id of the CategorySelector for this view. */
    categorySelectorId: IdString;
    /** The Id of a DisplayStyle for the view. */
    displayStyleId: IdString;
    /** a list of tags for the view. */
    tags?: TagName[];
  }

  /** Information about a ViewGroup in a ViewStore. */
  export interface ViewGroupInfo {
    /** The Id of this view group. */
    id: IdString;
    /** The name of this view group. */
    name: ViewGroupName;
    /** The Id of the parent of this view group. If undefined, this is the root group. */
    parent?: IdString;
    /** The Id of the default view for this view group. */
    defaultView?: IdString;
  }

  /** Arguments for adding a new view to a ViewStore. */
  export interface AddViewArgs {
    /** the properties of the ViewDefinition for the new view. */
    readonly viewDefinition: ViewDefinitionProps;

    /**
     * The properties of a category selector for the new view.
     * @note This value is only used, and should only be present if `viewDefinition.categorySelectorId` **not** a valid
     * `IdString`. In that case, a new category selector will be created with these properties and its Id will be used.
     * Otherwise, the categorySelectorId from the ViewDefinition is used. If it does not represent a valid category
     * selector, an error is thrown.
     */
    readonly categorySelectorProps?: CategorySelectorProps;

    /** The properties of a model selector for the new view.
     * @note This value is only used, and should only be present if `viewDefinition.modelSelectorId` **not** a valid
     * `IdString`. In that case, a new model selector will be created with these properties and its Id will be used.
     * Otherwise, the modelSelectorId from the ViewDefinition is used. If it does not represent a valid model selector,
     * an error is thrown.
     */
    readonly modelSelectorProps?: ModelSelectorProps;

    /** The properties of a display style for the new view.
     * @note This value is only used, and should only be present if `viewDefinition.displayStyleId` **not** a valid
     * `IdString`. In that case, a new display style will be created with these properties and its Id will be used.
     * Otherwise, the displayStyleId from the ViewDefinition is used. If it does not represent a valid display style, an
     * error is thrown.
     */
    readonly displayStyleProps?: DisplayStyleProps;

    /* the owner of the view. Must be present if isPrivate is true. */
    readonly owner?: OwnerName;

    /* the Id of the view group for the view. If not present, the view is added to the root group. */
    readonly group?: IdString;

    /* if true, the view is private (unshared). */
    readonly isPrivate?: boolean;

    /* an optional list of tags for the view. */
    readonly tags?: TagName[];

    /** optional thumbnail for the view. */
    readonly thumbnail?: ThumbnailProps;
  }

  /** Argument for finding a category selector, model selector, display style, or timeline by name or Id. */
  export type NameOrId = { name: string, id?: never } | { id: IdString, name?: never };

  /** Bindings for parameterized values in where clause of SelectorQuery
   * @see[[ECSqlStatement.bindValues]]
   */
  export interface QueryBindings {
    bindings?: any[] | object;
  }

  /**
   * Methods for reading from a ViewStore via Rpc from a frontend via `IModelConnection.views.viewsStoreReader`. These
   * methods use the *current* ViewStore for the iModel, and attempt to load the default ViewStore if no ViewStore is
   * currently loaded. They will throw exceptions if the request cannot be fulfilled.
   * @note The user's accessToken is validated against the ViewStore for every request. For each of these methods, the
   * user only needs read permission to the ViewStore.
   */
  export interface Reader {
    /** Find all views owned by the supplied owner name. */
    findViewsByOwner(args: { owner: OwnerName }): Promise<ViewInfo[]>;

    /** Get a category selector by Id. Throws if it does not exist. */
    getCategorySelector(args: NameOrId & QueryBindings): Promise<CategorySelectorProps>;

    /** Get a display style by Id. Throws if it does not exist. */
    getDisplayStyle(args: NameOrId & { opts?: DisplayStyleLoadProps }): Promise<DisplayStyleProps>;

    /** Get a model selector by Id. Throws if it does not exist. */
    getModelSelector(args: NameOrId & QueryBindings): Promise<ModelSelectorProps>;

    /** Get a thumbnail for a view. */
    getThumbnail(args: { viewId: IdString }): Promise<ThumbnailProps | undefined>;

    /** Get a render timeline by Id. Throws if it does not exist. */
    getTimeline(args: NameOrId): Promise<RenderTimelineProps>;

    /** Get a view by name. The name can include the *view group path*, if no `groupId` is supplied. */
    getViewByName(arg: { name: ViewName, groupId?: IdString }): Promise<ViewInfo | undefined>;

    /** Get a view definition by viewId. Throws if it does not exist. */
    getViewDefinition(args: { viewId: IdString }): Promise<ViewDefinitionProps>;

    /** get the properties of a ViewGroup by id. This will include the defaultViewId, if one exists. */
    getViewGroupInfo(args: { groupId?: IdString }): Promise<ViewGroupInfo | undefined>;

    /** Get a list of ViewGroups that are children of the supplied parent. If no parent is supplied, the root group is used.
     * Each entry in the list includes the id and name of the ViewGroup.
     */
    getViewGroups(args: { parent?: ViewGroupSpec }): Promise<{ id: IdString, name: string }[]>;

    /** Get the ViewInfo for a view by Id. Returns undefined if the view does not exist. */
    getViewInfo(args: { viewId: IdString }): Promise<ViewInfo | undefined>;

    /** Query for a list of ViewInfos for views that match the supplied [[QueryParams]].
     * @note The array will be sorted by name, ascending. To limit the size of the array, supply `limit` and `offset` in the QueryParams.
     */
    queryViews(queryParams: QueryParams): Promise<ViewInfo[]>;
  }

  /**
   * Methods for writing to a ViewStore via Rpc from a frontend via `IModelConnection.views.viewsStoreWriter`. These
   * methods use the *current* ViewStore for the iModel, and attempt to load the default ViewStore if no ViewStore is
   * currently loaded. They will throw exceptions if the request cannot be fulfilled.
   * @note The user's accessToken is validated against the ViewStore for every request. For each of these methods, the
   * user must have write permission to the ViewStore.
   */
  export interface Writer {
    /**
     * Add a category selector to a ViewStore.
     * @returns The IdString of the new category selector.
     */
    addCategorySelector(args: { name?: string, selector: SelectorProps, owner?: OwnerName }): Promise<IdString>;

    /** Add a display style to a ViewStore.
     * @returns The IdString of the new display style.
     */
    addDisplayStyle(args: { name?: string, className: string, settings: DisplayStyleSettingsProps, owner?: OwnerName }): Promise<IdString>;

    /**
     *  Add a model selector to a ViewStore.
     * @returns The IdString of the new model selector.
     */
    addModelSelector(args: { name?: string, selector: SelectorProps, owner?: OwnerName }): Promise<IdString>;

    /**
     * Add a thumbnail for a view. If the view already has a thumbnail, it is replaced.
     * If a view is deleted, its thumbnail is also deleted.
     * @note The thumbnail must be a valid image in PNG or JPEG format.
     */
    addOrReplaceThumbnail(args: { viewId: IdString, thumbnail: ThumbnailProps }): Promise<void>;

    /** Add tags to a view. If the view already has tags, the new tags are appended to the existing tags. */
    addTagsToView(args: { viewId: IdString, tags: TagName[] }): Promise<void>;

    /** Add a render timeline to a ViewStore.
     * @returns The IdString of the new timeline.
     */
    addTimeline(args: { name?: string, timeline: RenderSchedule.ScriptProps, owner?: OwnerName }): Promise<IdString>;

    /** Add a view to a ViewStore. If no group is supplied, the new view is added to the root view group.
     * @returns The IdString of the new view
     */
    addView(args: AddViewArgs): Promise<IdString>;

    /** Add a view group to a ViewStore. If no parent is supplied, the new group is added to the root view group.
     * @returns the IdString of new view group
     */
    addViewGroup(args: { name: string, parentId?: IdString, owner?: OwnerName }): Promise<IdString>;

    /** Change the default view for a view group. If no group is supplied, this changes the default view for the root view group. */
    changeDefaultViewId(args: { defaultView: IdString, group?: ViewGroupSpec }): Promise<void>;

    /** Delete the thumbnail for a view. */
    deleteThumbnail(args: { viewId: IdString }): Promise<void>;

    /**
     * Delete a view from a ViewStore. If this is the default view for a view group, it cannot be deleted until another
     * view is set as the default.
     * @note If this view references a category selector, model selector, or display style that is not referenced by any
     * other view, *and do not have a name*, they will each also be deleted. If the view has a thumbnail, it is also
     * deleted.
     */
    deleteView(args: { viewId: IdString }): Promise<void>;

    /** Delete a view group from a ViewStore. This will also delete all views in the group. */
    deleteViewGroup(args: { name: ViewGroupSpec }): Promise<void>;

    /** Delete a display style from a ViewStore. If the display style is referenced by any view, it cannot be deleted
     * and an exception will be thrown.
     */
    deleteDisplayStyle(args: { id: IdString }): Promise<void>;

    /** Delete a model selector from a ViewStore. If the model selector is referenced by any view, it cannot be deleted
     * and an exception will be thrown. */
    deleteModelSelector(args: { id: IdString }): Promise<void>;

    /** Delete a category selector from a ViewStore. If the category selector is referenced by any view, it cannot be
     * deleted and an exception will be thrown.
     */
    deleteCategorySelector(args: { id: IdString }): Promise<void>;

    /** Delete a render timeline from a ViewStore. */
    deleteTimeline(args: { id: IdString }): Promise<void>;

    /** Delete a tag. This removes it from all views where it was used. */
    deleteTag(args: { name: TagName }): Promise<void>;

    /** remove a tag from a view. */
    removeTagFromView(args: { viewId: IdString, tag: TagName }): Promise<void>;

    /** Update the properties of a category selector. */
    updateCategorySelector(args: NameOrId & { selector: SelectorProps }): Promise<void>;

    /** Update the properties of a display style. */
    updateDisplayStyle(args: NameOrId & { className: string, settings: DisplayStyleSettingsProps }): Promise<void>;

    /** Update the properties of a model selector. */
    updateModelSelector(args: NameOrId & { selector: SelectorProps }): Promise<void>;

    /** Update the properties of a render timeline. */
    updateTimeline(args: NameOrId & { timeline: RenderSchedule.ScriptProps }): Promise<void>;

    /** Update the properties of a view definition. */
    updateViewDefinition(args: { viewId: IdString, viewDefinition: ViewDefinitionProps }): Promise<void>;

    /** Change a view from shared to private, or vice versa. If changing to private, the owner must be supplied. */
    updateViewShared(arg: { viewId: IdString, isShared: boolean, owner?: string }): Promise<void>;

    /** Set the name of a category selector. */
    renameCategorySelector(args: { id: IdString, name?: string }): Promise<void>;

    /** Set the name of a display style. */
    renameDisplayStyle(args: { id: IdString, name?: string }): Promise<void>;

    /** Set the name of a model selector. */
    renameModelSelector(args: { id: IdString, name?: string }): Promise<void>;

    /** Set the name of a render timeline. */
    renameTimeline(args: { id: IdString, name?: string }): Promise<void>;

    /** Set the name of a view. */
    renameView(args: { viewId: IdString, name: string }): Promise<void>;

    /** Set the name of a view group. */
    renameViewGroup(args: { groupId: IdString, name: string }): Promise<void>;

    /** rename an existing tag. */
    renameTag(args: { oldName: TagName, newName: TagName }): Promise<void>;
  }
}
