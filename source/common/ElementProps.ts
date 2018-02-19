/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { Id64, Id64Props, GuidProps } from "@bentley/bentleyjs-core/lib/Id";
import { CodeProps, Code } from "./Code";
import { EntityProps } from "./EntityProps";
import { GeometryStream } from "./geometry/GeometryStream";
import { XYZProps, XYProps, YawPitchRollProps, LowAndHighXYZ, LowAndHighXY } from "@bentley/geometry-core/lib/PointVector";
import { AngleProps } from "@bentley/geometry-core/lib/Geometry";

/** The shape of a Navigation property value. Note that the internal properties are defined by the iModelJs JSON wire format and must not be changed. */
export interface RelatedElementProps {
  id: Id64Props;
  relClassName?: string;
}

/** The properties that define an Element */
export interface ElementProps extends EntityProps {
  model?: Id64Props;
  code?: CodeProps;
  parent?: RelatedElementProps;
  federationGuid?: GuidProps;
  userLabel?: string;
  jsonProperties?: any;
}

/** The Id and relationship class of an Element that is related to another Element */
export class RelatedElement implements RelatedElementProps {
  public readonly id: Id64;
  public readonly relClassName?: string;
  constructor(props: RelatedElementProps) { this.id = Id64.fromJSON(props.id); this.relClassName = props.relClassName; }
  public static fromJSON(json?: RelatedElementProps): RelatedElement | undefined { return json ? new RelatedElement(json) : undefined; }
}

/** A RelatedElement that describes the type definition of an element. */
export class TypeDefinition extends RelatedElement {
}

/** Properties of a GeometricElement */
export interface GeometricElementProps extends ElementProps {
  category: Id64Props;
  geom?: GeometryStream;
}

export interface Placement3dProps {
  origin: XYZProps;
  angles: YawPitchRollProps;
  bbox: LowAndHighXYZ;
}

export interface Placement2dProps {
  origin: XYProps;
  angle: AngleProps;
  bbox: LowAndHighXY;
}

/** Properties that define a GeometricElement3d */
export interface GeometricElement3dProps extends GeometricElementProps {
  placement: Placement3dProps;
  typeDefinition?: RelatedElementProps;
}

/** Properties that define a GeometricElement2d */
export interface GeometricElement2dProps extends GeometricElementProps {
  placement: Placement2dProps;
  typeDefinition?: RelatedElementProps;
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
export interface ElementLoadParams {
  id?: Id64Props;
  code?: Code;
  federationGuid?: GuidProps;
  /** if true, do not load the geometry of the element */
  noGeometry?: boolean;
}

/** ElementAspectProps */
export interface ElementAspectProps extends EntityProps {
  id: Id64Props;
  element: Id64Props;
}

export interface LightLocationProps extends GeometricElement3dProps {
  enabled?: boolean;
}
