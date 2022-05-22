/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { assert, expect } from "chai";
import { IModelApp } from "../../../IModelApp";
import { ShaderProgram } from "../../../render/webgl/ShaderProgram";
import {
  ShaderVariable, ShaderVariables, VariablePrecision, VariableScope, VariableType,
} from "../../../render/webgl/ShaderBuilder";
import { System } from "../../../render/webgl/System";

describe("ShaderBuilder", () => {
  before(async () => IModelApp.startup());
  after(async () => IModelApp.shutdown());

  it("should convert ShaderVariable to glsl declaration", () => {
    let variable = ShaderVariable.createGlobal("x", VariableType.Float, "1.0", true);
    expect(variable.buildDeclaration(true)).to.equal("const float x = 1.0;");

    variable = ShaderVariable.createGlobal("x", VariableType.Vec3, "vec3(1.0, 0.5, 0.0)");
    expect(variable.buildDeclaration(true)).to.equal("vec3 x = vec3(1.0, 0.5, 0.0);");

    variable = ShaderVariable.createGlobal("x", VariableType.Mat4);
    expect(variable.buildDeclaration(true)).to.equal("mat4 x;");

    variable = ShaderVariable.create("x", VariableType.Vec2, VariableScope.Varying);
    if (System.instance.capabilities.isWebGL2) {
      expect(variable.buildDeclaration(true)).to.equal("out vec2 x;");
      expect(variable.buildDeclaration(false)).to.equal("in vec2 x;");
    } else
      expect(variable.buildDeclaration(true)).to.equal("varying vec2 x;");

    variable = ShaderVariable.create("x", VariableType.Sampler2D, VariableScope.Uniform, undefined, VariablePrecision.Medium);
    expect(variable.buildDeclaration(true)).to.equal("uniform mediump sampler2D x;");
  });

  it("should convert contents of ShaderVariables to glsl declaration", () => {
    const vars = new ShaderVariables();
    const fakeBinding = (prog: ShaderProgram) => {
      assert.isTrue(prog !== prog); // shut up the stupid compiler complaining about unused function arg...
    };

    vars.addUniform("x", VariableType.Float, fakeBinding, VariablePrecision.High);
    vars.addVarying("z", VariableType.Int);
    vars.addGlobal("w", VariableType.Int, "123", true);

    const parts = [
      "uniform highp float x;",
      "const int w = 123;",
      "varying int z;\n",
    ];

    const partsWebGL2 = [
      "uniform highp float x;",
      "const int w = 123;",
      "out int z;\n",
    ];

    const expectedDecls = (System.instance.capabilities.isWebGL2 ? partsWebGL2.join("\n") : parts.join("\n"));
    expect(vars.buildDeclarations(true)).to.equal(expectedDecls);
  });

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
