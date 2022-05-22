/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { ECSchemaToTs } from "../ecschema2ts";
import { assert } from "chai";
import * as utils from "./utilities/utils";
import { SchemaContext } from "@itwin/ecschema-metadata";
import { SchemaXmlFileLocater } from "@itwin/ecschema-locaters";

describe("BisCore test correct inheritance", () => {
  let ecschema2ts: ECSchemaToTs;
  beforeEach(() => {
    ecschema2ts = new ECSchemaToTs();
  });

  it("of class that subclasses Element with additional properties", () => {
    const schemaXml = `
<?xml version="1.0" encoding="UTF-8"?>
<ECSchema schemaName="BisCore" alias="bis" version="01.00.00" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.2">
  <ECEntityClass typeName="Element" modifier="Abstract">
    <ECCustomAttributes>
      <CustomHandledProperty xmlns="BisCore.1.0.0"/>
    </ECCustomAttributes>
    <ECProperty propertyName="TestProp" typeName="string"/>
  </ECEntityClass>
  <ECEntityClass typeName="DerivedElement">
    <BaseClass>Element</BaseClass>
    <ECProperty propertyName="DerivedTestProp" typeName="string"/>
  </ECEntityClass>

  <ECCustomAttributeClass typeName="CustomHandledProperty" description="Applied to an element's property to indicate that the property's value is handled specially by a C++ class." appliesTo="AnyProperty">
      <ECProperty propertyName="StatementTypes" typeName="CustomHandledPropertyStatementType"/>
  </ECCustomAttributeClass>
  <ECEnumeration typeName="CustomHandledPropertyStatementType" backingTypeName="int" isStrict="true">
      <ECEnumerator name="CustomHandledPropertyStatementType0" value="0" displayLabel="None"/>
      <ECEnumerator name="CustomHandledPropertyStatementType1" value="1" displayLabel="Select"/>
      <ECEnumerator name="CustomHandledPropertyStatementType2" value="2" displayLabel="Insert"/>
      <ECEnumerator name="CustomHandledPropertyStatementType3" value="3" displayLabel="ReadOnly = Select|Insert"/>
      <ECEnumerator name="CustomHandledPropertyStatementType4" value="4" displayLabel="Update"/>
      <ECEnumerator name="CustomHandledPropertyStatementType6" value="6" displayLabel="InsertUpdate = Insert | Update"/>
      <ECEnumerator name="CustomHandledPropertyStatementType7" value="7" displayLabel="All = Select | Insert | Update"/>
  </ECEnumeration>
</ECSchema>`;

    const expectedElementSchemaString =
      `import { Entity, IModelDb } from "@itwin/core-backend";
import { EntityProps } from "@itwin/core-common";
import { DerivedElementProps } from "./BisCoreElementProps";

export abstract class Element extends Entity {
  public static get className(): string { return "Element"; }

  public constructor (props: EntityProps, iModel: IModelDb) {
    super(props, iModel);
  }
}

export const enum CustomHandledPropertyStatementType {
  None = 0,
  Select = 1,
  Insert = 2,
  ReadOnly = Select|Insert = 3,
  Update = 4,
  InsertUpdate = Insert | Update = 6,
  All = Select | Insert | Update = 7,
}

export class DerivedElement extends Element implements DerivedElementProps {
  public static get className(): string { return "DerivedElement"; }

  public constructor (props: DerivedElementProps, iModel: IModelDb) {
    super(props, iModel);
  }
}\n\n`;

    const expectedPropsSchemaString =
      `import { ElementProps } from "@itwin/core-common";

export interface DerivedElementProps extends ElementProps {
  derivedTestProp?: string;
}\n\n`;

    const context = new SchemaContext();
    const schema = utils.deserializeXml(context, schemaXml);
    const { elemTsString, propsTsString } = ecschema2ts.convertSchemaToTs(schema);

    assert.equal(propsTsString, expectedPropsSchemaString);
    assert.equal(elemTsString, expectedElementSchemaString);
  });

  it("of class that subclasses Element without additional properties", () => {
    const schemaXml =
      `<?xml version="1.0" encoding="UTF-8"?>
<ECSchema schemaName="BisCore" alias="bis" version="01.00.00" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.2">
  <ECEntityClass typeName="Element" modifier="Abstract">
    <ECCustomAttributes>
      <CustomHandledProperty xmlns="BisCore.01.00.00"/>
    </ECCustomAttributes>
    <ECProperty propertyName="TestProp" typeName="string"/>
  </ECEntityClass>
  <ECEntityClass typeName="DerivedElement">
    <BaseClass>Element</BaseClass>
  </ECEntityClass>

  <ECCustomAttributeClass typeName="CustomHandledProperty" description="Applied to an element's property to indicate that the property's value is handled specially by a C++ class." appliesTo="AnyProperty">
      <ECProperty propertyName="StatementTypes" typeName="CustomHandledPropertyStatementType"/>
  </ECCustomAttributeClass>
  <ECEnumeration typeName="CustomHandledPropertyStatementType" backingTypeName="int" isStrict="true">
      <ECEnumerator name="CustomHandledPropertyStatementType0" value="0" displayLabel="None"/>
      <ECEnumerator name="CustomHandledPropertyStatementType1" value="1" displayLabel="Select"/>
      <ECEnumerator name="CustomHandledPropertyStatementType2" value="2" displayLabel="Insert"/>
      <ECEnumerator name="CustomHandledPropertyStatementType3" value="3" displayLabel="ReadOnly = Select|Insert"/>
      <ECEnumerator name="CustomHandledPropertyStatementType4" value="4" displayLabel="Update"/>
      <ECEnumerator name="CustomHandledPropertyStatementType6" value="6" displayLabel="InsertUpdate = Insert | Update"/>
      <ECEnumerator name="CustomHandledPropertyStatementType7" value="7" displayLabel="All = Select | Insert | Update"/>
  </ECEnumeration>
</ECSchema>`;

    const expectedElementSchemaString =
      `import { Entity, IModelDb } from "@itwin/core-backend";
import { EntityProps, ElementProps } from "@itwin/core-common";

export abstract class Element extends Entity {
  public static get className(): string { return "Element"; }

  public constructor (props: EntityProps, iModel: IModelDb) {
    super(props, iModel);
  }
}

export const enum CustomHandledPropertyStatementType {
  None = 0,
  Select = 1,
  Insert = 2,
  ReadOnly = Select|Insert = 3,
  Update = 4,
  InsertUpdate = Insert | Update = 6,
  All = Select | Insert | Update = 7,
}

export class DerivedElement extends Element {
  public static get className(): string { return "DerivedElement"; }

  public constructor (props: ElementProps, iModel: IModelDb) {
    super(props, iModel);
  }
}\n\n`;
    const context = new SchemaContext();
    const schema = utils.deserializeXml(context, schemaXml);
    const { elemTsString, propsTsString } = ecschema2ts.convertSchemaToTs(schema);

    assert.equal(propsTsString, `\n`);
    assert.equal(elemTsString, expectedElementSchemaString);
  });

  it("with multiple levels derived from Element without properties", () => {
    // A modified heirarchy of the bis schema to test a specific use case.
    const schemaXml = `
<?xml version="1.0" encoding="UTF-8"?>
<ECSchema schemaName="BisCore" alias="bis" version="1.0.0" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.2">
  <ECEntityClass typeName="Element" modifier="Abstract">
    <ECProperty propertyName="LastMod" typeName="int">
      <ECCustomAttributes>
          <CustomHandledProperty xmlns="BisCore.01.00.00">
              <StatementTypes>0</StatementTypes>
          </CustomHandledProperty>
      </ECCustomAttributes>
    </ECProperty>
  </ECEntityClass>
  <ECEntityClass typeName="InformationContentElement" modifier="Abstract">
    <BaseClass>Element</BaseClass>
  </ECEntityClass>
  <ECEntityClass typeName="InformationReferenceElement" modifier="Abstract">
    <BaseClass>InformationContentElement</BaseClass>
  </ECEntityClass>
  <ECEntityClass typeName="Subject" modifier="Sealed">
    <BaseClass>InformationReferenceElement</BaseClass>
    <BaseClass>IParentElement</BaseClass>
    <ECProperty propertyName="Description" typeName="string"/>
  </ECEntityClass>
  <ECEntityClass typeName="IParentElement" modifier="Abstract">
    <ECCustomAttributes>
      <IsMixin xmlns="CoreCustomAttributes.1.0">
        <AppliesToEntityClass>Element</AppliesToEntityClass>
      </IsMixin>
    </ECCustomAttributes>
  </ECEntityClass>

  <ECCustomAttributeClass typeName="CustomHandledProperty" description="Applied to an element's property to indicate that the property's value is handled specially by a C++ class." appliesTo="AnyProperty">
      <ECProperty propertyName="StatementTypes" typeName="CustomHandledPropertyStatementType"/>
  </ECCustomAttributeClass>
  <ECEnumeration typeName="CustomHandledPropertyStatementType" backingTypeName="int" isStrict="true">
      <ECEnumerator name="CustomHandledPropertyStatementType0" value="0" displayLabel="None"/>
      <ECEnumerator name="CustomHandledPropertyStatementType1" value="1" displayLabel="Select"/>
      <ECEnumerator name="CustomHandledPropertyStatementType2" value="2" displayLabel="Insert"/>
      <ECEnumerator name="CustomHandledPropertyStatementType3" value="3" displayLabel="ReadOnly = Select|Insert"/>
      <ECEnumerator name="CustomHandledPropertyStatementType4" value="4" displayLabel="Update"/>
      <ECEnumerator name="CustomHandledPropertyStatementType6" value="6" displayLabel="InsertUpdate = Insert | Update"/>
      <ECEnumerator name="CustomHandledPropertyStatementType7" value="7" displayLabel="All = Select | Insert | Update"/>
  </ECEnumeration>
</ECSchema>`;

    const expectedElementSchemaString =
      `import { Entity, IModelDb } from "@itwin/core-backend";
import { EntityProps, ElementProps } from "@itwin/core-common";
import { SubjectProps } from "./BisCoreElementProps";

export abstract class Element extends Entity {
  public static get className(): string { return "Element"; }

  public constructor (props: EntityProps, iModel: IModelDb) {
    super(props, iModel);
  }
}

export const enum CustomHandledPropertyStatementType {
  None = 0,
  Select = 1,
  Insert = 2,
  ReadOnly = Select|Insert = 3,
  Update = 4,
  InsertUpdate = Insert | Update = 6,
  All = Select | Insert | Update = 7,
}

export abstract class InformationContentElement extends Element {
  public static get className(): string { return "InformationContentElement"; }

  public constructor (props: ElementProps, iModel: IModelDb) {
    super(props, iModel);
  }
}

export abstract class InformationReferenceElement extends InformationContentElement {
  public static get className(): string { return "InformationReferenceElement"; }

  public constructor (props: ElementProps, iModel: IModelDb) {
    super(props, iModel);
  }
}

export class Subject extends InformationReferenceElement implements SubjectProps {
  public static get className(): string { return "Subject"; }

  public constructor (props: SubjectProps, iModel: IModelDb) {
    super(props, iModel);
  }
}\n\n`;

    const expectedPropSchemaString =
      `import { ElementProps } from "@itwin/core-common";

export interface IParentElement {
}

export interface SubjectProps extends ElementProps {
  description?: string;
}\n\n`;

    const context = new SchemaContext();
    const schema = utils.deserializeXml(context, schemaXml);
    const { elemTsString, propsTsString } = ecschema2ts.convertSchemaToTs(schema);

    assert.equal(elemTsString, expectedElementSchemaString);
    assert.equal(propsTsString, expectedPropSchemaString);
  });
});

describe("Referencing BisCore", () => {
  it("as a base class", () => {
    const schemaXml = `
<?xml version="1.0" encoding="UTF-8"?>
<ECSchema schemaName="ECObjects" alias="eco" version="02.00.00" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.2">
  <ECSchemaReference name="BisCore" version="01.00.00" alias="bis"/>
  <ECEntityClass typeName="SchemaDictionary" modifer="Sealed" description="The singleton container of SchemaDef Elements">
      <BaseClass>bis:DefinitionModel</BaseClass>
  </ECEntityClass>

  <!-- A Model that models SchemaDef elements contained in the SchemasDefinitionModel -->
  <ECEntityClass typeName="SchemaModel" modifier="Sealed" description="A container for SchemaChild elements">
    <BaseClass>bis:DefinitionModel</BaseClass>
  </ECEntityClass>
</ECSchema>`;

    const expectedElementSchemaString =
      `import { DefinitionModel, IModelDb } from "@itwin/core-backend";
import { ModelProps } from "@itwin/core-common";

/**
 * The singleton container of SchemaDef Elements
 */
export class SchemaDictionary extends DefinitionModel {
  public static get className(): string { return "SchemaDictionary"; }

  public constructor (props: ModelProps, iModel: IModelDb) {
    super(props, iModel);
  }
}

/**
 * A container for SchemaChild elements
 */
export class SchemaModel extends DefinitionModel {
  public static get className(): string { return "SchemaModel"; }

  public constructor (props: ModelProps, iModel: IModelDb) {
    super(props, iModel);
  }
}\n\n`;

    const schemaLocator = new SchemaXmlFileLocater();
    schemaLocator.addSchemaSearchPath(`${utils.getAssetsDir()}schema3.2`);
    const context = new SchemaContext();
    context.addLocater(schemaLocator);
    const schema = utils.deserializeXml(context, schemaXml);
    const ecschema2ts = new ECSchemaToTs();
    const { elemTsString, propsTsString } = ecschema2ts.convertSchemaToTs(schema);

    assert.equal(propsTsString, `\n`);
    assert.equal(elemTsString, expectedElementSchemaString);
  });
});
