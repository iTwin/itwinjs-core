/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { Id64, Id64String } from "@itwin/core-bentley";
import { Code, ElementAspectProps, GeometricElementProps, IModel, QueryRowFormat, SubCategoryAppearance } from "@itwin/core-common";
import * as chai from "chai";
import { Suite } from "mocha";
import { HubWrappers, IModelTestUtils, KnownTestLocations } from "..";
import { BriefcaseDb, BriefcaseManager, ChannelControl, DrawingCategory, IModelJsFs } from "../../core-backend";
import { EditTxn, withEditTxn } from "../../EditTxn";
import { HubMock } from "../../internal/HubMock";
import { EntityClass } from "@itwin/ecschema-metadata";
import { TestUtils } from "../TestUtils";

function startTestTxn(iModel: BriefcaseDb, description = "semantic rebase"): EditTxn {
  const txn = new EditTxn(iModel, description);
  txn.start();
  return txn;
}

function endTestTxn(txn: EditTxn): void {
  if (txn.isActive)
    txn.end("abandon");
}

async function importSchemaStrings(txn: EditTxn, schemas: string[]): Promise<void> {
  if (txn.isActive)
    txn.saveChanges();
  await txn.iModel.importSchemaStrings(schemas);
}

async function pushChanges(txn: EditTxn, description: string): Promise<void> {
  const briefcase = txn.iModel as BriefcaseDb;
  endTestTxn(txn);
  await briefcase.pushChanges({ description });
}

async function pullChanges(txn: EditTxn): Promise<void> {
  const briefcase = txn.iModel as BriefcaseDb;
  endTestTxn(txn);
  await briefcase.pullChanges();
}

/**
 * Test infrastructure for rebase tests in this file.
 * Manages two briefcases (far and local)
 */
class TestIModel {
  public iModelId: Id64String = "";
  public drawingModelId: Id64String = "";
  public drawingCategoryId: Id64String = "";
  public far: BriefcaseDb;
  public local: BriefcaseDb;

  private constructor(iModelId: Id64String, drawingModelId: Id64String, drawingCategoryId: Id64String, far: BriefcaseDb, local: BriefcaseDb) {
    this.iModelId = iModelId;
    this.drawingModelId = drawingModelId;
    this.drawingCategoryId = drawingCategoryId;
    this.far = far;
    this.local = local;
  }

  /** Reusable schema definitions for testing rebase with schema transformations */
  public static readonly schemas = {
    /** Base schema v01.00.00 with classes A, C, D */
    v01x00x00: `<?xml version="1.0" encoding="UTF-8"?>
    <ECSchema schemaName="TestDomain" alias="td" version="01.00.00" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.2">
      <ECSchemaReference name="BisCore" version="01.00.23" alias="bis"/>
      <ECEntityClass typeName="A">
        <BaseClass>bis:GraphicalElement2d</BaseClass>
        <ECProperty propertyName="PropA" typeName="string"/>
      </ECEntityClass>
      <ECEntityClass typeName="C">
        <BaseClass>A</BaseClass>
        <ECProperty propertyName="PropC" typeName="string"/>
      </ECEntityClass>
      <ECEntityClass typeName="D">
        <BaseClass>A</BaseClass>
        <ECProperty propertyName="PropD" typeName="string"/>
      </ECEntityClass>
    </ECSchema>`,

    /** v01.00.01 - Adds PropC2 to class C (trivial additive change) */
    v01x00x01AddPropC2: `<?xml version="1.0" encoding="UTF-8"?>
    <ECSchema schemaName="TestDomain" alias="td" version="01.00.01" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.2">
      <ECSchemaReference name="BisCore" version="01.00.23" alias="bis"/>
      <ECEntityClass typeName="A">
        <BaseClass>bis:GraphicalElement2d</BaseClass>
        <ECProperty propertyName="PropA" typeName="string"/>
      </ECEntityClass>
      <ECEntityClass typeName="C">
        <BaseClass>A</BaseClass>
        <ECProperty propertyName="PropC" typeName="string"/>
        <ECProperty propertyName="PropC2" typeName="string"/>
      </ECEntityClass>
      <ECEntityClass typeName="D">
        <BaseClass>A</BaseClass>
        <ECProperty propertyName="PropD" typeName="string"/>
      </ECEntityClass>
    </ECSchema>`,

    /** v01.00.02 - Adds PropD2 to class D (trivial additive change) */
    v01x00x02AddPropD2: `<?xml version="1.0" encoding="UTF-8"?>
    <ECSchema schemaName="TestDomain" alias="td" version="01.00.02" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.2">
      <ECSchemaReference name="BisCore" version="01.00.23" alias="bis"/>
      <ECEntityClass typeName="A">
        <BaseClass>bis:GraphicalElement2d</BaseClass>
        <ECProperty propertyName="PropA" typeName="string"/>
      </ECEntityClass>
      <ECEntityClass typeName="C">
        <BaseClass>A</BaseClass>
        <ECProperty propertyName="PropC" typeName="string"/>
        <ECProperty propertyName="PropC2" typeName="string"/>
      </ECEntityClass>
      <ECEntityClass typeName="D">
        <BaseClass>A</BaseClass>
        <ECProperty propertyName="PropD" typeName="string"/>
        <ECProperty propertyName="PropD2" typeName="string"/>
      </ECEntityClass>
    </ECSchema>`,

    /** v01.00.02 - Moves PropC from C to A (requires data transformation) on top of v01.00.01 */
    v01x00x02MovePropCToA: `<?xml version="1.0" encoding="UTF-8"?>
    <ECSchema schemaName="TestDomain" alias="td" version="01.00.02" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.2">
      <ECSchemaReference name="BisCore" version="01.00.23" alias="bis"/>
      <ECEntityClass typeName="A">
        <BaseClass>bis:GraphicalElement2d</BaseClass>
        <ECProperty propertyName="PropA" typeName="string"/>
        <ECProperty propertyName="PropC" typeName="string"/>
      </ECEntityClass>
      <ECEntityClass typeName="C">
        <BaseClass>A</BaseClass>
        <ECProperty propertyName="PropC2" typeName="string"/>
      </ECEntityClass>
      <ECEntityClass typeName="D">
        <BaseClass>A</BaseClass>
        <ECProperty propertyName="PropD" typeName="string"/>
      </ECEntityClass>
    </ECSchema>`,

    /** v01.00.03 - Builds on top of v01.00.02 and in addition moves PropD to base, so we can have incoming and local transforming changes */
    v01x00x03MovePropCAndD: `<?xml version="1.0" encoding="UTF-8"?>
    <ECSchema schemaName="TestDomain" alias="td" version="01.00.03" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.2">
      <ECSchemaReference name="BisCore" version="01.00.23" alias="bis"/>
      <ECEntityClass typeName="A">
        <BaseClass>bis:GraphicalElement2d</BaseClass>
        <ECProperty propertyName="PropA" typeName="string"/>
        <ECProperty propertyName="PropC" typeName="string"/>
        <ECProperty propertyName="PropD" typeName="string"/>
      </ECEntityClass>
      <ECEntityClass typeName="C">
        <BaseClass>A</BaseClass>
        <ECProperty propertyName="PropC2" typeName="string"/>
      </ECEntityClass>
      <ECEntityClass typeName="D">
        <BaseClass>A</BaseClass>
        <ECProperty propertyName="PropD2" typeName="string"/>
      </ECEntityClass>
    </ECSchema>`,

    /** v01.00.01 (incompatible variant) - Adds PropC3 instead of PropC2 to class C (same version) */
    v01x00x01AddPropC3Incompatible: `<?xml version="1.0" encoding="UTF-8"?>
    <ECSchema schemaName="TestDomain" alias="td" version="01.00.01" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.2">
      <ECSchemaReference name="BisCore" version="01.00.23" alias="bis"/>
      <ECEntityClass typeName="A">
        <BaseClass>bis:GraphicalElement2d</BaseClass>
        <ECProperty propertyName="PropA" typeName="string"/>
      </ECEntityClass>
      <ECEntityClass typeName="C">
        <BaseClass>A</BaseClass>
        <ECProperty propertyName="PropC" typeName="string"/>
        <ECProperty propertyName="PropC3" typeName="string"/>
      </ECEntityClass>
      <ECEntityClass typeName="D">
        <BaseClass>A</BaseClass>
        <ECProperty propertyName="PropD" typeName="string"/>
      </ECEntityClass>
    </ECSchema>`,

    /** v01.00.02 (incompatible variant) - Adds PropC3 instead of PropC2 to class C (higher version) */
    v01x00x02AddPropC3Incompatible: `<?xml version="1.0" encoding="UTF-8"?>
    <ECSchema schemaName="TestDomain" alias="td" version="01.00.02" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.2">
      <ECSchemaReference name="BisCore" version="01.00.23" alias="bis"/>
      <ECEntityClass typeName="A">
        <BaseClass>bis:GraphicalElement2d</BaseClass>
        <ECProperty propertyName="PropA" typeName="string"/>
      </ECEntityClass>
      <ECEntityClass typeName="C">
        <BaseClass>A</BaseClass>
        <ECProperty propertyName="PropC" typeName="string"/>
        <ECProperty propertyName="PropC3" typeName="string"/>
      </ECEntityClass>
      <ECEntityClass typeName="D">
        <BaseClass>A</BaseClass>
        <ECProperty propertyName="PropD" typeName="string"/>
      </ECEntityClass>
    </ECSchema>`,

    /** v01.00.02 (incompatible variant) - Adds PropC2 (higher version, different type) */
    v01x00x02AddPropC2Incompatible: `<?xml version="1.0" encoding="UTF-8"?>
    <ECSchema schemaName="TestDomain" alias="td" version="01.00.02" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.2">
      <ECSchemaReference name="BisCore" version="01.00.23" alias="bis"/>
      <ECEntityClass typeName="A">
        <BaseClass>bis:GraphicalElement2d</BaseClass>
        <ECProperty propertyName="PropA" typeName="string"/>
      </ECEntityClass>
      <ECEntityClass typeName="C">
        <BaseClass>A</BaseClass>
        <ECProperty propertyName="PropC" typeName="string"/>
        <ECProperty propertyName="PropC2" typeName="int"/>
      </ECEntityClass>
      <ECEntityClass typeName="D">
        <BaseClass>A</BaseClass>
        <ECProperty propertyName="PropD" typeName="string"/>
      </ECEntityClass>
    </ECSchema>`,

    /** v01.00.03 - Adds PropC2 as string (used to test incompatibility when reinstated on top of v01.00.02 with PropC2:int) */
    v01x00x03AddPropC2: `<?xml version="1.0" encoding="UTF-8"?>
    <ECSchema schemaName="TestDomain" alias="td" version="01.00.03" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.2">
      <ECSchemaReference name="BisCore" version="01.00.23" alias="bis"/>
      <ECEntityClass typeName="A">
        <BaseClass>bis:GraphicalElement2d</BaseClass>
        <ECProperty propertyName="PropA" typeName="string"/>
      </ECEntityClass>
      <ECEntityClass typeName="C">
        <BaseClass>A</BaseClass>
        <ECProperty propertyName="PropC" typeName="string"/>
        <ECProperty propertyName="PropC2" typeName="string"/>
      </ECEntityClass>
      <ECEntityClass typeName="D">
        <BaseClass>A</BaseClass>
        <ECProperty propertyName="PropD" typeName="string"/>
      </ECEntityClass>
    </ECSchema>`,
  };

  /** Additional schemas for extended edge-case tests */
  public static readonly extendedSchemas = {
    /** v01x00x01 - Adds CUniqueAspect class (ElementUniqueAspect subclass) with AspectProp for aspect rebase tests */
    v01x00x01WithAspect: `<?xml version="1.0" encoding="UTF-8"?>
    <ECSchema schemaName="TestDomain" alias="td" version="01.00.01" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.2">
      <ECSchemaReference name="BisCore" version="01.00.23" alias="bis"/>
      <ECEntityClass typeName="A">
        <BaseClass>bis:GraphicalElement2d</BaseClass>
        <ECProperty propertyName="PropA" typeName="string"/>
      </ECEntityClass>
      <ECEntityClass typeName="C">
        <BaseClass>A</BaseClass>
        <ECProperty propertyName="PropC" typeName="string"/>
      </ECEntityClass>
      <ECEntityClass typeName="D">
        <BaseClass>A</BaseClass>
        <ECProperty propertyName="PropD" typeName="string"/>
      </ECEntityClass>
      <ECEntityClass typeName="CUniqueAspect" modifier="None">
        <BaseClass>bis:ElementUniqueAspect</BaseClass>
        <ECProperty propertyName="AspectProp" typeName="string"/>
      </ECEntityClass>
    </ECSchema>`,

    /** v01x00x02 - Extends v01WithAspect by adding AspectProp2 to CUniqueAspect (trivial aspect schema evolution) */
    v01x00x02WithAspectProp2: `<?xml version="1.0" encoding="UTF-8"?>
    <ECSchema schemaName="TestDomain" alias="td" version="01.00.02" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.2">
      <ECSchemaReference name="BisCore" version="01.00.23" alias="bis"/>
      <ECEntityClass typeName="A">
        <BaseClass>bis:GraphicalElement2d</BaseClass>
        <ECProperty propertyName="PropA" typeName="string"/>
      </ECEntityClass>
      <ECEntityClass typeName="C">
        <BaseClass>A</BaseClass>
        <ECProperty propertyName="PropC" typeName="string"/>
      </ECEntityClass>
      <ECEntityClass typeName="D">
        <BaseClass>A</BaseClass>
        <ECProperty propertyName="PropD" typeName="string"/>
      </ECEntityClass>
      <ECEntityClass typeName="CUniqueAspect" modifier="None">
        <BaseClass>bis:ElementUniqueAspect</BaseClass>
        <ECProperty propertyName="AspectProp" typeName="string"/>
        <ECProperty propertyName="AspectProp2" typeName="string"/>
      </ECEntityClass>
    </ECSchema>`,

    /** v01x00x01 - Adds new entity class E extending A with PropE (tests new class addition) */
    v01x00x01AddClassE: `<?xml version="1.0" encoding="UTF-8"?>
    <ECSchema schemaName="TestDomain" alias="td" version="01.00.01" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.2">
      <ECSchemaReference name="BisCore" version="01.00.23" alias="bis"/>
      <ECEntityClass typeName="A">
        <BaseClass>bis:GraphicalElement2d</BaseClass>
        <ECProperty propertyName="PropA" typeName="string"/>
      </ECEntityClass>
      <ECEntityClass typeName="C">
        <BaseClass>A</BaseClass>
        <ECProperty propertyName="PropC" typeName="string"/>
      </ECEntityClass>
      <ECEntityClass typeName="D">
        <BaseClass>A</BaseClass>
        <ECProperty propertyName="PropD" typeName="string"/>
      </ECEntityClass>
      <ECEntityClass typeName="E">
        <BaseClass>A</BaseClass>
        <ECProperty propertyName="PropE" typeName="string"/>
      </ECEntityClass>
    </ECSchema>`,

    /** v01x00x02 - Extends v01AddClassE by adding PropE2 to class E */
    v01x00x02AddClassEPropE2: `<?xml version="1.0" encoding="UTF-8"?>
    <ECSchema schemaName="TestDomain" alias="td" version="01.00.02" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.2">
      <ECSchemaReference name="BisCore" version="01.00.23" alias="bis"/>
      <ECEntityClass typeName="A">
        <BaseClass>bis:GraphicalElement2d</BaseClass>
        <ECProperty propertyName="PropA" typeName="string"/>
      </ECEntityClass>
      <ECEntityClass typeName="C">
        <BaseClass>A</BaseClass>
        <ECProperty propertyName="PropC" typeName="string"/>
      </ECEntityClass>
      <ECEntityClass typeName="D">
        <BaseClass>A</BaseClass>
        <ECProperty propertyName="PropD" typeName="string"/>
      </ECEntityClass>
      <ECEntityClass typeName="E">
        <BaseClass>A</BaseClass>
        <ECProperty propertyName="PropE" typeName="string"/>
        <ECProperty propertyName="PropE2" typeName="string"/>
      </ECEntityClass>
    </ECSchema>`,

    /** v01x00x01 - Adds multi-type properties (int, double, boolean) to class C for type-variation tests */
    v01x00x01MultiTypeProps: `<?xml version="1.0" encoding="UTF-8"?>
    <ECSchema schemaName="TestDomain" alias="td" version="01.00.01" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.2">
      <ECSchemaReference name="BisCore" version="01.00.23" alias="bis"/>
      <ECEntityClass typeName="A">
        <BaseClass>bis:GraphicalElement2d</BaseClass>
        <ECProperty propertyName="PropA" typeName="string"/>
      </ECEntityClass>
      <ECEntityClass typeName="C">
        <BaseClass>A</BaseClass>
        <ECProperty propertyName="PropC" typeName="string"/>
        <ECProperty propertyName="PropCInt" typeName="int"/>
        <ECProperty propertyName="PropCDouble" typeName="double"/>
        <ECProperty propertyName="PropCBool" typeName="boolean"/>
      </ECEntityClass>
      <ECEntityClass typeName="D">
        <BaseClass>A</BaseClass>
        <ECProperty propertyName="PropD" typeName="string"/>
      </ECEntityClass>
    </ECSchema>`,

    /** v01x00x02 - Extends v01MultiTypeProps by adding PropD2 to class D */
    v01x00x02MultiTypePropsExtended: `<?xml version="1.0" encoding="UTF-8"?>
    <ECSchema schemaName="TestDomain" alias="td" version="01.00.02" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.2">
      <ECSchemaReference name="BisCore" version="01.00.23" alias="bis"/>
      <ECEntityClass typeName="A">
        <BaseClass>bis:GraphicalElement2d</BaseClass>
        <ECProperty propertyName="PropA" typeName="string"/>
      </ECEntityClass>
      <ECEntityClass typeName="C">
        <BaseClass>A</BaseClass>
        <ECProperty propertyName="PropC" typeName="string"/>
        <ECProperty propertyName="PropCInt" typeName="int"/>
        <ECProperty propertyName="PropCDouble" typeName="double"/>
        <ECProperty propertyName="PropCBool" typeName="boolean"/>
      </ECEntityClass>
      <ECEntityClass typeName="D">
        <BaseClass>A</BaseClass>
        <ECProperty propertyName="PropD" typeName="string"/>
        <ECProperty propertyName="PropD2" typeName="string"/>
      </ECEntityClass>
    </ECSchema>`,

    /** v01x00x01 - Adds multi-type properties (int, double, boolean) to class C for type-variation tests */
    v01x00x02MultiTypePropsMovePropDToA: `<?xml version="1.0" encoding="UTF-8"?>
    <ECSchema schemaName="TestDomain" alias="td" version="01.00.02" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.2">
      <ECSchemaReference name="BisCore" version="01.00.23" alias="bis"/>
      <ECEntityClass typeName="A">
        <BaseClass>bis:GraphicalElement2d</BaseClass>
        <ECProperty propertyName="PropA" typeName="string"/>
        <ECProperty propertyName="PropD" typeName="string"/>
      </ECEntityClass>
      <ECEntityClass typeName="C">
        <BaseClass>A</BaseClass>
        <ECProperty propertyName="PropC" typeName="string"/>
        <ECProperty propertyName="PropCInt" typeName="int"/>
        <ECProperty propertyName="PropCDouble" typeName="double"/>
        <ECProperty propertyName="PropCBool" typeName="boolean"/>
      </ECEntityClass>
      <ECEntityClass typeName="D">
        <BaseClass>A</BaseClass>
      </ECEntityClass>
    </ECSchema>`,

    /** v01x00x02 - Moves PropD from class D to class A (transforming change for D, analogous to MovePropCToA) */
    v01x00x02MovePropDToA: `<?xml version="1.0" encoding="UTF-8"?>
    <ECSchema schemaName="TestDomain" alias="td" version="01.00.02" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.2">
      <ECSchemaReference name="BisCore" version="01.00.23" alias="bis"/>
      <ECEntityClass typeName="A">
        <BaseClass>bis:GraphicalElement2d</BaseClass>
        <ECProperty propertyName="PropA" typeName="string"/>
        <ECProperty propertyName="PropD" typeName="string"/>
      </ECEntityClass>
      <ECEntityClass typeName="C">
        <BaseClass>A</BaseClass>
        <ECProperty propertyName="PropC" typeName="string"/>
      </ECEntityClass>
      <ECEntityClass typeName="D">
        <BaseClass>A</BaseClass>
      </ECEntityClass>
    </ECSchema>`,
    /** v01x00x01 - Adds a binary property (PropCBin) to class C */
    v01x00x01WithBinaryProp: `<?xml version="1.0" encoding="UTF-8"?>
    <ECSchema schemaName="TestDomain" alias="td" version="01.00.01" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.2">
      <ECSchemaReference name="BisCore" version="01.00.23" alias="bis"/>
      <ECEntityClass typeName="A">
        <BaseClass>bis:GraphicalElement2d</BaseClass>
        <ECProperty propertyName="PropA" typeName="string"/>
      </ECEntityClass>
      <ECEntityClass typeName="C">
        <BaseClass>A</BaseClass>
        <ECProperty propertyName="PropC" typeName="string"/>
        <ECProperty propertyName="PropCBin" typeName="binary"/>
      </ECEntityClass>
      <ECEntityClass typeName="D">
        <BaseClass>A</BaseClass>
        <ECProperty propertyName="PropD" typeName="string"/>
      </ECEntityClass>
    </ECSchema>`,
    /** v01x00x02 - Extends v01x00x01WithBinaryProp with PropD2 on class D (trivial additive change) */
    v01x00x02WithBinaryPropAndPropD2: `<?xml version="1.0" encoding="UTF-8"?>
    <ECSchema schemaName="TestDomain" alias="td" version="01.00.02" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.2">
      <ECSchemaReference name="BisCore" version="01.00.23" alias="bis"/>
      <ECEntityClass typeName="A">
        <BaseClass>bis:GraphicalElement2d</BaseClass>
        <ECProperty propertyName="PropA" typeName="string"/>
      </ECEntityClass>
      <ECEntityClass typeName="C">
        <BaseClass>A</BaseClass>
        <ECProperty propertyName="PropC" typeName="string"/>
        <ECProperty propertyName="PropCBin" typeName="binary"/>
      </ECEntityClass>
      <ECEntityClass typeName="D">
        <BaseClass>A</BaseClass>
        <ECProperty propertyName="PropD" typeName="string"/>
        <ECProperty propertyName="PropD2" typeName="string"/>
      </ECEntityClass>
    </ECSchema>`,
  };

  /**
   * Create and initialize a new test iModel with far and local briefcases.
   * @param testName Unique name for this test (passed to HubMock.startup)
   * @returns Fully initialized TestIModel with both briefcases open
   */
  public static async initialize(testName: string): Promise<TestIModel> {
    HubMock.startup(testName, KnownTestLocations.outputDir);

    let far: BriefcaseDb | undefined;
    let local: BriefcaseDb | undefined;
    try {
      const iModelId = await HubMock.createNewIModel({
        accessToken: "far-user",
        iTwinId: HubMock.iTwinId,
        iModelName: testName,
        description: `Rebase schema update with data transform tests: ${testName}`,
      });

      // Open far briefcase and use it for initialization
      far = await HubWrappers.downloadAndOpenBriefcase({
        iTwinId: HubMock.iTwinId,
        iModelId,
        accessToken: "far-user",
      });
      far.channels.addAllowedChannel(ChannelControl.sharedChannelName);
      // Initialize with base schema
      await far.importSchemaStrings([TestIModel.schemas.v01x00x00]);
      await far.pushChanges({ description: "import base schema" });

      // Create model and category
      const modelCode = IModelTestUtils.getUniqueModelCode(far, "DrawingModel");
      await far.locks.acquireLocks({ shared: IModel.dictionaryId });
      const [drawingModelId, drawingCategoryId] = withEditTxn(far, "create model and category", (txn) => {
        const [, newDrawingModelId] = IModelTestUtils.createAndInsertDrawingPartitionAndModel(txn, modelCode);
        const newDrawingCategoryId = DrawingCategory.insert(
          txn,
          IModel.dictionaryId,
          "DrawingCategory",
          new SubCategoryAppearance()
        );
        return [newDrawingModelId, newDrawingCategoryId] as const;
      });
      await far.pushChanges({ description: "create model and category" });

      // Open local briefcase
      local = await HubWrappers.downloadAndOpenBriefcase({
        iTwinId: HubMock.iTwinId,
        iModelId,
        accessToken: "local-user",
      });
      local.channels.addAllowedChannel(ChannelControl.sharedChannelName);

      return new TestIModel(iModelId, drawingModelId, drawingCategoryId, far, local);
    } catch (error) {
      if (local?.isOpen)
        local.close();

      if (far?.isOpen)
        far.close();

      HubMock.shutdown();
      throw error;
    }
  }

  public insertElement(
    txn: EditTxn,
    className: string,
    properties: Record<string, any>
  ): Id64String {
    const briefcase = txn.iModel as BriefcaseDb;
    const elementProps: GeometricElementProps = {
      classFullName: className,
      model: this.drawingModelId,
      category: this.drawingCategoryId,
      code: Code.createEmpty(),
      ...properties,
    };
    const element = briefcase.elements.createElement(elementProps);
    return txn.insertElement(element.toJSON());
  }

  public updateElement(txn: EditTxn, elementId: Id64String, updates: Record<string, any>): void {
    const briefcase = txn.iModel as BriefcaseDb;
    const element = briefcase.elements.getElementProps(elementId);
    Object.assign(element, updates);
    txn.updateElement(element);
  }

  public getElementProps(briefcase: BriefcaseDb, elementId: Id64String): any {
    return briefcase.elements.getElementProps(elementId);
  }

  public getModelProps(briefcase: BriefcaseDb, modelId: Id64String): any {
    return briefcase.models.tryGetModelProps(modelId);
  }

  public checkIfFolderExists(briefcase: BriefcaseDb, txnId: string, isSchemaFolder: boolean): boolean {
    if (isSchemaFolder)
      return BriefcaseManager.semanticRebaseSchemaFolderExists(briefcase, txnId);
    return BriefcaseManager.semanticRebaseDataFolderExists(briefcase, txnId);
  }

  public checkifRebaseFolderExists(briefcase: BriefcaseDb): boolean {
    const folderPath = BriefcaseManager.getBasePathForSemanticRebaseLocalFiles(briefcase);
    return IModelJsFs.existsSync(folderPath);
  }

  /**
   * Insert a UniqueAspect onto an element within the given EditTxn.
   * @param txn  Active EditTxn
   * @param elementId  Owning element's Id
   * @param aspectClassName  Full class name, e.g. "TestDomain:CUniqueAspect"
   * @param properties  Additional property key/value pairs
   * @returns The new aspect's ECInstanceId
   */
  public insertAspect(txn: EditTxn, elementId: Id64String, aspectClassName: string, properties: Record<string, any>): Id64String {
    const aspectProps: ElementAspectProps = {
      classFullName: aspectClassName,
      element: { id: elementId, relClassName: "BisCore.ElementOwnsUniqueAspect" },
      ...properties,
    } as ElementAspectProps;
    return txn.insertAspect(aspectProps);
  }

  /**
   * Update a UniqueAspect property within the given EditTxn.
   * Reads the existing aspect, merges updates, writes back.
   */
  public updateAspect(txn: EditTxn, elementId: Id64String, aspectClassName: string, updates: Record<string, any>): void {
    const briefcase = txn.iModel as BriefcaseDb;
    const aspects = briefcase.elements.getAspects(elementId, aspectClassName);
    chai.expect(aspects.length).to.be.greaterThan(0, "Expected at least one aspect to update");
    const aspect = aspects[0];
    Object.assign(aspect, updates);
    txn.updateAspect(aspect.toJSON());
  }

  /**
   * Delete a UniqueAspect within the given EditTxn.
   * Reads the existing aspect, then deletes it by instanceId.
   */
  public deleteAspect(txn: EditTxn, elementId: Id64String, aspectClassName: string): void {
    const briefcase = txn.iModel as BriefcaseDb;
    const aspects = briefcase.elements.getAspects(elementId, aspectClassName);
    chai.expect(aspects.length).to.be.greaterThan(0, "Expected at least one aspect to delete");
    txn.deleteAspect(aspects[0].id);
  }

  /**
   * Read a UniqueAspect from a briefcase and return it as a plain object.
   */
  public getAspect(briefcase: BriefcaseDb, elementId: Id64String, aspectClassName: string): any {
    const aspects = briefcase.elements.getAspects(elementId, aspectClassName);
    return aspects.length > 0 ? aspects[0] : undefined;
  }

  /**
   * Open and return a third briefcase connected to this iModel (useful for three-briefcase tests).
   * The caller is responsible for closing the returned briefcase.
   */
  public async openExtraBriefcase(accessToken: string = "extra-user"): Promise<BriefcaseDb> {
    const extra = await HubWrappers.downloadAndOpenBriefcase({
      iTwinId: HubMock.iTwinId,
      iModelId: this.iModelId,
      accessToken,
    });
    extra.channels.addAllowedChannel(ChannelControl.sharedChannelName);
    return extra;
  }

  /**
   * Execute an ECSql SELECT and collect all rows into a Map keyed by ECInstanceId.
   * The SELECT must list ECInstanceId as the first column. Any additional columns are captured
   * by the caller-supplied names and stored in the returned row objects.
   *
   * Rows are returned using {@link QueryRowFormat.UseJsPropertyNames} so:
   *   ECInstanceId             → row.id
   *   ec_className(ECClassId)  → row.className  (when aliased as `className`)
   *   PropA                    → row.propA
   *   PropC2                   → row.propC2
   *   etc.
   *
   * @param briefcase  The open iModel to query.
   * @param ecsql  Complete ECSql SELECT statement whose first projected column is ECInstanceId.
   */
  public static async queryToMap(briefcase: BriefcaseDb, ecsql: string): Promise<Map<Id64String, Record<string, any>>> {
    const result = new Map<Id64String, Record<string, any>>();
    const reader = briefcase.createQueryReader(ecsql, undefined, { rowFormat: QueryRowFormat.UseJsPropertyNames });
    for await (const row of reader) {
      const r = row.toRow() as Record<string, any>;
      result.set(r.id as Id64String, r);
    }
    return result;
  }

  public shutdown(): void {
    this.far.close();
    this.local.close();
    HubMock.shutdown();
  }
}

/**
 * Test suite for rebase logic with schema changes that require data transformations.
 */
describe("Semantic Rebase", function (this: Suite) {
  this.timeout(60000); // operations can be slow
  let t: TestIModel | undefined;

  before(async () => {
    await TestUtils.shutdownBackend(); // Automatically TestUtils.startBackend() is called before every test suite starts we need to shut tht down and startup our new TestUtils with semantic rebase on
    await TestUtils.startBackend({ useSemanticRebase: true });
  });

  afterEach(() => {
    if (t) {
      t.shutdown();
      t = undefined;
    }
  });

  after(async () => {
    await TestUtils.shutdownBackend();
    await TestUtils.startBackend(); // restart normal backend so subsequent test suites aren't left without IModelHost
  })

  it("local data changes onto incoming trivial schema change", async () => {
    t = await TestIModel.initialize("TrivialSchemaIncoming");
    let localTxn = startTestTxn(t.local, "local data changes onto incoming trivial schema change local");
    let farTxn = startTestTxn(t.far, "local data changes onto incoming trivial schema change far");

    // Local creates an element
    await t.local.locks.acquireLocks({ shared: t.drawingModelId });
    const elementId = t.insertElement(localTxn, "TestDomain:C", {
      propA: "value_a",
      propC: "value_c",
    });
    localTxn.saveChanges("create element");
    await pushChanges(localTxn, "create test element");
    localTxn = startTestTxn(t.local, "local data changes onto incoming trivial schema change local");

    // Far imports updated schema with new property PropC2
    await pullChanges(farTxn);
    farTxn = startTestTxn(t.far, "local data changes onto incoming trivial schema change far");
    await importSchemaStrings(farTxn, [TestIModel.schemas.v01x00x01AddPropC2]);

    // Verify that we're holding a shared lock (not exclusive) for semantic rebase
    chai.expect(t.far.locks.holdsSharedLock(IModel.repositoryModelId)).to.be.true;
    chai.expect(t.far.holdsSchemaLock).to.be.false;

    const txnProps = t.far.txns.getLastSavedTxnProps();
    chai.expect(txnProps).to.not.be.undefined;
    chai.expect(txnProps!.type).to.equal("Schema");
    chai.expect(t.checkIfFolderExists(t.far, txnProps!.id, true)).to.be.true;

    await pushChanges(farTxn, "add PropC2 to class C");

    chai.expect(t.checkIfFolderExists(t.far, txnProps!.id, true)).to.be.false; // after push the folder should not be there

    // Local makes local changes to the element
    await t.local.locks.acquireLocks({ exclusive: elementId });
    t.updateElement(localTxn, elementId, { propA: "local_update_a" });
    localTxn.saveChanges("local update to propA");

    // Local pulls and rebases local changes onto incoming schema change
    await pullChanges(localTxn);

    // Verify: local changes preserved, schema updated
    const element = t.getElementProps(t.local, elementId);
    chai.expect(element.propA).to.equal("local_update_a", "Local property update should be preserved");
    chai.expect(element.propC).to.equal("value_c", "Original propC should be preserved");

    const schema = t.local.getSchemaProps("TestDomain");
    chai.expect(schema.version).to.equal("01.00.01", "Schema should be updated to v01.00.01");
  });

  it("local trivial schema change onto incoming data changes", async () => {
    t = await TestIModel.initialize("TrivialSchemaLocal");
    let localTxn = startTestTxn(t.local, "local trivial schema change onto incoming data changes local");
    let farTxn = startTestTxn(t.far, "local trivial schema change onto incoming data changes far");

    // Local creates an element
    await t.local.locks.acquireLocks({ shared: t.drawingModelId });
    const elementId = t.insertElement(localTxn, "TestDomain:C", {
      propA: "value_a",
      propC: "value_c",
    });
    localTxn.saveChanges("create element");
    await pushChanges(localTxn, "create test element");
    localTxn = startTestTxn(t.local, "local trivial schema change onto incoming data changes local");

    // Local imports updated schema locally
    await importSchemaStrings(localTxn, [TestIModel.schemas.v01x00x01AddPropC2]);

    // Verify that we're holding a shared lock (not exclusive) for semantic rebase
    chai.expect(t.local.locks.holdsSharedLock(IModel.repositoryModelId)).to.be.true;
    chai.expect(t.local.holdsSchemaLock).to.be.false;

    const txnProps = t.local.txns.getLastSavedTxnProps();
    chai.expect(txnProps).to.not.be.undefined;
    chai.expect(txnProps!.type).to.equal("Schema");
    chai.expect(t.checkIfFolderExists(t.local, txnProps!.id, true)).to.be.true;


    // Far pulls element, then updates it
    await pullChanges(farTxn);
    farTxn = startTestTxn(t.far, "local trivial schema change onto incoming data changes far");
    await t.far.locks.acquireLocks({ exclusive: elementId });
    t.updateElement(farTxn, elementId, { propA: "far_update_a" });
    farTxn.saveChanges("far update to propA");
    await pushChanges(farTxn, "update element propA");

    // Local pulls and rebases local schema change onto incoming data changes
    await pullChanges(localTxn);

    chai.expect(t.checkIfFolderExists(t.local, txnProps!.id, true)).to.be.true; // after rebase the folder should be there until push is called

    // Verify: incoming data changes applied, local schema preserved
    const element = t.getElementProps(t.local, elementId);
    chai.expect(element.propA).to.equal("far_update_a", "Incoming property update should be applied");
    chai.expect(element.propC).to.equal("value_c", "Original propC should be preserved");

    const schema = t.local.getSchemaProps("TestDomain");
    chai.expect(schema.version).to.equal("01.00.01", "Local schema update should be preserved");
  });

  it("local data changes onto incoming data changes", async () => {
    t = await TestIModel.initialize("DataOntoData");
    let localTxn = startTestTxn(t.local, "local data changes onto incoming data changes local");
    let farTxn = startTestTxn(t.far, "local data changes onto incoming data changes far");

    // Local creates two elements
    await t.local.locks.acquireLocks({ shared: t.drawingModelId });
    const elementId1 = t.insertElement(localTxn, "TestDomain:C", {
      propA: "value_a1",
      propC: "value_c1",
    });
    const elementId2 = t.insertElement(localTxn, "TestDomain:C", {
      propA: "value_a2",
      propC: "value_c2",
    });
    localTxn.saveChanges("create elements");
    chai.expect(t.checkifRebaseFolderExists(t.local)).to.be.false; // its data changes on both sides semantic rebase is not used
    await pushChanges(localTxn, "create test elements");
    localTxn = startTestTxn(t.local, "local data changes onto incoming data changes local");
    chai.expect(t.checkifRebaseFolderExists(t.local)).to.be.false; // its data changes on both sides semantic rebase is not used

    // Far updates first element
    await pullChanges(farTxn);
    farTxn = startTestTxn(t.far, "local data changes onto incoming data changes far");
    await t.far.locks.acquireLocks({ exclusive: elementId1 });
    t.updateElement(farTxn, elementId1, { propC: "far_update_c" });
    farTxn.saveChanges("far update to propC");
    chai.expect(t.checkifRebaseFolderExists(t.far)).to.be.false; // its data changes on both sides semantic rebase is not used
    await pushChanges(farTxn, "update element propC");
    chai.expect(t.checkifRebaseFolderExists(t.far)).to.be.false; // its data changes on both sides semantic rebase is not used


    // Local makes local changes to second element
    await t.local.locks.acquireLocks({ exclusive: elementId2 });
    t.updateElement(localTxn, elementId2, { propA: "local_update_a" });
    localTxn.saveChanges("local update to propA");
    chai.expect(t.checkifRebaseFolderExists(t.local)).to.be.false; // its data changes on both sides semantic rebase is not used

    // Local pulls and rebases
    await pullChanges(localTxn);

    chai.expect(t.checkifRebaseFolderExists(t.local)).to.be.false; // its data changes on both sides semantic rebase is not used

    // Verify: both changes applied to their respective elements
    const element1 = t.getElementProps(t.local, elementId1);
    chai.expect(element1.propA).to.equal("value_a1", "Element 1 propA should be unchanged");
    chai.expect(element1.propC).to.equal("far_update_c", "Element 1 incoming update should be applied");

    const element2 = t.getElementProps(t.local, elementId2);
    chai.expect(element2.propA).to.equal("local_update_a", "Element 2 local update should be preserved");
    chai.expect(element2.propC).to.equal("value_c2", "Element 2 propC should be unchanged");
  });

  it("local trivial schema changes onto incoming trivial schema changes (local newer)", async () => {
    t = await TestIModel.initialize("TrivialSchemaLocalNewer");
    const localTxn = startTestTxn(t.local, "local trivial schema changes onto incoming trivial schema changes local newer local");
    const farTxn = startTestTxn(t.far, "local trivial schema changes onto incoming trivial schema changes local newer far");

    // Far imports v01.00.01 (adds PropC2)
    await importSchemaStrings(farTxn, [TestIModel.schemas.v01x00x01AddPropC2]);

    const txnProps = t.far.txns.getLastSavedTxnProps();
    chai.expect(txnProps).to.not.be.undefined;
    chai.expect(txnProps!.type).to.equal("Schema");
    chai.expect(t.checkIfFolderExists(t.far, txnProps!.id, true)).to.be.true;

    await pushChanges(farTxn, "add PropC2 to class C");

    chai.expect(t.checkIfFolderExists(t.far, txnProps!.id, true)).to.be.false; // after push the folder should not be there

    // Local imports v01.00.02 (adds PropC2 and PropD2 - newer)
    await importSchemaStrings(localTxn, [TestIModel.schemas.v01x00x02AddPropD2]);

    const txnPropsLocal = t.local.txns.getLastSavedTxnProps();
    chai.expect(txnPropsLocal).to.not.be.undefined;
    chai.expect(txnPropsLocal!.type).to.equal("Schema");
    chai.expect(t.checkIfFolderExists(t.local, txnPropsLocal!.id, true)).to.be.true;


    // Local pulls and rebases
    await pullChanges(localTxn);

    chai.expect(t.checkIfFolderExists(t.local, txnPropsLocal!.id, true)).to.be.true; // after rebase the folder should be there because local is newer until push is called

    // Verify: local schema preserved (newer version)
    const schema = t.local.getSchemaProps("TestDomain");
    chai.expect(schema.version).to.equal("01.00.02", "Local schema (newer) should be preserved");
  });

  it("local trivial schema changes onto incoming trivial schema changes (incoming newer)", async () => {
    t = await TestIModel.initialize("TrivialSchemaIncomingNewer");
    const localTxn = startTestTxn(t.local, "local trivial schema changes onto incoming trivial schema changes incoming newer local");
    const farTxn = startTestTxn(t.far, "local trivial schema changes onto incoming trivial schema changes incoming newer far");

    // Far imports v01.00.02 (adds PropC2 and PropD2 - newer)
    await importSchemaStrings(farTxn, [TestIModel.schemas.v01x00x02AddPropD2]);

    const txnProps = t.far.txns.getLastSavedTxnProps();
    chai.expect(txnProps).to.not.be.undefined;
    chai.expect(txnProps!.type).to.equal("Schema");
    chai.expect(t.checkIfFolderExists(t.far, txnProps!.id, true)).to.be.true;

    await pushChanges(farTxn, "update schema to v01.00.02");

    chai.expect(t.checkIfFolderExists(t.far, txnProps!.id, true)).to.be.false; // after push the folder should not be there

    // Local imports v01.00.01 (adds only PropC2 - older)
    await importSchemaStrings(localTxn, [TestIModel.schemas.v01x00x01AddPropC2]);

    const txnPropsLocal = t.local.txns.getLastSavedTxnProps();
    chai.expect(txnPropsLocal).to.not.be.undefined;
    chai.expect(txnPropsLocal!.type).to.equal("Schema");
    chai.expect(t.checkIfFolderExists(t.local, txnPropsLocal!.id, true)).to.be.true;


    // Local pulls and rebases
    await pullChanges(localTxn);
    chai.expect(t.checkIfFolderExists(t.local, txnPropsLocal!.id, true)).to.be.false; // after rebase the folder should not be there because incoming is newer so while rebasing it should be a no op
    chai.expect(t.checkifRebaseFolderExists(t.local)).to.be.false; // there should not be a rebase folder because the rebase folder is deleted after rebase if it contains nothing

    // Verify: incoming schema preserved (newer version, local should not override)
    const schema = t.local.getSchemaProps("TestDomain");
    chai.expect(schema.version).to.equal("01.00.02", "Incoming schema (newer) should win, local should not override");
  });

  it("local trivial schema changes onto incoming identical schema changes with data changes on both sides", async () => {
    t = await TestIModel.initialize("TrivialSchemaIdenticalWithData");
    const localTxn = startTestTxn(t.local, "local trivial schema changes onto incoming identical schema changes with data local");
    let farTxn = startTestTxn(t.far, "local trivial schema changes onto incoming identical schema changes with data far");

    // Far imports v01.00.01 (adds PropC2) and creates an element
    await importSchemaStrings(farTxn, [TestIModel.schemas.v01x00x01AddPropC2]);

    const txnProps = t.far.txns.getLastSavedTxnProps();
    chai.expect(txnProps).to.not.be.undefined;
    chai.expect(txnProps!.type).to.equal("Schema");
    chai.expect(t.checkIfFolderExists(t.far, txnProps!.id, true)).to.be.true;

    await pushChanges(farTxn, "add PropC2 to class C");
    farTxn = startTestTxn(t.far, "local trivial schema changes onto incoming identical schema changes with data far");

    chai.expect(t.checkIfFolderExists(t.far, txnProps!.id, true)).to.be.false; // after push the folder should not be there

    await t.far.locks.acquireLocks({ shared: t.drawingModelId });
    const farElementId = t.insertElement(farTxn, "TestDomain:C", {
      propA: "far_value_a",
      propC: "far_value_c",
      propC2: "far_value_c2",
    });
    farTxn.saveChanges("far creates element with new property");
    await pushChanges(farTxn, "far creates element");

    // Local imports the same v01.00.01 (adds PropC2) and creates an element
    await importSchemaStrings(localTxn, [TestIModel.schemas.v01x00x01AddPropC2]);

    const txnPropsLocal = t.local.txns.getLastSavedTxnProps();
    chai.expect(txnPropsLocal).to.not.be.undefined;
    chai.expect(txnPropsLocal!.type).to.equal("Schema");
    chai.expect(t.checkIfFolderExists(t.local, txnPropsLocal!.id, true)).to.be.true;


    await t.local.locks.acquireLocks({ shared: t.drawingModelId });
    const localElementId = t.insertElement(localTxn, "TestDomain:C", {
      propA: "local_value_a",
      propC: "local_value_c",
      propC2: "local_value_c2",
    });
    localTxn.saveChanges("local creates element with new property");

    // Local pulls and rebases
    await pullChanges(localTxn);

    chai.expect(t.checkIfFolderExists(t.local, txnPropsLocal!.id, true)).to.be.false; // after rebase the folder should not be there as both are identical
    chai.expect(t.checkifRebaseFolderExists(t.local)).to.be.false; // there should not be a rebase folder because the rebase folder is deleted after rebase if it contains nothing

    // Verify: schema preserved (both sides identical)
    const schema = t.local.getSchemaProps("TestDomain");
    chai.expect(schema.version).to.equal("01.00.01", "Schema should be v01.00.01");

    // Verify: both elements exist with their original properties
    const farElement = t.getElementProps(t.local, farElementId);
    chai.expect(farElement.propA).to.equal("far_value_a", "Far element propA should be preserved");
    chai.expect(farElement.propC).to.equal("far_value_c", "Far element propC should be preserved");
    chai.expect(farElement.propC2).to.equal("far_value_c2", "Far element propC2 should be preserved");

    const localElement = t.getElementProps(t.local, localElementId);
    chai.expect(localElement.propA).to.equal("local_value_a", "Local element propA should be preserved");
    chai.expect(localElement.propC).to.equal("local_value_c", "Local element propC should be preserved");
    chai.expect(localElement.propC2).to.equal("local_value_c2", "Local element propC2 should be preserved");
  });

  it("both add different properties, increment to same version number", async () => {
    t = await TestIModel.initialize("TrivialSchemaIncompatible");
    const localTxn = startTestTxn(t.local, "both add different properties increment to same version local");
    const farTxn = startTestTxn(t.far, "both add different properties increment to same version far");

    await importSchemaStrings(farTxn, [TestIModel.schemas.v01x00x01AddPropC2]);
    await pushChanges(farTxn, "add PropC2 to class C");

    await importSchemaStrings(localTxn, [TestIModel.schemas.v01x00x01AddPropC3Incompatible]);

    await pullChanges(localTxn); // TODO: this currently passes, because same version number means no upgrade is attempted
    //TODO: this should probably fail instead as both sides made incompatible changes to the same version, but this is unrelated to semantic rebase itself

    const schema = t.local.getSchemaProps("TestDomain");
    chai.expect(schema.version).to.equal("01.00.01", "Schema should be v01.00.01");
  });

  it("both add compatible properties, local version number higher", async () => {
    t = await TestIModel.initialize("CompatibleSchemaLocalHigher");
    const localTxn = startTestTxn(t.local, "both add compatible properties local version higher local");
    const farTxn = startTestTxn(t.far, "both add compatible properties local version higher far");

    // Far imports v01.00.01 (adds PropC2)
    await importSchemaStrings(farTxn, [TestIModel.schemas.v01x00x01AddPropC2]);
    await pushChanges(farTxn, "add PropC2 to class C");

    // Local imports v01.00.02 (adds PropC2 and PropD2 - compatible higher version)
    await importSchemaStrings(localTxn, [TestIModel.schemas.v01x00x02AddPropD2]);

    // Local pulls and rebases
    await pullChanges(localTxn);

    // Verify: Local schema wins (higher version)
    const schema = t.local.getSchemaProps("TestDomain");
    chai.expect(schema.version).to.equal("01.00.02", "Schema should be v01.00.02 (higher version wins)");
    const classC = await t.local.schemaContext.getSchemaItem("TestDomain", "C", EntityClass);
    chai.expect(classC).to.not.be.undefined;
    chai.expect(await classC!.getProperty("PropC2")).to.exist;
    const classD = await t.local.schemaContext.getSchemaItem("TestDomain", "D", EntityClass);
    chai.expect(classD).to.not.be.undefined;
    chai.expect(await classD!.getProperty("PropD2")).to.exist;
  });

  it("both add compatible properties, incoming version number higher", async () => {
    t = await TestIModel.initialize("CompatibleSchemaIncomingHigher");
    const localTxn = startTestTxn(t.local, "both add compatible properties incoming version higher local");
    const farTxn = startTestTxn(t.far, "both add compatible properties incoming version higher far");

    // Far imports v01.00.02 (adds PropC2 and PropD2 - higher version)
    await importSchemaStrings(farTxn, [TestIModel.schemas.v01x00x02AddPropD2]);
    await pushChanges(farTxn, "update schema to v01.00.02");

    // Local imports v01.00.01 (adds only PropC2 - compatible lower version)
    await importSchemaStrings(localTxn, [TestIModel.schemas.v01x00x01AddPropC2]);

    // Local pulls and rebases
    await pullChanges(localTxn);

    // Verify: Incoming schema wins (higher version)
    const schema = t.local.getSchemaProps("TestDomain");
    chai.expect(schema.version).to.equal("01.00.02", "Schema should be v01.00.02 (higher version wins)");
    const classC = await t.local.schemaContext.getSchemaItem("TestDomain", "C", EntityClass);
    chai.expect(classC).to.not.be.undefined;
    chai.expect(await classC!.getProperty("PropC2")).to.exist;
    const classD = await t.local.schemaContext.getSchemaItem("TestDomain", "D", EntityClass);
    chai.expect(classD).to.not.be.undefined;
    chai.expect(await classD!.getProperty("PropD2")).to.exist;
  });

  it("both add same but incompatible property, local version number higher", async () => {
    t = await TestIModel.initialize("TrivialSchemaIncompatible");
    const localTxn = startTestTxn(t.local, "both add same but incompatible property local version higher local");
    const farTxn = startTestTxn(t.far, "both add same but incompatible property local version higher far");

    await importSchemaStrings(farTxn, [TestIModel.schemas.v01x00x01AddPropC2]);
    await pushChanges(farTxn, "add PropC2 to class C");

    await importSchemaStrings(localTxn, [TestIModel.schemas.v01x00x02AddPropC2Incompatible]);

    // Local pulls and rebases - this should detect the incompatibility and fail
    await chai.expect(pullChanges(localTxn)).to.be.rejectedWith("ECSchema Upgrade failed");
  });

  it("both add same but incompatible property, incoming version number higher", async () => {
    t = await TestIModel.initialize("TrivialSchemaIncompatible");
    const localTxn = startTestTxn(t.local, "both add same but incompatible property incoming version higher local");
    const farTxn = startTestTxn(t.far, "both add same but incompatible property incoming version higher far");

    await importSchemaStrings(farTxn, [TestIModel.schemas.v01x00x02AddPropC2Incompatible]);
    await pushChanges(farTxn, "import v01.00.02 with PropC2 as int");

    // Local uses v01.00.03 with PropC2:string — higher version ensures the upgrade is attempted
    // during reinstatement, which detects the type mismatch (string vs int)
    await importSchemaStrings(localTxn, [TestIModel.schemas.v01x00x03AddPropC2]);

    // Local pulls and rebases - this should detect the incompatibility and fail
    await chai.expect(pullChanges(localTxn)).to.be.rejectedWith("ECSchema Upgrade failed");
  });

  it("local transforming schema change onto incoming trivial schema change", async () => {
    t = await TestIModel.initialize("LocalTransformIncomingTrivial");
    const farTxn = startTestTxn(t.far, "local transforming schema change onto incoming trivial schema change far");
    const localTxn = startTestTxn(t.local, "local transforming schema change onto incoming trivial schema change local");

    // Far: Insert Element and import trivial schema change
    await t.far.locks.acquireLocks({ shared: t.drawingModelId });
    const farElementId = t.insertElement(farTxn, "TestDomain:C", {
      propA: "far_value_a",
      propC: "far_value_c",
    });
    farTxn.saveChanges("far create element");

    await importSchemaStrings(farTxn, [TestIModel.schemas.v01x00x01AddPropC2]);

    const txnPropsFar = t.far.txns.getLastSavedTxnProps();
    chai.expect(txnPropsFar).to.not.be.undefined;
    chai.expect(txnPropsFar!.type).to.equal("Schema");
    chai.expect(t.checkIfFolderExists(t.far, txnPropsFar!.id, true)).to.be.true; // schema folder should exist

    await pushChanges(farTxn, "far add PropC2");

    chai.expect(t.checkifRebaseFolderExists(t.far)).to.be.false; // after push the folder should not be there

    // Local: Insert Element and import transforming schema change
    await t.local.locks.acquireLocks({ shared: t.drawingModelId });
    const localElementId = t.insertElement(localTxn, "TestDomain:C", {
      propA: "local_value_a",
      propC: "local_value_c",
    });
    localTxn.saveChanges("local create element");

    await importSchemaStrings(localTxn, [TestIModel.schemas.v01x00x02MovePropCToA]);

    const txnPropsLocal = t.local.txns.getLastSavedTxnProps();
    chai.expect(txnPropsLocal).to.not.be.undefined;
    chai.expect(txnPropsLocal!.type).to.equal("Schema");
    chai.expect(t.checkIfFolderExists(t.local, txnPropsLocal!.id, true)).to.be.true; // schema folder should exist

    // Local pulls and rebases transforming change onto incoming trivial change
    await pushChanges(localTxn, "local move PropC to A");

    chai.expect(t.checkifRebaseFolderExists(t.local)).to.be.false; // after push the folder should not be there

    // Verify: both elements have PropC intact, schema transformed locally
    t.local.clearCaches(); // Clear caches to ensure we read transformed properties from iModel
    const farElement = t.getElementProps(t.local, farElementId);
    chai.expect(farElement.propA).to.equal("far_value_a", "Far element propA should be preserved");
    chai.expect(farElement.propC).to.equal("far_value_c", "Far element propC should be preserved after transform");

    const localElement = t.getElementProps(t.local, localElementId);
    chai.expect(localElement.propA).to.equal("local_value_a", "Local element propA should be preserved");
    chai.expect(localElement.propC).to.equal("local_value_c", "Local element propC should be preserved after transform");
  });

  it("local trivial schema change onto incoming transforming schema change", async () => {
    t = await TestIModel.initialize("LocalTrivialIncomingTransform");
    const farTxn = startTestTxn(t.far, "local trivial schema change onto incoming transforming schema change far");
    const localTxn = startTestTxn(t.local, "local trivial schema change onto incoming transforming schema change local");

    // Far: Insert Element and import transforming schema change
    await t.far.locks.acquireLocks({ shared: t.drawingModelId });
    const farElementId = t.insertElement(farTxn, "TestDomain:C", {
      propA: "far_value_a",
      propC: "far_value_c",
    });
    farTxn.saveChanges("far create element");

    await importSchemaStrings(farTxn, [TestIModel.schemas.v01x00x02MovePropCToA]);
    await pushChanges(farTxn, "far move PropC to A");

    // Local: Insert Element and import trivial schema change
    await t.local.locks.acquireLocks({ shared: t.drawingModelId });
    const localElementId = t.insertElement(localTxn, "TestDomain:C", {
      propA: "local_value_a",
      propC: "local_value_c",
    });
    localTxn.saveChanges("local create element");

    await importSchemaStrings(localTxn, [TestIModel.schemas.v01x00x01AddPropC2]);

    const txnPropsLocal = t.local.txns.getLastSavedTxnProps();
    chai.expect(txnPropsLocal).to.not.be.undefined;
    chai.expect(txnPropsLocal!.type).to.equal("Schema");
    chai.expect(t.checkIfFolderExists(t.local, txnPropsLocal!.id, true)).to.be.true; // schema folder should exist

    // Local pulls and rebases trivial change onto incoming transforming change
    await pushChanges(localTxn, "local add PropC2");

    chai.expect(t.checkifRebaseFolderExists(t.local)).to.be.false; // after push the folder should not be there

    t.local.clearCaches(); // Clear caches to ensure we read transformed properties from iModel
    // Verify: both elements have PropC intact after incoming transform
    const farElement = t.getElementProps(t.local, farElementId);
    chai.expect(farElement.propA).to.equal("far_value_a", "Far element propA should be preserved");
    chai.expect(farElement.propC).to.equal("far_value_c", "Far element propC should be preserved after incoming transform");

    const localElement = t.getElementProps(t.local, localElementId);
    chai.expect(localElement.propA).to.equal("local_value_a", "Local element propA should be preserved");
    chai.expect(localElement.propC).to.equal("local_value_c", "Local element propC should be preserved after incoming transform");
  });

  it("local transforming schema change onto incoming transforming schema change", async () => {
    t = await TestIModel.initialize("BothTransforming");
    const farTxn = startTestTxn(t.far, "local transforming schema change onto incoming transforming schema change far");
    const localTxn = startTestTxn(t.local, "local transforming schema change onto incoming transforming schema change local");

    // Far: Create elements with PropC and PropD, import transforming schema (moves PropC to A)
    await t.far.locks.acquireLocks({ shared: t.drawingModelId });
    const farElementC = t.insertElement(farTxn, "TestDomain:C", {
      propA: "far_value_a_c",
      propC: "far_value_c",
    });
    const farElementD = t.insertElement(farTxn, "TestDomain:D", {
      propA: "far_value_a_d",
      propD: "far_value_d",
    });
    farTxn.saveChanges("far create elements");

    await importSchemaStrings(farTxn, [TestIModel.schemas.v01x00x02MovePropCToA]);

    const txnPropsFar = t.far.txns.getLastSavedTxnProps();
    chai.expect(txnPropsFar).to.not.be.undefined;
    chai.expect(txnPropsFar!.type).to.equal("Schema");
    chai.expect(t.checkIfFolderExists(t.far, txnPropsFar!.id, true)).to.be.true; // schema folder should exist

    farTxn.saveChanges("far move PropC to A");
    await pushChanges(farTxn, "far transform PropC");

    chai.expect(t.checkifRebaseFolderExists(t.far)).to.be.false; // after push the folder should not be there

    // Local: Create elements with PropC and PropD, import transforming schema (moves both PropC and PropD to A)
    await t.local.locks.acquireLocks({ shared: t.drawingModelId });
    const localElementC = t.insertElement(localTxn, "TestDomain:C", {
      propA: "local_value_a_c",
      propC: "local_value_c",
    });
    const localElementD = t.insertElement(localTxn, "TestDomain:D", {
      propA: "local_value_a_d",
      propD: "local_value_d",
    });
    localTxn.saveChanges("local create elements");

    await importSchemaStrings(localTxn, [TestIModel.schemas.v01x00x03MovePropCAndD]);

    const txnPropsLocal = t.local.txns.getLastSavedTxnProps();
    chai.expect(txnPropsLocal).to.not.be.undefined;
    chai.expect(txnPropsLocal!.type).to.equal("Schema");
    chai.expect(t.checkIfFolderExists(t.local, txnPropsLocal!.id, true)).to.be.true; // schema folder should exist

    localTxn.saveChanges("local move PropC and PropD to A");
    // Local pulls and rebases both transforming changes
    await pushChanges(localTxn, "local transform PropC and PropD");

    chai.expect(t.checkifRebaseFolderExists(t.local)).to.be.false; // after push the folder should not be there

    t.far.clearCaches(); // Clear caches to ensure we read transformed properties from iModel
    t.local.clearCaches(); // Clear caches to ensure we read transformed properties from iModel
    // Verify: all elements have both PropC and PropD intact
    const farElemC = t.getElementProps(t.local, farElementC);
    chai.expect(farElemC.propA).to.equal("far_value_a_c", "Far element C propA should be preserved");
    chai.expect(farElemC.propC).to.equal("far_value_c", "Far element C propC should be preserved after both transforms");

    const farElemD = t.getElementProps(t.local, farElementD);
    chai.expect(farElemD.propA).to.equal("far_value_a_d", "Far element D propA should be preserved");
    chai.expect(farElemD.propD).to.equal("far_value_d", "Far element D propD should be preserved after both transforms");

    const localElemC = t.getElementProps(t.local, localElementC);
    chai.expect(localElemC.propA).to.equal("local_value_a_c", "Local element C propA should be preserved");
    chai.expect(localElemC.propC).to.equal("local_value_c", "Local element C propC should be preserved after both transforms");

    const localElemD = t.getElementProps(t.local, localElementD);
    chai.expect(localElemD.propA).to.equal("local_value_a_d", "Local element D propA should be preserved");
    chai.expect(localElemD.propD).to.equal("local_value_d", "Local element D propD should be preserved after both transforms");
  });

  it("local data update onto incoming transforming schema change", async () => {
    t = await TestIModel.initialize("LocalDataIncomingTransform");
    let farTxn = startTestTxn(t.far, "local data update onto incoming transforming schema change far");
    let localTxn = startTestTxn(t.local, "local data update onto incoming transforming schema change local");

    // Insert one instance and populate to both far and local
    await t.far.locks.acquireLocks({ shared: t.drawingModelId });
    const elementId = t.insertElement(farTxn, "TestDomain:C", {
      propA: "initial_value_a",
      propC: "initial_value_c",
    });
    farTxn.saveChanges("far create element");
    await pushChanges(farTxn, "create shared element");
    farTxn = startTestTxn(t.far, "local data update onto incoming transforming schema change far");

    // Local pulls to get the element
    await pullChanges(localTxn);
    localTxn = startTestTxn(t.local, "local data update onto incoming transforming schema change local");

    // Far imports transforming schema (moves PropC from C to A)
    await importSchemaStrings(farTxn, [TestIModel.schemas.v01x00x02MovePropCToA]);

    const txnPropsFar = t.far.txns.getLastSavedTxnProps();
    chai.expect(txnPropsFar).to.not.be.undefined;
    chai.expect(txnPropsFar!.type).to.equal("Schema");
    chai.expect(t.checkIfFolderExists(t.far, txnPropsFar!.id, true)).to.be.true; // schema folder should exist

    await pushChanges(farTxn, "far move PropC to A");

    chai.expect(t.checkifRebaseFolderExists(t.far)).to.be.false; // after push the folder should not be there

    // Local updates PropC on the element
    await t.local.locks.acquireLocks({ exclusive: elementId });
    t.updateElement(localTxn, elementId, { propC: "local_modified_c" });
    localTxn.saveChanges("local update propC");
    let element = t.getElementProps(t.local, elementId);
    chai.expect(element.propA).to.equal("initial_value_a", "PropA should be unchanged");
    chai.expect(element.propC).to.equal("local_modified_c", "PropC should have the local modified value before incoming transform");

    chai.expect(t.checkifRebaseFolderExists(t.local)).to.be.false; // no schema change yet on local so no rebase folder

    // Local pulls and rebases data change onto incoming transforming schema change
    await pullChanges(localTxn);

    // after rebase the folder should not be there because data change folder is created on the fly and removed once rebased and rebase folder is also removed if it contains nothing
    chai.expect(t.checkifRebaseFolderExists(t.local)).to.be.false;

    t.local.clearCaches(); // Clear caches to ensure we read transformed properties from iModel

    // Verify: PropC has the modified local value after the transform
    element = t.getElementProps(t.local, elementId);
    chai.expect(element.propA).to.equal("initial_value_a", "PropA should be unchanged");
    chai.expect(element.propC).to.equal("local_modified_c", "PropC should have the local modified value after incoming transform");

    const schema = t.local.getSchemaProps("TestDomain");
    chai.expect(schema.version).to.equal("01.00.02", "Schema should be transformed to v01.00.02");
  });

  it("Incoming data update onto local transforming schema change", async () => {
    t = await TestIModel.initialize("IncomingDataLocalTransform");
    const farTxn = startTestTxn(t.far, "Incoming data update onto local transforming schema change far");
    const localTxn = startTestTxn(t.local, "Incoming data update onto local transforming schema change local");

    // Insert one instance and populate to both far and local
    await t.far.locks.acquireLocks({ shared: t.drawingModelId });
    const elementIdFar = t.insertElement(farTxn, "TestDomain:C", {
      propA: "far_value_a",
      propC: "far_value_c",
    });
    farTxn.saveChanges("far create element");
    chai.expect(t.checkifRebaseFolderExists(t.far)).to.be.false; // no schema change yet on far so no rebase folder
    await pushChanges(farTxn, "create shared element");
    chai.expect(t.checkifRebaseFolderExists(t.far)).to.be.false; // after push the folder should not be there

    await t.local.locks.acquireLocks({ shared: t.drawingModelId });
    const elementIdLocal = t.insertElement(localTxn, "TestDomain:C", {
      propA: "local_value_a",
      propC: "local_value_c",
    });
    localTxn.saveChanges("local create element");
    // Far imports transforming schema (moves PropC from C to A)
    await importSchemaStrings(localTxn, [TestIModel.schemas.v01x00x02MovePropCToA]);
    const txnPropsLocal = t.local.txns.getLastSavedTxnProps();
    chai.expect(txnPropsLocal).to.not.be.undefined;
    chai.expect(txnPropsLocal!.type).to.equal("Schema");
    chai.expect(t.checkIfFolderExists(t.local, txnPropsLocal!.id, true)).to.be.true; // schema folder should exist

    // local pulls and rebases and then pushes
    await pushChanges(localTxn, "far move PropC to A");

    chai.expect(t.checkifRebaseFolderExists(t.local)).to.be.false; // after push the folder should not be there

    t.local.clearCaches(); // Clear caches to ensure we read transformed properties from iModel

    const elementFar = t.getElementProps(t.local, elementIdFar);
    chai.expect(elementFar.propA).to.equal("far_value_a", "PropA should be unchanged");
    chai.expect(elementFar.propC).to.equal("far_value_c", "PropC should be unchanged");

    const elementLocal = t.getElementProps(t.local, elementIdLocal);
    chai.expect(elementLocal.propA).to.equal("local_value_a", "PropA should be unchanged");
    chai.expect(elementLocal.propC).to.equal("local_value_c", "PropC should be unchanged");

    const schema = t.local.getSchemaProps("TestDomain");
    chai.expect(schema.version).to.equal("01.00.02", "Schema should be transformed to v01.00.02");
  });

  it("Check if associated rebase folders get deleted when a briefcase is deleted or not", async () => {
    t = await TestIModel.initialize("IncomingDataLocalTransform");
    // Must close briefcases before deleting their files - on Windows, open files are locked by the OS.
    // Save paths before closing since pathName getter throws on closed dbs.
    const localPath = t.local.pathName;
    const localRebasePath = BriefcaseManager.getBasePathForSemanticRebaseLocalFiles(t.local);
    const farPath = t.far.pathName;
    const farRebasePath = BriefcaseManager.getBasePathForSemanticRebaseLocalFiles(t.far);
    t.local.close();
    await BriefcaseManager.deleteBriefcaseFiles(localPath);
    chai.expect(IModelJsFs.existsSync(localRebasePath)).to.be.false; // after briefcase deletion the rebase folder should also be deleted
    t.far.close();
    await BriefcaseManager.deleteBriefcaseFiles(farPath);
    chai.expect(IModelJsFs.existsSync(farRebasePath)).to.be.false; // after briefcase deletion the rebase folder should also be deleted
  });

  it("local multiple data transactions onto incoming transforming schema change", async () => {
    t = await TestIModel.initialize("LocalMultipleDataIncomingTransform");
    let farTxn = startTestTxn(t.far, "local multiple data transactions onto incoming transforming schema change far");
    let localTxn = startTestTxn(t.local, "local multiple data transactions onto incoming transforming schema change local");

    // Insert initial element and push
    await t.local.locks.acquireLocks({ shared: t.drawingModelId });
    const elementId1 = t.insertElement(localTxn, "TestDomain:C", {
      propA: "initial_a",
      propC: "initial_c",
    });
    localTxn.saveChanges("create first element");
    await pushChanges(localTxn, "create initial element");
    localTxn = startTestTxn(t.local, "local multiple data transactions onto incoming transforming schema change local");

    // Far imports transforming schema (moves PropC from C to A)
    await pullChanges(farTxn);
    farTxn = startTestTxn(t.far, "local multiple data transactions onto incoming transforming schema change far");
    await importSchemaStrings(farTxn, [TestIModel.schemas.v01x00x02MovePropCToA]);
    await pushChanges(farTxn, "far move PropC to A");

    // Local makes first data change
    await t.local.locks.acquireLocks({ exclusive: elementId1 });
    t.updateElement(localTxn, elementId1, { propA: "first_update_a" });
    localTxn.saveChanges("first data change");

    // Local makes second data change - create new element
    await t.local.locks.acquireLocks({ shared: t.drawingModelId });
    const elementId2 = t.insertElement(localTxn, "TestDomain:C", {
      propA: "second_element_a",
      propC: "second_element_c",
    });
    localTxn.saveChanges("second data change - new element");

    // Local pulls and rebases both transactions onto incoming transforming schema
    await pullChanges(localTxn);

    t.local.clearCaches();

    // Verify: both local data changes preserved after incoming transform
    const element1 = t.getElementProps(t.local, elementId1);
    chai.expect(element1.propA).to.equal("first_update_a", "First element propA update should be preserved");
    chai.expect(element1.propC).to.equal("initial_c", "First element propC should be preserved after transform");

    const element2 = t.getElementProps(t.local, elementId2);
    chai.expect(element2.propA).to.equal("second_element_a", "Second element propA should be preserved");
    chai.expect(element2.propC).to.equal("second_element_c", "Second element propC should be preserved after transform");

    const schema = t.local.getSchemaProps("TestDomain");
    chai.expect(schema.version).to.equal("01.00.02", "Schema should be transformed to v01.00.02");
  });

  it("local transforming schema change onto incoming multiple data transactions", async () => {
    t = await TestIModel.initialize("LocalTransformIncomingMultipleData");
    let farTxn = startTestTxn(t.far, "local transforming schema change onto incoming multiple data transactions far");
    let localTxn = startTestTxn(t.local, "local transforming schema change onto incoming multiple data transactions local");

    // Create initial element
    await t.far.locks.acquireLocks({ shared: t.drawingModelId });
    const elementId1 = t.insertElement(farTxn, "TestDomain:C", {
      propA: "initial_a",
      propC: "initial_c",
    });
    farTxn.saveChanges("create first element");
    await pushChanges(farTxn, "create initial element");
    farTxn = startTestTxn(t.far, "local transforming schema change onto incoming multiple data transactions far");

    // Local pulls and imports transforming schema
    await pullChanges(localTxn);
    localTxn = startTestTxn(t.local, "local transforming schema change onto incoming multiple data transactions local");
    await importSchemaStrings(localTxn, [TestIModel.schemas.v01x00x02MovePropCToA]);

    // Far makes first data change
    await t.far.locks.acquireLocks({ exclusive: elementId1 });
    t.updateElement(farTxn, elementId1, { propA: "far_first_update_a" });
    farTxn.saveChanges("far first data change");

    // Far makes second data change - create new element
    await t.far.locks.acquireLocks({ shared: t.drawingModelId });
    const elementId2 = t.insertElement(farTxn, "TestDomain:C", {
      propA: "far_second_element_a",
      propC: "far_second_element_c",
    });
    farTxn.saveChanges("far second data change - new element");
    await pushChanges(farTxn, "far multiple data changes");

    // Local pulls and rebases local transforming schema onto incoming data changes
    await pullChanges(localTxn);

    t.local.clearCaches();

    // Verify: both incoming data changes applied, local schema transformation preserved
    const element1 = t.getElementProps(t.local, elementId1);
    chai.expect(element1.propA).to.equal("far_first_update_a", "First element incoming update should be applied");
    chai.expect(element1.propC).to.equal("initial_c", "First element propC should be preserved after transform");

    const element2 = t.getElementProps(t.local, elementId2);
    chai.expect(element2.propA).to.equal("far_second_element_a", "Second element should exist with correct propA");
    chai.expect(element2.propC).to.equal("far_second_element_c", "Second element propC should be preserved after transform");

    const schema = t.local.getSchemaProps("TestDomain");
    chai.expect(schema.version).to.equal("01.00.02", "Local schema transformation should be preserved");
  });

  it("should fail when importing schema with unsaved data changes", async () => {
    t = await TestIModel.initialize("UnsavedDataChangesSchemaImport");
    const localTxn = startTestTxn(t.local, "should fail when importing schema with unsaved data changes local");

    // Create element but DO NOT save changes
    await t.local.locks.acquireLocks({ shared: t.drawingModelId });
    t.insertElement(localTxn, "TestDomain:C", {
      propA: "unsaved_a",
      propC: "unsaved_c",
    });
    // Intentionally not saving the active local transaction before schema import.

    // Try to import schema - this should fail
    await chai.expect(
      localTxn.iModel.importSchemaStrings([TestIModel.schemas.v01x00x01AddPropC2])
    ).to.be.rejectedWith("Cannot import schemas with unsaved changes when useSemanticRebase flag is on");

    // Verify: element was not saved, schema was not imported
    const schema = t.local.getSchemaProps("TestDomain");
    chai.expect(schema.version).to.equal("01.00.00", "Schema should remain at v01.00.00");
    chai.expect(t.local.isOpen).to.be.true;
  });

});

/**
 * Test suite for tests related to rebase logic with schema changes (for indirect changes) that require data transformations.
 */
describe("Semantic Rebase with indirect changes", function (this: Suite) {
  this.timeout(60000); // operations can be slow
  let t: TestIModel | undefined;

  before(async () => {
    await TestUtils.shutdownBackend(); // Automatically TestUtils.startBackend() is called before every test suite starts we need to shut tht down and startup our new TestUtils with semantic rebase on
    await TestUtils.startBackend({ useSemanticRebase: true });
  });

  afterEach(() => {
    if (t) {
      t.shutdown();
      t = undefined;
    }
  });

  after(async () => {
    await TestUtils.shutdownBackend();
    await TestUtils.startBackend(); // restart normal backend so subsequent test suites aren't left without IModelHost
  });

  it("Incoming data update onto local data change", async () => { // This doesnot actually take the semantic rebase route as both incoming and local have data changes only
    t = await TestIModel.initialize("IncomingDataLocalDataChange");
    const farTxn = startTestTxn(t.far, "Incoming data update onto local data change far");
    const localTxn = startTestTxn(t.local, "Incoming data update onto local data change local");

    let elementIdFar: Id64String = "";
    await t.far.txns.withIndirectTxnModeAsync(async () => {
      // Insert one instance and populate to both far and local
      elementIdFar = t!.insertElement(farTxn, "TestDomain:C", {
        propA: "far_value_a",
        propC: "far_value_c",
      });
    });
    farTxn.saveChanges("far create indirect element");
    await pushChanges(farTxn, "create indirect element");

    let elementIdLocal: Id64String = "";
    await t.local.txns.withIndirectTxnModeAsync(async () => {
      // Insert one instance and populate to both far and local
      elementIdLocal = t!.insertElement(localTxn, "TestDomain:C", {
        propA: "local_value_a",
        propC: "local_value_c",
      });
    });
    localTxn.saveChanges("local create indirect element");
    chai.expect(t.checkifRebaseFolderExists(t.local)).to.be.false; // there should not be a rebase folder because no schema change on either side
    await pushChanges(localTxn, "local pulls andcreate indirect element");
    chai.expect(t.checkifRebaseFolderExists(t.local)).to.be.false; // there should not be a rebase folder because no schema change on either side
    chai.expect(Id64.isValidId64(elementIdFar) && Id64.isValidId64(elementIdLocal)).to.be.true;

    t.local.clearCaches(); // Clear caches to ensure we read transformed properties from iModel

    const elementFar = t.getElementProps(t.local, elementIdFar);
    chai.expect(elementFar.propA).to.equal("far_value_a", "PropA should be unchanged");
    chai.expect(elementFar.propC).to.equal("far_value_c", "PropC should be unchanged");

    const elementLocal = t.getElementProps(t.local, elementIdLocal);
    chai.expect(elementLocal.propA).to.equal("local_value_a", "PropA should be unchanged");
    chai.expect(elementLocal.propC).to.equal("local_value_c", "PropC should be unchanged");
  });

  it("Incoming data and schema update onto local data change", async () => {
    t = await TestIModel.initialize("IncomingDataAndSchemaLocalDataChange");
    const farTxn = startTestTxn(t.far, "Incoming data and schema update onto local data change far");
    const localTxn = startTestTxn(t.local, "Incoming data and schema update onto local data change local");

    await importSchemaStrings(farTxn, [TestIModel.schemas.v01x00x01AddPropC2]);

    const farTxnProps = t.far.txns.getLastSavedTxnProps();
    chai.expect(farTxnProps).to.not.be.undefined;
    chai.expect(farTxnProps!.type).to.equal("Schema");
    chai.expect(t.checkIfFolderExists(t.far, farTxnProps!.id, true)).to.be.true; // schema folder should exist

    let elementIdFar: Id64String = "";
    await t.far.txns.withIndirectTxnModeAsync(async () => {
      // Insert one instance and populate to both far and local
      elementIdFar = t!.insertElement(farTxn, "TestDomain:C", {
        propA: "far_value_a",
        propC: "far_value_c",
      });
    });
    farTxn.saveChanges("far create indirect element");
    await pushChanges(farTxn, "create indirect element");

    chai.expect(t.checkIfFolderExists(t.far, farTxnProps!.id, true)).to.be.false; // after push the schema folder should not be there
    chai.expect(t.checkifRebaseFolderExists(t.far)).to.be.false; // after push the folder should not be there

    let elementIdLocal: Id64String = "";
    await t.local.txns.withIndirectTxnModeAsync(async () => {
      // Insert one instance and populate to both far and local
      elementIdLocal = t!.insertElement(localTxn, "TestDomain:C", {
        propA: "local_value_a",
        propC: "local_value_c",
      });
    });
    localTxn.saveChanges("local create indirect element");
    chai.expect(t.checkifRebaseFolderExists(t.local)).to.be.false; // there should not be a rebase folder because no schema change on local side
    await pushChanges(localTxn, "local pulls andcreate indirect element");
    chai.expect(t.checkifRebaseFolderExists(t.local)).to.be.false;
    chai.expect(Id64.isValidId64(elementIdFar) && Id64.isValidId64(elementIdLocal)).to.be.true;

    t.local.clearCaches(); // Clear caches to ensure we read transformed properties from iModel

    const elementFar = t.getElementProps(t.local, elementIdFar);
    chai.expect(elementFar.propA).to.equal("far_value_a", "PropA should be unchanged");
    chai.expect(elementFar.propC).to.equal("far_value_c", "PropC should be unchanged");

    const elementLocal = t.getElementProps(t.local, elementIdLocal);
    chai.expect(elementLocal.propA).to.equal("local_value_a", "PropA should be unchanged");
    chai.expect(elementLocal.propC).to.equal("local_value_c", "PropC should be unchanged");

    const schema = t.local.getSchemaProps("TestDomain");
    chai.expect(schema.version).to.equal("01.00.01", "Schema should be transformed to v01.00.02");
  });

  it("Incoming data and schema update onto local data and schema change", async () => {
    t = await TestIModel.initialize("IncomingDataLocalDataAndSchemaChange");
    const farTxn = startTestTxn(t.far, "Incoming data and schema update onto local data and schema change far");
    const localTxn = startTestTxn(t.local, "Incoming data and schema update onto local data and schema change local");

    await importSchemaStrings(farTxn, [TestIModel.schemas.v01x00x01AddPropC2]);
    const farTxnProps = t.far.txns.getLastSavedTxnProps();
    chai.expect(farTxnProps).to.not.be.undefined;
    chai.expect(farTxnProps!.type).to.equal("Schema");
    chai.expect(t.checkIfFolderExists(t.far, farTxnProps!.id, true)).to.be.true; // schema folder should exist

    let elementIdFar: Id64String = "";
    await t.far.txns.withIndirectTxnModeAsync(async () => {
      // Insert one instance and populate to both far and local
      elementIdFar = t!.insertElement(farTxn, "TestDomain:C", {
        propA: "far_value_a",
        propC: "far_value_c",
      });
    });
    farTxn.saveChanges("far create indirect element");
    await pushChanges(farTxn, "create indirect element");
    chai.expect(t.checkIfFolderExists(t.far, farTxnProps!.id, true)).to.be.false; // after push the schema folder should not be there
    chai.expect(t.checkifRebaseFolderExists(t.far)).to.be.false; // after push the folder should not be there

    await importSchemaStrings(localTxn, [TestIModel.schemas.v01x00x02AddPropD2]);
    const localTxnProps = t.local.txns.getLastSavedTxnProps();
    chai.expect(localTxnProps).to.not.be.undefined;
    chai.expect(localTxnProps!.type).to.equal("Schema");
    chai.expect(t.checkIfFolderExists(t.local, localTxnProps!.id, true)).to.be.true; // schema folder should exist

    let elementIdLocal: Id64String = "";
    await t.local.txns.withIndirectTxnModeAsync(async () => {
      // Insert one instance and populate to both far and local
      elementIdLocal = t!.insertElement(localTxn, "TestDomain:C", {
        propA: "local_value_a",
        propC: "local_value_c",
      });
    });
    localTxn.saveChanges("local create indirect element");
    chai.expect(t.checkifRebaseFolderExists(t.local)).to.be.true; // there should be a rebase folder because schema change on local side
    await pushChanges(localTxn, "local pulls andcreate indirect element");
    chai.expect(t.checkifRebaseFolderExists(t.local)).to.be.false; // after push the folder should not be there
    chai.expect(Id64.isValidId64(elementIdFar) && Id64.isValidId64(elementIdLocal)).to.be.true;

    t.local.clearCaches(); // Clear caches to ensure we read transformed properties from iModel

    const elementFar = t.getElementProps(t.local, elementIdFar);
    chai.expect(elementFar.propA).to.equal("far_value_a", "PropA should be unchanged");
    chai.expect(elementFar.propC).to.equal("far_value_c", "PropC should be unchanged");

    const elementLocal = t.getElementProps(t.local, elementIdLocal);
    chai.expect(elementLocal.propA).to.equal("local_value_a", "PropA should be unchanged");
    chai.expect(elementLocal.propC).to.equal("local_value_c", "PropC should be unchanged");

    const schema = t.local.getSchemaProps("TestDomain");
    chai.expect(schema.version).to.equal("01.00.02", "Schema should be transformed to v01.00.02");
  });

  it("Incoming data and Transforming schema update onto local data change", async () => {
    t = await TestIModel.initialize("IncomingDataAndTransformingSchemaLocalDataChange");
    const farTxn = startTestTxn(t.far, "Incoming data and Transforming schema update onto local data change far");
    const localTxn = startTestTxn(t.local, "Incoming data and Transforming schema update onto local data change local");

    let elementIdFar: Id64String = "";
    await t.far.txns.withIndirectTxnModeAsync(async () => {
      // Insert one instance and populate to both far and local
      elementIdFar = t!.insertElement(farTxn, "TestDomain:C", {
        propA: "far_value_a",
        propC: "far_value_c",
      });
    });
    farTxn.saveChanges("far create indirect element");
    await importSchemaStrings(farTxn, [TestIModel.schemas.v01x00x02MovePropCToA]);
    const farTxnProps = t.far.txns.getLastSavedTxnProps();
    chai.expect(farTxnProps).to.not.be.undefined;
    chai.expect(farTxnProps!.type).to.equal("Schema");
    chai.expect(t.checkIfFolderExists(t.far, farTxnProps!.id, true)).to.be.true; // schema folder should exist

    await pushChanges(farTxn, "create indirect element");
    chai.expect(t.checkIfFolderExists(t.far, farTxnProps!.id, true)).to.be.false; // after push the schema folder should not be there
    chai.expect(t.checkifRebaseFolderExists(t.far)).to.be.false; // after push the folder should not be there

    let elementIdLocal: Id64String = "";
    await t.local.txns.withIndirectTxnModeAsync(async () => {
      // Insert one instance and populate to both far and local
      elementIdLocal = t!.insertElement(localTxn, "TestDomain:C", {
        propA: "local_value_a",
        propC: "local_value_c",
      });
    });
    localTxn.saveChanges("local create indirect element");
    chai.expect(t.checkifRebaseFolderExists(t.local)).to.be.false; // there should not be a rebase folder because no schema change on local side
    await pushChanges(localTxn, "local pulls andcreate indirect element");
    chai.expect(t.checkifRebaseFolderExists(t.local)).to.be.false;
    chai.expect(Id64.isValidId64(elementIdFar) && Id64.isValidId64(elementIdLocal)).to.be.true;

    t.local.clearCaches(); // Clear caches to ensure we read transformed properties from iModel

    const elementFar = t.getElementProps(t.local, elementIdFar);
    chai.expect(elementFar.propA).to.equal("far_value_a", "PropA should be unchanged");
    chai.expect(elementFar.propC).to.equal("far_value_c", "PropC should be unchanged");

    const elementLocal = t.getElementProps(t.local, elementIdLocal);
    chai.expect(elementLocal.propA).to.equal("local_value_a", "PropA should be unchanged");
    chai.expect(elementLocal.propC).to.equal("local_value_c", "PropC should be unchanged");

    const schema = t.local.getSchemaProps("TestDomain");
    chai.expect(schema.version).to.equal("01.00.02", "Schema should be transformed to v01.00.02");
  });

  it("Incoming data and transforming schema update onto local data and transforming schema change", async () => {
    t = await TestIModel.initialize("IncomingDataAndTransformingSchemaLocalDataAndTransformingSchemaChange");
    const farTxn = startTestTxn(t.far, "Incoming data and transforming schema update onto local data and transforming schema change far");
    const localTxn = startTestTxn(t.local, "Incoming data and transforming schema update onto local data and transforming schema change local");

    await importSchemaStrings(farTxn, [TestIModel.schemas.v01x00x02MovePropCToA]);
    const farTxnProps = t.far.txns.getLastSavedTxnProps();
    chai.expect(farTxnProps).to.not.be.undefined;
    chai.expect(farTxnProps!.type).to.equal("Schema");
    chai.expect(t.checkIfFolderExists(t.far, farTxnProps!.id, true)).to.be.true; // schema folder should exist

    let elementIdFar: Id64String = "";
    await t.far.txns.withIndirectTxnModeAsync(async () => {
      // Insert one instance and populate to both far and local
      elementIdFar = t!.insertElement(farTxn, "TestDomain:C", {
        propA: "far_value_a",
        propC: "far_value_c",
      });
    });
    farTxn.saveChanges("far create indirect element");
    await pushChanges(farTxn, "create indirect element");
    chai.expect(t.checkIfFolderExists(t.far, farTxnProps!.id, true)).to.be.false; // after push the schema folder should not be there
    chai.expect(t.checkifRebaseFolderExists(t.far)).to.be.false; // after push the folder should not be there

    await importSchemaStrings(localTxn, [TestIModel.schemas.v01x00x02MovePropCToA]);
    const localTxnProps = t.local.txns.getLastSavedTxnProps();
    chai.expect(localTxnProps).to.not.be.undefined;
    chai.expect(localTxnProps!.type).to.equal("Schema");
    chai.expect(t.checkIfFolderExists(t.local, localTxnProps!.id, true)).to.be.true; // schema folder should exist

    let elementIdLocal: Id64String = "";
    await t.local.txns.withIndirectTxnModeAsync(async () => {
      // Insert one instance and populate to both far and local
      elementIdLocal = t!.insertElement(localTxn, "TestDomain:C", {
        propA: "local_value_a",
        propC: "local_value_c",
      });
    });
    localTxn.saveChanges("local create indirect element");
    await pullChanges(localTxn);

    chai.expect(t.checkIfFolderExists(t.local, localTxnProps!.id, true)).to.be.false; // because it is a no op change we are importing similar schema
    chai.expect(t.checkifRebaseFolderExists(t.local)).to.be.false; // schema change is no op and data changes are generated on the fly and removed once rebased so rebase folder should not be there

    chai.expect(Id64.isValidId64(elementIdFar) && Id64.isValidId64(elementIdLocal)).to.be.true;

    t.local.clearCaches(); // Clear caches to ensure we read transformed properties from iModel

    const elementFar = t.getElementProps(t.local, elementIdFar);
    chai.expect(elementFar.propA).to.equal("far_value_a", "PropA should be unchanged");
    chai.expect(elementFar.propC).to.equal("far_value_c", "PropC should be unchanged");

    const elementLocal = t.getElementProps(t.local, elementIdLocal);
    chai.expect(elementLocal.propA).to.equal("local_value_a", "PropA should be unchanged");
    chai.expect(elementLocal.propC).to.equal("local_value_c", "PropC should be unchanged");

    const schema = t.local.getSchemaProps("TestDomain");
    chai.expect(schema.version).to.equal("01.00.02", "Schema should be transformed to v01.00.02");
  });

  it("Incoming data update onto local data and transforming schema change", async () => {
    // This test fails but should not fail actually - needs investigation

    t = await TestIModel.initialize("IncomingDataAndSchemaLocalDataChange");
    const farTxn = startTestTxn(t.far, "Incoming data update onto local data and transforming schema change far");
    const localTxn = startTestTxn(t.local, "Incoming data update onto local data and transforming schema change local");

    let elementIdFar: Id64String = "";
    await t.far.txns.withIndirectTxnModeAsync(async () => {
      // Insert one instance and populate to both far and local
      elementIdFar = t!.insertElement(farTxn, "TestDomain:C", {
        propA: "far_value_a",
        propC: "far_value_c",
      });
    });
    farTxn.saveChanges("far create indirect element");
    await pushChanges(farTxn, "create indirect element");

    await importSchemaStrings(localTxn, [TestIModel.schemas.v01x00x02MovePropCToA]);
    const localTxnProps = t.local.txns.getLastSavedTxnProps();
    chai.expect(localTxnProps).to.not.be.undefined;
    chai.expect(localTxnProps!.type).to.equal("Schema");
    chai.expect(t.checkIfFolderExists(t.local, localTxnProps!.id, true)).to.be.true; // schema folder should exist

    let elementIdLocal: Id64String = "";
    await t.local.txns.withIndirectTxnModeAsync(async () => {
      // Insert one instance and populate to both far and local
      elementIdLocal = t!.insertElement(localTxn, "TestDomain:C", {
        propA: "local_value_a",
        propC: "local_value_c",
      });
    });
    localTxn.saveChanges("local create indirect element");

    chai.expect(t.checkifRebaseFolderExists(t.local)).to.be.true; // there should be a rebase folder because schema change on local side

    await pushChanges(localTxn, "local pulls andcreate indirect element");

    chai.expect(t.checkIfFolderExists(t.local, localTxnProps!.id, true)).to.be.false; // after push the schema folder should not be there

    chai.expect(Id64.isValidId64(elementIdFar) && Id64.isValidId64(elementIdLocal)).to.be.true;

    t.local.clearCaches(); // Clear caches to ensure we read transformed properties from iModel

    const elementFar = t.getElementProps(t.local, elementIdFar);
    chai.expect(elementFar.propA).to.equal("far_value_a", "PropA should be unchanged");
    chai.expect(elementFar.propC).to.equal("far_value_c", "PropC should be unchanged");

    const elementLocal = t.getElementProps(t.local, elementIdLocal);
    chai.expect(elementLocal.propA).to.equal("local_value_a", "PropA should be unchanged");
    chai.expect(elementLocal.propC).to.equal("local_value_c", "PropC should be unchanged");

    const schema = t.local.getSchemaProps("TestDomain");
    chai.expect(schema.version).to.equal("01.00.02", "Schema should be transformed to v01.00.02");
  });

});

/**
 * Test suite for data conflicts, conflict handlers, lifecycle events, and mixed schema+conflict scenarios during semantic rebase.
 */
describe("Semantic Rebase - Data Correctness Under Conflict", function (this: Suite) {
  this.timeout(60000);
  let t: TestIModel | undefined;

  before(async () => {
    await TestUtils.shutdownBackend();
    await TestUtils.startBackend({ useSemanticRebase: true });
  });

  afterEach(() => {
    if (t) {
      t.shutdown();
      t = undefined;
    }
  });

  after(async () => {
    await TestUtils.shutdownBackend();
    await TestUtils.startBackend();
  });

  // ─── Section F: Conflicts with Schema Changes ────────────────────────────────
  // Every test below verifies ELEMENT DATA CORRECTNESS after semantic rebase.

  it("F1: local data patch on element survives transforming schema rebase: propC value preserved after column migration", async () => {
    t = await TestIModel.initialize("F1ConflictDuringTransformingSchemaRebase");
    let localTxn = startTestTxn(t.local, "F1 local");
    let farTxn = startTestTxn(t.far, "F1 far");

    // Create shared element with propC populated
    await t.far.locks.acquireLocks({ shared: t.drawingModelId });
    const elementId = t.insertElement(farTxn, "TestDomain:C", { propA: "initial_a", propC: "initial_c" });
    farTxn.saveChanges("create shared element");
    await pushChanges(farTxn, "create shared element");
    farTxn = startTestTxn(t.far, "F1 far 2");

    await pullChanges(localTxn);
    localTxn = startTestTxn(t.local, "F1 local 2");

    // Local locks elementId and makes its data change BEFORE far pushes.
    // If local tried to lock after far's push (at a newer changeset index),
    // doesBriefcaseRequirePullBeforeLock would throw PullIsRequired.
    await t.local.locks.acquireLocks({ exclusive: elementId });
    t.updateElement(localTxn, elementId, { propC: "local_updated_c" });
    localTxn.saveChanges("local update propC");
    await importSchemaStrings(localTxn, [TestIModel.schemas.v01x00x02MovePropCToA]);

    // Far pushes a trivial schema only — no data change on elementId, no exclusive lock on it.
    // Far's schema import acquires only a shared lock on repositoryModelId and never touches
    // elementId's lock record, so local's already-held exclusive lock is not contended.
    await importSchemaStrings(farTxn, [TestIModel.schemas.v01x00x01AddPropC2]);
    await pushChanges(farTxn, "far push trivial schema v01");

    // Local pulls:
    //   Incoming: trivial schema (v01) applied.
    //   Rebase:
    //     1. Local's transforming schema txn reinstated → v02 applied (PropC column migrated from C to A)
    //     2. Local's data patch reinstated → propC set to "local_updated_c"
    //   Bug scenario: if applyInstancePatch fails to map propC to the migrated A.PropC column,
    //   the value "local_updated_c" would be silently dropped and "initial_c" would remain.
    await pullChanges(localTxn);

    t.local.clearCaches();
    const element = t.getElementProps(t.local, elementId);
    chai.expect(element.propC).to.equal("local_updated_c", "Local propC value should survive after transforming schema rebase");

    const schema = t.local.getSchemaProps("TestDomain");
    chai.expect(schema.version).to.equal("01.00.02", "Schema should be at v01.00.02 after rebase");
  });

  it("F3: local element deletion + incoming transforming schema change: delete is reinstated, element stays gone and checking GeometricGuid of Model [BUG]", async () => {
    t = await TestIModel.initialize("F2DeleteIncomingTransform");
    let localTxn = startTestTxn(t.local, "F2 local");
    let farTxn = startTestTxn(t.far, "F2 far");

    // Create shared element (shared model lock — no exclusive lock record on elementId)
    await t.far.locks.acquireLocks({ shared: t.drawingModelId });
    const elementId = t.insertElement(farTxn, "TestDomain:C", { propA: "initial_a", propC: "initial_c" });
    farTxn.saveChanges("create shared element");
    await pushChanges(farTxn, "create shared element");
    farTxn = startTestTxn(t.far, "F2 far 2");

    await pullChanges(localTxn);
    localTxn = startTestTxn(t.local, "F2 local 2");

    // Far imports transforming schema (moves PropC from C to A); no exclusive lock on elementId
    await importSchemaStrings(farTxn, [TestIModel.schemas.v01x00x02MovePropCToA]);
    await pushChanges(farTxn, "far import transforming schema");

    // Local deletes the element — safe because far never exclusively locked elementId,
    // so lastExclusiveReleaseChangesetIndex for elementId is still undefined.
    await t.local.locks.acquireLocks({ exclusive: elementId });
    localTxn.deleteElement(elementId);
    localTxn.saveChanges("local delete element");

    const drawingModel = t.getModelProps(t.local, t.drawingModelId);
    const geometricGuidBefore = drawingModel.geometryGuid;

    // Local pulls - incoming transforming schema applied, then local deletion reinstated
    await pullChanges(localTxn);

    t.local.clearCaches();
    chai.expect(() => t!.getElementProps(t!.local, elementId)).to.throw(`element not found`);

    const drawingModelAfter = t.getModelProps(t.local, t.drawingModelId);
    const geometricGuidAfter = drawingModelAfter.geometryGuid;

    chai.expect(geometricGuidAfter).to.not.equal(geometricGuidBefore, "GeometricGuid of the model should not remain the same after rebase"); // BUG should exactly be same

    const schema = t.local.getSchemaProps("TestDomain");
    chai.expect(schema.version).to.equal("01.00.02", "Schema should be updated to v01.00.02");
  });

  it("F4: incoming element deletion + local transforming schema change: schema upgrade survives, element absent", async () => {
    t = await TestIModel.initialize("F4IncomingDeleteLocalTransform");
    let localTxn = startTestTxn(t.local, "F4 local");
    let farTxn = startTestTxn(t.far, "F4 far");

    // Create shared element
    await t.far.locks.acquireLocks({ shared: t.drawingModelId });
    const elementId = t.insertElement(farTxn, "TestDomain:C", { propA: "initial_a", propC: "initial_c" });
    farTxn.saveChanges("create shared element");
    await pushChanges(farTxn, "create shared element");
    farTxn = startTestTxn(t.far, "F4 far 2");

    await pullChanges(localTxn);
    localTxn = startTestTxn(t.local, "F4 local 2");

    // Far exclusively locks and deletes the element, then pushes
    await t.far.locks.acquireLocks({ exclusive: elementId });
    farTxn.deleteElement(elementId);
    farTxn.saveChanges("far delete element");
    await pushChanges(farTxn, "far delete element");

    // Local imports transforming schema only.
    // NOTE: do NOT lock elementId here. After far's exclusive lock + push, the element's
    // lastExclusiveReleaseChangesetIndex is set at a newer changeset index than local's head.
    // acquireLocks on elementId from local would throw PullIsRequired via
    // doesBriefcaseRequirePullBeforeLock. The schema import alone is sufficient to test that
    // semantic rebase handles the case where an incoming changeset deleted an element that
    // the local schema txn has no data patches for.
    await importSchemaStrings(localTxn, [TestIModel.schemas.v01x00x02MovePropCToA]);

    // Local pulls - far's delete applied as incoming changeset; local schema txn reinstated.
    // No data patch on elementId → no NotFound conflict. Schema upgrade succeeds cleanly.
    await pullChanges(localTxn);

    t.local.clearCaches();
    // Element is gone (deleted by incoming changeset)
    chai.expect(() => t!.getElementProps(t!.local, elementId)).to.throw(`element not found`);

    // Schema was upgraded successfully despite the element deletion
    const schema = t.local.getSchemaProps("TestDomain");
    chai.expect(schema.version).to.equal("01.00.02", "Schema upgrade should survive when incoming changeset deleted an element");
  });

  it("F5: insert → update → delete of same element across three sequential local data txns; incoming schema → element absent and no stale ECInstanceId", async () => {
    // This test probes the ordering of sequential data patches.
    // If patches are applied out of order the update will hit NotFound (element not yet inserted)
    // or the delete will resurrect a value that the update produced.
    t = await TestIModel.initialize("F5InsertUpdateDeleteChain");
    const localTxn = startTestTxn(t.local, "F5 local");
    const farTxn = startTestTxn(t.far, "F5 far");

    // Far pushes a data change to create an incoming changeset
    await t.far.locks.acquireLocks({ shared: t.drawingModelId });
    t.insertElement(farTxn, "TestDomain:C", { propA: "far_a", propC: "far_c" });
    farTxn.saveChanges("far insert element");
    await pushChanges(farTxn, "far create element");

    // Local schema txn — semantic rebase trigger
    await importSchemaStrings(localTxn, [TestIModel.schemas.v01x00x01AddPropC2]);

    // Local data txn1: insert element E1 (shared model lock; never locked by far)
    await t.local.locks.acquireLocks({ shared: t.drawingModelId });
    const e1Id = t.insertElement(localTxn, "TestDomain:C", { propA: "e1_initial", propC: "e1_c" });
    localTxn.saveChanges("local insert E1 (txn1)");

    // Local data txn2: update E1 (local inserted it → no lock violation)
    t.updateElement(localTxn, e1Id, { propA: "e1_updated", propC2: "e1_c2" });
    localTxn.saveChanges("local update E1 (txn2)");

    // Local data txn3: delete E1
    localTxn.deleteElement(e1Id);
    localTxn.saveChanges("local delete E1 (txn3)");

    await pullChanges(localTxn);
    chai.expect(() => t!.getElementProps(t!.local, e1Id)).to.throw(`element not found`);
  });

  it("F6: local inserts elements of three different classes across separate data txns; incoming trivial schema; ECInstanceIds and classNames preserved", async () => {
    // This test probes class-resolution in constructPatchInstance (resolves classFullName from
    // ECClassId / $meta.classFullName / $meta.fallbackClassId) for multiple BIS subclasses.
    // If class resolution is wrong, insertInstance will fail or create elements under the wrong class.
    t = await TestIModel.initialize("F6ThreeClassInserts");
    const localTxn = startTestTxn(t.local, "F6 local");
    const farTxn = startTestTxn(t.far, "F6 far");

    // Far pushes an incoming data change
    await t.far.locks.acquireLocks({ shared: t.drawingModelId });
    const farElemId = t.insertElement(farTxn, "TestDomain:A", { propA: "far_a" });
    farTxn.saveChanges("far insert element");
    await pushChanges(farTxn, "far create element");

    // Local schema txn — semantic rebase trigger (trivial: adds PropC2)
    await importSchemaStrings(localTxn, [TestIModel.schemas.v01x00x01AddPropC2]);

    // Local data txns: insert one element per class (A, C, D) in three separate txns.
    // All use shared model lock — none of these elements were ever locked by far.
    await t.local.locks.acquireLocks({ shared: t.drawingModelId });

    const aId = t.insertElement(localTxn, "TestDomain:A", { propA: "local_a_only" });
    localTxn.saveChanges("local insert A (txn1)");

    const cId = t.insertElement(localTxn, "TestDomain:C", { propA: "local_c_a", propC: "local_c_val" });
    localTxn.saveChanges("local insert C (txn2)");

    const dId = t.insertElement(localTxn, "TestDomain:D", { propA: "local_d_a", propD: "local_d_val" });
    localTxn.saveChanges("local insert D (txn3)");

    // Capture ECInstanceIds before pull — they must be identical after rebase (forceUseId)
    const prePullIds = { aId, cId, dId };

    await pullChanges(localTxn);

    t.local.clearCaches();

    // Verify each element: ECInstanceId preserved, classFullName correct, props intact
    const aElem = t.getElementProps(t.local, prePullIds.aId);
    chai.expect(aElem.id).to.equal(prePullIds.aId, "Class A ECInstanceId must be preserved (forceUseId)");
    chai.expect(aElem.classFullName).to.equal("TestDomain:A", "Class A classFullName must be correct");
    chai.expect(aElem.propA).to.equal("local_a_only");

    const cElem = t.getElementProps(t.local, prePullIds.cId);
    chai.expect(cElem.id).to.equal(prePullIds.cId, "Class C ECInstanceId must be preserved (forceUseId)");
    chai.expect(cElem.classFullName).to.equal("TestDomain:C", "Class C classFullName must be correct");
    chai.expect(cElem.propA).to.equal("local_c_a");
    chai.expect(cElem.propC).to.equal("local_c_val");

    const dElem = t.getElementProps(t.local, prePullIds.dId);
    chai.expect(dElem.id).to.equal(prePullIds.dId, "Class D ECInstanceId must be preserved (forceUseId)");
    chai.expect(dElem.classFullName).to.equal("TestDomain:D", "Class D classFullName must be correct");
    chai.expect(dElem.propA).to.equal("local_d_a");
    chai.expect(dElem.propD).to.equal("local_d_val");

    // Also confirm all three IDs appear in an ECSqlReader scan (polymorphic query on base class A)
    const allRows = await TestIModel.queryToMap(
      t.local,
      `SELECT ECInstanceId, ec_className(ECClassId) AS className FROM TestDomain.A`,
    );
    chai.expect(allRows.has(prePullIds.aId), "A element must appear in ECSqlReader scan").to.be.true;
    chai.expect(allRows.has(prePullIds.cId), "C element must appear in ECSqlReader scan").to.be.true;
    chai.expect(allRows.has(prePullIds.dId), "D element must appear in ECSqlReader scan").to.be.true;

    // Confirm className is resolved correctly in the ECSql results
    chai.expect(allRows.get(prePullIds.cId)?.className).to.include("C",
      "ECSqlReader className for C element must include 'C'");
    chai.expect(allRows.get(prePullIds.dId)?.className).to.include("D",
      "ECSqlReader className for D element must include 'D'");

    // Far's element must also be present and unmodified
    const farElem = t.getElementProps(t.local, farElemId);
    chai.expect(farElem.propA).to.equal("far_a");

    const schema = t.local.getSchemaProps("TestDomain");
    chai.expect(schema.version).to.equal("01.00.01");
  });

});

/**
 * Multi-step schema upgrade chains.
 * Tests scenarios where one or both sides import schemas in multiple sequential steps before the rebase.
 */
describe("Semantic Rebase - Multi-Step Schema Upgrade Chains", function (this: Suite) {
  this.timeout(60000);
  let t: TestIModel | undefined;

  before(async () => {
    await TestUtils.shutdownBackend();
    await TestUtils.startBackend({ useSemanticRebase: true });
  });

  afterEach(() => {
    if (t) {
      t.shutdown();
      t = undefined;
    }
  });

  after(async () => {
    await TestUtils.shutdownBackend();
    await TestUtils.startBackend();
  });

  it("G1: local imports schema in two chained steps (v01→v02) before pulling; incoming has v01 only", async () => {
    // Local: v01 then v02. Incoming (far): only v01.
    // Expected: local v02 wins because it is strictly newer.
    t = await TestIModel.initialize("G1LocalChainedSchemaUpgrade");
    const farTxn = startTestTxn(t.far, "G1 far");
    const localTxn = startTestTxn(t.local, "G1 local");

    // Far imports v01 and pushes
    await importSchemaStrings(farTxn, [TestIModel.schemas.v01x00x01AddPropC2]);
    const farTxnProps = t.far.txns.getLastSavedTxnProps();
    await pushChanges(farTxn, "far import v01");
    chai.expect(t.checkIfFolderExists(t.far, farTxnProps!.id, true)).to.be.false; // cleaned up on push

    // Local: import v01, then immediately upgrade to v02 (chain before any pull)
    await importSchemaStrings(localTxn, [TestIModel.schemas.v01x00x01AddPropC2]);
    const localTxnPropsV01 = t.local.txns.getLastSavedTxnProps();
    chai.expect(localTxnPropsV01).to.not.be.undefined;
    chai.expect(t.checkIfFolderExists(t.local, localTxnPropsV01!.id, true)).to.be.true;

    await importSchemaStrings(localTxn, [TestIModel.schemas.v01x00x02AddPropD2]);
    const localTxnPropsV02 = t.local.txns.getLastSavedTxnProps();
    chai.expect(localTxnPropsV02).to.not.be.undefined;
    chai.expect(t.checkIfFolderExists(t.local, localTxnPropsV02!.id, true)).to.be.true;

    // Local pulls: incoming has v01, local already at v02 → local v02 txn wins, v01 local txn is a no-op
    await pullChanges(localTxn);

    // v01 local txn became no-op (incoming v01 arrived and covers it)
    chai.expect(t.checkIfFolderExists(t.local, localTxnPropsV01!.id, true)).to.be.false;
    // v02 is still pending push
    chai.expect(t.checkIfFolderExists(t.local, localTxnPropsV02!.id, true)).to.be.true;

    const schema = t.local.getSchemaProps("TestDomain");
    chai.expect(schema.version).to.equal("01.00.02", "Local v02 should win after chain import rebase");
    // PropD2 (from v02) should be visible
    const classD = await t.local.schemaContext.getSchemaItem("TestDomain", "D", EntityClass);
    chai.expect(await classD!.getProperty("PropD2")).to.exist;
  });

  it("G2: incoming has two sequential schema changesets (v01 then v02), local has only data changes", async () => {
    // Far: schema v01 (cs1) then schema v02 (cs2).
    // Local: data change only → rebased on top of both schema changesets.
    t = await TestIModel.initialize("G2IncomingTwoSchemaChangesets");
    let farTxn = startTestTxn(t.far, "G2 far");
    let localTxn = startTestTxn(t.local, "G2 local");

    // Create shared element on far, push
    await t.far.locks.acquireLocks({ shared: t.drawingModelId });
    const elementId = t.insertElement(farTxn, "TestDomain:C", { propA: "initial_a", propC: "initial_c" });
    farTxn.saveChanges("create element");
    await pushChanges(farTxn, "create element");
    farTxn = startTestTxn(t.far, "G2 far 2");

    // Local pulls to get element
    await pullChanges(localTxn);
    localTxn = startTestTxn(t.local, "G2 local 2");

    // Far: schema changeset 1 (v01)
    await importSchemaStrings(farTxn, [TestIModel.schemas.v01x00x01AddPropC2]);
    await pushChanges(farTxn, "far v01");
    farTxn = startTestTxn(t.far, "G2 far 3");

    // Far: schema changeset 2 (v02)
    await importSchemaStrings(farTxn, [TestIModel.schemas.v01x00x02AddPropD2]);
    await pushChanges(farTxn, "far v02");

    // Local: data change only (update element propA)
    await t.local.locks.acquireLocks({ exclusive: elementId });
    t.updateElement(localTxn, elementId, { propA: "local_updated_a" });
    localTxn.saveChanges("local update propA");

    // Local pulls: both far schema changesets are incoming data, local data rebase on top
    await pullChanges(localTxn);

    const element = t.getElementProps(t.local, elementId);
    chai.expect(element.propA).to.equal("local_updated_a", "Local data change should be preserved after two incoming schema changesets");
    chai.expect(element.propC).to.equal("initial_c", "propC should be unchanged");

    const schema = t.local.getSchemaProps("TestDomain");
    chai.expect(schema.version).to.equal("01.00.02", "Schema should be at v02 after two incoming schema changesets");
    // Both PropC2 and PropD2 should exist
    const classC = await t.local.schemaContext.getSchemaItem("TestDomain", "C", EntityClass);
    chai.expect(await classC!.getProperty("PropC2")).to.exist;
    const classD = await t.local.schemaContext.getSchemaItem("TestDomain", "D", EntityClass);
    chai.expect(await classD!.getProperty("PropD2")).to.exist;
  });

  it("G3: local imports schema in two steps with data between them; incoming has data only", async () => {
    // Local: data txn → schema v01 txn → data txn → schema v02 txn.
    // Incoming (far): data changes to different elements.
    // Expected: all four local txns preserved in order, far data also visible.
    t = await TestIModel.initialize("G3LocalSchemaDataInterleaved");
    let farTxn = startTestTxn(t.far, "G3 far");
    let localTxn = startTestTxn(t.local, "G3 local");

    // Create two shared elements via far and push
    await t.far.locks.acquireLocks({ shared: t.drawingModelId });
    const sharedId1 = t.insertElement(farTxn, "TestDomain:C", { propA: "shared_a1", propC: "shared_c1" });
    const sharedId2 = t.insertElement(farTxn, "TestDomain:C", { propA: "shared_a2", propC: "shared_c2" });
    farTxn.saveChanges("far create shared elements");
    await pushChanges(farTxn, "far create shared elements");
    farTxn = startTestTxn(t.far, "G3 far 2");

    // Both pull
    await pullChanges(localTxn);
    localTxn = startTestTxn(t.local, "G3 local 2");

    // Far: update sharedId1 and push (data only)
    await t.far.locks.acquireLocks({ exclusive: sharedId1 });
    t.updateElement(farTxn, sharedId1, { propA: "far_updated_a1" });
    farTxn.saveChanges("far update sharedId1");
    await pushChanges(farTxn, "far update sharedId1");

    // Local: txn1 - update sharedId2 (data)
    await t.local.locks.acquireLocks({ exclusive: sharedId2 });
    t.updateElement(localTxn, sharedId2, { propA: "local_updated_a2" });
    localTxn.saveChanges("local txn1 update sharedId2");

    // Local: txn2 - schema v01 (adds PropC2)
    await importSchemaStrings(localTxn, [TestIModel.schemas.v01x00x01AddPropC2]);

    // Local: txn3 - insert new element using new PropC2
    await t.local.locks.acquireLocks({ shared: t.drawingModelId });
    const localNewId = t.insertElement(localTxn, "TestDomain:C", { propA: "new_local_a", propC: "new_local_c", propC2: "new_local_c2" });
    localTxn.saveChanges("local txn3 insert element with PropC2");

    // Local: txn4 - schema v02 (adds PropD2)
    await importSchemaStrings(localTxn, [TestIModel.schemas.v01x00x02AddPropD2]);

    // Local pulls and rebases all four local txns onto incoming data change
    await pullChanges(localTxn);

    t.local.clearCaches();

    // sharedId1 should have far's update
    const elem1 = t.getElementProps(t.local, sharedId1);
    chai.expect(elem1.propA).to.equal("far_updated_a1", "Far update to sharedId1 should be applied");

    // sharedId2 should have local's update
    const elem2 = t.getElementProps(t.local, sharedId2);
    chai.expect(elem2.propA).to.equal("local_updated_a2", "Local update to sharedId2 should be preserved");

    // New locally-inserted element with PropC2 should exist
    const newElem = t.getElementProps(t.local, localNewId);
    chai.expect(newElem.propA).to.equal("new_local_a", "Locally-inserted element should be preserved");
    chai.expect(newElem.propC2).to.equal("new_local_c2", "PropC2 from local element should be preserved");

    // Schema should be at v02 (both local schema imports preserved)
    const schema = t.local.getSchemaProps("TestDomain");
    chai.expect(schema.version).to.equal("01.00.02", "Schema should be at v02 after two local schema imports");
  });

  it("G4: three successive schema increments from three different pushes, local rebases all", async () => {
    // far pushes v01, then v02, then v03 as separate changesets.
    // local has a single data change it needs to rebase on top of all three.
    t = await TestIModel.initialize("G4ThreeSuccessiveSchemaIncrements");
    let farTxn = startTestTxn(t.far, "G4 far");
    let localTxn = startTestTxn(t.local, "G4 local");

    // Create shared element on far
    await t.far.locks.acquireLocks({ shared: t.drawingModelId });
    const elementId = t.insertElement(farTxn, "TestDomain:C", { propA: "init_a", propC: "init_c" });
    farTxn.saveChanges("far create element");
    await pushChanges(farTxn, "far create element");
    farTxn = startTestTxn(t.far, "G4 far 2");

    // Both pull to sync
    await pullChanges(localTxn);
    localTxn = startTestTxn(t.local, "G4 local 2");

    // Far pushes v01
    await importSchemaStrings(farTxn, [TestIModel.schemas.v01x00x01AddPropC2]);
    await pushChanges(farTxn, "far v01");
    farTxn = startTestTxn(t.far, "G4 far 3");

    // Far pushes v02
    await importSchemaStrings(farTxn, [TestIModel.schemas.v01x00x02AddPropD2]);
    await pushChanges(farTxn, "far v02");
    farTxn = startTestTxn(t.far, "G4 far 4");

    // Far pushes v03 (moves PropC and PropD to A)
    await importSchemaStrings(farTxn, [TestIModel.schemas.v01x00x03MovePropCAndD]);
    await pushChanges(farTxn, "far v03");

    // Local: data change only
    await t.local.locks.acquireLocks({ exclusive: elementId });
    t.updateElement(localTxn, elementId, { propA: "local_updated_a", propC: "local_updated_c" });
    localTxn.saveChanges("local update element");

    // Local pulls and rebases through all three schema changesets
    await pullChanges(localTxn);
    t.local.clearCaches();

    // Local data change should survive all three schema transforms
    const element = t.getElementProps(t.local, elementId);
    chai.expect(element.propA).to.equal("local_updated_a", "Local propA should be preserved after three schema increments");
    chai.expect(element.propC).to.equal("local_updated_c", "Local propC should be preserved after three schema increments");

    const schema = t.local.getSchemaProps("TestDomain");
    chai.expect(schema.version).to.equal("01.00.03", "Schema should be at v03 after three incoming schema increments");
  });
});

/**
 * ElementAspect changes during semantic rebase.
 * Tests that aspect insert/update/delete operations are correctly captured and reinstated.
 */
describe("Semantic Rebase - ElementAspect Changes", function (this: Suite) {
  this.timeout(60000);
  let t: TestIModel | undefined;

  before(async () => {
    await TestUtils.shutdownBackend();
    await TestUtils.startBackend({ useSemanticRebase: true });
  });

  afterEach(() => {
    if (t) {
      t.shutdown();
      t = undefined;
    }
  });

  after(async () => {
    await TestUtils.shutdownBackend();
    await TestUtils.startBackend();
  });

  it("H1: local inserts UniqueAspect; incoming trivial schema change → aspect preserved after rebase", async () => {
    t = await TestIModel.initialize("H1AspectInsertIncomingTrivial");
    let farTxn = startTestTxn(t.far, "H1 far");
    let localTxn = startTestTxn(t.local, "H1 local");

    // Set up base schema with aspect class on both sides
    await importSchemaStrings(farTxn, [TestIModel.extendedSchemas.v01x00x01WithAspect]);
    await pushChanges(farTxn, "import aspect schema");
    farTxn = startTestTxn(t.far, "H1 far 2");

    await pullChanges(localTxn);
    localTxn = startTestTxn(t.local, "H1 local 2");

    // Create an element on far, push
    await t.far.locks.acquireLocks({ shared: t.drawingModelId });
    const elementId = t.insertElement(farTxn, "TestDomain:C", { propA: "elem_a", propC: "elem_c" });
    farTxn.saveChanges("far create element");
    await pushChanges(farTxn, "far create element");
    farTxn = startTestTxn(t.far, "H1 far 3");

    // Local pulls element
    await pullChanges(localTxn);
    localTxn = startTestTxn(t.local, "H1 local 3");

    // Far imports trivial schema (adds AspectProp2 to CUniqueAspect)
    await importSchemaStrings(farTxn, [TestIModel.extendedSchemas.v01x00x02WithAspectProp2]);
    await pushChanges(farTxn, "far add AspectProp2");

    // Local inserts a UniqueAspect onto the element
    await t.local.locks.acquireLocks({ exclusive: elementId });
    t.insertAspect(localTxn, elementId, "TestDomain:CUniqueAspect", { aspectProp: "local_aspect_value" });
    localTxn.saveChanges("local insert aspect");

    // Local pulls: data rebase must preserve the aspect insertion
    await pullChanges(localTxn);
    t.local.clearCaches();

    // Aspect should still exist with correct value
    const aspect = t.getAspect(t.local, elementId, "TestDomain:CUniqueAspect");
    chai.expect(aspect, "Aspect should exist after rebase").to.not.be.undefined;
    chai.expect(aspect.aspectProp).to.equal("local_aspect_value", "AspectProp should be preserved after rebase");

    const schema = t.local.getSchemaProps("TestDomain");
    chai.expect(schema.version).to.equal("01.00.02", "Schema should be at v02 with AspectProp2 added");
  });

  it("H2: local inserts UniqueAspect; incoming transforming schema change → aspect preserved after transform", async () => {
    t = await TestIModel.initialize("H2AspectInsertIncomingTransform");
    let farTxn = startTestTxn(t.far, "H2 far");
    let localTxn = startTestTxn(t.local, "H2 local");

    // Set up base schema with aspect class on both sides
    await importSchemaStrings(farTxn, [TestIModel.extendedSchemas.v01x00x01WithAspect]);
    await pushChanges(farTxn, "import aspect schema");
    farTxn = startTestTxn(t.far, "H2 far 2");

    await pullChanges(localTxn);
    localTxn = startTestTxn(t.local, "H2 local 2");

    // Create element on far, push
    await t.far.locks.acquireLocks({ shared: t.drawingModelId });
    const elementId = t.insertElement(farTxn, "TestDomain:C", { propA: "elem_a", propC: "elem_c" });
    farTxn.saveChanges("far create element");
    await pushChanges(farTxn, "far create element");
    farTxn = startTestTxn(t.far, "H2 far 3");

    // Local pulls element
    await pullChanges(localTxn);
    localTxn = startTestTxn(t.local, "H2 local 3");

    // Far imports transforming schema: moves PropC from C to A (v02 also brings AspectProp2)
    await importSchemaStrings(farTxn, [TestIModel.extendedSchemas.v01x00x02WithAspectProp2]);
    await pushChanges(farTxn, "far import transforming schema with aspect change");

    // Local inserts a UniqueAspect
    await t.local.locks.acquireLocks({ exclusive: elementId });
    t.insertAspect(localTxn, elementId, "TestDomain:CUniqueAspect", { aspectProp: "aspect_before_transform" });
    localTxn.saveChanges("local insert aspect");

    // Local pulls: aspect is captured then reinstated after schema transform
    await pullChanges(localTxn);
    t.local.clearCaches();

    // Aspect should still exist
    const aspect = t.getAspect(t.local, elementId, "TestDomain:CUniqueAspect");
    chai.expect(aspect, "Aspect should exist after transforming schema rebase").to.not.be.undefined;
    chai.expect(aspect.aspectProp, "AspectProp value should be preserved").to.equal("aspect_before_transform");

    // Element itself should also be intact
    const element = t.getElementProps(t.local, elementId);
    chai.expect(element.propA, "Element propA should be preserved").to.equal("elem_a");
  });

  it("H3: local updates UniqueAspect property; incoming trivial schema change → aspect update preserved", async () => {
    t = await TestIModel.initialize("H3AspectUpdateIncomingTrivial");
    let farTxn = startTestTxn(t.far, "H3 far");
    let localTxn = startTestTxn(t.local, "H3 local");

    // Both get the aspect schema first
    await importSchemaStrings(farTxn, [TestIModel.extendedSchemas.v01x00x01WithAspect]);
    await pushChanges(farTxn, "import aspect schema");
    farTxn = startTestTxn(t.far, "H3 far 2");
    await pullChanges(localTxn);
    localTxn = startTestTxn(t.local, "H3 local 2");

    // Far creates element + inserts aspect, pushes
    await t.far.locks.acquireLocks({ shared: t.drawingModelId });
    const elementId = t.insertElement(farTxn, "TestDomain:C", { propA: "elem_a", propC: "elem_c" });
    t.insertAspect(farTxn, elementId, "TestDomain:CUniqueAspect", { aspectProp: "initial_aspect" });
    farTxn.saveChanges("far create element + aspect");
    await pushChanges(farTxn, "far create element + aspect");
    farTxn = startTestTxn(t.far, "H3 far 3");

    // Local pulls to get the element and aspect
    await pullChanges(localTxn);
    localTxn = startTestTxn(t.local, "H3 local 3");

    // Far imports trivial schema (adds AspectProp2 to CUniqueAspect), pushes
    await importSchemaStrings(farTxn, [TestIModel.extendedSchemas.v01x00x02WithAspectProp2]);
    await pushChanges(farTxn, "far add AspectProp2");

    // Local updates the aspect's AspectProp
    await t.local.locks.acquireLocks({ exclusive: elementId });
    t.updateAspect(localTxn, elementId, "TestDomain:CUniqueAspect", { aspectProp: "updated_aspect_value" });
    localTxn.saveChanges("local update aspect");

    // Local pulls: aspect update should survive the schema rebase
    await pullChanges(localTxn);
    t.local.clearCaches();

    const aspect = t.getAspect(t.local, elementId, "TestDomain:CUniqueAspect");
    chai.expect(aspect).to.not.be.undefined;
    chai.expect(aspect.aspectProp).to.equal("updated_aspect_value", "Aspect update should be preserved after trivial schema rebase");

    const schema = t.local.getSchemaProps("TestDomain");
    chai.expect(schema.version).to.equal("01.00.02", "Schema should be at v02");
  });

  it("H4: local deletes UniqueAspect; incoming trivial schema change → aspect stays deleted after rebase", async () => {
    t = await TestIModel.initialize("H4AspectDeleteIncomingTrivial");
    let farTxn = startTestTxn(t.far, "H4 far");
    let localTxn = startTestTxn(t.local, "H4 local");

    // Both get the aspect schema
    await importSchemaStrings(farTxn, [TestIModel.extendedSchemas.v01x00x01WithAspect]);
    await pushChanges(farTxn, "import aspect schema");
    farTxn = startTestTxn(t.far, "H4 far 2");
    await pullChanges(localTxn);
    localTxn = startTestTxn(t.local, "H4 local 2");

    // Far creates element + aspect, pushes
    await t.far.locks.acquireLocks({ shared: t.drawingModelId });
    const elementId = t.insertElement(farTxn, "TestDomain:C", { propA: "elem_a", propC: "elem_c" });
    t.insertAspect(farTxn, elementId, "TestDomain:CUniqueAspect", { aspectProp: "initial_aspect" });
    farTxn.saveChanges("far create element + aspect");
    await pushChanges(farTxn, "far create element + aspect");
    farTxn = startTestTxn(t.far, "H4 far 3");

    // Local pulls to get the element and aspect
    await pullChanges(localTxn);
    localTxn = startTestTxn(t.local, "H4 local 3");

    // Far imports trivial schema, pushes
    await importSchemaStrings(farTxn, [TestIModel.extendedSchemas.v01x00x02WithAspectProp2]);
    await pushChanges(farTxn, "far add AspectProp2");

    // Local deletes the aspect
    await t.local.locks.acquireLocks({ exclusive: elementId });
    t.deleteAspect(localTxn, elementId, "TestDomain:CUniqueAspect");
    localTxn.saveChanges("local delete aspect");

    // Local pulls: aspect deletion should be preserved after schema rebase
    await pullChanges(localTxn);
    t.local.clearCaches();

    // The element should still exist but have no aspect
    const element = t.getElementProps(t.local, elementId);
    chai.expect(element, "Element should still exist after rebase").to.not.be.undefined;

    const aspects = t.local.elements.getAspects(elementId, "TestDomain:CUniqueAspect");
    chai.expect(aspects.length).to.equal(0, "Aspect should be gone after deletion is reinstated");

    const schema = t.local.getSchemaProps("TestDomain");
    chai.expect(schema.version).to.equal("01.00.02", "Schema should be at v02");
  });

  it("H5: local inserts aspect; incoming adds same aspect class schema change AND data → both preserved", async () => {
    t = await TestIModel.initialize("H5AspectInsertIncomingSchemaAndData");
    let farTxn = startTestTxn(t.far, "H5 far");
    let localTxn = startTestTxn(t.local, "H5 local");

    // Both get the base aspect schema
    await importSchemaStrings(farTxn, [TestIModel.extendedSchemas.v01x00x01WithAspect]);
    await pushChanges(farTxn, "import aspect schema");
    farTxn = startTestTxn(t.far, "H5 far 2");
    await pullChanges(localTxn);
    localTxn = startTestTxn(t.local, "H5 local 2");

    // Far creates two elements and inserts aspects on them
    await t.far.locks.acquireLocks({ shared: t.drawingModelId });
    const farElementId = t.insertElement(farTxn, "TestDomain:C", { propA: "far_a", propC: "far_c" });
    t.insertAspect(farTxn, farElementId, "TestDomain:CUniqueAspect", { aspectProp: "far_aspect" });
    farTxn.saveChanges("far create element + aspect");

    // Far also upgrades the schema to v02 (adds AspectProp2)
    await importSchemaStrings(farTxn, [TestIModel.extendedSchemas.v01x00x02WithAspectProp2]);
    await pushChanges(farTxn, "far schema upgrade + element with aspect");

    // Local creates its own element and inserts an aspect with both AspectProp values
    // (local is still at v01 with only AspectProp; we insert only that)
    await t.local.locks.acquireLocks({ shared: t.drawingModelId });
    const localElementId = t.insertElement(localTxn, "TestDomain:C", { propA: "local_a", propC: "local_c" });
    t.insertAspect(localTxn, localElementId, "TestDomain:CUniqueAspect", { aspectProp: "local_aspect" });
    localTxn.saveChanges("local create element + aspect");

    // Local pulls: incoming has schema v02 + far's element+aspect; local data rebase on top
    await pullChanges(localTxn);
    t.local.clearCaches();

    // Far's element and aspect should be present
    const farAspect = t.getAspect(t.local, farElementId, "TestDomain:CUniqueAspect");
    chai.expect(farAspect).to.not.be.undefined;
    chai.expect(farAspect.aspectProp).to.equal("far_aspect");

    // Local's element and aspect should also be preserved
    const localAspect = t.getAspect(t.local, localElementId, "TestDomain:CUniqueAspect");
    chai.expect(localAspect).to.not.be.undefined;
    chai.expect(localAspect.aspectProp).to.equal("local_aspect", "Local aspect should survive rebase onto incoming schema+data");

    const schema = t.local.getSchemaProps("TestDomain");
    chai.expect(schema.version).to.equal("01.00.02", "Schema should be at v02");
  });
});

/**
 * Property type variations during semantic rebase.
 * Ensures int, double, and boolean property values are preserved correctly through rebase.
 */
describe("Semantic Rebase - Property Type Variations", function (this: Suite) {
  this.timeout(60000);
  let t: TestIModel | undefined;

  before(async () => {
    await TestUtils.shutdownBackend();
    await TestUtils.startBackend({ useSemanticRebase: true });
  });

  afterEach(() => {
    if (t) {
      t.shutdown();
      t = undefined;
    }
  });

  after(async () => {
    await TestUtils.shutdownBackend();
    await TestUtils.startBackend();
  });

  it("I1: int, double, and boolean properties preserved through trivial schema rebase", async () => {
    // Schema v01 adds int/double/bool props to class C.
    // Local sets those values on an element, far imports v02 (adds PropD2 on D).
    // After rebase: multi-type values should survive unchanged.
    t = await TestIModel.initialize("I1MultiTypePropsRebase");
    let farTxn = startTestTxn(t.far, "I1 far");
    let localTxn = startTestTxn(t.local, "I1 local");

    // Both get the multi-type schema (v01)
    await importSchemaStrings(farTxn, [TestIModel.extendedSchemas.v01x00x01MultiTypeProps]);
    await pushChanges(farTxn, "import multi-type schema v01");
    farTxn = startTestTxn(t.far, "I1 far 2");
    await pullChanges(localTxn);
    localTxn = startTestTxn(t.local, "I1 local 2");

    // Create element with all multi-type properties on local, push
    await t.local.locks.acquireLocks({ shared: t.drawingModelId });
    const elementId = t.insertElement(localTxn, "TestDomain:C", {
      propA: "string_val",
      propC: "another_string",
      propCInt: 42,
      propCDouble: 3.14159,
      propCBool: true,
    });
    localTxn.saveChanges("local create multi-type element");
    await pushChanges(localTxn, "create multi-type element");
    localTxn = startTestTxn(t.local, "I1 local 3");

    // Far imports v02 (adds PropD2 — trivial, unrelated change), pushes
    await pullChanges(farTxn);
    farTxn = startTestTxn(t.far, "I1 far 3");
    await importSchemaStrings(farTxn, [TestIModel.extendedSchemas.v01x00x02MultiTypePropsExtended]);
    await pushChanges(farTxn, "far import v02 with PropD2");

    // Local updates the int and bool properties
    await t.local.locks.acquireLocks({ exclusive: elementId });
    t.updateElement(localTxn, elementId, { propCInt: 100, propCBool: false });
    localTxn.saveChanges("local update int and bool");

    // Local pulls: data rebase should preserve all type values
    await pullChanges(localTxn);
    t.local.clearCaches();

    const element = t.getElementProps(t.local, elementId);
    chai.expect(element.propCInt).to.equal(100, "Int property update should be preserved");
    chai.expect(element.propCDouble).to.equal(3.14159, "Double property should remain from original insert");
    chai.expect(element.propCBool).to.equal(false, "Boolean property update should be preserved");
    chai.expect(element.propC).to.equal("another_string", "String property should be preserved");

    const schema = t.local.getSchemaProps("TestDomain");
    chai.expect(schema.version).to.equal("01.00.02", "Schema should be at v02");
  });

  it("I2: int, double, and boolean properties preserved through transforming schema rebase", async () => {
    // Local creates element with multi-type props, far imports transforming schema (moves PropD to A).
    // After rebase: all multi-type values should survive even though the schema layout changed for D.
    t = await TestIModel.initialize("I2MultiTypePropsTransformRebase");
    let farTxn = startTestTxn(t.far, "I2 far");
    let localTxn = startTestTxn(t.local, "I2 local");

    // Both get multi-type schema (v01)
    await importSchemaStrings(farTxn, [TestIModel.extendedSchemas.v01x00x01MultiTypeProps]);
    await pushChanges(farTxn, "import multi-type schema v01");
    farTxn = startTestTxn(t.far, "I2 far 2");
    await pullChanges(localTxn);
    localTxn = startTestTxn(t.local, "I2 local 2");

    // Far creates a shared element, push
    await t.far.locks.acquireLocks({ shared: t.drawingModelId });
    const elementId = t.insertElement(farTxn, "TestDomain:C", {
      propA: "shared_a",
      propC: "shared_c",
      propCInt: 7,
      propCDouble: 2.718,
      propCBool: true,
    });
    farTxn.saveChanges("far create multi-type element");
    await pushChanges(farTxn, "far create element");
    farTxn = startTestTxn(t.far, "I2 far 3");

    // Both pull to sync
    await pullChanges(localTxn);
    localTxn = startTestTxn(t.local, "I2 local 3");

    // Far imports transforming schema (v02 moves PropD to A)
    await importSchemaStrings(farTxn, [TestIModel.extendedSchemas.v01x00x02MultiTypePropsMovePropDToA]);
    await pushChanges(farTxn, "far move PropD to A");

    // Local updates the multi-type properties on the element
    await t.local.locks.acquireLocks({ exclusive: elementId });
    t.updateElement(localTxn, elementId, { propCInt: 99, propCDouble: 1.414, propCBool: false });
    localTxn.saveChanges("local update multi-type props");

    // Local pulls: data rebase with schema transform
    await pullChanges(localTxn);
    t.local.clearCaches();

    const element = t.getElementProps(t.local, elementId);
    chai.expect(element.propCInt).to.equal(99, "Int property should be preserved after transforming schema rebase");
    chai.expect(element.propCDouble).to.closeTo(1.414, 0.0001, "Double property should be preserved");
    chai.expect(element.propCBool).to.equal(false, "Boolean property should be preserved");

    const schema = t.local.getSchemaProps("TestDomain");
    chai.expect(schema.version).to.equal("01.00.02", "Schema should be at v02");
  });

  it("I3: element with null/undefined property values rebased correctly through schema transform", async () => {
    // Element created with some properties left unset (null/undefined).
    // Rebase should not fail and unset properties should remain absent.
    t = await TestIModel.initialize("I3NullPropertyRebase");
    let farTxn = startTestTxn(t.far, "I3 far");
    let localTxn = startTestTxn(t.local, "I3 local");

    // Create element on local with only propA set (propC left unset)
    await t.local.locks.acquireLocks({ shared: t.drawingModelId });
    const elementId = t.insertElement(localTxn, "TestDomain:C", { propA: "only_a" });
    // propC is intentionally not set (will be undefined/null)
    localTxn.saveChanges("create element with partial props");
    await pushChanges(localTxn, "create partially populated element");
    localTxn = startTestTxn(t.local, "I3 local 2");

    // Far imports transforming schema (moves PropC from C to A), pushes
    await pullChanges(farTxn);
    farTxn = startTestTxn(t.far, "I3 far 2");
    await importSchemaStrings(farTxn, [TestIModel.schemas.v01x00x02MovePropCToA]);
    await pushChanges(farTxn, "far move PropC to A");

    // Local makes a data change to update propA
    await t.local.locks.acquireLocks({ exclusive: elementId });
    t.updateElement(localTxn, elementId, { propA: "updated_a" });
    localTxn.saveChanges("local update propA only");

    // Local pulls: data rebase should handle null/absent propC gracefully
    await pullChanges(localTxn);
    t.local.clearCaches();

    const element = t.getElementProps(t.local, elementId);
    chai.expect(element.propA).to.equal("updated_a", "PropA update should be preserved");
    // propC was never set so it should still be absent or null after the transform
    chai.expect(element.propC === undefined || element.propC === null || element.propC === "").to.be.true,
      "PropC should remain absent/null after rebase when it was never set";
  });

  it("I4: binary (UInt8Array) property values preserved through insert and update during trivial schema rebase", async () => {
    // Schema v01 adds a binary property (PropCBin) to class C.
    // Local inserts an element with a Uint8Array value, then updates it to a different Uint8Array.
    // Far imports v02 (adds PropD2 — trivial, unrelated change) to trigger semantic rebase.
    // After rebase: the updated binary value should survive as a Uint8Array with the correct bytes.
    t = await TestIModel.initialize("I4BinaryPropRebase");
    let farTxn = startTestTxn(t.far, "I4 far");
    let localTxn = startTestTxn(t.local, "I4 local");

    // Both sides get the binary-prop schema (v01)
    await importSchemaStrings(farTxn, [TestIModel.extendedSchemas.v01x00x01WithBinaryProp]);
    await pushChanges(farTxn, "import binary-prop schema v01");
    farTxn = startTestTxn(t.far, "I4 far 2");
    await pullChanges(localTxn);
    localTxn = startTestTxn(t.local, "I4 local 2");

    // Local inserts an element with an initial binary value, pushes so both sides are in sync
    await t.local.locks.acquireLocks({ shared: t.drawingModelId });
    const initialBin = new Uint8Array([0xDE, 0xAD, 0xBE, 0xEF]);
    const elementId = t.insertElement(localTxn, "TestDomain:C", {
      propA: "binary_test",
      propC: "some_string",
      propCBin: initialBin,
    });
    localTxn.saveChanges("local insert element with binary prop");
    await pushChanges(localTxn, "create element with binary prop");
    localTxn = startTestTxn(t.local, "I4 local 3");

    // Far imports v02 (adds PropD2 — trivial change), pushes to trigger rebase on local's next pull
    await pullChanges(farTxn);
    farTxn = startTestTxn(t.far, "I4 far 3");
    await importSchemaStrings(farTxn, [TestIModel.extendedSchemas.v01x00x02WithBinaryPropAndPropD2]);
    await pushChanges(farTxn, "far import v02 with PropD2");

    // Local updates the binary property to a new Uint8Array value (NOT pushed yet)
    const updatedBin = new Uint8Array([0x01, 0x02, 0x03, 0x04, 0x05]);
    await t.local.locks.acquireLocks({ exclusive: elementId });
    t.updateElement(localTxn, elementId, { propCBin: updatedBin });
    localTxn.saveChanges("local update binary prop");

    // Local pulls: semantic rebase should reinstate the binary property update
    await pullChanges(localTxn);
    t.local.clearCaches();

    const element = t.getElementProps(t.local, elementId);
    chai.expect(element.propCBin).to.be.instanceOf(Uint8Array, "Binary property should be returned as a Uint8Array");
    chai.expect(Array.from(element.propCBin as Uint8Array)).to.deep.equal(
      Array.from(updatedBin),
      "Updated binary value should be preserved byte-for-byte after semantic rebase",
    );
    chai.expect(element.propC).to.equal("some_string", "String property should be unchanged");
    chai.expect(element.propA).to.equal("binary_test", "PropA should be unchanged");

    const schema = t.local.getSchemaProps("TestDomain");
    chai.expect(schema.version).to.equal("01.00.02", "Schema should be at v02 after rebase");
  });
});

/**
 * Both sides delete the same element.
 * Edge case where both local and far delete the same element independently.
 */
describe("Semantic Rebase - Both Sides Delete Same Element", function (this: Suite) {
  this.timeout(60000);
  let t: TestIModel | undefined;

  before(async () => {
    await TestUtils.shutdownBackend();
    await TestUtils.startBackend({ useSemanticRebase: true });
  });

  afterEach(() => {
    if (t) {
      t.shutdown();
      t = undefined;
    }
  });

  after(async () => {
    await TestUtils.shutdownBackend();
    await TestUtils.startBackend();
  });

  it("J2: far deletes element, local makes data change to a DIFFERENT element + schema import → element gone, other changes preserved", async () => {
    t = await TestIModel.initialize("J2FarDeleteLocalSchemaAndData");
    let farTxn = startTestTxn(t.far, "J2 far");
    let localTxn = startTestTxn(t.local, "J2 local");

    // Create two shared elements
    await t.far.locks.acquireLocks({ shared: t.drawingModelId });
    const deletedElementId = t.insertElement(farTxn, "TestDomain:C", { propA: "del_a", propC: "del_c" });
    const keepElementId = t.insertElement(farTxn, "TestDomain:D", { propA: "keep_a", propD: "keep_d" });
    farTxn.saveChanges("create two elements");
    await pushChanges(farTxn, "create two elements");
    farTxn = startTestTxn(t.far, "J2 far 2");

    await pullChanges(localTxn);
    localTxn = startTestTxn(t.local, "J2 local 2");

    // Far imports schema + deletes one element
    await importSchemaStrings(farTxn, [TestIModel.schemas.v01x00x01AddPropC2]);
    await t.far.locks.acquireLocks({ exclusive: deletedElementId });
    farTxn.deleteElement(deletedElementId);
    farTxn.saveChanges("far delete element");
    await pushChanges(farTxn, "far schema + delete element");

    // Local: imports a different schema upgrade + updates the other element
    await importSchemaStrings(localTxn, [TestIModel.schemas.v01x00x01AddPropC2]);
    await t.local.locks.acquireLocks({ exclusive: keepElementId });
    t.updateElement(localTxn, keepElementId, { propA: "local_updated_keep_a" });
    localTxn.saveChanges("local update keep element");

    // Local pulls
    await pullChanges(localTxn);
    t.local.clearCaches();

    // Deleted element should be gone
    chai.expect(() => t!.getElementProps(t!.local, deletedElementId)).to.throw(`element not found`, "Deleted element should not be found after rebase");

    // Kept element should have local's update
    const keepElement = t.getElementProps(t.local, keepElementId);
    chai.expect(keepElement.propA).to.equal("local_updated_keep_a", "Keep element's local update should be preserved");

    // Schema should be at v01
    const schema = t.local.getSchemaProps("TestDomain");
    chai.expect(schema.version).to.equal("01.00.01", "Schema should be at v01");
  });
});

/**
 * Three-briefcase scenarios.
 * Tests interactions when three separate briefcases are involved in schema+data operations.
 */
describe("Semantic Rebase - Three Briefcase Scenarios", function (this: Suite) {
  this.timeout(60000);
  let t: TestIModel | undefined;

  before(async () => {
    await TestUtils.shutdownBackend();
    await TestUtils.startBackend({ useSemanticRebase: true });
  });

  afterEach(() => {
    if (t) {
      t.shutdown();
      t = undefined;
    }
  });

  after(async () => {
    await TestUtils.shutdownBackend();
    await TestUtils.startBackend();
  });

  it("K1: schema from extra briefcase, data from far, local rebases both → all changes preserved", async () => {
    // extra imports schema, pushes.
    // far creates data element, pushes.
    // local has local data change.
    // local pulls: must rebase on top of schema+data from two different sources.
    t = await TestIModel.initialize("K1ThreeBriefcaseSchemaAndData");
    const farTxn = startTestTxn(t.far, "K1 far");
    const localTxn = startTestTxn(t.local, "K1 local");

    // Extra briefcase imports schema and pushes
    const extra = await t.openExtraBriefcase("extra-user-k1");
    try {
      extra.channels.addAllowedChannel(ChannelControl.sharedChannelName);
      const extraTxn = startTestTxn(extra, "K1 extra");
      await importSchemaStrings(extraTxn, [TestIModel.schemas.v01x00x01AddPropC2]);
      await pushChanges(extraTxn, "extra import schema v01");
    } finally {
      // Keep extra open for the test duration; it's closed here after push
      extra.close();
    }

    // Far pulls schema, creates element with PropC2, pushes
    await pullChanges(farTxn);
    const farTxn2 = startTestTxn(t.far, "K1 far 2");
    await t.far.locks.acquireLocks({ shared: t.drawingModelId });
    const farElementId = t.insertElement(farTxn2, "TestDomain:C", { propA: "far_a", propC: "far_c", propC2: "far_c2" });
    farTxn2.saveChanges("far create element");
    await pushChanges(farTxn2, "far create element");

    // Local makes a data change (creates its own element, still at old schema)
    await t.local.locks.acquireLocks({ shared: t.drawingModelId });
    const localElementId = t.insertElement(localTxn, "TestDomain:C", { propA: "local_a", propC: "local_c" });
    localTxn.saveChanges("local create element");

    // Local pulls: must get schema from extra + element from far, then rebase local element
    await pullChanges(localTxn);
    t.local.clearCaches();

    // Far's element should be visible
    const farElement = t.getElementProps(t.local, farElementId);
    chai.expect(farElement.propA).to.equal("far_a", "Far element should be visible after rebase");
    chai.expect(farElement.propC2).to.equal("far_c2", "Far element PropC2 should be preserved");

    // Local's element should also be preserved
    const localElement = t.getElementProps(t.local, localElementId);
    chai.expect(localElement.propA).to.equal("local_a", "Local element should be preserved after rebase");
    chai.expect(localElement.propC).to.equal("local_c", "Local element propC should be preserved");

    const schema = t.local.getSchemaProps("TestDomain");
    chai.expect(schema.version).to.equal("01.00.01", "Schema should be at v01 from extra briefcase");
  });

  it("K2: two sequential schema changes from different briefcases, local rebases correctly through both", async () => {
    // extra-a pushes schema v01.
    // extra-b pulls v01, pushes schema v02.
    // local makes data change and must pull both schema changesets.
    t = await TestIModel.initialize("K2TwoSchemaSourcesSequential");
    const localTxn = startTestTxn(t.local, "K2 local");

    // Create shared element via far and push
    const farTxn = startTestTxn(t.far, "K2 far");
    await t.far.locks.acquireLocks({ shared: t.drawingModelId });
    const elementId = t.insertElement(farTxn, "TestDomain:C", { propA: "shared_a", propC: "shared_c" });
    farTxn.saveChanges("far create shared element");
    await pushChanges(farTxn, "create shared element");

    // Local pulls element
    await pullChanges(localTxn);
    const localTxn2 = startTestTxn(t.local, "K2 local 2");

    // extra-a pushes schema v01
    const extraA = await t.openExtraBriefcase("extra-a-k2");
    try {
      const extraATxn = startTestTxn(extraA, "K2 extra-a");
      await importSchemaStrings(extraATxn, [TestIModel.schemas.v01x00x01AddPropC2]);
      await pushChanges(extraATxn, "extra-a import schema v01");
    } finally {
      extraA.close();
    }

    // extra-b pulls v01, pushes schema v02 (adds PropD2)
    const extraB = await t.openExtraBriefcase("extra-b-k2");
    try {
      await extraB.pullChanges(); // picks up v01
      const extraBTxn = startTestTxn(extraB, "K2 extra-b");
      await importSchemaStrings(extraBTxn, [TestIModel.schemas.v01x00x02AddPropD2]);
      await pushChanges(extraBTxn, "extra-b import schema v02");
    } finally {
      extraB.close();
    }

    // Local makes data change: update shared element's propA
    await t.local.locks.acquireLocks({ exclusive: elementId });
    t.updateElement(localTxn2, elementId, { propA: "local_updated_a" });
    localTxn2.saveChanges("local update propA");

    // Local pulls: must process v01 + v02 schema changesets and then rebase local data
    await pullChanges(localTxn2);
    t.local.clearCaches();

    const element = t.getElementProps(t.local, elementId);
    chai.expect(element.propA).to.equal("local_updated_a", "Local data change should be preserved after two schema changesets from different sources");

    const schema = t.local.getSchemaProps("TestDomain");
    chai.expect(schema.version).to.equal("01.00.02", "Schema should be at v02 after two schema changesets");
  });
});

/**
 * Multiple pulls without push between them.
 * Tests that semantic rebase state is handled correctly when the local briefcase
 * pulls multiple times before pushing, accumulating rebase operations.
 */
describe("Semantic Rebase - Multiple Pulls Without Push", function (this: Suite) {
  this.timeout(60000);
  let t: TestIModel | undefined;

  before(async () => {
    await TestUtils.shutdownBackend();
    await TestUtils.startBackend({ useSemanticRebase: true });
  });

  afterEach(() => {
    if (t) {
      t.shutdown();
      t = undefined;
    }
  });

  after(async () => {
    await TestUtils.shutdownBackend();
    await TestUtils.startBackend();
  });

  it("L2: local makes two separate schema imports across two pull cycles without pushing", async () => {
    // Pull 1: local has schema v01, far has data → rebase, local wins with v01
    // Pull 2 (no push): local imports v02, far pushes more data → rebase, local wins with v02
    t = await TestIModel.initialize("L2TwoSchemaImportsTwoPulls");
    let farTxn = startTestTxn(t.far, "L2 far");
    let localTxn = startTestTxn(t.local, "L2 local");

    // Create shared element
    await t.far.locks.acquireLocks({ shared: t.drawingModelId });
    const elementId = t.insertElement(farTxn, "TestDomain:C", { propA: "initial_a", propC: "initial_c" });
    farTxn.saveChanges("create element");
    await pushChanges(farTxn, "create element");
    farTxn = startTestTxn(t.far, "L2 far 2");

    await pullChanges(localTxn);
    localTxn = startTestTxn(t.local, "L2 local 2");

    // Far pushes data change for pull cycle 1
    await t.far.locks.acquireLocks({ exclusive: elementId });
    t.updateElement(farTxn, elementId, { propC: "far_c_update_1" });
    farTxn.saveChanges("far data round 1");
    await pushChanges(farTxn, "far data round 1");
    farTxn = startTestTxn(t.far, "L2 far 3");

    // Local: schema v01 import
    await importSchemaStrings(localTxn, [TestIModel.schemas.v01x00x01AddPropC2]);

    // Pull cycle 1
    await pullChanges(localTxn);
    chai.expect(t.local.getSchemaProps("TestDomain").version).to.equal("01.00.01", "Schema should be v01 after first pull");

    // Far pushes data change for pull cycle 2
    localTxn = startTestTxn(t.local, "L2 local 3");
    await t.far.locks.acquireLocks({ exclusive: elementId });
    t.updateElement(farTxn, elementId, { propC: "far_c_update_2" });
    farTxn.saveChanges("far data round 2");
    await pushChanges(farTxn, "far data round 2");

    // Local: schema v02 import (still not pushed v01 yet)
    await importSchemaStrings(localTxn, [TestIModel.schemas.v01x00x02AddPropD2]);

    // Pull cycle 2 without push
    await pullChanges(localTxn);
    t.local.clearCaches();

    // Schema should be at v02 (local upgrade wins)
    chai.expect(t.local.getSchemaProps("TestDomain").version).to.equal("01.00.02", "Schema should be v02 after second pull without push");

    // Both far data changes should be present
    const element = t.getElementProps(t.local, elementId);
    chai.expect(element.propC).to.equal("far_c_update_2", "Far data round 2 should be applied");
  });

  it("L3: pull when there are no incoming changes (already up to date) → no rebase folders created", async () => {
    t = await TestIModel.initialize("L3PullNoIncomingChanges");
    const localTxn = startTestTxn(t.local, "L3 local");

    // Local imports schema (creates rebase folder)
    await importSchemaStrings(localTxn, [TestIModel.schemas.v01x00x01AddPropC2]);
    const localTxnProps = t.local.txns.getLastSavedTxnProps();
    chai.expect(localTxnProps).to.not.be.undefined;
    chai.expect(t.checkIfFolderExists(t.local, localTxnProps!.id, true)).to.be.true;

    // Pull when far has nothing new — no rebase should happen
    // (local is ahead of far's schema; there are no incoming changesets)
    const rebaseBasePathBeforePull = BriefcaseManager.getBasePathForSemanticRebaseLocalFiles(t.local);

    await pullChanges(localTxn);

    // Schema folder should still exist (local schema is pending push)
    const rebaseBasePathAfterPull = BriefcaseManager.getBasePathForSemanticRebaseLocalFiles(t.local);
    chai.expect(IModelJsFs.existsSync(rebaseBasePathAfterPull)).to.be.true;
    chai.expect(rebaseBasePathBeforePull).to.equal(rebaseBasePathAfterPull, "Rebase path should be unchanged");

    const schema = t.local.getSchemaProps("TestDomain");
    chai.expect(schema.version).to.equal("01.00.01", "Local schema should still be v01 after no-op pull");
  });
});

/**
 * New class addition to schema.
 * Tests that newly added entity classes and their instances survive semantic rebase.
 */
describe("Semantic Rebase - New Class Addition to Schema", function (this: Suite) {
  this.timeout(60000);
  let t: TestIModel | undefined;

  before(async () => {
    await TestUtils.shutdownBackend();
    await TestUtils.startBackend({ useSemanticRebase: true });
  });

  afterEach(() => {
    if (t) {
      t.shutdown();
      t = undefined;
    }
  });

  after(async () => {
    await TestUtils.shutdownBackend();
    await TestUtils.startBackend();
  });

  it("N1: far adds new class E to schema; local creates instances of existing class A + pulls → both visible", async () => {
    t = await TestIModel.initialize("N1FarAddsNewClassLocalCreatesData");
    const farTxn = startTestTxn(t.far, "N1 far");
    const localTxn = startTestTxn(t.local, "N1 local");

    // Far imports schema with new class E, creates an element of class E, pushes
    await importSchemaStrings(farTxn, [TestIModel.extendedSchemas.v01x00x01AddClassE]);
    await t.far.locks.acquireLocks({ shared: t.drawingModelId });
    const farElementE = t.insertElement(farTxn, "TestDomain:E", { propA: "far_e_a", propE: "far_e" });
    farTxn.saveChanges("far create element E");
    await pushChanges(farTxn, "far schema+element E");

    // Local creates an instance of class C (old class) and pulls
    await t.local.locks.acquireLocks({ shared: t.drawingModelId });
    const localElementC = t.insertElement(localTxn, "TestDomain:C", { propA: "local_c_a", propC: "local_c" });
    localTxn.saveChanges("local create element C");

    await pullChanges(localTxn);
    t.local.clearCaches();

    // Far's element E should be visible on local
    const elemE = t.getElementProps(t.local, farElementE);
    chai.expect(elemE.propA).to.equal("far_e_a", "Far element E should be visible after rebase");
    chai.expect(elemE.propE).to.equal("far_e", "PropE of element E should be correct");

    // Local's element C should be preserved
    const elemC = t.getElementProps(t.local, localElementC);
    chai.expect(elemC.propA).to.equal("local_c_a", "Local element C should be preserved after rebase");

    const schema = t.local.getSchemaProps("TestDomain");
    chai.expect(schema.version).to.equal("01.00.01", "Schema should be at v01 with class E added");
  });

  it("N2: both sides add same new class E → local version wins when higher, all instances preserved", async () => {
    t = await TestIModel.initialize("N2BothSidesAddNewClass");
    const farTxn = startTestTxn(t.far, "N2 far");
    const localTxn = startTestTxn(t.local, "N2 local");

    // Far imports v01 (adds class E with PropE), pushes
    await importSchemaStrings(farTxn, [TestIModel.extendedSchemas.v01x00x01AddClassE]);
    await pushChanges(farTxn, "far import v01 with class E");

    // Local imports v02 (adds class E with PropE + PropE2 — higher version), does NOT push yet
    await importSchemaStrings(localTxn, [TestIModel.extendedSchemas.v01x00x02AddClassEPropE2]);

    // Local pulls: local v02 > far v01 → local wins
    await pullChanges(localTxn);
    t.local.clearCaches();

    const schema = t.local.getSchemaProps("TestDomain");
    chai.expect(schema.version).to.equal("01.00.02", "Local v02 should win over far's v01");

    // Both PropE and PropE2 should be present on class E
    const classE = await t.local.schemaContext.getSchemaItem("TestDomain", "E", EntityClass);
    chai.expect(classE).to.not.be.undefined;
    chai.expect(await classE!.getProperty("PropE")).to.exist;
    chai.expect(await classE!.getProperty("PropE2")).to.exist;
  });

  it("N3: local adds new class E with instances; incoming has transforming schema change on existing class → both preserved", async () => {
    t = await TestIModel.initialize("N3LocalNewClassIncomingTransform");
    let farTxn = startTestTxn(t.far, "N3 far");
    let localTxn = startTestTxn(t.local, "N3 local");

    // Create a C element on far, push, then both pull
    await t.far.locks.acquireLocks({ shared: t.drawingModelId });
    const cElementId = t.insertElement(farTxn, "TestDomain:C", { propA: "c_initial_a", propC: "c_initial_c" });
    farTxn.saveChanges("create C element");
    await pushChanges(farTxn, "create C element");
    farTxn = startTestTxn(t.far, "N3 far 2");

    await pullChanges(localTxn);
    localTxn = startTestTxn(t.local, "N3 local 2");

    // Far imports transforming schema: moves PropC from C to A, AND adds class E (v01.00.02 + E)
    // We use a combined schema for this
    const v01x00x02WithBothChanges = `<?xml version="1.0" encoding="UTF-8"?>
    <ECSchema schemaName="TestDomain" alias="td" version="01.00.02" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.2">
      <ECSchemaReference name="BisCore" version="01.00.23" alias="bis"/>
      <ECEntityClass typeName="A">
        <BaseClass>bis:GraphicalElement2d</BaseClass>
        <ECProperty propertyName="PropA" typeName="string"/>
        <ECProperty propertyName="PropC" typeName="string"/>
      </ECEntityClass>
      <ECEntityClass typeName="C">
        <BaseClass>A</BaseClass>
      </ECEntityClass>
      <ECEntityClass typeName="D">
        <BaseClass>A</BaseClass>
        <ECProperty propertyName="PropD" typeName="string"/>
      </ECEntityClass>
      <ECEntityClass typeName="E">
        <BaseClass>A</BaseClass>
        <ECProperty propertyName="PropE" typeName="string"/>
      </ECEntityClass>
    </ECSchema>`;
    await importSchemaStrings(farTxn, [v01x00x02WithBothChanges]);
    await pushChanges(farTxn, "far import transform+new class");

    // Local imports v01 (just adds class E) and creates two elements: one C, one E
    await importSchemaStrings(localTxn, [TestIModel.extendedSchemas.v01x00x01AddClassE]);
    await t.local.locks.acquireLocks({ shared: t.drawingModelId });
    const localElemE = t.insertElement(localTxn, "TestDomain:E", { propA: "local_e_a", propE: "local_e" });
    localTxn.saveChanges("local create E element");

    // Local also updates the C element that far's transform will affect
    await t.local.locks.acquireLocks({ exclusive: cElementId });
    t.updateElement(localTxn, cElementId, { propC: "local_updated_c" });
    localTxn.saveChanges("local update C element PropC");

    // Local pulls: far's transform schema (v02) > local's v01 schema → incoming wins for schema
    // But local's data changes (E element + C element update) should survive
    await pullChanges(localTxn);
    t.local.clearCaches();

    // Far's schema (v02) should win since it has higher version
    const schema = t.local.getSchemaProps("TestDomain");
    chai.expect(schema.version).to.equal("01.00.02", "Far's schema v02 should win over local's v01");

    // Local E element should exist
    const elemE = t.getElementProps(t.local, localElemE);
    chai.expect(elemE.propA).to.equal("local_e_a", "Local element E should be preserved");
    chai.expect(elemE.propE).to.equal("local_e", "PropE should be preserved");

    // C element should have local's PropC update (PropC is now on class A in v02)
    const elemC = t.getElementProps(t.local, cElementId);
    chai.expect(elemC.propC).to.equal("local_updated_c", "Local PropC update should be preserved after schema transform");
  });
});

/**
 * Guard conditions and error paths for semantic rebase.
 * Tests boundary conditions like importing schema while rebasing, concurrent pull attempts, etc.
 */
describe("Semantic Rebase - Guard Conditions and Error Paths", function (this: Suite) {
  this.timeout(60000);
  let t: TestIModel | undefined;

  before(async () => {
    await TestUtils.shutdownBackend();
    await TestUtils.startBackend({ useSemanticRebase: true });
  });

  afterEach(() => {
    if (t) {
      t.shutdown();
      t = undefined;
    }
  });

  after(async () => {
    await TestUtils.shutdownBackend();
    await TestUtils.startBackend();
  });

  it("P1: importing schema during active rebase (via onRebaseTxnBegin hook) throws 'Cannot import schemas while rebasing'", async () => {
    t = await TestIModel.initialize("P1ImportSchemaWhileRebasing");
    const farTxn = startTestTxn(t.far, "P1 far");
    const localTxn = startTestTxn(t.local, "P1 local");

    // Far imports schema and pushes (triggers semantic rebase path on local)
    await importSchemaStrings(farTxn, [TestIModel.schemas.v01x00x01AddPropC2]);
    await pushChanges(farTxn, "far import schema v01");

    // Local imports schema to ensure it takes the semantic rebase code path
    await importSchemaStrings(localTxn, [TestIModel.schemas.v01x00x01AddPropC2]);

    // Hook into onRebaseTxnBegin to attempt a schema import during rebase
    let importErrorDuringRebase: Error | undefined;
    t.local.txns.rebaser.onRebaseTxnBegin.addOnce(async () => {
      try {
        // This import should fail: importing schemas while rebasing is not allowed
        await t!.local.importSchemaStrings([TestIModel.schemas.v01x00x02AddPropD2]);
      } catch (e: any) {
        importErrorDuringRebase = e;
      }
    });

    // Pull triggers the rebase which fires the hook
    try {
      await pullChanges(localTxn);
    } catch {
      // rebase might throw due to the bad import inside; that's acceptable
    }

    chai.expect(importErrorDuringRebase).to.not.be.undefined, "Schema import during rebase should throw";
    chai.expect(importErrorDuringRebase?.message ?? "").to.include("rebasing", "Error message should mention rebasing");
  });

  it("P3: after a failed rebase, briefcase is not stuck — another pull can succeed", async () => {
    // If a rebase fails (e.g., incompatible schema), the briefcase should be recoverable.
    // A subsequent pull (after fixing the root cause) should succeed.
    t = await TestIModel.initialize("P3RecoveryAfterFailedRebase");
    let farTxn = startTestTxn(t.far, "P3 far");
    let localTxn = startTestTxn(t.local, "P3 local");

    // Create shared element, push
    await t.far.locks.acquireLocks({ shared: t.drawingModelId });
    t.insertElement(farTxn, "TestDomain:C", { propA: "initial_a", propC: "initial_c" });
    farTxn.saveChanges("create element");
    await pushChanges(farTxn, "create element");
    farTxn = startTestTxn(t.far, "P3 far 2");
    await pullChanges(localTxn);
    localTxn = startTestTxn(t.local, "P3 local 2");

    // Far imports schema with PropC2 as int (will cause conflict with local's string PropC2)
    await importSchemaStrings(farTxn, [TestIModel.schemas.v01x00x01AddPropC2]);
    await pushChanges(farTxn, "far import v01 PropC2 string");

    // Local imports incompatible schema (PropC2 as int, higher version → will conflict with far's string)
    await importSchemaStrings(localTxn, [TestIModel.schemas.v01x00x02AddPropC2Incompatible]);

    // First pull attempt: should fail with "ECSchema Upgrade failed"
    await chai.expect(pullChanges(localTxn)).to.be.rejectedWith("ECSchema Upgrade failed");

    // Briefcase should still be openable and queryable after failure
    // (BriefcaseManager should have rolled back the failed rebase)
    const schemaAfterFailure = t.local.getSchemaProps("TestDomain");
    // Schema version is unclear after abort, but the DB should still be functional
    chai.expect(schemaAfterFailure, "Schema query should succeed after failed rebase").to.not.be.undefined;

    // The briefcase is still open and the DB is usable
    chai.expect(t.local.isOpen, "Briefcase should still be open after failed rebase").to.be.true;
  });

  it("P4: local schema import is rejected when called while semantic rebase has already captured state", async () => {
    // Tests the guard: hasPendingTxns check combined with semantic rebase state.
    // After a schema import + pull that creates rebase folders, a second schema import on local
    // must still go through cleanly (the semantic rebase folders should NOT block a new import).
    t = await TestIModel.initialize("P4SecondImportAfterRebaseState");
    let farTxn = startTestTxn(t.far, "P4 far");
    let localTxn = startTestTxn(t.local, "P4 local");

    // Far pushes data change
    await t.far.locks.acquireLocks({ shared: t.drawingModelId });
    const elementId = t.insertElement(farTxn, "TestDomain:C", { propA: "initial_a", propC: "initial_c" });
    farTxn.saveChanges("create element");
    await pushChanges(farTxn, "create element");
    farTxn = startTestTxn(t.far, "P4 far 2");
    await pullChanges(localTxn);
    localTxn = startTestTxn(t.local, "P4 local 2");

    // Far pushes another data update
    await t.far.locks.acquireLocks({ exclusive: elementId });
    t.updateElement(farTxn, elementId, { propA: "far_updated_a" });
    farTxn.saveChanges("far update");
    await pushChanges(farTxn, "far update element");

    // Local imports schema v01
    await importSchemaStrings(localTxn, [TestIModel.schemas.v01x00x01AddPropC2]);
    const firstSchemaTxnProps = t.local.txns.getLastSavedTxnProps();
    chai.expect(firstSchemaTxnProps).to.not.be.undefined;
    chai.expect(t.checkIfFolderExists(t.local, firstSchemaTxnProps!.id, true)).to.be.true;

    // Local pulls (rebase: local schema onto far data)
    await pullChanges(localTxn);
    localTxn = startTestTxn(t.local, "P4 local after pull");

    // Schema folder should persist (local schema v01 is still pending push)
    chai.expect(t.checkIfFolderExists(t.local, firstSchemaTxnProps!.id, true)).to.be.true;

    // Now local wants to import schema v02 (further upgrade) — this should succeed
    await importSchemaStrings(localTxn, [TestIModel.schemas.v01x00x02AddPropD2]);
    const secondSchemaTxnProps = t.local.txns.getLastSavedTxnProps();
    chai.expect(secondSchemaTxnProps).to.not.be.undefined;
    chai.expect(t.checkIfFolderExists(t.local, secondSchemaTxnProps!.id, true)).to.be.true;

    const schema = t.local.getSchemaProps("TestDomain");
    chai.expect(schema.version).to.equal("01.00.02", "Local should be at v02 after second schema import");
  });
});

/**
 * Complex insert-update-delete sequences.
 * Tests scenarios where local txns contain a mix of insert, update, and delete operations
 * that need to be correctly captured and reinstated during semantic rebase.
 */
describe("Semantic Rebase - Complex Insert-Update-Delete Sequences", function (this: Suite) {
  this.timeout(60000);
  let t: TestIModel | undefined;

  before(async () => {
    await TestUtils.shutdownBackend();
    await TestUtils.startBackend({ useSemanticRebase: true });
  });

  afterEach(() => {
    if (t) {
      t.shutdown();
      t = undefined;
    }
  });

  after(async () => {
    await TestUtils.shutdownBackend();
    await TestUtils.startBackend();
  });

  it("O1: local insert → update → delete of same element in three txns; incoming transforming schema → element stays deleted", async () => {
    // Sequence: local inserts elem, updates it, then deletes it — all before pulling.
    // Incoming: transforming schema change.
    // Expected: element remains deleted (all three local txns reinstated correctly).
    t = await TestIModel.initialize("O1InsertUpdateDeleteSequence");
    const farTxn = startTestTxn(t.far, "O1 far");
    const localTxn = startTestTxn(t.local, "O1 local");

    // Far imports transforming schema and pushes
    await importSchemaStrings(farTxn, [TestIModel.schemas.v01x00x02MovePropCToA]);
    await pushChanges(farTxn, "far import transforming schema");

    // Local: txn1 - insert element
    await t.local.locks.acquireLocks({ shared: t.drawingModelId });
    const tempElementId = t.insertElement(localTxn, "TestDomain:C", { propA: "temp_a", propC: "temp_c" });
    localTxn.saveChanges("local txn1 insert temp element");

    // Local: txn2 - update the element
    t.updateElement(localTxn, tempElementId, { propA: "temp_updated_a" });
    localTxn.saveChanges("local txn2 update temp element");

    // Local: txn3 - delete the element
    localTxn.deleteElement(tempElementId);
    localTxn.saveChanges("local txn3 delete temp element");

    // Local pulls: three local txns (insert+update+delete) rebased on top of schema transform
    await pullChanges(localTxn);
    t.local.clearCaches();

    // Element should be gone (last operation was delete)
    chai.expect(() => t!.getElementProps(t!.local, tempElementId)).to.throw(`element not found`, "Element should be deleted after rebase");

    // Schema should be at v02
    const schema = t.local.getSchemaProps("TestDomain");
    chai.expect(schema.version).to.equal("01.00.02", "Schema should be at v02 after rebase");
  });

  it("O2: local insert + delete of one element, plus insert + update of another → incoming schema → both correct", async () => {
    t = await TestIModel.initialize("O2InsertDeleteInsertUpdate");
    const farTxn = startTestTxn(t.far, "O2 far");
    const localTxn = startTestTxn(t.local, "O2 local");

    // Far imports trivial schema, pushes
    await importSchemaStrings(farTxn, [TestIModel.schemas.v01x00x01AddPropC2]);
    await pushChanges(farTxn, "far trivial schema import");

    // Local: txn1 - insert temporary element (will be deleted) + persistent element
    await t.local.locks.acquireLocks({ shared: t.drawingModelId });
    const tempId = t.insertElement(localTxn, "TestDomain:C", { propA: "temp_a", propC: "temp_c" });
    const persistId = t.insertElement(localTxn, "TestDomain:D", { propA: "persist_a", propD: "persist_d" });
    localTxn.saveChanges("local txn1 insert two elements");

    // Local: txn2 - update persistent element
    t.updateElement(localTxn, persistId, { propA: "persist_updated_a" });
    localTxn.saveChanges("local txn2 update persist element");

    // Local: txn3 - delete temporary element
    localTxn.deleteElement(tempId);
    localTxn.saveChanges("local txn3 delete temp element");

    // Local pulls: all three txns rebased on top of far's trivial schema
    await pullChanges(localTxn);
    t.local.clearCaches();

    // Temp element should be gone
    chai.expect(() => t!.getElementProps(t!.local, tempId)).to.throw(`element not found`, "Element should be deleted after rebase");

    // Persist element should have the update
    const persistElem = t.getElementProps(t.local, persistId);
    chai.expect(persistElem.propA).to.equal("persist_updated_a", "Persist element propA should be updated");
    chai.expect(persistElem.propD).to.equal("persist_d", "Persist element propD should be preserved");

    const schema = t.local.getSchemaProps("TestDomain");
    chai.expect(schema.version).to.equal("01.00.01", "Schema should be at v01");
  });

  it("O3: schema txn sandwiched between data txns; incoming data change → all local operations preserved in correct order", async () => {
    // Pattern: local txn1 (data) → txn2 (schema) → txn3 (data using new schema property)
    // Incoming: far has a data change on a different element.
    // Expected: txn1 data, schema, and txn3 data all reinstated correctly.
    t = await TestIModel.initialize("O3SchemaSandwichedBetweenData");
    let farTxn = startTestTxn(t.far, "O3 far");
    let localTxn = startTestTxn(t.local, "O3 local");

    // Create shared elements on far and push; both pull
    await t.far.locks.acquireLocks({ shared: t.drawingModelId });
    const sharedId = t.insertElement(farTxn, "TestDomain:C", { propA: "shared_a", propC: "shared_c" });
    farTxn.saveChanges("create shared element");
    await pushChanges(farTxn, "create shared element");
    farTxn = startTestTxn(t.far, "O3 far 2");

    await pullChanges(localTxn);
    localTxn = startTestTxn(t.local, "O3 local 2");

    // Far updates shared element and pushes (data-only incoming)
    await t.far.locks.acquireLocks({ exclusive: sharedId });
    t.updateElement(farTxn, sharedId, { propC: "far_updated_c" });
    farTxn.saveChanges("far update shared element");
    await pushChanges(farTxn, "far data update");

    // Local txn1: insert new element
    await t.local.locks.acquireLocks({ shared: t.drawingModelId });
    const newId1 = t.insertElement(localTxn, "TestDomain:C", { propA: "new_a", propC: "new_c" });
    localTxn.saveChanges("local txn3 insert element with PropC2");

    // Local txn2: import schema (adds PropC2)
    await importSchemaStrings(localTxn, [TestIModel.schemas.v01x00x01AddPropC2]);

    // Local txn3: insert new element using the new PropC2 property
    await t.local.locks.acquireLocks({ shared: t.drawingModelId });
    const newId2 = t.insertElement(localTxn, "TestDomain:C", { propA: "new_a", propC: "new_c", propC2: "new_c2_value" });
    localTxn.saveChanges("local txn3 insert element with PropC2");

    // Local pulls: txn1+schema+txn3 rebased on top of far's data update
    await pullChanges(localTxn);
    t.local.clearCaches();

    // Shared element should have far's propC update
    const sharedElem = t.getElementProps(t.local, sharedId);
    chai.expect(sharedElem.propA).to.equal("shared_a", "Initial propA update should be preserved");
    chai.expect(sharedElem.propC).to.equal("far_updated_c", "Far propC update should be applied");

    // Two New element with PropC2 should exist
    const newElem1 = t.getElementProps(t.local, newId1);
    chai.expect(newElem1.propA).to.equal("new_a", "New element propA should be preserved");
    chai.expect(newElem1.propC).to.equal("new_c", "New element propC should be preserved through schema rebase");

    const newElem2 = t.getElementProps(t.local, newId2);
    chai.expect(newElem2.propA).to.equal("new_a", "New element propA should be preserved");
    chai.expect(newElem2.propC2).to.equal("new_c2_value", "New element PropC2 should be preserved through schema rebase");

    const schema = t.local.getSchemaProps("TestDomain");
    chai.expect(schema.version).to.equal("01.00.01", "Schema should be at v01");
  });

  it("O4: five local data transactions each touching a different element; incoming transforming schema → all five preserved", async () => {
    // Stress-tests the capturePatchInstances + reinstatement path with 5 separate data txns.
    t = await TestIModel.initialize("O4FiveDataTxnsTransformingSchema");
    let farTxn = startTestTxn(t.far, "O4 far");
    let localTxn = startTestTxn(t.local, "O4 local");

    // Create five elements on far and push; both pull
    await t.far.locks.acquireLocks({ shared: t.drawingModelId });
    const ids: Id64String[] = [];
    for (let i = 0; i < 5; i++) {
      ids.push(t.insertElement(farTxn, "TestDomain:C", { propA: `initial_a_${i}`, propC: `initial_c_${i}` }));
    }
    farTxn.saveChanges("create five elements");
    await pushChanges(farTxn, "create five elements");
    farTxn = startTestTxn(t.far, "O4 far 2");

    await pullChanges(localTxn);
    localTxn = startTestTxn(t.local, "O4 local 2");

    // Far imports transforming schema (moves PropC to A) and pushes
    await importSchemaStrings(farTxn, [TestIModel.schemas.v01x00x02MovePropCToA]);
    await pushChanges(farTxn, "far transforming schema");

    // Local makes five separate data txns, one per element
    for (let i = 0; i < 5; i++) {
      await t.local.locks.acquireLocks({ exclusive: ids[i] });
      t.updateElement(localTxn, ids[i], { propA: `local_updated_a_${i}`, propC: `local_updated_c_${i}` });
      localTxn.saveChanges(`local txn${i + 1} update element ${i}`);
    }

    // Local pulls: all five data txns rebased on top of transforming schema
    await pullChanges(localTxn);
    t.local.clearCaches();

    // All five elements should have their local updates preserved
    for (let i = 0; i < 5; i++) {
      const elem = t.getElementProps(t.local, ids[i]);
      chai.expect(elem.propA).to.equal(`local_updated_a_${i}`, `Element ${i} propA should be preserved`);
      chai.expect(elem.propC).to.equal(`local_updated_c_${i}`, `Element ${i} propC should be preserved after transform`);
    }

    const schema = t.local.getSchemaProps("TestDomain");
    chai.expect(schema.version).to.equal("01.00.02", "Schema should be at v02 after transforming rebase");
  });
});

/**
 * Cleanup and folder lifecycle edge cases.
 * Tests that rebase folder state is correctly managed in unusual lifecycle scenarios.
 */
describe("Semantic Rebase - Cleanup and Folder Lifecycle", function (this: Suite) {
  this.timeout(60000);
  let t: TestIModel | undefined;

  before(async () => {
    await TestUtils.shutdownBackend();
    await TestUtils.startBackend({ useSemanticRebase: true });
  });

  afterEach(() => {
    if (t) {
      t.shutdown();
      t = undefined;
    }
  });

  after(async () => {
    await TestUtils.shutdownBackend();
    await TestUtils.startBackend();
  });

  it("M1: schema folder cleaned up on push; subsequent pull creates no leftover folders", async () => {
    t = await TestIModel.initialize("M1SchemaFolderCleanupOnPush");
    let farTxn = startTestTxn(t.far, "M1 far");
    let localTxn = startTestTxn(t.local, "M1 local");

    // Far pushes data
    await t.far.locks.acquireLocks({ shared: t.drawingModelId });
    const elementId = t.insertElement(farTxn, "TestDomain:C", { propA: "initial_a", propC: "initial_c" });
    farTxn.saveChanges("far create element");
    await pushChanges(farTxn, "far create element");
    farTxn = startTestTxn(t.far, "M1 far 2");

    await pullChanges(localTxn);
    localTxn = startTestTxn(t.local, "M1 local 2");

    // Far pushes another update
    await t.far.locks.acquireLocks({ exclusive: elementId });
    t.updateElement(farTxn, elementId, { propA: "far_updated_a" });
    farTxn.saveChanges("far update element");
    await pushChanges(farTxn, "far update element");

    // Local imports schema (creates schema folder)
    await importSchemaStrings(localTxn, [TestIModel.schemas.v01x00x01AddPropC2]);
    const schemaTxnProps = t.local.txns.getLastSavedTxnProps();
    chai.expect(schemaTxnProps).to.not.be.undefined;
    chai.expect(t.checkIfFolderExists(t.local, schemaTxnProps!.id, true)).to.be.true;

    // Local pulls (rebase: local schema onto far's data update)
    await pullChanges(localTxn);

    // Schema folder should still exist (local schema wins and is pending push)
    chai.expect(t.checkIfFolderExists(t.local, schemaTxnProps!.id, true)).to.be.true;
    chai.expect(t.checkifRebaseFolderExists(t.local)).to.be.true;

    // Local pushes: all rebase folders should be cleaned up
    localTxn = startTestTxn(t.local, "M1 local after pull");
    await pushChanges(localTxn, "local push schema");

    chai.expect(t.checkifRebaseFolderExists(t.local)).to.be.false;
    // Schema folder for the pushed txn is now gone
    chai.expect(t.checkIfFolderExists(t.local, schemaTxnProps!.id, true)).to.be.false;

    // Pull again (nothing new): no new folders should appear
    localTxn = startTestTxn(t.local, "M1 local after push");
    await pullChanges(localTxn);
    chai.expect(t.checkifRebaseFolderExists(t.local)).to.be.false;
  });

  it("M3: multiple successive push/pull cycles preserve rebase folder invariants throughout", async () => {
    // Cycle 1: local schema → pull (no-op schema) → push → verify clean
    // Cycle 2: far schema → local data → pull (local data rebased onto far schema) → push → verify clean
    t = await TestIModel.initialize("M3SuccessivePushPullCycles");
    let farTxn = startTestTxn(t.far, "M3 far");
    let localTxn = startTestTxn(t.local, "M3 local");

    // --- Cycle 1: Local schema, nothing on far ---
    // Local imports v01, pulls (nothing incoming), pushes
    await importSchemaStrings(localTxn, [TestIModel.schemas.v01x00x01AddPropC2]);
    const cycle1TxnProps = t.local.txns.getLastSavedTxnProps();
    chai.expect(t.checkIfFolderExists(t.local, cycle1TxnProps!.id, true)).to.be.true;

    await pullChanges(localTxn); // nothing incoming → no rebase

    chai.expect(t.checkIfFolderExists(t.local, cycle1TxnProps!.id, true)).to.be.true; // still pending push

    localTxn = startTestTxn(t.local, "M3 local after cycle1 pull");
    await pushChanges(localTxn, "local push schema v01");

    chai.expect(t.checkIfFolderExists(t.local, cycle1TxnProps!.id, true)).to.be.false; // cleaned on push
    chai.expect(t.checkifRebaseFolderExists(t.local)).to.be.false;

    // --- Cycle 2: Far pushes schema v02, local creates data element ---
    await pullChanges(farTxn); // far pulls v01
    farTxn = startTestTxn(t.far, "M3 far 2");
    await importSchemaStrings(farTxn, [TestIModel.schemas.v01x00x02AddPropD2]);
    await pushChanges(farTxn, "far push schema v02");

    localTxn = startTestTxn(t.local, "M3 local cycle2");
    await t.local.locks.acquireLocks({ shared: t.drawingModelId });
    const cycle2ElemId = t.insertElement(localTxn, "TestDomain:C", { propA: "cycle2_a", propC: "cycle2_c" });
    localTxn.saveChanges("local create cycle2 element");

    chai.expect(t.checkifRebaseFolderExists(t.local)).to.be.false; // data-only local, schema incoming
    // Actually because far has a schema change incoming, semantic rebase WILL be used here
    // The data folder will be created on the fly and removed after rebase
    await pullChanges(localTxn);
    chai.expect(t.checkifRebaseFolderExists(t.local)).to.be.false; // data folder removed after rebase

    t.local.clearCaches();
    const cycle2Elem = t.getElementProps(t.local, cycle2ElemId);
    chai.expect(cycle2Elem.propA).to.equal("cycle2_a", "Cycle 2 element should be preserved");

    const schema = t.local.getSchemaProps("TestDomain");
    chai.expect(schema.version).to.equal("01.00.02", "Schema should be at v02 after cycle 2");
  });

});

describe("Semantic Rebase - Multi-Pull Verification", function (this: Suite) {
  this.timeout(90000);
  let t: TestIModel | undefined;

  before(async () => {
    await TestUtils.shutdownBackend();
    await TestUtils.startBackend({ useSemanticRebase: true });
  });

  afterEach(() => {
    if (t) {
      t.shutdown();
      t = undefined;
    }
  });

  after(async () => {
    await TestUtils.shutdownBackend();
    await TestUtils.startBackend();
  });

  // ──────────────────────────────────────────────────────────────────────────
  // R2: Three consecutive pulls, each triggering rebase through escalating schema
  //     changes (trivial → trivial → transforming).
  //     Full ECSql snapshot taken before and after every pull.
  // ──────────────────────────────────────────────────────────────────────────

  it("R2: three consecutive pulls through escalating schema changes; full ECSql snapshot after each", async () => {
    t = await TestIModel.initialize("R2ThreePullsEscalatingSchema");
    let farTxn = startTestTxn(t.far, "R2 far");
    let localTxn = startTestTxn(t.local, "R2 local");

    // ── Phase 0: shared setup ─────────────────────────────────────────────────
    await t.far.locks.acquireLocks({ shared: t.drawingModelId });
    const c1Id = t.insertElement(farTxn, "TestDomain:C", { propA: "c1_a_init", propC: "c1_c_init" });
    const c2Id = t.insertElement(farTxn, "TestDomain:C", { propA: "c2_a_init", propC: "c2_c_init" });
    const d1Id = t.insertElement(farTxn, "TestDomain:D", { propA: "d1_a_init", propD: "d1_d_init" });
    farTxn.saveChanges("create three shared elements");
    await pushChanges(farTxn, "create shared elements");
    farTxn = startTestTxn(t.far, "R2 far 2");

    await pullChanges(localTxn);
    localTxn = startTestTxn(t.local, "R2 local 2");

    // ── Round 1: far: schema v01 (PropC2) + update c1; local: insert r1Elem ──
    await importSchemaStrings(farTxn, [TestIModel.schemas.v01x00x01AddPropC2]);
    await t.far.locks.acquireLocks({ exclusive: c1Id });
    t.updateElement(farTxn, c1Id, { propA: "c1_a_r1" });
    farTxn.saveChanges("far r1 update c1");
    await pushChanges(farTxn, "R2 far round1");
    farTxn = startTestTxn(t.far, "R2 far 3");

    await t.local.locks.acquireLocks({ shared: t.drawingModelId });
    const r1ElemId = t.insertElement(localTxn, "TestDomain:C", { propA: "r1_a", propC: "r1_c" });
    localTxn.saveChanges("local r1 insert r1Elem");

    // Pull #1
    await pullChanges(localTxn);
    t.local.clearCaches({ instanceCachesOnly: true });

    // c1: far's propA update applied; propC unchanged
    const c1After1 = t.getElementProps(t.local, c1Id);
    chai.expect(c1After1.propA).to.equal("c1_a_r1", "c1 propA should be updated by far after pull #1");
    chai.expect(c1After1.propC).to.equal("c1_c_init", "c1 propC should be unchanged after pull #1");
    // c2: unchanged
    const c2After1 = t.getElementProps(t.local, c2Id);
    chai.expect(c2After1.propA).to.equal("c2_a_init", "c2 propA should be unchanged after pull #1");
    chai.expect(c2After1.propC).to.equal("c2_c_init", "c2 propC should be unchanged after pull #1");
    // r1Elem: insert preserved with same ECInstanceId
    const r1After1 = t.getElementProps(t.local, r1ElemId);
    chai.expect(r1After1.propA).to.equal("r1_a", "r1Elem propA should be preserved after pull #1 rebase");
    chai.expect(r1After1.propC).to.equal("r1_c", "r1Elem propC should be preserved after pull #1 rebase");
    chai.expect(r1After1.id).to.equal(r1ElemId, "r1ElemId ECInstanceId must be stable after pull #1");
    // d1: unchanged
    const d1After1 = t.getElementProps(t.local, d1Id);
    chai.expect(d1After1.propA).to.equal("d1_a_init", "d1 propA should be unchanged after pull #1");
    chai.expect(d1After1.propD).to.equal("d1_d_init", "d1 propD should be unchanged after pull #1");
    chai.expect(t.local.getSchemaProps("TestDomain").version).to.equal("01.00.01", "Schema v01 after pull #1");

    // ── Round 2: far: schema v02 (PropD2) + update d1; local: update r1Elem ─
    await importSchemaStrings(farTxn, [TestIModel.schemas.v01x00x02AddPropD2]);
    await t.far.locks.acquireLocks({ exclusive: d1Id });
    t.updateElement(farTxn, d1Id, { propA: "d1_a_r2" });
    farTxn.saveChanges("far r2 update d1");
    await pushChanges(farTxn, "R2 far round2");
    farTxn = startTestTxn(t.far, "R2 far 4");

    localTxn = startTestTxn(t.local, "R2 local r2 update");
    await t.local.locks.acquireLocks({ exclusive: r1ElemId });
    t.updateElement(localTxn, r1ElemId, { propA: "r1_a_updated" });
    localTxn.saveChanges("local r2 update r1Elem");

    // Pull #2
    await pullChanges(localTxn);
    t.local.clearCaches({ instanceCachesOnly: true });

    // c1: propA from pull #1; unchanged this round
    const c1After2 = t.getElementProps(t.local, c1Id);
    chai.expect(c1After2.propA).to.equal("c1_a_r1", "c1 propA should remain from pull #1 after pull #2");
    chai.expect(c1After2.propC).to.equal("c1_c_init", "c1 propC should be unchanged after pull #2");
    // c2: unchanged
    const c2After2 = t.getElementProps(t.local, c2Id);
    chai.expect(c2After2.propA).to.equal("c2_a_init", "c2 propA should be unchanged after pull #2");
    // r1Elem: propA update must survive rebase
    const r1After2 = t.getElementProps(t.local, r1ElemId);
    chai.expect(r1After2.propA).to.equal("r1_a_updated", "r1Elem propA update should survive pull #2 rebase");
    chai.expect(r1After2.propC).to.equal("r1_c", "r1Elem propC should be unchanged after pull #2 rebase");
    chai.expect(r1After2.id).to.equal(r1ElemId, "r1ElemId ECInstanceId must be stable after pull #2");
    // d1: far's propA update applied
    const d1After2 = t.getElementProps(t.local, d1Id);
    chai.expect(d1After2.propA).to.equal("d1_a_r2", "d1 propA should be updated by far after pull #2");
    chai.expect(d1After2.propD).to.equal("d1_d_init", "d1 propD should be unchanged after pull #2");
    chai.expect(d1After2.id).to.equal(d1Id, "d1Id ECInstanceId must be stable after pull #2");
    chai.expect(t.local.getSchemaProps("TestDomain").version).to.equal("01.00.02", "Schema v02 after pull #2");

    // ── Round 3: far: schema v03 (transforming: moves PropC to A) + update c2;
    //            local: insert r3Elem ──────────────────────────────────────────
    await importSchemaStrings(farTxn, [TestIModel.schemas.v01x00x03MovePropCAndD]);
    await t.far.locks.acquireLocks({ exclusive: c2Id });
    t.updateElement(farTxn, c2Id, { propA: "c2_a_r3" });
    farTxn.saveChanges("far r3 update c2");
    await pushChanges(farTxn, "R2 far round3");

    localTxn = startTestTxn(t.local, "R2 local r3 insert");
    await t.local.locks.acquireLocks({ shared: t.drawingModelId });
    const r3ElemId = t.insertElement(localTxn, "TestDomain:D", { propA: "r3_a" });
    localTxn.saveChanges("local r3 insert r3Elem");

    // Pull #3 — transforming schema rebase
    await pullChanges(localTxn);
    t.local.clearCaches({ instanceCachesOnly: true });

    // c1: propA from pull #1; PropC moved to A so query it as propC still accessible via A
    const c1After3 = t.getElementProps(t.local, c1Id);
    chai.expect(c1After3.propA).to.equal("c1_a_r1", "c1 propA should remain from pull #1 after pull #3");
    // c2: far's propA update from round 3
    const c2After3 = t.getElementProps(t.local, c2Id);
    chai.expect(c2After3.propA).to.equal("c2_a_r3", "c2 propA should be updated by far after pull #3");
    // r1Elem: propA update from round 2 must survive transforming rebase
    const r1After3 = t.getElementProps(t.local, r1ElemId);
    chai.expect(r1After3.propA).to.equal("r1_a_updated", "r1Elem propA update should survive transforming pull #3 rebase");
    chai.expect(r1After3.id).to.equal(r1ElemId, "r1ElemId ECInstanceId must be stable after pull #3");
    // d1: propA from round 2
    const d1After3 = t.getElementProps(t.local, d1Id);
    chai.expect(d1After3.propA).to.equal("d1_a_r2", "d1 propA should remain from pull #2 after pull #3");
    chai.expect(d1After3.id).to.equal(d1Id, "d1Id ECInstanceId must be stable after pull #3");
    // r3Elem: local insert preserved
    const r3After3 = t.getElementProps(t.local, r3ElemId);
    chai.expect(r3After3.propA).to.equal("r3_a", "r3Elem propA should be preserved after pull #3 rebase");
    chai.expect(r3After3.id).to.equal(r3ElemId, "r3ElemId ECInstanceId must be stable after pull #3");

    chai.expect(t.local.getSchemaProps("TestDomain").version).to.equal("01.00.03", "Schema v03 (MovePropCAndD) after pull #3");
  });

  // ──────────────────────────────────────────────────────────────────────────
  // R3: Multi-pull with insert, update, and delete in different rounds.
  //     Two pulls each rebase. Element lifecycle verified at every stage with
  //     ECSqlReader (ECInstanceId, className, domain props).
  // ──────────────────────────────────────────────────────────────────────────

  it("R3: two pulls with insert/update/delete across rounds; element lifecycle verified", async () => {
    t = await TestIModel.initialize("R3MultiPullInsertUpdateDelete");
    let farTxn = startTestTxn(t.far, "R3 far");
    let localTxn = startTestTxn(t.local, "R3 local");

    // ── Phase 0: shared elements ──────────────────────────────────────────────
    await t.far.locks.acquireLocks({ shared: t.drawingModelId });
    const sharedC = t.insertElement(farTxn, "TestDomain:C", { propA: "sc_a_init", propC: "sc_c_init" });
    const sharedD = t.insertElement(farTxn, "TestDomain:D", { propA: "sd_a_init", propD: "sd_d_init" });
    farTxn.saveChanges("create shared elements");
    await pushChanges(farTxn, "shared elements");
    farTxn = startTestTxn(t.far, "R3 far 2");

    await pullChanges(localTxn);
    localTxn = startTestTxn(t.local, "R3 local 2");

    // ── Round 1: far: schema v01 + update sharedC.propA ──────────────────────
    //            local: insert ephemeral C + insert persistent D + delete ephemeral
    await importSchemaStrings(farTxn, [TestIModel.schemas.v01x00x01AddPropC2]);
    await t.far.locks.acquireLocks({ exclusive: sharedC });
    t.updateElement(farTxn, sharedC, { propA: "sc_a_r1" });
    farTxn.saveChanges("far r1 update sharedC");
    await pushChanges(farTxn, "R3 far round1");
    farTxn = startTestTxn(t.far, "R3 far 3");

    // Local txn #1: insert ephemeral element (will be deleted before pull #1)
    await t.local.locks.acquireLocks({ shared: t.drawingModelId });
    const ephemeralId = t.insertElement(localTxn, "TestDomain:C", { propA: "eph_a", propC: "eph_c" });
    localTxn.saveChanges("local r1 insert ephemeral");

    // Local txn #2: insert persistent D element
    const persistDId = t.insertElement(localTxn, "TestDomain:D", { propA: "pd_a_init", propD: "pd_d_init" });
    localTxn.saveChanges("local r1 insert persistD");

    // Local txn #3: delete the ephemeral element
    localTxn.deleteElement(ephemeralId);
    localTxn.saveChanges("local r1 delete ephemeral");

    // Pull #1: rebase insert-persistD + delete-ephemeral txns onto incoming schema v01 + sharedC update
    await pullChanges(localTxn);
    chai.expect(() => t!.getElementProps(t!.local, ephemeralId)).to.throw(`element not found`, "Ephemeral element should be deleted after pull #1");
    const elementProps = t.getElementProps(t.local, persistDId);
    chai.expect(elementProps.propA).to.equal("pd_a_init", "Persistent D propA should be preserved after pull #1");
    chai.expect(elementProps.propD).to.equal("pd_d_init", "Persistent D propD should be preserved after pull #1");
    const sharedCAfter1 = t.getElementProps(t.local, sharedC);
    chai.expect(sharedCAfter1.propA).to.equal("sc_a_r1", "sharedC propA should be updated by far after pull #1");
    chai.expect(sharedCAfter1.propC).to.equal("sc_c_init", "sharedC propC should be unchanged after pull #1");
    chai.expect(sharedCAfter1.propC2).to.be.undefined;
    const sharedDAfter1 = t.getElementProps(t.local, sharedD);
    chai.expect(sharedDAfter1.propA).to.equal("sd_a_init", "sharedD propA should be unchanged after pull #1");
    chai.expect(sharedDAfter1.propD).to.equal("sd_d_init", "sharedD propD should be unchanged after pull #1");
  });

  // ──────────────────────────────────────────────────────────────────────────
  // R4: Three consecutive pulls where local never pushes.
  //     Each round: local makes multiple data txns, far pushes a schema change.
  //     Complete ECSql verification of all elements after all three pulls.
  // ──────────────────────────────────────────────────────────────────────────

  it("R4: three pulls without push; local accumulates txns; all elements verified after each", async () => {
    t = await TestIModel.initialize("R4ThreePullsNoPush");
    let farTxn = startTestTxn(t.far, "R4 far");
    let localTxn = startTestTxn(t.local, "R4 local");

    // ── Phase 0: create 2 C elements and 1 D element on far, both pull ────────
    await t.far.locks.acquireLocks({ shared: t.drawingModelId });
    const baseC1 = t.insertElement(farTxn, "TestDomain:C", { propA: "bc1_a", propC: "bc1_c" });
    const baseC2 = t.insertElement(farTxn, "TestDomain:C", { propA: "bc2_a", propC: "bc2_c" });
    const baseD1 = t.insertElement(farTxn, "TestDomain:D", { propA: "bd1_a", propD: "bd1_d" });
    farTxn.saveChanges("create base elements");
    await pushChanges(farTxn, "base elements");
    farTxn = startTestTxn(t.far, "R4 far 2");

    await pullChanges(localTxn);
    localTxn = startTestTxn(t.local, "R4 local 2");

    // ── Round 1: far: trivial schema v01 (PropC2 additive)
    //            local: TWO data txns – update baseC1 + insert localC1 ─────────
    await importSchemaStrings(farTxn, [TestIModel.schemas.v01x00x01AddPropC2]);
    await pushChanges(farTxn, "R4 far schema v01");
    farTxn = startTestTxn(t.far, "R4 far 3");

    // Local data txn A: update baseC1
    await t.local.locks.acquireLocks({ exclusive: baseC1 });
    t.updateElement(localTxn, baseC1, { propA: "bc1_a_loc_r1" });
    localTxn.saveChanges("local r1 update baseC1");

    // Local data txn B: insert localC1
    await t.local.locks.acquireLocks({ shared: t.drawingModelId });
    const localC1 = t.insertElement(localTxn, "TestDomain:C", { propA: "lc1_a_r1", propC: "lc1_c_r1" });
    localTxn.saveChanges("local r1 insert localC1");

    // Pull #1
    await pullChanges(localTxn);
    t.local.clearCaches({ instanceCachesOnly: true });

    // baseC1: local propA update preserved
    const bc1After1 = t.getElementProps(t.local, baseC1);
    chai.expect(bc1After1.propA).to.equal("bc1_a_loc_r1", "baseC1 propA update should survive pull #1 rebase");
    chai.expect(bc1After1.propC).to.equal("bc1_c", "baseC1 propC should be unchanged after pull #1");
    // baseC2: unchanged
    const bc2After1 = t.getElementProps(t.local, baseC2);
    chai.expect(bc2After1.propA).to.equal("bc2_a", "baseC2 propA should be unchanged after pull #1");
    chai.expect(bc2After1.propC).to.equal("bc2_c", "baseC2 propC should be unchanged after pull #1");
    // localC1: insert preserved with same ECInstanceId
    const lc1After1 = t.getElementProps(t.local, localC1);
    chai.expect(lc1After1.propA).to.equal("lc1_a_r1", "localC1 propA should be preserved after pull #1 rebase");
    chai.expect(lc1After1.propC).to.equal("lc1_c_r1", "localC1 propC should be preserved after pull #1 rebase");
    chai.expect(lc1After1.id).to.equal(localC1, "localC1 ECInstanceId must be stable after pull #1");
    // baseD1: unchanged
    const bd1After1 = t.getElementProps(t.local, baseD1);
    chai.expect(bd1After1.propA).to.equal("bd1_a", "baseD1 propA should be unchanged after pull #1");
    chai.expect(bd1After1.propD).to.equal("bd1_d", "baseD1 propD should be unchanged after pull #1");
    chai.expect(t.local.getSchemaProps("TestDomain").version).to.equal("01.00.01", "Schema v01 after pull #1");

    // ── Round 2: far: trivial schema v02 (PropD2 additive) + update baseD1
    //            local: update localC1.propA + insert localD1 ──────────────────
    await importSchemaStrings(farTxn, [TestIModel.schemas.v01x00x02AddPropD2]);
    await t.far.locks.acquireLocks({ exclusive: baseD1 });
    t.updateElement(farTxn, baseD1, { propA: "bd1_a_r2" });
    farTxn.saveChanges("far r2 update baseD1");
    await pushChanges(farTxn, "R4 far schema v02 + update baseD1");
    farTxn = startTestTxn(t.far, "R4 far 4");

    localTxn = startTestTxn(t.local, "R4 local r2");
    await t.local.locks.acquireLocks({ exclusive: localC1 });
    t.updateElement(localTxn, localC1, { propA: "lc1_a_r2_upd" });
    localTxn.saveChanges("local r2 update localC1");

    await t.local.locks.acquireLocks({ shared: t.drawingModelId });
    const localD1 = t.insertElement(localTxn, "TestDomain:D", { propA: "ld1_a_r2", propD: "ld1_d_r2" });
    localTxn.saveChanges("local r2 insert localD1");

    // Pull #2
    await pullChanges(localTxn);
    t.local.clearCaches({ instanceCachesOnly: true });

    // baseC1: propA from round 1 unchanged
    const bc1After2 = t.getElementProps(t.local, baseC1);
    chai.expect(bc1After2.propA).to.equal("bc1_a_loc_r1", "baseC1 propA should remain from round 1 after pull #2");
    chai.expect(bc1After2.propC).to.equal("bc1_c", "baseC1 propC should be unchanged after pull #2");
    // localC1: propA update must survive
    const lc1After2 = t.getElementProps(t.local, localC1);
    chai.expect(lc1After2.propA).to.equal("lc1_a_r2_upd", "localC1 propA update should survive pull #2 rebase");
    chai.expect(lc1After2.propC).to.equal("lc1_c_r1", "localC1 propC should be unchanged after pull #2 rebase");
    chai.expect(lc1After2.id).to.equal(localC1, "localC1 ECInstanceId must be stable after pull #2");
    // baseD1: far's propA update applied
    const bd1After2 = t.getElementProps(t.local, baseD1);
    chai.expect(bd1After2.propA).to.equal("bd1_a_r2", "baseD1 propA should be updated by far after pull #2");
    // localD1: insert preserved
    const ld1After2 = t.getElementProps(t.local, localD1);
    chai.expect(ld1After2.propA).to.equal("ld1_a_r2", "localD1 propA should be preserved after pull #2 rebase");
    chai.expect(ld1After2.propD).to.equal("ld1_d_r2", "localD1 propD should be preserved after pull #2 rebase");
    chai.expect(ld1After2.id).to.equal(localD1, "localD1 ECInstanceId must be stable after pull #2");
    chai.expect(t.local.getSchemaProps("TestDomain").version).to.equal("01.00.02", "Schema v02 after pull #2");

    // ── Round 3: far: transforming schema (moves PropC to A) + update baseC2.propA
    //            local: delete localC1 only.
    //
    //  NOTE: local does NOT attempt to lock baseC2 here. After far exclusively locked
    //  baseC2 and pushed (releasing the lock at a newer changeset index),
    //  `LocalHub.doesBriefcaseRequirePullBeforeLock` would throw PullIsRequired for any
    //  lock request on baseC2 from local (still behind on changesets). The test therefore
    //  only exercises local deleting one of its own elements (localC1), which local itself
    //  inserted and locked — those locks have lastExclusiveReleaseChangesetIndex = undefined,
    //  so no pull is required before re-acquiring them.
    await importSchemaStrings(farTxn, [TestIModel.schemas.v01x00x03MovePropCAndD]);
    await t.far.locks.acquireLocks({ exclusive: baseC2 });
    t.updateElement(farTxn, baseC2, { propA: "bc2_a_r3" });
    farTxn.saveChanges("far r3 update baseC2");
    await pushChanges(farTxn, "R4 far round3");

    localTxn = startTestTxn(t.local, "R4 local r3 delete");
    await t.local.locks.acquireLocks({ exclusive: localC1 });
    localTxn.deleteElement(localC1);
    localTxn.saveChanges("local r3 delete localC1");

    // Pull #3 — transforming schema rebase
    await pullChanges(localTxn);

    // baseC1: propA from round 1 unchanged
    const bc1After3 = t.getElementProps(t.local, baseC1);
    chai.expect(bc1After3.propA).to.equal("bc1_a_loc_r1", "baseC1 propA should remain from round 1 after pull #3");
    chai.expect(bc1After3.propC).to.equal("bc1_c", "baseC1 propC should be unchanged after pull #3");

    // baseC2: propA updated by far in round 3; PropC moved to A but still accessible via propC query
    const bc2After3 = t.getElementProps(t.local, baseC2);
    chai.expect(bc2After3.propA).to.equal("bc2_a_r3", "baseC2 propA should be changed after pull #3");
    chai.expect(bc2After3.propC).to.equal("bc2_c", "baseC2 propC should be unchanged after pull #3");

    // localC1: must be deleted
    chai.expect(() => t!.getElementProps(t!.local, localC1)).to.throw(`element not found`, "localC1 should be deleted after pull #3");
    // baseD1: far's propA update applied
    const bd1After3 = t.getElementProps(t.local, baseD1);
    chai.expect(bd1After3.propA).to.equal("bd1_a_r2", "baseD1 propA should be updated by far after pull #3");
    // localD1: insert preserved
    const ld1After3 = t.getElementProps(t.local, localD1);
    chai.expect(ld1After3.propA).to.equal("ld1_a_r2", "localD1 propA should be preserved after pull #3 rebase");
    chai.expect(ld1After3.propD).to.equal("ld1_d_r2", "localD1 propD should be preserved after pull #3 rebase");
    chai.expect(ld1After2.id).to.equal(localD1, "localD1 ECInstanceId must be stable after pull #3");
    chai.expect(t.local.getSchemaProps("TestDomain").version).to.equal("01.00.03", "Schema v02 after pull #3");
  });

  // ──────────────────────────────────────────────────────────────────────────
  // R5: Two consecutive pulls where local never pushes.
  //     Each round: local makes multiple data txns, far pushes a schema change.
  //     Complete ECSql verification of all elements after all three pulls.
  // ──────────────────────────────────────────────────────────────────────────

  it("R5: two consecutive pulls each trigger rebase with local changes; ECInstanceId/className/props verified after each", async () => {
    t = await TestIModel.initialize("R5TwoPullsEachRebase");
    let farTxn = startTestTxn(t.far, "R5 far");
    let localTxn = startTestTxn(t.local, "R5 local");

    // ── Phase 0: create shared elements on far, both pull to sync ────────────
    await t.far.locks.acquireLocks({ shared: t.drawingModelId });
    const cElemId = t.insertElement(farTxn, "TestDomain:C", { propA: "c_a_init", propC: "c_c_init" });
    farTxn.saveChanges("create shared elements");
    await pushChanges(farTxn, "create shared elements");
    farTxn = startTestTxn(t.far, "R5 far 2");

    await pullChanges(localTxn);
    localTxn = startTestTxn(t.local, "R5 local 2");
    await t.local.locks.acquireLocks({ exclusive: cElemId });
    t.updateElement(localTxn, cElemId, { propC: "c_c_local" });
    localTxn.saveChanges("local update to cElemId.propC");

    await importSchemaStrings(farTxn, [TestIModel.schemas.v01x00x01AddPropC2]);
    await pushChanges(farTxn, "far schema v01");
    farTxn = startTestTxn(t.far, "R1 far 3");

    await pullChanges(localTxn);
    t.local.clearCaches({ instanceCachesOnly: true });

    const elementAfterSecondPull = t.getElementProps(t.local, cElemId);

    chai.expect(elementAfterSecondPull).to.not.be.undefined;
    chai.expect(elementAfterSecondPull!.propC).to.equal("c_c_local", "Local update to cElemId.propC should survive first pull's rebase");
    chai.expect(elementAfterSecondPull!.propA).to.equal("c_a_init", "Far's update to cElemId.propA should be applied after first pull");
    chai.expect(elementAfterSecondPull!.propC2).to.be.undefined;

    await importSchemaStrings(farTxn, [TestIModel.schemas.v01x00x02MovePropCToA]);
    await pushChanges(farTxn, "far schema v02");
    farTxn = startTestTxn(t.far, "R1 far 4");

    await pullChanges(localTxn);
    t.local.clearCaches({ instanceCachesOnly: true });

    const elementAfterThirdPull = t.getElementProps(t.local, cElemId);
    chai.expect(elementAfterThirdPull).to.not.be.undefined;
    chai.expect(elementAfterThirdPull!.propC).to.equal("c_c_local", "Local update to cElemId.propC should survive second pull's rebase");
    chai.expect(elementAfterThirdPull!.propA).to.equal("c_a_init", "Far's update to cElemId.propA should be applied after second pull");
    chai.expect(elementAfterThirdPull!.propC2).to.be.undefined;

    chai.expect(t.local.getSchemaProps("TestDomain").version).to.equal("01.00.02", "Schema must be v02 after pull #3");
  });
});

