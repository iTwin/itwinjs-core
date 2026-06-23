/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { describe, expect, it } from "vitest";
import { decodeSchemaText, ECSpec, parseVersionString } from "../../Authoring/SchemaDocumentIO";
import { SchemaDocument } from "../../Authoring/SchemaDocument";
import { SchemaJsonWriter } from "../../Authoring/SchemaJsonWriter";
import { SchemaXmlWriter } from "../../Authoring/SchemaXmlWriter";

async function collect(text: Parameters<typeof decodeSchemaText>[0]): Promise<string> {
  let result = "";
  for await (const chunk of decodeSchemaText(text))
    result += chunk;
  return result;
}

describe("decodeSchemaText", () => {
  it("passes a plain string through as one chunk", async () => {
    expect(await collect("hello")).to.equal("hello");
  });

  it("decodes UTF-8 bytes", async () => {
    expect(await collect(new TextEncoder().encode("Grüße ⌀"))).to.equal("Grüße ⌀");
  });

  it("decodes an async iterable of mixed chunks, reassembling a multi-byte character split across byte chunks", async () => {
    const bytes = new TextEncoder().encode("⌀"); // 3 bytes
    async function* chunks(): AsyncGenerator<string | Uint8Array> {
      yield "a";
      yield bytes.subarray(0, 1); // partial code point - must not surface as U+FFFD
      yield bytes.subarray(1);
      yield "z";
    }
    expect(await collect(chunks())).to.equal("a⌀z");
  });

  it("pulls input lazily and closes it when the consumer stops early", async () => {
    let served = 0;
    let finallyRan = false;
    async function* chunks(): AsyncGenerator<string> {
      try {
        for (;;) {
          ++served;
          yield "x";
        }
      } finally {
        finallyRan = true;
      }
    }
    for await (const chunk of decodeSchemaText(chunks())) {
      expect(chunk).to.equal("x");
      break; // stop after the first chunk
    }
    expect(served).to.be.lessThan(3);
    expect(finallyRan).to.be.true;
  });
});

describe("parseVersionString", () => {
  it("parses padded and unpadded forms", () => {
    expect(parseVersionString("01.00.03")).to.deep.equal({ read: 1, write: 0, minor: 3 });
    expect(parseVersionString("1.0.3")).to.deep.equal({ read: 1, write: 0, minor: 3 });
  });

  it("returns undefined for anything but three dotted numbers", () => {
    expect(parseVersionString(undefined)).to.be.undefined;
    expect(parseVersionString("")).to.be.undefined;
    expect(parseVersionString("1.0")).to.be.undefined;
    expect(parseVersionString("1.0.0.0")).to.be.undefined;
    expect(parseVersionString("a.b.c")).to.be.undefined;
  });
});

describe("writer spec dispatch", () => {
  const doc = new SchemaDocument("SpecTest", "st", 1, 0, 0);

  it("the XML writer rejects an unsupported target spec with an issue, producing no text", () => {
    const result = new SchemaXmlWriter().writeDocument(doc, { spec: "2.0" as ECSpec });
    expect(result.text).to.be.undefined;
    expect(result.issues.errors.map((e) => e.code)).to.deep.equal(["SchemaXml-0001"]);
  });

  it("the JSON writer rejects an unsupported target spec with an issue, producing no text", () => {
    const result = new SchemaJsonWriter().writeDocument(doc, { spec: "2.0" as ECSpec });
    expect(result.text).to.be.undefined;
    expect(result.issues.errors.map((e) => e.code)).to.deep.equal(["SchemaJson-0001"]);
  });

  it("ECSpec.Latest writes the same output as the explicit latest spec", () => {
    const writer = new SchemaJsonWriter();
    expect(writer.writeDocument(doc, { spec: ECSpec.Latest }).text).to.equal(writer.writeDocument(doc, { spec: ECSpec.V3_2 }).text);
  });
});
