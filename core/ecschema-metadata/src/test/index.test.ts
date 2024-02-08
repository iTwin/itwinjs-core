/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import * as ecStringConstants from "../Constants";
import * as context from "../Context";
import * as delayedPromise from "../DelayedPromise";
import * as schemaGraphUtil from "../Deserialization/SchemaGraphUtil";
import * as ecObjects from "../ECObjects";
import * as index from "../ecschema-metadata";
import * as exception from "../Exception";
import * as interfaces from "../Interfaces";
import { ECClass, StructClass } from "../Metadata/Class";
import * as constant from "../Metadata/Constant";
import * as customAttributeClass from "../Metadata/CustomAttributeClass";
import { EntityClass } from "../Metadata/EntityClass";
import { Enumeration } from "../Metadata/Enumeration";
import * as format from "../Metadata/Format";
import * as invertedUnit from "../Metadata/InvertedUnit";
import * as kindOfQuantity from "../Metadata/KindOfQuantity";
import * as mixin from "../Metadata/Mixin";
import * as overrideFormat from "../Metadata/OverrideFormat";
import * as phenomenon from "../Metadata/Phenomenon";
import * as property from "../Metadata/Property";
import * as propertyCategory from "../Metadata/PropertyCategory";
import * as relationshipClass from "../Metadata/RelationshipClass";
import { Schema } from "../Metadata/Schema";
import * as schemaItem from "../Metadata/SchemaItem";
import * as unit from "../Metadata/Unit";
import * as unitSystem from "../Metadata/UnitSystem";
import * as propertyTypes from "../PropertyTypes";
import * as schemaKey from "../SchemaKey";

// new type with specified index signature
interface Dict {
  [key: string]: any;
}

// modules are not iterable. to traverse their members, the imports are spread into an object
const objectsIndex: Dict = {
  ...index,
};

/* eslint-disable @typescript-eslint/naming-convention */

const moduleImports: Dict = {
  ...ecObjects,
  ...ecStringConstants,
  ...context,
  ...interfaces,
  ...delayedPromise,
  ...exception,
  ...propertyTypes,
  Schema,
  ...schemaItem,
  ...schemaKey,
  ECClass,
  StructClass,
  EntityClass,
  ...mixin,
  ...relationshipClass,
  ...customAttributeClass,
  Enumeration,
  ...kindOfQuantity,
  ...constant,
  ...format,
  ...overrideFormat,
  ...invertedUnit,
  ...phenomenon,
  ...unit,
  ...unitSystem,
  ...propertyCategory,
  ...property,
  ...schemaGraphUtil,
};

describe("Index", () => {
  it("should successfully import Index module", () => {
    expect(objectsIndex).to.not.be.undefined;
  });

  it("should match the explicit module imports", () => {
    for (const name in moduleImports) {
      if (name.startsWith("Mutable"))
        continue;

      expect(objectsIndex.hasOwnProperty(name), `The type '${name}' is missing from the index.ts barrel module.`).true;
    }
  });

  it("Ensure no Mutable classes are exported", () => {
    // eslint-disable-next-line guard-for-in
    for (const name in objectsIndex)
      expect(!name.startsWith("Mutable"), `The class '${name}' should not be exported from the index.ts file.`).true;
  });
});
