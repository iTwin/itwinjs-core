/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

import { expect } from 'chai';

import * as Index from '../src/index';

import * as ECObjects from '../src/ECObjects';
import * as ECStringConstants from '../src/Constants';
import * as Context from '../src/Context';
import * as Interfaces from '../src/Interfaces';
import * as DelayedPromise from '../src/DelayedPromise';
import * as Exception from '../src/Exception';
import * as PropertyTypes from '../src/PropertyTypes';
import * as FormatEnums from '../src/utils/FormatEnums';
import * as SchemaKey from "../src/SchemaKey";
import { Schema } from '../src/Metadata/Schema';
import * as SchemaItem from '../src/Metadata/SchemaItem';
import { ECClass, StructClass } from '../src/Metadata/Class';
import { EntityClass } from '../src/Metadata/EntityClass';
import * as Mixin from '../src/Metadata/Mixin';
import * as RelationshipClass from '../src/Metadata/RelationshipClass';
import * as CustomAttributeClass from '../src/Metadata/CustomAttributeClass';
import { Enumeration } from '../src/Metadata/Enumeration';
import * as KindOfQuantity from '../src/Metadata/KindOfQuantity';
import * as Constant from '../src/Metadata/Constant';
import * as Format from '../src/Metadata/Format';
import * as OverrideFormat from '../src/Metadata/OverrideFormat';
import * as InvertedUnit from '../src/Metadata/InvertedUnit';
import * as Phenomenon from '../src/Metadata/Phenomenon';
import * as Unit from '../src/Metadata/Unit';
import * as UnitSystem from '../src/Metadata/UnitSystem';
import * as PropertyCategory from '../src/Metadata/PropertyCategory';
import * as Property from '../src/Metadata/Property';
import * as SchemaXMLFileLocater from '../src/Deserialization/SchemaXmlFileLocater';
import * as SchemaJsonFileLocater from '../src/Deserialization/SchemaJsonFileLocater';
import * as SchemaFileLocater from '../src/Deserialization/SchemaFileLocater';
import * as SchemaGraphUtil from '../src/Deserialization/SchemaGraphUtil';

// new type with specified index signature
type Dict = {
  [key: string]: any
};

// modules are not iterable. to traverse their members, the imports are spread into an object
const index: Dict = {
  ...Index
};
const moduleImports: Dict = {
  ...ECObjects,
  ...ECStringConstants,
  ...Context,
  ...Interfaces,
  ...DelayedPromise,
  ...Exception,
  ...PropertyTypes,
  ...FormatEnums,
  Schema,
  ...SchemaItem,
  ...SchemaKey,
  ECClass,
  StructClass,
  EntityClass,
  ...Mixin,
  ...RelationshipClass,
  ...CustomAttributeClass,
  Enumeration,
  ...KindOfQuantity,
  ...Constant,
  ...Format,
  ...OverrideFormat,
  ...InvertedUnit,
  ...Phenomenon,
  ...Unit,
  ...UnitSystem,
  ...PropertyCategory,
  ...Property,
  ...SchemaXMLFileLocater,
  ...SchemaJsonFileLocater,
  ...SchemaFileLocater,
  ...SchemaGraphUtil,
};

describe("Index", () => {
  it("should successfully import Index module", () => {
    expect(index).to.not.be.undefined;
  });
  it(`should match the explicit module imports`, () => {
    for (var name in index)
      expect(moduleImports.hasOwnProperty(name), `The type '${name}' is missing from the index.ts barrel module.`).true;
  });
  it("Ensure no Mutable classes are exported", () => {
    for (const name in index)
      expect(!name.startsWith("Mutable"), `The class '${name}' should not be exported from the index.ts file.`).true;
  });
});
