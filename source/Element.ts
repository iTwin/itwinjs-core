/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/

import { Id, IModel, GeometryStream, Placement3d } from "./IModel";
import { JsonUtils } from "@bentley/bentleyjs-core/lib/JsonUtils";
import { ECClass, ClassDef, IECInstance } from "./ECClass";

export interface ICode {
  spec: Id | string;
  scope: string;
  value?: string;
}

/** A 3 part Code that identifies an Element */
export class Code implements ICode {
  public spec: Id;
  public scope: string;
  public value?: string;

  constructor(val: ICode) {
    this.spec = new Id(val.spec);
    this.scope = JsonUtils.asString(val.scope, "");
    this.value = JsonUtils.asString(val.value);
  }

  /**  Create an instance of the default code (1,1,null) */
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

export interface ElementParams extends IECInstance {
  _iModel: IModel;
  model: Id | string;
  code: ICode;
  id: Id | string;
  parent?: RelatedElement;
  federationGuid?: string;
  userLabel?: string;
  jsonProperties?: any;
}

/** An element within an iModel */
export class Element extends ECClass {
  public _iModel: IModel;
  public id: Id;
  public model: Id;

  /** The name of the ECSchema and schema that defines this class */
  public get schemaName(): string {
    return Object.getPrototypeOf(this).constructor.schema.name;
  }
  /** The name of this class */
  public get className(): string {
    return Object.getPrototypeOf(this).constructor.name;
  }
  public code: Code;
  public parent?: RelatedElement;
  public federationGuid?: string;
  public userLabel?: string;
  public jsonProperties: any;

  /** constructor for Element */
  constructor(val: ElementParams) {
    super();
    this.id = new Id(val.id);
    this.code = new Code(val.code);
    this._iModel = val._iModel;
    this.model = new Id(val.model);
    this.parent = RelatedElement.fromJSON(val.parent);
    this.federationGuid = val.federationGuid;
    this.userLabel = val.userLabel;
    this.jsonProperties = val.jsonProperties ? val.jsonProperties : {};
  }

  /** The full name of this class, including the schema name */
  public static get sqlName(): string { return this.schema.name + "." + this.name; }

  /** Get the metadata for the ECClass of this element. */
  public async getECClass(): Promise<ClassDef> { return Object.getPrototypeOf(this).constructor.getECClassFor(this._iModel, this.schemaName, this.className); }

  public getUserProperties(): any { if (!this.jsonProperties.UserProps) this.jsonProperties.UserProps = {}; return this.jsonProperties.UserProps; }
  public setUserProperties(nameSpace: string, value: any) { this.getUserProperties()[nameSpace] = value; }
  public removeUserProperties(nameSpace: string) { delete this.getUserProperties()[nameSpace]; }

  /** Get the specified ECClass metadata */
  public static getECClassFor(imodel: IModel, schemaName: string, className: string): Promise<ClassDef> {
    if ((null == this.ecClass) || !this.hasOwnProperty("ecClass")) {
      const p = new Promise<ClassDef>((resolve, reject) => {
        imodel.getDgnDb().getECClassMetaData(schemaName, className).then((mstr: string) => {
          resolve(this.ecClass = JSON.parse(mstr));
        }).catch((reason: any) => {
          reject(reason);
        });
      });
      return p;
    }
    return new Promise<ClassDef>((resolve, _reject) => resolve(this.ecClass));
  }
}

/** Parameters for creating a GeometricElement */
export interface GeometricElementParams extends ElementParams {
  category?: Id;
  geom?: GeometryStream;
}

/** A Geometric element */
export class GeometricElement extends Element {
  public category: Id;
  public geom?: GeometryStream;
  public constructor(opts: GeometricElementParams) {
    super(opts);
    this.category = new Id(opts.category);
    this.geom = opts.geom;
  }
}

/** A RelatedElement that describes the type definition of an element. */
export class TypeDefinition extends RelatedElement {
  constructor(definitionId: Id, relationshipClass?: string) { super(definitionId, relationshipClass); }
}

export interface GeometricElement3dParams extends GeometricElementParams {
  placement?: Placement3d;
  typeDefinition?: TypeDefinition;
}

export class GeometricElement3d extends GeometricElement {
  public placement: Placement3d;
  public typeDefinition?: TypeDefinition;

  public constructor(opts: GeometricElement3dParams) {
    super(opts);
    this.placement = Placement3d.fromJSON(opts.placement);
    if (opts.typeDefinition)
      this.typeDefinition = TypeDefinition.fromJSON(opts.typeDefinition);
  }
}

export class SpatialElement extends GeometricElement3d {
  public constructor(opts: GeometricElement3dParams) { super(opts); }
}

export class PhysicalElement extends SpatialElement {
  public constructor(opts: GeometricElement3dParams) { super(opts); }
}

export class PhysicalPortion extends PhysicalElement {
  public constructor(opts: GeometricElement3dParams) { super(opts); }
}

/** A SpatialElement that identifies a "tracked" real word 3-dimensional location but has no mass and cannot be "touched".
 *  Examples include grid lines, parcel boundaries, and work areas.
 */
export class SpatialLocationElement extends SpatialElement {
  public constructor(opts: GeometricElement3dParams) { super(opts); }
}

/** A SpatialLocationPortion represents an arbitrary portion of a larger SpatialLocationElement that will be broken down in
 *  more detail in a separate (sub) SpatialLocationModel.
 */
export class SpatialLocationPortion extends SpatialLocationElement {
  public constructor(opts: GeometricElement3dParams) { super(opts); }
}

/** An InformationContentElement identifies and names information content.
 * @see InformationCarrierElement
 */
export class InformationContentElement extends Element {
  constructor(opts: ElementParams) { super(opts); }
}

export class InformationReferenceElement extends InformationContentElement {
  public constructor(opts: ElementParams) { super(opts); }
}

export class Subject extends InformationReferenceElement {
  public constructor(opts: ElementParams) { super(opts); }
}

/** A Document is an InformationContentElement that identifies the content of a document.
 * The realized form of a document is called a DocumentCarrier (different class than Document).
 * For example, a will is a legal document. The will published into a PDF file is an ElectronicDocumentCopy.
 * The will printed onto paper is a PrintedDocumentCopy.
 * In this example, the Document only identifies, names, and tracks the content of the will.
 */
export class Document extends InformationContentElement {
  constructor(opts: ElementParams) { super(opts); }
}

export class Drawing extends Document {
  constructor(opts: ElementParams) { super(opts); }
}

export class SectionDrawing extends Drawing {
  constructor(opts: ElementParams) { super(opts); }
}

/** An InformationCarrierElement is a proxy for an information carrier in the physical world.
 *  For example, the arrangement of ink on a paper document or an electronic file is an information carrier.
 *  The content is tracked separately from the carrier.
 *  @see InformationContentElement
 */
export class InformationCarrierElement extends Element {
  constructor(opts: ElementParams) { super(opts); }
}

/** An information element whose main purpose is to hold an information record. */
export class InformationRecordElement extends InformationContentElement {
  constructor(opts: ElementParams) { super(opts); }
}

/** A DefinitionElement resides in (and only in) a DefinitionModel. */
export class DefinitionElement extends InformationContentElement {
  constructor(opts: ElementParams) { super(opts); }
}

export class TypeDefinitionElement extends DefinitionElement {
  public recipe?: RelatedElement;
  constructor(opts: ElementParams) { super(opts); }
}

export class RecipeDefinitionElement extends DefinitionElement {
  constructor(opts: ElementParams) { super(opts); }
}

/** A PhysicalType typically corresponds to a @em type of physical object that can be ordered from a catalog.
 *  The PhysicalType system is also a database normalization strategy because properties that are the same
 *  across all instances are stored with the PhysicalType versus being repeated per PhysicalElement instance.
 */
export class PhysicalType extends TypeDefinitionElement {
  constructor(opts: ElementParams) { super(opts); }
}

/** The SpatialLocationType system is a database normalization strategy because properties that are the same
 *  across all instances are stored with the SpatialLocationType versus being repeated per SpatialLocationElement instance.
 */
export class SpatialLocationType extends TypeDefinitionElement {
  constructor(opts: ElementParams) { super(opts); }
}

export class TemplateRecipe3d extends RecipeDefinitionElement {
  constructor(opts: ElementParams) { super(opts); }
}

export class GraphicalType2d extends TypeDefinitionElement {
  constructor(opts: ElementParams) { super(opts); }
}

export class TemplateRecipe2d extends RecipeDefinitionElement {
  constructor(opts: ElementParams) { super(opts); }
}

export class InformationPartitionElement extends InformationContentElement {
  constructor(opts: ElementParams) { super(opts); }
}

/** A DefinitionPartition provides a starting point for a DefinitionModel hierarchy
 *  @note DefinitionPartition elements only reside in the RepositoryModel
 */
export class DefinitionPartition extends InformationPartitionElement {
  constructor(opts: ElementParams) { super(opts); }
}

/** A DocumentPartition provides a starting point for a DocumentListModel hierarchy
 *  @note DocumentPartition elements only reside in the RepositoryModel
 */
export class DocumentPartition extends InformationPartitionElement {
  constructor(opts: ElementParams) { super(opts); }
}

/** A GroupInformationPartition provides a starting point for a GroupInformationModel hierarchy
 *  @note GroupInformationPartition elements only reside in the RepositoryModel
 */
export class GroupInformationPartition extends InformationPartitionElement {
  constructor(opts: ElementParams) { super(opts); }
}

/** An InformationRecordPartition provides a starting point for a InformationRecordModel hierarchy
 *  @note InformationRecordPartition elements only reside in the RepositoryModel
 */
export class InformationRecordPartition extends InformationPartitionElement {
  constructor(opts: ElementParams) { super(opts); }
}

/** A PhysicalPartition provides a starting point for a PhysicalModel hierarchy
 *  @note PhysicalPartition elements only reside in the RepositoryModel
 */
export class PhysicalPartition extends InformationPartitionElement {
  constructor(opts: ElementParams) { super(opts); }
}

/** A SpatialLocationPartition provides a starting point for a SpatialLocationModel hierarchy
 *  @note SpatialLocationPartition elements only reside in the RepositoryModel
 */
export class SpatialLocationPartition extends InformationPartitionElement {
  constructor(opts: ElementParams) { super(opts); }
}

/** A GroupInformationElement resides in (and only in) a GroupInformationModel. */
export class GroupInformationElement extends InformationReferenceElement {
  constructor(opts: ElementParams) { super(opts); }
}

/** Abstract base class for roles played by other (typically physical) elements.
 *  For example:
 *  - <i>Lawyer</i> and <i>employee</i> are potential roles of a person
 *  - <i>Asset</i> and <i>safety hazard</i> are potential roles of a PhysicalElement
 */
export class RoleElement extends Element {
  constructor(opts: ElementParams) { super(opts); }
}

/** A LinkPartition provides a starting point for a LinkModel hierarchy */
export class LinkPartition extends InformationPartitionElement {
  constructor(opts: ElementParams) { super(opts); }
}
