/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/

import { IModel, GeometryStream, Placement3d } from "./IModel";

export class Code {
  constructor(public specId: number, public scopeElementId: string, public value?: string) { }
}

/**
 * A two-part id, containing a IModel id and a local id.
 */
// export class Id {
//   private readonly b: number;
//   private readonly l: number;

//   /**
//    * constructor for Id
//    * @param bId an integer identifying the IModel id
//    * @param lId an integer with the local id
//   */
//   constructor(bId?: number | Array<number>, lId?: number) {
//     if (Array.isArray(bId)) {
//       this.b = bId[0] | 0
//       this.l = Math.trunc(bId[1])
//     } else {
//       this.b = bId ? bId | 0 : 0;
//       this.l = lId ? Math.trunc(lId) : 0;
//     }
//   }

//   /** Determine whether this Id is valid */
//   public isValid(): boolean {
//     return this.b !== 0 && this.l !== 0;
//   }

//   /** Test whether two Ids are the same
//    * @param other the other id to test
//    */
//   public equals(other: Id): boolean {
//     return this.b === other.b && this.l === other.l;
//   }
// }

/** The id and relationship class of an Element that is related to another Element */
export class RelatedElement {
  public id: string;
  public relationshipClass: string;
}

export interface CreateParams {
  iModel: IModel;
  className: string;
  modelId: string;
  code: Code;
  id: string;
  parent?: RelatedElement;
  federationGuid?: string;
  userLabel?: string;
  props?: any;
}

/** An element within an iModel */
export class Element {
  public iModel: IModel;
  public id: string;
  public modelId: string;
  public className: string;
  public code: Code;
  public parent?: RelatedElement;
  public federationGuid?: string;
  public userLabel?: string;
  public props?: any;

  /** constructor for Element */
  constructor(opts: CreateParams) {
    this.className = opts.className;
    this.id = opts.id;
    this.code = opts.code;
    this.iModel = opts.iModel;
    this.modelId = opts.modelId;
    this.parent = opts.parent;
    this.federationGuid = opts.federationGuid;
    this.userLabel = opts.userLabel;
    this.props = opts.props;
  }
}

export interface GeometricElementCreateParams extends CreateParams {
  category: string;
  geom?: GeometryStream;
}

/** A Geometric element */
export class GeometricElement extends Element {
  public category: string;
  public geom?: GeometryStream;
  public constructor(opts: GeometricElementCreateParams) {
    super(opts);
    this.category = opts.category;
    this.geom = opts.geom;
  }
}

export class TypeDefinition {
  public definitionId: string;
  public relationshipClass: string;
}

export interface GeometricElement3dCreateParams extends GeometricElementCreateParams {
  placement: Placement3d;
  typeDefinition?: TypeDefinition;
}

export class GeometricElement3d extends GeometricElement {
  public placement: Placement3d;
  public typeDefinition?: TypeDefinition;
  public constructor(opts: GeometricElement3dCreateParams) {
    super(opts);
    this.placement = opts.placement;
    this.typeDefinition = opts.typeDefinition;
  }
}

export class SpatialElement extends GeometricElement3d {
  public constructor(opts: GeometricElement3dCreateParams) { super(opts); }
}

export class PhysicalElement extends SpatialElement {
  public constructor(opts: GeometricElement3dCreateParams) { super(opts); }
}

export class PhysicalPortion extends PhysicalElement {
  public constructor(opts: GeometricElement3dCreateParams) { super(opts); }
}

/** A SpatialElement that identifies a "tracked" real word 3-dimensional location but has no mass and cannot be "touched".
 *  Examples include grid lines, parcel boundaries, and work areas.
 */
export class SpatialLocationElement extends SpatialElement {
  public constructor(opts: GeometricElement3dCreateParams) { super(opts); }
}

/** A SpatialLocationPortion represents an arbitrary portion of a larger SpatialLocationElement that will be broken down in
 *  more detail in a separate (sub) SpatialLocationModel.
 */
export class SpatialLocationPortion extends SpatialLocationElement {
  public constructor(opts: GeometricElement3dCreateParams) { super(opts); }
}

/** An InformationContentElement identifies and names information content.
 * @see InformationCarrierElement
 */
export class InformationContentElement extends Element {
  constructor(opts: CreateParams) { super(opts); }
}

/** A Document is an InformationContentElement that identifies the content of a document.
 * The realized form of a document is called a DocumentCarrier (different class than Document).
 * For example, a will is a legal document. The will published into a PDF file is an ElectronicDocumentCopy.
 * The will printed onto paper is a PrintedDocumentCopy.
 * In this example, the Document only identifies, names, and tracks the content of the will.
 */
export class Document extends InformationContentElement {
  constructor(opts: CreateParams) { super(opts); }
}

export class Drawing extends Document {
  constructor(opts: CreateParams) { super(opts); }
}

export class SectionDrawing extends Drawing {
  constructor(opts: CreateParams) { super(opts); }
}

/** An InformationCarrierElement is a proxy for an information carrier in the physical world.
 *  For example, the arrangement of ink on a paper document or an electronic file is an information carrier.
 *  The content is tracked separately from the carrier.
 *  @see InformationContentElement
 */
export class InformationCarrierElement extends Element {
  constructor(opts: CreateParams) { super(opts); }
}

/** An information element whose main purpose is to hold an information record. */
export class InformationRecordElement extends InformationContentElement {
  constructor(opts: CreateParams) { super(opts); }
}

/** A DefinitionElement resides in (and only in) a DefinitionModel. */
export class DefinitionElement extends InformationContentElement {
  constructor(opts: CreateParams) { super(opts); }
}

export class TypeDefinitionElement extends DefinitionElement {
  public recipe?: RelatedElement;
  constructor(opts: CreateParams) { super(opts); }
}

export class RecipeDefinitionElement extends DefinitionElement {
  constructor(opts: CreateParams) { super(opts); }
}
