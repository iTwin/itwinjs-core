/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Elements */

import { Id64, Guid, DbOpcode, JsonUtils } from "@bentley/bentleyjs-core";
import { Transform } from "@bentley/geometry-core";
import { Entity } from "./Entity";
import { IModelDb } from "./IModelDb";
import {
  BisCodeSpec, Code, CodeScopeProps, CodeSpec, Placement3d, Placement2d, AxisAlignedBox3d, GeometryStreamProps, ElementAlignedBox3d,
  ElementProps, RelatedElement, GeometricElementProps, TypeDefinition, GeometricElement3dProps, GeometricElement2dProps,
  SubjectProps, SheetBorderTemplateProps, SheetTemplateProps, SheetProps, TypeDefinitionElementProps,
  InformationPartitionElementProps, DefinitionElementProps, LineStyleProps, GeometryPartProps, EntityMetaData,
} from "@bentley/imodeljs-common";

/**
 * Elements are the smallest individually identifiable building blocks for modeling the real world in an iModel.
 * Each element represents an entity in the real world. Sets of Elements (contained in [[Model]]s) are used to model
 * other Elements that represent larger scale real world entities. Using this recursive modeling strategy,
 * Elements can represent entities at any scale. Elements can represent physical things or abstract concepts
 * or simply be information records.
 *
 * Every Element has a 64-bit id (inherited from Entity) that uniquely identifies it within an iModel. Every Element also
 * has a "code" that identifies its meaning in the real world. Additionally, Elements may have a "federationGuid"
 * to hold a GUID, if the element was assigned that GUID by some other federated database. The iModel database enforces
 * uniqueness of id, code, and federationGuid.
 *
 * See:
 * * [Element Fundamentals]($docs/bis/intro/element-fundamentals.md)
 * * [Working with schemas and elements in TypeScript]($docs/learning/backend/SchemasAndElementsInTypeScript.md)
 * * [Creating elements]($docs/learning/backend/CreateElements.md)
 */
export abstract class Element extends Entity implements ElementProps {
  /** The ModelId of the [Model]($docs/bis/intro/model-fundamentals.md) containing this element */
  public readonly model: Id64;
  /** The [Code]($docs/bis/intro/codes.md) for this element */
  public readonly code: Code;
  /** The parent element, if present, of this element. */
  public parent?: RelatedElement;
  /** A [FederationGuid]($docs/bis/intro/element-fundamentals.md#federationguid) assigned to this element by some other federated database */
  public federationGuid?: Guid;
  /** A [user-assigned label]($docs/bis/intro/element-fundamentals.md#userlabel) for this element. */
  public userLabel?: string;
  /** Optional [json properties]($docs/bis/intro/element-fundamentals.md#jsonproperties) of this element. */
  public readonly jsonProperties: any;

  /** constructor for Element.
   * @hidden
   */
  constructor(props: ElementProps, iModel: IModelDb) {
    super(props, iModel);
    this.code = Code.fromJSON(props.code);
    this.model = RelatedElement.idFromJson(props.model);
    this.parent = RelatedElement.fromJSON(props.parent);
    this.federationGuid = Guid.fromJSON(props.federationGuid);
    this.userLabel = props.userLabel;
    this.jsonProperties = Object.assign({}, props.jsonProperties); // make sure we have our own copy
  }

  /** Add this Element's properties to an object for serializing to JSON.
   * @hidden
   */
  public toJSON(): ElementProps {
    const val = super.toJSON() as ElementProps;
    if (this.id.isValid) val.id = this.id;
    if (this.code.spec.isValid) val.code = this.code;
    val.model = this.model;
    if (this.parent) val.parent = this.parent;
    if (this.federationGuid) val.federationGuid = this.federationGuid;
    if (this.userLabel) val.userLabel = this.userLabel;
    if (Object.keys(this.jsonProperties).length > 0)
      val.jsonProperties = this.jsonProperties;
    return val;
  }

  /** Get the class metadata for this element. */
  public getClassMetaData(): EntityMetaData | undefined { return this.iModel.classMetaDataRegistry.find(this.classFullName); }

  private getAllUserProperties(): any { if (!this.jsonProperties.UserProps) this.jsonProperties.UserProps = new Object(); return this.jsonProperties.UserProps; }

  /** Get a set of JSON user properties by namespace */
  public getUserProperties(namespace: string) { return this.getAllUserProperties()[namespace]; }

  /** Change a set of user JSON properties of this Element by namespace. */
  public setUserProperties(nameSpace: string, value: any) { this.getAllUserProperties()[nameSpace] = value; }

  /** Remove a set of JSON user properties, specified by namespace, from this Element */
  public removeUserProperties(nameSpace: string) { delete this.getAllUserProperties()[nameSpace]; }

  /** Get a JSON property of this element, by namespace */
  public getJsonProperty(nameSpace: string): any { return this.jsonProperties[nameSpace]; }
  public setJsonProperty(nameSpace: string, value: any) { this.jsonProperties[nameSpace] = value; }

  /** Get a display label for this Element. By default returns userLabel if present, otherwise code value. */
  public getDisplayLabel(): string { return this.userLabel ? this.userLabel : this.code.getValue(); }

  /**
   * Get a list of HTML strings that describe this Element for the tooltip. Strings will be listed on separate lines in the tooltip.
   * Any instances of the pattern `%{tag}` will be replaced by the localized value of tag.
   */
  public getToolTipMessage(): string[] {
    const addKey = (key: string) => "<b>%{iModelJs:Element." + key + "}:</b> "; // %{iModelJs:Element.xxx} is replaced with localized value of xxx in frontend.
    const msg: string[] = [];
    const display = this.getDisplayLabel();
    msg.push(display ? display : addKey("Id") + this.id.value + ", " + addKey("Type") + this.className);

    if (this.category)
      msg.push(addKey("Category") + this.iModel.elements.getElement(this.category).getDisplayLabel());

    msg.push(addKey("Model") + this.iModel.elements.getElement(this.model).getDisplayLabel());
    return msg;
  }

  /**
   * Add a request for locks, code reservations, and anything else that would be needed to carry out the specified operation.
   * @param opcode The operation that will be performed on the element.
   */
  public buildConcurrencyControlRequest(opcode: DbOpcode) { this.iModel.concurrencyControl.buildRequestForElement(this, opcode); }
}

/**
 * An abstract base class to model real world entities that intrinsically have geometry.
 */
export abstract class GeometricElement extends Element implements GeometricElementProps {
  /** The Id of the [[Category]] for this GeometricElement. */
  public category: Id64;
  /** The GeometryStream for this GeometricElement. */
  public geom?: GeometryStreamProps;

  /** @hidden */
  public constructor(props: GeometricElementProps, iModel: IModelDb) {
    super(props, iModel);
    this.category = Id64.fromJSON(props.category);
    this.geom = props.geom;
  }

  /** Type guard for instanceof [[GeometricElement3d]] */
  public is3d(): this is GeometricElement3d { return this instanceof GeometricElement3d; }
  /** Type guard for instanceof [[GeometricElement2d]] */
  public is2d(): this is GeometricElement2d { return this instanceof GeometricElement2d; }
  /** Get the [Transform]($geometry) from the Placement of this GeometricElement */
  public getPlacementTransform(): Transform { return this.placement.getTransform(); }
  public calculateRange3d(): AxisAlignedBox3d { return this.placement.calculateRange(); }

  /** convert this geometric element to a JSON object.
   * @hidden
   */
  public toJSON(): GeometricElementProps {
    const val = super.toJSON() as GeometricElementProps;
    val.category = this.category;
    if (this.geom)
      val.geom = this.geom;
    return val;
  }
}

/**
 * An abstract base class to model real world entities that intrinsically have 3d geometry.
 * See [how to create a GeometricElement3d]$(docs/learning/backend/CreateElements.md#GeometricElement3d).
 */
export abstract class GeometricElement3d extends GeometricElement implements GeometricElement3dProps {
  public placement: Placement3d;
  public typeDefinition?: TypeDefinition;

  /** @hidden */
  public constructor(props: GeometricElement3dProps, iModel: IModelDb) {
    super(props, iModel);
    this.placement = Placement3d.fromJSON(props.placement);
    if (props.typeDefinition)
      this.typeDefinition = TypeDefinition.fromJSON(props.typeDefinition);
  }

  /** @hidden */
  public toJSON(): GeometricElement3dProps {
    const val = super.toJSON() as GeometricElement3dProps;
    val.placement = this.placement;
    if (this.typeDefinition)
      val.typeDefinition = this.typeDefinition;
    return val;
  }
}

/** A 3D Graphical Element */
export abstract class GraphicalElement3d extends GeometricElement3d {
  /** @hidden */
  public constructor(props: GeometricElement3dProps, iModel: IModelDb) { super(props, iModel); }
}

/**
 * An abstract base class to model information entities that intrinsically have 2d geometry.
 */
export abstract class GeometricElement2d extends GeometricElement implements GeometricElement2dProps {
  public placement: Placement2d;
  public typeDefinition?: TypeDefinition;

  /** @hidden */
  public constructor(props: GeometricElement2dProps, iModel: IModelDb) {
    super(props, iModel);
    this.placement = Placement2d.fromJSON(props.placement);
    if (props.typeDefinition)
      this.typeDefinition = TypeDefinition.fromJSON(props.typeDefinition);
  }

  /** @hidden */
  public toJSON(): GeometricElement2dProps {
    const val = super.toJSON() as GeometricElement2dProps;
    val.placement = this.placement;
    if (this.typeDefinition)
      val.typeDefinition = this.typeDefinition;
    return val;
  }
}

/**
 * An abstract base class for 2d Geometric Elements that are used to convey information within graphical presentations (like drawings).
 */
export abstract class GraphicalElement2d extends GeometricElement2d {
  /** @hidden */
  public constructor(props: GeometricElement2dProps, iModel: IModelDb) { super(props, iModel); }
}

/**
 * 2d element used to annotate drawings and sheets.
 */
export class AnnotationElement2d extends GraphicalElement2d {
  /** @hidden */
  public constructor(props: GeometricElement2dProps, iModel: IModelDb) { super(props, iModel); }
}

/**
 * 2d element used to persist graphics for use in drawings.
 */
export class DrawingGraphic extends GraphicalElement2d {
  /** @hidden */
  public constructor(props: GeometricElement2dProps, iModel: IModelDb) { super(props, iModel); }
}

/** 2D Text Annotation */
export class TextAnnotation2d extends AnnotationElement2d {
  /** @hidden */
  public constructor(props: GeometricElement2dProps, iModel: IModelDb) { super(props, iModel); }
}

/** 3D Text Annotation */
export class TextAnnotation3d extends GraphicalElement3d {
  /** @hidden */
  public constructor(props: GeometricElement3dProps, iModel: IModelDb) { super(props, iModel); }
}

/**
 * An Element that occupies real world space. Its coordinates are in the project space of its iModel.
 */
export abstract class SpatialElement extends GeometricElement3d {
  /** @hidden */
  public constructor(props: GeometricElement3dProps, iModel: IModelDb) { super(props, iModel); }
}

/**
 * An Element that is spatially located, has mass, and can be 'touched'.
 */
export abstract class PhysicalElement extends SpatialElement {
  /** @hidden */
  public constructor(props: GeometricElement3dProps, iModel: IModelDb) { super(props, iModel); }
}

/**
 * Identifies a *tracked* real world location but has no mass and cannot be *touched*.
 */
export abstract class SpatialLocationElement extends SpatialElement {
  /** @hidden */
  public constructor(props: GeometricElement3dProps, iModel: IModelDb) { super(props, iModel); }
}

/**
 * A Volume Element is a Spatial Location Element that is restricted to defining a volume.
 */
export class VolumeElement extends SpatialLocationElement {
  /** @hidden */
  public constructor(props: GeometricElement3dProps, iModel: IModelDb) { super(props, iModel); }
}

/**
 * Information Content Element is an abstract base class for modeling pure information entities. Only the
 * core framework should directly subclass from Information Content Element. Domain and application developers
 * should start with the most appropriate subclass of Information Content Element.
 */
export abstract class InformationContentElement extends Element {
  /** @hidden */
  constructor(props: ElementProps, iModel: IModelDb) { super(props, iModel); }
}

/**
 * Element used in conjunction with bis:ElementDrivesElement relationships to bundle multiple inputs before
 * driving the output element.
 */
export abstract class DriverBundleElement extends InformationContentElement {
  /** @hidden */
  constructor(props: ElementProps, iModel: IModelDb) { super(props, iModel); }
}

/**
 * Information Reference is an abstract base class for modeling entities whose main purpose is to reference
 * something else.
 */
export abstract class InformationReferenceElement extends InformationContentElement {
  /** @hidden */
  public constructor(props: ElementProps, iModel: IModelDb) { super(props, iModel); }
}

/**
 * A Subject is an information element that describes what this repository (or part thereof) is about.
 * See [how to create a Subject element]$(docs/learning/backend/CreateElements.md#Subject).
 */
export class Subject extends InformationReferenceElement implements SubjectProps {
  public description?: string;
  /** @hidden */
  public constructor(props: SubjectProps, iModel: IModelDb) { super(props, iModel); }
}

/**
 * An InformationContentElement that identifies the content of a document.
 * The realized form of a document is called a DocumentCarrier (different class than Document).
 * For example, a will is a legal document. The will published into a PDF file is an ElectronicDocumentCopy.
 * The will printed onto paper is a PrintedDocumentCopy.
 * In this example, the Document only identifies, names, and tracks the content of the will.
 */
export abstract class Document extends InformationContentElement {
  /** @hidden */
  constructor(props: ElementProps, iModel: IModelDb) { super(props, iModel); }
}

/** A document that represents a drawing, that is, 2-D graphical representation of engineering data. A Drawing element is modelled by a [[DrawingModel]]. */
export class Drawing extends Document {
  /** @hidden */
  constructor(props: ElementProps, iModel: IModelDb) { super(props, iModel); }

  /** Create a Code for a Drawing given a name that is meant to be unique within the scope of the specified DocumentListModel.
   * @param iModel  The IModelDb
   * @param scopeModelId The Id of the DocumentListModel that contains the Drawing and provides the scope for its name.
   * @param codeValue The Drawing name
   */
  public static createCode(iModel: IModelDb, scopeModelId: CodeScopeProps, codeValue: string): Code {
    const codeSpec: CodeSpec = iModel.codeSpecs.getByName(BisCodeSpec.drawing);
    return new Code({ spec: codeSpec.id, scope: scopeModelId, value: codeValue });
  }
}

/**
 * A document that represents a section drawing, that is, 2-D graphical documentation derived from a planar
 * section of some other spatial model. A SectionDrawing element is modelled by a [[SectionDrawingModel]].
 */
export class SectionDrawing extends Drawing {
  /** @hidden */
  constructor(props: ElementProps, iModel: IModelDb) { super(props, iModel); }
}

/** The template for a SheetBorder */
export class SheetBorderTemplate extends Document implements SheetBorderTemplateProps {
  public height?: number;
  public width?: number;
  /** @hidden */
  public constructor(props: SheetBorderTemplateProps, iModel: IModelDb) { super(props, iModel); }
}

/** The template for a [[Sheet]] */
export class SheetTemplate extends Document implements SheetTemplateProps {
  public height?: number;
  public width?: number;
  public border?: Id64;
  /** @hidden */
  constructor(props: SheetTemplateProps, iModel: IModelDb) { super(props, iModel); }
}

/** A digital representation of a *sheet of paper*. Modeled by a [[SheetModel]]. */
export class Sheet extends Document implements SheetProps {
  public height: number;
  public width: number;
  public scale?: number;
  public sheetTemplate?: Id64;
  /** @hidden */
  constructor(props: SheetProps, iModel: IModelDb) {
    super(props, iModel);
    this.height = JsonUtils.asDouble(props.height);
    this.width = JsonUtils.asDouble(props.width);
    this.scale = props.scale;
    this.sheetTemplate = props.sheetTemplate ? new Id64(props.sheetTemplate) : undefined;
  }
}

/**
 * An Information Carrier carries information, but is not the information itself. For example, the arrangement
 * of ink on paper or the sequence of electronic bits are information carriers.
 */
export abstract class InformationCarrierElement extends Element {
  /** @hidden */
  constructor(props: ElementProps, iModel: IModelDb) { super(props, iModel); }
}

/**
 * An Information Carrier that carries a Document. An electronic file is a good example.
 */
export abstract class DocumentCarrier extends InformationCarrierElement {
  /** @hidden */
  constructor(props: ElementProps, iModel: IModelDb) { super(props, iModel); }
}

/**
 * Information Record Element is an abstract base class for modeling information records. Information Record
 * Element is the default choice if no other subclass of Information Content Element makes sense.
 */
export abstract class InformationRecordElement extends InformationContentElement {
  /** @hidden */
  constructor(props: ElementProps, iModel: IModelDb) { super(props, iModel); }
}

/**
 * A Definition Element holds configuration-related information that is meant to be referenced / shared.
 */
export abstract class DefinitionElement extends InformationContentElement implements DefinitionElementProps {
  /** If true, don't show this DefinitionElement in user interface lists. */
  public isPrivate: boolean;
  /** @hidden */
  constructor(props: ElementProps, iModel: IModelDb) { super(props, iModel); this.isPrivate = props.isPrivate; }
  /** @hidden */
  public toJSON(): DefinitionElementProps {
    const val = super.toJSON() as DefinitionElementProps;
    val.isPrivate = this.isPrivate;
    return val;
  }
}

/**
 * Defines a set of properties (the *type*) that may be associated with an element.
 */
export abstract class TypeDefinitionElement extends DefinitionElement implements TypeDefinitionElementProps {
  public recipe?: RelatedElement;
  /** @hidden */
  constructor(props: TypeDefinitionElementProps, iModel: IModelDb) { super(props, iModel); }
}

/**
 * Defines a recipe for generating a *type*.
 */
export abstract class RecipeDefinitionElement extends DefinitionElement {
  /** @hidden */
  constructor(props: ElementProps, iModel: IModelDb) { super(props, iModel); }
}

/**
 * Defines a set of properties (the *type*) that can be associated with a Physical Element. A Physical
 * Type has a strong correlation with something that can be ordered from a catalog since all instances
 * share a common set of properties.
 */
export abstract class PhysicalType extends TypeDefinitionElement {
  /** @hidden */
  constructor(props: TypeDefinitionElementProps, iModel: IModelDb) { super(props, iModel); }
}

/**
 * Defines a set of properties (the *type*) that can be associated with a spatial location.
 */
export abstract class SpatialLocationType extends TypeDefinitionElement {
  /** @hidden */
  constructor(props: TypeDefinitionElementProps, iModel: IModelDb) { super(props, iModel); }
}

/**
 * A recipe that uses a 3d template for creating new instances.
 */
export class TemplateRecipe3d extends RecipeDefinitionElement {
  /** @hidden */
  public constructor(props: ElementProps, iModel: IModelDb) { super(props, iModel); }
}

/**
 * Defines a set of properties (the *type*) that can be associated with a 2D Graphical Element.
 */
export abstract class GraphicalType2d extends TypeDefinitionElement {
  /** @hidden */
  public constructor(props: ElementProps, iModel: IModelDb) { super(props, iModel); }
}

/**
 * A recipe that uses a 2D template for creating new instances.
 */
export class TemplateRecipe2d extends RecipeDefinitionElement {
  /** @hidden */
  public constructor(props: ElementProps, iModel: IModelDb) { super(props, iModel); }
}

/**
 * An abstract base class for elements that introduce a new modeling
 * perspective within the overall iModel information hierarchy. An Information Partition is always parented
 * to a `Subject` and broken down by a `Model`.
 */
export abstract class InformationPartitionElement extends InformationContentElement implements InformationPartitionElementProps {
  public description?: string;
  /** @hidden */
  public constructor(props: InformationPartitionElementProps, iModel: IModelDb) { super(props, iModel); }

  /** Create a code that can be used for any kind of InformationPartitionElement. */
  public static createCode(iModel: IModelDb, scopeElementId: CodeScopeProps, codeValue: string): Code {
    const codeSpec: CodeSpec = iModel.codeSpecs.getByName(BisCodeSpec.informationPartitionElement);
    return new Code({ spec: codeSpec.id, scope: scopeElementId, value: codeValue });
  }
}

/**
 * An Element that indicates that there is a definition-related modeling perspective within
 * the overall iModel information hierarchy. A Definition Partition is always parented to a Subject and
 * broken down by a Definition Model.
 */
export class DefinitionPartition extends InformationPartitionElement {
}

/**
 * A Document Partition element indicates that there is a document-related modeling perspective within
 * the overall iModel information hierarchy. A Document Partition is always parented to a Subject and broken
 * down by a Document List Model.
 */
export class DocumentPartition extends InformationPartitionElement {
}

/**
 * A Group Information Partition element indicates that there is a group-information-related modeling perspective
 * within the overall iModel information hierarchy. A Group Information Partition is always parented to
 * a Subject and broken down by a Group Information Model.
 */
export class GroupInformationPartition extends InformationPartitionElement {
}

/**
 * A Information Record Partition element indicates that there is an information-record-related modeling
 * perspective within the overall iModel information hierarchy. An Information Record Partition is always
 * parented to a Subject and broken down by an Information Record Model.
 */
export class InformationRecordPartition extends InformationPartitionElement {
}

/**
 * A Link Partition element indicates that there is a link-related modeling perspective within the overall
 * iModel information hierarchy. A Link Partition is always parented to a Subject and broken down by a Link
 * Model.
 */
export class LinkPartition extends InformationPartitionElement {
}

/**
 * A Physical Partition element indicates that there is a physical modeling perspective within the overall
 * iModel information hierarchy. A Physical Partition is always parented to a Subject and broken down by
 * a Physical Model.
 */
export class PhysicalPartition extends InformationPartitionElement {
}

/**
 * A Spatial Location Partition element indicates that there is a spatial-location-related modeling perspective
 * within the overall iModel information hierarchy. A Spatial Location Partition is always parented to a
 * Subject and broken down by a Spatial Location Model.
 */
export class SpatialLocationPartition extends InformationPartitionElement {
}

/**
 * Group Information is an abstract base class for modeling entities whose main purpose is to reference
 * a group of related elements.
 */
export abstract class GroupInformationElement extends InformationReferenceElement {
}
/**
 * An information element that specifies a link.
 */
export abstract class LinkElement extends InformationReferenceElement {
}

/**
 * An information element that specifies a URL link.
 */
export class UrlLink extends LinkElement {
}

/**
 * An information element that links to an embedded file.
 */
export class EmbeddedFileLink extends LinkElement {
}

/**
 * An information element that links to a repository.
 */
export class RepositoryLink extends UrlLink {
}

/**
 * A real world entity is modeled as a Role Element when a set of external circumstances define an important
 * role (one that is worth tracking) that is not intrinsic to the entity playing the role. For example,
 * a person can play the role of a teacher or a rock can play the role of a boundary marker.
 */
export abstract class RoleElement extends Element {
}

/**
 * A Definition Element that specifies a collection of geometry that is meant to be reused across Geometric
 * Element instances. Leveraging Geometry Parts can help reduce file size and improve display performance.
 */
export class GeometryPart extends DefinitionElement implements GeometryPartProps {
  public geom?: GeometryStreamProps;
  public bbox: ElementAlignedBox3d;
  /** @hidden */
  public constructor(props: GeometryPartProps, iModel: IModelDb) {
    super(props, iModel);
    this.geom = props.geom;
    this.bbox = ElementAlignedBox3d.fromJSON(props.bbox);
  }

  /** convert this geometry part to a JSON object.
   * @hidden
   */
  public toJSON(): GeometryPartProps {
    const val = super.toJSON() as GeometryPartProps;
    val.geom = this.geom;
    val.bbox = this.bbox;
    return val;
  }
}

/**
 * The definition element for a line style
 */
export class LineStyle extends DefinitionElement implements LineStyleProps {
  public description?: string;
  public data!: string;
  /** @hidden */
  constructor(props: LineStyleProps, iModel: IModelDb) { super(props, iModel); }

  /** Create a Code for a LineStyle definition given a name that is meant to be unique within the scope of the specified model.
   * @param iModel The IModel
   * @param scopeModelId The Id of the DefinitionModel that contains the LineStyle and provides the scope for its name.
   * @param codeValue The name of the LineStyle
   * @return A LineStyle Code
   */
  public static createCode(iModel: IModelDb, scopeModelId: CodeScopeProps, codeValue: string): Code {
    return new Code({ spec: iModel.codeSpecs.getByName(BisCodeSpec.lineStyle).id, scope: scopeModelId, value: codeValue });
  }
}
