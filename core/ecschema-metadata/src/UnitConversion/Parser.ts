/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
const expressionRgx = /^(([A-Z]\w*:)?([A-Z]\w*|\[([A-Z]\w*:)?[A-Z]\w*\])(\(-?\d+\))?(\*(?!$)|$))+$/i;
const tokenRgx = /(?:(\[)?((?:[A-Z]\w*:)?[A-Z]\w*)\]?)(?:\((-?\d+)\))?/i;
const sp = "*";

/** @internal */
enum Tokens {
  Bracket = 1,
  Word = 2,
  Exponent = 3,
}

/** @internal */
export interface DefinitionFragment {
  name: string;
  exponent: number;
  constant: boolean;
}

/** @internal */
export function parseDefinition(definition: string): Map<string, DefinitionFragment> {
  const unitMap: Map<string, DefinitionFragment> = new Map();

  if (expressionRgx.test(definition)) {
    for (const unit of definition.split(sp)) {
      const tokens = unit.split(tokenRgx);
      const name = tokens[Tokens.Word];
      const exponent = tokens[Tokens.Exponent] ? Number(tokens[Tokens.Exponent]) : 1;
      const constant = tokens[Tokens.Bracket] !== undefined;
      const currentDefinition = unitMap.get(name);
      if (currentDefinition !== undefined) {
        currentDefinition.exponent += exponent;
        unitMap.set(name, currentDefinition);
      } else {
        unitMap.set(name, { name, exponent, constant });
      }
    }

    return unitMap;
  } else {
    throw new Error("Invalid definition expression.");
  }
}
