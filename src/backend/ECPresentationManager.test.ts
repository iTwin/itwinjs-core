/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import * as moq from "typemoq";
import * as faker from "faker";
import { OpenMode, Id64 } from "@bentley/bentleyjs-core";
import { IModelToken } from "@bentley/imodeljs-common";
import { NativePlatformRegistry, IModelHost } from "@bentley/imodeljs-backend";
import { PageOptions, SelectionInfo, KeySet } from "@bentley/ecpresentation-common";
import { createDescriptorOverrides } from "@bentley/ecpresentation-common/lib/content/Descriptor";
import ECPresentationManager, { NodeAddonDefinition, NodeAddonRequestTypes } from "./ECPresentationManager";
import * as addonTypes from "./AddonResponses";
import { createRandomECInstanceNode, createRandomECInstanceNodeKey } from "../test-helpers/random/Hierarchy";
import { createRandomECInstanceKey } from "../test-helpers/random/EC";
import { createRandomDescriptor } from "../test-helpers/random/Content";
import { createRandomId } from "../test-helpers/random/Misc";

require("../test-helpers/Snapshots"); // tslint:disable-line:no-var-requires

describe("ECPresentationManager", () => {

  beforeEach(() => {
    IModelHost.shutdown();
  });

  it("uses default native library implementation if not overridden", () => {
    IModelHost.startup();
    const manager = new ECPresentationManager();
    expect(manager.getNativePlatform()).instanceOf(NativePlatformRegistry.getNativePlatform().NativeECPresentationManager);
  });

  it("uses addon implementation supplied through props", () => {
    const mock = moq.Mock.ofType<NodeAddonDefinition>();
    const manager = new ECPresentationManager({ addon: mock.object });
    expect(manager.getNativePlatform()).eq(mock.object);
  });

  describe("addon setup based on constructor props", () => {

    const addon = moq.Mock.ofType<NodeAddonDefinition>();
    beforeEach(() => {
      addon.reset();
    });

    it("sets up ruleset directories if supplied", () => {
      const dirs = ["test1", "test2"];
      addon.setup((x) => x.setupRulesetDirectories(dirs)).verifiable();
      new ECPresentationManager({ addon: addon.object, rulesetDirectories: dirs });
      addon.verifyAll();
    });

  });

  describe("addon results conversion to ECPresentation objects", () => {

    const testData = {
      imodelToken: new IModelToken("key path", false, "context id", "imodel id", "changeset id", OpenMode.Readonly, "user id"),
      pageOptions: { pageStart: 123, pageSize: 456 } as PageOptions,
      displayType: faker.random.word(),
      keys: (new KeySet([createRandomECInstanceNodeKey()])).add(createRandomECInstanceKey()),
      selectionInfo: {
        providerName: faker.random.word(),
        level: faker.random.number(),
      } as SelectionInfo,
      extendedOptions: {
        rulesetId: faker.random.word(),
        someOtherOption: faker.random.number(),
      },
    };

    const mock = moq.Mock.ofType<NodeAddonDefinition>();
    const manager = new ECPresentationManager({ addon: mock.object });
    beforeEach(() => {
      mock.reset();
      mock.setup((x) => x.getImodelAddon(testData.imodelToken)).verifiable(moq.Times.atLeastOnce());
    });
    afterEach(() => {
      mock.verifyAll();
    });

    const setup = (addonResponse: any) => {
      // mock the handleRequest function
      mock.setup((x) => x.handleRequest(moq.It.isAny(), moq.It.isAnyString())).returns(() => JSON.stringify(addonResponse));
    };
    const verify = (result: any, expectedParams: any) => {
      // verify the addon was called with correct params
      mock.verify((x) => x.handleRequest(moq.It.isAny(), JSON.stringify(expectedParams)), moq.Times.once());
      // verify the manager correctly used addonResponse to create its result
      expect(result).to.matchSnapshot();
    };

    it("returns root nodes", async () => {
      // what the addon receives
      const expectedParams = {
        requestId: NodeAddonRequestTypes.GetRootNodes,
        params: {
          pageOptions: testData.pageOptions,
          options: testData.extendedOptions,
        },
      };
      // what the addon returns
      const addonResponse: addonTypes.Node[] = [{
        NodeId: createRandomId().toString(),
        ParentNodeId: createRandomId().toString(),
        Key: {
          Type: "type1",
          PathFromRoot: ["p1", "p2", "p3"],
        } as addonTypes.NodeKey,
        Label: "test1",
        Description: "description1",
        ImageId: "img_1",
        ForeColor: "foreColor1",
        BackColor: "backColor1",
        FontStyle: "fontStyle1",
        HasChildren: true,
        IsSelectable: true,
        IsEditable: true,
        IsChecked: true,
        IsCheckboxVisible: true,
        IsCheckboxEnabled: true,
        IsExpanded: true,
      }, {
        NodeId: createRandomId().toString(),
        ParentNodeId: createRandomId().toString(),
        Key: {
          Type: "ECInstanceNode",
          PathFromRoot: ["p1"],
          ECClassId: createRandomId().toString(),
          ECInstanceId: createRandomId().toString(),
        } as addonTypes.ECInstanceNodeKey,
        Label: "test2",
        Description: "description2",
        ImageId: "",
        ForeColor: "",
        BackColor: "",
        FontStyle: "",
        HasChildren: false,
        IsSelectable: false,
        IsEditable: false,
        IsChecked: false,
        IsCheckboxVisible: false,
        IsCheckboxEnabled: false,
        IsExpanded: false,
      }, {
        NodeId: createRandomId().toString(),
        Key: {
          Type: "some node",
          PathFromRoot: ["p1", "p3"],
        } as addonTypes.NodeKey,
        Label: "test2",
      }];
      // test
      setup(addonResponse);
      const result = await manager.getRootNodes(testData.imodelToken, testData.pageOptions, testData.extendedOptions);
      verify(result, expectedParams);
    });

    it("returns root nodes count", async () => {
      // what the addon receives
      const expectedParams = {
        requestId: NodeAddonRequestTypes.GetRootNodesCount,
        params: {
          options: testData.extendedOptions,
        },
      };
      // what the addon returns
      const addonResponse = 456;
      // test
      setup(addonResponse);
      const result = await manager.getRootNodesCount(testData.imodelToken, testData.extendedOptions);
      verify(result, expectedParams);
    });

    it("returns child nodes", async () => {
      // what the addon receives
      const parentNode = createRandomECInstanceNode();
      const expectedParams = {
        requestId: NodeAddonRequestTypes.GetChildren,
        params: {
          nodeKey: parentNode.key,
          pageOptions: testData.pageOptions,
          options: testData.extendedOptions,
        },
      };
      // what the addon returns
      const addonResponse: addonTypes.Node[] = [{
        NodeId: createRandomId().toString(),
        ParentNodeId: createRandomId().toString(),
        Key: {
          Type: "type 1",
          PathFromRoot: ["p1"],
        } as addonTypes.ECInstanceNodeKey,
        Label: "test2",
      }, {
        NodeId: createRandomId().toString(),
        Key: {
          Type: "type 2",
          PathFromRoot: ["p1", "p3"],
        } as addonTypes.NodeKey,
        Label: "test3",
      }];
      // test
      setup(addonResponse);
      const result = await manager.getChildren(testData.imodelToken, parentNode, testData.pageOptions, testData.extendedOptions);
      verify(result, expectedParams);
    });

    it("returns child nodes count", async () => {
      // what the addon receives
      const parentNode = createRandomECInstanceNode();
      const expectedParams = {
        requestId: NodeAddonRequestTypes.GetChildrenCount,
        params: {
          nodeKey: parentNode.key,
          options: testData.extendedOptions,
        },
      };
      // what the addon returns
      const addonResponse = 789;
      // test
      setup(addonResponse);
      const result = await manager.getChildrenCount(testData.imodelToken, parentNode, testData.extendedOptions);
      verify(result, expectedParams);
    });

    it("returns content descriptor", async () => {
      // what the addon receives
      const expectedParams = {
        requestId: NodeAddonRequestTypes.GetContentDescriptor,
        params: {
          displayType: testData.displayType,
          keys: testData.keys,
          selection: testData.selectionInfo,
          options: testData.extendedOptions,
        },
      };
      // what the addon returns
      const createRandomClassInfo = (): addonTypes.ClassInfo => {
        return {
          Id: (new Id64([faker.random.number(), faker.random.number()])).toString(),
          Name: faker.random.word(),
          Label: faker.random.words(),
        };
      };
      const createRandomCategory = (): addonTypes.Category => {
        return {
          Name: faker.random.word(),
          DisplayLabel: faker.random.words(),
          Description: faker.random.words(),
          Expand: faker.random.boolean(),
          Priority: faker.random.number(),
        };
      };
      const addonResponse: addonTypes.Descriptor = {
        PreferredDisplayType: testData.displayType,
        SelectClasses: [{
          SelectClassInfo: createRandomClassInfo(),
          IsPolymorphic: true,
          PathToPrimaryClass: [{
            SourceClassInfo: createRandomClassInfo(),
            TargetClassInfo: createRandomClassInfo(),
            RelationshipInfo: createRandomClassInfo(),
            IsForwardRelationship: false,
            IsPolymorphicRelationship: true,
          }],
          RelatedPropertyPaths: [[{
            SourceClassInfo: createRandomClassInfo(),
            TargetClassInfo: createRandomClassInfo(),
            RelationshipInfo: createRandomClassInfo(),
            IsForwardRelationship: true,
            IsPolymorphicRelationship: false,
          }]],
        }],
        Fields: [{
          Name: "Primitive property field with editor",
          Category: createRandomCategory(),
          DisplayLabel: faker.random.words(),
          Type: {
            TypeName: "string",
            ValueFormat: "Primitive",
          },
          IsReadOnly: faker.random.boolean(),
          Priority: faker.random.number(),
          Editor: {
            Name: faker.random.word(),
            Params: {
              some_param: faker.random.number(),
            },
          },
          Properties: [{
            Property: {
              BaseClassInfo: createRandomClassInfo(),
              ActualClassInfo: createRandomClassInfo(),
              Name: faker.random.word(),
              Type: "string",
              Choices: [{
                Label: faker.random.words(),
                Value: faker.random.uuid(),
              }, {
                Label: faker.random.words(),
                Value: faker.random.uuid(),
              }],
              IsStrict: faker.random.boolean(),
            },
            RelatedClassPath: [],
          }],
        } as addonTypes.ECPropertiesField, {
          Name: "Complex array of structs property field",
          Category: createRandomCategory(),
          DisplayLabel: faker.random.words(),
          Type: {
            TypeName: "string[]",
            ValueFormat: "Array",
            MemberType: {
              TypeName: "SomeClass",
              ValueFormat: "Struct",
              Members: [{
                Name: faker.random.word(),
                Label: faker.random.words(),
                Type: {
                  TypeName: "string",
                  ValueFormat: "Primitive",
                },
              }, {
                Name: faker.random.word(),
                Label: faker.random.words(),
                Type: {
                  TypeName: "string[]",
                  ValueFormat: "Array",
                  MemberType: {
                    TypeName: "string",
                    ValueFormat: "Primitive",
                  },
                } as addonTypes.FieldArrayTypeDescription,
              }],
            } as addonTypes.FieldStructTypeDescription,
          } as addonTypes.FieldArrayTypeDescription,
          IsReadOnly: faker.random.boolean(),
          Priority: faker.random.number(),
          Properties: [{
            Property: {
              BaseClassInfo: createRandomClassInfo(),
              ActualClassInfo: createRandomClassInfo(),
              Name: faker.random.word(),
              Type: "double",
              KindOfQuantity: {
                Name: faker.random.word(),
                DisplayLabel: faker.random.words(),
                PersistenceUnit: faker.random.word(),
                CurrentFusId: faker.random.uuid(),
              },
            },
            RelatedClassPath: [],
          }],
        } as addonTypes.ECPropertiesField, {
          Name: "Nested content field",
          Category: createRandomCategory(),
          DisplayLabel: faker.random.words(),
          Type: {
            TypeName: faker.random.word(),
            ValueFormat: "Struct",
            Members: [{
              Name: faker.random.word(),
              Label: faker.random.words(),
              Type: {
                TypeName: "string",
                ValueFormat: "Primitive",
              },
            }],
          } as addonTypes.FieldStructTypeDescription,
          ContentClassInfo: createRandomClassInfo(),
          PathToPrimary: [{
            SourceClassInfo: createRandomClassInfo(),
            TargetClassInfo: createRandomClassInfo(),
            RelationshipInfo: createRandomClassInfo(),
            IsForwardRelationship: false,
            IsPolymorphicRelationship: true,
          }],
          NestedFields: [{
            Name: "Simple property field",
            Category: createRandomCategory(),
            DisplayLabel: faker.random.words(),
            Type: {
              TypeName: "string",
              ValueFormat: "Primitive",
            },
            IsReadOnly: faker.random.boolean(),
            Priority: faker.random.number(),
          }],
          IsReadOnly: faker.random.boolean(),
          Priority: faker.random.number(),
        } as addonTypes.NestedContentField],
        SortingFieldIndex: -1,
        SortDirection: 0,
        ContentFlags: 0,
        FilterExpression: "",
      };
      // test
      setup(addonResponse);
      const result = await manager.getContentDescriptor(testData.imodelToken, testData.displayType,
        testData.keys, testData.selectionInfo, testData.extendedOptions);
      verify(result, expectedParams);
    });

    it("returns content set size", async () => {
      // what the addon receives
      const descriptor = createRandomDescriptor();
      const expectedParams = {
        requestId: NodeAddonRequestTypes.GetContentSetSize,
        params: {
          keys: testData.keys,
          descriptorOverrides: createDescriptorOverrides(descriptor),
          options: testData.extendedOptions,
        },
      };
      // what the addon returns
      const addonResponse = faker.random.number();
      // test
      setup(addonResponse);
      const result = await manager.getContentSetSize(testData.imodelToken, descriptor,
        testData.keys, testData.extendedOptions);
      verify(result, expectedParams);
    });

    it("returns content", async () => {
    // what the addon receives
      const descriptor = createRandomDescriptor();
      const expectedParams = {
        requestId: NodeAddonRequestTypes.GetContent,
        params: {
          keys: testData.keys,
          descriptorOverrides: createDescriptorOverrides(descriptor),
          pageOptions: testData.pageOptions,
          options: testData.extendedOptions,
        },
      };
      // what the addon returns
      const createRandomClassInfo = (): addonTypes.ClassInfo => {
        return {
          Id: (new Id64([faker.random.number(), faker.random.number()])).toString(),
          Name: faker.random.word(),
          Label: faker.random.words(),
        };
      };
      const createRandomCategory = (): addonTypes.Category => {
        return {
          Name: faker.random.word(),
          DisplayLabel: faker.random.words(),
          Description: faker.random.words(),
          Expand: faker.random.boolean(),
          Priority: faker.random.number(),
        };
      };
      const fieldName = faker.random.word();
      const addonResponse = {
        Descriptor: {
          PreferredDisplayType: descriptor.displayType,
          SelectClasses: [{
            SelectClassInfo: createRandomClassInfo(),
            IsPolymorphic: true,
            PathToPrimaryClass: [],
            RelatedPropertyPaths: [],
          }],
          Fields: [{
            Name: fieldName,
            Category: createRandomCategory(),
            DisplayLabel: faker.random.words(),
            Type: {
              TypeName: "string",
              ValueFormat: "Primitive",
            },
            IsReadOnly: faker.random.boolean(),
            Priority: faker.random.number(),
            Properties: [{
              Property: {
                BaseClassInfo: createRandomClassInfo(),
                ActualClassInfo: createRandomClassInfo(),
                Name: faker.random.word(),
                Type: "string",
              },
              RelatedClassPath: [],
            }],
          } as addonTypes.ECPropertiesField],
          SortingFieldIndex: -1,
          SortDirection: 0,
          ContentFlags: 0,
          FilterExpression: "",
        },
        ContentSet: [{
          PrimaryKeys: [{ ECClassName: faker.random.word(), ECInstanceId: createRandomId().toString() }],
          ClassInfo: createRandomClassInfo(),
          DisplayLabel: faker.random.words(),
          ImageId: faker.random.uuid(),
          Values: {
            [fieldName]: faker.random.words(),
          },
          DisplayValues: {
            [fieldName]: faker.random.words(),
          },
          MergedFieldNames: [],
          FieldValueKeys: {},
        }],
      } as addonTypes.Content;
      // test
      setup(addonResponse);
      const result = await manager.getContent(testData.imodelToken, descriptor,
        testData.keys, testData.pageOptions, testData.extendedOptions);
      verify(result, expectedParams);
    });

  });

});
