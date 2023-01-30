/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { Id64, Id64String } from "@itwin/core-bentley";
import { IModelConnection, SnapshotConnection } from "@itwin/core-frontend";
import { ChildNodeSpecificationTypes, GroupingSpecificationTypes, KeySet, Ruleset, RuleTypes } from "@itwin/presentation-common";
import { createRandomId, createRandomTransientId, waitForAllAsyncs } from "@itwin/presentation-common/lib/cjs/test";
import { ViewportSelectionHandler } from "@itwin/presentation-components";
import { Presentation, TRANSIENT_ELEMENT_CLASSNAME } from "@itwin/presentation-frontend";
import { initialize, terminate } from "../IntegrationTests";
import { GeometricElement3d } from "@itwin/core-backend";
import { buildTestIModel, TestIModelBuilder } from "@itwin/presentation-testing";
import { BisCodeSpec, CategoryProps, Code, ElementProps, IModel, ModelProps, PhysicalElementProps, RelatedElement, RelatedElementProps } from "@itwin/core-common";

describe("Unified Selection", () => {

  const addPartition = (builder: TestIModelBuilder, classFullName: string, name: string, parentId = IModel.rootSubjectId) => {
    const parentProps: RelatedElementProps = {
      relClassName: "BisCore:SubjectOwnsPartitionElements",
      id: parentId,
    };
    const partitionProps: ElementProps = {
      classFullName,
      model: IModel.repositoryModelId,
      parent: parentProps,
      code: builder.createCode(parentId, BisCodeSpec.informationPartitionElement, name),
    };
    return builder.insertElement(partitionProps);
  };

  const addModel = (builder: TestIModelBuilder, classFullName: string, partitionId: string) => {
    const modelProps: ModelProps = {
      modeledElement: new RelatedElement({ id: partitionId }),
      classFullName,
      isPrivate: false,
    };
    return builder.insertModel(modelProps);
  };

  const addSpatialCategory = (builder: TestIModelBuilder, modelId: string, name: string, isPrivate?: boolean) => {
    const spatialCategoryProps: CategoryProps = {
      classFullName: "BisCore:SpatialCategory",
      model: IModel.dictionaryId,
      code: builder.createCode(modelId, BisCodeSpec.spatialCategory, name),
      isPrivate,
    };
    return builder.insertElement(spatialCategoryProps);
  };

  const addPhysicalObject = (builder: TestIModelBuilder, modelId: string, categoryId: string, elemCode = Code.createEmpty()) => {
    const physicalObjectProps: PhysicalElementProps = {
      classFullName: "Generic:PhysicalObject",
      model: modelId,
      category: categoryId,
      code: elemCode,
    };
    return builder.insertElement(physicalObjectProps);
  };

  const testIModelName: string = "assets/datasets/Properties_60InstancesWithUrl2.ibim";
  let imodel: IModelConnection;
  let handler: ViewportSelectionHandler;

  before(async () => {
    await initialize();
  });

  after(async () => {
    await terminate();
  });

  const setupIModel = async (createIModel?: () => Promise<IModelConnection>) => {
    imodel = createIModel ? await createIModel() : await SnapshotConnection.openFile(testIModelName);
    expect(imodel).is.not.null;
    Presentation.selection.clearSelection("", imodel);

    // add something to selection set so we can check later
    // if the contents changed
    imodel.selectionSet.add(createRandomId());
    return imodel;
  };

  const setupHandler = () => new ViewportSelectionHandler({ imodel });

  afterEach(async () => {
    await imodel.close();
    handler.dispose();
  });

  describe("Hiliting selection", () => {

    const instances = {
      subject: {
        key: { className: "BisCore:Subject", id: Id64.fromLocalAndBriefcaseIds(1, 0) },
        nestedModelIds: [Id64.fromLocalAndBriefcaseIds(28, 0)],
      },
      model: {
        key: { className: "BisCore:PhysicalModel", id: Id64.fromLocalAndBriefcaseIds(28, 0) },
        nestedModelIds: [], // WIP: no nested models... need a better imodel
      },
      category: {
        key: { className: "BisCore:SpatialCategory", id: Id64.fromLocalAndBriefcaseIds(23, 0) },
        subCategoryIds: [Id64.fromLocalAndBriefcaseIds(24, 0)],
      },
      subcategory: {
        key: { className: "BisCore:SubCategory", id: Id64.fromLocalAndBriefcaseIds(24, 0) },
      },
      assemblyElement: {
        key: { className: "Generic:PhysicalObject", id: Id64.fromLocalAndBriefcaseIds(117, 0) },
        childElementIds: [], // WIP: no assemblies... need a better imodel
      },
      leafElement: {
        key: { className: "Generic:PhysicalObject", id: Id64.fromLocalAndBriefcaseIds(116, 0) },
      },
      transientElement: {
        key: { className: TRANSIENT_ELEMENT_CLASSNAME, id: createRandomTransientId() },
      },
    };

    it("hilites subject", async () => {
      imodel = await setupIModel();
      handler = setupHandler();

      Presentation.selection.addToSelection("", imodel, new KeySet([instances.subject.key]));
      await waitForAllAsyncs([handler, Presentation.selection.getToolSelectionSyncHandler(imodel)!]);
      expect(imodel.hilited.models.size).to.eq(instances.subject.nestedModelIds.length);
      instances.subject.nestedModelIds.forEach((id: Id64String) => expect(imodel.hilited.models.hasId(id)).to.be.true);
      expect(imodel.hilited.subcategories.isEmpty).to.be.true;
      expect(imodel.hilited.elements.isEmpty).to.be.true;
      expect(imodel.selectionSet.size).to.eq(0);
    });

    it("hilites model", async () => {
      imodel = await setupIModel();
      handler = setupHandler();

      Presentation.selection.addToSelection("", imodel, new KeySet([instances.model.key]));
      await waitForAllAsyncs([handler, Presentation.selection.getToolSelectionSyncHandler(imodel)!]);
      expect(imodel.hilited.models.size).to.eq(1 + instances.model.nestedModelIds.length);
      expect(imodel.hilited.models.hasId(instances.model.key.id)).to.be.true;
      instances.model.nestedModelIds.forEach((id: Id64String) => expect(imodel.hilited.models.hasId(id)).to.be.true);
      expect(imodel.hilited.subcategories.isEmpty).to.be.true;
      expect(imodel.hilited.elements.isEmpty).to.be.true;
      expect(imodel.selectionSet.size).to.eq(0);
    });

    it("hilites category", async () => {
      imodel = await setupIModel();
      handler = setupHandler();

      Presentation.selection.addToSelection("", imodel, new KeySet([instances.category.key]));
      await waitForAllAsyncs([handler, Presentation.selection.getToolSelectionSyncHandler(imodel)!]);
      expect(imodel.hilited.models.isEmpty).to.be.true;
      expect(imodel.hilited.subcategories.size).to.eq(instances.category.subCategoryIds.length);
      instances.category.subCategoryIds.forEach((id: Id64String) => expect(imodel.hilited.subcategories.hasId(id)).to.be.true);
      expect(imodel.hilited.elements.isEmpty).to.be.true;
      expect(imodel.selectionSet.size).to.eq(0);
    });

    it("hilites subcategory", async () => {
      imodel = await setupIModel();
      handler = setupHandler();

      Presentation.selection.addToSelection("", imodel, new KeySet([instances.subcategory.key]));
      await waitForAllAsyncs([handler, Presentation.selection.getToolSelectionSyncHandler(imodel)!]);
      expect(imodel.hilited.models.isEmpty).to.be.true;
      expect(imodel.hilited.subcategories.size).to.eq(1);
      expect(imodel.hilited.subcategories.hasId(instances.subcategory.key.id)).to.be.true;
      expect(imodel.hilited.elements.isEmpty).to.be.true;
      expect(imodel.selectionSet.size).to.eq(0);
    });

    it("hilites assembly element", async () => {
      imodel = await setupIModel();
      handler = setupHandler();

      Presentation.selection.addToSelection("", imodel, new KeySet([instances.assemblyElement.key]));
      await waitForAllAsyncs([handler, Presentation.selection.getToolSelectionSyncHandler(imodel)!]);
      expect(imodel.hilited.models.isEmpty).to.be.true;
      expect(imodel.hilited.subcategories.isEmpty).to.be.true;
      expect(imodel.hilited.elements.size).to.eq(1 + instances.assemblyElement.childElementIds.length);
      expect(imodel.hilited.elements.hasId(instances.assemblyElement.key.id)).to.be.true;
      instances.assemblyElement.childElementIds.forEach((id: Id64String) => expect(imodel.hilited.elements.hasId(id)).to.be.true);
      expect(imodel.selectionSet.size).to.eq(1 + instances.assemblyElement.childElementIds.length);
      expect(imodel.selectionSet.has(instances.assemblyElement.key.id)).to.be.true;
      instances.assemblyElement.childElementIds.forEach((id: Id64String) => expect(imodel.selectionSet.has(id)).to.be.true);
    });

    it("hilites leaf element", async () => {
      imodel = await setupIModel();
      handler = setupHandler();

      Presentation.selection.addToSelection("", imodel, new KeySet([instances.leafElement.key]));
      await waitForAllAsyncs([handler, Presentation.selection.getToolSelectionSyncHandler(imodel)!]);
      expect(imodel.hilited.models.isEmpty).to.be.true;
      expect(imodel.hilited.subcategories.isEmpty).to.be.true;
      expect(imodel.hilited.elements.size).to.eq(1);
      expect(imodel.hilited.elements.hasId(instances.leafElement.key.id)).to.be.true;
      expect(imodel.selectionSet.size).to.eq(1);
      expect(imodel.selectionSet.has(instances.leafElement.key.id)).to.be.true;
    });

    it("hilites transient element", async () => {
      imodel = await setupIModel();
      handler = setupHandler();

      Presentation.selection.addToSelection("", imodel, new KeySet([instances.transientElement.key]));
      await waitForAllAsyncs([handler, Presentation.selection.getToolSelectionSyncHandler(imodel)!]);
      expect(imodel.hilited.models.isEmpty).to.be.true;
      expect(imodel.hilited.subcategories.isEmpty).to.be.true;
      expect(imodel.hilited.elements.size).to.eq(1);
      expect(imodel.hilited.elements.hasId(instances.transientElement.key.id)).to.be.true;
      expect(imodel.selectionSet.size).to.eq(1);
      expect(imodel.selectionSet.has(instances.transientElement.key.id)).to.be.true;
    });

    it("hilites transient element after removing and adding it back", async () => {
      imodel = await setupIModel();
      handler = setupHandler();

      // set up the selection to contain a transient element
      Presentation.selection.addToSelection("", imodel, new KeySet([instances.transientElement.key]));
      await waitForAllAsyncs([handler, Presentation.selection.getToolSelectionSyncHandler(imodel)!]);
      expect(imodel.selectionSet.size).to.eq(1);
      expect(Presentation.selection.getSelection(imodel).instanceKeysCount).to.eq(1);

      // remove and add back the transient element
      imodel.selectionSet.remove(instances.transientElement.key.id);
      imodel.selectionSet.replace(instances.transientElement.key.id);
      await waitForAllAsyncs([handler, Presentation.selection.getToolSelectionSyncHandler(imodel)!]);

      // expect the transient element to be both hilited and selected
      expect(imodel.hilited.models.isEmpty).to.be.true;
      expect(imodel.hilited.subcategories.isEmpty).to.be.true;
      expect(imodel.hilited.elements.size).to.eq(1);
      expect(imodel.hilited.elements.hasId(instances.transientElement.key.id)).to.be.true;
      expect(imodel.selectionSet.size).to.eq(1);
      expect(imodel.selectionSet.has(instances.transientElement.key.id)).to.be.true;
    });

    it("hilites after re-initializing Presentation", async () => {
      imodel = await setupIModel();
      handler = setupHandler();

      handler.dispose();
      Presentation.terminate();
      await Presentation.initialize();
      handler = new ViewportSelectionHandler({ imodel });

      Presentation.selection.addToSelection("", imodel, new KeySet([instances.leafElement.key]));
      await waitForAllAsyncs([handler, Presentation.selection.getToolSelectionSyncHandler(imodel)!]);
      expect(imodel.hilited.models.isEmpty).to.be.true;
      expect(imodel.hilited.subcategories.isEmpty).to.be.true;
      expect(imodel.hilited.elements.size).to.eq(1);
      expect(imodel.hilited.elements.hasId(instances.leafElement.key.id)).to.be.true;
      expect(imodel.selectionSet.size).to.eq(1);
      expect(imodel.selectionSet.has(instances.leafElement.key.id)).to.be.true;
    });

    describe("Grouping Node", () => {

      const physicalObjectIdArray = Array<Id64String>();

      afterEach(async () => {
        physicalObjectIdArray.splice(0);
      });

      it("hilites class grouping node elements", async () => {
        imodel = await setupIModel(async () => buildTestIModel("GroupByClass", (builder) => {
          const physicalPartitionId = addPartition(builder, "BisCore:PhysicalPartition", "TestPhysicalModel");
          const definitionPartitionId = addPartition(builder, "BisCore:DefinitionPartition", "TestDefinitionModel");
          const physicalModelId = addModel(builder, "BisCore:PhysicalModel", physicalPartitionId);
          const definitionModelId = addModel(builder, "BisCore:DefinitionModel", definitionPartitionId);
          const categoryId = addSpatialCategory(builder, definitionModelId, "Test SpatialCategory");
          physicalObjectIdArray.push(addPhysicalObject(builder, physicalModelId, categoryId, new Code({ value: "code", scope: "0x1", spec: "0x1" })));
          physicalObjectIdArray.push(addPhysicalObject(builder, physicalModelId, categoryId, new Code({ value: "code", scope: "0x1", spec: "0x2" })));
        }));
        handler = setupHandler();
        const groupByClassRuleset: Ruleset = {
          id: "groupByClassRuleset",
          rules: [{
            ruleType: RuleTypes.RootNodes,
            specifications: [{
              specType: ChildNodeSpecificationTypes.InstanceNodesOfSpecificClasses,
              classes: { schemaName: "BisCore", classNames: [GeometricElement3d.className] },
              arePolymorphic: true,
              instanceFilter: "this.Parent = NULL",
              groupByClass: true,
              groupByLabel: false,
            }],
          }],
        };

        const rootNodes = await Presentation.presentation.getNodes({ imodel, rulesetOrId: groupByClassRuleset });
        Presentation.selection.addToSelection("", imodel, [rootNodes[0].key]);
        await waitForAllAsyncs([handler, Presentation.selection.getToolSelectionSyncHandler(imodel)!]);
        expect(imodel.hilited.elements.size).to.be.equal(2);
        physicalObjectIdArray.forEach((id) => expect(imodel.hilited.elements.hasId(id)).to.be.true);
      });

      it("hilites property grouping node elements", async () => {
        imodel = await setupIModel(async () => buildTestIModel("GroupByClass", (builder) => {
          const physicalPartitionId = addPartition(builder, "BisCore:PhysicalPartition", "TestPhysicalModel");
          const definitionPartitionId = addPartition(builder, "BisCore:DefinitionPartition", "TestDefinitionModel");
          const physicalModelId = addModel(builder, "BisCore:PhysicalModel", physicalPartitionId);
          const definitionModelId = addModel(builder, "BisCore:DefinitionModel", definitionPartitionId);
          const categoryId = addSpatialCategory(builder, definitionModelId, "Test SpatialCategory");
          physicalObjectIdArray.push(addPhysicalObject(builder, physicalModelId, categoryId, new Code({ value: "code", scope: "0x1", spec: "0x1" })));
          physicalObjectIdArray.push(addPhysicalObject(builder, physicalModelId, categoryId, new Code({ value: "code", scope: "0x1", spec: "0x2" })));
          physicalObjectIdArray.push(addPhysicalObject(builder, physicalModelId, categoryId, new Code({ value: "code2", scope: "0x1", spec: "0x2" })));
        }));
        handler = setupHandler();
        const groupByPropertyRuleset: Ruleset = {
          id: "groupByPropertyRuleset",
          rules: [{
            ruleType: RuleTypes.RootNodes,
            specifications: [{
              specType: ChildNodeSpecificationTypes.InstanceNodesOfSpecificClasses,
              classes: { schemaName: "BisCore", classNames: [GeometricElement3d.className] },
              arePolymorphic: true,
              instanceFilter: "this.Parent = NULL",
              groupByClass: false,
              groupByLabel: false,
            }],
            customizationRules: [{
              ruleType: RuleTypes.Grouping,
              class: { schemaName: "BisCore", className: GeometricElement3d.className },
              groups: [{
                specType: GroupingSpecificationTypes.Property,
                propertyName: "CodeValue",
                createGroupForSingleItem: true,
              }],
            }],
          }],
        };

        const rootNodes = await Presentation.presentation.getNodes({ imodel, rulesetOrId: groupByPropertyRuleset });
        Presentation.selection.addToSelection("", imodel, [rootNodes[0].key]);
        await waitForAllAsyncs([handler, Presentation.selection.getToolSelectionSyncHandler(imodel)!]);
        expect(imodel.hilited.elements.size).to.be.equal(2);
        expect(imodel.hilited.elements.hasId(physicalObjectIdArray[0])).to.be.true;
        expect(imodel.hilited.elements.hasId(physicalObjectIdArray[1])).to.be.true;

        Presentation.selection.replaceSelection("", imodel, [rootNodes[1].key]);
        await waitForAllAsyncs([handler, Presentation.selection.getToolSelectionSyncHandler(imodel)!]);
        expect(imodel.hilited.elements.size).to.be.equal(1);
        expect(imodel.hilited.elements.hasId(physicalObjectIdArray[2])).to.be.true;
      });

      // TODO: enable this test after resolving https://github.com/iTwin/itwinjs-backlog/issues/553
      it.skip("hilites label grouping node elements", async () => {
        imodel = await setupIModel(async () => buildTestIModel("GroupByClass", (builder) => {
          const physicalPartitionId = addPartition(builder, "BisCore:PhysicalPartition", "TestPhysicalModel");
          const definitionPartitionId = addPartition(builder, "BisCore:DefinitionPartition", "TestDefinitionModel");
          const physicalModelId = addModel(builder, "BisCore:PhysicalModel", physicalPartitionId);
          const definitionModelId = addModel(builder, "BisCore:DefinitionModel", definitionPartitionId);
          const categoryId = addSpatialCategory(builder, definitionModelId, "Test SpatialCategory");
          physicalObjectIdArray.push(addPhysicalObject(builder, physicalModelId, categoryId, new Code({ value: "code", scope: "0x1", spec: "0x1" })));
          physicalObjectIdArray.push(addPhysicalObject(builder, physicalModelId, categoryId, new Code({ value: "code", scope: "0x1", spec: "0x2" })));
        }));
        handler = setupHandler();
        const groupByLabelRuleset: Ruleset = {
          id: "groupByLabelRuleset",
          rules: [{
            ruleType: RuleTypes.RootNodes,
            specifications: [{
              specType: ChildNodeSpecificationTypes.InstanceNodesOfSpecificClasses,
              classes: { schemaName: "BisCore", classNames: [GeometricElement3d.className] },
              arePolymorphic: true,
              groupByClass: false,
              groupByLabel: true,
            }],
          }],
        };

        const rootNodes = await Presentation.presentation.getNodes({ imodel, rulesetOrId: groupByLabelRuleset });
        Presentation.selection.addToSelection("", imodel, [rootNodes[0].key]);
        await waitForAllAsyncs([handler, Presentation.selection.getToolSelectionSyncHandler(imodel)!]);
        expect(imodel.hilited.elements.size).to.be.equal(2);
        expect(imodel.hilited.elements.hasId(physicalObjectIdArray[0])).to.be.true;
        expect(imodel.hilited.elements.hasId(physicalObjectIdArray[1])).to.be.true;
      });
    });
  });

});
