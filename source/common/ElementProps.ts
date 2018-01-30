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
  model: Id64Props;
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

export interface TypeDefinitionElementProps extends ElementProps {
  recipe?: RelatedElementProps;
}

export interface InformationPartitionElementProps extends ElementProps {
  description?: string;
}

/** properties that define a ModelSelector */
export interface ModelSelectorProps extends ElementProps {
  models: string[];
}

/** properties that define a CategorySelector */
export interface CategorySelectorProps extends ElementProps {
  categories: string[];
}

/** Parameters used to construct a ViewDefinition */
export interface ViewDefinitionProps extends ElementProps {
  categorySelectorId: Id64Props;
  displayStyleId: Id64Props;
  description?: string;
}

/** properties of a camera */
export interface CameraProps {
  lens: AngleProps;
  focusDist: number; // NOTE: this is abbreviated, do not change!
  eye: XYZProps;
}

/** Parameters to construct a ViewDefinition3d */
export interface ViewDefinition3dProps extends ViewDefinitionProps {
  cameraOn: boolean;  // if true, camera is valid.
  origin: XYZProps;    // The lower left back corner of the view frustum.
  extents: XYZProps;   // The extent of the view frustum.
  angles: YawPitchRollProps | undefined;    // Rotation of the view frustum (could be undefined if going RotMatrix -> YawPitchRoll).
  camera: CameraProps;    // The camera used for this view.
}

/** Parameters to construct a SpatialViewDefinition */
export interface SpatialViewDefinitionProps extends ViewDefinition3dProps {
  modelSelectorId: Id64Props;
}

/** Parameters used to construct a ViewDefinition2d */
export interface ViewDefinition2dProps extends ViewDefinitionProps {
  baseModelId: Id64Props;
  origin: XYProps;
  delta: XYProps;
  angle: AngleProps;
}

export interface AuxCoordSystemProps extends ElementProps {
  type?: number;
  description?: string;
}

/**
 * Properties of AuxCoordSystem2d
 * @note angle is stored in degrees
 */
export interface AuxCoordSystem2dProps extends AuxCoordSystemProps {
  origin?: XYProps;
  angle?: number; // in degrees
}

/**
 * Properties of AuxCoordSystem3d
 * @note All angles are stored in degrees
 */
export interface AuxCoordSystem3dProps extends AuxCoordSystemProps {
  origin?: XYZProps;
  yaw?: AngleProps;  // in degrees
  pitch?: AngleProps; // in degrees
  roll?: AngleProps; // in degrees
}

export interface LightLocationProps extends GeometricElement3dProps {
  enabled?: boolean;
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
