/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module BisCore */

import { Id64, Id64Props, GuidProps } from "@bentley/bentleyjs-core";
import { CodeProps } from "./Code";
import { EntityProps } from "./EntityProps";
import { AngleProps, XYZProps, XYProps, YawPitchRollProps, LowAndHighXYZ, LowAndHighXY } from "@bentley/geometry-core";
import { IModelError, IModelStatus } from "./IModelError";
import { GeometryStreamProps } from "./geometry/GeometryStream";
import { Rank, AppearanceProps } from "./SubCategoryAppearance";

/** The iModelJson properties of an ECNavigationProperty in a BIS schema. */
export interface RelatedElementProps {
  id: Id64Props;
  relClassName?: string;
}

/** The iModelJson properties of a BIS Element */
export interface ElementProps extends EntityProps {
  model?: Id64Props | RelatedElementProps;
  code?: CodeProps;
  parent?: RelatedElementProps;
  federationGuid?: GuidProps;
  userLabel?: string;
  jsonProperties?: any;
}

/** The Id and relationship class of an Element that is somehow related to another Element */
export class RelatedElement implements RelatedElementProps {
  public readonly id: Id64;
  public readonly relClassName?: string;
  constructor(props: RelatedElementProps) { this.id = Id64.fromJSON(props.id); this.relClassName = props.relClassName; }
  public static fromJSON(json?: RelatedElementProps): RelatedElement | undefined { return json ? new RelatedElement(json) : undefined; }

  /** accept the value of a navigation property that might be in the shortened format of just an id or might be in the full RelatedElement format. */
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

/** A RelatedElement that describes the type definition of an element. */
export class TypeDefinition extends RelatedElement {
}

/** Properties of a GeometricElement */
export interface GeometricElementProps extends ElementProps {
  category: Id64Props;
  geom?: GeometryStreamProps;
}

export interface Placement3dProps {
  origin: XYZProps;
  angles: YawPitchRollProps;
  bbox?: LowAndHighXYZ;
}

export interface Placement2dProps {
  origin: XYProps;
  angle: AngleProps;
  bbox?: LowAndHighXY;
}

/** Properties that define a GeometricElement3d */
export interface GeometricElement3dProps extends GeometricElementProps {
  placement?: Placement3dProps;
  typeDefinition?: RelatedElementProps;
}

/** Properties that define a GeometricElement2d */
export interface GeometricElement2dProps extends GeometricElementProps {
  placement?: Placement2dProps;
  typeDefinition?: RelatedElementProps;
}

/** Properties of a GeometryPart */
export interface GeometryPartProps extends ElementProps {
  geom?: GeometryStreamProps;
  bbox?: LowAndHighXYZ;
}

export interface ViewAttachmentProps extends GeometricElement2dProps {
  view?: Id64Props;
}

export interface SubjectProps extends ElementProps {
  description?: string;
}

export interface SheetBorderTemplateProps extends ElementProps {
  height?: number;
  width?: number;
}

export interface SheetTemplateProps extends ElementProps {
  height?: number;
  width?: number;
  border?: Id64Props;
}

export interface SheetProps extends ElementProps {
  scale?: number;
  height?: number;
  width?: number;
  sheetTemplate?: Id64Props;
}

export interface DefinitionElementProps extends ElementProps {
  isPrivate?: boolean;
}

export interface TypeDefinitionElementProps extends DefinitionElementProps {
  recipe?: RelatedElementProps;
}

export interface InformationPartitionElementProps extends DefinitionElementProps {
  description?: string;
}

/** Parameters to specify what element to load. */
export interface ElementLoadProps {
  id?: Id64Props;
  code?: CodeProps;
  federationGuid?: GuidProps;
  /** Whether to include geometry stream in GeometricElementProps and GeometryPartProps, false when undefined */
  wantGeometry?: boolean;
  /** When including a geometry stream containing brep entries, whether to return the raw brep data or proxy geometry, false when undefined */
  wantBRepData?: boolean;
}

/** ElementAspectProps */
export interface ElementAspectProps extends EntityProps {
  id: Id64Props;
  element: Id64Props;
}

export interface LineStyleProps extends ElementProps {
  description?: string;
  data: string;
}

export interface LightLocationProps extends GeometricElement3dProps {
  enabled?: boolean;
}

/** Parameters to create a Category element */
export interface CategoryProps extends ElementProps {
  rank?: Rank;
  description?: string;
}

/** Parameters to create a SubCategory element */
export interface SubCategoryProps extends ElementProps {
  appearance?: AppearanceProps;
  description?: string;
}
