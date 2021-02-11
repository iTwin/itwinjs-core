/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { Schema, SchemaItemKey, Unit } from "../ecschema-metadata";
import { parseDefinition } from "./NewParser";

let schema: Schema;
let unitsMap = new Map();

// Map schema with unit names as keys
export function setSchema(schemaInput: Schema) {
  schema = schemaInput;
  let iter = schema.getItems();
  for (let elem of iter) {
    let unit = elem as Unit;
    unitsMap.set(elem.name, {
      definition: unit.definition,
      numerator: unit.numerator,
      denominator: unit.denominator,
      offset: unit.offset || 0,
    });
  }
}

type Conversion = {
  multiplier: number;
  offset: number;
};

export function mapUnits(
  fromUnit: SchemaItemKey,
  toUnit: SchemaItemKey
): Conversion {
  let from = recursiveConvert(fromUnit.name);
  let to = recursiveConvert(toUnit.name);
  console.log(from, to);
  return {
    multiplier: from.multiplier / to.multiplier,
    offset: from.offset + to.offset,
  };
}

// Recursive function to traverse from unit to unit
function recursiveConvert(unitName: string): Conversion {
  let currentUnit = unitsMap.get(unitName);
  // Definition returns a map of children needed to calculate
  let unitChildren = parseDefinition(currentUnit.definition);

  // Base case where unit name equals its definition, like M, KG, ONE
  if (unitName === currentUnit.definition) {
    return { multiplier: 1, offset: 0 };
  }

  let aggregate = { multiplier: 1, offset: 0 };
  // Calculate each children
  unitChildren.forEach((value, key) => {
    let result = recursiveConvert(key);

    let multiplier = result.multiplier ** value.exponent;
    let offset = result.offset;
    if (value.exponent > 0) {
      let fraction = currentUnit.numerator / currentUnit.denominator;
      multiplier *= fraction;
      offset += currentUnit.offset * fraction;
    }
    aggregate.multiplier *= multiplier;
    aggregate.offset += offset;
  });

  return aggregate;
}
