/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { Id64 } from "@bentley/bentleyjs-core/lib/Id";
import { JsonUtils } from "@bentley/bentleyjs-core/lib/JsonUtils";

/** Properties that define a Code */
export interface CodeProps {
  spec: Id64 | string;
  scope: string;
  value?: string;
}

/** A 3 part Code that identifies an Element */
export class Code implements CodeProps {
  public spec: Id64;
  public scope: string;
  public value?: string;

  constructor(val: CodeProps) {
    this.spec = new Id64(val.spec);
    this.scope = JsonUtils.asString(val.scope, "");
    this.value = JsonUtils.asString(val.value);
  }

  /** Create an instance of the default code (1,1,undefined) */
  public static createDefault(): Code { return new Code({ spec: new Id64([1, 0]), scope: "1" }); }
  public getValue(): string { return this.value ? this.value : ""; }
  public equals(other: Code): boolean { return this.spec.equals(other.spec) && this.scope === other.scope && this.value === other.value; }
}

/** Names of built-in CodeSpecs. The best practice is to include the domain name as part of the CodeSpec name to ensure global uniqueness */
export class CodeSpec {
  private static BIS_CODESPEC(name: string): string { return "bis:" + name; }
  public static NullCodeSpec()                   { return CodeSpec.BIS_CODESPEC("NullCodeSpec"); }
  public static AnnotationFrameStyle()           { return CodeSpec.BIS_CODESPEC("AnnotationFrameStyle"); }
  public static AnnotationLeaderStyle()          { return CodeSpec.BIS_CODESPEC("AnnotationLeaderStyle"); }
  public static AnnotationTextStyle()            { return CodeSpec.BIS_CODESPEC("AnnotationTextStyle"); }
  public static AuxCoordSystem2d()               { return CodeSpec.BIS_CODESPEC("AuxCoordSystem2d"); }
  public static AuxCoordSystem3d()               { return CodeSpec.BIS_CODESPEC("AuxCoordSystem3d"); }
  public static AuxCoordSystemSpatial()          { return CodeSpec.BIS_CODESPEC("AuxCoordSystemSpatial"); }
  public static CategorySelector()               { return CodeSpec.BIS_CODESPEC("CategorySelector"); }
  public static ColorBook()                      { return CodeSpec.BIS_CODESPEC("ColorBook"); }
  public static DisplayStyle()                   { return CodeSpec.BIS_CODESPEC("DisplayStyle"); }
  public static Drawing()                        { return CodeSpec.BIS_CODESPEC("Drawing"); }
  public static DrawingCategory()                { return CodeSpec.BIS_CODESPEC("DrawingCategory"); }
  public static GeometryPart()                   { return CodeSpec.BIS_CODESPEC("GeometryPart"); }
  public static GraphicalType2d()                { return CodeSpec.BIS_CODESPEC("GraphicalType2d"); }
  public static TemplateRecipe2d()               { return CodeSpec.BIS_CODESPEC("TemplateRecipe2d"); }
  public static LineStyle()                      { return CodeSpec.BIS_CODESPEC("LineStyle"); }
  public static LinkElement()                    { return CodeSpec.BIS_CODESPEC("LinkElement"); }
  public static ModelSelector()                  { return CodeSpec.BIS_CODESPEC("ModelSelector"); }
  public static PhysicalMaterial()               { return CodeSpec.BIS_CODESPEC("PhysicalMaterial"); }
  public static PhysicalType()                   { return CodeSpec.BIS_CODESPEC("PhysicalType"); }
  public static InformationPartitionElement()    { return CodeSpec.BIS_CODESPEC("InformationPartitionElement"); }
  public static RenderMaterial()                 { return CodeSpec.BIS_CODESPEC("RenderMaterial"); }
  public static Sheet()                          { return CodeSpec.BIS_CODESPEC("Sheet"); }
  public static SpatialCategory()                { return CodeSpec.BIS_CODESPEC("SpatialCategory"); }
  public static SpatialLocationType()            { return CodeSpec.BIS_CODESPEC("SpatialLocationType"); }
  public static SubCategory()                    { return CodeSpec.BIS_CODESPEC("SubCategory"); }
  public static Subject()                        { return CodeSpec.BIS_CODESPEC("Subject"); }
  public static TemplateRecipe3d()               { return CodeSpec.BIS_CODESPEC("TemplateRecipe3d"); }
  public static TextAnnotationSeed()             { return CodeSpec.BIS_CODESPEC("TextAnnotationSeed"); }
  public static Texture()                        { return CodeSpec.BIS_CODESPEC("Texture"); }
  public static ViewDefinition()                 { return CodeSpec.BIS_CODESPEC("ViewDefinition"); }
}
