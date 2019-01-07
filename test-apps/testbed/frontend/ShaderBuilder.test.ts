/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

import { expect, assert } from "chai";
import { WebGLTestContext } from "./WebGLTestContext";
import { IModelApp } from "@bentley/imodeljs-frontend";
import {
  System,
  VariableType,
  VariableScope,
  VariablePrecision,
  ShaderVariable,
  ShaderVariables,
  ShaderProgram,
  ProgramBuilder,
  VertexShaderComponent,
  FragmentShaderComponent,
} from "@bentley/imodeljs-frontend/lib/webgl";

describe("Variable declaration tests", () => {
  it("should convert ShaderVariable to glsl declaration", () => {
    let variable = ShaderVariable.createGlobal("x", VariableType.Float, "1.0", true);
    expect(variable.buildDeclaration()).to.equal("const float x = 1.0;");

    variable = ShaderVariable.createGlobal("x", VariableType.Vec3, "vec3(1.0, 0.5, 0.0)");
    expect(variable.buildDeclaration()).to.equal("vec3 x = vec3(1.0, 0.5, 0.0);");

    variable = ShaderVariable.createGlobal("x", VariableType.Mat4);
    expect(variable.buildDeclaration()).to.equal("mat4 x;");

    variable = ShaderVariable.create("x", VariableType.Vec2, VariableScope.Varying);
    expect(variable.buildDeclaration()).to.equal("varying vec2 x;");

    variable = ShaderVariable.create("x", VariableType.Sampler2D, VariableScope.Uniform, undefined, VariablePrecision.Medium);
    expect(variable.buildDeclaration()).to.equal("uniform mediump sampler2D x;");
  });

  it("should convert contents of ShaderVariables to glsl declaration", () => {
    const vars = new ShaderVariables();
    const fakeBinding = (prog: ShaderProgram) => {
      assert.isTrue(prog !== prog); // shut up the stupid compiler complaining about unused function arg...
    };

    vars.addUniform("x", VariableType.Float, fakeBinding, VariablePrecision.High);
    vars.addAttribute("y", VariableType.Vec4, fakeBinding);
    vars.addVarying("z", VariableType.Int);
    vars.addGlobal("w", VariableType.Int, "123", true);

    const parts = [
      "uniform highp float x;",
      "attribute vec4 y;",
      "varying int z;",
      "const int w = 123;\n",
    ];

    const expectedDecls = parts.join("\n");
    expect(vars.buildDeclarations()).to.equal(expectedDecls);
  });
});

describe("ShaderVariables tests", () => {
  it("should not allow 2 variables with same name", () => {
    const vars = new ShaderVariables();
    expect(vars.length).to.equal(0);
    vars.addGlobal("x", VariableType.Float);
    expect(vars.length).to.equal(1);
    vars.addGlobal("x", VariableType.Float);
    expect(vars.length).to.equal(1);
  });

  it("should find variables", () => {
    const vars = new ShaderVariables();
    expect(vars.find("x")).to.equal(undefined);
    vars.addGlobal("x", VariableType.Int);
    const found = vars.find("x");
    assert.isFalse(undefined === found);
    expect(found!.name).to.equal("x");
  });
});

describe("Test shader compilation", () => {
  before(() => WebGLTestContext.startup());
  after(() => WebGLTestContext.shutdown());

  it.skip("should build and compile a simple shader program", () => {
    const builder = new ProgramBuilder(false);
    builder.vert.set(VertexShaderComponent.ComputePosition, "return vec4(0.0);");
    builder.frag.set(FragmentShaderComponent.ComputeBaseColor, "return vec4(1.0);");
    builder.frag.set(FragmentShaderComponent.AssignFragData, "FragColor = baseColor;");

    if (!IModelApp.hasRenderSystem) {
      return;
    }

    const prog = builder.buildProgram(System.instance.context);
    expect(prog.isDisposed).to.equal(false);
    expect(prog.isUncompiled).to.equal(true);
    expect(prog.compile()).to.equal(true);
    expect(prog.isUncompiled).to.equal(false);

    prog.dispose();
    expect(prog.isDisposed).to.equal(true);
    expect(prog.isUncompiled).to.equal(true);
  });
});
