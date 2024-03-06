/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import { IModelDb } from "@itwin/core-backend";
import { assert, Id64String } from "@itwin/core-bentley";
import { BisCodeSpec, Code, ElementAspectProps, ElementProps, IModel } from "@itwin/core-common";
import { Presentation } from "@itwin/presentation-backend";
import { DefaultContentDisplayTypes, InstanceKey, KeySet, Ruleset } from "@itwin/presentation-common";
import { initialize, terminate } from "../IntegrationTests";
import { getFieldByLabel } from "../Utils";
import { buildTestIModelDb } from "../IModelSetupUtils";

describe("Default supplemental rules", async () => {
  before(async () => {
    await initialize();
  });

  after(async () => {
    await terminate();
  });

  describe("Content modifiers", () => {
    describe("bis.Element", () => {
      describe("Related properties", () => {
        it("loads `Element -> ExternalSourceAspect.Identifier` property into 'Source Information' group", async function () {
          let elementKey: InstanceKey | undefined;
          const { db: imodel } = await buildTestIModelDb(this.test!.fullTitle(), async (db) => {
            elementKey = insertPhysicalElement(db);
            db.elements.insertAspect({
              classFullName: "BisCore:ExternalSourceAspect",
              element: {
                relClassName: "BisCore:ElementOwnsExternalSourceAspects",
                id: elementKey.id,
              },
              kind: "",
              identifier: "test identifier",
            } as ElementAspectProps);
          });
          const rules: Ruleset = {
            id: "test",
            rules: [
              {
                ruleType: "Content",
                specifications: [
                  {
                    specType: "SelectedNodeInstances",
                  },
                ],
              },
            ],
          };
          const content = await Presentation.getManager().getContent({
            imodel,
            rulesetOrId: rules,
            descriptor: {},
            keys: new KeySet([elementKey!]),
          });
          assert(!!content);
          const externalSourceAspectField = getFieldByLabel(content.descriptor.fields, "External Source Aspect");
          assert(externalSourceAspectField.isNestedContentField());
          const identifierField = getFieldByLabel(externalSourceAspectField.nestedFields, "Source Element ID");
          expect(identifierField.category.label).to.eq("Source Information");
          expect(content.contentSet[0]).to.containSubset({
            values: {
              [externalSourceAspectField.name]: [
                {
                  values: {
                    [identifierField.name]: "test identifier",
                  },
                },
              ],
            },
          });
        });

        it("loads `Element -> ExternalSourceAspect -> ExternalSource -> RepositoryLink` properties into 'Source Information' group", async function () {
          let elementKey: InstanceKey | undefined;
          const { db: imodel } = await buildTestIModelDb(this.test!.fullTitle(), async (db) => {
            const schema = `<?xml version="1.0" encoding="UTF-8"?>
                  <ECSchema schemaName="TestDomain" alias="td" version="01.00" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.1">
                      <ECSchemaReference name="BisCore" version="01.00" alias="bis" />
                      <ECEntityClass typeName="MyRepositoryLink" displayLabel="My Repository Link">
                          <BaseClass>bis:RepositoryLink</BaseClass>
                          <ECProperty propertyName="MyProperty" displayLabel="My Property" typeName="string" />
                      </ECEntityClass>
                  </ECSchema>`;
            await db.importSchemaStrings([schema]);
            db.saveChanges();

            elementKey = insertPhysicalElement(db);
            const repositoryLinkId = db.elements.insertElement({
              classFullName: "TestDomain:MyRepositoryLink",
              model: IModel.repositoryModelId,
              code: Code.createEmpty(),
              userLabel: "test user label",
              url: "test url",
              myProperty: "test my property",
            } as ElementProps);
            const externalSourceId = db.elements.insertElement({
              classFullName: "BisCore:ExternalSource",
              model: IModel.dictionaryId,
              code: Code.createEmpty(),
              repository: {
                relClassName: "BisCore:ExternalSourceIsInRepository",
                id: repositoryLinkId,
              },
            } as ElementProps);
            db.elements.insertAspect({
              classFullName: "BisCore:ExternalSourceAspect",
              element: {
                relClassName: "BisCore:ElementOwnsExternalSourceAspects",
                id: elementKey.id,
              },
              source: {
                relClassName: "BisCore:ElementIsFromSource",
                id: externalSourceId,
              },
              kind: "",
              identifier: "test identifier",
            } as ElementAspectProps);
          });
          const rules: Ruleset = {
            id: "test",
            rules: [
              {
                ruleType: "Content",
                specifications: [
                  {
                    specType: "SelectedNodeInstances",
                  },
                ],
              },
            ],
          };
          const content = await Presentation.getManager().getContent({
            imodel,
            rulesetOrId: rules,
            descriptor: {},
            keys: new KeySet([elementKey!]),
          });
          assert(!!content);
          const externalSourceAspectField = getFieldByLabel(content.descriptor.fields, "External Source Aspect");
          assert(externalSourceAspectField.isNestedContentField());
          const repositoryLinkField = getFieldByLabel(externalSourceAspectField.nestedFields, "My Repository Link");
          assert(repositoryLinkField.isNestedContentField());
          expect(repositoryLinkField.nestedFields.length).to.eq(6);
          repositoryLinkField.nestedFields.forEach((f) => {
            expect(f.category.label).to.eq("Document Link");
            expect(f.category.parent!.label).to.eq("Source Information");
          });
          expect(content.contentSet[0]).to.containSubset({
            values: {
              [externalSourceAspectField.name]: [
                {
                  values: {
                    [repositoryLinkField.name]: [
                      {
                        values: {
                          [getFieldByLabel(repositoryLinkField.nestedFields, "Code").name]: undefined,
                          [getFieldByLabel(repositoryLinkField.nestedFields, "Name").name]: "test user label",
                          [getFieldByLabel(repositoryLinkField.nestedFields, "Path").name]: "test url",
                          [getFieldByLabel(repositoryLinkField.nestedFields, "Description").name]: undefined,
                          [getFieldByLabel(repositoryLinkField.nestedFields, "Format").name]: undefined,
                          [getFieldByLabel(repositoryLinkField.nestedFields, "My Property").name]: "test my property",
                        },
                      },
                    ],
                  },
                },
              ],
            },
          });
        });

        it("allows removing 'Source Element ID' property", async function () {
          let elementKey: InstanceKey | undefined;
          const { db: imodel } = await buildTestIModelDb(this.test!.fullTitle(), async (db) => {
            elementKey = insertPhysicalElement(db);
            db.elements.insertAspect({
              classFullName: "BisCore:ExternalSourceAspect",
              element: {
                relClassName: "BisCore:ElementOwnsExternalSourceAspects",
                id: elementKey.id,
              },
              kind: "",
              identifier: "test identifier",
            } as ElementAspectProps);
          });
          const rules: Ruleset = {
            id: "test",
            rules: [
              {
                ruleType: "Content",
                specifications: [
                  {
                    specType: "SelectedNodeInstances",
                  },
                ],
              },
              {
                ruleType: "ContentModifier",
                class: { schemaName: "BisCore", className: "Element" },
                relatedProperties: [
                  {
                    propertiesSource: [
                      {
                        relationship: {
                          schemaName: "BisCore",
                          className: "ElementOwnsMultiAspects",
                        },
                        direction: "Forward",
                        targetClass: {
                          schemaName: "BisCore",
                          className: "ExternalSourceAspect",
                        },
                      },
                    ],
                    properties: [],
                  },
                ],
              },
            ],
          };
          const descriptor = await Presentation.getManager().getContentDescriptor({
            imodel,
            rulesetOrId: rules,
            displayType: DefaultContentDisplayTypes.PropertyPane,
            keys: new KeySet([elementKey!]),
          });
          assert(!!descriptor);
          expect(descriptor.categories).to.not.containSubset([
            {
              label: "Source Information",
            },
          ]);
          expect(() => getFieldByLabel(descriptor.fields, "Source Element ID")).to.throw();
        });

        it("allows removing 'Source Information -> Model Source' properties", async function () {
          let elementKey: InstanceKey | undefined;
          const { db: imodel } = await buildTestIModelDb(this.test!.fullTitle(), async (db) => {
            const partitionId = db.elements.insertElement({
              classFullName: "BisCore:PhysicalPartition",
              model: IModel.repositoryModelId,
              parent: {
                relClassName: "BisCore:SubjectOwnsPartitionElements",
                id: IModel.rootSubjectId,
              },
              code: new Code({
                spec: db.codeSpecs.getByName(BisCodeSpec.informationPartitionElement).id,
                scope: IModel.rootSubjectId,
                value: "physical model",
              }),
            });
            const repositoryLinkId = db.elements.insertElement({
              classFullName: "BisCore:RepositoryLink",
              model: IModel.repositoryModelId,
              code: Code.createEmpty(),
              userLabel: "test user label",
              url: "test url",
            } as ElementProps);
            db.relationships.insertInstance({
              classFullName: "BisCore:ElementHasLinks",
              sourceId: partitionId,
              targetId: repositoryLinkId,
            });
            const modelId = db.models.insertModel({
              classFullName: "BisCore:PhysicalModel",
              modeledElement: { id: partitionId },
            });
            elementKey = insertPhysicalElement(db, modelId);
          });
          const rules: Ruleset = {
            id: "test",
            rules: [
              {
                ruleType: "Content",
                specifications: [
                  {
                    specType: "SelectedNodeInstances",
                  },
                ],
              },
              {
                ruleType: "ContentModifier",
                class: { schemaName: "BisCore", className: "Element" },
                relatedProperties: [
                  {
                    propertiesSource: [
                      {
                        relationship: {
                          schemaName: "BisCore",
                          className: "ModelContainsElements",
                        },
                        direction: "Backward",
                      },
                      {
                        relationship: {
                          schemaName: "BisCore",
                          className: "ModelModelsElement",
                        },
                        direction: "Forward",
                      },
                      {
                        relationship: {
                          schemaName: "BisCore",
                          className: "ElementHasLinks",
                        },
                        targetClass: {
                          schemaName: "BisCore",
                          className: "RepositoryLink",
                        },
                        direction: "Forward",
                      },
                    ],
                    properties: [],
                  },
                ],
              },
            ],
          };
          const descriptor = await Presentation.getManager().getContentDescriptor({
            imodel,
            rulesetOrId: rules,
            displayType: DefaultContentDisplayTypes.PropertyPane,
            keys: new KeySet([elementKey!]),
          });
          assert(!!descriptor);
          expect(descriptor.categories).to.not.containSubset([
            {
              label: "Model Source",
            },
          ]);
          expect(descriptor.categories).to.not.containSubset([
            {
              label: "Source Information",
            },
          ]);
          expect(() => getFieldByLabel(descriptor.fields, "Path")).to.throw();
          expect(() => getFieldByLabel(descriptor.fields, "Name")).to.throw();
        });

        it("allows removing 'Source Information' ExternalSource properties", async function () {
          let elementKey: InstanceKey | undefined;
          const { db: imodel } = await buildTestIModelDb(this.test!.fullTitle(), async (db) => {
            elementKey = insertPhysicalElement(db);
            const repositoryLinkId = db.elements.insertElement({
              classFullName: "BisCore:RepositoryLink",
              model: IModel.repositoryModelId,
              code: Code.createEmpty(),
              userLabel: "test user label",
              url: "test url",
            } as ElementProps);
            const externalSourceId = db.elements.insertElement({
              classFullName: "BisCore:ExternalSource",
              model: IModel.dictionaryId,
              code: Code.createEmpty(),
              repository: {
                relClassName: "BisCore:ExternalSourceIsInRepository",
                id: repositoryLinkId,
              },
            } as ElementProps);
            db.elements.insertAspect({
              classFullName: "BisCore:ExternalSourceAspect",
              element: {
                relClassName: "BisCore:ElementOwnsExternalSourceAspects",
                id: elementKey.id,
              },
              source: {
                relClassName: "BisCore:ElementIsFromSource",
                id: externalSourceId,
              },
              kind: "",
              identifier: "test identifier",
            } as ElementAspectProps);
          });
          const rules: Ruleset = {
            id: "test",
            rules: [
              {
                ruleType: "Content",
                specifications: [
                  {
                    specType: "SelectedNodeInstances",
                  },
                ],
              },
              {
                ruleType: "ContentModifier",
                class: { schemaName: "BisCore", className: "Element" },
                relatedProperties: [
                  {
                    propertiesSource: [
                      {
                        relationship: {
                          schemaName: "BisCore",
                          className: "ElementOwnsMultiAspects",
                        },
                        direction: "Forward",
                        targetClass: {
                          schemaName: "BisCore",
                          className: "ExternalSourceAspect",
                        },
                      },
                    ],
                    properties: [],
                    nestedRelatedProperties: [
                      {
                        propertiesSource: [
                          {
                            relationship: {
                              schemaName: "BisCore",
                              className: "ElementIsFromSource",
                            },
                            direction: "Forward",
                          },
                          {
                            relationship: {
                              schemaName: "BisCore",
                              className: "ExternalSourceIsInRepository",
                            },
                            direction: "Forward",
                          },
                        ],
                        properties: [],
                      },
                    ],
                  },
                ],
              },
            ],
          };
          const descriptor = await Presentation.getManager().getContentDescriptor({
            imodel,
            rulesetOrId: rules,
            displayType: DefaultContentDisplayTypes.PropertyPane,
            keys: new KeySet([elementKey!]),
          });
          assert(!!descriptor);
          expect(descriptor.categories).to.not.containSubset([
            {
              label: "Source Information",
            },
          ]);
          expect(() => getFieldByLabel(descriptor.fields, "Name")).to.throw();
          expect(() => getFieldByLabel(descriptor.fields, "Path")).to.throw();
        });

        it("allows removing 'Source Information -> Secondary Sources' properties", async function () {
          let elementKey: InstanceKey | undefined;
          const { db: imodel } = await buildTestIModelDb(this.test!.fullTitle(), async (db) => {
            elementKey = insertPhysicalElement(db);
            const repositoryLinkId = db.elements.insertElement({
              classFullName: "BisCore:RepositoryLink",
              model: IModel.repositoryModelId,
              code: Code.createEmpty(),
              userLabel: "test user label",
              url: "test url",
            } as ElementProps);
            const externalSourceId = db.elements.insertElement({
              classFullName: "BisCore:ExternalSource",
              model: IModel.dictionaryId,
              code: Code.createEmpty(),
              repository: {
                relClassName: "BisCore:ExternalSourceIsInRepository",
                id: repositoryLinkId,
              },
            } as ElementProps);
            const externalSourceGroupId = db.elements.insertElement({
              classFullName: "BisCore:ExternalSourceGroup",
              model: IModel.dictionaryId,
              code: Code.createEmpty(),
            } as ElementProps);
            db.relationships.insertInstance({
              classFullName: "BisCore:ExternalSourceGroupGroupsSources",
              sourceId: externalSourceGroupId,
              targetId: externalSourceId,
            });
            db.elements.insertAspect({
              classFullName: "BisCore:ExternalSourceAspect",
              element: {
                relClassName: "BisCore:ElementOwnsExternalSourceAspects",
                id: elementKey.id,
              },
              source: {
                relClassName: "BisCore:ElementIsFromSource",
                id: externalSourceGroupId,
              },
              kind: "",
              identifier: "test identifier",
            } as ElementAspectProps);
          });
          const rules: Ruleset = {
            id: "test",
            rules: [
              {
                ruleType: "Content",
                specifications: [
                  {
                    specType: "SelectedNodeInstances",
                  },
                ],
              },
              {
                ruleType: "ContentModifier",
                class: { schemaName: "BisCore", className: "Element" },
                relatedProperties: [
                  {
                    propertiesSource: [
                      {
                        relationship: {
                          schemaName: "BisCore",
                          className: "ElementOwnsMultiAspects",
                        },
                        direction: "Forward",
                        targetClass: {
                          schemaName: "BisCore",
                          className: "ExternalSourceAspect",
                        },
                      },
                    ],
                    properties: [],
                    nestedRelatedProperties: [
                      {
                        propertiesSource: [
                          {
                            relationship: {
                              schemaName: "BisCore",
                              className: "ElementIsFromSource",
                            },
                            direction: "Forward",
                            targetClass: {
                              schemaName: "BisCore",
                              className: "ExternalSourceGroup",
                            },
                          },
                          {
                            relationship: {
                              schemaName: "BisCore",
                              className: "ExternalSourceGroupGroupsSources",
                            },
                            direction: "Forward",
                          },
                          {
                            relationship: {
                              schemaName: "BisCore",
                              className: "ExternalSourceIsInRepository",
                            },
                            direction: "Forward",
                          },
                        ],
                        properties: [],
                      },
                    ],
                  },
                ],
              },
            ],
          };
          const descriptor = await Presentation.getManager().getContentDescriptor({
            imodel,
            rulesetOrId: rules,
            displayType: DefaultContentDisplayTypes.PropertyPane,
            keys: new KeySet([elementKey!]),
          });
          assert(!!descriptor);
          expect(descriptor.categories).to.not.containSubset([
            {
              label: "Source Information",
            },
          ]);
          expect(descriptor.categories).to.not.containSubset([
            {
              label: "Secondary Sources",
            },
          ]);
          expect(() => getFieldByLabel(descriptor.fields, "Name")).to.throw();
          expect(() => getFieldByLabel(descriptor.fields, "Path")).to.throw();
        });
      });
    });
  });
});

function insertPhysicalElement(db: IModelDb, modelId?: Id64String, categoryId?: Id64String): InstanceKey {
  if (!modelId) {
    const partitionId = db.elements.insertElement({
      classFullName: "BisCore:PhysicalPartition",
      model: IModel.repositoryModelId,
      parent: {
        relClassName: "BisCore:SubjectOwnsPartitionElements",
        id: IModel.rootSubjectId,
      },
      code: new Code({
        spec: db.codeSpecs.getByName(BisCodeSpec.informationPartitionElement).id,
        scope: IModel.rootSubjectId,
        value: "physical model",
      }),
    });
    modelId = db.models.insertModel({
      classFullName: "BisCore:PhysicalModel",
      modeledElement: { id: partitionId },
    });
  }
  if (!categoryId) {
    categoryId = db.elements.insertElement({
      classFullName: "BisCore:SpatialCategory",
      model: IModel.dictionaryId,
      code: new Code({
        spec: db.codeSpecs.getByName(BisCodeSpec.spatialCategory).id,
        scope: IModel.dictionaryId,
        value: "spatial category",
      }),
    });
  }
  const elementClassName = "Generic:PhysicalObject";
  const elementId = db.elements.insertElement({
    classFullName: elementClassName,
    model: modelId,
    category: categoryId,
    code: Code.createEmpty(),
  } as ElementProps);
  return { className: elementClassName, id: elementId };
}
