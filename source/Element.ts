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
export class Id {
  public readonly b: number;
  public readonly l: number;

  private static parseHex(str: string): number {
    const v = parseInt(str, 16);
    return Number.isNaN(v) ? 0 : v;
  }

  /**
   * constructor for Id
   * @param bId an integer identifying the IModel id
   * @param lId an integer with the local id
   */
  constructor(bId?: number | number[] | string, lId?: number) {
    if (Array.isArray(bId)) {
      this.b = bId[0] | 0;
      this.l = Math.trunc(bId[1]);
      return;
    }

    if (typeof bId === "string") {
      if (bId[0] !== "0" || !(bId[1] === "x" || bId[1] === "X")) {
        this.b = this.l = 0;
        return;
      }

      let start = 2;
      const len = bId.length;
      if (len > 12) {
        start = (len - 10);
        const bcVal = bId.slice(2, start);
        this.b = Id.parseHex(bcVal);
      } else {
        this.b = 0;
      }

      this.l = Id.parseHex(bId.slice(start));
      return;
    }

    this.b = bId ? bId | 0 : 0;
    this.l = lId ? Math.trunc(lId) : 0;
  }

  /** convert this Id to a string */
  public toString(): string {
    if (!this.isValid())
      return "";
    return "0X" + this.b.toString(16) + ("0000000000" + this.l.toString(16)).substr(-10);
  }

  /** Determine whether this Id is valid */
  public isValid(): boolean {
    return this.l !== 0;
  }

  /** Test whether two Ids are the same
   * @param other the other id to test
   */
  public equals(other: Id): boolean {
    return this.b === other.b && this.l === other.l;
  }
}

/** The id and relationship class of an Element that is related to another Element */
export class RelatedElement {
  public id: Id;
  public relationshipClass: string;
}

export interface CreateParams {
  iModel: IModel;
  className: string;
  modelId: Id;
  code: Code;
  id: Id;
  parent?: RelatedElement;
  federationGuid?: string;
  userLabel?: string;
  props?: any;
}

/** An element within an iModel */
export class Element {
  public iModel: IModel;
  public id: Id;
  public modelId: Id;
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

  public getEcClass(): string { return "Element"; }
}

export interface GeometricElementCreateParams extends CreateParams {
  category?: Id;
  geom?: GeometryStream;
}

/** A Geometric element */
export class GeometricElement extends Element {
  public category: Id;
  public geom?: GeometryStream;
  public constructor(opts: GeometricElementCreateParams) {
    super(opts);
    this.category = opts.category ? opts.category : new Id();
    this.geom = opts.geom;
  }
  public getEcClass(): string { return "GeometricElement"; }
}

export class TypeDefinition {
  public definitionId: Id;
  public relationshipClass: string;
}

export interface GeometricElement3dCreateParams extends GeometricElementCreateParams {
  placement?: Placement3d;
  typeDefinition?: TypeDefinition;
}

export class GeometricElement3d extends GeometricElement {
  public placement: Placement3d;
  public typeDefinition?: TypeDefinition;
  public constructor(opts: GeometricElement3dCreateParams) {
    super(opts);
    this.placement = opts.placement ? opts.placement : new Placement3d();
    this.typeDefinition = opts.typeDefinition;
  }
  public getEcClass(): string { return "GeometricElement3d"; }
}

export class SpatialElement extends GeometricElement3d {
  public constructor(opts: GeometricElement3dCreateParams) { super(opts); }
  public getEcClass(): string { return "SpatialElement"; }
}

export class PhysicalElement extends SpatialElement {
  public constructor(opts: GeometricElement3dCreateParams) { super(opts); }
  public getEcClass(): string { return "PhysicalElement"; }
}

export class PhysicalPortion extends PhysicalElement {
  public constructor(opts: GeometricElement3dCreateParams) { super(opts); }
  public getEcClass(): string { return "PhysicalPortion"; }
}

/** A SpatialElement that identifies a "tracked" real word 3-dimensional location but has no mass and cannot be "touched".
 *  Examples include grid lines, parcel boundaries, and work areas.
 */
export class SpatialLocationElement extends SpatialElement {
  public constructor(opts: GeometricElement3dCreateParams) { super(opts); }
  public getEcClass(): string { return "PhysicalPortion"; }
}

/** A SpatialLocationPortion represents an arbitrary portion of a larger SpatialLocationElement that will be broken down in
 *  more detail in a separate (sub) SpatialLocationModel.
 */
export class SpatialLocationPortion extends SpatialLocationElement {
  public constructor(opts: GeometricElement3dCreateParams) { super(opts); }
  public getEcClass(): string { return "SpatialLocationPortion"; }
}

/** An InformationContentElement identifies and names information content.
 * @see InformationCarrierElement
 */
export class InformationContentElement extends Element {
  constructor(opts: CreateParams) { super(opts); }
  public getEcClass(): string { return "InformationContentElement"; }
}

/** A Document is an InformationContentElement that identifies the content of a document.
 * The realized form of a document is called a DocumentCarrier (different class than Document).
 * For example, a will is a legal document. The will published into a PDF file is an ElectronicDocumentCopy.
 * The will printed onto paper is a PrintedDocumentCopy.
 * In this example, the Document only identifies, names, and tracks the content of the will.
 */
export class Document extends InformationContentElement {
  constructor(opts: CreateParams) { super(opts); }
  public getEcClass(): string { return "Document"; }
}

export class Drawing extends Document {
  constructor(opts: CreateParams) { super(opts); }
  public getEcClass(): string { return "Drawing"; }
}

export class SectionDrawing extends Drawing {
  constructor(opts: CreateParams) { super(opts); }
  public getEcClass(): string { return "SectionDrawing"; }
}

/** An InformationCarrierElement is a proxy for an information carrier in the physical world.
 *  For example, the arrangement of ink on a paper document or an electronic file is an information carrier.
 *  The content is tracked separately from the carrier.
 *  @see InformationContentElement
 */
export class InformationCarrierElement extends Element {
  constructor(opts: CreateParams) { super(opts); }
  public getEcClass(): string { return "InformationCarrierElement"; }
}

/** An information element whose main purpose is to hold an information record. */
export class InformationRecordElement extends InformationContentElement {
  constructor(opts: CreateParams) { super(opts); }
  public getEcClass(): string { return "InformationRecordElement"; }
}

/** A DefinitionElement resides in (and only in) a DefinitionModel. */
export class DefinitionElement extends InformationContentElement {
  constructor(opts: CreateParams) { super(opts); }
  public getEcClass(): string { return "DefinitionElement"; }
}

export class TypeDefinitionElement extends DefinitionElement {
  public recipe?: RelatedElement;
  constructor(opts: CreateParams) { super(opts); }
  public getEcClass(): string { return "TypeDefinitionElement"; }
}

export class RecipeDefinitionElement extends DefinitionElement {
  constructor(opts: CreateParams) { super(opts); }
  public getEcClass(): string { return "RecipeDefinitionElement"; }
}
