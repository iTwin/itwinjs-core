/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { Schema, SchemaContext } from "@bentley/ecschema-metadata";
import { IModelApp } from "../../../IModelApp";
import { BuffersContainer, VAOContainer, VBOContainer } from "../../../render/webgl/AttributeBuffers";
import { UNIT_SCHEMA_STRING } from "../../public/assets/UnitSchema/UnitSchema";

describe("BuffersContainer", () => {
  afterEach(async () => {
    if (IModelApp.initialized)
      await IModelApp.shutdown();
  });

  it("should use VAO if enabled", async () => {
    const schemaContext = new SchemaContext();
    Schema.fromJsonSync(UNIT_SCHEMA_STRING, schemaContext);
    await IModelApp.startup({ schemaContext });
    const buffers = BuffersContainer.create();
    expect(buffers instanceof VAOContainer).to.be.true;
  });

  it("should use VBO is VAOs disabled", async () => {
    const schemaContext = new SchemaContext();
    Schema.fromJsonSync(UNIT_SCHEMA_STRING, schemaContext);
    await IModelApp.startup({
      renderSys: {
        useWebGL2: false,
        disabledExtensions: ["OES_vertex_array_object"],
      },
      schemaContext,
    });

    const buffers = BuffersContainer.create();
    expect(buffers instanceof VBOContainer).to.be.true;
  });
});
