/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module WireFormats */

import { Id64, Id64Props, GuidProps } from "@bentley/bentleyjs-core";
import { CodeProps } from "./Code";
import { EntityProps } from "./EntityProps";
import { AngleProps, XYZProps, XYProps, YawPitchRollProps, LowAndHighXYZ, LowAndHighXY } from "@bentley/geometry-core";
import { IModelError, IModelStatus } from "./IModelError";
import { GeometryStreamProps } from "./geometry/GeometryStream";
import { Rank, SubCategoryAppearance } from "./SubCategoryAppearance";

/** Properties of a NavigationProperty. */
export interface RelatedElementProps {
  /** The Id of the element to which this element is related. */
  id: Id64Props;
  /** The full className of the relationship class. */
  relClassName?: string;
}

/** Properties of an [Element]($docs/bis/intro/element-fundamentals) */
export interface ElementProps extends EntityProps {
  /** The Id of the [Model]($docs/bis/intro/model-fundamentals.md) containing this element */
  model: Id64Props;
  /** The [Code]($docs/bis/intro/codes.md) for this element */
  code: CodeProps;
  /** The Parent of this element, if defined. */
  parent?: RelatedElementProps;
  /** A [FederationGuid]($docs/bis/intro/element-fundamentals.md#federationguid) assigned to this element by some other federated database */
  federationGuid?: GuidProps;
  /** A [user-assigned label]($docs/bis/intro/element-fundamentals.md#userlabel) for this element. */
  userLabel?: string;
  /** Optional [json properties]($docs/bis/intro/element-fundamentals.md#jsonproperties) of this element. */
  jsonProperties?: any;
}

/** The Id and relationship class of an Element that is somehow related to another Element */
export class RelatedElement implements RelatedElementProps {
  /** The Id of the element to which this element is related. */
  public readonly id: Id64;
  /** The full className of the relationship class. */
  public readonly relClassName?: string;
  constructor(props: RelatedElementProps) { this.id = Id64.fromJSON(props.id); this.relClassName = props.relClassName; }
  public static fromJSON(json?: RelatedElementProps): RelatedElement | undefined { return json ? new RelatedElement(json) : undefined; }

  /** Accept the value of a navigation property that might be in the shortened format of just an id or might be in the full RelatedElement format. */
  public static idFromJson(json: any): Id64 {
    if ((typeof json === "object") && ("id" in json)) {
      const r = RelatedElement.fromJSON(json);
      if (r === undefined)
        throw new IModelError(IModelStatus.BadArg);
      return r.id;
    }
    return Id64.fromJSON(json);
  }
}

/** A [RelatedElement]($common) relationship that describes the [TypeDefinitionElement]($backend) of an element. */
export class TypeDefinition extends RelatedElement {
}

/** Properties of a [GeometricElement]($backend) */
export interface GeometricElementProps extends ElementProps {
  /** The id of the category for this geometric element. */
  category: Id64Props;
  geom?: GeometryStreamProps;
}

/** Properties of a [[Placement3d]] */
export interface Placement3dProps {
  origin: XYZProps;
  angles: YawPitchRollProps;
  bbox?: LowAndHighXYZ;
}

/** Properties of a [[Placement2d]] */
export interface Placement2dProps {
  origin: XYProps;
  angle: AngleProps;
  bbox?: LowAndHighXY;
}

export type PlacementProps = Placement2dProps | Placement3dProps;

/** Properties that define a [GeometricElement3d]($backend) */
export interface GeometricElement3dProps extends GeometricElementProps {
  placement?: Placement3dProps;
  typeDefinition?: RelatedElementProps;
}

/** Properties that define a [GeometricElement2d]($backend) */
export interface GeometricElement2dProps extends GeometricElementProps {
  placement?: Placement2dProps;
  typeDefinition?: RelatedElementProps;
}

/** Properties of a [GeometryPart]($backend) */
export interface GeometryPartProps extends ElementProps {
  geom?: GeometryStreamProps;
  bbox?: LowAndHighXYZ;
}

/** Properties for a [ViewAttachment]($backend) */
export interface ViewAttachmentProps extends GeometricElement2dProps {
  view: RelatedElementProps;
}

/** Properties of a [Subject]($backend) */
export interface SubjectProps extends ElementProps {
  description?: string;
}

/** Properties of a [SheetBorderTemplate]($backend) */
export interface SheetBorderTemplateProps extends ElementProps {
  height?: number;
  width?: number;
}

/** Properties of a [SheetTemplate]($backend) */
export interface SheetTemplateProps extends ElementProps {
  height?: number;
  width?: number;
  border?: Id64Props;
}

/** Properties of a [Sheet]($backend) */
export interface SheetProps extends ElementProps {
  width?: number;
  height?: number;
  scale?: number;
  sheetTemplate?: Id64Props;
  attachments?: Id64Props[];
}

/** Properties of a [DefinitionElement]($backend) */
export interface DefinitionElementProps extends ElementProps {
  isPrivate?: boolean;
}

/** Properties of a [TypeDefinitionElement]($backend) */
export interface TypeDefinitionElementProps extends DefinitionElementProps {
  recipe?: RelatedElementProps;
}

/** Properties of a [InformationPartitionElement]($backend) */
export interface InformationPartitionElementProps extends DefinitionElementProps {
  description?: string;
}

/** Parameters to specify what element to load for [IModelDb.Elements.getElementProps]($backend). */
export interface ElementLoadProps {
  id?: Id64Props;
  code?: CodeProps;
  federationGuid?: GuidProps;
  /** Whether to include geometry stream in GeometricElementProps and GeometryPartProps, false when undefined */
  wantGeometry?: boolean;
  /** When including a geometry stream containing brep entries, whether to return the raw brep data or proxy geometry, false when undefined */
  wantBRepData?: boolean;
}

/** Properties of an [ElementAspect]($backend) */
export interface ElementAspectProps extends EntityProps {
  element: RelatedElementProps;
}

/** Properties of a [LineStyle]($backend) */
export interface LineStyleProps extends ElementProps {
  description?: string;
  data: string;
}

/** Properties of a [LightLocation]($backend) */
export interface LightLocationProps extends GeometricElement3dProps {
  enabled?: boolean;
}

/** Parameters of a [Category]($backend) */
export interface CategoryProps extends ElementProps {
  rank?: Rank;
  description?: string;
}

/** Parameters of a [SubCategory]($backend) */
export interface SubCategoryProps extends ElementProps {
  appearance?: SubCategoryAppearance.Props;
  description?: string;
}
