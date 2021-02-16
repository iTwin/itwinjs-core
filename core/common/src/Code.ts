/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Codes
 */

import { GuidString, Id64, Id64String, JsonUtils } from "@bentley/bentleyjs-core";
import { IModel } from "./IModel";

/** The props that hold the identity of the object defining the uniqueness scope for a set of Code values.
 * @public
 */
export type CodeScopeProps = Id64String | GuidString;

/** The wire format for a Code
 * @public
 */
export interface CodeProps {
  spec: Id64String;
  scope: CodeScopeProps;
  value?: string;
}

/** A three-part structure containing information about the [Code]($docs/bis/intro/codes) of an Element
 * @public
 */
export class Code implements CodeProps {
  /** The id of the [CodeSpec]($docs/bis/intro/codes.md#codespec) of the Element */
  public spec: Id64String;
  /** The [CodeScope]($docs/bis/intro/codes.md#codescope-property) of the Element */
  public scope: string;
  /** The [CodeValue]($docs/bis/intro/codes.md#codevalue-property) of the Element
   * @note Leading and trailing whitespace is invalid so is automatically trimmed.
   */
  public get value() { return this._value ?? ""; }
  public set value(val: string) { this._value = val?.trim(); }
  private _value?: string;

  constructor(codeProps: CodeProps) {
    this.spec = Id64.fromJSON(codeProps.spec);
    this.scope = JsonUtils.asString(codeProps.scope);
    this.value = JsonUtils.asString(codeProps.value);
  }

  /** Create an empty, non-unique code with no special meaning. */
  public static createEmpty(): Code { const id: Id64String = Id64.fromLocalAndBriefcaseIds(1, 0); return new Code({ spec: id, scope: id }); }
  public static fromJSON(json?: any): Code { return json ? new Code(json) : Code.createEmpty(); }
  public toJSON(): CodeProps { return { spec: this.spec, scope: this.scope, value: this.value }; }
  /** @deprecated Use the [[value]] property instead. */
  public getValue(): string { return this.value; }
  public equals(other: Code): boolean { return Code.equalCodes(this, other); }
  /** @internal */
  public static equalCodes(c1: CodeProps, c2: CodeProps): boolean {
    return c1.spec === c2.spec && c1.scope === c2.scope && c1.value === c2.value;
  }
  /** Determine whether this Code is valid. */
  public static isValid(c: CodeProps): boolean { return Id64.isValidId64(c.spec); }
  /** Determine if this code is valid but not otherwise meaningful (and therefore not necessarily unique) */
  public static isEmpty(c: CodeProps): boolean { return this.isValid(c) && (c.value === undefined || c.value === ""); }
}

/** Names of the internal BIS CodeSpecs. These names match those specified by the native library.
 * For other domains, the best practice is to include the domain name or alias as part of the CodeSpec name to ensure global uniqueness.
 * @public
 */
export enum BisCodeSpec {
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

/** The scope of the Code.
 * @public
 */
export namespace CodeScopeSpec {
  /** The standard ways the CodeScope can be specified.
   * @public
   */
  export enum Type {
    /** The Code value must be unique within (at least) the iModel repository */
    Repository = 1,
    /** The Code value must be unique within the scope of the Model */
    Model = 2,
    /** The Code value must be unique among other children of the same parent element */
    ParentElement = 3,
    /** The Code value must be unique among other elements also scoped by the same element */
    RelatedElement = 4,
  }

  /** Requirements for how the CodeScope Element is identified.
   * @public
   */
  export enum ScopeRequirement {
    /** The Code is required to have a valid ElementId as its scope */
    ElementId = 1,
    /** The Code is required to have a valid FederationGuid as its scope */
    FederationGuid = 2,
  }
}

/** A [Code Specification]($docs/bis/intro/glossary#codespec) captures the rules for encoding and decoding significant business information into
 * and from a Code (string). This specification is used to generate and validate Codes.
 *
 * A CodeSpec defines the format of a Code for a certain type of Element in an IModel.
 * A CodeSpec can identify an external system that maintains and/or assigns Codes.
 * @public
 */
export class CodeSpec {
  /** The iModel holding this CodeSpec. */
  public iModel: IModel;
  /** The id of this CodeSpec. */
  public id: Id64String;
  /** The name of this CodeSpec. */
  public name: string;
  /** The JSON properties for this CodeSpec.
   * > Note: Use the getters and setters instead of accessing this directly.
   * @internal
   */
  public properties: any;

  /** Internal-only constructor. Proper use is to supply `properties` only or `scopeType` and `scopeReq` but not `properties`.
   * > Note: The deprecation has to do with moving the constructor from public to internal
   * @deprecated Use [[create]] or [[createFromJson]] instead of the internal constructor
   * @internal
   */
  public constructor(iModel: IModel, id: Id64String, name: string, scopeType?: CodeScopeSpec.Type, scopeReq?: CodeScopeSpec.ScopeRequirement, properties?: any) {
    this.iModel = iModel;
    this.id = id;
    this.name = name;
    if (properties) {
      this.properties = properties;
      if (!this.properties.scopeSpec) {
        this.properties.scopeSpec = {};
        this.scopeType = CodeScopeSpec.Type.Repository;
      }
    } else {
      this.properties = { scopeSpec: {} };
      this.scopeType = CodeScopeSpec.Type.Repository;
    }
    if (undefined !== scopeType) this.scopeType = scopeType;
    if (undefined !== scopeReq) this.scopeReq = scopeReq;
  }

  /** Create a new CodeSpec from the specified parameters
   * > Note: CodeSpec.id will not be valid until inserted
   * @see [CodeSpecs.insert]($backend)
   */
  public static create(iModel: IModel, name: string, scopeType: CodeScopeSpec.Type, scopeReq?: CodeScopeSpec.ScopeRequirement): CodeSpec {
    return new CodeSpec(iModel, Id64.invalid, name, scopeType, scopeReq, undefined); // eslint-disable-line deprecation/deprecation
  }

  /** Create a new CodeSpec directly from JSON. Used internally by the CodeSpecs.load function.
   * @internal
   */
  public static createFromJson(iModel: IModel, id: Id64String, name: string, properties: any): CodeSpec {
    return new CodeSpec(iModel, id, name, undefined, undefined, properties); // eslint-disable-line deprecation/deprecation
  }

  /** Will be true if the id of this CodeSpec is valid. */
  public get isValid(): boolean { return Id64.isValid(this.id); }

  /** The scope type of this CodeSpec.
   * @deprecated Use scopeType instead.
   */
  public get specScopeType(): CodeScopeSpec.Type { return this.scopeType; }
  public set specScopeType(scopeType: CodeScopeSpec.Type) { this.scopeType = scopeType; }

  /** The scope type of this CodeSpec. */
  public get scopeType(): CodeScopeSpec.Type { return this.properties.scopeSpec.type; }
  public set scopeType(scopeType: CodeScopeSpec.Type) { this.properties.scopeSpec.type = scopeType; }

  /** Will be `CodeScopeSpec.ScopeRequirement.FederationGuid` if the scoping element is required to have a FederationGuid or `CodeScopeSpec.ScopeRequirement.ElementId` otherwise (which is the default). */
  public get scopeReq(): CodeScopeSpec.ScopeRequirement {
    return this.properties.scopeSpec.fGuidRequired ? CodeScopeSpec.ScopeRequirement.FederationGuid : CodeScopeSpec.ScopeRequirement.ElementId;
  }
  public set scopeReq(req: CodeScopeSpec.ScopeRequirement) {
    if (CodeScopeSpec.ScopeRequirement.FederationGuid === req)
      this.properties.scopeSpec.fGuidRequired = true;
    else
      this.properties.scopeSpec.fGuidRequired = undefined;
  }

  /** Will be true if the codes associated with this CodeSpec are managed along with the iModel and false if the codes are managed by an external service.
   * @beta
   */
  public get isManagedWithIModel(): boolean {
    if (this.properties.spec && this.properties.spec.isManagedWithDgnDb !== undefined) {
      return this.properties.spec.isManagedWithDgnDb;
    }
    return true;
  }
  public set isManagedWithIModel(value: boolean) {
    if (!this.properties.spec) this.properties.spec = {};
    this.properties.spec.isManagedWithDgnDb = value;
  }
}
