/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/

import { expect, assert } from "chai";
import { Transform } from "@bentley/geometry-core";
import { WebGLTestContext } from "./WebGLTestContext";
import { IModelApp } from "@bentley/imodeljs-frontend";
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

  const prog = builder.buildProgram(System.instance.context);
  const technique = new SingularTechnique(prog);
  return target.techniques.addDynamicTechnique(technique, "PurpleQuad");
}

function createTarget(): Target | undefined {
  return System.instance!.createTarget() as Target;
}

describe("Technique tests", () => {
  before(() => WebGLTestContext.startup());
  after(() => WebGLTestContext.shutdown());

  it("should produce a simple dynamic rendering technique", () => {
    if (!IModelApp.hasRenderSystem) {
      return;
    }

    const target = createTarget();
    assert(undefined !== target);

    const techId = createPurpleQuadTechnique(target!);
    expect(techId).to.equal(TechniqueId.NumBuiltIn);
  });

  it("should render a purple quad", () => {
    if (!IModelApp.hasRenderSystem) {
      return;
    }

    const target = createTarget();
    assert(undefined !== target);
    if (undefined === target) {
      return;
    }

    const techId = createPurpleQuadTechnique(target);
    const geom = ViewportQuadGeometry.create(techId);
    assert.isDefined(geom);

    const drawParams = new DrawParams(target, geom!, Transform.createIdentity(), RenderPass.OpaqueGeneral);
    target.techniques.draw(drawParams);
  });
});
