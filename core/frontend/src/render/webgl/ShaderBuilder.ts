/*---------------------------------------------------------------------------------------------
 |  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
*--------------------------------------------------------------------------------------------*/

import { assert } from "@bentley/bentleyjs-core";
import { ShaderProgram } from "./ShaderProgram";
import { ShaderSource } from "./ShaderSource";

// Describes the data type of a shader program variable.
export const enum VariableType {
  Boolean, // bool
  Int, // int
  UInt, // uint
  Float, // float
  Vec2, // vec2
  Vec3, // vec3
  Vec4, // vec4
  Mat3, // mat3
  Mat4, // mat4
  Sampler2D, // sampler2D
  SamplerCube, // samplerCube

  COUNT,
}

// Describes the qualifier associated with a shader program variable.
export const enum VariableScope {
  Global, // no qualifier
  Varying, // varying
  Uniform, // uniform
  Attribute, // attribute

  COUNT,
}

// Describes the declared or undeclared precision of a shader program variable.
export const enum VariablePrecision {
  Default, // undeclared precision - variable uses the explicit or implicit precision default for its type
  Low, // lowp
  Medium, // mediump
  High, // highp

  COUNT,
}

namespace Convert {
  export function typeToString(type: VariableType): string {
    switch (type) {
      case VariableType.Boolean:      return "bool";
      case VariableType.Int:          return "int";
      case VariableType.UInt:         return "uint";
      case VariableType.Float:        return "float";
      case VariableType.Vec2:         return "vec2";
      case VariableType.Vec3:         return "vec3";
      case VariableType.Vec4:         return "vec4";
      case VariableType.Mat3:         return "mat3";
      case VariableType.Mat4:         return "mat4";
      case VariableType.Sampler2D:    return "sampler2D";
      case VariableType.SamplerCube:  return "samplerCube";
      default:                        assert(false); return "undefined";
    }
  }

  export function scopeToString(scope: VariableScope): string {
    switch (scope) {
      case VariableScope.Global:    return "";
      case VariableScope.Varying:   return "varying";
      case VariableScope.Uniform:   return "uniform";
      case VariableScope.Attribute: return "attribute";
      default:                      assert(false); return "undefined";
    }
  }

  export function precisionToString(precision: VariablePrecision): string {
    switch (precision) {
      case VariablePrecision.Default: return "";
      case VariablePrecision.Low:     return "lowp";
      case VariablePrecision.Medium:  return "mediump";
      case VariablePrecision.High:    return "highp";
      default:                        assert(false); return "undefined";
    }
  }
}

export const enum ShaderType {
  Fragment = 1 << 0,
  Vertex = 1 << 1,
  Both = Fragment | Vertex,
}

// Function invoked by ShaderVariable::AddBinding() to bind the variable to the compiled program.
// The implementation should call ShaderProgram::AddShaderUniform or ShaderProgram::AddGraphicUniform/Attribute to register a function
// which can be used to bind the value of the variable when program is used.
export type AddVariableBinding = (prog: ShaderProgram) => void;

// Represents a variable within a fragment or vertex shader
export class ShaderVariable {
  private readonly _addBinding?: AddVariableBinding;
  public readonly name: string;
  public readonly value?: string; // for global variables only
  public readonly type: VariableType;
  public readonly scope: VariableScope;
  public readonly precision: VariablePrecision;
  public readonly isConst: boolean = false; // for global variables only

  private constructor(name: string, type: VariableType, scope: VariableScope, precision: VariablePrecision, isConst: boolean, addBinding?: AddVariableBinding, value?: string) {
    this._addBinding = addBinding;
    this.name = name;
    this.value = value;
    this.type = type;
    this.scope = scope;
    this.precision = precision;
    this.isConst = isConst;
  }

  public static create(name: string, type: VariableType, scope: VariableScope, addBinding?: AddVariableBinding, precision: VariablePrecision = VariablePrecision.Default): ShaderVariable {
    return new ShaderVariable(name, type, scope, precision, false, addBinding, undefined);
  }

  public static createGlobal(name: string, type: VariableType, value?: string, isConst: boolean = false) {
    return new ShaderVariable(name, type, VariableScope.Global, VariablePrecision.Default, isConst, undefined, value);
  }

  public get hasBinding(): boolean { return undefined !== this._addBinding; }
  public addBinding(prog: ShaderProgram) {
    if (undefined !== this._addBinding)
      this._addBinding(prog);
  }

  public get typeName(): string { return Convert.typeToString(this.type); }
  public get scopeName(): string { return Convert.scopeToString(this.scope); }
  public get precisionName(): string { return Convert.precisionToString(this.precision); }

  public buildDeclaration(): string {
    const parts = new Array<string>();
    if (this.isConst)
      parts.push("const");

    const scopeName = this.scopeName;
    if (0 < scopeName.length)
      parts.push(scopeName);

    const precisionName = this.precisionName;
    if (0 < precisionName.length)
      parts.push(precisionName);

    parts.push(this.typeName);
    parts.push(this.name);

    if (undefined !== this.value && 0 < this.value.length) {
      parts.push("=");
      parts.push(this.value);
    }

    return parts.join(" ") + ";";
  }
}

// Represents the set of variables defined and used within a fragment or vertex shader.
// If the same variable is used in both the fragment and vertex shader (e.g., a varying
// variable), it should be defined in both ShaderBuilders' ShaderVariables object.
export class ShaderVariables {
  private readonly _list: ShaderVariable[] = new Array<ShaderVariable>();

  public find(name: string): ShaderVariable | undefined {
    return this._list.find((v: ShaderVariable) => v.name === name);
  }

  private add(v: ShaderVariable): void {
    const found = this.find(v.name);
    if (undefined !== found) {
      assert(found.type === v.type);
      // assume same binding etc...
    } else {
      this._list.push(v);
    }
  }

  public addUniform(name: string, type: VariableType, binding: AddVariableBinding, precision: VariablePrecision = VariablePrecision.Default) {
    this.add(ShaderVariable.create(name, type, VariableScope.Uniform, binding, precision));
  }

  public addAttribute(name: string, type: VariableType, binding: AddVariableBinding) {
    this.add(ShaderVariable.create(name, type, VariableScope.Attribute, binding));
  }

  public addVarying(name: string, type: VariableType) {
    this.add(ShaderVariable.create(name, type, VariableScope.Varying));
  }

  public addGlobal(name: string, type: VariableType, value?: string, isConst: boolean = false) {
    this.add(ShaderVariable.createGlobal(name, type, value, isConst));
  }

  public buildDeclarations(): string {
    let decls = "";
    for (const v of this._list) {
      decls += v.buildDeclaration() + "\n";
    }

    return decls;
  }

  public addBindings(prog: ShaderProgram, predefined?: ShaderVariables): void {
    for (const v of this._list) {
      // Some variables exist in both frag and vert shaders - only add them to the program once.
      if (v.hasBinding && (undefined === predefined || undefined === predefined.find(v.name))) {
        v.addBinding(prog);
      }
    }
  }

  public get length(): number { return this._list.length; }
}

export class SourceBuilder {
  public source: string = "";

  public add(what: string): void { this.source += what; }
  public newline(): void { this.add("\n"); }
  public addline(what: string): void {
    this.add(what);
    this.newline();
  }
}

// Represents a fragment or vertex shader under construction. The shader consists of
// a set of defined variables, plus a set of code snippets which can be concatenated
// together to form the shader source.
export class ShaderBuilder extends ShaderVariables {
  private readonly _components: string[] = new Array<string>();
  private readonly _functions: string[] = new Array<string>();
  private readonly _extensions: string[] = new Array<string>();
  public headerComment: string = "";

  protected constructor(maxComponents: number) {
    super(); // dumb but required. superclass has no explicit constructor.
    this._components.length = maxComponents;
  }

  protected addComponent(index: number, component: string): void {
    assert(index < this._components.length );

    // assume if caller is replacing an existing component, they know what they're doing...
    this._components[index] = component;
  }

  protected getComponent(index: number): string | undefined {
    assert(index < this._components.length);
    return this._components[index];
  }

  public addFunction(declarationOrFull: string, implementation?: string): void {
    let def = declarationOrFull;
    if (undefined !== implementation) {
      def = ShaderBuilder.buildFunctionDefinition(declarationOrFull, implementation);
    }

    if (undefined === this.findFunction(def)) {
      this._functions.push(def);
    }
  }

  public replaceFunction(existing: string, replacement: string): boolean {
    const index = this._functions.indexOf(existing);
    if (-1 !== index) {
      this._functions[index] = replacement;
    }

    assert(-1 !== index);
    return -1 !== index;
  }

  public findFunction(func: string): string | undefined {
    return this._functions.find((f: string | undefined) => f === func);
  }

  public addExtension(extName: string): void {
    if (-1 === this._extensions.indexOf(extName)) {
      this._extensions.push(extName);
    }
  }

  protected static buildFunctionDefinition(declaration: string, implementation: string): string {
    return declaration + "\n{\n" + implementation + "\n}\n\n";
  }

  protected buildPreludeCommon(isFrag: boolean = false, isLit: boolean = false): SourceBuilder {
    const src = new SourceBuilder();

    src.addline("#version 100");
    src.addline("#define TEXTURE texture2D");

    // Header comment
    src.newline();
    src.addline(this.headerComment);
    src.newline();

    // Extensions
    let needMultiDrawBuffers = false;
    for (const ext of this._extensions) {
      if (ext === "GL_EXT_draw_buffers") {
        needMultiDrawBuffers = true;
      }

      src.addline("#extension " + ext + " : enable");
    }

    // Default precisions
    src.addline("precision highp float;");
    src.addline("precision highp int;");
    src.newline();

    // Variable declarations
    src.add(this.buildDeclarations());

    if (isFrag) {
      src.addline("#define FragColor gl_FragColor");
      if (needMultiDrawBuffers) {
        src.addline("#define FragColor0 gl_FragData[0]");
        src.addline("#define FragColor1 gl_FragData[1]");
        src.addline("#define FragColor2 gl_FragData[2]");
        src.addline("#define FragColor3 gl_FragData[3]");
      }

      if (isLit) {
        // ###TODO: May end up needing to change this to 8 for unrolled lighting loop...see ShaderBuilder.cpp...
        const maxShaderLights = 64;
        src.addline("const int kMaxShaderLights = " + maxShaderLights);
        src.addline("#define LightColor(i) u_lightData[i*3+0].rgb");
        src.addline("#define LightAtten1(i) u_lightData[i*3+0].a");
        src.addline("#define LightPos(i) u_lightData[i*3+1].xyz");
        src.addline("#define cosHTheta(i) u_lightData[i*3+1].w");
        src.addline("#define LightDir(i) u_lightData[i*3+2].xyz");
        src.addline("#define cosHPhi(i) u_lightData[i*3+2].w");
      }
    }

    // Functions
    for (const func of this._functions) {
      src.add(func);
    }

    return src;
  }
}

// Describes the optional and required components which can be assembled into complete
export const enum VertexShaderComponent {
  // (Optional) Return true to discard this vertex before evaluating feature overrides etc, given the model-space position.
  // bool checkForEarlyDiscard(vec4 rawPos)
  CheckForEarlyDiscard,
  // (Optional) Compute feature overrides like visibility, rgb, transparency, line weight.
  ComputeFeatureOverrides,
  // (Optional) Return true if this vertex should be "discarded" (is not visible)
  // bool checkForDiscard()
  // If this returns true, gl_Position will be set to 0; presumably related vertices will also do so, resulting in a degenerate triangle.
  // If this returns true, no further processing will be performed.
  CheckForDiscard,
  // (Required) Return this vertex's position in clip space.
  // vec4 computePosition(vec4 rawPos)
  ComputePosition,
  // (Optional) Compute the clip distance to send to the fragment shader.
  // void calcClipDist(vec4 rawPos)
  CalcClipDist,
  // (Optional) Add the element id to the vertex shader.
  // void computeElementId()
  AddComputeElementId,

  COUNT,
}

// Assembles the source code for a vertex shader from a set of modular components.
export class VertexShaderBuilder extends ShaderBuilder {
  private _computedVarying: string[] = new Array<string>();
  private _initializers: string[] = new Array<string>();

  private buildPrelude(): SourceBuilder { return this.buildPreludeCommon(); }

  public constructor(positionFromLUT: boolean) {
    super(VertexShaderComponent.COUNT);
    this.addPosition(positionFromLUT);
  }

  public set(id: VertexShaderComponent, component: string) { this.addComponent(id, component); }
  public get(id: VertexShaderComponent): string | undefined { return this.getComponent(id); }

  public addInitializer(initializer: string): void { this._initializers.push(initializer); }
  public addComputedVarying(name: string, type: VariableType, computation: string): void {
    this.addVarying(name, type);
    this._computedVarying.push(computation);
  }

  public buildSource(): string {
    const prelude = this.buildPrelude();
    const main = new SourceBuilder();

    const computePosition = this.get(VertexShaderComponent.ComputePosition);
    assert(undefined !== computePosition);
    if (undefined !== computePosition) {
      prelude.add(ShaderBuilder.buildFunctionDefinition("vec4 computePosition(vec4 rawPos)", computePosition));
    }

    // Initialization logic that should occur at start of main() - primarily global variables whose values
    // are too complex to compute inline or which depend on uniforms and/or other globals.
    for (const init of this._initializers) {
      main.addline("{\n" + init + "\n}");
    }

    main.addline("vec4 rawPosition = unquantizeVertexPosition(a_pos, u_qOrigin, u_qScale);");

    const checkForEarlyDiscard = this.get(VertexShaderComponent.CheckForEarlyDiscard);
    if (undefined !== checkForEarlyDiscard) {
      prelude.add(ShaderBuilder.buildFunctionDefinition("bool checkForEarlyDiscard(vec4 rawPos)", checkForEarlyDiscard));
      main.add(ShaderSource.Vertex.earlyDiscard);
    }

    const computeFeatureOverrides = this.get(VertexShaderComponent.ComputeFeatureOverrides);
    if (undefined !== computeFeatureOverrides) {
      prelude.add(ShaderBuilder.buildFunctionDefinition("void computeFeatureOverrides()", computeFeatureOverrides));
      main.addline("computeFeatureOverrides();");
    }

    const checkForDiscard = this.get(VertexShaderComponent.CheckForDiscard);
    if (undefined !== checkForDiscard) {
      prelude.add(ShaderBuilder.buildFunctionDefinition("bool checkForDiscard()", checkForDiscard));
      main.add(ShaderSource.Vertex.discard);
    }

    const calcClipDist = this.get(VertexShaderComponent.CalcClipDist);
    if (undefined !== calcClipDist) {
      prelude.add(ShaderBuilder.buildFunctionDefinition("void calcClipDist(vec4 rawPos)", calcClipDist));
      main.addline("calcClipDist(rawPosition);");
    }

    const compElemId = this.get(VertexShaderComponent.AddComputeElementId);
    if (undefined !== compElemId) {
      main.addline("computeElementId();");
    }

    main.addline("gl_Position = computePosition(rawPosition);");

    for (const comp of this._computedVarying) {
      main.addline("\n" + comp);
    }

    prelude.add(ShaderBuilder.buildFunctionDefinition("void main()", main.source));
    return prelude.source;
  }

  private addPosition(positionFromLUT: boolean): void {
    this.addFunction(ShaderSource.Vertex.unquantizePosition);

    // ###TODO: a_pos, u_qScale, u_qOrigin

    if (!positionFromLUT) {
      this.addFunction(ShaderSource.Vertex.unquantizeVertexPosition);
      return;
    }

    this.addGlobal("g_vertexLUTIndex", VariableType.Float);
    this.addGlobal("g_vertexBaseCoords", VariableType.Vec2);
    this.addGlobal("g_vertexData2", VariableType.Vec2);
    this.addGlobal("g_featureIndexCoords", VariableType.Vec2);

    this.addFunction(ShaderSource.decodeUInt32);
    this.addFunction(ShaderSource.decodeUInt16);
    this.addFunction(ShaderSource.Vertex.unquantizeVertexPositionFromLUT);

    // ###TODO: u_vertLUT, u_vertParams, LookupTable.AddToBuilder()

    this.addInitializer(ShaderSource.Vertex.initializeVertLUTCoords);
  }
}

// Describes the optional and required components which can be assembled into complete
export const enum FragmentShaderComponent {
  // (Optional) Return true to immediately discard this fragment.
  // bool checkForEarlyDiscard()
  CheckForEarlyDiscard,
  // (Required) Compute this fragment's base color
  // vec4 computeBaseColor()
  ComputeBaseColor,
  // (Optional) Apply material overrides to base color
  // vec4 applyMaterialOverrides(vec4 baseColor)
  ApplyMaterialOverrides,
  // (Optional) Apply feature overrides to base color
  // vec4 applyFeatureColor(vec4 baseColor)
  ApplyFeatureColor,
  // (Optional) Adjust base color after material and/or feature overrides have been applied.
  // vec4 finalizeBaseColor(vec4 baseColor)
  FinalizeBaseColor,
  // (Optional) Return true if this fragment should be discarded
  // Do not invoke discard directly in your shader components - instead, return true from this function to generate a discard statement.
  // bool checkForDiscard(vec4 baseColor)
  CheckForDiscard,
  // (Optional) Return true if the alpha value is not suitable for the current render pass
  // bool discardByAlpha(float alpha)
  DiscardByAlpha,
  // (Optional) Apply lighting to base color
  // vec4 applyLighting(vec4 baseColor)
  ApplyLighting,
  // (Optional) Apply monochrome overrides to base color
  // vec4 applyMonochrome(vec4 baseColor)
  ApplyMonochrome,
  // (Optional) Apply white-on-white reversal to base color
  ReverseWhiteOnWhite,
  // (Optional) Apply flash hilite to lit base color
  // vec4 applyFlash(vec4 baseColor)
  ApplyFlash,
  // (Required) Assign the final color to gl_FragColor or gl_FragData
  // void assignFragData(vec4 baseColor)
  AssignFragData,
  // (Optional) Discard if outside any clipping planes
  // void applyClipping()
  ApplyClipping,

  COUNT,
}

