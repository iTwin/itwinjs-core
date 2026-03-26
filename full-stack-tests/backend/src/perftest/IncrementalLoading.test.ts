/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { assert } from "chai";
import * as path from "path";
import { configData } from "./IncrementalLoadingConfig";
import { IModelHost, IModelJsFs, StandaloneDb } from "@itwin/core-backend";
import { IModelTestUtils, KnownTestLocations } from "@itwin/core-backend/lib/cjs/test";
import { IModelIncrementalSchemaLocater } from "@itwin/core-backend/lib/cjs/IModelIncrementalSchemaLocater";
import { OpenMode, StopWatch } from "@itwin/core-bentley";
import { ECClass, ECVersion, Schema, SchemaContext, SchemaKey } from "@itwin/ecschema-metadata";
import { Reporter } from "@itwin/perf-tools";

interface TotalCounts {
  totalItemCount: number,
  totalClassCount: number,
  totalPropertyCount: number,
  totalCustomAttrCount: number,
}

/**
 * Options for generating an EC schema.
 */
interface ClassGenerationOptions {
  classCount: number;  
  propCountperClass?: number;
  customAttrCountperClass?: number;
  customAttrCountperProperty?: number;
  baseClassName?: string;
}

interface SchemaGenerationOptions {
  schemaName?: string;
  version?: string;
  alias?: string;
  referenceSchemas?: { schemaName: string; version: string; alias?: string }[];
  entityClasses?: ClassGenerationOptions;
  mixins?: ClassGenerationOptions;
  relationshipClasses?: ClassGenerationOptions;
  structClasses?: ClassGenerationOptions;
  customAttributeClasses?: ClassGenerationOptions;
  schemaItemCount?: number;
}

describe("IncrementalLoadingPerformance", () => { 
  const testSuite = "IncrementalLoadingPerformance";
  const assetDir = path.join(__dirname, "../../../assets");
  const reporter = new Reporter();
  
  const testSchemaKey = new SchemaKey("TestSchema", ECVersion.fromString("01.00.00")); 
  const defaultOptions = {
    schemaName: testSchemaKey.name,
    version: testSchemaKey.version.toString(),
    alias: "ts",
    referenceSchemas: [{ schemaName:"BisCore", version:"01.00.14", alias: "bis" }],
  };
  let snapshotFile: string;
 
  function getClassGroups(opts: SchemaGenerationOptions) {
    return [
      opts.entityClasses,
      opts.structClasses,
      opts.mixins,
      opts.relationshipClasses,
      opts.customAttributeClasses,
    ];
  }

  function getTotalClassCount(opts: SchemaGenerationOptions): number {
    return getClassGroups(opts).reduce((total, group) => total + (group?.classCount ?? 0), 0);
  }

  function getTotalItemCount(opts: SchemaGenerationOptions): number {
    const totalClassCount = getTotalClassCount(opts);

    // getItemsXML creates 9 simple schema items per requested count (units, formats, KOQs, etc.)
    const simpleItemsPerCount = 9;
    const schemaItemCount = opts.schemaItemCount ?? 0;
    return totalClassCount + (simpleItemsPerCount * schemaItemCount);
  }

  function getTotalPropertyCount(opts: SchemaGenerationOptions): number {
    return getClassGroups(opts).reduce((total, group) => {
      const count = group?.classCount ?? 0;
      const propsPerClass = group?.propCountperClass ?? 0;
      return total + (count * propsPerClass);
    }, 0);
  }

  function getTotalCustomAttributeCount(opts: SchemaGenerationOptions): number {
    const normalize = (g?: ClassGenerationOptions) => ({
      count: g?.classCount ?? 0,
      props: g?.propCountperClass ?? 0,
      attrPerClass: g?.customAttrCountperClass ?? 0,
      attrPerProperty: g?.customAttrCountperProperty ?? 0,
    });

    return getClassGroups(opts).reduce((total, group) => {
      const { count, props, attrPerClass, attrPerProperty } = normalize(group);
      // custom attributes applied to the class itself + those applied to each property of the class
      return total + (count * attrPerClass) + (count * props * attrPerProperty);
    }, 0);
  }

  function getConfigTotals(opts: SchemaGenerationOptions): TotalCounts {
    const totalClassCount = getTotalClassCount(opts);
    const totalItemCount = getTotalItemCount(opts);
    const totalPropertyCount = getTotalPropertyCount(opts);
    const totalCustomAttrCount = getTotalCustomAttributeCount(opts);

    return {
      totalItemCount,
      totalClassCount,
      totalPropertyCount,
      totalCustomAttrCount,
    };
  }
  
  async function getSchemaTotals(schema?: Schema): Promise<TotalCounts> {
    if (!schema) {
      return { totalItemCount: 0, totalClassCount: 0, totalPropertyCount: 0, totalCustomAttrCount: 0 };
    }

    const items = [...schema.getItems()];
    const classItems = items.filter((it): it is ECClass => ECClass.isECClass(it));

    // Count custom attributes declared on classes
    let totalCustomAttrCount = classItems.reduce((acc, cls) => {
      return acc + (cls.customAttributes ? [...cls.customAttributes].length : 0);
    }, 0);

    // Fetch properties for all classes in parallel and count properties + custom attributes on properties
    const properties = await Promise.all(classItems.map(async (cls) => cls.getProperties(true)));
    let totalPropertyCount = 0;
    for (const props of properties) {
      const propertyArray = [...props];
      totalPropertyCount += propertyArray.length;
      for (const prop of propertyArray) {
        if (prop.customAttributes) {
          totalCustomAttrCount += [...prop.customAttributes].length;
        }
      }
    }

    return {
      totalItemCount: items.length,
      totalClassCount: classItems.length,
      totalPropertyCount,
      totalCustomAttrCount,
    };
  }

  /**
   * Generates XML string defining class custom attributes.
   * @param opts Options for generating class custom attributes.
   * @returns XML string defining class custom attributes.
   * @returns 
   */
  function getCustomAttributesXml(attrPerClass?: number, attrFileName?: string): string {
    let customAttrXml: string = ""; 
    if (attrPerClass && attrPerClass > 0) {
      customAttrXml += "\n\t<ECCustomAttributes>";
      for (let i = 0; i < attrPerClass; ++i) {
        customAttrXml += `\n\t    <CustomAttributeTest${i} xmlns="${attrFileName}.01.00.01"/>`;
      }
      customAttrXml += "\n\t</ECCustomAttributes>";
    }
    return customAttrXml;
  }

  /**
   * Generates XML string defining class properties.
   * @param opts Options for generating class properties.
   * @returns XML string defining class properties.
   * @returns 
   */
  function getPropertiesXml(prefix: string, propsPerClass?: number, attrPerProperty?: number, attrFileName?: string): string {
    if (!propsPerClass || propsPerClass <= 0) return "";

    let propertiesXml: string = "";
    for (let i = 0; i < propsPerClass; ++i) {
      propertiesXml += `\n\t<ECProperty propertyName="${prefix}_Prop${i}" typeName="string" displayLabel="Prop${i}" description="${prefix} Property${i}" priority="${i+1}">`
      if (attrPerProperty && attrPerProperty > 0) {
        propertiesXml += "\n\t    <ECCustomAttributes>";
        for (let j = 0; j < attrPerProperty; ++j) {
          const propName = `Prop${Math.floor(Math.random() * 11)}`;
          propertiesXml += `\n\t\t<CustomAttributeTest${j} xmlns="${attrFileName}.01.00.01">
                    <CustomAttributeTest${j}_${propName}>Old${prefix}_Prop${j}</CustomAttributeTest${j}_${propName}>
                </CustomAttributeTest${j}>`;
        }
        propertiesXml += "\n\t    </ECCustomAttributes>";
      }
      propertiesXml += `\n\t</ECProperty>`;
    }
    return propertiesXml;
  }

  /**
   * Generates XML string defining relationship classes.
   * @param opts Options for generating relationship classes.
   * @returns XML string defining relationship classes.
   */
  function getRelationshipClassesXML(opts?: ClassGenerationOptions, attrFileName?: string): string {
    if (!opts || opts.classCount <= 0) return "";
    let classesXml: string = "";
    for (let i = 0; i < opts.classCount; ++i) {
      classesXml += `\n    <ECRelationshipClass typeName="RelationshipTest${i}" strength="referencing" strengthDirection="forward" modifier="None" displayLabel="Test${i}" description="Relationship Test${i}">`;      
      classesXml += getCustomAttributesXml(opts.customAttrCountperClass, attrFileName);
      classesXml += `\n\t<BaseClass>${opts.baseClassName ?? "bis:ElementRefersToElements"}</BaseClass>`;
      classesXml += `\n\t<Source multiplicity="(0..*)" polymorphic="true" roleLabel="source">
            <Class class="bis:Element"/>
        </Source>
        <Target multiplicity="(0..*)" polymorphic="true" roleLabel="target">
            <Class class="bis:Element"/>
        </Target>`;
      classesXml += getPropertiesXml(`RelationshipTest${i}`, opts.propCountperClass, opts.customAttrCountperProperty, attrFileName);
      classesXml += `\n    </ECRelationshipClass>`;
    }
    return classesXml;
  }

  /**
   * Generates XML string defining structclasses.
   * @param opts Options for generating structclasses.
   * @returns XML string defining structclasses.
   */
  function getStructClassesXML(opts?: ClassGenerationOptions, attrFileName?: string): string {
    if (!opts || opts.classCount <= 0) return "";
    let classesXml: string = "";
    for (let i = 0; i < opts.classCount; ++i) {
      classesXml += `\n    <ECStructClass typeName="StructTest${i}" description="Struct Test${i}" displayLabel="Test${i}">`;
      classesXml += getCustomAttributesXml(opts.customAttrCountperClass, attrFileName);
      if (opts.baseClassName !== undefined) {
        classesXml += `\n\t<BaseClass>${opts.baseClassName}</BaseClass>`;
      }
      classesXml += getPropertiesXml(`StructTest${i}`, opts.propCountperClass, opts.customAttrCountperProperty, attrFileName);
      classesXml += `\n    </ECStructClass>`;
    }
    return classesXml;
  }

  /**
   * Generates XML string defining entityclasses.
   * @param opts Options for generating entityclasses.
   * @returns XML string defining entityclasses.
   */
  function getEntityClassesXML(opts?: ClassGenerationOptions, attrFileName?: string): string {
    if (!opts || opts.classCount <= 0) return "";
    let classesXml: string = "";
    for (let i = 0; i < opts.classCount; ++i) {
      classesXml += `\n    <ECEntityClass typeName="EntityTest${i}" displayLabel="Test${i}" description="Entity Test${i}">`;      
      classesXml += getCustomAttributesXml(opts.customAttrCountperClass, attrFileName);
      classesXml += `\n\t<BaseClass>${opts.baseClassName ?? "bis:PhysicalElement"}</BaseClass>`;
      classesXml += getPropertiesXml(`EntityTest${i}`, opts.propCountperClass, opts.customAttrCountperProperty, attrFileName);
      classesXml += `\n    </ECEntityClass>`;
    }
    return classesXml;
  }

  /**
   * Generates XML string defining customattribute classes.
   * @param opts Options for generating customattribute classes.
   * @returns XML string defining customattribute classes.
   */
  function getCustomAttributeClassesXML(opts?: ClassGenerationOptions, attrFileName?: string): string {
    if (!opts || opts.classCount <= 0) return "";
    let classesXml: string = "";
    for (let i = 0; i < opts.classCount; ++i) {
      classesXml += `\n    <ECCustomAttributeClass typeName="CustomAttributeTest${i}" modifier="None" appliesTo="Any" displayLabel="Test${i}" description="Custom Attribute Test${i}">`;
      classesXml += getCustomAttributesXml(opts.customAttrCountperClass, attrFileName);
      if (opts.baseClassName !== undefined) {
        classesXml += `\n\t<BaseClass>${opts.baseClassName}</BaseClass>`;
      }
      classesXml += getPropertiesXml(`CustomAttributeTest${i}`, opts.propCountperClass, opts.customAttrCountperProperty, attrFileName);
      classesXml += `\n    </ECCustomAttributeClass>`;
    }
    return classesXml;
  }

  /**
   * Generates XML string defining mixin classes.
   * @param opts Options for generating mixin classes.
   * @returns XML string defining mixin classes.
   */
  function getMixinsXML(opts?: ClassGenerationOptions, attrFileName?: string): string {
    if (!opts || opts.classCount <= 0) return "";

    let classesXml: string = "";
    for (let i = 0; i < opts.classCount; ++i) {
      classesXml += `\n    <ECEntityClass typeName="IMixinTest${i}" modifier="Abstract" displayLabel="Test${i}" description="Mixin Test${i}">
        <ECCustomAttributes>
            <IsMixin xmlns='CoreCustomAttributes.01.00.00'>
                <AppliesToEntityClass>bis:Element</AppliesToEntityClass>
            </IsMixin>`;
      if (opts.customAttrCountperClass && opts.customAttrCountperClass > 0) {
        for (let j = 0; j < opts.customAttrCountperClass; ++j) {
          classesXml += `\n\t    <CustomAttributeTest${j} xmlns="${attrFileName}.01.00.01"/>`;
        }
      }
      classesXml += `\n\t  </ECCustomAttributes>`;
      if (opts.baseClassName !== undefined) {
        classesXml += `\n\t<BaseClass>${opts.baseClassName}</BaseClass>`;
      }
      classesXml += getPropertiesXml(`IMixinTest${i}`, opts.propCountperClass, opts.customAttrCountperProperty, attrFileName);
      classesXml += `\n    </ECEntityClass>`;
    }
    return classesXml;
  }

  /**
   * Generates XML string defining simple schema items.
   * @param opts Options for generating schema items.
   * @returns XML string defining schema items.
   */
  function getItemsXML(itemsCount?: number): string {
    if (!itemsCount || itemsCount <= 0) return "";

    let itemsXml: string = "";
    // create unit systems
    for (let i = 0; i < itemsCount; ++i) {
      itemsXml += `    <UnitSystem typeName="UnitSystem_Test${i}" displayLabel="Test${i}"/>\n`;
    }
    // create property categories
    for (let i = 0; i < itemsCount; ++i) {
      itemsXml += `    <PropertyCategory typeName="Category_Test${i}" description="Category Test${i}" displayLabel="Test${i}" priority="${i*10+1}"/>\n`;
    }
    // create phenomena
    for (let i = 0; i < itemsCount; ++i) {
      itemsXml += `    <Phenomenon typeName="Phenomenon_Test${i}" definition="TEST(${i})" displayLabel="Test${i}"/>\n`;
    }
    // create enumerations
    for (let i = 0; i < itemsCount; ++i) {
      itemsXml += `    <ECEnumeration typeName="Enumeration_Test${i}" backingTypeName="int" displayLabel="Test${i}">
        <ECEnumerator name="Test${i}_One" value="${i*2+1}" displayLabel="Test${i} One"/>
        <ECEnumerator name="Test${i}_Two" value="${i*2+2}" displayLabel="Test${i} Two"/>
    </ECEnumeration>\n`;
    }
    // create units
    for (let i = 0; i < itemsCount; ++i) {
      itemsXml += `    <Unit typeName="Unit_Test${i}" phenomenon="Phenomenon_Test${i}" unitSystem="UnitSystem_Test${i}" definition="TEST(${i})" displayLabel="Test${i}"/>\n`;
    }
    // creetae inverted units
    for (let i = 0; i < itemsCount; ++i) {
      itemsXml += `    <InvertedUnit typeName="InvertedUnit_Test${i}" invertsUnit="Unit_Test${i}" unitSystem="UnitSystem_Test${i}" description="InvertedUnit Test${i}"/>\n`;
    }
    // create constants
    for (let i = 0; i < itemsCount; ++i) {
      itemsXml += `    <Constant typeName="Constant_Test${i}" definition="1/TEST(${i})" phenomenon="Phenomenon_Test${i}" numerator="${(i+1)*0.001}" denominator="${(i+1)*0.0002}" description="Constant Test${i}"/>\n`;
    }
    // create formats
    for (let i = 0; i < itemsCount; ++i) {
      itemsXml += `    <Format typeName="Format_Test${i}" type="decimal" precision="6" formatTraits="keepSingleZero|keepDecimalPoint" displayLabel="Test${i}"/>\n`;
    }
    // create kind of quantities
    for (let i = 0; i < itemsCount; ++i) {
      itemsXml += `    <KindOfQuantity typeName="KOQ_Test${i}" persistenceUnit="Unit_Test${i}" presentationUnits="Format_Test${i}(4)[Unit_Test${i}]" relativeError="${(i+1)*0.001}" displayLabel="Test${i}"/>\n`;
    }
    return itemsXml;
  }

  /**
   * Generates schema from options
   * @param options  Options for generating schema.  
   * @returns XML string defining schema.
   */
  function createSchemaFromOptions(options: SchemaGenerationOptions): string[] {
    let attrSchemaName;
    const fileNames: string[] = [];
    const {
      schemaName,
      version,
      alias,
      referenceSchemas,
      entityClasses,
      mixins,
      relationshipClasses,
      structClasses,
      customAttributeClasses,
      schemaItemCount
    } = options;
    
    // Find the max custom attribute counts across all class groups in options
    const maxCustomAttrCount = getClassGroups(options).reduce((max, g) =>
      Math.max(max, (g?.customAttrCountperClass ?? 0), (g?.customAttrCountperProperty ?? 0)), 0);
    const schemaAlias = alias ?? schemaName?.toLowerCase() ?? "ts";

    if (maxCustomAttrCount > 0) {
      attrSchemaName = `${options.schemaName}_CustomAttributes`;
      const customAttrSchemaAlias = `${schemaAlias}_cs`;

      const customAttrFileName = createSchemaFromOptions({
        schemaName: attrSchemaName,
        version: "01.00.01",
        alias: customAttrSchemaAlias,
        referenceSchemas: [],
        customAttributeClasses: { classCount: maxCustomAttrCount, propCountperClass: 10 },
      });

      (options.referenceSchemas ?? []).push({ schemaName: attrSchemaName, version: '01.00.01', alias: customAttrSchemaAlias });
      fileNames.push(...customAttrFileName);
    }

    let xml = `<?xml version="1.0" encoding="UTF-8"?>\n<ECSchema schemaName="${schemaName}" alias="${schemaAlias}" version="${version}" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.2">`;
    if (referenceSchemas && referenceSchemas.length > 0) {
      for (const ref of referenceSchemas) {
        xml += `\n    <ECSchemaReference name="${ref.schemaName}" alias="${ref.alias ?? ref.schemaName.toLowerCase()}" version="${ref.version}"/>`;
      }
    }
    xml += getItemsXML(schemaItemCount);
    xml += getCustomAttributeClassesXML(customAttributeClasses, attrSchemaName);
    xml += getMixinsXML(mixins, attrSchemaName);
    xml += getStructClassesXML(structClasses, attrSchemaName);
    xml += getEntityClassesXML(entityClasses, attrSchemaName);
    xml += getRelationshipClassesXML(relationshipClasses, attrSchemaName);
    xml += "\n</ECSchema>";

    const schemaFilePath = path.join(assetDir, `${schemaName}.${version}.ecschema.xml`);
    IModelJsFs.writeFileSync(schemaFilePath, xml);
    fileNames.push(schemaFilePath);

    return fileNames; 
  }

  async function waitSchemaLoading(schemaContext: SchemaContext, key: SchemaKey) {
    const stopWatch = new StopWatch("", true);
    const schema = await schemaContext.getSchema(key);
    const stubsTime = stopWatch.current.milliseconds;

    if (schema?.loadingController !== undefined)
      await schema.loadingController.wait();
    const totalTime = stopWatch.stop().milliseconds;
    
    return { schema, stubsTime, totalTime };
  }

  beforeEach(async () => {
    if (IModelJsFs.existsSync(assetDir))
      IModelJsFs.removeSync(assetDir);
    IModelJsFs.mkdirSync(assetDir);

    await IModelHost.startup();
    
    // create an empty imodel
    snapshotFile = IModelTestUtils.prepareOutputFile(testSuite, "IncrementalLoading.bim");
    const rootSubject = { name: "TestIModel", description: "Performance tests" };
    const imodel = StandaloneDb.createEmpty(snapshotFile, { rootSubject });
    imodel.saveChanges();
    imodel.close();
  });

  afterEach(async () => {
    if (IModelHost.isValid) {
      await IModelHost.shutdown();
    }
  });

  after(() => {
    const csvFilePath = path.join(KnownTestLocations.outputDir, testSuite, "PerformanceResults.csv");
    reporter.exportCSV(csvFilePath);
  });

  describe("Increase Classes Tests", () => {
    configData.testCases.increaseClasses.forEach((testCase: SchemaGenerationOptions) => {
      it(`Gradually increase the number of classes (${getTotalClassCount(testCase)})`, async () => {
        const options: SchemaGenerationOptions = {
          ...defaultOptions,
          ...testCase,
        };
        options.referenceSchemas = [
          ...(defaultOptions.referenceSchemas ?? []),
          ...(testCase.referenceSchemas ?? []),
        ];

        const imodel = StandaloneDb.openFile(snapshotFile, OpenMode.ReadWrite);
        try {
          // create schema file(s)
          const schemaFileNames = createSchemaFromOptions(options);
          await imodel.importSchemas(schemaFileNames);
          imodel.saveChanges();

          const schemaContext = new SchemaContext();
          const locater = new IModelIncrementalSchemaLocater(imodel, { useMultipleQueries: true });
          schemaContext.addLocater(locater);

          const { schema, stubsTime, totalTime } = await waitSchemaLoading(schemaContext, testSchemaKey);
          assert.isDefined(schema);

          const configTotals = getConfigTotals(options);
          const schemaTotals = await getSchemaTotals(schema);
          assert.deepEqual(configTotals, schemaTotals);

          reporter.addEntry(testSuite, "IncreaseClasses", "Stubs time", stubsTime, configTotals);
          reporter.addEntry(testSuite, "IncreaseClasses", "Total time", totalTime, configTotals);
        } finally {
          imodel.close();
        }
      });
    });
  });
  
  describe("Increase Properties Tests", () => {
    configData.testCases.increaseProperties.forEach((testCase: SchemaGenerationOptions) => {
      it(`Gradually increase the number of properties (${getTotalPropertyCount(testCase)})`, async () => {
        const options: SchemaGenerationOptions = {
          ...defaultOptions,
          ...testCase,
        };
        options.referenceSchemas = [
          ...(defaultOptions.referenceSchemas ?? []),
          ...(testCase.referenceSchemas ?? []),
        ];

        const imodel = StandaloneDb.openFile(snapshotFile, OpenMode.ReadWrite);
        try {
          // create schema file(s)
          const schemaFileNames = createSchemaFromOptions(options);
          await imodel.importSchemas(schemaFileNames);
          imodel.saveChanges();

          const schemaContext = new SchemaContext();
          const locater = new IModelIncrementalSchemaLocater(imodel, { useMultipleQueries: true });
          schemaContext.addLocater(locater);

          const { schema, stubsTime, totalTime } = await waitSchemaLoading(schemaContext, testSchemaKey);
          assert.isDefined(schema);

          const configTotals = getConfigTotals(options);
          const schemaTotals = await getSchemaTotals(schema);
          assert.deepEqual(configTotals, schemaTotals);

          reporter.addEntry(testSuite, "IncreaseProperties", "Stubs time", stubsTime, configTotals);
          reporter.addEntry(testSuite, "IncreaseProperties", "Total time", totalTime, configTotals);
        } finally {
          imodel.close();
        }
      });
    });
  });

  describe("Increase Custom Attributes Tests", () => {
    configData.testCases.increaseCustomAttributes.forEach((testCase: SchemaGenerationOptions) => {
      it(`Gradually increase the number of custom attributes (${getTotalCustomAttributeCount(testCase)})`, async () => {
        const options: SchemaGenerationOptions = {
          ...defaultOptions,
          ...testCase,
        };
        options.referenceSchemas = [
          ...(defaultOptions.referenceSchemas ?? []),
          ...(testCase.referenceSchemas ?? []),
        ];

        const imodel = StandaloneDb.openFile(snapshotFile, OpenMode.ReadWrite);
        try {
          // create schema file
          const schemaFileNames = createSchemaFromOptions(options);
          await imodel.importSchemas(schemaFileNames);
          imodel.saveChanges();

          const schemaContext = new SchemaContext();
          const locater = new IModelIncrementalSchemaLocater(imodel, { useMultipleQueries: true });
          schemaContext.addLocater(locater);

          const { schema, stubsTime, totalTime } = await waitSchemaLoading(schemaContext, testSchemaKey);
          assert.isDefined(schema);

          const configTotals = getConfigTotals(options);
          const schemaTotals = await getSchemaTotals(schema);
          assert.deepEqual(configTotals, schemaTotals);

          reporter.addEntry(testSuite, "IncreaseCustomAattributes", "Stubs time", stubsTime, configTotals);
          reporter.addEntry(testSuite, "IncreaseCustomAattributes", "Total time", totalTime, configTotals);
        } finally {
          imodel.close();
        }
      });
    });
  });

  describe("Increase Schema Items Tests", () => {
    configData.testCases.increaseItems.forEach((testCase: SchemaGenerationOptions) => {
      it(`Gradually increase the number of all schema items (${getTotalItemCount(testCase)})`, async () => {
        const options: SchemaGenerationOptions = {
          ...defaultOptions,
          ...testCase,
        };
        options.referenceSchemas = [
          ...(defaultOptions.referenceSchemas ?? []),
          ...(testCase.referenceSchemas ?? []),
        ];
      
        const imodel = StandaloneDb.openFile(snapshotFile, OpenMode.ReadWrite);
        try {
          // create schema file
          const schemaFileNames = createSchemaFromOptions(options);
          await imodel.importSchemas(schemaFileNames);
          imodel.saveChanges();

          const schemaContext = new SchemaContext();
          const locater = new IModelIncrementalSchemaLocater(imodel, { useMultipleQueries: true });
          schemaContext.addLocater(locater);

          const { schema, stubsTime, totalTime } = await waitSchemaLoading(schemaContext, testSchemaKey);
          assert.isDefined(schema);
      
          const configTotals = getConfigTotals(options);
          const schemaTotals = await getSchemaTotals(schema);
          assert.deepEqual(configTotals, schemaTotals);

          reporter.addEntry(testSuite, "IncreaseItems", "Stubs time", stubsTime, configTotals);
          reporter.addEntry(testSuite, "IncreaseItems", "Total time", totalTime, configTotals);
        }
        finally {
          imodel.close();
        }
      });
    });
  });

  describe("Increase Inheritance Level Tests", () => {
    configData.testCases.increaseInheritance.level.forEach((inheritanceLevel: number) => {
      it(`Gradually increase the number of base class inheritance (${inheritanceLevel})`, async () => {
        const testOpts = configData.testCases.increaseInheritance.options as SchemaGenerationOptions;;
        const schemaFileNames: string[] = [];

        const createClassOptionsForLevel = (prevLevel: number, prefix: string, group?: ClassGenerationOptions): ClassGenerationOptions | undefined => {
          if (!group) return undefined;
          const baseClassName = prevLevel > 0 ? `sch${prevLevel}:${prefix}${prevLevel-1}` : undefined;
          return { ...group, baseClassName };
        }
        const createSchemaOptionsForLevel = (prevLevel: number, baseOpts: SchemaGenerationOptions): SchemaGenerationOptions => {
          return {
            referenceSchemas: [
              ...(prevLevel > 0 ? [{ schemaName: `SimpleSchema${prevLevel}`, version: "01.00.00", alias: `sch${prevLevel}` }]: []),
              ...(defaultOptions.referenceSchemas ?? []),
              ...(baseOpts.referenceSchemas ?? []),
            ],
            entityClasses: createClassOptionsForLevel(prevLevel, "EntityTest", baseOpts.entityClasses),
            structClasses: createClassOptionsForLevel(prevLevel, "StructTest", baseOpts.structClasses),
            relationshipClasses: createClassOptionsForLevel(prevLevel, "RelationshipTest", baseOpts.relationshipClasses),
            customAttributeClasses: createClassOptionsForLevel(prevLevel, "CustomAttributeTest", baseOpts.customAttributeClasses),
            mixins: createClassOptionsForLevel(prevLevel, "IMixinTest", baseOpts.mixins),
          }
        }

        for (let i = 1; i <= inheritanceLevel; ++i) {
          const schOpts: SchemaGenerationOptions = {
            schemaName: `SimpleSchema${i}`,
            version: "01.00.00",
            alias: `sch${i}`,
            ...createSchemaOptionsForLevel(i-1, testOpts), 
          };
          schemaFileNames.push(...createSchemaFromOptions(schOpts));
        }

        const options: SchemaGenerationOptions = {
          ...defaultOptions,
          ...createSchemaOptionsForLevel(inheritanceLevel, testOpts),
        };
        schemaFileNames.push(...createSchemaFromOptions(options));

        const imodel = StandaloneDb.openFile(snapshotFile, OpenMode.ReadWrite);
        try {
          await imodel.importSchemas(schemaFileNames);
          imodel.saveChanges();

          const schemaContext = new SchemaContext();
          const locater = new IModelIncrementalSchemaLocater(imodel, { useMultipleQueries: true });
          schemaContext.addLocater(locater);

          const { schema, stubsTime, totalTime } = await waitSchemaLoading(schemaContext, testSchemaKey);
          assert.isDefined(schema);

          const configTotals = getConfigTotals(options);
          const schemaTotals = await getSchemaTotals(schema);
          assert.deepEqual(configTotals, schemaTotals);

          reporter.addEntry(testSuite, "IncreaseInheritance", "Stubs time", stubsTime, { inheritanceLevel, configTotals });
          reporter.addEntry(testSuite, "IncreaseInheritance", "Total time", totalTime, { inheritanceLevel, configTotals });
        } finally {
          imodel.close();
        }
      });
    });
  });

  describe("Parallel Loading Tests", () => {
    configData.testCases.parallelLoading.level.forEach((schemaCount: number) => {
      it(`Gradually increase the number of parallel loading schemas (${schemaCount})`, async () => {
        const schemaFileNames: string[] = [];
        const schemaKeys: SchemaKey[] = [];

        const testOpts = configData.testCases.parallelLoading.options as SchemaGenerationOptions;
        // prepare schema files and keys
        for (let i = 1; i <= schemaCount; ++i) {
          const schemaKey = new SchemaKey(`TestSchema${i}`, ECVersion.fromString("01.00.00"));
          schemaKeys.push(schemaKey);

          const options: SchemaGenerationOptions = {
            ...testOpts,
            schemaName: schemaKey.name,
            version: schemaKey.version.toString(),
            alias: `ts${i}`,
          };
          options.referenceSchemas = [
            ...(defaultOptions.referenceSchemas ?? []),
            ...(testOpts.referenceSchemas ?? []),
          ];

          schemaFileNames.push(...createSchemaFromOptions(options));
        }

        const imodel = StandaloneDb.openFile(snapshotFile, OpenMode.ReadWrite);
        try {
          await imodel.importSchemas(schemaFileNames);
          imodel.saveChanges();

          const schemaContext = new SchemaContext();
          const locater = new IModelIncrementalSchemaLocater(imodel, { useMultipleQueries: true });
          schemaContext.addLocater(locater);

          // kick off parallel loads and measure
          const promises = schemaKeys.map(async (key) => waitSchemaLoading(schemaContext, key));
          const stopWatch = new StopWatch("", true);
          const results = await Promise.all(promises);
          const totalTime = stopWatch.stop().milliseconds;

          for (const result of results) {
            reporter.addEntry(testSuite, "IncreaseParallelSchemas", "Stubs time", result.stubsTime, { schemaName: result.schema?.fullName, schemaCount });
            reporter.addEntry(testSuite, "IncreaseParallelSchemas", "Total time", result.totalTime, { schemaName: result.schema?.fullName, schemaCount });
          }
          reporter.addEntry(testSuite, "IncreaseParallelSchemas", "Overall total time", totalTime, { schemaCount });
        } finally {
          imodel.close();
        }
      });
    });
  });
});
