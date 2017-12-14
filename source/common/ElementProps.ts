/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { Id64, Guid } from "@bentley/bentleyjs-core/lib/Id";
import { CodeProps, Code } from "./Code";
import { EntityProps } from "./EntityProps";
import { GeometryStream } from "./geometry/GeometryStream";
import { Placement3dProps, Placement2d } from "./geometry/Primitives";
import { XAndY, XYAndZ } from "@bentley/geometry-core/lib/PointVector";

export interface RelatedElementProps {
  id: Id64 | string;
  relClass?: string;
}

/** The properties that define an Element */
export interface ElementProps extends EntityProps {
  model: Id64 | string;
  code: CodeProps;
  parent?: RelatedElementProps;
  federationGuid?: Guid | string;
  userLabel?: string;
  jsonProperties?: any;
}

/** The Id and relationship class of an Element that is related to another Element */
export class RelatedElement implements RelatedElementProps {
  public readonly id: Id64;
  public readonly relClass?: string;
  constructor(props: RelatedElementProps) { this.id = Id64.fromJSON(props.id); this.relClass = props.relClass; }
  public static fromJSON(json?: any): RelatedElement | undefined {
    return json ? new RelatedElement(json) : undefined;
  }
}
/** A RelatedElement that describes the type definition of an element. */
export class TypeDefinition extends RelatedElement {
}

/** Properties of a GeometricElement */
export interface GeometricElementProps extends ElementProps {
  category: Id64 | string;
  geom?: GeometryStream;
}

/** Properties that define a GeometricElement3d */
export interface GeometricElement3dProps extends GeometricElementProps {
  placement: Placement3dProps;
  typeDefinition?: RelatedElementProps;
}

/** Properties that define a GeometricElement2d */
export interface GeometricElement2dProps extends GeometricElementProps {
  placement: Placement2d;
  typeDefinition?: TypeDefinition;
}

export interface ViewAttachmentProps extends GeometricElement2dProps {
  view?: Id64 | string;
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
  border?: Id64 | string;
}

export interface SheetProps extends ElementProps {
  scale?: number;
  height?: number;
  width?: number;
  sheetTemplate?: Id64 | string;
}

export interface TypeDefinitionElementProps extends ElementProps {
  recipe?: RelatedElementProps;
}

export interface InformationPartitionElementProps extends ElementProps {
  description?: string;
}

export interface AuxCoordSystemProps extends ElementProps {
  type?: number;
  description?: string;
}

export interface AuxCoordSystem2dProps extends AuxCoordSystemProps {
  origin?: XAndY | string;
  angle?: number;
}

export interface AuxCoordSystem3dProps extends AuxCoordSystemProps {
  origin?: XYAndZ | string;
  yaw?: number;
  pitch?: number;
  roll?: number;
}

export interface LightLocationProps extends GeometricElement3dProps {
  enabled?: boolean;
}

/** Parameters to specify what element to load. */
export interface ElementLoadParams {
  id?: Id64 | string;
  code?: Code;
  federationGuid?: string;
  /** if true, do not load the geometry of the element */
  noGeometry?: boolean;
}

/** ElementAspectProps */
export interface ElementAspectProps extends EntityProps {
  id: Id64 | string;
  element: Id64 | string;
}
