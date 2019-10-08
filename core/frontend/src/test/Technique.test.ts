/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { expect, assert } from "chai";
import { IModelApp } from "../IModelApp";
import { ClippingType } from "../render/System";
import {
  AttributeMap,
  DrawParams,
  FeatureMode,
  FragmentShaderComponent,
  ProgramBuilder,
  ShaderProgramParams,
  SingularTechnique,
  System,
  Target,
  TechniqueFlags,
  TechniqueId,
  VariableType,
  VertexShaderComponent,
  ViewportQuadGeometry,
} from "../webgl";

function createPurpleQuadBuilder(): ProgramBuilder {
  const builder = new ProgramBuilder(AttributeMap.findAttributeMap(undefined, false));
  builder.vert.set(VertexShaderComponent.ComputePosition, "return rawPos;");
  builder.frag.set(FragmentShaderComponent.ComputeBaseColor, "return vec4(1.0, 0.0, 0.5, 1.0);");
  builder.frag.set(FragmentShaderComponent.AssignFragData, "FragColor = baseColor;");
  return builder;
}

function createPurpleQuadTechnique(): TechniqueId {
  const builder = createPurpleQuadBuilder();
  const prog = builder.buildProgram(System.instance.context);
  const technique = new SingularTechnique(prog);
  return System.instance.techniques.addDynamicTechnique(technique, "PurpleQuad");
}

function createTarget(): Target | undefined {
  let canvas = document.getElementById("WebGLTestCanvas") as HTMLCanvasElement;
  if (null === canvas) {
    canvas = document.createElement("canvas") as HTMLCanvasElement;
    if (null !== canvas) {
      canvas.id = "WebGLTestCanvas";
      document.body.appendChild(document.createTextNode("WebGL tests"));
      document.body.appendChild(canvas);
    }
  }
  canvas.width = 300;
  canvas.height = 150;
  assert(undefined !== canvas);
  return System.instance!.createTarget(canvas!) as Target;
}

describe("Techniques", () => {
  before(() => IModelApp.startup());
  after(() => IModelApp.shutdown());

  it("should produce a simple dynamic rendering technique", () => {
    const target = createTarget();
    assert(undefined !== target);

    const techId = createPurpleQuadTechnique();
    expect(techId).to.equal(TechniqueId.NumBuiltIn);
  });

  it("should render a purple quad", () => {
    const target = createTarget();
    assert(undefined !== target);
    if (undefined === target) {
      return;
    }

    const techId = createPurpleQuadTechnique();
    const geom = ViewportQuadGeometry.create(techId);
    assert.isDefined(geom);

    const progParams = new ShaderProgramParams();
    progParams.init(target);
    const drawParams = new DrawParams();
    drawParams.init(progParams, geom!);
    target.techniques.draw(drawParams);
  });

  // NB: this can potentially take a long time, especially on our mac build machines.
  it("should successfully compile all shader programs", () => {
    const haveMRT = System.instance.capabilities.supportsDrawBuffers;
    expect(System.instance.techniques.compileShaders()).to.be.true;

    if (haveMRT) {
      // Compile the multi-pass versions of the shaders too.
      IModelApp.shutdown();
      IModelApp.startup({
        renderSys: {
          disabledExtensions: ["WEBGL_draw_buffers"],
        },
      });

      expect(System.instance.techniques.compileShaders()).to.be.true;
      IModelApp.shutdown();
      IModelApp.startup();
    }
  }).timeout("160000");

  it("should successfully compile surface shader with clipping planes", () => {
    const flags = new TechniqueFlags(true);
    flags.clip.type = ClippingType.Planes;
    flags.clip.numberOfPlanes = 6;
    flags.featureMode = FeatureMode.Overrides;

    const tech = System.instance.techniques.getTechnique(TechniqueId.Surface);
    const prog = tech.getShader(flags);
    expect(prog.compile()).to.be.true;
  });

  it("should produce exception on syntax error", () => {
    const builder = createPurpleQuadBuilder();
    builder.vert.headerComment = "// My Naughty Program";
    builder.frag.set(FragmentShaderComponent.ComputeBaseColor, "blah blah blah");
    const prog = builder.buildProgram(System.instance.context);
    let compiled = false;
    let ex: Error | undefined;
    try {
      compiled = prog.compile();
    } catch (err) {
      ex = err;
    }

    expect(compiled).to.be.false;
    expect(ex).not.to.be.undefined;
    const msg = ex!.toString();
    expect(msg.includes("blah")).to.be.true;
    expect(msg.includes("Fragment shader failed to compile")).to.be.true;
    expect(msg.includes("Program description: // My Naughty Program")).to.be.true;
  });

  // NB: We may run across some extremely poor webgl implementation that fails to remove clearly-unused uniforms, which would cause this test to fail.
  // If such an implementation exists, we'd like to know about it.
  it("should produce exception on unused uniform", () => {
    const builder = createPurpleQuadBuilder();
    builder.frag.addUniform("u_unused", VariableType.Float, (prog) => {
      prog.addProgramUniform("u_unused", (uniform, _params) => {
        uniform.setUniform1f(123.45);
      });
    });

    const program = builder.buildProgram(System.instance.context);
    let compiled = false;
    let ex: Error | undefined;
    try {
      compiled = program.compile();
    } catch (err) {
      ex = err;
    }

    expect(compiled).to.be.false;
    expect(ex).not.to.be.undefined;
    expect(ex!.toString().includes("uniform u_unused not found.")).to.be.true;
  });
});
