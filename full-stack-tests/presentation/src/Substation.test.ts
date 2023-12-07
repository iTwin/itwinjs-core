/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { IModelConnection, SnapshotConnection } from "@itwin/core-frontend";
import { DefaultContentDisplayTypes, KeySet, Ruleset } from "@itwin/presentation-common";
import { Presentation } from "@itwin/presentation-frontend";
import { initialize, terminate, testLocalization } from "./IntegrationTests";

// TODO: Set this to an iModel containing the test data
const PATH_TO_IMODEL = "D:/datasets/29123219-60c2-4877-9c17-378c3b2e6680r-d5f6837c4079e4b7e10371acead4929ca964299f.bim";

describe.only("Substation test failure", () => {
  let imodel: IModelConnection;

  beforeEach(async () => {
    await initialize({ localization: testLocalization });
    imodel = await SnapshotConnection.openFile(PATH_TO_IMODEL);
    expect(imodel).is.not.null;
  });

  afterEach(async () => {
    await terminate();
  });

  it("retrieves content for existing element", async () => {
    const content = await Presentation.presentation.getContent({
      imodel,
      rulesetOrId: substationRuleset,
      keys: KeySet.fromJSON({
        instanceKeys: [["Substation:OtherInstrumentsPhysicalType", "+20000000197"]],
        nodeKeys: [],
      }),
      descriptor: {
        displayType: DefaultContentDisplayTypes.PropertyPane,
        contentFlags: 12,
      },
      paging: undefined,
    });
    expect(content).to.not.be.undefined;
    expect(content!.contentSet.length).to.eq(1);
  });

  const substationRuleset: Ruleset = {
    id: "DesignerPresentationRuleSet",
    requiredSchemas: [
      {
        name: "BisCore",
      },
      {
        name: "Functional",
      },
      {
        name: "Substation",
      },
    ],
    rules: [
      {
        ruleType: "Content",
        specifications: [
          {
            specType: "SelectedNodeInstances",
            propertyOverrides: [
              {
                name: "Category",
                overridesPriority: 1001,
                isDisplayed: false,
              },
            ],
          },
        ],
      },
      {
        ruleType: "ContentModifier",
        class: {
          schemaName: "Substation",
          className: "ElectricalPhysicalEquipment",
        },
        priority: 2000,
        relatedProperties: [
          {
            propertiesSource: {
              relationship: {
                schemaName: "BisCore",
                className: "GeometricElement3dHasTypeDefinition",
              },
              direction: "Forward",
            },
            handleTargetClassPolymorphically: true,
            instanceFilter: "this.Recipe = NULL",
            relationshipMeaning: "SameInstance",
            nestedRelatedProperties: [
              {
                propertiesSource: {
                  relationship: {
                    schemaName: "BisCore",
                    className: "ElementOwnsUniqueAspect",
                  },
                  direction: "Forward",
                },
                handleTargetClassPolymorphically: true,
                relationshipMeaning: "SameInstance",
              },
            ],
          },
          {
            propertiesSource: {
              relationship: {
                schemaName: "Functional",
                className: "PhysicalElementFulfillsFunction",
              },
              direction: "Forward",
            },
            handleTargetClassPolymorphically: true,
            relationshipMeaning: "SameInstance",
          },
          {
            propertiesSource: {
              relationship: {
                schemaName: "Substation",
                className: "PhysicalEquipmentOwnsChildren",
              },
              direction: "Forward",
            },
            handleTargetClassPolymorphically: true,
            relationshipMeaning: "SameInstance",
            nestedRelatedProperties: [
              {
                propertiesSource: {
                  relationship: {
                    schemaName: "BisCore",
                    className: "PhysicalElementIsOfType",
                  },
                  direction: "Forward",
                },
                handleTargetClassPolymorphically: true,
                relationshipMeaning: "SameInstance",
                nestedRelatedProperties: [
                  {
                    propertiesSource: {
                      relationship: {
                        schemaName: "BisCore",
                        className: "ElementOwnsUniqueAspect",
                      },
                      direction: "Forward",
                    },
                    handleTargetClassPolymorphically: true,
                    relationshipMeaning: "SameInstance",
                  },
                ],
              },
            ],
          },
          {
            propertiesSource: {
              relationship: {
                schemaName: "BisCore",
                className: "PhysicalElementAssemblesElements",
              },
              direction: "Forward",
            },
            handleTargetClassPolymorphically: true,
            relationshipMeaning: "SameInstance",
            nestedRelatedProperties: [
              {
                propertiesSource: {
                  relationship: {
                    schemaName: "BisCore",
                    className: "PhysicalElementIsOfType",
                  },
                  direction: "Forward",
                },
                handleTargetClassPolymorphically: true,
                relationshipMeaning: "SameInstance",
                nestedRelatedProperties: [
                  {
                    propertiesSource: {
                      relationship: {
                        schemaName: "BisCore",
                        className: "ElementOwnsUniqueAspect",
                      },
                      direction: "Forward",
                    },
                    handleTargetClassPolymorphically: true,
                    relationshipMeaning: "SameInstance",
                  },
                ],
              },
            ],
          },
        ],
        propertyCategories: [
          {
            id: "Instance_Attributes",
            label: "Instance Attributes",
            autoExpand: true,
            priority: 8,
            parentId: {
              type: "Root",
            },
          },
          {
            id: "General_Attributes",
            label: "General Attributes",
            autoExpand: true,
            priority: 7,
            parentId: {
              type: "Root",
            },
          },
          {
            id: "Extended_Attributes",
            label: "Extended Attributes",
            autoExpand: true,
            priority: 6,
            parentId: {
              type: "Root",
            },
          },
          {
            id: "PD_Symbol_Attributes",
            label: "Symbol Attributes",
            autoExpand: true,
            priority: 5,
            parentId: {
              type: "Root",
            },
          },
          {
            id: "PD_Purchasing_Attributes",
            label: "Purchasing Attributes",
            autoExpand: true,
            priority: 4,
            parentId: {
              type: "Root",
            },
          },
          {
            id: "PD_Dimension_Attributes",
            label: "Dimension Attributes",
            autoExpand: true,
            priority: 3,
            parentId: {
              type: "Root",
            },
          },
          {
            id: "Operational_Attributes",
            label: "Operational Attributes",
            autoExpand: true,
            priority: 2,
            parentId: {
              type: "Root",
            },
          },
          {
            id: "Inspection_Data",
            label: "Inspection Attributes",
            autoExpand: true,
            priority: 1,
            parentId: {
              type: "Root",
            },
          },
          {
            id: "Construction_Attributes",
            label: "Construction Attributes",
            autoExpand: true,
            priority: 0,
            parentId: {
              type: "Root",
            },
          },
        ],
        propertyOverrides: [
          {
            name: "Model",
            isDisplayed: false,
          },
          {
            name: "UserLabel",
            isDisplayed: false,
          },
          {
            name: "PhysicalMaterial",
            isDisplayed: false,
          },
          {
            name: "IsGeneric",
            isDisplayed: false,
          },
          {
            name: "TypeDefinition",
            isDisplayed: false,
          },
          {
            name: "PrimaryPartNumber",
            categoryId: "PD_Symbol_Attributes",
            isDisplayed: false,
          },
          {
            name: "PrimaryPartNumberQuantity",
            categoryId: "PD_Symbol_Attributes",
            isDisplayed: false,
          },
          {
            name: "AdditionalPartNumbers",
            categoryId: "PD_Symbol_Attributes",
            isDisplayed: false,
          },
          {
            name: "AdditionalPartNumberQuantity",
            categoryId: "PD_Symbol_Attributes",
            isDisplayed: false,
          },
          {
            name: "CodeValue",
            categoryId: "Instance_Attributes",
            isDisplayed: false,
          },
        ],
      },
      {
        ruleType: "ContentModifier",
        class: {
          schemaName: "Substation",
          className: "ElectricalPhysicalEquipment",
        },
        priority: 1000,
        relatedProperties: [
          {
            propertiesSource: {
              relationship: {
                schemaName: "BisCore",
                className: "GeometricElement3dHasTypeDefinition",
              },
              direction: "Forward",
            },
            handleTargetClassPolymorphically: true,
            relationshipMeaning: "SameInstance",
            properties: ["_none_"],
            skipIfDuplicate: true,
            nestedRelatedProperties: [
              {
                propertiesSource: {
                  relationship: {
                    schemaName: "BisCore",
                    className: "ElementOwnsUniqueAspect",
                  },
                  direction: "Forward",
                },
                handleTargetClassPolymorphically: true,
                relationshipMeaning: "SameInstance",
                properties: ["_none_"],
                skipIfDuplicate: true,
              },
            ],
          },
        ],
      },
      {
        ruleType: "ContentModifier",
        class: {
          schemaName: "Substation",
          className: "ElectricalSymbolGraphic2d",
        },
        priority: 2000,
        relatedProperties: [
          {
            propertiesSource: {
              relationship: {
                schemaName: "BisCore",
                className: "GeometricElement2dHasTypeDefinition",
              },
              direction: "Forward",
            },
            handleTargetClassPolymorphically: true,
            relationshipMeaning: "SameInstance",
            nestedRelatedProperties: [
              {
                propertiesSource: {
                  relationship: {
                    schemaName: "BisCore",
                    className: "ElementOwnsUniqueAspect",
                  },
                  direction: "Forward",
                },
                handleTargetClassPolymorphically: true,
                relationshipMeaning: "SameInstance",
              },
            ],
          },
          {
            propertiesSource: {
              relationship: {
                schemaName: "Functional",
                className: "DrawingGraphicRepresentsFunctionalElement",
              },
              direction: "Forward",
            },
            handleTargetClassPolymorphically: true,
            relationshipMeaning: "SameInstance",
          },
        ],
        propertyCategories: [
          {
            id: "Instance_Attributes",
            label: "Instance Attributes",
            autoExpand: true,
            priority: 8,
            parentId: {
              type: "Root",
            },
          },
          {
            id: "General_Attributes",
            label: "General Attributes",
            autoExpand: true,
            priority: 7,
            parentId: {
              type: "Root",
            },
          },
          {
            id: "Extended_Attributes",
            label: "Extended Attributes",
            autoExpand: true,
            priority: 6,
            parentId: {
              type: "Root",
            },
          },
          {
            id: "PD_Symbol_Attributes",
            label: "Symbol Attributes",
            autoExpand: true,
            priority: 5,
            parentId: {
              type: "Root",
            },
          },
          {
            id: "PD_Purchasing_Attributes",
            label: "Purchasing Attributes",
            autoExpand: true,
            priority: 4,
            parentId: {
              type: "Root",
            },
          },
          {
            id: "PD_Dimension_Attributes",
            label: "Dimension Attributes",
            autoExpand: true,
            priority: 3,
            parentId: {
              type: "Root",
            },
          },
          {
            id: "Operational_Attributes",
            label: "Operational Attributes",
            autoExpand: true,
            priority: 2,
            parentId: {
              type: "Root",
            },
          },
          {
            id: "Inspection_Data",
            label: "Inspection Attributes",
            autoExpand: true,
            priority: 1,
            parentId: {
              type: "Root",
            },
          },
          {
            id: "Construction_Attributes",
            label: "Construction Attributes",
            autoExpand: true,
            priority: 0,
            parentId: {
              type: "Root",
            },
          },
        ],
        propertyOverrides: [
          {
            name: "Model",
            isDisplayed: false,
          },
          {
            name: "Category",
            isDisplayed: false,
          },
          {
            name: "UserLabel",
            isDisplayed: false,
          },
          {
            name: "PhysicalMaterial",
            isDisplayed: false,
          },
          {
            name: "IsGeneric",
            isDisplayed: false,
          },
          {
            name: "CodeValue",
            isDisplayed: false,
          },
          {
            name: "TypeDefinition",
            isDisplayed: false,
          },
          {
            name: "Origin",
            isDisplayed: false,
          },
          {
            name: "Rotation",
            isDisplayed: false,
          },
          {
            name: "BBoxLow",
            isDisplayed: false,
          },
          {
            name: "BBoxHigh",
            isDisplayed: false,
          },
          {
            name: "ScaleX",
            isDisplayed: false,
          },
          {
            name: "ScaleY",
            isDisplayed: false,
          },
        ],
      },
      {
        ruleType: "ContentModifier",
        requiredSchemas: [
          {
            name: "Substation",
            minVersion: "01.00.00",
          },
        ],
        class: {
          schemaName: "Substation",
          className: "CompatibleEquipmentDefinitionAspect",
        },
        propertyOverrides: [
          {
            name: "EquipmentDefinitionCode",
            overridesPriority: 1001,
            isDisplayed: false,
          },
          {
            name: "SymbolType",
            overridesPriority: 1001,
            isDisplayed: false,
          },
        ],
      },
      {
        ruleType: "ContentModifier",
        requiredSchemas: [
          {
            name: "BisCore",
            minVersion: "01.00.13",
          },
        ],
        class: {
          schemaName: "BisCore",
          className: "ExternalSourceAspect",
        },
        propertyOverrides: [
          {
            name: "Identifier",
            overridesPriority: 1002,
            isDisplayed: false,
          },
        ],
      },
      {
        ruleType: "ContentModifier",
        requiredSchemas: [
          {
            name: "BisCore",
            minVersion: "01.00.13",
          },
        ],
        class: {
          schemaName: "BisCore",
          className: "RepositoryLink",
        },
        propertyOverrides: [
          {
            name: "*",
            overridesPriority: 1002,
            isDisplayed: false,
          },
        ],
      },
      {
        ruleType: "ContentModifier",
        requiredSchemas: [
          {
            name: "BisCore",
            minVersion: "01.00.13",
          },
        ],
        class: {
          schemaName: "BisCore",
          className: "UrlLink",
        },
        propertyOverrides: [
          {
            name: "Url",
            overridesPriority: 1002,
            isDisplayed: false,
          },
        ],
      },
      {
        ruleType: "ContentModifier",
        class: {
          schemaName: "Substation",
          className: "ElectricalPhysicalEquipmentPrimaryPart",
        },
        propertyCategories: [
          {
            id: "Instance_Attributes",
            label: "Instance Attributes",
            autoExpand: true,
            priority: 8,
            parentId: {
              type: "Root",
            },
          },
          {
            id: "General_Attributes",
            label: "General Attributes",
            autoExpand: true,
            priority: 7,
            parentId: {
              type: "Root",
            },
          },
          {
            id: "Extended_Attributes",
            label: "Extended Attributes",
            autoExpand: true,
            priority: 6,
            parentId: {
              type: "Root",
            },
          },
          {
            id: "PD_Symbol_Attributes",
            label: "Symbol Attributes",
            autoExpand: true,
            priority: 5,
            parentId: {
              type: "Root",
            },
          },
          {
            id: "PD_Purchasing_Attributes",
            label: "Purchasing Attributes",
            autoExpand: true,
            priority: 4,
            parentId: {
              type: "Root",
            },
          },
          {
            id: "PD_Dimension_Attributes",
            label: "Dimension Attributes",
            autoExpand: true,
            priority: 3,
            parentId: {
              type: "Root",
            },
          },
          {
            id: "Operational_Attributes",
            label: "Operational Attributes",
            autoExpand: true,
            priority: 2,
            parentId: {
              type: "Root",
            },
          },
          {
            id: "Inspection_Data",
            label: "Inspection Attributes",
            autoExpand: true,
            priority: 1,
            parentId: {
              type: "Root",
            },
          },
          {
            id: "Construction_Attributes",
            label: "Construction Attributes",
            autoExpand: true,
            priority: 0,
            parentId: {
              type: "Root",
            },
          },
        ],
        propertyOverrides: [
          {
            name: "CodeValue",
            isDisplayed: false,
          },
          {
            name: "Model",
            isDisplayed: false,
          },
          {
            name: "UserLabel",
            isDisplayed: false,
          },
          {
            name: "PhysicalMaterial",
            isDisplayed: false,
          },
          {
            name: "IsGeneric",
            isDisplayed: false,
          },
          {
            name: "TypeDefinition",
            isDisplayed: false,
          },
          {
            name: "PrimaryPartNumber",
            categoryId: "PD_Symbol_Attributes",
            labelOverride: "Primary Part Number",
            isDisplayed: true,
            doNotHideOtherPropertiesOnDisplayOverride: true,
          },
          {
            name: "PrimaryPartNumberQuantity",
            categoryId: "PD_Symbol_Attributes",
            labelOverride: "Primary Part Number Quantity",
            isDisplayed: true,
            doNotHideOtherPropertiesOnDisplayOverride: true,
          },
        ],
      },
      {
        ruleType: "ContentModifier",
        class: {
          schemaName: "Substation",
          className: "ElectricalPhysicalEquipmentAdditionalPart",
        },
        propertyCategories: [
          {
            id: "Instance_Attributes",
            label: "Instance Attributes",
            autoExpand: true,
            priority: 8,
            parentId: {
              type: "Root",
            },
          },
          {
            id: "General_Attributes",
            label: "General Attributes",
            autoExpand: true,
            priority: 7,
            parentId: {
              type: "Root",
            },
          },
          {
            id: "Extended_Attributes",
            label: "Extended Attributes",
            autoExpand: true,
            priority: 6,
            parentId: {
              type: "Root",
            },
          },
          {
            id: "PD_Symbol_Attributes",
            label: "Symbol Attributes",
            autoExpand: true,
            priority: 5,
            parentId: {
              type: "Root",
            },
          },
          {
            id: "PD_Purchasing_Attributes",
            label: "Purchasing Attributes",
            autoExpand: true,
            priority: 4,
            parentId: {
              type: "Root",
            },
          },
          {
            id: "PD_Dimension_Attributes",
            label: "Dimension Attributes",
            autoExpand: true,
            priority: 3,
            parentId: {
              type: "Root",
            },
          },
          {
            id: "Operational_Attributes",
            label: "Operational Attributes",
            autoExpand: true,
            priority: 2,
            parentId: {
              type: "Root",
            },
          },
          {
            id: "Inspection_Data",
            label: "Inspection Attributes",
            autoExpand: true,
            priority: 1,
            parentId: {
              type: "Root",
            },
          },
          {
            id: "Construction_Attributes",
            label: "Construction Attributes",
            autoExpand: true,
            priority: 0,
            parentId: {
              type: "Root",
            },
          },
        ],
        propertyOverrides: [
          {
            name: "CodeValue",
            isDisplayed: false,
          },
          {
            name: "Model",
            isDisplayed: false,
          },
          {
            name: "UserLabel",
            isDisplayed: false,
          },
          {
            name: "PhysicalMaterial",
            isDisplayed: false,
          },
          {
            name: "IsGeneric",
            isDisplayed: false,
          },
          {
            name: "TypeDefinition",
            isDisplayed: false,
          },
          {
            name: "AdditionalPartNumbers",
            categoryId: "PD_Symbol_Attributes",
            labelOverride: "Additional Part Number",
            isDisplayed: true,
            doNotHideOtherPropertiesOnDisplayOverride: true,
          },
          {
            name: "AdditionalPartNumberQuantity",
            categoryId: "PD_Symbol_Attributes",
            labelOverride: "Additional Part Number Quantity",
            isDisplayed: true,
            doNotHideOtherPropertiesOnDisplayOverride: true,
          },
        ],
      },
      {
        ruleType: "ContentModifier",
        class: {
          schemaName: "Substation",
          className: "ElectricalPhysicalType",
        },
        propertyCategories: [
          {
            id: "Instance_Attributes",
            label: "Instance Attributes",
            autoExpand: true,
            priority: 8,
            parentId: {
              type: "Root",
            },
          },
          {
            id: "General_Attributes",
            label: "General Attributes",
            autoExpand: true,
            priority: 7,
            parentId: {
              type: "Root",
            },
          },
          {
            id: "Extended_Attributes",
            label: "Extended Attributes",
            autoExpand: true,
            priority: 6,
            parentId: {
              type: "Root",
            },
          },
          {
            id: "PD_Symbol_Attributes",
            label: "Symbol Attributes",
            autoExpand: true,
            priority: 5,
            parentId: {
              type: "Root",
            },
          },
          {
            id: "PD_Purchasing_Attributes",
            label: "Purchasing Attributes",
            autoExpand: true,
            priority: 4,
            parentId: {
              type: "Root",
            },
          },
          {
            id: "PD_Dimension_Attributes",
            label: "Dimension Attributes",
            autoExpand: true,
            priority: 3,
            parentId: {
              type: "Root",
            },
          },
          {
            id: "Operational_Attributes",
            label: "Operational Attributes",
            autoExpand: true,
            priority: 2,
            parentId: {
              type: "Root",
            },
          },
          {
            id: "Inspection_Data",
            label: "Inspection Attributes",
            autoExpand: true,
            priority: 1,
            parentId: {
              type: "Root",
            },
          },
          {
            id: "Construction_Attributes",
            label: "Construction Attributes",
            autoExpand: true,
            priority: 0,
            parentId: {
              type: "Root",
            },
          },
        ],
        propertyOverrides: [
          {
            name: "Model",
            isDisplayed: false,
          },
          {
            name: "UserLabel",
            isDisplayed: false,
          },
          {
            name: "PhysicalMaterial",
            isDisplayed: false,
          },
          {
            name: "IsGeneric",
            isDisplayed: false,
          },
          {
            name: "TypeDefinition",
            isDisplayed: false,
          },
          {
            name: "CodeValue",
            isDisplayed: false,
          },
          {
            name: "InstallationDate",
            categoryId: "Instance_Attributes",
            isDisplayed: false,
          },
          {
            name: "BreakingCapacity",
            categoryId: "General_Attributes",
          },
          {
            name: "InTransientTime",
            categoryId: "Extended_Attributes",
          },
          {
            name: "SymbolType",
            categoryId: "PD_Symbol_Attributes",
            isDisplayed: false,
          },
          {
            name: "DeviceType",
            categoryId: "General_Attributes",
            isDisplayed: false,
          },
          {
            name: "QuantityPerUnit",
            categoryId: "PD_Purchasing_Attributes",
            isDisplayed: false,
          },
          {
            name: "PercentSpare",
            categoryId: "PD_Purchasing_Attributes",
            isDisplayed: false,
          },
          {
            name: "Use_Unit",
            categoryId: "PD_Purchasing_Attributes",
          },
          {
            name: "OrderUnit",
            categoryId: "PD_Purchasing_Attributes",
            isDisplayed: false,
          },
          {
            name: "BuyingPrice",
            categoryId: "PD_Purchasing_Attributes",
            isDisplayed: false,
          },
          {
            name: "DimensionX",
            categoryId: "PD_Dimension_Attributes",
            isDisplayed: false,
          },
          {
            name: "DimensionY",
            categoryId: "PD_Dimension_Attributes",
            isDisplayed: false,
          },
          {
            name: "DimensionZ",
            categoryId: "PD_Dimension_Attributes",
            isDisplayed: false,
          },
          {
            name: "Length",
            categoryId: "PD_Dimension_Attributes",
          },
          {
            name: "TradeDiameter",
            categoryId: "PD_Dimension_Attributes",
          },
          {
            name: "Weight",
            categoryId: "PD_Dimension_Attributes",
            isDisplayed: false,
          },
          {
            name: "WeightPerLength",
            categoryId: "PD_Dimension_Attributes",
          },
          {
            name: "DateCreated",
            categoryId: "PD_Symbol_Attributes",
            isDisplayed: false,
          },
          {
            name: "DateModified",
            categoryId: "PD_Symbol_Attributes",
            isDisplayed: false,
          },
          {
            name: "AssemblyTime",
            categoryId: "Construction_Attributes",
            isDisplayed: false,
          },
          {
            name: "WiringTime",
            categoryId: "Construction_Attributes",
            isDisplayed: false,
          },
          {
            name: "HourCost",
            categoryId: "Construction_Attributes",
            isDisplayed: false,
          },
          {
            name: "OperatingTemperatureRange",
            categoryId: "Extended_Attributes",
          },
          {
            name: "ApplicableStandard",
            categoryId: "Extended_Attributes",
          },
          {
            name: "Compliance",
            categoryId: "Extended_Attributes",
          },
          {
            name: "RatedResistanceAt20C",
            categoryId: "Extended_Attributes",
          },
          {
            name: "RatedResistanceAt75C",
            categoryId: "Extended_Attributes",
          },
          {
            name: "Type",
            categoryId: "General_Attributes",
          },
          {
            name: "NominalVoltage",
            categoryId: "General_Attributes",
          },
          {
            name: "MaximumRatedVoltage",
            categoryId: "General_Attributes",
          },
          {
            name: "RatedLightningImpulseWithstandVoltage",
            categoryId: "General_Attributes",
          },
          {
            name: "DischargeVoltageMax",
            categoryId: "Extended_Attributes",
          },
          {
            name: "SwitchingWithstandVoltage",
            categoryId: "Extended_Attributes",
          },
          {
            name: "OperatingLineVoltage",
            categoryId: "Extended_Attributes",
          },
          {
            name: "WithstandKV",
            categoryId: "Extended_Attributes",
          },
          {
            name: "RatedBasicImpulseLevel(Rated",
            categoryId: "Extended_Attributes",
          },
          {
            name: "BIL",
            categoryId: "General_Attributes",
          },
          {
            name: "MechanicalEnduranceClass",
            categoryId: "General_Attributes",
          },
          {
            name: "ClosingTimes",
            categoryId: "Extended_Attributes",
          },
          {
            name: "InsulatorType",
            categoryId: "General_Attributes",
          },
          {
            name: "LeakageDistance",
            categoryId: "Extended_Attributes",
          },
          {
            name: "RatedCurrent",
            categoryId: "General_Attributes",
          },
          {
            name: "NominalDischargeCurrent",
            categoryId: "Extended_Attributes",
          },
          {
            name: "InterruptingCurrent",
            categoryId: "General_Attributes",
          },
          {
            name: "MaxContCurrent",
            categoryId: "General_Attributes",
          },
          {
            name: "MaxMomentaryCurrent",
            categoryId: "General_Attributes",
          },
          {
            name: "ShortCircuitCurrent",
            categoryId: "General_Attributes",
          },
          {
            name: "BreakingCapacity",
            categoryId: "General_Attributes",
          },
          {
            name: "RatedShortTimeCurrent",
            categoryId: "Extended_Attributes",
          },
          {
            name: "RatedPeakWithstandCurrent",
            categoryId: "Extended_Attributes",
          },
          {
            name: "RatedFaultMakingCurrent(Rated",
            categoryId: "Extended_Attributes",
          },
          {
            name: "MinFaultCurrent",
            categoryId: "Extended_Attributes",
          },
          {
            name: "MaxAmpacityAt90C",
            categoryId: "Extended_Attributes",
          },
          {
            name: "MaxAmpacityAt75C",
            categoryId: "Extended_Attributes",
          },
          {
            name: "Frequency",
            categoryId: "General_Attributes",
          },
          {
            name: "FlexConnector",
            categoryId: "General_Attributes",
            isDisplayed: false,
          },
          {
            name: "CableStartEndConnector",
            categoryId: "General_Attributes",
            isDisplayed: false,
          },
          {
            name: "Material",
            categoryId: "General_Attributes",
          },
          {
            name: "CableWeight",
            categoryId: "Extended_Attributes",
          },
          {
            name: "MinBendingRadius",
            categoryId: "Extended_Attributes",
          },
          {
            name: "NumberOfConductors",
            categoryId: "Extended_Attributes",
          },
          {
            name: "Impedance",
            categoryId: "Extended_Attributes",
          },
          {
            name: "CableType",
            categoryId: "General_Attributes",
          },
          {
            name: "CableSize",
            categoryId: "General_Attributes",
          },
          {
            name: "CableDiameter",
            categoryId: "General_Attributes",
          },
          {
            name: "JacketType",
            categoryId: "General_Attributes",
          },
          {
            name: "ShieldType",
            categoryId: "General_Attributes",
          },
          {
            name: "InsulationType",
            categoryId: "General_Attributes",
          },
          {
            name: "AllowableAmpacity",
            categoryId: "General_Attributes",
          },
          {
            name: "FluidType",
            categoryId: "General_Attributes",
          },
          {
            name: "PrimaryVoltage",
            categoryId: "General_Attributes",
          },
          {
            name: "SecondaryVoltage",
            categoryId: "General_Attributes",
          },
          {
            name: "TypeOfCooling",
            categoryId: "General_Attributes",
          },
          {
            name: "FullLoadKVA",
            categoryId: "General_Attributes",
          },
          {
            name: "GallonsFluid",
            categoryId: "Extended_Attributes",
          },
          {
            name: "CreepageDistance",
            categoryId: "Extended_Attributes",
          },
          {
            name: "HousingMaterial",
            categoryId: "Extended_Attributes",
          },
          {
            name: "ArresterClass",
            categoryId: "General_Attributes",
          },
          {
            name: "LineDischargeClass",
            categoryId: "Extended_Attributes",
          },
          {
            name: "MCOVRating",
            categoryId: "General_Attributes",
          },
          {
            name: "FaultSendingMethod",
            categoryId: "Extended_Attributes",
          },
          {
            name: "ConnectToSCADA",
            categoryId: "Extended_Attributes",
          },
          {
            name: "PortablePermanentInstalled",
            categoryId: "Extended_Attributes",
          },
          {
            name: "Mounting",
            categoryId: "Extended_Attributes",
          },
          {
            name: "FaultIndication",
            categoryId: "Extended_Attributes",
          },
          {
            name: "RungsSpacing",
            categoryId: "PD_Symbol_Attributes",
          },
          {
            name: "CoverType",
            categoryId: "Instance_Attributes",
          },
          {
            name: "NumberOfDividers",
            categoryId: "Instance_Attributes",
          },
          {
            name: "TradeWidth",
            categoryId: "PD_Symbol_Attributes",
          },
          {
            name: "TradeHeight",
            categoryId: "PD_Symbol_Attributes",
          },
          {
            name: "Series",
            categoryId: "PD_Symbol_Attributes",
          },
          {
            name: "PercentFill",
            categoryId: "Instance_Attributes",
          },
          {
            name: "PercentFill_1",
            categoryId: "Instance_Attributes",
          },
          {
            name: "PercentFill_2",
            categoryId: "Instance_Attributes",
          },
          {
            name: "PercentFill_3",
            categoryId: "Instance_Attributes",
          },
          {
            name: "MaxFillFactor",
            categoryId: "Instance_Attributes",
          },
          {
            name: "SpareCapacity",
            categoryId: "Instance_Attributes",
          },
          {
            name: "CableLayingMethod",
            categoryId: "Instance_Attributes",
          },
          {
            name: "VoltageLevels",
            categoryId: "Instance_Attributes",
          },
          {
            name: "StackNumber",
            categoryId: "Instance_Attributes",
          },
          {
            name: "InnerDiameter",
            categoryId: "PD_Symbol_Attributes",
          },
          {
            name: "OuterDiameter",
            categoryId: "PD_Symbol_Attributes",
          },
          {
            name: "Radius",
            categoryId: "PD_Symbol_Attributes",
          },
          {
            name: "Angle",
            categoryId: "PD_Symbol_Attributes",
          },
          {
            name: "CableTrayWeightPerUnitLength",
            categoryId: "PD_Symbol_Attributes",
          },
          {
            name: "CIPCompliancerequired",
            categoryId: "Extended_Attributes",
          },
        ],
      },
      {
        ruleType: "ContentModifier",
        class: {
          schemaName: "Substation",
          className: "ElectricalFunctionalEquipment",
        },
        propertyCategories: [
          {
            id: "Instance_Attributes",
            label: "Instance Attributes",
            autoExpand: true,
            priority: 8,
            parentId: {
              type: "Root",
            },
          },
          {
            id: "General_Attributes",
            label: "General Attributes",
            autoExpand: true,
            priority: 7,
            parentId: {
              type: "Root",
            },
          },
          {
            id: "Extended_Attributes",
            label: "Extended Attributes",
            autoExpand: true,
            priority: 6,
            parentId: {
              type: "Root",
            },
          },
          {
            id: "PD_Symbol_Attributes",
            label: "Symbol Attributes",
            autoExpand: true,
            priority: 5,
            parentId: {
              type: "Root",
            },
          },
          {
            id: "PD_Purchasing_Attributes",
            label: "Purchasing Attributes",
            autoExpand: true,
            priority: 4,
            parentId: {
              type: "Root",
            },
          },
          {
            id: "PD_Dimension_Attributes",
            label: "Dimension Attributes",
            autoExpand: true,
            priority: 3,
            parentId: {
              type: "Root",
            },
          },
          {
            id: "Operational_Attributes",
            label: "Operational Attributes",
            autoExpand: true,
            priority: 2,
            parentId: {
              type: "Root",
            },
          },
          {
            id: "Inspection_Data",
            label: "Inspection Attributes",
            autoExpand: true,
            priority: 1,
            parentId: {
              type: "Root",
            },
          },
          {
            id: "Construction_Attributes",
            label: "Construction Attributes",
            autoExpand: true,
            priority: 0,
            parentId: {
              type: "Root",
            },
          },
        ],
        propertyOverrides: [
          {
            name: "Model",
            isDisplayed: false,
          },
          {
            name: "UserLabel",
            isDisplayed: false,
          },
          {
            name: "PhysicalMaterial",
            isDisplayed: false,
          },
          {
            name: "IsGeneric",
            isDisplayed: false,
          },
          {
            name: "TypeDefinition",
            isDisplayed: false,
          },
          {
            name: "LifecycleStatus",
            categoryId: "Instance_Attributes",
          },
          {
            name: "SerialNumber",
            categoryId: "Instance_Attributes",
            isDisplayed: false,
          },
          {
            name: "AssetIdentifier",
            categoryId: "Instance_Attributes",
            isDisplayed: false,
          },
          {
            name: "Locked",
            categoryId: "Operational_Attributes",
            isDisplayed: false,
          },
          {
            name: "Open",
            categoryId: "Operational_Attributes",
            isDisplayed: false,
          },
          {
            name: "NormalOpen",
            categoryId: "Operational_Attributes",
            isDisplayed: false,
          },
          {
            name: "Retained",
            categoryId: "Extended_Attributes",
            isDisplayed: false,
          },
          {
            name: "IsUsingSharedDeviceId",
            categoryId: "Instance_Attributes",
          },
          {
            name: "CodeValue",
            categoryId: "Instance_Attributes",
            labelOverride: "Device Id",
          },
          {
            name: "Area",
            categoryId: "Instance_Attributes",
          },
          {
            name: "Location",
            categoryId: "Instance_Attributes",
          },
          {
            name: "Installation",
            categoryId: "Instance_Attributes",
          },
          {
            name: "YearOfManufacture",
            categoryId: "Instance_Attributes",
            isDisplayed: false,
          },
          {
            name: "Phase",
            categoryId: "Instance_Attributes",
          },
          {
            name: "BOMDocumentNumber",
            categoryId: "Instance_Attributes",
          },
          {
            name: "DesignRevisionNumber",
            categoryId: "Instance_Attributes",
          },
          {
            name: "DesignWorkOrderNumber",
            categoryId: "Instance_Attributes",
          },
          {
            name: "EquipmentDefinitionCode",
            categoryId: "Instance_Attributes",
            isDisplayed: false,
          },
          {
            name: "NumberOfCables",
            categoryId: "Instance_Attributes",
          },
        ],
      },
      {
        ruleType: "ContentModifier",
        class: {
          schemaName: "Substation",
          className: "ElectricalGraphicalType2d",
        },
        propertyCategories: [
          {
            id: "Instance_Attributes",
            label: "Instance Attributes",
            autoExpand: true,
            priority: 8,
            parentId: {
              type: "Root",
            },
          },
          {
            id: "General_Attributes",
            label: "General Attributes",
            autoExpand: true,
            priority: 7,
            parentId: {
              type: "Root",
            },
          },
          {
            id: "Extended_Attributes",
            label: "Extended Attributes",
            autoExpand: true,
            priority: 6,
            parentId: {
              type: "Root",
            },
          },
          {
            id: "PD_Symbol_Attributes",
            label: "Symbol Attributes",
            autoExpand: true,
            priority: 5,
            parentId: {
              type: "Root",
            },
          },
          {
            id: "PD_Purchasing_Attributes",
            label: "Purchasing Attributes",
            autoExpand: true,
            priority: 4,
            parentId: {
              type: "Root",
            },
          },
          {
            id: "PD_Dimension_Attributes",
            label: "Dimension Attributes",
            autoExpand: true,
            priority: 3,
            parentId: {
              type: "Root",
            },
          },
          {
            id: "Operational_Attributes",
            label: "Operational Attributes",
            autoExpand: true,
            priority: 2,
            parentId: {
              type: "Root",
            },
          },
          {
            id: "Inspection_Data",
            label: "Inspection Attributes",
            autoExpand: true,
            priority: 1,
            parentId: {
              type: "Root",
            },
          },
          {
            id: "Construction_Attributes",
            label: "Construction Attributes",
            autoExpand: true,
            priority: 0,
            parentId: {
              type: "Root",
            },
          },
        ],
        propertyOverrides: [
          {
            name: "Model",
            isDisplayed: false,
          },
          {
            name: "Category",
            isDisplayed: false,
          },
          {
            name: "UserLabel",
            isDisplayed: false,
          },
          {
            name: "CodeValue",
            isDisplayed: false,
          },
        ],
      },
      {
        ruleType: "ContentModifier",
        class: {
          schemaName: "Substation",
          className: "GenericEquipmentAspect",
        },
        propertyCategories: [
          {
            id: "Instance_Attributes",
            label: "Instance Attributes",
            autoExpand: true,
            priority: 8,
            parentId: {
              type: "Root",
            },
          },
          {
            id: "General_Attributes",
            label: "General Attributes",
            autoExpand: true,
            priority: 7,
            parentId: {
              type: "Root",
            },
          },
          {
            id: "Extended_Attributes",
            label: "Extended Attributes",
            autoExpand: true,
            priority: 6,
            parentId: {
              type: "Root",
            },
          },
          {
            id: "PD_Symbol_Attributes",
            label: "Symbol Attributes",
            autoExpand: true,
            priority: 5,
            parentId: {
              type: "Root",
            },
          },
          {
            id: "PD_Purchasing_Attributes",
            label: "Purchasing Attributes",
            autoExpand: true,
            priority: 4,
            parentId: {
              type: "Root",
            },
          },
          {
            id: "PD_Dimension_Attributes",
            label: "Dimension Attributes",
            autoExpand: true,
            priority: 3,
            parentId: {
              type: "Root",
            },
          },
          {
            id: "Operational_Attributes",
            label: "Operational Attributes",
            autoExpand: true,
            priority: 2,
            parentId: {
              type: "Root",
            },
          },
          {
            id: "Inspection_Data",
            label: "Inspection Attributes",
            autoExpand: true,
            priority: 1,
            parentId: {
              type: "Root",
            },
          },
          {
            id: "Construction_Attributes",
            label: "Construction Attributes",
            autoExpand: true,
            priority: 0,
            parentId: {
              type: "Root",
            },
          },
        ],
        propertyOverrides: [
          {
            name: "Model",
            isDisplayed: false,
          },
          {
            name: "UserLabel",
            isDisplayed: false,
          },
          {
            name: "PhysicalMaterial",
            isDisplayed: false,
          },
          {
            name: "IsGeneric",
            isDisplayed: false,
          },
          {
            name: "TypeDefinition",
            isDisplayed: false,
          },
          {
            name: "Name",
            categoryId: "General_Attributes",
            isDisplayed: false,
          },
          {
            name: "Description",
            categoryId: "General_Attributes",
          },
          {
            name: "TagMnemonic",
            categoryId: "General_Attributes",
            isDisplayed: false,
          },
          {
            name: "PartType",
            categoryId: "PD_Symbol_Attributes",
          },
          {
            name: "CatalogNumber",
            categoryId: "PD_Symbol_Attributes",
          },
          {
            name: "Discipline",
            categoryId: "PD_Symbol_Attributes",
            isDisplayed: false,
            labelOverride: "Category Level 1",
          },
          {
            name: "Category",
            categoryId: "PD_Symbol_Attributes",
            isDisplayed: false,
            labelOverride: "Category Level 2",
          },
          {
            name: "Manufacturer",
            categoryId: "General_Attributes",
          },
          {
            name: "Supplier",
            categoryId: "PD_Purchasing_Attributes",
          },
          {
            name: "URL",
            categoryId: "PD_Purchasing_Attributes",
          },
          {
            name: "Family",
            categoryId: "PD_Symbol_Attributes",
          },
          {
            name: "BalloonNumber",
            categoryId: "PD_Symbol_Attributes",
          },
          {
            name: "IsAddedOnTheFly",
            categoryId: "PD_Symbol_Attributes",
          },
          {
            name: "DetailedDescription1",
            categoryId: "General_Attributes",
            labelOverride: "Short Description",
          },
          {
            name: "DetailedDescription2",
            categoryId: "General_Attributes",
            isDisplayed: false,
            labelOverride: "Category Level 3",
          },
          {
            name: "DetailedDescription3",
            categoryId: "General_Attributes",
            isDisplayed: false,
          },
          {
            name: "DetailedDescription4",
            categoryId: "General_Attributes",
            isDisplayed: false,
          },
          {
            name: "DetailedDescription5",
            categoryId: "General_Attributes",
            isDisplayed: false,
          },
        ],
      },
    ],
  };
});
