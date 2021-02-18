/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { Schema, SchemaItemKey, Unit } from "../ecschema-metadata";
import { parseDefinition } from "./NewParser";

let schema: Schema;
let schemaMap = new Map();

// Map schema with unit names as keys
export function setSchema(schemaInput: Schema) {
  schema = schemaInput;
  let iter = schema.getItems();
  for (let elem of iter) {
    let unit = elem as Unit;
    schemaMap.set(elem.name, {
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

export function getConversion(
  fromUnit: SchemaItemKey,
  toUnit: SchemaItemKey
): Conversion {
  let from = recursiveCalculate(fromUnit.name, true);
  let to = recursiveCalculate(toUnit.name, false);
  return {
    multiplier: from.multiplier / to.multiplier,
    offset: from.offset / to.multiplier - to.offset,
  };
}

// Recursive function to traverse from unit to unit
function recursiveCalculate(unitName: string, isFrom: boolean): Conversion {
  let currentUnit = schemaMap.get(unitName);
  // Definition returns a map of children needed to calculate
  let unitChildren = parseDefinition(currentUnit.definition);

  // Base case where unit name equals its definition, like M, KG, ONE
  if (unitName === currentUnit.definition) {
    return { multiplier: 1, offset: 0 };
  }

  let aggregate = { multiplier: 1, offset: 0 };
  // Calculate each children
  unitChildren.forEach((value, key) => {
    let result = recursiveCalculate(key, isFrom);

    aggregate.multiplier *= result.multiplier ** value.exponent;
    aggregate.offset += result.offset;
  });

  let fraction = currentUnit.numerator / currentUnit.denominator
  aggregate.multiplier *= fraction;

  if (isFrom) {
    aggregate.offset =
      aggregate.offset + currentUnit.offset * fraction; // Multiply current offset by fraction then add previous offset
  } else {
    aggregate.offset =
      aggregate.offset / fraction + currentUnit.offset; // Divide previous offset by fraction then add current offset
  }

  return aggregate;
}
