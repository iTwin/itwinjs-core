/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { Id64, Guid } from "@bentley/bentleyjs-core/lib/Id";
import { Transform, Point2d, Point3d } from "@bentley/geometry-core/lib/PointVector";
import { Code } from "../common/Code";
import { Placement3d, Placement2d, AxisAlignedBox3d } from "../common/geometry/Primitives";
import { GeometryStream, GeometryBuilder } from "../common/geometry/GeometryStream";
import { Entity, EntityMetaData } from "./Entity";
import { IModelDb } from "./IModelDb";
import { DbOpcode } from "@bentley/bentleyjs-core/lib/BeSQLite";
import { BriefcaseManager } from "./BriefcaseManager";
import {
  ElementProps, RelatedElement, GeometricElementProps, TypeDefinition, GeometricElement3dProps, GeometricElement2dProps,
  ViewAttachmentProps, SubjectProps, SheetBorderTemplateProps, SheetTemplateProps, SheetProps, TypeDefinitionElementProps,
  InformationPartitionElementProps, AuxCoordSystemProps, AuxCoordSystem2dProps, AuxCoordSystem3dProps, LightLocationProps,
} from "../common/ElementProps";

/**
 * Elements are the smallest individually identifiable building blocks for modeling the real world in an iModel.
 * Each element represents an entity in the real world. Sets of Elements (contained in Models) are used to model
 * other Elements that represent larger scale real world entities. Using this recursive modeling strategy,
 * Elements can represent entities at any scale. Elements can represent physical things or abstract concepts
 * or simply be information records.
 */
export abstract class Element extends Entity implements ElementProps {
  public model: Id64;
  public code: Code;
  public parent?: RelatedElement;
  public federationGuid?: Guid;
  public userLabel?: string;
  public jsonProperties: any;

  /** constructor for Element. */
  constructor(props: ElementProps, iModel: IModelDb) {
    super(props, iModel);
    this.id = Id64.fromJSON(props.id);
    this.code = Code.fromJSON(props.code);
    this.model = Id64.fromJSON(props.model);
    this.parent = RelatedElement.fromJSON(props.parent);
    this.federationGuid = Guid.fromJSON(props.federationGuid);
    this.userLabel = props.userLabel;
    this.jsonProperties = Object.assign({}, props.jsonProperties); // make sure we have our own copy
  }

  /** Add this Element's properties to an object for serializing to JSON. */
  public toJSON(): ElementProps {
    const val = super.toJSON() as ElementProps;
    if (this.id.isValid())
      val.id = this.id;
    if (this.code.spec.isValid())
      val.code = this.code;
    val.model = this.model;
    if (this.parent)
      val.parent = this.parent;
    if (this.federationGuid)
      val.federationGuid = this.federationGuid;
    if (this.userLabel)
      val.userLabel = this.userLabel;
    if (Object.keys(this.jsonProperties).length > 0)
      val.jsonProperties = this.jsonProperties;
    return val;
  }

  /** Get the class metadata for this element. */
  public getClassMetaData(): EntityMetaData | undefined { return this.iModel.classMetaDataRegistry.find(this.classFullName); }

  private getAllUserProperties(): any { if (!this.jsonProperties.UserProps) this.jsonProperties.UserProps = new Object(); return this.jsonProperties.UserProps; }

  /** get a set of JSON user properties by namespace */
  public getUserProperties(namespace: string) { return this.getAllUserProperties()[namespace]; }

  /** change a set of user JSON properties of this Element by namespace. */
  public setUserProperties(nameSpace: string, value: any) { this.getAllUserProperties()[nameSpace] = value; }

  /** remove a set of JSON user properties, specified by namespace, from this Element */
  public removeUserProperties(nameSpace: string) { delete this.getAllUserProperties()[nameSpace]; }

 /**
  * Add the lock, code, and other resource requests that would be needed in order to carry out the specified operation.
  * @param req The request object, which accumulates requests.
  * @param opcode The operation that will be performed on the element.
  */
  public buildResourcesRequest(req: BriefcaseManager.ResourcesRequest, opcode?: DbOpcode): void {
    if (opcode === undefined) {
      if (this.id === undefined)
        opcode = DbOpcode.Insert;
      else
        opcode = DbOpcode.Delete;
    }
    this.iModel.buildResourcesRequestForElement(req, this, opcode);
  }
}

/**
 * Geometric Element is an abstract base class used to model real world entities that intrinsically have
 * geometry.
 */
export abstract class GeometricElement extends Element implements GeometricElementProps {
  public category: Id64;
  public geom?: GeometryStream;
  public constructor(props: GeometricElementProps, iModel: IModelDb) {
    super(props, iModel);
    this.category = Id64.fromJSON(props.category);
    this.geom = GeometryStream.fromJSON(props.geom);
  }

  public abstract calculateRange3d(): AxisAlignedBox3d;
  public is3d(): this is GeometricElement3d { return false; }
  public is2d(): this is GeometricElement2d { return false; }

  public getPlacementTransform(): Transform {
    const source3d = this.getAsGeometricElement3d();
    return (source3d !== undefined) ? source3d.getPlacement().getTransform() : this.getAsGeometricElement2d()!.getPlacement().getTransform();
  }

  /** convert this geometric element to a JSON object */
  public toJSON(): GeometricElementProps {
    const val = super.toJSON() as GeometricElementProps;
    val.category = this.category;
    if (this.geom)
      val.geom = this.geom;
    return val;
  }

  public updateFromGeometryBuilder(builder: GeometryBuilder): boolean {
    if (builder.isPartCreate)
      return false;   // Invalid builder for creating element geometry...

    if (builder.currentSize === 0)
      return false;

    if (!builder.havePlacement)
      return false;

    if (!this.category.equals(builder.geometryParams.categoryId))
      return false;

    // const el = this.toElement();

    // if (el === undefined || (el !== undefined && ))
    //  return false;

    if (builder.is3d) {
      if (!builder.placement3d.isValid())
        return false;

      if (!(this instanceof GeometricElement3d))
        return false;

      this.placement.setFrom(builder.placement3d);
    } else {
      if (!builder.placement2d.isValid())
        return false;

      if (!(this instanceof GeometricElement2d))
        return false;

      this.placement.setFrom(builder.placement2d);
    }

    if (this.geom)
      this.geom.setFrom(builder.getRawData());
    else
      this.geom = builder.getGeometryStreamClone();
    return true;
  }
}

/**
 * 3d Geometric Element is an abstract base class used to model real world entities that intrinsically
 * have 3d geometry.
 */
export abstract class GeometricElement3d extends GeometricElement implements GeometricElement3dProps {
  public placement: Placement3d;
  public typeDefinition?: TypeDefinition;

  public constructor(props: GeometricElement3dProps, iModel: IModelDb) {
    super(props, iModel);
    this.placement = Placement3d.fromJSON(props.placement);
    if (props.typeDefinition)
      this.typeDefinition = TypeDefinition.fromJSON(props.typeDefinition);
  }

  public calculateRange3d(): AxisAlignedBox3d { return this.placement.calculateRange(); }
  public is3d(): this is GeometricElement3d { return true; }

  public toJSON(): GeometricElement3dProps {
    const val = super.toJSON() as GeometricElement3dProps;
    val.placement = this.placement;
    if (this.typeDefinition)
      val.typeDefinition = this.typeDefinition;
    return val;
  }
}

export abstract class GraphicalElement3d extends GeometricElement3d {
  public constructor(props: GeometricElement3dProps, iModel: IModelDb) { super(props, iModel); }
}

/**
 * 2d Geometric Element is an abstract base class used to model information entities that intrinsically have
 * 2d geometry.
 */
export abstract class GeometricElement2d extends GeometricElement implements GeometricElement2dProps {
  public placement: Placement2d;
  public typeDefinition?: TypeDefinition;

  public constructor(props: GeometricElement2dProps, iModel: IModelDb) {
    super(props, iModel);
    this.placement = Placement2d.fromJSON(props.placement);
    if (props.typeDefinition)
      this.typeDefinition = TypeDefinition.fromJSON(props.typeDefinition);
  }

  public calculateRange3d(): AxisAlignedBox3d { return this.placement.calculateRange(); }
  public is2d(): this is GeometricElement2d { return true; }

  public toJSON(): GeometricElement2dProps {
    const val = super.toJSON() as GeometricElement2dProps;
    val.placement = this.placement;
    if (this.typeDefinition)
      val.typeDefinition = this.typeDefinition;
    return val;
  }
}

/**
 * Abstract base class for 2d Geometric Elements that are used to convey information within graphical presentations
 * (like drawings).
 */
export abstract class GraphicalElement2d extends GeometricElement2d {
  public constructor(props: GeometricElement2dProps, iModel: IModelDb) { super(props, iModel); }
}

/**
 * 2d element used to annotate drawings and sheets.
 */
export class AnnotationElement2d extends GraphicalElement2d {
  public constructor(props: GeometricElement2dProps, iModel: IModelDb) { super(props, iModel); }
}

/**
 * 2d element used to persist graphics for use in drawings.
 */
export class DrawingGraphic extends GraphicalElement2d {
  public constructor(props: GeometricElement2dProps, iModel: IModelDb) { super(props, iModel); }
}

export class TextAnnotation2d extends AnnotationElement2d {
  public constructor(props: GeometricElement2dProps, iModel: IModelDb) { super(props, iModel); }
}

export class TextAnnotation3d extends GraphicalElement3d {
  public constructor(props: GeometricElement3dProps, iModel: IModelDb) { super(props, iModel); }
}

export class ViewAttachment extends GraphicalElement2d implements ViewAttachmentProps {
  public view: RelatedElement;
  public constructor(props: ViewAttachmentProps, iModel: IModelDb) { super(props, iModel); }
}

/**
 * A Spatial Element occupies real world space.
 */
export abstract class SpatialElement extends GeometricElement3d {
  public constructor(props: GeometricElement3dProps, iModel: IModelDb) { super(props, iModel); }
}

/**
 * A Physical Element is spatially located, has mass, and can be 'touched'.
 */
export abstract class PhysicalElement extends SpatialElement {
  public constructor(props: GeometricElement3dProps, iModel: IModelDb) { super(props, iModel); }
}

/**
 * A Physical Portion represents an arbitrary portion of a larger Physical Element that will be broken
 * down in more detail in a separate (sub) Physical Model.
 */
export abstract class PhysicalPortion extends PhysicalElement {
  public constructor(props: GeometricElement3dProps, iModel: IModelDb) { super(props, iModel); }
}

/**
 * A Spatial Location Element identifies a 'tracked' real world location but has no mass and cannot be
 * 'touched'.
 */
export abstract class SpatialLocationElement extends SpatialElement {
  public constructor(props: GeometricElement3dProps, iModel: IModelDb) { super(props, iModel); }
}

/**
 * A Spatial Location Portion represents an arbitrary portion of a larger Spatial Location Element that
 * will be broken down in more detail in a separate (sub) Spatial Location Model.
 */
export abstract class SpatialLocationPortion extends SpatialLocationElement {
  public constructor(props: GeometricElement3dProps, iModel: IModelDb) { super(props, iModel); }
}

/**
 * A Volume Element is a Spatial Location Element that is restricted to defining a volume.
 */
export class VolumeElement extends SpatialLocationElement {
  public constructor(props: GeometricElement3dProps, iModel: IModelDb) { super(props, iModel); }
}

/**
 * Information Content Element is an abstract base class for modeling pure information entities. Only the
 * core framework should directly subclass from Information Content Element. Domain and application developers
 * should start with the most appropriate subclass of Information Content Element.
 */
export abstract class InformationContentElement extends Element {
  constructor(props: ElementProps, iModel: IModelDb) { super(props, iModel); }
}

/**
 * Element used in conjunction with bis:ElementDrivesElement relationships to bundle multiple inputs before
 * driving the output element.
 */
export abstract class DriverBundleElement extends InformationContentElement {
  constructor(props: ElementProps, iModel: IModelDb) { super(props, iModel); }
}

/**
 * Information Reference is an abstract base class for modeling entities whose main purpose is to reference
 * something else.
 */
export abstract class InformationReferenceElement extends InformationContentElement {
  public constructor(props: ElementProps, iModel: IModelDb) { super(props, iModel); }
}

/**
 * A Subject is an information element that describes what this repository (or part thereof) is about.
 */
export class Subject extends InformationReferenceElement implements SubjectProps {
  public description?: string;
  public constructor(props: SubjectProps, iModel: IModelDb) { super(props, iModel); }
}

/** A Document is an InformationContentElement that identifies the content of a document.
 * The realized form of a document is called a DocumentCarrier (different class than Document).
 * For example, a will is a legal document. The will published into a PDF file is an ElectronicDocumentCopy.
 * The will printed onto paper is a PrintedDocumentCopy.
 * In this example, the Document only identifies, names, and tracks the content of the will.
 */
export abstract class Document extends InformationContentElement {
  constructor(props: ElementProps, iModel: IModelDb) { super(props, iModel); }
}

export class Drawing extends Document {
  constructor(props: ElementProps, iModel: IModelDb) { super(props, iModel); }
}

export class SectionDrawing extends Drawing {
  constructor(props: ElementProps, iModel: IModelDb) { super(props, iModel); }
}

export class SheetBorderTemplate extends Document implements SheetBorderTemplateProps {
  public height?: number;
  public width?: number;
  public constructor(props: SheetBorderTemplateProps, iModel: IModelDb) { super(props, iModel); }
}

export class SheetTemplate extends Document implements SheetTemplateProps {
  public height?: number;
  public width?: number;
  public border?: RelatedElement;
  constructor(props: SheetTemplateProps, iModel: IModelDb) { super(props, iModel); }
}

export class Sheet extends Document implements SheetProps {
  public scale?: number;
  public height?: number;
  public width?: number;
  public sheetTemplate?: RelatedElement;
  constructor(props: SheetProps, iModel: IModelDb) { super(props, iModel); }
}

/**
 * An Information Carrier carries information, but is not the information itself. For example, the arrangement
 * of ink on paper or the sequence of electronic bits are information carriers.
 */
export abstract class InformationCarrierElement extends Element {
  constructor(props: ElementProps, iModel: IModelDb) { super(props, iModel); }
}

/**
 * A Document Carrier is an Information Carrier that carries a Document. An electronic file is a good example.
 */
export abstract class DocumentCarrier extends InformationCarrierElement {
  constructor(props: ElementProps, iModel: IModelDb) { super(props, iModel); }
}

/**
 * Information Record Element is an abstract base class for modeling information records. Information Record
 * Element is the default choice if no other subclass of Information Content Element makes sense.
 */
export abstract class InformationRecordElement extends InformationContentElement {
  constructor(props: ElementProps, iModel: IModelDb) { super(props, iModel); }
}

/**
 * A Definition Element holds configuration - related information that is meant to be referenced / shared.
 */
export abstract class DefinitionElement extends InformationContentElement {
  constructor(props: ElementProps, iModel: IModelDb) { super(props, iModel); }
}

/**
 * Defines a set of properties (the 'type') that can be associated with an element.
 */
export abstract class TypeDefinitionElement extends DefinitionElement implements TypeDefinitionElementProps {
  public recipe?: RelatedElement;
  constructor(props: TypeDefinitionElementProps, iModel: IModelDb) { super(props, iModel); }
}

/**
 * Defines a recipe for generating a type.
 */
export abstract class RecipeDefinitionElement extends DefinitionElement {
  constructor(props: ElementProps, iModel: IModelDb) { super(props, iModel); }
}

/**
 * Defines a set of properties (the 'type') that can be associated with a Physical Element. A Physical
 * Type has a strong correlation with something that can be ordered from a catalog since all instances
 * share a common set of properties.
 */
export abstract class PhysicalType extends TypeDefinitionElement {
  constructor(props: TypeDefinitionElementProps, iModel: IModelDb) { super(props, iModel); }
}

/**
 * Defines a set of properties (the 'type') that can be associated with a Spatial Location.
 */
export abstract class SpatialLocationType extends TypeDefinitionElement {
  constructor(props: TypeDefinitionElementProps, iModel: IModelDb) { super(props, iModel); }
}

/**
 * A recipe that uses a 3D template for creating new instances.
 */
export class TemplateRecipe3d extends RecipeDefinitionElement {
  public constructor(props: ElementProps, iModel: IModelDb) { super(props, iModel); }
}

/**
 * Defines a set of properties (the 'type') that can be associated with a 2D Graphical Element.
 */
export abstract class GraphicalType2d extends TypeDefinitionElement {
  public constructor(props: ElementProps, iModel: IModelDb) { super(props, iModel); }
}

/**
 * A recipe that uses a 2D template for creating new instances.
 */
export class TemplateRecipe2d extends RecipeDefinitionElement {
  public constructor(props: ElementProps, iModel: IModelDb) { super(props, iModel); }
}

/**
 * Information Partition is an abstract base class for elements that indicate that there is a new modeling
 * perspective within the overall DgnDb information hierarchy. An Information Partition is always parented
 * to a Subject and broken down by a Model.
 */
export abstract class InformationPartitionElement extends InformationContentElement implements InformationPartitionElementProps {
  public description?: string;
  public constructor(props: InformationPartitionElementProps, iModel: IModelDb) { super(props, iModel); }
}

/**
 * A Definition Partition element indicates that there is a definition-related modeling perspective within
 * the overall DgnDb information hierarchy. A Definition Partition is always parented to a Subject and
 * broken down by a Definition Model.
 */
export class DefinitionPartition extends InformationPartitionElement {
  public constructor(props: InformationPartitionElementProps, iModel: IModelDb) { super(props, iModel); }
}

/**
 * A Document Partition element indicates that there is a document-related modeling perspective within
 * the overall DgnDb information hierarchy. A Document Partition is always parented to a Subject and broken
 * down by a Document List Model.
 */
export class DocumentPartition extends InformationPartitionElement {
  public constructor(props: InformationPartitionElementProps, iModel: IModelDb) { super(props, iModel); }
}

/**
 * A Group Information Partition element indicates that there is a group-information-related modeling perspective
 * within the overall DgnDb information hierarchy. A Group Information Partition is always parented to
 * a Subject and broken down by a Group Information Model.
 */
export class GroupInformationPartition extends InformationPartitionElement {
  public constructor(props: InformationPartitionElementProps, iModel: IModelDb) { super(props, iModel); }
}

/**
 * A Information Record Partition element indicates that there is an information-record-related modeling
 * perspective within the overall DgnDb information hierarchy. An Information Record Partition is always
 * parented to a Subject and broken down by an Information Record Model.
 */
export class InformationRecordPartition extends InformationPartitionElement {
  public constructor(props: InformationPartitionElementProps, iModel: IModelDb) { super(props, iModel); }
}

/**
 * A Link Partition element indicates that there is a link-related modeling perspective within the overall
 * DgnDb information hierarchy. A Link Partition is always parented to a Subject and broken down by a Link
 * Model.
 */
export class LinkPartition extends InformationPartitionElement {
  public constructor(props: InformationPartitionElementProps, iModel: IModelDb) { super(props, iModel); }
}

/**
 * A Physical Partition element indicates that there is a physical modeling perspective within the overall
 * DgnDb information hierarchy. A Physical Partition is always parented to a Subject and broken down by
 * a Physical Model.
 */
export class PhysicalPartition extends InformationPartitionElement {
  public constructor(props: InformationPartitionElementProps, iModel: IModelDb) { super(props, iModel); }
}

/**
 * A Spatial Location Partition element indicates that there is a spatial-location-related modeling perspective
 * within the overall DgnDb information hierarchy. A Spatial Location Partition is always parented to a
 * Subject and broken down by a Spatial Location Model.
 */
export class SpatialLocationPartition extends InformationPartitionElement {
  public constructor(props: InformationPartitionElementProps, iModel: IModelDb) { super(props, iModel); }
}

/**
 * Group Information is an abstract base class for modeling entities whose main purpose is to reference
 * a group of related elements.
 */
export abstract class GroupInformationElement extends InformationReferenceElement {
  public constructor(props: ElementProps, iModel: IModelDb) { super(props, iModel); }
}
/**
 * An information element that specifies a link.
 */
export abstract class LinkElement extends InformationReferenceElement {
  public constructor(props: ElementProps, iModel: IModelDb) { super(props, iModel); }
}

/**
 * An information element that specifies a URL link.
 */
export class UrlLink extends LinkElement {
  public constructor(props: ElementProps, iModel: IModelDb) { super(props, iModel); }
}

/**
 * An information element that links to an embedded file.
 */
export class EmbeddedFileLink extends LinkElement {
  public constructor(props: ElementProps, iModel: IModelDb) { super(props, iModel); }
}

/**
 * An information element that links to a repository.
 */
export class RepositoryLink extends UrlLink {
  public constructor(props: ElementProps, iModel: IModelDb) { super(props, iModel); }
}

/**
 * A real world entity is modeled as a Role Element when a set of external circumstances define an important
 * role (one that is worth tracking) that is not intrinsic to the entity playing the role. For example,
 * a person can play the role of a teacher or a rock can play the role of a boundary marker.
 */
export abstract class RoleElement extends Element {
  public constructor(props: ElementProps, iModel: IModelDb) { super(props, iModel); }
}

export abstract class AuxCoordSystem extends DefinitionElement implements AuxCoordSystemProps {
  public type: number;
  public description: string;
  public constructor(props: AuxCoordSystemProps, iModel: IModelDb) { super(props, iModel); }
}

/**
 * A 2d coordinate system.
 */
export class AuxCoordSystem2d extends AuxCoordSystem implements AuxCoordSystem2dProps {
  public origin: Point2d;
  public angle: number;
  public constructor(props: AuxCoordSystem2dProps, iModel: IModelDb) { super(props, iModel); }
}

/**
 * A 3d coordinate system.
 */
export class AuxCoordSystem3d extends AuxCoordSystem implements AuxCoordSystem3dProps {
  public origin: Point3d;
  public yaw: number;
  public pitch: number;
  public roll: number;
  public constructor(props: AuxCoordSystem3dProps, iModel: IModelDb) { super(props, iModel); }
}

/**
 * A spatial coordinate system.
 */
export class AuxCoordSystemSpatial extends AuxCoordSystem3d {
  public constructor(props: AuxCoordSystem3dProps, iModel: IModelDb) { super(props, iModel); }
}

/**
 * The spatial location of a light source
 */
export class LightLocation extends SpatialLocationElement implements LightLocationProps {
  public enabled: boolean;
  constructor(props: LightLocationProps, iModel: IModelDb) { super(props, iModel); }
}

export class Texture extends DefinitionElement {
  public constructor(props: ElementProps, iModel: IModelDb) { super(props, iModel); }
}
