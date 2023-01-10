/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { Id64, Id64String, using } from "@itwin/core-bentley";
import { IModelConnection, SnapshotConnection } from "@itwin/core-frontend";
import { ChildNodeSpecificationTypes, GroupingSpecificationTypes, KeySet, RegisteredRuleset, Ruleset, RuleTypes } from "@itwin/presentation-common";
import { createRandomId, createRandomTransientId, waitForAllAsyncs } from "@itwin/presentation-common/lib/cjs/test";
import { ViewportSelectionHandler } from "@itwin/presentation-components";
import { Presentation, TRANSIENT_ELEMENT_CLASSNAME } from "@itwin/presentation-frontend";
import { initialize, terminate } from "../IntegrationTests";
import { GeometricElement3d } from "@itwin/core-backend";
import { buildTestIModel, TestIModelBuilder } from "@itwin/presentation-testing";
import { BisCodeSpec, CategoryProps, Code, ElementProps, IModel, ModelProps, PhysicalElementProps, RelatedElement, RelatedElementProps } from "@itwin/core-common";

describe("Unified Selection", () => {

  let imodel: IModelConnection;

  before(async () => {
    await initialize();
    const testIModelName: string = "assets/datasets/Properties_60InstancesWithUrl2.ibim";
    imodel = await SnapshotConnection.openFile(testIModelName);
    expect(imodel).is.not.null;
  });

  after(async () => {
    await imodel.close();
    await terminate();
  });

  describe("Hiliting selection", () => {

    let handler: ViewportSelectionHandler;

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

    beforeEach(() => {
      Presentation.selection.clearSelection("", imodel);
      handler = new ViewportSelectionHandler({ imodel });

      // add something to selection set so we can check later
      // if the contents changed
      imodel.selectionSet.add(createRandomId());
    });

    afterEach(() => {
      handler.dispose();
    });

    it("hilites subject", async () => {
      Presentation.selection.addToSelection("", imodel, new KeySet([instances.subject.key]));
      await waitForAllAsyncs([handler, Presentation.selection.getToolSelectionSyncHandler(imodel)!]);
      expect(imodel.hilited.models.size).to.eq(instances.subject.nestedModelIds.length);
      instances.subject.nestedModelIds.forEach((id: Id64String) => expect(imodel.hilited.models.hasId(id)).to.be.true);
      expect(imodel.hilited.subcategories.isEmpty).to.be.true;
      expect(imodel.hilited.elements.isEmpty).to.be.true;
      expect(imodel.selectionSet.size).to.eq(0);
    });

    it("hilites model", async () => {
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
      Presentation.selection.addToSelection("", imodel, new KeySet([instances.category.key]));
      await waitForAllAsyncs([handler, Presentation.selection.getToolSelectionSyncHandler(imodel)!]);
      expect(imodel.hilited.models.isEmpty).to.be.true;
      expect(imodel.hilited.subcategories.size).to.eq(instances.category.subCategoryIds.length);
      instances.category.subCategoryIds.forEach((id: Id64String) => expect(imodel.hilited.subcategories.hasId(id)).to.be.true);
      expect(imodel.hilited.elements.isEmpty).to.be.true;
      expect(imodel.selectionSet.size).to.eq(0);
    });

    it("hilites subcategory", async () => {
      Presentation.selection.addToSelection("", imodel, new KeySet([instances.subcategory.key]));
      await waitForAllAsyncs([handler, Presentation.selection.getToolSelectionSyncHandler(imodel)!]);
      expect(imodel.hilited.models.isEmpty).to.be.true;
      expect(imodel.hilited.subcategories.size).to.eq(1);
      expect(imodel.hilited.subcategories.hasId(instances.subcategory.key.id)).to.be.true;
      expect(imodel.hilited.elements.isEmpty).to.be.true;
      expect(imodel.selectionSet.size).to.eq(0);
    });

    it("hilites assembly element", async () => {
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
      const addPartition = (classFullName: string, builder: TestIModelBuilder, name: string, parentId = IModel.rootSubjectId) => {
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

      const addModel = (classFullName: string, builder: TestIModelBuilder, partitionId: string) => {
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

      const objectIdArray = Array<Id64String>();
      let groupingNodesIModel: IModelConnection;
      beforeEach(async () => {
        groupingNodesIModel = await buildTestIModel("GroupByClass", (builder) => {
          const physicalPartitionId = addPartition("BisCore:PhysicalPartition", builder, "TestDrawingModel");
          const definitionPartitionId = addPartition("BisCore:DefinitionPartition", builder, "TestDefinitionModel");
          const physicalModelId = addModel("BisCore:PhysicalModel", builder, physicalPartitionId);
          const definitionModelId = addModel("BisCore:DefinitionModel", builder, definitionPartitionId);
          const categoryId = addSpatialCategory(builder, definitionModelId, "Test SpatialCategory");
          objectIdArray.push(addPhysicalObject(builder, physicalModelId, categoryId, new Code({ value: "code", scope: "0x1", spec: "0x1" })));
          objectIdArray.push(addPhysicalObject(builder, physicalModelId, categoryId, new Code({ value: "code", scope: "0x1", spec: "0x2" })));
          objectIdArray.push(addPhysicalObject(builder, physicalModelId, categoryId, new Code({ value: "code2", scope: "0x1", spec: "0x2" })));
        });

        Presentation.selection.clearSelection("", groupingNodesIModel);
        handler = new ViewportSelectionHandler({ imodel: groupingNodesIModel });
      });

      afterEach(async () => {
        await Presentation.presentation.rulesets().clear();
        objectIdArray.splice(0);
        await groupingNodesIModel.close();
        handler.dispose();
      });

      it("hilites grouping nodes grouped by class", async () => {
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

        await using<RegisteredRuleset, Promise<void>>(await Presentation.presentation.rulesets().add(groupByClassRuleset), async () => {
          const rootNodes = await Presentation.presentation.getNodes({ imodel: groupingNodesIModel, rulesetOrId: groupByClassRuleset.id });
          Presentation.selection.addToSelection("", groupingNodesIModel, [rootNodes[0].key]);
          await waitForAllAsyncs([handler, Presentation.selection.getToolSelectionSyncHandler(groupingNodesIModel)!]);
          expect(groupingNodesIModel.hilited.elements.size).to.be.equal(3);
          objectIdArray.forEach((id) => expect(groupingNodesIModel.hilited.elements.hasId(id)).to.be.true);
        });
      });

      it("hilites grouping nodes grouped by property", async () => {
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

        await using<RegisteredRuleset, Promise<void>>(await Presentation.presentation.rulesets().add(groupByPropertyRuleset), async () => {
          const rootNodes = await Presentation.presentation.getNodes({ imodel: groupingNodesIModel, rulesetOrId: groupByPropertyRuleset.id });
          Presentation.selection.addToSelection("", groupingNodesIModel, [rootNodes[0].key]);
          await waitForAllAsyncs([handler, Presentation.selection.getToolSelectionSyncHandler(groupingNodesIModel)!]);
          expect(groupingNodesIModel.hilited.elements.size).to.be.equal(2);
          expect(groupingNodesIModel.hilited.elements.hasId(objectIdArray[0])).to.be.true;
          expect(groupingNodesIModel.hilited.elements.hasId(objectIdArray[1])).to.be.true;

          Presentation.selection.replaceSelection("", groupingNodesIModel, [rootNodes[1].key]);
          await waitForAllAsyncs([handler, Presentation.selection.getToolSelectionSyncHandler(groupingNodesIModel)!]);
          expect(groupingNodesIModel.hilited.elements.size).to.be.equal(1);
          expect(groupingNodesIModel.hilited.elements.hasId(objectIdArray[2])).to.be.true;
        });
      });

      it.skip("hilites grouping nodes grouped by label", async () => {
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

        await using<RegisteredRuleset, Promise<void>>(await Presentation.presentation.rulesets().add(groupByLabelRuleset), async () => {
          const rootNodes = await Presentation.presentation.getNodes({ imodel: groupingNodesIModel, rulesetOrId: groupByLabelRuleset.id });
          Presentation.selection.addToSelection("", groupingNodesIModel, [rootNodes[0].key]);
          await waitForAllAsyncs([handler, Presentation.selection.getToolSelectionSyncHandler(groupingNodesIModel)!]);
          expect(groupingNodesIModel.hilited.elements.size).to.be.equal(2);
          expect(groupingNodesIModel.hilited.elements.hasId(objectIdArray[0])).to.be.true;
          expect(groupingNodesIModel.hilited.elements.hasId(objectIdArray[1])).to.be.true;

          Presentation.selection.replaceSelection("", groupingNodesIModel, [rootNodes[1].key]);
          await waitForAllAsyncs([handler, Presentation.selection.getToolSelectionSyncHandler(groupingNodesIModel)!]);
          expect(groupingNodesIModel.hilited.elements.size).to.be.equal(1);
          expect(groupingNodesIModel.hilited.elements.hasId(objectIdArray[2])).to.be.true;
        });
      });
    });
  });

});
