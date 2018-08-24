/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/

import { expect, assert } from "chai";
import { Transform } from "@bentley/geometry-core";
import { WebGLTestContext } from "./WebGLTestContext";
import {
  ProgramBuilder,
  VertexShaderComponent,
  FragmentShaderComponent,
  Target,
  System,
  TechniqueId,
  TechniqueFlags,
  ClippingType,
  FeatureMode,
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
  const canvas = WebGLTestContext.createCanvas();
  assert(undefined !== canvas);
  return System.instance!.createTarget(canvas!) as Target;
}

describe("Technique tests", () => {
  before(() => WebGLTestContext.startup());
  after(() => WebGLTestContext.shutdown());

  it("should produce a simple dynamic rendering technique", () => {
    if (!WebGLTestContext.isInitialized) {
      return;
    }

    const target = createTarget();
    assert(undefined !== target);

    const techId = createPurpleQuadTechnique(target!);
    expect(techId).to.equal(TechniqueId.NumBuiltIn);
  });

  it("should render a purple quad", () => {
    if (!WebGLTestContext.isInitialized) {
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

  it("should successfully compile all shader programs", () => {
    if (WebGLTestContext.isInitialized) {
      expect(System.instance.techniques.compileShaders()).to.be.true;
    }
  });

  // Clipping planes add an extra varying vec4 which was causing surface shaders to exceed max varying vectors (capped at min guaranteed by spec, primarily because iOS).
  // Verify this no longer occurs.
  it.skip("should successfully compile surface shader with clipping planes", () => {
    if (!WebGLTestContext.isInitialized)
      return;

    const flags = new TechniqueFlags(true);
    flags.clip.type = ClippingType.Planes;
    flags.clip.numberOfPlanes = 6;
    flags.featureMode = FeatureMode.Overrides;

    const tech = System.instance.techniques.getTechnique(TechniqueId.Surface);
    const prog = tech.getShader(flags);
    expect(prog.compile()).to.be.true;
  });
});
