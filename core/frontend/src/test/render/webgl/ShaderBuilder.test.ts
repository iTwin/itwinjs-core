/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { IModelApp } from "../../../IModelApp";
import { ShaderProgram } from "../../../render/webgl/ShaderProgram";
import { ShaderVariable, ShaderVariables, VariablePrecision, VariableScope, VariableType } from "../../../render/webgl/ShaderBuilder";
import { EmptyLocalization } from "@itwin/core-common";

describe("ShaderBuilder", () => {
  beforeAll(async () => IModelApp.startup({ localization: new EmptyLocalization() }));
  afterAll(async () => IModelApp.shutdown());

  it("should convert ShaderVariable to glsl declaration", () => {
    let variable = ShaderVariable.createGlobal("x", VariableType.Float, "1.0", true);
    expect(variable.buildDeclaration(true)).toEqual("const float x = 1.0;");

    variable = ShaderVariable.createGlobal("x", VariableType.Vec3, "vec3(1.0, 0.5, 0.0)");
    expect(variable.buildDeclaration(true)).toEqual("vec3 x = vec3(1.0, 0.5, 0.0);");

    variable = ShaderVariable.createGlobal("x", VariableType.Mat4);
    expect(variable.buildDeclaration(true)).toEqual("mat4 x;");

    variable = ShaderVariable.create("x", VariableType.Vec2, VariableScope.Varying);
    expect(variable.buildDeclaration(true)).toEqual("out vec2 x;");
    expect(variable.buildDeclaration(false)).toEqual("in vec2 x;");

    variable = ShaderVariable.create("x", VariableType.Sampler2D, VariableScope.Uniform, undefined, VariablePrecision.Medium);
    expect(variable.buildDeclaration(true)).toEqual("uniform mediump sampler2D x;");
  });

  it("should convert contents of ShaderVariables to glsl declaration", () => {
    const vars = new ShaderVariables();
    const fakeBinding = (prog: ShaderProgram) => {
      expect(prog).not.toBe(prog); // shut up the stupid compiler complaining about unused function arg...
    };

    vars.addUniform("x", VariableType.Float, fakeBinding, VariablePrecision.High);
    vars.addVarying("z", VariableType.Int);
    vars.addGlobal("w", VariableType.Int, "123", true);

    const expectedDecls = ["uniform highp float x;", "const int w = 123;", "out int z;\n"].join("\n");

    expect(vars.buildDeclarations(true)).toEqual(expectedDecls);
  });

  it("should not allow 2 variables with same name", () => {
    const vars = new ShaderVariables();
    expect(vars.length).toEqual(0);
    vars.addGlobal("x", VariableType.Float);
    expect(vars.length).toEqual(1);
    vars.addGlobal("x", VariableType.Float);
    expect(vars.length).toEqual(1);
  });

  it("should find variables", () => {
    const vars = new ShaderVariables();
    expect(vars.find("x")).toEqual(undefined);
    vars.addGlobal("x", VariableType.Int);
    const found = vars.find("x");
    expect(found).not.toBeUndefined();
    expect(found!.name).toEqual("x");
  });
});
