/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
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
    Local, // no qualifier
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
  export const enum ShaderType {
    Fragment = 1 << 0,
    Vertex = 1 << 1,
    Both = Fragment | Vertex,
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
