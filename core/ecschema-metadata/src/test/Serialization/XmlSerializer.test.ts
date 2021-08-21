/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { assert } from "chai";
import { SchemaContext } from "../../Context";
import { MutableSchema, Schema } from "../../Metadata/Schema";
import { MutableEntityClass } from "../../Metadata/EntityClass";

describe("XmlSerializer", () => {
  it("try serializing attributes with html entities '<' '&' ", async () => {
    const ctx = new SchemaContext();
    const schema = new Schema(ctx, "TestSchema", "ts", 1, 0, 0) as MutableSchema;
    const entityClass = (await schema.createEntityClass("TestElement")) as MutableEntityClass;
    entityClass.setDisplayLabel("escape < us & please; except > I'm ok apparently");
    const serializedXml = await schema.toXmlString();

    // use regex to find the displayLabel quote, because the DOMParser implementation could be lenient
    assert(
      /displayLabel\s*=\s*"escape &lt; us &amp; please; except > I'm ok apparently"/.test(serializedXml),
      "< and & must be escaped in serialized xml"
    );
  });
});
