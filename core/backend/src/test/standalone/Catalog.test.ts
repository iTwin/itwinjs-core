/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { assert } from "chai";
import * as path from "path";
import { DbResult, Id64, Id64Set, Id64String, Logger, LogLevel } from "@bentley/bentleyjs-core";
import { Cone, Point3d, Range3d, Vector3d, YawPitchRollAngles } from "@bentley/geometry-core";
import {
  Code, CodeScopeSpec, GeometryStreamBuilder, GeometryStreamProps, IModel, PhysicalElementProps, Placement3d, RepositoryLinkProps,
  SubCategoryAppearance,
} from "@bentley/imodeljs-common";
import {
  BackendLoggerCategory, BackendRequestContext, DefinitionContainer, DefinitionModel, ECSqlStatement, Element, EntityClassType, IModelDb, IModelJsFs,
  IModelTransformer, LinkElement, PhysicalElement, PhysicalElementIsOfType, PhysicalModel, PhysicalType, RecipeDefinitionElement, RepositoryLink,
  SnapshotDb, SpatialCategory, TemplateModelCloner, TemplateRecipe3d, TypeDefinitionElement,
} from "../../imodeljs-backend";
import { IModelTestUtils } from "../IModelTestUtils";
import { KnownTestLocations } from "../KnownTestLocations";

/** Structure of a Catalog
 * - As with *normal* iModels, the CodeValue of the root Subject is the name of this catalog.
 * - It is expected that a catalog will import the same domain schemas that a domain application would.
 * - A catalog must contain one or more DefinitionContainers (one per product line).
 * - A DefinitionContainer (inserted into the dictionary model) and its DefinitionModel sub-model should contain:
 *   - All TypeDefinitions (properties that vary by Type, not by instance)
 *   - All template recipes (The elements in the recipe's sub-model is what will be cloned when placing an instance)
 *   - All prerequisite definitions (categories, GeometryParts, etc.) used by the template recipes
 *   - No elements directly in the DefinitionContainer or in a template recipe sub-model should refer to any elements outside of the DefinitionContainer
 *
 * @note Standard IModelExporter exclusion techniques (exclude* methods or shouldExport overrides) can be used to filter out template recipes and TypeDefinitions for a partial import.
 * However, all other DefinitionElements (categories, GeometryParts, etc.) directly in the DefinitionContainer should be imported if any template recipe is imported since elements
 * in the template recipe sub-models may reference those definitions.
 *
 * @note Each catalog creator should create their own CodeSpec for DefinitionContainers with a prefix/namespace that ensures uniqueness.
 *
 * @note Standard domain categories are supported by finding in the catalog by name using the DefinitionContainer scope and remapping to the standard domain category known by the application.
 */

/** This function mocks a Catalog Connector that reads ACME Equipment product data and outputs a catalog of components. */
async function createAcmeCatalog(dbFile: string): Promise<void> {
  const db = SnapshotDb.createEmpty(dbFile, { rootSubject: { name: "ACME Equipment" }, createClassViews: true });
  const domainSchemaFilePath = path.join(KnownTestLocations.assetsDir, "TestDomain.ecschema.xml");
  await db.importSchemas(new BackendRequestContext(), [domainSchemaFilePath]);
  const manufacturerName = "ACME";
  const productLineName = `${manufacturerName} Product Line A`;
  const containerCodeSpecId = db.codeSpecs.insert("ACME:Equipment", CodeScopeSpec.Type.Repository); // A catalog creator should insert their own CodeSpec for DefinitionContainers
  const containerCode = createContainerCode(containerCodeSpecId, productLineName);
  const containerId = DefinitionContainer.insert(db, IModel.dictionaryId, containerCode); // This sample has a DefinitionContainer per product line
  const categoryId = SpatialCategory.insert(db, containerId, "Equipment", new SubCategoryAppearance()); // "Equipment" is the name of a standard domain category in this sample

  const series1 = insertAcmeEquipmentRecipe(db, containerId, categoryId, 1); // a template recipe can be referenced by more than one PhysicalType
  const series2 = insertAcmeEquipmentRecipe(db, containerId, categoryId, 2);
  const series3 = insertAcmeEquipmentRecipe(db, containerId, categoryId, 3);
  insertEquipmentType(db, containerId, "A-101", series1, manufacturerName, productLineName);
  insertEquipmentType(db, containerId, "A-102", series1, manufacturerName, productLineName);
  insertEquipmentType(db, containerId, "A-201", series2, manufacturerName, productLineName);
  insertEquipmentType(db, containerId, "A-202", series2, manufacturerName, productLineName);
  insertEquipmentType(db, containerId, "A-203", series2, manufacturerName, productLineName);
  insertEquipmentType(db, containerId, "A-301", series3, manufacturerName, productLineName);

  db.saveChanges();
  db.close();
}

/** This function mocks a Catalog Connector that reads Best Equipment product data and outputs a catalog of components. */
async function createBestCatalog(dbFile: string): Promise<void> {
  const db = SnapshotDb.createEmpty(dbFile, { rootSubject: { name: "Best Equipment" } });
  const domainSchemaFilePath = path.join(KnownTestLocations.assetsDir, "TestDomain.ecschema.xml");
  await db.importSchemas(new BackendRequestContext(), [domainSchemaFilePath]);
  const manufacturerName = "Best";
  const productLineName = `${manufacturerName} Product Line B`;
  const containerCodeSpecId = db.codeSpecs.insert("Best:Equipment", CodeScopeSpec.Type.Repository);
  const containerCode = createContainerCode(containerCodeSpecId, productLineName);
  const containerId = DefinitionContainer.insert(db, IModel.dictionaryId, containerCode);
  const categoryId = SpatialCategory.insert(db, containerId, "Equipment", new SubCategoryAppearance());
  const series2 = insertBestEquipmentRecipe(db, containerId, categoryId, 2);
  const series3 = insertBestEquipmentRecipe(db, containerId, categoryId, 3);
  insertEquipmentType(db, containerId, "B-201", series2, manufacturerName, productLineName);
  insertEquipmentType(db, containerId, "B-202", series2, manufacturerName, productLineName);
  insertEquipmentType(db, containerId, "B-301", series3, manufacturerName, productLineName);
  insertEquipmentType(db, containerId, "B-302", series3, manufacturerName, productLineName);
  insertEquipmentType(db, containerId, "B-303", series3, manufacturerName, productLineName);
  insertEquipmentType(db, containerId, "B-304", series3, manufacturerName, productLineName);

  db.saveChanges();
  db.close();
}

/** Mock how Component Center would index a catalog by writing out the hierarchy of the catalog as a markdown file.
 * @note A real implementation for Component Center would probably write the relevant data out to JSON instead.
*/
function indexCatalog(db: IModelDb, outputFile: string): void {
  IModelJsFs.writeFileSync(outputFile, `# ${db.rootSubject.name}\n`);
  if (db.rootSubject.description) {
    IModelJsFs.appendFileSync(outputFile, `${db.rootSubject.description}\n`);
  }
  const containerIds = queryContainerIds(db);
  for (const containerId of containerIds) {
    const container = db.elements.getElement<DefinitionContainer>(containerId, DefinitionContainer);
    IModelJsFs.appendFileSync(outputFile, `## ${container.code.value}\n`);
    const templateRecipeIds = queryTemplateRecipeIds(db, containerId);
    for (const templateRecipeId of templateRecipeIds) {
      const templateRecipe = db.elements.getElement<RecipeDefinitionElement>(templateRecipeId, RecipeDefinitionElement);
      IModelJsFs.appendFileSync(outputFile, `### ${templateRecipe.code.value}\n`);
      const typeDefinitionIds = queryTypeDefinitionIds(db, templateRecipeId);
      for (const typeDefinitionId of typeDefinitionIds) {
        const typeDefinition = db.elements.getElement<TypeDefinitionElement>(typeDefinitionId, TypeDefinitionElement);
        IModelJsFs.appendFileSync(outputFile, `- ${typeDefinition.code.value}\n`);
        // NOTE: you have the TypeDefinitionElement instance here, you could also write out its property values
      }
    }
  }
}

/** Mocks the creation of a template recipe that would be the responsibility of a Catalog Connector.
 * @note This sample creates a single element in the template model, but 1-N elements are supported.
 */
function insertAcmeEquipmentRecipe(db: IModelDb, modelId: Id64String, categoryId: Id64String, seriesNumber: number): Id64String {
  const templateCodeValue = `A-${seriesNumber} Series`;
  const templateId = TemplateRecipe3d.insert(db, modelId, templateCodeValue);
  const equipmentProps: PhysicalElementProps = {
    classFullName: "TestDomain:Equipment",
    model: templateId,
    category: categoryId,
    code: Code.createEmpty(),
    userLabel: templateCodeValue,
    placement: { origin: Point3d.createZero(), angles: { yaw: 0, pitch: 0, roll: 0 } },
    geom: createCylinder(seriesNumber),
  };
  db.elements.insertElement(equipmentProps);
  return templateId;
}

/** Mocks the creation of a template recipe that would be the responsibility of a Catalog Connector.
 * @note This sample creates a single element in the template model, but 1-N elements are supported.
 */
function insertBestEquipmentRecipe(db: IModelDb, modelId: Id64String, categoryId: Id64String, seriesNumber: number): Id64String {
  const templateCodeValue = `B-${seriesNumber} Series`;
  const templateId = TemplateRecipe3d.insert(db, modelId, templateCodeValue);
  const equipmentProps: PhysicalElementProps = {
    classFullName: "TestDomain:Equipment",
    model: templateId,
    category: categoryId,
    code: Code.createEmpty(),
    userLabel: templateCodeValue,
    placement: { origin: Point3d.createZero(), angles: { yaw: 0, pitch: 0, roll: 0 } },
    geom: createCylinder(seriesNumber),
  };
  db.elements.insertElement(equipmentProps);
  return templateId;
}

/** Mocks geometry creation that would be the responsibility of a Catalog Connector. */
function createCylinder(radius: number): GeometryStreamProps {
  const pointA = Point3d.create(0, 0, 0);
  const pointB = Point3d.create(0, 0, 2 * radius);
  const cylinder = Cone.createBaseAndTarget(pointA, pointB, Vector3d.unitX(), Vector3d.unitY(), radius, radius, true);
  const geometryStreamBuilder = new GeometryStreamBuilder();
  geometryStreamBuilder.appendGeometry(cylinder);
  return geometryStreamBuilder.geometryStream;
}

function createContainerCode(codeSpecId: Id64String, codeValue: string): Code {
  return new Code({
    spec: codeSpecId,
    scope: IModel.rootSubjectId, // the scope is always rootSubjectId for CodeScopeSpec.Type.Repository
    value: codeValue,
  });
}

/** Query for catalog-related DefinitionContainers.
 * @note The convention is to insert the catalog DefinitionContainer elements into the DictionaryModel, so this method only looks there.
 */
function queryContainerIds(db: IModelDb): Id64Set {
  const sql = `SELECT ECInstanceId FROM ${DefinitionContainer.classFullName} WHERE Model.Id=:modelId`;
  const containerIds = new Set<Id64String>();
  db.withPreparedStatement(sql, (statement: ECSqlStatement): void => {
    statement.bindId("modelId", IModel.dictionaryId);
    while (DbResult.BE_SQLITE_ROW === statement.step()) {
      containerIds.add(statement.getValue(0).getId());
    }
  });
  return containerIds;
}

/** This mocks the concept of a standard domain category. */
function queryEquipmentCategory(db: IModelDb, modelId: Id64String): Id64String | undefined {
  const code = SpatialCategory.createCode(db, modelId, "Equipment");
  return db.elements.queryElementIdByCode(code);
}

/** This mocks a domain-specific subclass of PhysicalType that would be defined by an aligned domain schema. */
function insertEquipmentType(db: IModelDb, modelId: Id64String, codeValue: string, recipeId: Id64String, manufacturerName: string, productLineName: string): Id64String {
  const equipmentTypeProps = {
    classFullName: "TestDomain:EquipmentType",
    model: modelId,
    code: createEquipmentTypeCode(db, modelId, codeValue),
    recipe: { id: recipeId, relClassName: "BisCore:PhysicalTypeHasTemplateRecipe" },
    manufacturerName,
    productLineName,
  };
  return db.elements.insertElement(equipmentTypeProps);
}

function createEquipmentTypeCode(db: IModelDb, modelId: Id64String, codeValue: string): Code {
  return PhysicalType.createCode(db, modelId, codeValue);
}

function queryEquipmentTypeId(db: IModelDb, modelId: Id64String, codeValue: string): Id64String | undefined {
  const code = createEquipmentTypeCode(db, modelId, codeValue);
  return db.elements.queryElementIdByCode(code);
}

/** Query for all TypeDefinitions that reference a particular template recipe. */
function queryTypeDefinitionIds(db: IModelDb, templateRecipeId: Id64String): Id64Set {
  const sql = `SELECT ECInstanceId FROM ${TypeDefinitionElement.classFullName} WHERE Recipe.Id=:templateRecipeId`;
  const typeDefinitionIds = new Set<Id64String>();
  db.withPreparedStatement(sql, (statement: ECSqlStatement): void => {
    statement.bindId("templateRecipeId", templateRecipeId);
    while (DbResult.BE_SQLITE_ROW === statement.step()) {
      typeDefinitionIds.add(statement.getValue(0).getId());
    }
  });
  return typeDefinitionIds;
}

/** Query for all template recipes in a particular model/container. */
function queryTemplateRecipeIds(db: IModelDb, containerId: Id64String): Id64Set {
  const sql = `SELECT ECInstanceId FROM ${RecipeDefinitionElement.classFullName} WHERE Model.Id=:modelId`;
  const templateRecipeIds = new Set<Id64String>();
  db.withPreparedStatement(sql, (statement: ECSqlStatement): void => {
    statement.bindId("modelId", containerId);
    while (DbResult.BE_SQLITE_ROW === statement.step()) {
      templateRecipeIds.add(statement.getValue(0).getId());
    }
  });
  return templateRecipeIds;
}

/** This mocks the concept of finding important/lead elements in the template recipe sub-model.
 * @note This is important for establishing relationships after placing cloned instances.
 */
function queryEquipmentId(db: IModelDb, templateModelId: Id64String): Id64String | undefined {
  const sql = `SELECT ECInstanceId FROM TestDomain:Equipment WHERE Model.Id=:modelId LIMIT 1`;
  return db.withPreparedStatement(sql, (statement: ECSqlStatement): Id64String | undefined => {
    statement.bindId("modelId", templateModelId);
    return DbResult.BE_SQLITE_ROW === statement.step() ? statement.getValue(0).getId() : undefined;
  });
}

/** Create a RepositoryLink for the catalog that will scope the provenance for elements imported from the catalog. */
function insertCatalogRepositoryLink(iModelDb: IModelDb, codeValue: string, url: string): Id64String {
  const code = LinkElement.createCode(iModelDb, IModel.repositoryModelId, codeValue);
  const repositoryLinkId = iModelDb.elements.queryElementIdByCode(code);
  if (undefined === repositoryLinkId) {
    const repositoryLinkProps: RepositoryLinkProps = {
      classFullName: RepositoryLink.classFullName,
      model: IModel.repositoryModelId,
      code,
      url,
      format: "Catalog", // WIP: need to standardize format names
    };
    return iModelDb.elements.insertElement(repositoryLinkProps);
  }
  return repositoryLinkId;
}

/** Specialization of IModelTransformer designed to import definitions from a catalog. */
class CatalogImporter extends IModelTransformer {
  private _targetStandardCategories: Map<string, Id64String>;

  /** Construct a new CatalogImporter.
   * @param sourceDb The catalog
   * @param targetDb The iModel to import into
   */
  public constructor(sourceDb: IModelDb, targetDb: IModelDb, targetScopeElementId: Id64String, targetStandardCategories: Map<string, Id64String>) {
    super(sourceDb, targetDb, { targetScopeElementId });
    this.importer.autoExtendProjectExtents = false;
    this._targetStandardCategories = targetStandardCategories;
  }
  public async importDefinitionContainers(): Promise<void> {
    const containerIds = queryContainerIds(this.sourceDb);
    for (const containerId of containerIds) {
      await this.importDefinitionContainer(containerId);
    }
  }
  public async importDefinitionContainer(sourceContainerId: Id64String): Promise<void> {
    const sourceContainer = this.sourceDb.elements.getElement<DefinitionContainer>(sourceContainerId, DefinitionContainer); // throw Error if not a DefinitionContainer
    const sourceContainerCodeSpec = this.sourceDb.codeSpecs.getById(sourceContainer.code.spec);
    let targetContainerId: Id64String | undefined;
    try {
      const targetContainerCodeSpec = this.targetDb.codeSpecs.getByName(sourceContainerCodeSpec.name);
      const targetContainerCode = new Code({
        spec: targetContainerCodeSpec.id,
        scope: IModel.dictionaryId,
        value: sourceContainer.code.value,
      });
      targetContainerId = this.targetDb.elements.queryElementIdByCode(targetContainerCode);
    } catch (error) {
      // catch NotFound error and continue
    }
    if (undefined === targetContainerId) {
      this._remapStandardCategories();
      await this.exporter.exportElement(sourceContainerId);
      return this.exporter.exportModel(sourceContainerId);
    }
  }
  private _remapStandardCategories(): void {
    if (this._targetStandardCategories.size === 0) {
      return;
    }
    const sql = `SELECT ECInstanceId,CodeValue FROM ${SpatialCategory.classFullName}`;
    this.sourceDb.withPreparedStatement(sql, (statement: ECSqlStatement): void => {
      while (DbResult.BE_SQLITE_ROW === statement.step()) {
        const sourceCategoryId = statement.getValue(0).getId();
        const sourceCategoryName = statement.getValue(1).getString();
        if (this._targetStandardCategories.has(sourceCategoryName)) {
          const targetCategoryId = this._targetStandardCategories.get(sourceCategoryName)!;
          this.context.remapElement(sourceCategoryId, targetCategoryId);
          this.importer.doNotUpdateElementIds.add(targetCategoryId);
        }
      }
    });
  }
}

/** Catalog test fixture */
describe.only("Catalog", () => {
  const outputDir = path.join(KnownTestLocations.outputDir, "Catalog");
  const acmeCatalogDbFile = IModelTestUtils.prepareOutputFile("Catalog", "AcmeEquipment.catalog"); // WIP: what file extension should catalogs have?
  const bestCatalogDbFile = IModelTestUtils.prepareOutputFile("Catalog", "BestEquipment.catalog"); // WIP: what file extension should catalogs have?

  before(async () => {
    if (!IModelJsFs.existsSync(KnownTestLocations.outputDir)) {
      IModelJsFs.mkdirSync(KnownTestLocations.outputDir);
    }
    if (!IModelJsFs.existsSync(outputDir)) {
      IModelJsFs.mkdirSync(outputDir);
    }
    if (false) { // optionally initialize logging
      Logger.initializeToConsole();
      Logger.setLevelDefault(LogLevel.Error);
      Logger.setLevel(BackendLoggerCategory.IModelExporter, LogLevel.Trace);
      Logger.setLevel(BackendLoggerCategory.IModelImporter, LogLevel.Trace);
      Logger.setLevel(BackendLoggerCategory.IModelTransformer, LogLevel.Trace);
    }
    await createAcmeCatalog(acmeCatalogDbFile);
    await createBestCatalog(bestCatalogDbFile);
  });

  it("should index catalog", async () => {
    const acmeCatalogDb = SnapshotDb.openFile(acmeCatalogDbFile);
    indexCatalog(acmeCatalogDb, `${acmeCatalogDb.pathName}.md`);
    acmeCatalogDb.close();

    const bestCatalogDb = SnapshotDb.openFile(bestCatalogDbFile);
    indexCatalog(bestCatalogDb, `${bestCatalogDb.pathName}.md`);
    bestCatalogDb.close();
  });

  it("should import from catalog", async () => {
    const iModelFile = IModelTestUtils.prepareOutputFile("Catalog", "Facility.bim");
    const iModelDb = SnapshotDb.createEmpty(iModelFile, { rootSubject: { name: "Facility" }, createClassViews: true });
    const domainSchemaFilePath = path.join(KnownTestLocations.assetsDir, "TestDomain.ecschema.xml");
    await iModelDb.importSchemas(new BackendRequestContext(), [domainSchemaFilePath]);
    const physicalModelId = PhysicalModel.insert(iModelDb, IModel.rootSubjectId, "Physical");
    const categoryId = SpatialCategory.insert(iModelDb, IModel.dictionaryId, "Equipment", new SubCategoryAppearance());
    const standardCategories = new Map<string, Id64String>();
    standardCategories.set("Equipment", categoryId);

    // import catalog
    const catalogDb = SnapshotDb.openFile(acmeCatalogDbFile);
    const catalogRepositoryLinkId = insertCatalogRepositoryLink(iModelDb, path.basename(acmeCatalogDbFile), acmeCatalogDbFile);
    const catalogImporter = new CatalogImporter(catalogDb, iModelDb, catalogRepositoryLinkId, standardCategories);
    await catalogImporter.importDefinitionContainers();
    catalogImporter.dispose();
    catalogDb.close();

    // assert catalog was imported properly
    const containerIds = queryContainerIds(iModelDb);
    assert.equal(containerIds.size, 1);
    for (const containerId of containerIds) {
      // assert that the catalog was imported correctly
      iModelDb.elements.getElement<DefinitionContainer>(containerId, DefinitionContainer);
      iModelDb.models.getModel<DefinitionModel>(containerId, DefinitionModel);
      assert.isUndefined(queryEquipmentCategory(iModelDb, containerId), "Expected category to be remapped");
      assert.isTrue(Id64.isValidId64(queryEquipmentCategory(iModelDb, IModel.dictionaryId)!));
      assert.isTrue(Id64.isValidId64(queryEquipmentTypeId(iModelDb, containerId, "A-101")!));
      assert.isTrue(Id64.isValidId64(queryEquipmentTypeId(iModelDb, containerId, "A-201")!));
      assert.isTrue(Id64.isValidId64(queryEquipmentTypeId(iModelDb, containerId, "A-301")!));
    }

    // iterate through the imported PhysicalTypes and place instances for each
    const componentPlacer = new TemplateModelCloner(iModelDb);
    const physicalTypeSql = `SELECT ECInstanceId FROM ${PhysicalType.classFullName}`;
    const physicalTypeIds = new Set<Id64String>();
    iModelDb.withPreparedStatement(physicalTypeSql, (statement: ECSqlStatement): void => {
      while (DbResult.BE_SQLITE_ROW === statement.step()) {
        physicalTypeIds.add(statement.getValue(0).getId());
      }
    });
    let x = 0;
    for (const physicalTypeId of physicalTypeIds) {
      x += 5;
      const physicalType = iModelDb.elements.getElement<PhysicalType>(physicalTypeId, PhysicalType);
      if (physicalType.recipe?.id) {
        iModelDb.elements.getElement<TemplateRecipe3d>(physicalType.recipe.id, TemplateRecipe3d);
        const placement = new Placement3d(new Point3d(x, 0), new YawPitchRollAngles(), new Range3d());
        const templateToInstanceMap = await componentPlacer.placeTemplate3d(physicalType.recipe.id, physicalModelId, placement);
        const templateEquipmentId = queryEquipmentId(iModelDb, physicalType.recipe.id);
        if (templateEquipmentId) {
          const instanceEquipmentId = templateToInstanceMap.get(templateEquipmentId);
          const equipmentClass = iModelDb.getJsClass("TestDomain:Equipment") as unknown as EntityClassType<Element>;
          const equipment = iModelDb.elements.getElement<PhysicalElement>(instanceEquipmentId!, equipmentClass);
          equipment.typeDefinition = new PhysicalElementIsOfType(physicalTypeId);
          equipment.update();
          assert.isDefined(equipment.typeDefinition?.id);
        }
      }
    }
    componentPlacer.dispose();

    iModelDb.saveChanges();
    iModelDb.close();
  });

  /** Verifies that a "catalog.bim" can be completely cloned.
   * @note This serves as a good test, but not sure if this will actually be useful in production.
   */
  it("should clone catalog", async () => {
    const sourceDb = SnapshotDb.openFile(acmeCatalogDbFile);
    const targetFile = IModelTestUtils.prepareOutputFile("Catalog", "CloneOfAcmeEquipment.bim");
    const targetDb = SnapshotDb.createEmpty(targetFile, { rootSubject: { name: "Facility" }, createClassViews: true });
    const cloner = new IModelTransformer(sourceDb, targetDb);
    cloner.importer.autoExtendProjectExtents = false; // WIP: how should a catalog handle projectExtents?
    await cloner.processSchemas(new BackendRequestContext());
    await cloner.processAll();
    cloner.dispose();

    const containerIds = queryContainerIds(targetDb);
    assert.equal(containerIds.size, 1);
    containerIds.forEach((containerId) => {
      // assert that the cloned target contains the expected elements
      targetDb.elements.getElement<DefinitionContainer>(containerId, DefinitionContainer);
      targetDb.models.getModel<DefinitionModel>(containerId, DefinitionModel);
      assert.isTrue(Id64.isValidId64(queryEquipmentCategory(targetDb, containerId)!));
      assert.isTrue(Id64.isValidId64(queryEquipmentTypeId(targetDb, containerId, "A-101")!));
      assert.isTrue(Id64.isValidId64(queryEquipmentTypeId(targetDb, containerId, "A-201")!));
      assert.isTrue(Id64.isValidId64(queryEquipmentTypeId(targetDb, containerId, "A-301")!));
    });

    sourceDb.close();
    targetDb.saveChanges();
    targetDb.close();
  });
});
