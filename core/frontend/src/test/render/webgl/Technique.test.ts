/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { IModelApp } from "../../../IModelApp";
import { AttributeMap } from "../../../render/webgl/AttributeMap";
import { CompileStatus } from "../../../render/webgl/ShaderProgram";
import { DrawParams, ShaderProgramParams } from "../../../render/webgl/DrawCommand";
import { FeatureMode, TechniqueFlags } from "../../../render/webgl/TechniqueFlags";
import { FragmentShaderComponent, ProgramBuilder, VariableType, VertexShaderComponent } from "../../../render/webgl/ShaderBuilder";
import { SingularTechnique, Techniques } from "../../../render/webgl/Technique";
import { System } from "../../../render/webgl/System";
import { Target } from "../../../render/webgl/Target";
import { TechniqueId } from "../../../render/webgl/TechniqueId";
import { ViewportQuadGeometry } from "../../../render/webgl/CachedGeometry";
import { Logger, LogLevel } from "@itwin/core-bentley";
import { EmptyLocalization } from "@itwin/core-common";

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
  expect(canvas).not.toBeUndefined();
  return System.instance.createTarget(canvas) as Target;
}

describe("Techniques", () => {
  beforeAll(async () => {
    await IModelApp.startup({
      renderSys: { errorOnMissingUniform: true },
      localization: new EmptyLocalization(),
    });
    Logger.initializeToConsole();
    Logger.setLevel("core-frontend.Render", LogLevel.Error);
  });

  afterAll(async () => {
    await IModelApp.shutdown();
  });

  it("should produce a simple dynamic rendering technique", () => {
    const target = createTarget();
    expect(target).toBeDefined();

    const techId = createPurpleQuadTechnique();
    expect(techId).toEqual(TechniqueId.NumBuiltIn);
  });

  it("should render a purple quad", () => {
    const target = createTarget();
    expect(target).not.toBeUndefined();
    if (undefined === target) {
      return;
    }

    const techId = createPurpleQuadTechnique();
    const geom = ViewportQuadGeometry.create(techId);
    expect(geom).toBeDefined();

    const progParams = new ShaderProgramParams();
    progParams.init(target);
    const drawParams = new DrawParams();
    drawParams.init(progParams, geom!);
    target.techniques.draw(drawParams);
  });

  // NB: compiling all shaders can potentially take a long time, especially on our mac build machines.
  // A timeout of zero means no timeout.
  const compileTimeout = 0;
  async function compileAllShaders(): Promise<void> {
    expect(System.instance.techniques.compileShaders()).toBe(true);
  }

  it("should compile all shader programs", { timeout: compileTimeout !== 0 ? compileTimeout : undefined }, async () => {
    await compileAllShaders();
  });

  it("should successfully compile surface shader with clipping planes", () => {
    const flags = new TechniqueFlags(true);
    flags.numClipPlanes = 6;
    flags.featureMode = FeatureMode.Overrides;

    const tech = System.instance.techniques.getTechnique(TechniqueId.Surface);
    const prog = tech.getShader(flags);
    expect(prog.compile() === CompileStatus.Success).toBe(true);
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
    } catch (err: any) {
      ex = err;
    }

    expect(compiled).toBe(false);
    expect(ex).toBeDefined();
    const msg = ex!.toString();
    expect(msg.includes("blah")).toBe(true);
    expect(msg.includes("Fragment shader failed to compile")).toBe(true);
    expect(msg.includes("Program description: // My Naughty Program")).toBe(true);
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
    } catch (err: any) {
      ex = err;
    }

    expect(compiled).toBe(false);
    expect(ex).toBeDefined();
    expect(ex!.toString().includes("uniform u_unused not found")).toBe(true);
  });

  describe("Number of varying vectors", () => {
    const buildProgram = ProgramBuilder.prototype.buildProgram; // eslint-disable-line @typescript-eslint/unbound-method
    afterAll(() => (ProgramBuilder.prototype.buildProgram = buildProgram));

    it("does not exceed minimum guaranteed", () => {
      // GL_MAX_VARYING_VECTORS must be at least 8 on WebGL 1 and 15 on WebGL 2.
      // iOS's WebGL 1 implementation gives us only the minimum 8.
      // Our wiremesh shaders use 9, but they are only ever produced for WebGL 2, because they use gl_VertexID which is only supported in WebGL 2.
      const minGuaranteed = 15;

      let numBuilt = 0;
      let maxNumVaryings = 0;
      ProgramBuilder.prototype.buildProgram = function (gl) {
        ++numBuilt;
        const numVaryings = this.vert.computeNumVaryingVectors(this.frag.buildSource());
        expect(numVaryings).most(minGuaranteed);
        maxNumVaryings = Math.max(numVaryings, maxNumVaryings);
        return buildProgram.apply(this, [gl]);
      };

      Techniques.create(System.instance.context);
      expect(numBuilt).least(100);
      expect(maxNumVaryings).least(8);
    });
  });
});
