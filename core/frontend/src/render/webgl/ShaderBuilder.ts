/*---------------------------------------------------------------------------------------------
 |  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
*--------------------------------------------------------------------------------------------*/
/** @module WebGL */

import { assert } from "@bentley/bentleyjs-core";
import { ShaderProgram } from "./ShaderProgram";
import { GLSLVertex, addPosition } from "./glsl/Vertex";
import { System } from "./System";
import { addClipping } from "./glsl/Clipping";
import { ClipDef, ClipVolumeType } from "./TechniqueFlags";

/** Describes the data type of a shader program variable. */
export const enum VariableType {
  Boolean, // bool
  Int, // int
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

/** Describes the qualifier associated with a shader program variable. */
export const enum VariableScope {
  Global, // no qualifier
  Varying, // varying
  Uniform, // uniform
  Attribute, // attribute

  COUNT,
}

/** Describes the declared or undeclared precision of a shader program variable. */
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
      case VariableType.Boolean: return "bool";
      case VariableType.Int: return "int";
      case VariableType.Float: return "float";
      case VariableType.Vec2: return "vec2";
      case VariableType.Vec3: return "vec3";
      case VariableType.Vec4: return "vec4";
      case VariableType.Mat3: return "mat3";
      case VariableType.Mat4: return "mat4";
      case VariableType.Sampler2D: return "sampler2D";
      case VariableType.SamplerCube: return "samplerCube";
      default: assert(false); return "undefined";
    }
  }

  export function scopeToString(scope: VariableScope): string {
    switch (scope) {
      case VariableScope.Global: return "";
      case VariableScope.Varying: return "varying";
      case VariableScope.Uniform: return "uniform";
      case VariableScope.Attribute: return "attribute";
      default: assert(false); return "undefined";
    }
  }

  export function precisionToString(precision: VariablePrecision): string {
    switch (precision) {
      case VariablePrecision.Default: return "";
      case VariablePrecision.Low: return "lowp";
      case VariablePrecision.Medium: return "mediump";
      case VariablePrecision.High: return "highp";
      default: assert(false); return "undefined";
    }
  }
}

/**
 * Function invoked by ShaderVariable::AddBinding() to bind the variable to the compiled program.
 * The implementation should call ShaderProgram::AddShaderUniform or ShaderProgram::AddGraphicUniform/Attribute to register a function
 * which can be used to bind the value of the variable when program is used.
 */
export type AddVariableBinding = (prog: ShaderProgram) => void;

/** Represents a variable within a fragment or vertex shader. */
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

  /** Constructs the single-line declaration of this variable */
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

/**
 * Represents the set of variables defined and used within a fragment or vertex shader.
 * If the same variable is used in both the fragment and vertex shader (e.g., a varying variable), it should be defined in both ShaderBuilders' ShaderVariables object.
 */
export class ShaderVariables {
  public readonly _list: ShaderVariable[] = new Array<ShaderVariable>();

  /** Find an existing variable with the specified name */
  public find(name: string): ShaderVariable | undefined { return this._list.find((v: ShaderVariable) => v.name === name); }

  /** Add a new variable, if a variable with the same name does not already exist. */
  public addVariable(v: ShaderVariable): void {
    const found = this.find(v.name);
    if (undefined !== found) {
      assert(found.type === v.type);
      // assume same binding etc...
    } else {
      this._list.push(v);
    }
  }

  public addUniform(name: string, type: VariableType, binding: AddVariableBinding, precision: VariablePrecision = VariablePrecision.Default) {
    this.addVariable(ShaderVariable.create(name, type, VariableScope.Uniform, binding, precision));
  }

  public addAttribute(name: string, type: VariableType, binding: AddVariableBinding) {
    this.addVariable(ShaderVariable.create(name, type, VariableScope.Attribute, binding));
  }

  public addVarying(name: string, type: VariableType) {
    this.addVariable(ShaderVariable.create(name, type, VariableScope.Varying));
  }

  public addGlobal(name: string, type: VariableType, value?: string, isConst: boolean = false) {
    this.addVariable(ShaderVariable.createGlobal(name, type, value, isConst));
  }

  public addConstant(name: string, type: VariableType, value: string) {
    this.addGlobal(name, type, value, true);
  }

  /** Constructs the lines of glsl code declaring all of the variables. */
  public buildDeclarations(): string {
    let decls = "";
    for (const v of this._list) {
      decls += v.buildDeclaration() + "\n";
    }

    return decls;
  }

  /**
   * For every uniform and attribute variable not contained in the optional 'predefined' list, invokes the associated binding function
   * to add the corresponding Uniform or Attribute object to the ShaderProgram.
   */
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

/** Convenience API for assembling glsl source code. */
export class SourceBuilder {
  public source: string = "";

  /* Append the specified string to the glsl source */
  public add(what: string): void { this.source += what; }

  /* Append a new-line to the glsl source */
  public newline(): void { this.add("\n"); }

  /* Append the specified string to the glsl source, followed by a new-line */
  public addline(what: string): void { this.add(what); this.newline(); }

  /**
   * Construct a function definition given the function signature and body. For example:
   * buildFunctionDefintion("float average(float a, float b)", "\n  return (a + b) / 2.0;\n");
   * will produce:
   *  "float average(float a, float b) {
   *     return (a + b) / 2.0;
   *   }"
   * For an inline function:
   * buildFunctionDefintion("float average(float a, float b)", "return (a + b) / 2.0;");
   * will produce:
   *  "float average(float a, float b) { return (a + b) / 2.0; }"
   */
  public static buildFunctionDefinition(declaration: string, implementation: string): string {
    // If implementation does not start with a newline then assume it is an inline function & add spaces between braces.
    if ("\n" === implementation.charAt(0))
      return declaration + " {" + implementation + "}\n\n";
    else
      return declaration + " { " + implementation + " }\n\n";
  }

  /** Constructs a function definition as described by buildFunctionDefinition() and appends it to the glsl source. */
  public addFunction(declaration: string, implementation: string): void { this.add(SourceBuilder.buildFunctionDefinition(declaration, implementation)); }

  /** Constructs the definition of the main() function using the supplied function body and appends it to the glsl source. */
  public addMain(implementation: string): void { this.addFunction("void main()", implementation); }
}

/*
 * Represents a fragment or vertex shader under construction. The shader consists of a set of defined variables,
 * plus a set of code snippets which can be concatenated together to form the shader source.
 */
export class ShaderBuilder extends ShaderVariables {
  public readonly _components: string[] = new Array<string>();
  public readonly _functions: string[] = new Array<string>();
  public readonly _extensions: string[] = new Array<string>();
  public headerComment: string = "";

  protected constructor(maxComponents: number) {
    super(); // dumb but required. superclass has no explicit constructor.
    this._components.length = maxComponents;
  }

  protected addComponent(index: number, component: string): void {
    assert(index < this._components.length);

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
      def = SourceBuilder.buildFunctionDefinition("\n" + declarationOrFull, implementation);
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

  protected buildPreludeCommon(isFrag: boolean = false, isLit: boolean = false): SourceBuilder {
    const src = new SourceBuilder();

    src.addline("#version 100");
    src.addline("#define TEXTURE texture2D");

    // Header comment
    src.newline();
    if ("" !== this.headerComment) {
      src.addline(this.headerComment);
      src.newline();
    }

    // Extensions
    let needMultiDrawBuffers = false;
    for (const ext of this._extensions) {
      if (ext === "GL_EXT_draw_buffers") {
        assert(System.instance.capabilities.supportsDrawBuffers, "GL_EXT_draw_bufers unsupported");
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
        /* ###TODO: Source Lighting
        // ###TODO: May end up needing to change this to 8 for unrolled lighting loop...see ShaderBuilder.cpp...
        const maxShaderLights = 64;
        src.addline("const int kMaxShaderLights = " + maxShaderLights);
        src.addline("#define LightColor(i) u_lightData[i*3+0].rgb");
        src.addline("#define LightAtten1(i) u_lightData[i*3+0].a");
        src.addline("#define LightPos(i) u_lightData[i*3+1].xyz");
        src.addline("#define cosHTheta(i) u_lightData[i*3+1].w");
        src.addline("#define LightDir(i) u_lightData[i*3+2].xyz");
        src.addline("#define cosHPhi(i) u_lightData[i*3+2].w");
        */
      }
    }

    // Functions
    for (const func of this._functions) {
      src.add(func);
    }
    if (0 !== this._functions.length)
      src.newline();

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

/** Assembles the source code for a vertex shader from a set of modular components. */
export class VertexShaderBuilder extends ShaderBuilder {
  private _computedVarying: string[] = new Array<string>();
  private _initializers: string[] = new Array<string>();

  public get computedVarying(): string[] { return this._computedVarying; }
  public get initializers(): string[] { return this._initializers; }

  private buildPrelude(): SourceBuilder { return this.buildPreludeCommon(); }

  public constructor(positionFromLUT: boolean) {
    super(VertexShaderComponent.COUNT);
    addPosition(this, positionFromLUT);
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
    main.newline();

    const computePosition = this.get(VertexShaderComponent.ComputePosition);
    assert(undefined !== computePosition);
    if (undefined !== computePosition) {
      prelude.addFunction("vec4 computePosition(vec4 rawPos)", computePosition);
    }

    // Initialization logic that should occur at start of main() - primarily global variables whose values
    // are too complex to compute inline or which depend on uniforms and/or other globals.
    for (const init of this._initializers) {
      main.addline("  {" + init + "  }\n");
    }

    main.addline("  vec4 rawPosition = unquantizeVertexPosition(a_pos, u_qOrigin, u_qScale);");

    const checkForEarlyDiscard = this.get(VertexShaderComponent.CheckForEarlyDiscard);
    if (undefined !== checkForEarlyDiscard) {
      prelude.addFunction("bool checkForEarlyDiscard(vec4 rawPos)", checkForEarlyDiscard);
      main.add(GLSLVertex.earlyDiscard);
    }

    const computeFeatureOverrides = this.get(VertexShaderComponent.ComputeFeatureOverrides);
    if (undefined !== computeFeatureOverrides) {
      prelude.addFunction("void computeFeatureOverrides()", computeFeatureOverrides);
      main.addline("  computeFeatureOverrides();");
    }

    const checkForDiscard = this.get(VertexShaderComponent.CheckForDiscard);
    if (undefined !== checkForDiscard) {
      prelude.addFunction("bool checkForDiscard()", checkForDiscard);
      main.add(GLSLVertex.discard);
    }

    const calcClipDist = this.get(VertexShaderComponent.CalcClipDist);
    if (undefined !== calcClipDist) {
      prelude.addFunction("void calcClipDist(vec4 rawPos)", calcClipDist);
      main.addline("  calcClipDist(rawPosition);");
    }

    const compElemId = this.get(VertexShaderComponent.AddComputeElementId);
    if (undefined !== compElemId) {
      main.addline("  computeElementId();");
    }

    main.addline("  gl_Position = computePosition(rawPosition);");

    for (const comp of this._computedVarying) {
      main.addline("  " + comp);
    }

    prelude.addMain(main.source);
    return prelude.source;
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
  // (Optional) Discard if outside any clipping planes
  // void applyClipping()
  ApplyClipping,
  // (Optional) Apply flash hilite to lit base color
  // vec4 applyFlash(vec4 baseColor)
  ApplyFlash,
  // (Optional) Apply a debug color
  // vec4 applyDebugColor(vec4 baseColor)
  ApplyDebugColor,
  // (Required) Assign the final color to gl_FragColor or gl_FragData
  // void assignFragData(vec4 baseColor)
  AssignFragData,

  COUNT,
}

/** Assembles the source code for a fragment shader from a set of modular components. */
export class FragmentShaderBuilder extends ShaderBuilder {
  public maxClippingPlanes: number = 0;

  public constructor() {
    super(FragmentShaderComponent.COUNT);
  }

  public set(id: FragmentShaderComponent, component: string) { this.addComponent(id, component); }
  public get(id: FragmentShaderComponent): string | undefined { return this.getComponent(id); }

  public addDrawBuffersExtension(): void {
    assert(System.instance.capabilities.supportsDrawBuffers, "WEBGL_draw_buffers unsupported");
    this.addExtension("GL_EXT_draw_buffers");
  }

  public buildSource(): string {
    const applyLighting = this.get(FragmentShaderComponent.ApplyLighting);
    const prelude = this.buildPrelude(undefined !== applyLighting);

    const computeBaseColor = this.get(FragmentShaderComponent.ComputeBaseColor);
    assert(undefined !== computeBaseColor);
    if (undefined !== computeBaseColor) {
      prelude.addFunction("vec4 computeBaseColor()", computeBaseColor);
    }

    const main = new SourceBuilder();
    main.newline();
    const checkForEarlyDiscard = this.get(FragmentShaderComponent.CheckForEarlyDiscard);
    if (undefined !== checkForEarlyDiscard) {
      prelude.addFunction("bool checkForEarlyDiscard()", checkForEarlyDiscard);
      main.addline("  if (checkForEarlyDiscard()) { discard; return; }");
    }

    const applyClipping = this.get(FragmentShaderComponent.ApplyClipping);
    if (undefined !== applyClipping) {
      prelude.addFunction("void applyClipping()", applyClipping);
      main.addline("  applyClipping();");
    }

    main.addline("  vec4 baseColor = computeBaseColor();");

    const applyMaterialOverrides = this.get(FragmentShaderComponent.ApplyMaterialOverrides);
    if (undefined !== applyMaterialOverrides) {
      prelude.addFunction("vec4 applyMaterialOverrides(vec4 baseColor)", applyMaterialOverrides);
      main.addline("  baseColor = applyMaterialOverrides(baseColor);");
    }

    const applyFeatureColor = this.get(FragmentShaderComponent.ApplyFeatureColor);
    if (undefined !== applyFeatureColor) {
      prelude.addFunction("vec4 applyFeatureColor(vec4 baseColor)", applyFeatureColor);
      main.addline("  baseColor = applyFeatureColor(baseColor);");
    }

    const finalize = this.get(FragmentShaderComponent.FinalizeBaseColor);
    if (undefined !== finalize) {
      prelude.addFunction("vec4 finalizeBaseColor(vec4 baseColor)", finalize);
      main.addline("  baseColor = finalizeBaseColor(baseColor);");
    }

    const checkForDiscard = this.get(FragmentShaderComponent.CheckForDiscard);
    if (undefined !== checkForDiscard) {
      prelude.addFunction("bool checkForDiscard(vec4 baseColor)", checkForDiscard);
      main.addline("  if (checkForDiscard(baseColor)) { discard; return; }");
    }

    const discardByAlpha = this.get(FragmentShaderComponent.DiscardByAlpha);
    if (undefined !== discardByAlpha) {
      prelude.addFunction("bool discardByAlpha(float alpha)", discardByAlpha);
      main.addline("  if (discardByAlpha(baseColor.a)) { discard; return; }");
    }

    if (undefined !== applyLighting) {
      prelude.addFunction("vec4 applyLighting(vec4 baseColor)", applyLighting);
      main.addline("  baseColor = applyLighting(baseColor);");
    }

    const applyMonochrome = this.get(FragmentShaderComponent.ApplyMonochrome);
    if (undefined !== applyMonochrome) {
      prelude.addFunction("vec4 applyMonochrome(vec4 baseColor)", applyMonochrome);
      main.addline("  baseColor = applyMonochrome(baseColor);");
    }

    const reverseWoW = this.get(FragmentShaderComponent.ReverseWhiteOnWhite);
    if (undefined !== reverseWoW) {
      prelude.addFunction("vec4 reverseWhiteOnWhite(vec4 baseColor)", reverseWoW);
      main.addline("  baseColor = reverseWhiteOnWhite(baseColor);");
    }

    const applyFlash = this.get(FragmentShaderComponent.ApplyFlash);
    if (undefined !== applyFlash) {
      prelude.addFunction("vec4 applyFlash(vec4 baseColor)", applyFlash);
      main.addline("  baseColor = applyFlash(baseColor);");
    }

    const applyDebug = this.get(FragmentShaderComponent.ApplyDebugColor);
    if (undefined !== applyDebug) {
      prelude.addFunction("vec4 applyDebugColor(vec4 baseColor)", applyDebug);
      main.addline("  baseColor = applyDebugColor(baseColor);");
    }

    const assignFragData = this.get(FragmentShaderComponent.AssignFragData);
    assert(undefined !== assignFragData);
    if (undefined !== assignFragData) {
      prelude.addFunction("void assignFragData(vec4 baseColor)", assignFragData);
      main.addline("  assignFragData(baseColor);");
    }

    prelude.addMain(main.source);
    return prelude.source;
  }

  private buildPrelude(isLit: boolean): SourceBuilder { return this.buildPreludeCommon(true, isLit); }
}

/** A collection of shader programs with clipping that vary based on the max number of clipping planes each supports. */
export class ClippingShaders {
  public builder: ProgramBuilder;
  public shaders: ShaderProgram[] = [];
  public maskShader?: ShaderProgram;

  public constructor(prog: ProgramBuilder, context: WebGLRenderingContext) {
    this.builder = prog.clone();
    addClipping(this.builder, new ClipDef(ClipVolumeType.Planes, 6));

    const maskBuilder = prog.clone();
    addClipping(maskBuilder, new ClipDef(ClipVolumeType.Mask));
    this.maskShader = maskBuilder.buildProgram(context);
    assert(this.maskShader !== undefined);
  }

  private static roundUpToNearesMultipleOf(value: number, factor: number): number {
    const maxPlanes = Math.ceil(value / factor) * factor;
    assert(maxPlanes > 0);
    assert(maxPlanes <= value);
    return maxPlanes;
  }

  private static roundNumPlanes(minPlanes: number): number {
    // We want to avoid making the shader do too much extra work, but we also want to avoid creating separate clipping shaders for
    // every unique # of planes
    if (minPlanes <= 2)
      return minPlanes;   // 1 or 2 planes fairly common (ex - section cut)
    else if (minPlanes <= 6)
      return 6;           // cuboid volume
    else if (minPlanes <= 120)
      return this.roundUpToNearesMultipleOf(minPlanes, 20);
    else
      return this.roundUpToNearesMultipleOf(minPlanes, 50);
  }

  public getProgram(clipDef: ClipDef): ShaderProgram | undefined {
    if (clipDef.type === ClipVolumeType.Mask) {
      return this.maskShader;
    } else if (clipDef.type === ClipVolumeType.Planes) {
      assert(clipDef.numberOfPlanes > 0);
      const numClips = ClippingShaders.roundNumPlanes(clipDef.numberOfPlanes);
      for (const shader of this.shaders)
        if (shader.maxClippingPlanes === numClips)
          return shader;

      this.builder.frag.maxClippingPlanes = numClips;
      const newProgram = this.builder.buildProgram(System.instance.context);
      this.shaders.push(newProgram);
      return newProgram;
    } else {
      assert(false);
      return undefined;
    }
  }
}

export const enum ShaderType {
  Fragment = 1 << 0,
  Vertex = 1 << 1,
  Both = Fragment | Vertex,
}

/**
 * Assembles vertex and fragment shaders from a set of modular components to produce a compiled ShaderProgram.
 * Be very careful with components which use samplers to ensure that no conflicts exist with texture units used by other components (see TextureUnit enum).
 */
export class ProgramBuilder {
  public readonly vert: VertexShaderBuilder;
  public readonly frag: FragmentShaderBuilder;

  public constructor(positionFromLUT: boolean) {
    this.vert = new VertexShaderBuilder(positionFromLUT);
    this.frag = new FragmentShaderBuilder();
  }

  private addVariable(v: ShaderVariable, which: ShaderType) {
    if (which & ShaderType.Fragment) {
      this.frag.addVariable(v);
    }

    if (which & ShaderType.Vertex) {
      this.vert.addVariable(v);
    }
  }

  public addUniform(name: string, type: VariableType, binding: AddVariableBinding, which: ShaderType = ShaderType.Both) {
    this.addVariable(ShaderVariable.create(name, type, VariableScope.Uniform, binding), which);
  }
  public addAttribute(name: string, type: VariableType, binding: AddVariableBinding, which: ShaderType = ShaderType.Both) {
    this.addVariable(ShaderVariable.create(name, type, VariableScope.Attribute, binding), which);
  }
  public addVarying(name: string, type: VariableType) {
    this.addVariable(ShaderVariable.create(name, type, VariableScope.Varying), ShaderType.Both);
  }
  public addGlobal(name: string, type: VariableType, which: ShaderType = ShaderType.Both, value?: string, isConst: boolean = false) {
    this.addVariable(ShaderVariable.createGlobal(name, type, value, isConst), which);
  }

  public addInlineComputedVarying(name: string, type: VariableType, inlineComputation: string) {
    this.frag.addVarying(name, type);
    this.vert.addComputedVarying(name, type, inlineComputation);
  }
  public addFunctionComputedVarying(name: string, type: VariableType, funcName: string, funcBody: string) {
    let funcDecl = "\n" + Convert.typeToString(type) + " " + funcName + "()";
    funcDecl = SourceBuilder.buildFunctionDefinition(funcDecl, funcBody);

    const funcCall = funcName + "()";
    this.addFunctionComputedVaryingWithArgs(name, type, funcCall, funcDecl);
  }
  public addFunctionComputedVaryingWithArgs(name: string, type: VariableType, funcCall: string, funcDef: string) {
    this.vert.addFunction(funcDef);
    const computation = name + " = " + funcCall + ";";
    this.addInlineComputedVarying(name, type, computation);
  }

  /** Assembles the vertex and fragment shader code and returns a ready-to-compile shader program */
  public buildProgram(gl: WebGLRenderingContext): ShaderProgram {
    const prog = new ShaderProgram(gl, this.vert.buildSource(), this.frag.buildSource(), this.vert.headerComment, this.frag.maxClippingPlanes);
    this.vert.addBindings(prog);
    this.frag.addBindings(prog, this.vert);
    return prog;
  }

  public setDebugDescription(description: string): void {
    this.vert.headerComment = this.frag.headerComment = ("//! " + description);
  }

  /** Returns a deep copy of this program builder. */
  public clone(): ProgramBuilder {
    const clone = new ProgramBuilder(false);

    // Copy from vertex builder
    clone.vert.headerComment = this.vert.headerComment;
    for (let i = 0; i < this.vert.computedVarying.length; i++)
      clone.vert.computedVarying[i] = this.vert.computedVarying[i];
    for (let i = 0; i < this.vert.initializers.length; i++)
      clone.vert.initializers[i] = this.vert.initializers[i];
    for (let i = 0; i < this.vert._components.length; i++)
      clone.vert._components[i] = this.vert._components[i];
    for (let i = 0; i < this.vert._functions.length; i++)
      clone.vert._functions[i] = this.vert._functions[i];
    for (let i = 0; i < this.vert._extensions.length; i++)
      clone.vert._extensions[i] = this.vert._extensions[i];
    for (let i = 0; i < this.vert._list.length; i++)
      clone.vert._list[i] = this.vert._list[i];

    // Copy from fragment builder
    clone.frag.headerComment = this.frag.headerComment;
    clone.frag.maxClippingPlanes = this.frag.maxClippingPlanes;
    for (let i = 0; i < this.frag._components.length; i++)
      clone.frag._components[i] = this.frag._components[i];
    for (let i = 0; i < this.frag._functions.length; i++)
      clone.frag._functions[i] = this.frag._functions[i];
    for (let i = 0; i < this.frag._extensions.length; i++)
      clone.frag._extensions[i] = this.frag._extensions[i];
    for (let i = 0; i < this.frag._list.length; i++)
      clone.frag._list[i] = this.frag._list[i];

    return clone;
  }
}
