/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { assert } from "chai";
import { SchemaContext } from "../../Context";
import { MutableSchema, Schema } from "../../Metadata/Schema";
import { DOMParser, XMLSerializer } from "xmldom";
import { MutableEntityClass } from "../../Metadata/EntityClass";

describe("XmlSerializer", () => {
  it("roundtrip attributes with html entities '<' '&' ", async () => {
    const ctx = new SchemaContext();
    const schema = new Schema(ctx, "TestSchema", "ts", 1, 0, 0) as MutableSchema;
    const entityClass = (await schema.createEntityClass("TestElement")) as MutableEntityClass;
    entityClass.setDisplayLabel("escape < us & please; except > I'm ok apparently");
    const serializedXml = await schema.toXmlString();

    //const xmlDoc = new DOMParser().parseFromString(`<?xml version="1.0" encoding="UTF-8"?>`, "application/xml");
    //const filledDoc = await schema.toXml(xmlDoc);


    const domParser = new DOMParser();
    let deserializedDoc: Document;
    assert.doesNotThrow(() => (deserializedDoc = domParser.parseFromString(serializedXml)), "");
  });
});
