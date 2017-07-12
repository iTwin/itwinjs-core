/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { Id, IModel, GeometryStream, Placement3d } from "./IModel";
import { registerEcClass } from "./EcRegistry";

export interface ICode {
  spec: Id | string;
  scope: string;
  value?: string;
}

export class Code implements ICode {
  public spec: Id;
  public scope: string;
  public value?: string;

  constructor(val: ICode) {
    this.spec = new Id(val.spec);
    this.scope = val.scope;
    this.value = val.value;
  }

  public static createDefault(): Code { return new Code({ spec: new Id(1), scope: "1" }); }
  public getValue(): string { return this.value ? this.value : ""; }
}

/** The id and relationship class of an Element that is related to another Element */
export class RelatedElement {
  public id: Id;
  public relationshipClass?: string;
}

export interface IElement {
  _iModel: IModel;
  schemaName: string;
  className: string;
  model: Id | string;
  code: ICode;
  id: Id | string;
  parent?: RelatedElement;
  federationGuid?: string;
  userLabel?: string;
  jsonProperties?: any;
}

/** An element within an iModel */
@registerEcClass("BisCore.Element")
export class Element {
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
    this.parent = val.parent;
    this.federationGuid = val.federationGuid;
    this.userLabel = val.userLabel;
    this.jsonProperties = val.jsonProperties ? val.jsonProperties : {};
  }

  public getUserProperties(): any { if (!this.jsonProperties.UserProps) this.jsonProperties.UserProps = {}; return this.jsonProperties.UserProps; }
  public setUserProperties(nameSpace: string, value: any) { this.getUserProperties()[nameSpace] = value; }
  public removeUserProperties(nameSpace: string) { delete this.getUserProperties()[nameSpace]; }
}

export interface IGeometricElement extends IElement {
  category?: Id;
  geom?: GeometryStream;
}

/** A Geometric element */
@registerEcClass("BisCore.GeometricElement")
export class GeometricElement extends Element {
  public category: Id;
  public geom?: GeometryStream;
  public constructor(opts: IGeometricElement) {
    super(opts);
    this.category = opts.category ? opts.category : new Id();
    this.geom = opts.geom;
  }
}

export class TypeDefinition {
  public definitionId: Id;
  public relationshipClass?: string;
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
    this.placement = opts.placement ? opts.placement : new Placement3d();
    this.typeDefinition = opts.typeDefinition;
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

@registerEcClass("BisCore.InformationPartitionElement")
export class InformationPartitionElement extends InformationContentElement {
  constructor(opts: IElement) { super(opts); }
}

@registerEcClass("BisCore.LinkPartition")
export class LinkPartition extends InformationPartitionElement {
  constructor(opts: IElement) { super(opts); }
}
