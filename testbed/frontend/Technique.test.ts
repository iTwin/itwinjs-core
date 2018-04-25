/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/

import { expect, assert } from "chai";
import { Transform } from "@bentley/geometry-core";
import { getWebGLContext } from "./WebGLTestContext";
import {
  ProgramBuilder,
  VertexShaderComponent,
  FragmentShaderComponent,
  Target,
  System,
  TechniqueId,
  SingularTechnique,
  ViewportQuadGeometry,
  DrawParams,
  RenderPass,
} from "@bentley/imodeljs-frontend/lib/rendering";

function createPurpleQuadTechnique(target: Target): TechniqueId {
  const builder = new ProgramBuilder(false);
  builder.vert.set(VertexShaderComponent.ComputePosition, "return rawPos;");
  builder.frag.set(FragmentShaderComponent.ComputeBaseColor, "return vec4(1.0, 0.0, 0.5, 1.0);");
  builder.frag.set(FragmentShaderComponent.AssignFragData, "FragColor = baseColor;");

  const prog = builder.buildProgram(target.gl);
  const technique = new SingularTechnique(prog);
  return target.techniques.addDynamicTechnique(technique, "PurpleQuad");
}

describe("Technique tests", () => {
  it("should produce a simple dynamic rendering technique", () => {
    const gl = getWebGLContext();
    if (undefined === gl) {
      return;
    }

    const system = new System();
    const target = system.createTarget(gl, 0) as Target;
    const techId = createPurpleQuadTechnique(target);
    expect(techId).to.equal(TechniqueId.NumBuiltIn);
  });

  it("should render a purple quad", () => {
    const gl = getWebGLContext();
    if (undefined === gl) {
      return;
    }

    const system = new System();
    const target = system.createTarget(gl, 0) as Target;
    const techId = createPurpleQuadTechnique(target);

    const geom = ViewportQuadGeometry.create(gl, techId);
    assert.isDefined(geom);

    const drawParams = new DrawParams(target, geom!, Transform.createIdentity(), RenderPass.OpaqueGeneral);
    target.techniques.draw(drawParams);
  });
});
