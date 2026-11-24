/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import * as ts from "typescript";
import { SchemaXmlFileLocater } from "@itwin/ecschema-locaters";
import { ECSchemaNamespaceUris, Schema, SchemaContext } from "@itwin/ecschema-metadata";
import { ECSchemaToTs } from "../ecschema2ts";
import * as utils from "./utilities/utils";

const allowedStatementKinds = new Set<ts.SyntaxKind>([
  ts.SyntaxKind.ImportDeclaration,
  ts.SyntaxKind.ClassDeclaration,
  ts.SyntaxKind.EnumDeclaration,
  ts.SyntaxKind.InterfaceDeclaration,
]);

/** Parse generated typescript and ensure it is syntactically valid and only contains the expected kinds of top-level declarations. */
function expectSafeTypescript(source: string, expectedEnumNames: string[] = []): void {
  const transpiled = ts.transpileModule(source, { reportDiagnostics: true, compilerOptions: { target: ts.ScriptTarget.ES2022 } });
  const messages = (transpiled.diagnostics ?? []).map((d) => ts.flattenDiagnosticMessageText(d.messageText, "\n"));
  expect(messages, source).to.be.empty;

  const sourceFile = ts.createSourceFile("generated.ts", source, ts.ScriptTarget.ES2022, true);
  const enumNames: string[] = [];
  for (const statement of sourceFile.statements) {
    expect(allowedStatementKinds.has(statement.kind), `Unexpected ${ts.SyntaxKind[statement.kind]} in:\n${source}`).to.be.true;
    if (ts.isEnumDeclaration(statement)) {
      enumNames.push(statement.name.text);
      // Duplicate enum members are a semantic error that transpileModule does not report.
      const memberNames = statement.members.map((member) => member.name.getText(sourceFile));
      expect(new Set(memberNames).size, `Duplicate members in enum ${statement.name.text}: ${memberNames.join(", ")}`).to.equal(memberNames.length);
    }
  }

  expect(enumNames).to.deep.equal(expectedEnumNames);
}

function convertXml(schemaXml: string) {
  const locator = new SchemaXmlFileLocater();
  locator.addSchemaSearchPath(`${utils.getAssetsDir()}schema3.2`);
  const context = new SchemaContext();
  context.addLocater(locator);
  const schema = utils.deserializeXml(context, schemaXml);
  return new ECSchemaToTs().convertSchemaToTs(schema);
}

const injectedCode = "globalThis.__pwned = 1;";

describe("ecschema2ts escapes schema metadata", () => {
  it("does not allow descriptions to close the generated comment", () => {
    const description = `*/ ${injectedCode} /*`;
    const result = convertXml(`<?xml version="1.0" encoding="utf-8"?>
      <ECSchema schemaName="TestSchema" alias="ts" version="1.0.0" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.2">
        <ECSchemaReference name="CoreCustomAttributes" version="1.0.0" alias="CoreCA"/>
        <ECEnumeration typeName="TestEnum" backingTypeName="int" description="${description}" isStrict="true">
          <ECEnumerator name="Enumerator1" value="1" displayLabel="First"/>
        </ECEnumeration>
        <ECEntityClass typeName="TestEntity" description="${description}&#10;${injectedCode}&#13;${injectedCode}">
          <ECProperty propertyName="Prop" typeName="string" />
        </ECEntityClass>
        <ECEntityClass typeName="TestMixin" description="${description}">
          <ECCustomAttributes>
            <IsMixin xmlns="CoreCustomAttributes.1.0">
              <AppliesToEntityClass>TestEntity</AppliesToEntityClass>
            </IsMixin>
          </ECCustomAttributes>
        </ECEntityClass>
        <ECStructClass typeName="TestStruct" description="${description}">
        </ECStructClass>
      </ECSchema>`);

    const expectedComment = `/**\n * *\\/ ${injectedCode} /*\n */`;
    expect(result.elemTsString).to.have.string(`${expectedComment}\nexport const enum TestEnum {`);
    expect(result.elemTsString).to.have.string(`/**\n * *\\/ ${injectedCode} /* ${injectedCode} ${injectedCode}\n */\nexport class TestEntity extends Entity`);
    expect(result.propsTsString).to.have.string(`${expectedComment}\nexport interface TestMixin {`);
    expect(result.propsTsString).to.have.string(`${expectedComment}\nexport interface TestStruct {`);

    expectSafeTypescript(result.schemaTsString);
    expectSafeTypescript(result.elemTsString, ["TestEnum"]);
    expectSafeTypescript(result.propsTsString);
  });

  it("encodes string enumerator values as string literals", () => {
    const result = convertXml(`<?xml version="1.0" encoding="utf-8"?>
      <ECSchema schemaName="TestSchema" alias="ts" version="1.0.0" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.2">
        <ECEnumeration typeName="TestEnum" backingTypeName="string" isStrict="true">
          <ECEnumerator name="Enumerator1" value="a&quot;, } ${injectedCode} export const enum Z { B = &quot;" displayLabel="First"/>
          <ECEnumerator name="Enumerator2" value="back\\slash&#10;newline" displayLabel="Second"/>
        </ECEnumeration>
      </ECSchema>`);

    expect(result.elemTsString).to.have.string(`  First = "a\\", } ${injectedCode} export const enum Z { B = \\"",\n`);
    expect(result.elemTsString).to.have.string(`  Second = "back\\\\slash\\nnewline",\n`);
    expectSafeTypescript(result.elemTsString, ["TestEnum"]);
  });

  it("falls back to the enumerator name when the display label is not a valid identifier", () => {
    const result = convertXml(`<?xml version="1.0" encoding="utf-8"?>
      <ECSchema schemaName="TestSchema" alias="ts" version="1.0.0" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.2">
        <ECEnumeration typeName="TestEnum" backingTypeName="int" isStrict="true">
          <ECEnumerator name="Enumerator1" value="1" displayLabel="X = 1, } ${injectedCode} export const enum Z { Y"/>
          <ECEnumerator name="Enumerator2" value="2" displayLabel=""/>
          <ECEnumerator name="Enumerator3" value="3"/>
          <ECEnumerator name="Enumerator4" value="4" displayLabel="Valid_Label$4"/>
        </ECEnumeration>
      </ECSchema>`);

    expect(result.elemTsString).to.have.string(utils.dedent`
      export const enum TestEnum {
        Enumerator1 = 1,
        Enumerator2 = 2,
        Enumerator3 = 3,
        Valid_Label$4 = 4,
      }`);
    expectSafeTypescript(result.elemTsString, ["TestEnum"]);
  });

  it("uses the enumerator names for every member when display labels and fallback names collide", () => {
    const result = convertXml(`<?xml version="1.0" encoding="utf-8"?>
      <ECSchema schemaName="TestSchema" alias="ts" version="1.0.0" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.2">
        <ECEnumeration typeName="LabelMatchesFallback" backingTypeName="int" isStrict="true">
          <ECEnumerator name="First" value="1" displayLabel="Second"/>
          <ECEnumerator name="Second" value="2"/>
        </ECEnumeration>
        <ECEnumeration typeName="FallbackMatchesLabel" backingTypeName="string" isStrict="true">
          <ECEnumerator name="Alpha" value="a" displayLabel="Not an identifier"/>
          <ECEnumerator name="Beta" value="b" displayLabel="Alpha"/>
        </ECEnumeration>
        <ECEnumeration typeName="DuplicateLabels" backingTypeName="int" isStrict="true">
          <ECEnumerator name="One" value="1" displayLabel="Same"/>
          <ECEnumerator name="Two" value="2" displayLabel="Same"/>
        </ECEnumeration>
        <ECEnumeration typeName="NoCollision" backingTypeName="int" isStrict="true">
          <ECEnumerator name="One" value="1" displayLabel="Uno"/>
          <ECEnumerator name="Two" value="2"/>
        </ECEnumeration>
      </ECSchema>`);

    expect(result.elemTsString).to.have.string(utils.dedent`
      export const enum LabelMatchesFallback {
        First = 1,
        Second = 2,
      }`);
    expect(result.elemTsString).to.have.string(utils.dedent`
      export const enum FallbackMatchesLabel {
        Alpha = "a",
        Beta = "b",
      }`);
    expect(result.elemTsString).to.have.string(utils.dedent`
      export const enum DuplicateLabels {
        One = 1,
        Two = 2,
      }`);
    // Enumerations without a collision keep their display labels.
    expect(result.elemTsString).to.have.string(utils.dedent`
      export const enum NoCollision {
        Uno = 1,
        Two = 2,
      }`);
    expectSafeTypescript(result.elemTsString, ["LabelMatchesFallback", "FallbackMatchesLabel", "DuplicateLabels", "NoCollision"]);
  });

  it("escapes descriptions, labels and values from JSON schemas", () => {
    const schemaJson = {
      $schema: ECSchemaNamespaceUris.SCHEMAURL3_2_JSON,
      name: "TestSchema",
      version: "1.0.0",
      alias: "ts",
      items: {
        TestEnum: { // eslint-disable-line @typescript-eslint/naming-convention
          schemaItemType: "Enumeration",
          type: "string",
          isStrict: true,
          description: `line1\n*/ ${injectedCode}\r\nline3\u2028${injectedCode}\u2029end`,
          enumerators: [
            { name: "Enumerator1", value: `a"\u2028${injectedCode}`, label: `X\n${injectedCode}` },
          ],
        },
      },
    };

    const schema = Schema.fromJsonSync(schemaJson, new SchemaContext());
    const result = new ECSchemaToTs().convertSchemaToTs(schema);

    expect(result.elemTsString).to.have.string(utils.dedent`
      /**
       * line1 *\\/ ${injectedCode} line3 ${injectedCode} end
       */
      export const enum TestEnum {
        Enumerator1 = "a\\"\\u2028${injectedCode}",
      }`);
    expectSafeTypescript(result.elemTsString, ["TestEnum"]);
  });

  it("does not change the output of benign schema metadata", () => {
    const result = convertXml(`<?xml version="1.0" encoding="utf-8"?>
      <ECSchema schemaName="TestSchema" alias="ts" version="1.0.0" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.2">
        <ECEnumeration typeName="TestEnum" backingTypeName="string" description="A normal * description / with symbols" isStrict="true">
          <ECEnumerator name="Enumerator1" value="spring" displayLabel="FirstSeason"/>
          <ECEnumerator name="Enumerator2" value="it's summer" displayLabel="Größe"/>
        </ECEnumeration>
      </ECSchema>`);

    expect(result.elemTsString).to.equal(`${utils.dedent`
      /**
       * A normal * description / with symbols
       */
      export const enum TestEnum {
        FirstSeason = "spring",
        Größe = "it's summer",
      }`}\n\n`);
    expectSafeTypescript(result.elemTsString, ["TestEnum"]);
  });
});
