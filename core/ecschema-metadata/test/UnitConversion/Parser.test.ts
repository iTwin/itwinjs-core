/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { parseDefinition, DefinitionFragment } from "../../src/UnitConversion/Parser";

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

  const expectedData: { [key: string]: KeyValuePair[] } = {
    NUMBER: [
      [
        "NUMBER",
        {
          name: "NUMBER",
          exponent: 1,
          constant: false,
        },
      ],
    ],
    "NUMBER(2)": [
      [
        "NUMBER",
        {
          name: "NUMBER",
          exponent: 2,
          constant: false,
        },
      ],
    ],
    "NUMBER(-1)": [
      [
        "NUMBER",
        {
          name: "NUMBER",
          exponent: -1,
          constant: false,
        },
      ],
    ],
    "[NUMBER]": [
      [
        "NUMBER",
        {
          name: "NUMBER",
          exponent: 1,
          constant: true,
        },
      ],
    ],
    "FORCE*LENGTH": [
      [
        "FORCE",
        {
          name: "FORCE",
          exponent: 1,
          constant: false,
        },
      ],
      [
        "LENGTH",
        {
          name: "LENGTH",
          exponent: 1,
          constant: false,
        },
      ],
    ],
    "WORK*TIME(-1)": [
      [
        "WORK",
        {
          name: "WORK",
          exponent: 1,
          constant: false,
        },
      ],
      [
        "TIME",
        {
          name: "TIME",
          exponent: -1,
          constant: false,
        },
      ],
    ],
    "LENGTH*LENGTH(-1)*TEMPERATURE_CHANGE(-1)": [
      [
        "LENGTH",
        {
          name: "LENGTH",
          exponent: 0,
          constant: false,
        },
      ],
      [
        "TEMPERATURE_CHANGE",
        {
          name: "TEMPERATURE_CHANGE",
          exponent: -1,
          constant: false,
        },
      ],
    ],
    "[PI]*RAD": [
      [
        "PI",
        {
          name: "PI",
          exponent: 1,
          constant: true,
        },
      ],
      [
        "RAD",
        {
          name: "RAD",
          exponent: 1,
          constant: false,
        },
      ],
    ],
    "BTU*IN*FT(-2)*HR(-1)*DELTA_FAHRENHEIT(-1)": [
      [
        "BTU",
        {
          name: "BTU",
          exponent: 1,
          constant: false,
        },
      ],
      [
        "IN",
        {
          name: "IN",
          exponent: 1,
          constant: false,
        },
      ],
      [
        "FT",
        {
          name: "FT",
          exponent: -2,
          constant: false,
        },
      ],
      [
        "HR",
        {
          name: "HR",
          exponent: -1,
          constant: false,
        },
      ],
      [
        "DELTA_FAHRENHEIT",
        {
          name: "DELTA_FAHRENHEIT",
          exponent: -1,
          constant: false,
        },
      ],
    ],
    "M(3)*M(-3)": [
      [
        "M",
        {
          name: "M",
          exponent: 0,
          constant: false,
        },
      ],
    ],
    "[PI](2)*[PI](-2)*[PI](2)*[PI](-2)*[PI](2)*[PI](-2)": [
      [
        "PI",
        {
          name: "PI",
          exponent: 0,
          constant: true,
        },
      ],
    ],
    "BTU(-1)*[PI](2)*HR*[ONE]*TEMPERATURE_CHANGE(1)": [
      [
        "BTU",
        {
          name: "BTU",
          exponent: -1,
          constant: false,
        },
      ],
      [
        "PI",
        {
          name: "PI",
          exponent: 2,
          constant: true,
        },
      ],
      [
        "HR",
        {
          name: "HR",
          exponent: 1,
          constant: false,
        },
      ],
      [
        "ONE",
        {
          name: "ONE",
          exponent: 1,
          constant: true,
        },
      ],
      [
        "TEMPERATURE_CHANGE",
        {
          name: "TEMPERATURE_CHANGE",
          exponent: 1,
          constant: false,
        },
      ],
    ],
    "alias:NUMBER": [
      [
        "alias:NUMBER",
        {
          name: "alias:NUMBER",
          exponent: 1,
          constant: false,
        },
      ],
    ],
    "alias:NUMBER(2)": [
      [
        "alias:NUMBER",
        {
          name: "alias:NUMBER",
          exponent: 2,
          constant: false,
        },
      ],
    ],
    "alias:NUMBER(-1)": [
      [
        "alias:NUMBER",
        {
          name: "alias:NUMBER",
          exponent: -1,
          constant: false,
        },
      ],
    ],
    "[alias:NUMBER]": [
      [
        "alias:NUMBER",
        {
          name: "alias:NUMBER",
          exponent: 1,
          constant: true,
        },
      ],
    ],
    "alias:FORCE*alias:LENGTH": [
      [
        "alias:FORCE",
        {
          name: "alias:FORCE",
          exponent: 1,
          constant: false,
        },
      ],
      [
        "alias:LENGTH",
        {
          name: "alias:LENGTH",
          exponent: 1,
          constant: false,
        },
      ],
    ],
    "alias:WORK*alias:TIME(-1)": [
      [
        "alias:WORK",
        {
          name: "alias:WORK",
          exponent: 1,
          constant: false,
        },
      ],
      [
        "alias:TIME",
        {
          name: "alias:TIME",
          exponent: -1,
          constant: false,
        },
      ],
    ],
    "alias:LENGTH*alias:LENGTH(-1)*alias:TEMPERATURE_CHANGE(-1)": [
      [
        "alias:LENGTH",
        {
          name: "alias:LENGTH",
          exponent: 0,
          constant: false,
        },
      ],
      [
        "alias:TEMPERATURE_CHANGE",
        {
          name: "alias:TEMPERATURE_CHANGE",
          exponent: -1,
          constant: false,
        },
      ],
    ],
    "[alias:PI]*alias:RAD": [
      [
        "alias:PI",
        {
          name: "alias:PI",
          exponent: 1,
          constant: true,
        },
      ],
      [
        "alias:RAD",
        {
          name: "alias:RAD",
          exponent: 1,
          constant: false,
        },
      ],
    ],
    "alias:BTU*alias:IN*alias:FT(-2)*alias:HR(-1)*alias:DELTA_FAHRENHEIT(-1)": [
      [
        "alias:BTU",
        {
          name: "alias:BTU",
          exponent: 1,
          constant: false,
        },
      ],
      [
        "alias:IN",
        {
          name: "alias:IN",
          exponent: 1,
          constant: false,
        },
      ],
      [
        "alias:FT",
        {
          name: "alias:FT",
          exponent: -2,
          constant: false,
        },
      ],
      [
        "alias:HR",
        {
          name: "alias:HR",
          exponent: -1,
          constant: false,
        },
      ],
      [
        "alias:DELTA_FAHRENHEIT",
        {
          name: "alias:DELTA_FAHRENHEIT",
          exponent: -1,
          constant: false,
        },
      ],
    ],
    "alias:M(3)*alias:M(-3)": [
      [
        "alias:M",
        {
          name: "alias:M",
          exponent: 0,
          constant: false,
        },
      ],
    ],
    "[alias:PI](2)*[alias:PI](-2)*[alias:PI](2)*[alias:PI](-2)*[alias:PI](2)*[alias:PI](-2)": [
      [
        "alias:PI",
        {
          name: "alias:PI",
          exponent: 0,
          constant: true,
        },
      ],
    ],
    "alias:BTU(-1)*[alias:PI](2)*alias:HR*[alias:ONE]*alias:TEMPERATURE_CHANGE(1)": [
      [
        "alias:BTU",
        {
          name: "alias:BTU",
          exponent: -1,
          constant: false,
        },
      ],
      [
        "alias:PI",
        {
          name: "alias:PI",
          exponent: 2,
          constant: true,
        },
      ],
      [
        "alias:HR",
        {
          name: "alias:HR",
          exponent: 1,
          constant: false,
        },
      ],
      [
        "alias:ONE",
        {
          name: "alias:ONE",
          exponent: 1,
          constant: true,
        },
      ],
      [
        "alias:TEMPERATURE_CHANGE",
        {
          name: "alias:TEMPERATURE_CHANGE",
          exponent: 1,
          constant: false,
        },
      ],
    ],
  };

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
