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
import { default as Schema } from '../src/Metadata/Schema';
import { default as SchemaItem } from '../src/Metadata/SchemaItem';
import { default as ECClass, StructClass } from '../src/Metadata/Class';
import { default as EntityClass } from '../src/Metadata/EntityClass';
import { default as Mixin } from '../src/Metadata/Mixin';
import { default as RelationshipClass, RelationshipConstraint } from '../src/Metadata/RelationshipClass';
import { default as CustomAttributeClass } from '../src/Metadata/CustomAttributeClass';
import { default as Enumeration, Enumerator } from '../src/Metadata/Enumeration';
import { default as KindOfQuantity } from '../src/Metadata/KindOfQuantity';
import { default as Constant } from '../src/Metadata/Constant';
import { default as Format } from '../src/Metadata/Format';
import { default as OverrideFormat } from '../src/Metadata/OverrideFormat';
import { default as InvertedUnit } from '../src/Metadata/InvertedUnit';
import { default as Phenomenon } from '../src/Metadata/Phenomenon';
import { default as Unit } from '../src/Metadata/Unit';
import { default as UnitSystem } from '../src/Metadata/UnitSystem';
import { default as PropertyCategory } from '../src/Metadata/PropertyCategory';
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
  ...Schema,
  ...SchemaItem,
  ...ECClass,
  ...StructClass,
  ...EntityClass,
  ...Mixin,
  ...RelationshipClass,
  ...RelationshipConstraint,
  ...CustomAttributeClass,
  ...Enumeration,
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

describe('Index', () => {
  it('should successfully import Index module', () => {
    expect(index).to.not.be.undefined;
  });

  describe('Index exports should match explicit module imports', () => {
    for (var name in index) {
      it(`import ${name} matches`, () => {
        expect(moduleImports.hasOwnProperty(name)).to.be.true;
      });
    }
    it(`import Enumerator is a valid type`, () => {
      var a: Enumerator<string> = { name: 'a', value: 'test' };
      expect(a.value).to.be.equal('test');
    });
  });
});
