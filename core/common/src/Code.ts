/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module Codes */

import { Id64, Id64Props, JsonUtils } from "@bentley/bentleyjs-core";
import { IModel } from "./IModel";

/** Properties that define a Code */
export interface CodeProps {
  spec: Id64Props;
  scope: string;
  value?: string;
}

/** A three part Code that identifies an Element */
export class Code implements CodeProps {
  public spec: Id64;
  public scope: string;
  public value?: string;

  constructor(val: CodeProps) {
    this.spec = new Id64(val.spec);
    this.scope = JsonUtils.asString(val.scope, "");
    this.value = JsonUtils.asString(val.value);
  }

  /** Create an empty, non-unique code with no special meaning. */
  public static createEmpty(): Code { const id: Id64 = new Id64([1, 0]); return new Code({ spec: id, scope: id.value }); }
  public static fromJSON(json?: any): Code { return json ? new Code(json) : Code.createEmpty(); }
  public getValue(): string { return this.value ? this.value : ""; }
  public equals(other: Code): boolean { return this.spec.equals(other.spec) && this.scope === other.scope && this.value === other.value; }
}

/**
 * Names of the BIS CodeSpecs. These names match those specified by the native C++ library.
 * The best practice is to include the domain name or alias as part of the CodeSpec name to ensure global uniqueness
 */
export const enum BisCodeSpec {
  nullCodeSpec = "bis:NullCodeSpec",
  annotationFrameStyle = "bis:AnnotationFrameStyle",
  annotationLeaderStyle = "bis:AnnotationLeaderStyle",
  annotationTextStyle = "bis:AnnotationTextStyle",
  auxCoordSystem2d = "bis:AuxCoordSystem2d",
  auxCoordSystem3d = "bis:AuxCoordSystem3d",
  auxCoordSystemSpatial = "bis:AuxCoordSystemSpatial",
  categorySelector = "bis:CategorySelector",
  colorBook = "bis:ColorBook",
  displayStyle = "bis:DisplayStyle",
  drawing = "bis:Drawing",
  drawingCategory = "bis:DrawingCategory",
  geometryPart = "bis:GeometryPart",
  graphicalType2d = "bis:GraphicalType2d",
  lineStyle = "bis:LineStyle",
  linkElement = "bis:LinkElement",
  modelSelector = "bis:ModelSelector",
  physicalMaterial = "bis:PhysicalMaterial",
  physicalType = "bis:PhysicalType",
  informationPartitionElement = "bis:InformationPartitionElement",
  renderMaterial = "bis:RenderMaterial",
  sheet = "bis:Sheet",
  spatialCategory = "bis:SpatialCategory",
  spatialLocationType = "bis:SpatialLocationType",
  subCategory = "bis:SubCategory",
  subject = "bis:Subject",
  templateRecipe2d = "bis:TemplateRecipe2d",
  templateRecipe3d = "bis:TemplateRecipe3d",
  textAnnotationSeed = "bis:TextAnnotationSeed",
  texture = "bis:Texture",
  viewDefinition = "bis:ViewDefinition",
}

/** The scope of the Code. */
export namespace CodeScopeSpec {
  export const enum Type {
    Repository = 1,     /** The Code value must be unique within (at least) the iModel repository */
    Model = 2,          /** The Code value must be unique within the scope of the Model */
    ParentElement = 3,  /** The Code value must be unique among other children of the same parent element */
    RelatedElement = 4, /** The Code value must be unique among other elements also scoped by the same element */
  }

  /** Requirements for using a Code. */
  export const enum ScopeRequirement {
    ElementId = 1,      /** The Code is required to have a valid ElementId as its scope */
    FederationGuid = 2, /** The Code is required to have a valid FederationGuid as its scope */
  }
}

/**
 * A "Code Specification" captures the rules for encoding and decoding significant business information into
 * and from a Code (string). This specification is used to generate and validate Codes.
 *
 * A CodeSpec supplies the Codes for a certain type of Entity in an IModel.
 * A CodeSpec can identify an external system that maintains and/or assigns Codes.
 */
export class CodeSpec {
  public iModel: IModel;
  public id: Id64;
  public name: string;
  public specScopeType: CodeScopeSpec.Type;
  public scopeReq: CodeScopeSpec.ScopeRequirement;
  public properties: any; // TODO: CodeSpec handlers and custom properties

  public constructor(iModel: IModel, id: Id64, name: string, specScopeType: CodeScopeSpec.Type, scopeReq?: CodeScopeSpec.ScopeRequirement, properties?: any) {
    this.iModel = iModel;
    this.id = id;
    this.name = name;
    this.specScopeType = specScopeType;
    this.scopeReq = (undefined !== scopeReq) ? scopeReq : CodeScopeSpec.ScopeRequirement.ElementId;
    this.properties = properties;
  }

  public isValid(): boolean { return this.id.isValid(); }
}
