/*---------------------------------------------------------------------------------------------
 |  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
*--------------------------------------------------------------------------------------------*/

import { assert } from "@bentley/bentleyjs-core";
import { ShaderProgram } from "./ShaderProgram";

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

  public static createGlobal(name: string, type: VariableType, value?: string, isConst: boolean=false) {
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
