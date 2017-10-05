/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { Id64 } from "@bentley/bentleyjs-core/lib/Id";
import { JsonUtils } from "@bentley/bentleyjs-core/lib/JsonUtils";
import { IModel } from "./IModel";

/** Properties that define a Code */
export interface CodeProps {
  spec: Id64 | string;
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
  public static createEmpty(): Code { const id: Id64 = new Id64([1, 0]); return new Code({ spec: id, scope: id.toString() }); }
  public getValue(): string { return this.value ? this.value : ""; }
  public equals(other: Code): boolean { return this.spec.equals(other.spec) && this.scope === other.scope && this.value === other.value; }
}

/** Names of built-in CodeSpecs. The best practice is to include the domain name as part of the CodeSpec name to ensure global uniqueness */
export class CodeSpecNames {
  private static BIS_CODESPEC(name: string): string { return "bis:" + name; }
  public static NullCodeSpec() { return CodeSpecNames.BIS_CODESPEC("NullCodeSpec"); }
  public static AnnotationFrameStyle() { return CodeSpecNames.BIS_CODESPEC("AnnotationFrameStyle"); }
  public static AnnotationLeaderStyle() { return CodeSpecNames.BIS_CODESPEC("AnnotationLeaderStyle"); }
  public static AnnotationTextStyle() { return CodeSpecNames.BIS_CODESPEC("AnnotationTextStyle"); }
  public static AuxCoordSystem2d() { return CodeSpecNames.BIS_CODESPEC("AuxCoordSystem2d"); }
  public static AuxCoordSystem3d() { return CodeSpecNames.BIS_CODESPEC("AuxCoordSystem3d"); }
  public static AuxCoordSystemSpatial() { return CodeSpecNames.BIS_CODESPEC("AuxCoordSystemSpatial"); }
  public static CategorySelector() { return CodeSpecNames.BIS_CODESPEC("CategorySelector"); }
  public static ColorBook() { return CodeSpecNames.BIS_CODESPEC("ColorBook"); }
  public static DisplayStyle() { return CodeSpecNames.BIS_CODESPEC("DisplayStyle"); }
  public static Drawing() { return CodeSpecNames.BIS_CODESPEC("Drawing"); }
  public static DrawingCategory() { return CodeSpecNames.BIS_CODESPEC("DrawingCategory"); }
  public static GeometryPart() { return CodeSpecNames.BIS_CODESPEC("GeometryPart"); }
  public static GraphicalType2d() { return CodeSpecNames.BIS_CODESPEC("GraphicalType2d"); }
  public static TemplateRecipe2d() { return CodeSpecNames.BIS_CODESPEC("TemplateRecipe2d"); }
  public static LineStyle() { return CodeSpecNames.BIS_CODESPEC("LineStyle"); }
  public static LinkElement() { return CodeSpecNames.BIS_CODESPEC("LinkElement"); }
  public static ModelSelector() { return CodeSpecNames.BIS_CODESPEC("ModelSelector"); }
  public static PhysicalMaterial() { return CodeSpecNames.BIS_CODESPEC("PhysicalMaterial"); }
  public static PhysicalType() { return CodeSpecNames.BIS_CODESPEC("PhysicalType"); }
  public static InformationPartitionElement() { return CodeSpecNames.BIS_CODESPEC("InformationPartitionElement"); }
  public static RenderMaterial() { return CodeSpecNames.BIS_CODESPEC("RenderMaterial"); }
  public static Sheet() { return CodeSpecNames.BIS_CODESPEC("Sheet"); }
  public static SpatialCategory() { return CodeSpecNames.BIS_CODESPEC("SpatialCategory"); }
  public static SpatialLocationType() { return CodeSpecNames.BIS_CODESPEC("SpatialLocationType"); }
  public static SubCategory() { return CodeSpecNames.BIS_CODESPEC("SubCategory"); }
  public static Subject() { return CodeSpecNames.BIS_CODESPEC("Subject"); }
  public static TemplateRecipe3d() { return CodeSpecNames.BIS_CODESPEC("TemplateRecipe3d"); }
  public static TextAnnotationSeed() { return CodeSpecNames.BIS_CODESPEC("TextAnnotationSeed"); }
  public static Texture() { return CodeSpecNames.BIS_CODESPEC("Texture"); }
  public static ViewDefinition() { return CodeSpecNames.BIS_CODESPEC("ViewDefinition"); }
}

/** A CodeSpec object within a particular IModel */
export class CodeSpec {
  public imodel: IModel;
  public id: Id64;
  public name: string;
  public properties: any; // TODO: CodeSpec handlers and custom properties

  public isValid(): boolean { return this.id.isValid(); }
}
