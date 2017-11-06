/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { Id64, Guid } from "@bentley/bentleyjs-core/lib/Id";
import { Code } from "../common/Code";
import { GeometryStream, Placement3d, Placement2d } from "../common/ElementGeometry";
import { ElementProps, RelatedElement } from "../common/ElementProps";
import { Entity, EntityMetaData } from "./Entity";
import { IModelDb } from "./IModelDb";

/** Parameters to specify what element to load. */
export interface ElementLoadParams {
  id?: Id64 | string;
  code?: Code;
  federationGuid?: string;
  /** if true, do not load the geometry of the element */
  noGeometry?: boolean;
}

/** An element within an iModel. */
export class Element extends Entity implements ElementProps {
  public model: Id64;
  public code: Code;
  public parent?: RelatedElement;
  public federationGuid?: Guid;
  public userLabel?: string;
  public jsonProperties: any;

  /** constructor for Element. */
  constructor(props: ElementProps, iModel: IModelDb) {
    super(props, iModel);
    this.id = new Id64(props.id);
    this.code = new Code(props.code);
    this.model = new Id64(props.model);
    this.parent = RelatedElement.fromJSON(props.parent);
    this.federationGuid = Guid.fromJson(props.federationGuid);
    this.userLabel = props.userLabel;
    this.jsonProperties = Object.assign({}, props.jsonProperties); // make sure we have our own copy
  }

  /** Add all custom-handled properties to a json object. */
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
}

/** Properties of a GeometricElement */
export interface GeometricElementProps extends ElementProps {
  category: Id64 | string;
  geom?: GeometryStream;
}

/** A Geometric element. All geometry held by a GeometricElement is positioned relative to its placement. */
export class GeometricElement extends Element implements GeometricElementProps {
  public category: Id64;
  public geom?: GeometryStream;
  public constructor(props: GeometricElementProps, iModel: IModelDb) {
    super(props, iModel);
    this.category = new Id64(props.category);
    this.geom = GeometryStream.fromJSON(props.geom);
  }

  /** convert this geometric element to a JSON object */
  public toJSON(): GeometricElementProps {
    const val = super.toJSON() as GeometricElementProps;
    val.category = this.category;
    if (this.geom)
      val.geom = this.geom;
    return val;
  }
}

/** A RelatedElement that describes the type definition of an element. */
export class TypeDefinition extends RelatedElement {
  constructor(definitionId: Id64, relationshipClass?: string) { super(definitionId, relationshipClass); }
}

/** Properties that define a GeometricElement3d */
export interface GeometricElement3dProps extends GeometricElementProps {
  placement: Placement3d;
  typeDefinition?: TypeDefinition;
}

/** A Geometric 3d element. */
export class GeometricElement3d extends GeometricElement implements GeometricElement3dProps {
  public placement: Placement3d;
  public typeDefinition?: TypeDefinition;

  public constructor(props: GeometricElement3dProps, iModel: IModelDb) {
    super(props, iModel);
    this.placement = Placement3d.fromJSON(props.placement);
    if (props.typeDefinition)
      this.typeDefinition = TypeDefinition.fromJSON(props.typeDefinition);
  }

  public toJSON(): GeometricElement3dProps {
    const val = super.toJSON() as GeometricElement3dProps;
    val.placement = this.placement;
    if (this.typeDefinition)
      val.typeDefinition = this.typeDefinition;
    return val;
  }
}

/** Properties that define a GeometricElement2d */
export interface GeometricElement2dProps extends GeometricElementProps {
  placement: Placement2d;
  typeDefinition?: TypeDefinition;
}

/** A Geometric 2d element. */
export class GeometricElement2d extends GeometricElement implements GeometricElement2dProps {
  public placement: Placement2d;
  public typeDefinition?: TypeDefinition;

  public constructor(props: GeometricElement2dProps, iModel: IModelDb) {
    super(props, iModel);
    this.placement = Placement2d.fromJSON(props.placement);
    if (props.typeDefinition)
      this.typeDefinition = TypeDefinition.fromJSON(props.typeDefinition);
  }

  public toJSON(): GeometricElement2dProps {
    const val = super.toJSON() as GeometricElement2dProps;
    val.placement = this.placement;
    if (this.typeDefinition)
      val.typeDefinition = this.typeDefinition;
    return val;
  }
}

export class SpatialElement extends GeometricElement3d {
  public constructor(props: GeometricElement3dProps, iModel: IModelDb) { super(props, iModel); }
}

export class PhysicalElement extends SpatialElement {
  public constructor(props: GeometricElement3dProps, iModel: IModelDb) { super(props, iModel); }
}

export class PhysicalPortion extends PhysicalElement {
  public constructor(props: GeometricElement3dProps, iModel: IModelDb) { super(props, iModel); }
}

/** A SpatialElement that identifies a tracked real word 3-dimensional location but has no mass and cannot be touched.
 *  Examples include grid lines, parcel boundaries, and work areas.
 */
export class SpatialLocationElement extends SpatialElement {
  public constructor(props: GeometricElement3dProps, iModel: IModelDb) { super(props, iModel); }
}

/** A SpatialLocationPortion represents an arbitrary portion of a larger SpatialLocationElement that will be broken down in
 *  more detail in a separate (sub) SpatialLocationModel.
 */
export class SpatialLocationPortion extends SpatialLocationElement {
  public constructor(props: GeometricElement3dProps, iModel: IModelDb) { super(props, iModel); }
}

/** An InformationContentElement identifies and names information content.
 * @see InformationCarrierElement
 */
export class InformationContentElement extends Element {
  constructor(props: ElementProps, iModel: IModelDb) { super(props, iModel); }
}

export class InformationReferenceElement extends InformationContentElement {
  public constructor(props: ElementProps, iModel: IModelDb) { super(props, iModel); }
}

export class Subject extends InformationReferenceElement {
  public constructor(props: ElementProps, iModel: IModelDb) { super(props, iModel); }
}

/** A Document is an InformationContentElement that identifies the content of a document.
 * The realized form of a document is called a DocumentCarrier (different class than Document).
 * For example, a will is a legal document. The will published into a PDF file is an ElectronicDocumentCopy.
 * The will printed onto paper is a PrintedDocumentCopy.
 * In this example, the Document only identifies, names, and tracks the content of the will.
 */
export class Document extends InformationContentElement {
  constructor(props: ElementProps, iModel: IModelDb) { super(props, iModel); }
}

export class Drawing extends Document {
  constructor(props: ElementProps, iModel: IModelDb) { super(props, iModel); }
}

export class SectionDrawing extends Drawing {
  constructor(props: ElementProps, iModel: IModelDb) { super(props, iModel); }
}

/** An InformationCarrierElement is a proxy for an information carrier in the physical world.
 *  For example, the arrangement of ink on a paper document or an electronic file is an information carrier.
 *  The content is tracked separately from the carrier.
 *  @see InformationContentElement
 */
export class InformationCarrierElement extends Element {
  constructor(props: ElementProps, iModel: IModelDb) { super(props, iModel); }
}

/** An information element whose main purpose is to hold an information record. */
export class InformationRecordElement extends InformationContentElement {
  constructor(props: ElementProps, iModel: IModelDb) { super(props, iModel); }
}

/** A DefinitionElement resides in (and only in) a DefinitionModel. */
export class DefinitionElement extends InformationContentElement {
  constructor(props: ElementProps, iModel: IModelDb) { super(props, iModel); }
}

export class TypeDefinitionElement extends DefinitionElement {
  public recipe?: RelatedElement;
  constructor(props: ElementProps, iModel: IModelDb) { super(props, iModel); }
}

export class RecipeDefinitionElement extends DefinitionElement {
  constructor(props: ElementProps, iModel: IModelDb) { super(props, iModel); }
}

/** A PhysicalType typically corresponds to a @em type of physical object that can be ordered from a catalog.
 *  The PhysicalType system is also a database normalization strategy because properties that are the same
 *  across all instances are stored with the PhysicalType versus being repeated per PhysicalElement instance.
 */
export class PhysicalType extends TypeDefinitionElement {
  constructor(props: ElementProps, iModel: IModelDb) { super(props, iModel); }
}

/** The SpatialLocationType system is a database normalization strategy because properties that are the same
 *  across all instances are stored with the SpatialLocationType versus being repeated per SpatialLocationElement instance.
 */
export class SpatialLocationType extends TypeDefinitionElement {
  constructor(props: ElementProps, iModel: IModelDb) { super(props, iModel); }
}

export class TemplateRecipe3d extends RecipeDefinitionElement {
  constructor(props: ElementProps, iModel: IModelDb) { super(props, iModel); }
}

export class GraphicalType2d extends TypeDefinitionElement {
  constructor(props: ElementProps, iModel: IModelDb) { super(props, iModel); }
}

export class TemplateRecipe2d extends RecipeDefinitionElement {
  constructor(props: ElementProps, iModel: IModelDb) { super(props, iModel); }
}

export class InformationPartitionElement extends InformationContentElement {
  constructor(props: ElementProps, iModel: IModelDb) { super(props, iModel); }
}

/** A DefinitionPartition provides a starting point for a DefinitionModel hierarchy
 *  @note DefinitionPartition elements only reside in the RepositoryModel
 */
export class DefinitionPartition extends InformationPartitionElement {
  constructor(props: ElementProps, iModel: IModelDb) { super(props, iModel); }
}

/** A DocumentPartition provides a starting point for a DocumentListModel hierarchy
 *  @note DocumentPartition elements only reside in the RepositoryModel
 */
export class DocumentPartition extends InformationPartitionElement {
  constructor(props: ElementProps, iModel: IModelDb) { super(props, iModel); }
}

/** A GroupInformationPartition provides a starting point for a GroupInformationModel hierarchy
 *  @note GroupInformationPartition elements only reside in the RepositoryModel
 */
export class GroupInformationPartition extends InformationPartitionElement {
  constructor(props: ElementProps, iModel: IModelDb) { super(props, iModel); }
}

/** An InformationRecordPartition provides a starting point for a InformationRecordModel hierarchy
 *  @note InformationRecordPartition elements only reside in the RepositoryModel
 */
export class InformationRecordPartition extends InformationPartitionElement {
  constructor(props: ElementProps, iModel: IModelDb) { super(props, iModel); }
}

/** A PhysicalPartition provides a starting point for a PhysicalModel hierarchy
 *  @note PhysicalPartition elements only reside in the RepositoryModel
 */
export class PhysicalPartition extends InformationPartitionElement {
  constructor(props: ElementProps, iModel: IModelDb) { super(props, iModel); }
}

/** A SpatialLocationPartition provides a starting point for a SpatialLocationModel hierarchy
 *  @note SpatialLocationPartition elements only reside in the RepositoryModel
 */
export class SpatialLocationPartition extends InformationPartitionElement {
  constructor(props: ElementProps, iModel: IModelDb) { super(props, iModel); }
}

/** A GroupInformationElement resides in (and only in) a GroupInformationModel. */
export class GroupInformationElement extends InformationReferenceElement {
  constructor(props: ElementProps, iModel: IModelDb) { super(props, iModel); }
}

/** Abstract base class for roles played by other (typically physical) elements.
 *  For example:
 *  - <i>Lawyer</i> and <i>employee</i> are potential roles of a person
 *  - <i>Asset</i> and <i>safety hazard</i> are potential roles of a PhysicalElement
 */
export class RoleElement extends Element {
  constructor(props: ElementProps, iModel: IModelDb) { super(props, iModel); }
}

/** A LinkPartition provides a starting point for a LinkModel hierarchy */
export class LinkPartition extends InformationPartitionElement {
  constructor(props: ElementProps, iModel: IModelDb) { super(props, iModel); }
}
