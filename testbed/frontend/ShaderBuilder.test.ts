/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import { VariableType, ShaderVariable } from "@bentley/imodeljs-frontend/lib/rendering";

describe("Variable declaration tests", () => {
  it("should convert ShaderVariable to glsl declaration", () => {
    let variable = ShaderVariable.createGlobal("x", VariableType.Float, "1.0", true);
    expect(variable.buildDeclaration()).to.equal("const float x = 1.0;");

    variable = ShaderVariable.createGlobal("x", VariableType.Vec3, "vec3(1.0, 0.5, 0.0)");
    expect(variable.buildDeclaration()).to.equal("vec3 x = vec3(1.0, 0.5, 0.0);");

    variable = ShaderVariable.createGlobal("x", VariableType.Mat4);
    expect(variable.buildDeclaration()).to.equal("mat4 x;");
  });
});
