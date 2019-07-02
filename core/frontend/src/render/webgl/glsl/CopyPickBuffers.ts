/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module WebGL */

import { TextureUnit } from "../RenderFlags";
import { VariableType, VariablePrecision, FragmentShaderComponent } from "../ShaderBuilder";
import { ShaderProgram } from "../ShaderProgram";
import { CopyPickBufferGeometry } from "../CachedGeometry";
import { Texture2DHandle } from "../Texture";
import { createViewportQuadBuilder } from "./ViewportQuad";
import { System } from "../System";

const computeBaseColor = "return vec4(1.0);";

const assignFragData = `
  FragColor0 = TEXTURE(u_pickFeatureId, v_texCoord);
  FragColor1 = TEXTURE(u_pickDepthAndOrder, v_texCoord);
`;

/** @internal */
export function createCopyPickBuffersProgram(context: WebGLRenderingContext): ShaderProgram {
  const builder = createViewportQuadBuilder(true);
  const frag = builder.frag;

  frag.set(FragmentShaderComponent.ComputeBaseColor, computeBaseColor);

  if (System.instance.capabilities.maxColorAttachments < 2) {
    // NB: Never used - we gl.clear() each attachment directly.
    frag.set(FragmentShaderComponent.AssignFragData, "FragColor = vec4(0.0);");
  } else {
    frag.addUniform("u_pickFeatureId", VariableType.Sampler2D, (prog) => {
      prog.addGraphicUniform("u_pickFeatureId", (uniform, params) => {
        Texture2DHandle.bindSampler(uniform, (params.geometry as CopyPickBufferGeometry).featureId, TextureUnit.Zero);
      });
    }, VariablePrecision.High);

    frag.addUniform("u_pickDepthAndOrder", VariableType.Sampler2D, (prog) => {
      prog.addGraphicUniform("u_pickDepthAndOrder", (uniform, params) => {
        Texture2DHandle.bindSampler(uniform, (params.geometry as CopyPickBufferGeometry).depthAndOrder, TextureUnit.One);
      });
    }, VariablePrecision.High);

    frag.addDrawBuffersExtension();
    frag.set(FragmentShaderComponent.AssignFragData, assignFragData);
  }

  return builder.buildProgram(context);
}
