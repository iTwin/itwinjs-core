/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Entities
 */

import { GuidString, Id64, Id64String } from "@itwin/core-bentley";
import {
  AngleProps, ClipVectorProps, LowAndHighXYProps, LowAndHighXYZProps, TransformProps, XYProps, XYZProps, YawPitchRollProps,
} from "@itwin/core-geometry";
import { CodeProps } from "./Code";
import { EntityProps } from "./EntityProps";
import { ElementGeometryBuilderParams, ElementGeometryBuilderParamsForPart } from "./geometry/ElementGeometry";
import { GeometryStreamProps } from "./geometry/GeometryStream";
import { IModelError, IModelStatus } from "./IModelError";
import { SubCategoryAppearance } from "./SubCategoryAppearance";

/** Properties of a NavigationProperty.
 * @public
 * @extensions
 */
export interface RelatedElementProps {
  /** The Id of the element to which this element is related. */
  id: Id64String;
  /** The full className of the relationship class. */
  relClassName?: string;
}

/** Properties of an [Element]($docs/bis/guide/fundamentals/element-fundamentals)
 * @public
 * @extensions
 */
export interface ElementProps extends EntityProps {
  /** The Id of the [Model]($docs/bis/guide/fundamentals/model-fundamentals.md) containing this element */
  model: Id64String;
  /** The [Code]($docs/bis/guide/fundamentals/codes.md) for this element */
  code: CodeProps;
  /** The Parent of this element, if defined. */
  parent?: RelatedElementProps;
  /** A [FederationGuid]($docs/bis/guide/fundamentals/element-fundamentals.md#federationguid) assigned to this element.
   * @note  On insert, if this is a valid Guid, the value is preserved. If it is `undefined`, a new Guid is created. If it is an invalid Guid (e.g. Guid.empty), the
   * resultant element will have a `null` federationGuid. For update, `undefined` means "don't change."
   */
  federationGuid?: GuidString;
  /** A [user-assigned label]($docs/bis/guide/fundamentals/element-fundamentals.md#userlabel) for this element. */
  userLabel?: string;
  /** Optional [json properties]($docs/bis/guide/fundamentals/element-fundamentals.md#jsonproperties) of this element. */
  jsonProperties?: any;
}

/** The Id and relationship class of an Element that is somehow related to another Element
 * @public
 */
export class RelatedElement implements RelatedElementProps {
  /** The Id of the element to which this element is related. */
  public readonly id: Id64String;

  /** The full className of the relationship class. */
  public readonly relClassName?: string;

  constructor(props: RelatedElementProps) {
    this.id = Id64.fromJSON(props.id);
    this.relClassName = props.relClassName;
  }

  public static fromJSON(json?: RelatedElementProps): RelatedElement | undefined {
    return json ? new RelatedElement(json) : undefined;
  }

  /** Used to *null out* an existing navigation relationship. */
  public static readonly none = new RelatedElement({ id: Id64.invalid });

  /** Accept the value of a navigation property that might be in the shortened format of just an id or might be in the full RelatedElement format. */
  public static idFromJson(json: any): Id64String {
    if ((typeof json === "object") && ("id" in json)) {
      const r = RelatedElement.fromJSON(json);
      if (r === undefined)
        throw new IModelError(IModelStatus.BadArg, "Problem parsing Id64 from json");
      return r.id;
    }
    return Id64.fromJSON(json);
  }

  public toJSON(): RelatedElementProps {
    return {
      id: this.id,
      relClassName: this.relClassName,
    };
  }
}

/** A [RelatedElement]($common) relationship that describes the [TypeDefinitionElement]($backend) of an element.
 * @public
 */
export class TypeDefinition extends RelatedElement {
}

/** Properties of a [GeometricElement]($backend)
 * @public
 * @extensions
 */
export interface GeometricElementProps extends ElementProps {
  /** The id of the category for this geometric element. */
  category: Id64String;
  /** The geometry stream properties */
  geom?: GeometryStreamProps;
  /** How to build the element's GeometryStream. This is used for insert and update only. It is not a persistent property. It will be undefined in the properties returned by functions that read a persistent element. It may be specified as an alternative to `geom` when inserting or updating an element.
   * @beta
   */
  elementGeometryBuilderParams?: ElementGeometryBuilderParams;
  /** The placement properties */
  placement?: PlacementProps;
}

/** Properties of a [[Placement3d]]
 * @public
 * @extensions
 */
export interface Placement3dProps {
  origin: XYZProps;
  angles: YawPitchRollProps;
  bbox?: LowAndHighXYZProps;
}

/** Properties of a [[Placement2d]]
 * @public
 * @extensions
 */
export interface Placement2dProps {
  origin: XYProps;
  angle: AngleProps;
  bbox?: LowAndHighXYProps;
}

/**
 * @public
 * @extensions
 */
export type PlacementProps = Placement2dProps | Placement3dProps;

/** determine if this is Placement2dProps
 * @public
 */
export function isPlacement2dProps(props: PlacementProps): props is Placement2dProps {
  return (props as Placement2dProps).angle !== undefined;
}

/** determine if this is Placement3dProps
 * @public
 */
export function isPlacement3dProps(props: PlacementProps): props is Placement3dProps {
  return !isPlacement2dProps(props);
}

/** Properties that define a [GeometricElement3d]($backend)
 * @public
 * @extensions
 */
export interface GeometricElement3dProps extends GeometricElementProps {
  placement?: Placement3dProps;
  typeDefinition?: RelatedElementProps;
}

/** Properties that define a [PhysicalElement]($backend)
 * @public
 * @extensions
 */
export interface PhysicalElementProps extends GeometricElement3dProps {
  physicalMaterial?: RelatedElementProps;
}

/** An enumeration of the different types of [SectionDrawing]($backend)s.
 * @public
 * @extensions
 */
export enum SectionType {
  Section = 3,
  Detail = 4,
  Elevation = 5,
  Plan = 6,
}

/** Properties that define a [SectionDrawing]($backend).
 * @public
 * @extensions
 */
export interface SectionDrawingProps extends ElementProps {
  /** The type of section used to generate the drawing. Default: Section. */
  sectionType?: SectionType;
  /** The spatial view from which the section was generated. */
  spatialView?: RelatedElementProps;
  jsonProperties?: {
    /** A transform from the section drawing model's coordinates to spatial coordinates. */
    drawingToSpatialTransform?: TransformProps;
    /** If the section drawing is placed onto a [Sheet]($backend) via a [ViewAttachment]($backend), a transform from the sheet's coordinates to spatial coordinates. */
    sheetToSpatialTransform?: TransformProps;
    /** If the section drawing is placed onto a [Sheet]($backend) via a [ViewAttachment]($backend), JSON representation of a [ClipVector]($geometry) to apply to
     * the sheet graphics when drawn in the context of the spatial view.
     * The ClipVector is in spatial coordinates.
     */
    drawingBoundaryClip?: ClipVectorProps;
    /** If true, when displaying the section drawing as a [DrawingViewState]($frontend), the [[spatialView]] will also be displayed. */
    displaySpatialView?: true;
  };
}

/** Properties that define a [SectionDrawingLocation]($backend)
 * @public
 * @extensions
 */
export interface SectionDrawingLocationProps extends GeometricElement3dProps {
  /** The [ViewDefinition]($backend) to which this location refers. */
  sectionView?: RelatedElementProps;
}

/** Properties that define a [GeometricElement2d]($backend)
 * @public
 * @extensions
 */
export interface GeometricElement2dProps extends GeometricElementProps {
  placement?: Placement2dProps;
  typeDefinition?: RelatedElementProps;
}

/** Properties of a [GeometryPart]($backend)
 * @public
 * @extensions
 */
export interface GeometryPartProps extends ElementProps {
  geom?: GeometryStreamProps;
  /** How to build the part's GeometryStream. This is used for insert and update only. It is not a persistent property. It will be undefined in the properties returned by functions that read a persistent element. It may be specified as an alternative to `geom` when inserting or updating an element.
   * @beta
   */
  elementGeometryBuilderParams?: ElementGeometryBuilderParamsForPart;
  bbox?: LowAndHighXYZProps;
}

/** Properties for a [ViewAttachment]($backend)
 * @public
 * @extensions
 */
export interface ViewAttachmentProps extends GeometricElement2dProps {
  view: RelatedElementProps;
  jsonProperties?: {
    /** Integer priority in [-500,500]. Where two attachments overlap, the one with the higher priority draws in front of the other. Default: 0. */
    displayPriority?: number;
    /** JSON representation of a [ClipVector]($core-geometry] in sheet coordinate space, used to clip the attachment's graphics on the sheet. */
    clip?: ClipVectorProps;
    /** Options for customizing how the view attachment is displayed on the sheet. */
    displayOptions?: {
      /** If true, the view attachment is always drawn as a raster image. By default, only 3d perspective views are drawn this way (they always *must* be). Default: false. */
      drawAsRaster?: boolean;
      /** If true, and the view attachment is drawn as a raster image, the background color of the view will be preserved. By default the background color of the
       * sheet is used and any background pixels become transparent, allowing the contents of the sheet to show through. Default: false.
       */
      preserveBackground?: boolean;
    };
  };
}

/** Properties of a [Subject]($backend)
 * @public
 * @extensions
 */
export interface SubjectProps extends ElementProps {
  description?: string;
}

/** Properties of a [SheetBorderTemplate]($backend)
 * @beta
 */
export interface SheetBorderTemplateProps extends ElementProps {
  height?: number;
  width?: number;
}

/** Properties of a [SheetTemplate]($backend)
 * @beta
 */
export interface SheetTemplateProps extends ElementProps {
  height?: number;
  width?: number;
  border?: Id64String;
}

/** Properties of a [Sheet]($backend).
 * @public
 * @extensions
 */
export interface SheetProps extends ElementProps {
  width?: number;
  height?: number;
  scale?: number;
  sheetTemplate?: Id64String;
  attachments?: Id64String[];
}

/** Properties of a [DefinitionElement]($backend)
 * @public
 * @extensions
 */
export interface DefinitionElementProps extends ElementProps {
  isPrivate?: boolean;
}

/** Properties of a [TypeDefinitionElement]($backend)
 * @public
 * @extensions
 */
export interface TypeDefinitionElementProps extends DefinitionElementProps {
  recipe?: RelatedElementProps;
}

/** Properties of a [PhysicalType]($backend)
 * @public
 * @extensions
 */
export interface PhysicalTypeProps extends TypeDefinitionElementProps {
  /** The [PhysicalMaterial]($backend) that makes up this physical type. */
  physicalMaterial?: RelatedElementProps;
}

/** Properties of a [InformationPartitionElement]($backend)
 * @public
 * @extensions
 */
export interface InformationPartitionElementProps extends ElementProps {
  description?: string;
}

/** Options controlling which properties are included or excluded when querying [[DisplayStyleProps]].
 * @see [[ViewStateLoadProps]] and [[ElementLoadOptions]].
 * @public
 * @extensions
 */
export interface DisplayStyleLoadProps {
  /** If true, the lists of element Ids in the display style's schedule script will be empty.
   * The element Ids are not required on the frontend for display and can be quite large.
   */
  omitScheduleScriptElementIds?: boolean;
  /** If true, [[DisplayStyleSettingsProps.excludedElements]] will be compressed into a single compact string; otherwise they will be expanded into an array of strings.
   * The number of Ids may be quite large, so the compressed format is preferred, especially when communicating between the backend and frontend.
   */
  compressExcludedElementIds?: boolean;
}

/** Options controlling which properties are included or excluded when querying [[RenderTimelineProps]].
 * @see [[ElementLoadOptions.renderTimeline]].
 * @public
 * @extensions
 */
export interface RenderTimelineLoadProps {
  /** If true, the lists of element Ids in the schedule script will be empty.
   * The element Ids can be extremely numerous and are not required on the frontend for display, so they are omitted by default by [DisplayStyleState.load]($frontend).
   */
  omitScriptElementIds?: boolean;
}

/** Options used to specify properties to include or exclude when querying [[ElementProps]] with functions like
 * [IModelDb.Elements.getElementProps]($backend) and [IModelConnection.Elements.loadProps]($frontend).
 * @public
 * @extensions
 */
export interface ElementLoadOptions {
  /** if true, only load the members of [[ElementProps]], and no members from subclasses */
  onlyBaseProperties?: boolean;
  /** If true, include the [[GeometryStreamProps]] for [[GeometricElementProps]] and [[GeometryPartProps]].
   * Geometry streams can consist of many megabytes worth of JSON, so they are omitted by default.
   */
  wantGeometry?: boolean;
  /** When including a geometry stream containing brep entries, whether to return the raw brep data or proxy geometry, false when undefined */
  /** If true, include [[BRepEntity.DataProps.data]] in the [[GeometryStreamProps]] for [[GeometricElementProps]] and [[GeometryPartProps]].
   * The data is a potentially large base-64-encoded opaque binary blob that cannot be directly inspected or manipulated on the frontend, so it is omitted by default.
   */
  wantBRepData?: boolean;
  /** Options controlling which properties of [[DisplayStyleProps]] to include or exclude. */
  displayStyle?: DisplayStyleLoadProps;
  /** Options controlling which properties of [[RenderTimelineProps]] to include or exclude. */
  renderTimeline?: RenderTimelineLoadProps;
}

/** Parameters to specify what element to load for functions like [IModelDb.Elements.getElementProps]($backend).
 * @public
 * @extensions
 */
export interface ElementLoadProps extends ElementLoadOptions {
  id?: Id64String;
  /** The properties of the Code of the element to load.
   * @note the Value member is required even though it is not declared so here. If no value is supplied, no element will ever be loaded.
   * TODO: change to Required<CodeProps> in Version 4.0
   */
  code?: CodeProps;
  federationGuid?: GuidString;
}

/** Properties of an [ElementAspect]($backend)
 * @public
 * @extensions
 */
export interface ElementAspectProps extends EntityProps {
  element: RelatedElementProps;
}

/** Properties of an [ExternalSourceAspect]($backend) that stores synchronization information for an element originating from an external source.
 * @public
 * @extensions
 */
export interface ExternalSourceAspectProps extends ElementAspectProps {
  /** An element that scopes the combination of `kind` and `identifier` to uniquely identify the object from the external source.
   * @note Warning: in a future major release the `scope` property will be optional, since the scope is intended to be potentially invalid.
   *       all references should treat it as potentially undefined, but we cannot change the type yet since that is a breaking change.
   */
  scope: RelatedElementProps;
  /** The identifier of the object in the source repository. */
  identifier: string;
  /** The kind of object within the source repository. */
  kind: string;
  /** An optional value that is typically a version number or a pseudo version number like last modified time.
   * It will be used by the synchronization process to detect that a source object is unchanged so that computing a cryptographic hash can be avoided.
   * If present, this value must be guaranteed to change when any of the source object's content changes.
   */
  version?: string;
  /** The optional cryptographic hash (any algorithm) of the source object's content. If defined, it must be guaranteed to change when the source object's content changes. */
  checksum?: string;
  /** A place where additional JSON properties can be stored. For example, provenance information or properties relating to the synchronization process.
   * @note Warning: if defined, jsonProperties must be a *string*, specifically a valid JSON string.
   * @note Warning: in a future major release, the type of `jsonProperties` will be changed to object, and itwin.js will automatically stringify it when writing to the iModel.
   * This will be a breaking change, since application code will have to change from supplying a string to supplying an object.
  */
  jsonProperties?: any;
  /** The source of the imported/synchronized object. Should point to an instance of [ExternalSource]($backend). */
  source?: RelatedElementProps;
}

/** Properties of an [ExternalSource]($backend)
 * @beta
 */
export interface ExternalSourceProps extends ElementProps {
  repository?: RelatedElementProps;
  connectorName?: string;
  connectorVersion?: string;
}

/** The role that an attached [ExternalSource]($backend) plays.
 * @beta
 */
export enum ExternalSourceAttachmentRole {
  /** The attached [ExternalSource]($backend) provides context. */
  SpecifyContext = 0,
  /** The attached [ExternalSource]($backend) models a part of the whole. */
  SpecifyPart = 1,
}

/** Properties of an [ExternalSourceAttachment]($backend)
 * @beta
 */
export interface ExternalSourceAttachmentProps extends ElementProps {
  attaches?: RelatedElementProps;
  role?: ExternalSourceAttachmentRole;
  translation?: XYZProps;
  yaw?: number;
  pitch?: number;
  roll?: number;
  scale?: XYZProps;
}

/** Properties of an [ChannelRootAspect]($backend) that identifies an Element as the root of a *channel* which is a subset of the overall iModel hierarchy that is independently maintained.
 * @public
 * @extensions
 */
export interface ChannelRootAspectProps extends ElementAspectProps {
  /** The owner of the channel */
  owner: string;
}

/** Properties of a [LineStyle]($backend)
 * @public
 * @extensions
 */
export interface LineStyleProps extends DefinitionElementProps {
  description?: string;
  /** The JSON string line style definition element data [LineStyleDefinition.StyleProps]($backend) */
  data: string;
}

/** Properties of a [LightLocation]($backend)
 * @internal
 */
export interface LightLocationProps extends GeometricElement3dProps {
  enabled?: boolean;
}

/** The *rank* for a Category
 * @public
 * @extensions
 */
export enum Rank {
  /** This category is predefined by the system */
  System = 0,
  /** This category is defined by a schema. Elements in this category are not recognized by system classes. */
  Domain = 1,
  /** This category is defined by an application. Elements in this category are not recognized by system and schema classes. */
  Application = 2,
  /** This category is defined by a user. Elements in this category are not recognized by system, schema, and application classes. */
  User = 3,
}

/** Parameters of a [Category]($backend)
 * @public
 * @extensions
 */
export interface CategoryProps extends DefinitionElementProps {
  rank?: Rank;
  description?: string;
}

/** Parameters of a [SubCategory]($backend)
 * @public
 * @extensions
 */
export interface SubCategoryProps extends DefinitionElementProps {
  appearance?: SubCategoryAppearance.Props;
  description?: string;
}

/** Parameters of a [UrlLink]($backend)
 * @public
 * @extensions
 */
export interface UrlLinkProps extends ElementProps {
  description?: string;
  url?: string;
}

/** Parameters of a [RepositoryLink]($backend)
 * @public
 * @extensions
 */
export interface RepositoryLinkProps extends UrlLinkProps {
  repositoryGuid?: GuidString;
  format?: string;
}

/** The properties of a [SynchronizationConfigLink]($backend)
 * @beta
 */
export interface SynchronizationConfigLinkProps extends UrlLinkProps {
  lastSuccessfulRun?: string;
}

/** Wire format describing a [RenderTimeline]($backend).
 * @public
 * @extensions
 */
export interface RenderTimelineProps extends ElementProps {
  /** An optional human-readable description of the timeline. */
  description?: string;
  /** The stringified JSON representation of the instructions for visualizing change over time.
   * @see [[RenderSchedule.ScriptProps]] for the JSON interface.
   */
  script: string;
}
