/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { assert, expect } from "chai";
import { Schema, SchemaContext } from "@bentley/ecschema-metadata";
import { IModelApp } from "../../../IModelApp";
import { RenderSystem } from "../../../render/RenderSystem";
import { AttributeMap } from "../../../render/webgl/AttributeMap";
import { ViewportQuadGeometry } from "../../../render/webgl/CachedGeometry";
import { DrawParams, ShaderProgramParams } from "../../../render/webgl/DrawCommand";
import { FragmentShaderComponent, ProgramBuilder, VariableType, VertexShaderComponent } from "../../../render/webgl/ShaderBuilder";
import { CompileStatus } from "../../../render/webgl/ShaderProgram";
import { System } from "../../../render/webgl/System";
import { Target } from "../../../render/webgl/Target";
import { SingularTechnique } from "../../../render/webgl/Technique";
import { FeatureMode, TechniqueFlags } from "../../../render/webgl/TechniqueFlags";
import { TechniqueId } from "../../../render/webgl/TechniqueId";
import { UnitSchemaString } from "../../public/assets/UnitSchema/UnitSchema";

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
    canvas = document.createElement("canvas");
    if (null !== canvas) {
      canvas.id = "WebGLTestCanvas";
      document.body.appendChild(document.createTextNode("WebGL tests"));
      document.body.appendChild(canvas);
    }
  }
  canvas.width = 300;
  canvas.height = 150;
  assert(undefined !== canvas);
  return System.instance.createTarget(canvas) as Target;
}

describe("Techniques", () => {
  before(async () => {
    const schemaContext = new SchemaContext();
    Schema.fromJsonSync(UnitSchemaString, schemaContext);
    await IModelApp.startup({ schemaContext })
  });
  after(async () => IModelApp.shutdown());

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

  // NB: compiling all shaders can potentially take a long time, especially on our mac build machines.
  const compileTimeout = "95000";
  async function compileAllShaders(opts?: RenderSystem.Options): Promise<void> {
    if (undefined !== opts) {
      // Replace current render system with customized one
      await IModelApp.shutdown();
      const schemaContext = new SchemaContext();
      Schema.fromJsonSync(UnitSchemaString, schemaContext);
      await IModelApp.startup({ renderSys: opts, schemaContext, });
    }

    expect(System.instance.techniques.compileShaders()).to.be.true;

    if (undefined !== opts) {
      // Reset render system to default state
      await IModelApp.shutdown();
      const schemaContext = new SchemaContext();
      Schema.fromJsonSync(UnitSchemaString, schemaContext);
      await IModelApp.startup({ schemaContext });
    }
  }

  let haveWebGL2 = false; // currently we only use webgl 2 if explicitly enabled at startup
  it("should compile all shader programs with WebGL 1", async () => {
    haveWebGL2 = System.instance.capabilities.isWebGL2;
    if (!haveWebGL2) {
      const canvas = document.createElement("canvas");
      haveWebGL2 = null !== canvas.getContext("webgl2");
    }

    await compileAllShaders({ useWebGL2: false });
  }).timeout(compileTimeout);

  it("should successfully compile all shader programs with WebGL 2", async () => {
    if (haveWebGL2)
      await compileAllShaders({ useWebGL2: true });
  }).timeout(compileTimeout);

  it("should compile all shader programs without MRT", async () => {
    if (System.instance.capabilities.supportsDrawBuffers) {
      // WebGL 2 always supports MRT - must use WebGL 1 context to test.
      await compileAllShaders({ disabledExtensions: ["WEBGL_draw_buffers"], useWebGL2: false });
    }
  }).timeout(compileTimeout);

  it("should compile all shader programs without logarithmic depth", async () => {
    if (System.instance.supportsLogZBuffer)
      await compileAllShaders({ logarithmicDepthBuffer: false, useWebGL2: false });
  }).timeout(compileTimeout);

  it("should successfully compile surface shader with clipping planes", () => {
    const flags = new TechniqueFlags(true);
    flags.numClipPlanes = 6;
    flags.featureMode = FeatureMode.Overrides;

    const tech = System.instance.techniques.getTechnique(TechniqueId.Surface);
    const prog = tech.getShader(flags);
    expect(prog.compile() === CompileStatus.Success).to.be.true;
  });

  it("should produce exception on syntax error", () => {
    const builder = createPurpleQuadBuilder();
    builder.vert.headerComment = "// My Naughty Program";
    builder.frag.set(FragmentShaderComponent.ComputeBaseColor, "blah blah blah");
    const prog = builder.buildProgram(System.instance.context);
    let compiled = false;
    let ex: Error | undefined;
    try {
      compiled = prog.compile() === CompileStatus.Success;
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
      compiled = program.compile() === CompileStatus.Success;
    } catch (err) {
      ex = err;
    }

    expect(compiled).to.be.false;
    expect(ex).not.to.be.undefined;
    expect(ex!.toString().includes("uniform u_unused not found.")).to.be.true;
  });
});
