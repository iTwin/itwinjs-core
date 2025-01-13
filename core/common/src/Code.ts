/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Codes
 */

import { GuidString, Id64, Id64String, JsonUtils } from "@itwin/core-bentley";
import { IModel } from "./IModel";

/**
 * The ElementId of the element that defines the scope for a Code value.
 * @note For insert or update, you may supply the FederationGuid of the scope element and it will be converted to the ElementId of that element.
 * @public
 * @extensions
 */
export type CodeScopeProps = Id64String | GuidString;

/** The parameters that define a Code
 * @public
 * @extensions
 */
export interface CodeProps {
  /** Either the stringified 64-bit Id of the CodeSpec for this code, or the name of the CodeSpec. */
  spec: Id64String | string;
  /** Either the ElementId or the FederationGuid of the element that provides the scope for this code. */
  scope: CodeScopeProps;
  /** the value of this code. May be undefined. */
  value?: string;
}

/**
 * A three-part structure containing information about the [Code]($docs/bis/guide/fundamentals/codes) of an Element
 * @public
 */
export class Code implements CodeProps {
  /** The id of the [CodeSpec]($docs/bis/guide/fundamentals/codes.md#codespec) of the Element */
  public spec: Id64String;
  /** The [CodeScope]($docs/bis/guide/fundamentals/codes.md#codescope-property) of the Element */
  public scope: Id64String;
  /** The [CodeValue]($docs/bis/guide/fundamentals/codes.md#codevalue-property) of the Element
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
  public static createEmpty(): Code {
    const id = Id64.fromLocalAndBriefcaseIds(1, 0);
    return new Code({ spec: id, scope: id });
  }

  public static fromJSON(json?: any): Code { return json ? new Code(json) : Code.createEmpty(); }
  public toJSON(): CodeProps { return { spec: this.spec, scope: this.scope, value: this.value }; }
  public equals(other: Code): boolean { return Code.equalCodes(this, other); }
  /** @internal */
  public static equalCodes(c1: CodeProps, c2: CodeProps): boolean {
    return c1.spec === c2.spec && c1.scope === c2.scope && c1.value === c2.value;
  }
  /** Determine whether this Code is valid. */
  public static isValid(c: CodeProps): boolean { return Id64.isValidId64(c.spec); }
  /** Determine if this code is valid but not otherwise meaningful (and therefore not necessarily unique) */
  public static isEmpty(c: CodeProps): boolean { return this.isValid(c) && (c.value === undefined || c.value === ""); }

  public toString(): string { return `[Code: ${this.spec}, ${this.scope}, ${this.value}]`; }
}

/** Names of the internal BIS CodeSpecs. These names match those specified by the native library.
 * For other domains, the best practice is to include the domain name or alias as part of the CodeSpec name to ensure global uniqueness.
 * @public
* @extensions
* @see [CodeSpec]($docs/bis/guide/fundamentals/codes.md#codespec)
 */
export enum BisCodeSpec {
  /** The name of the standard [[CodeSpec]] used when creating *empty* codes.
   * @see [[Code.createEmpty]]
   */
  nullCodeSpec = "bis:NullCodeSpec",
  /** @internal */
  annotationFrameStyle = "bis:AnnotationFrameStyle",
  /** @internal */
  annotationLeaderStyle = "bis:AnnotationLeaderStyle",
  /** @internal */
  annotationTextStyle = "bis:AnnotationTextStyle",
  /** The name of the standard [[CodeSpec]] used when creating codes for [AuxCoordSystem2d]($backend) elements.
   * @see [AuxCoordSystem2d.createCode]($backend)
   */
  auxCoordSystem2d = "bis:AuxCoordSystem2d",
  /** The name of the standard [[CodeSpec]] used when creating codes for [AuxCoordSystem3d]($backend) elements.
   * @see [AuxCoordSystem3d.createCode]($backend)
   */
  auxCoordSystem3d = "bis:AuxCoordSystem3d",
  /** The name of the standard [[CodeSpec]] used when creating codes for [AuxCoordSystemSpatial]($backend) elements.
   * @see [AuxCoordSystemSpatial.createCode]($backend)
   */
  auxCoordSystemSpatial = "bis:AuxCoordSystemSpatial",
  /** The name of the standard [[CodeSpec]] used when creating codes for [CategorySelector]($backend) elements.
   * @see [CategorySelector.createCode]($backend)
   */
  categorySelector = "bis:CategorySelector",
  /** @internal */
  colorBook = "bis:ColorBook",
  /** The name of the standard [[CodeSpec]] used when creating codes for [DisplayStyle]($backend) elements.
   * @see [DisplayStyle.createCode]($backend)
   */
  displayStyle = "bis:DisplayStyle",
  /** The name of the standard [[CodeSpec]] used when creating codes for [Drawing]($backend) elements.
   * @see [Drawing.createCode]($backend)
   */
  drawing = "bis:Drawing",
  /** The name of the standard [[CodeSpec]] used when creating codes for [DrawingCategory]($backend) elements.
   * @see [DrawingCategory.createCode]($backend)
   */
  drawingCategory = "bis:DrawingCategory",
  /** The name of the standard [[CodeSpec]] used when creating codes for [ExternalSource]($backend) elements.
   * @note This CodeSpec is not automatically created, so use [ExternalSource.ensureCodeSpec]($backend) to make sure that it exists.
   * @see [ExternalSource.createCode]($backend)
   */
  externalSource = "bis:ExternalSource",
  /** The name of the standard [[CodeSpec]] used when creating codes for [ExternalSourceAttachment]($backend) elements.
   * @note This CodeSpec is not automatically created, so use [ExternalSourceAttachment.ensureCodeSpec]($backend) to make sure that it exists.
   * @see [ExternalSource.createCode]($backend)
   */
  externalSourceAttachment = "bis:ExternalSourceAttachment",
  /** The name of the standard [[CodeSpec]] used when creating codes for [GeometryPart]($backend) elements.
   * @see [GeometryPart.createCode]($backend)
   */
  geometryPart = "bis:GeometryPart",
  /** The name of the standard [[CodeSpec]] used when creating codes for [GraphicalType2d]($backend) elements.
   * @see [GraphicalType2d.createCode]($backend)
   */
  graphicalType2d = "bis:GraphicalType2d",
  /** The name of the standard [[CodeSpec]] used when creating codes for [LineStyle]($backend) elements.
   * @see [LineStyle.createCode]($backend)
   */
  lineStyle = "bis:LineStyle",
  /** The name of the standard [[CodeSpec]] used when creating codes for [LinkElement]($backend) elements.
   * @see [LinkElement.createCode]($backend)
   */
  linkElement = "bis:LinkElement",
  /** The name of the standard [[CodeSpec]] used when creating codes for [ModelSelector]($backend) elements.
   * @see [ModelSelector.createCode]($backend)
   */
  modelSelector = "bis:ModelSelector",
  /** The name of the standard [[CodeSpec]] used when creating codes for [PhysicalMaterial]($backend) elements.
   * @see [PhysicalMaterial.createCode]($backend)
   */
  physicalMaterial = "bis:PhysicalMaterial",
  /** The name of the standard [[CodeSpec]] used when creating codes for [PhysicalType]($backend) elements.
   * @see [PhysicalType.createCode]($backend)
   */
  physicalType = "bis:PhysicalType",
  /** The name of the standard [[CodeSpec]] used when creating codes for [InformationPartitionElement]($backend) elements.
   * @see [InformationPartitionElement.createCode]($backend)
   */
  informationPartitionElement = "bis:InformationPartitionElement",
  /** The name of the standard [[CodeSpec]] used when creating codes for [RenderMaterialElement]($backend) elements.
   * @see [RenderMaterialElement.createCode]($backend)
   */
  renderMaterial = "bis:RenderMaterial",
  /** The name of the standard [[CodeSpec]] used when creating codes for [Sheet]($backend) elements.
   * @see [Sheet.createCode]($backend)
   */
  sheet = "bis:Sheet",
  /** The name of the standard [[CodeSpec]] used when creating codes for [SheetIndex]($backend) elements.
   * @see [SheetIndex.createCode]($backend)
   */
  sheetIndex = "bis:SheetIndex",
  /** The name of the standard [[CodeSpec]] used when creating codes for [SheetIndexEntry]($backend) elements.
   * @see [SheetIndexEntry.createCode]($backend)
   */
  sheetIndexEntry = "bis:SheetIndexEntry",
  /** The name of the standard [[CodeSpec]] used when creating codes for [SpatialCategory]($backend) elements.
   * @see [SpatialCategory.createCode]($backend)
   */
  spatialCategory = "bis:SpatialCategory",
  /** The name of the standard [[CodeSpec]] used when creating codes for [SpatialLocationType]($backend) elements.
   * @see [SpatialLocationType.createCode]($backend)
   */
  spatialLocationType = "bis:SpatialLocationType",
  /** The name of the standard [[CodeSpec]] used when creating codes for [SubCategory]($backend) elements.
   * @see [SubCategory.createCode]($backend)
   */
  subCategory = "bis:SubCategory",
  /** The name of the standard [[CodeSpec]] used when creating codes for [Subject]($backend) elements.
   * @see [Subject.createCode]($backend)
   */
  subject = "bis:Subject",
  /** The name of the standard [[CodeSpec]] used when creating codes for [TemplateRecipe2d]($backend) elements.
   * @see [TemplateRecipe2d.createCode]($backend)
   */
  templateRecipe2d = "bis:TemplateRecipe2d",
  /** The name of the standard [[CodeSpec]] used when creating codes for [TemplateRecipe3d]($backend) elements.
   * @see [TemplateRecipe3d.createCode]($backend)
   */
  templateRecipe3d = "bis:TemplateRecipe3d",
  /** @internal */
  textAnnotationSeed = "bis:TextAnnotationSeed",
  /** The name of the standard [[CodeSpec]] used when creating codes for [Texture]($backend) elements.
   * @see [Texture.createCode]($backend)
   */
  texture = "bis:Texture",
  /** The name of the standard [[CodeSpec]] used when creating codes for [ViewDefinition]($backend) elements.
   * @see [ViewDefinition.createCode]($backend)
   */
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

  /**
   * Requirements for how the CodeScope Element is identified.
   * @public
   */
  export enum ScopeRequirement {
    /** The ElementId of CodeScope element identifies its scope. Used for Codes that are unique only within a single iModel. */
    ElementId = 1,
    /** The FederationGuid of the CodeScope element identifies its scope. Used for Codes that are globally unique. */
    FederationGuid = 2,
  }
}

/**
 * The JSON properties of a CodeSpec
 * @public
 */
export interface CodeSpecProperties {
  scopeSpec: {
    /** the type of CodeSpec */
    type: CodeScopeSpec.Type;
    /** If true, the federationGuid of the scope element identifies the scope, for Codes that are globally unique.
     * Otherwise, the ElementId of the scopeElement is used, for Codes that are scoped only within a single iModel.
     */
    fGuidRequired?: boolean;
    /** The relationship className (in the form "schema:class"), when `type` is `CodeScopeSpec.Type.RelatedElement` */
    relationship?: string;
  };
  spec?: {
    isManagedWithDgnDb?: boolean;
  };
  version?: string;
}

/** A [Code Specification]($docs/bis/guide/references/glossary#codespec) captures the rules for encoding and decoding significant business information into
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
   * @note Use the getters and setters instead of accessing this directly.
   * @internal
   */
  public properties: CodeSpecProperties;

  private constructor(iModel: IModel, id: Id64String, name: string, properties?: CodeSpecProperties) {
    this.iModel = iModel;
    this.id = id;
    this.name = name;
    this.properties = properties ?? { scopeSpec: { type: CodeScopeSpec.Type.Repository } };
  }

  /** Create a new CodeSpec from the specified parameters
   * > Note: CodeSpec.id will not be valid until inserted
   * @see [CodeSpecs.insert]($backend)
   */
  public static create(iModel: IModel, name: string, scopeType: CodeScopeSpec.Type, scopeReq?: CodeScopeSpec.ScopeRequirement): CodeSpec {
    const props: CodeSpecProperties = { scopeSpec: { type: scopeType } };
    if (scopeReq)
      props.scopeSpec.fGuidRequired = scopeReq === CodeScopeSpec.ScopeRequirement.FederationGuid;

    return new CodeSpec(iModel, Id64.invalid, name, props);
  }

  /** Create a new CodeSpec directly from JSON. Used internally by the CodeSpecs.load function.
   * @internal
   */
  public static createFromJson(iModel: IModel, id: Id64String, name: string, properties?: CodeSpecProperties): CodeSpec {
    return new CodeSpec(iModel, id, name, properties);
  }

  /** Will be true if the id of this CodeSpec is valid. */
  public get isValid(): boolean { return Id64.isValid(this.id); }
  public get isExternal(): boolean {
    return true === this.properties.scopeSpec.fGuidRequired;
  }

  /** The scope type of this CodeSpec. */
  public get scopeType(): CodeScopeSpec.Type { return this.properties.scopeSpec.type; }
  public set scopeType(scopeType: CodeScopeSpec.Type) { this.properties.scopeSpec.type = scopeType; }

  /** Will be `CodeScopeSpec.ScopeRequirement.FederationGuid` if the scoping element is required to have a FederationGuid or
   * CodeScopeSpec.ScopeRequirement.ElementId` otherwise (the default).
   */
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
   * @deprecated in 3.6 Use scopeReq instead.
   */
  public get isManagedWithIModel(): boolean {
    return this.properties.spec?.isManagedWithDgnDb ?? true;
  }
  public set isManagedWithIModel(value: boolean) {
    if (!this.properties.spec)
      this.properties.spec = {};

    this.properties.spec.isManagedWithDgnDb = value;
  }
}
