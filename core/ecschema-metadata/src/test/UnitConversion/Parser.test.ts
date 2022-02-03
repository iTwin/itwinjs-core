/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as fs from "fs";
import * as path from "path";
import { expect } from "chai";
import type { DefinitionFragment} from "../../UnitConversion/Parser";
import { parseDefinition } from "../../UnitConversion/Parser";

describe("DefinitionParser tests", () => {
  const definitionsToTest: string[] = [
    "NUMBER",
    "NUMBER(2)",
    "NUMBER(-1)",
    "[NUMBER]",
    "FORCE*LENGTH",
    "WORK*TIME(-1)",
    "LENGTH*LENGTH(-1)*TEMPERATURE_CHANGE(-1)",
    "[PI]*RAD",
    "BTU*IN*FT(-2)*HR(-1)*DELTA_FAHRENHEIT(-1)",
    "M(3)*M(-3)",
    "[PI](2)*[PI](-2)*[PI](2)*[PI](-2)*[PI](2)*[PI](-2)",
    "BTU(-1)*[PI](2)*HR*[ONE]*TEMPERATURE_CHANGE(1)",
    "alias:NUMBER",
    "alias:NUMBER(2)",
    "alias:NUMBER(-1)",
    "[alias:NUMBER]",
    "alias:FORCE*alias:LENGTH",
    "alias:WORK*alias:TIME(-1)",
    "alias:LENGTH*alias:LENGTH(-1)*alias:TEMPERATURE_CHANGE(-1)",
    "[alias:PI]*alias:RAD",
    "alias:BTU*alias:IN*alias:FT(-2)*alias:HR(-1)*alias:DELTA_FAHRENHEIT(-1)",
    "alias:M(3)*alias:M(-3)",
    "[alias:PI](2)*[alias:PI](-2)*[alias:PI](2)*[alias:PI](-2)*[alias:PI](2)*[alias:PI](-2)",
    "alias:BTU(-1)*[alias:PI](2)*alias:HR*[alias:ONE]*alias:TEMPERATURE_CHANGE(1)",
  ];

  type KeyValuePair = [string, DefinitionFragment];

  const expectedData: { [key: string]: KeyValuePair[] } = JSON.parse(
    fs.readFileSync(path.join(__dirname, "..", "assets", "./ParserTests.json"), "utf-8")
  );

  describe("parsing individual tokens", () => {
    it("all capture groups provided", () => {
      const definition = "[TEST](-3)";
      const data = [
        [
          "TEST",
          {
            name: "TEST",
            exponent: -3,
            constant: true,
          },
        ],
      ];

      expect([...parseDefinition(definition)]).to.deep.equal(data);
    });

    it("with namespace, all capture groups provided", () => {
      const definition = "[alias:TEST](-3)";
      const data = [
        [
          "alias:TEST",
          {
            name: "alias:TEST",
            exponent: -3,
            constant: true,
          },
        ],
      ];

      expect([...parseDefinition(definition)]).to.deep.equal(data);
    });

    it("no brackets, exponent provided", () => {
      const definition = "TEST(-3)";
      const data = [
        [
          "TEST",
          {
            name: "TEST",
            exponent: -3,
            constant: false,
          },
        ],
      ];

      expect([...parseDefinition(definition)]).to.deep.equal(data);
    });

    it("singular constant/unit/phenomenon provided", () => {
      // Unit and Phenomenon test, units and phenomena are not wrapped with brackets
      let definition = "TEST";
      let data = [
        [
          "TEST",
          {
            name: "TEST",
            exponent: 1,
            constant: false,
          },
        ],
      ];

      expect([...parseDefinition(definition)]).to.deep.equal(data);

      // Constant test, constants are wrapped with brackets
      definition = "[TEST]";
      data = [
        [
          "TEST",
          {
            name: "TEST",
            exponent: 1,
            constant: true,
          },
        ],
      ];

      expect([...parseDefinition(definition)]).to.deep.equal(data);
    });
  });

  function testTokenizations(definition: string) {
    it(`tokenization of ${definition} matches expected data`, async () => {
      expect([...parseDefinition(definition)]).to.have.deep.members(
        expectedData[definition]
      );
    });
  }

  function testInvalidToken(definition: string) {
    it(`invalid definition ${definition} throws`, async () => {
      expect(() => [...parseDefinition(definition)]).to.throw();
    });
  }

  describe("parsing correctly-formed definitions", () => {
    for (const definition of definitionsToTest) {
      testTokenizations(definition);
    }
  });

  describe("parsing malformed definitions", () => {
    testInvalidToken("");
    testInvalidToken("TEST\t");
    testInvalidToken("TEST**TEST");
    testInvalidToken("[](-1)");
    testInvalidToken("TEST()");
    testInvalidToken("TEST(--1)");
    testInvalidToken("[TEST(-1)");
    testInvalidToken("[TEST](1");
    testInvalidToken("TEST*[TEST](1");
    testInvalidToken("TEST*[TEST](1)*[TEST]-1");
    testInvalidToken("[Test](1)*");
    testInvalidToken("TEST(1)[TEST]");
  });
});
