/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/

import { Id, IModel, GeometryStream, Placement3d } from "./IModel";
import { registerEcClass } from "./EcRegistry";
import { JsonUtils } from "../../Bentleyjs-common/lib/JsonUtils";

export interface ICode {
  spec: Id | string;
  scope: string;
  value?: string;
}

/**
 * A 3 part Code that identifies an Element
 * @export
 * @class Code
 * @implements {ICode}
 */
export class Code implements ICode {
  public spec: Id;
  public scope: string;
  public value?: string;

  constructor(val: ICode) {
    this.spec = new Id(val.spec);
    this.scope = JsonUtils.asString(val.scope, "");
    this.value = JsonUtils.asString(val.value);
  }

  /**
   *  Create an instance of the default code (1,1,null)
   * @static
   * @returns {Code}
   * @memberof Code
   */
  public static createDefault(): Code { return new Code({ spec: new Id(1), scope: "1" }); }
  public getValue(): string { return this.value ? this.value : ""; }
}

/** The Id and relationship class of an Element that is related to another Element */
export class RelatedElement {
  constructor(public id: Id, public relationshipClass?: string) { }
  public static fromJSON(json?: any): RelatedElement | undefined {
    return json ? new this(new Id(json.id), JsonUtils.asString(json.relationshipClass)) : undefined;
  }
}

/**
 * the schema name and class name for an ECClass
 * @export
 */
export interface FullClassName {
  schemaName: string;
  className: string;
}

export interface IElement extends FullClassName {
  _iModel: IModel;
  model: Id | string;
  code: ICode;
  id: Id | string;
  parent?: RelatedElement;
  federationGuid?: string;
  userLabel?: string;
  jsonProperties?: any;
}

/**
 * The full name of an ECClass
 * @property {string } name The name of the class
 * @property {string} schema  The name of the ECSchema that defines this class
 */
export interface ECClassFullname {
  name: string;
  schema: string;
}

/**
 * A custom attribute instance
 * @property { ECClassFullname } ecclass The ECClass of the custom attribute
 * @property { PrimitiveECProperty| NavigationECProperty|StructECProperty|PrimitiveArrayECProperty|StructArrayECProperty } properties An object whose properties correspond by name to the properties of this class.
 */
export interface CustomAttribute {
  ecclass: ECClassFullname;
  properties: { [propName: string]: PrimitiveECProperty | NavigationECProperty | StructECProperty | PrimitiveArrayECProperty | StructArrayECProperty };
}

/**
 * Metadata for an ECProperty that is a primitive type.
 * @property { Object } primitiveECProperty Describes the type
 * @property { CustomAttribute[] } customAttributes The Custom Attributes for this class
 */
export interface PrimitiveECProperty {
  primitiveECProperty: { type: string, extendedType?: string };
  customAttributes: CustomAttribute[];
}

/**
 * Metadata for an ECProperty that is a Navigation property (aka a pointer to another element in the iModel).
 * @property { Object } navigationECProperty Describes the type
 * @property { CustomAttribute[] } customAttributes The Custom Attributes for this class
 */
export interface NavigationECProperty {
  navigationECProperty: { type: string, direction: string, relationshipClass: ECClassFullname };
  customAttributes: CustomAttribute[];
}

/**
 * Metadata for an ECProperty that is a struct.
 * @property { Object } structECProperty Describes the type
 * @property { CustomAttribute[] } customAttributes The Custom Attributes for this class
 */
export interface StructECProperty {
  structECProperty: { type: string };
}

/**
 * Metadata for an ECProperty that is a primitive array.
 * @property { Object } primitveArrayECProperty Describes the type
 * @property { CustomAttribute[] } customAttributes The Custom Attributes for this class
 */
export interface PrimitiveArrayECProperty {
  primitveArrayECProperty: { type: string, minOccurs: number, maxOccurs?: number };
}

/**
 * Metadata for an ECProperty that is a struct array.
 * @property { Object } structArrayECProperty Describes the type
 * @property { CustomAttribute[] } customAttributes The Custom Attributes for this class
 */
export interface StructArrayECProperty {
  structArrayECProperty: { type: string, minOccurs: number, maxOccurs?: number };
}

/**
 * Metadata  for an ECClass.
 * @property {string} name  The ECClass name
 * @property {string} schema  The name of the ECSchema that defines this class
 * @property { ECClassFullname[] } baseClasses The list of base classes that this class is derived from. If more than one, the first is the actual base class and the others are mixins.
 * @property { CustomAttribute[] } customAttributes The Custom Attributes for this class
 * @property { PrimitiveECProperty| NavigationECProperty|StructECProperty|PrimitiveArrayECProperty|StructArrayECProperty } properties An object whose properties correspond by name to the properties of this class.
 */
export interface ECClass {
  name: string;
  schema: string;
  baseClasses: ECClassFullname[];
  customAttributes: CustomAttribute[];
  properties: { [propName: string]: PrimitiveECProperty | NavigationECProperty | StructECProperty | PrimitiveArrayECProperty | StructArrayECProperty };
}

/** An element within an iModel */
@registerEcClass("BisCore.Element")
export class Element {
  public static ecClass: any;
  public _iModel: IModel;
  public id: Id;
  public model: Id;
  public schemaName: string;
  public className: string;
  public code: Code;
  public parent?: RelatedElement;
  public federationGuid?: string;
  public userLabel?: string;
  public jsonProperties: any;

  /** constructor for Element */
  constructor(val: IElement) {
    this.schemaName = val.schemaName;
    this.className = val.className;
    this.id = new Id(val.id);
    this.code = new Code(val.code);
    this._iModel = val._iModel;
    this.model = new Id(val.model);
    this.parent = RelatedElement.fromJSON(val.parent);
    this.federationGuid = val.federationGuid;
    this.userLabel = val.userLabel;
    this.jsonProperties = val.jsonProperties ? val.jsonProperties : {};
  }

  /** Get the metadata for the ECClass of this element. */
  public async getECClass(): Promise<ECClass>  { return Object.getPrototypeOf(this).constructor.getECClassFor(this._iModel, this.schemaName, this.className); }
  public getUserProperties(): any { if (!this.jsonProperties.UserProps) this.jsonProperties.UserProps = {}; return this.jsonProperties.UserProps; }
  public setUserProperties(nameSpace: string, value: any) { this.getUserProperties()[nameSpace] = value; }
  public removeUserProperties(nameSpace: string) { delete this.getUserProperties()[nameSpace]; }

  /**
   * Get the specified ECClass metadata
   */
  public static getECClassFor(imodel: IModel, schemaName: string, className: string): Promise<ECClass> {
    if ((null == this.ecClass) || !this.hasOwnProperty("ecClass")) {
      const p = new Promise<ECClass>((resolve, reject) => {
        imodel.getDgnDb().getECClassMetaData(schemaName, className).then((mstr: string) => {
          resolve(this.ecClass = JSON.parse(mstr));
        }).catch((reason: any) => {
          reject(reason);
        });
      });
      return p;
    }
    return this.ecClass;
  }
}

/**
 * Parameters for creating a GeometricElement
 * @export
 * @interface IGeometricElement
 * @extends {IElement}
 */
export interface IGeometricElement extends IElement {
  category?: Id;
  geom?: GeometryStream;
}

/** A Geometric element
 * @export
 * @class GeometricElement
 * @extends {Element}
 */
@registerEcClass("BisCore.GeometricElement")
export class GeometricElement extends Element {
  public category: Id;
  public geom?: GeometryStream;
  public constructor(opts: IGeometricElement) {
    super(opts);
    this.category = new Id(opts.category);
    this.geom = opts.geom;
  }
}

/** A RelatedElement that describes the type definition of an element. */
export class TypeDefinition extends RelatedElement {
  constructor(definitionId: Id, relationshipClass?: string) { super(definitionId, relationshipClass); }
}

export interface IGeometricElement3d extends IGeometricElement {
  placement?: Placement3d;
  typeDefinition?: TypeDefinition;
}

@registerEcClass("BisCore.GeometricElement3d")
export class GeometricElement3d extends GeometricElement {
  public placement: Placement3d;
  public typeDefinition?: TypeDefinition;

  public constructor(opts: IGeometricElement3d) {
    super(opts);
    this.placement = Placement3d.fromJSON(opts.placement);
    if (opts.typeDefinition)
      this.typeDefinition = TypeDefinition.fromJSON(opts.typeDefinition);
  }
}

@registerEcClass("BisCore.SpatialElement")
export class SpatialElement extends GeometricElement3d {
  public constructor(opts: IGeometricElement3d) { super(opts); }
}

@registerEcClass("BisCore.PhysicalElement")
export class PhysicalElement extends SpatialElement {
  public constructor(opts: IGeometricElement3d) { super(opts); }
}

@registerEcClass("BisCore.PhysicalPortion")
export class PhysicalPortion extends PhysicalElement {
  public constructor(opts: IGeometricElement3d) { super(opts); }
}

/** A SpatialElement that identifies a "tracked" real word 3-dimensional location but has no mass and cannot be "touched".
 *  Examples include grid lines, parcel boundaries, and work areas.
 */
@registerEcClass("BisCore.SpatialLocationElement")
export class SpatialLocationElement extends SpatialElement {
  public constructor(opts: IGeometricElement3d) { super(opts); }
}

/** A SpatialLocationPortion represents an arbitrary portion of a larger SpatialLocationElement that will be broken down in
 *  more detail in a separate (sub) SpatialLocationModel.
 */
@registerEcClass("BisCore.SpatialLocationPortion")
export class SpatialLocationPortion extends SpatialLocationElement {
  public constructor(opts: IGeometricElement3d) { super(opts); }
}

/** An InformationContentElement identifies and names information content.
 * @see InformationCarrierElement
 */
@registerEcClass("BisCore.InformationContentElement")
export class InformationContentElement extends Element {
  constructor(opts: IElement) { super(opts); }
}

@registerEcClass("BisCore.InformationReferenceElement")
export class InformationReferenceElement extends InformationContentElement {
  public constructor(opts: IElement) { super(opts); }
}

@registerEcClass("BisCore.Subject")
export class Subject extends InformationReferenceElement {
  public constructor(opts: IElement) { super(opts); }
}

/** A Document is an InformationContentElement that identifies the content of a document.
 * The realized form of a document is called a DocumentCarrier (different class than Document).
 * For example, a will is a legal document. The will published into a PDF file is an ElectronicDocumentCopy.
 * The will printed onto paper is a PrintedDocumentCopy.
 * In this example, the Document only identifies, names, and tracks the content of the will.
 */
@registerEcClass("BisCore.Document")
export class Document extends InformationContentElement {
  constructor(opts: IElement) { super(opts); }
}

@registerEcClass("BisCore.Drawing")
export class Drawing extends Document {
  constructor(opts: IElement) { super(opts); }
}

@registerEcClass("BisCore.SectionDrawing")
export class SectionDrawing extends Drawing {
  constructor(opts: IElement) { super(opts); }
}

/** An InformationCarrierElement is a proxy for an information carrier in the physical world.
 *  For example, the arrangement of ink on a paper document or an electronic file is an information carrier.
 *  The content is tracked separately from the carrier.
 *  @see InformationContentElement
 */
@registerEcClass("BisCore.InformationCarrierElement")
export class InformationCarrierElement extends Element {
  constructor(opts: IElement) { super(opts); }
}

/** An information element whose main purpose is to hold an information record. */
@registerEcClass("BisCore.InformationRecordElement")
export class InformationRecordElement extends InformationContentElement {
  constructor(opts: IElement) { super(opts); }
}

/** A DefinitionElement resides in (and only in) a DefinitionModel. */
@registerEcClass("BisCore.DefinitionElement")
export class DefinitionElement extends InformationContentElement {
  constructor(opts: IElement) { super(opts); }
}

@registerEcClass("BisCore.TypeDefinitionElement")
export class TypeDefinitionElement extends DefinitionElement {
  public recipe?: RelatedElement;
  constructor(opts: IElement) { super(opts); }
}

@registerEcClass("BisCore.RecipeDefinitionElement")
export class RecipeDefinitionElement extends DefinitionElement {
  constructor(opts: IElement) { super(opts); }
}

/** A PhysicalType typically corresponds to a @em type of physical object that can be ordered from a catalog.
 *  The PhysicalType system is also a database normalization strategy because properties that are the same
 *  across all instances are stored with the PhysicalType versus being repeated per PhysicalElement instance.
 */
@registerEcClass("BisCore.PhysicalType")
export class PhysicalType extends TypeDefinitionElement {
  constructor(opts: IElement) { super(opts); }
}

/** The SpatialLocationType system is a database normalization strategy because properties that are the same
 *  across all instances are stored with the SpatialLocationType versus being repeated per SpatialLocationElement instance.
 */
@registerEcClass("BisCore.SpatialLocationType")
export class SpatialLocationType extends TypeDefinitionElement {
  constructor(opts: IElement) { super(opts); }
}

@registerEcClass("BisCore.TemplateRecipe3d")
export class TemplateRecipe3d extends RecipeDefinitionElement {
  constructor(opts: IElement) { super(opts); }
}

@registerEcClass("BisCore.GraphicalType2d")
export class GraphicalType2d extends TypeDefinitionElement {
  constructor(opts: IElement) { super(opts); }
}

@registerEcClass("BisCore.TemplateRecipe2d")
export class TemplateRecipe2d extends RecipeDefinitionElement {
  constructor(opts: IElement) { super(opts); }
}

@registerEcClass("BisCore.InformationPartitionElement")
export class InformationPartitionElement extends InformationContentElement {
  constructor(opts: IElement) { super(opts); }
}

/** A DefinitionPartition provides a starting point for a DefinitionModel hierarchy
 *  @note DefinitionPartition elements only reside in the RepositoryModel
 */
@registerEcClass("BisCore.DefinitionPartition")
export class DefinitionPartition extends InformationPartitionElement {
  constructor(opts: IElement) { super(opts); }
}

/** A DocumentPartition provides a starting point for a DocumentListModel hierarchy
 *  @note DocumentPartition elements only reside in the RepositoryModel
 */
@registerEcClass("BisCore.DocumentPartition")
export class DocumentPartition extends InformationPartitionElement {
  constructor(opts: IElement) { super(opts); }
}

/** A GroupInformationPartition provides a starting point for a GroupInformationModel hierarchy
 *  @note GroupInformationPartition elements only reside in the RepositoryModel
 */
@registerEcClass("BisCore.GroupInformationPartition")
export class GroupInformationPartition extends InformationPartitionElement {
  constructor(opts: IElement) { super(opts); }
}

/** An InformationRecordPartition provides a starting point for a InformationRecordModel hierarchy
 *  @note InformationRecordPartition elements only reside in the RepositoryModel
 */
@registerEcClass("BisCore.InformationRecordPartition")
export class InformationRecordPartition extends InformationPartitionElement {
  constructor(opts: IElement) { super(opts); }
}

/** A PhysicalPartition provides a starting point for a PhysicalModel hierarchy
 *  @note PhysicalPartition elements only reside in the RepositoryModel
 */
@registerEcClass("BisCore.PhysicalPartition")
export class PhysicalPartition extends InformationPartitionElement {
  constructor(opts: IElement) { super(opts); }
}

/** A SpatialLocationPartition provides a starting point for a SpatialLocationModel hierarchy
 *  @note SpatialLocationPartition elements only reside in the RepositoryModel
 */
@registerEcClass("BisCore.SpatialLocationPartition")
export class SpatialLocationPartition extends InformationPartitionElement {
  constructor(opts: IElement) { super(opts); }
}

/** A GroupInformationElement resides in (and only in) a GroupInformationModel. */
@registerEcClass("BisCore.GroupInformationElement")
export class GroupInformationElement extends InformationReferenceElement {
  constructor(opts: IElement) { super(opts); }
}

/** Abstract base class for roles played by other (typically physical) elements.
 *  For example:
 *  - <i>Lawyer</i> and <i>employee</i> are potential roles of a person
 *  - <i>Asset</i> and <i>safety hazard</i> are potential roles of a PhysicalElement
 */
@registerEcClass("BisCore.RoleElement")
export class RoleElement extends Element {
  constructor(opts: IElement) { super(opts); }
}

/** A LinkPartition provides a starting point for a LinkModel hierarchy */
@registerEcClass("BisCore.LinkPartition")
export class LinkPartition extends InformationPartitionElement {
  constructor(opts: IElement) { super(opts); }
}
