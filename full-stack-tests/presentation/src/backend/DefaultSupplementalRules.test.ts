/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import { assert } from "@itwin/core-bentley";
import { BisCodeSpec, Code, ElementAspectProps, ElementProps, IModel } from "@itwin/core-common";
import { Presentation } from "@itwin/presentation-backend";
import { DefaultContentDisplayTypes, InstanceKey, KeySet, Ruleset } from "@itwin/presentation-common";
import { initialize, terminate } from "../IntegrationTests";
import { buildTestIModelDb, getFieldByLabel } from "../Utils";

describe("Default supplemental rules", async () => {
  before(async () => {
    await initialize();
  });

  after(async () => {
    await terminate();
  });

  describe("Overrides", () => {
    describe("Content modifiers", () => {
      it("removes 'Source Element ID' property", async function () {
        let elementKey: InstanceKey | undefined;
        const { db: imodel } = buildTestIModelDb(
          this.test!.fullTitle(),
          (db) => {
            const partitionId = db.elements.insertElement({
              classFullName: "BisCore:PhysicalPartition",
              model: IModel.repositoryModelId,
              parent: {
                relClassName: "BisCore:SubjectOwnsPartitionElements",
                id: IModel.rootSubjectId,
              },
              code: new Code({
                spec: db.codeSpecs.getByName(
                  BisCodeSpec.informationPartitionElement
                ).id,
                scope: IModel.rootSubjectId,
                value: "physical model",
              }),
            });
            const modelId = db.models.insertModel({
              classFullName: "BisCore:PhysicalModel",
              modeledElement: { id: partitionId },
            });
            const categoryId = db.elements.insertElement({
              classFullName: "BisCore:SpatialCategory",
              model: IModel.dictionaryId,
              code: new Code({
                spec: db.codeSpecs.getByName(BisCodeSpec.spatialCategory).id,
                scope: IModel.dictionaryId,
                value: "spatial category",
              }),
            });
            const elementClassName = "Generic:PhysicalObject";
            const elementId = db.elements.insertElement({
              classFullName: elementClassName,
              model: modelId,
              category: categoryId,
              code: Code.createEmpty(),
            } as ElementProps);
            db.elements.insertAspect({
              classFullName: "BisCore:ExternalSourceAspect",
              element: {
                relClassName: "BisCore:ElementOwnsExternalSourceAspects",
                id: elementId,
              },
              kind: "",
              identifier: "test identifier",
            } as ElementAspectProps);
            elementKey = { className: elementClassName, id: elementId };
          }
        );
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
        const descriptor = await Presentation.getManager().getContentDescriptor(
          {
            imodel,
            rulesetOrId: rules,
            displayType: DefaultContentDisplayTypes.PropertyPane,
            keys: new KeySet([elementKey!]),
          }
        );
        assert(!!descriptor);
        expect(descriptor.categories).to.not.containSubset([
          {
            label: "Source Information",
          },
        ]);
        expect(() =>
          getFieldByLabel(descriptor.fields, "Source Element ID")
        ).to.throw();
      });

      it("removes 'Source Information -> Model Source' properties", async function () {
        let elementKey: InstanceKey | undefined;
        const { db: imodel } = buildTestIModelDb(
          this.test!.fullTitle(),
          (db) => {
            const partitionId = db.elements.insertElement({
              classFullName: "BisCore:PhysicalPartition",
              model: IModel.repositoryModelId,
              parent: {
                relClassName: "BisCore:SubjectOwnsPartitionElements",
                id: IModel.rootSubjectId,
              },
              code: new Code({
                spec: db.codeSpecs.getByName(
                  BisCodeSpec.informationPartitionElement
                ).id,
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
            const categoryId = db.elements.insertElement({
              classFullName: "BisCore:SpatialCategory",
              model: IModel.dictionaryId,
              code: new Code({
                spec: db.codeSpecs.getByName(BisCodeSpec.spatialCategory).id,
                scope: IModel.dictionaryId,
                value: "spatial category",
              }),
            });
            const elementClassName = "Generic:PhysicalObject";
            const elementId = db.elements.insertElement({
              classFullName: elementClassName,
              model: modelId,
              category: categoryId,
              code: Code.createEmpty(),
            } as ElementProps);
            elementKey = { className: elementClassName, id: elementId };
          }
        );
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
        const descriptor = await Presentation.getManager().getContentDescriptor(
          {
            imodel,
            rulesetOrId: rules,
            displayType: DefaultContentDisplayTypes.PropertyPane,
            keys: new KeySet([elementKey!]),
          }
        );
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

      it("removes 'Source Information' ExternalSource properties", async function () {
        let elementKey: InstanceKey | undefined;
        const { db: imodel } = buildTestIModelDb(
          this.test!.fullTitle(),
          (db) => {
            const partitionId = db.elements.insertElement({
              classFullName: "BisCore:PhysicalPartition",
              model: IModel.repositoryModelId,
              parent: {
                relClassName: "BisCore:SubjectOwnsPartitionElements",
                id: IModel.rootSubjectId,
              },
              code: new Code({
                spec: db.codeSpecs.getByName(
                  BisCodeSpec.informationPartitionElement
                ).id,
                scope: IModel.rootSubjectId,
                value: "physical model",
              }),
            });
            const modelId = db.models.insertModel({
              classFullName: "BisCore:PhysicalModel",
              modeledElement: { id: partitionId },
            });
            const categoryId = db.elements.insertElement({
              classFullName: "BisCore:SpatialCategory",
              model: IModel.dictionaryId,
              code: new Code({
                spec: db.codeSpecs.getByName(BisCodeSpec.spatialCategory).id,
                scope: IModel.dictionaryId,
                value: "spatial category",
              }),
            });
            const elementClassName = "Generic:PhysicalObject";
            const elementId = db.elements.insertElement({
              classFullName: elementClassName,
              model: modelId,
              category: categoryId,
              code: Code.createEmpty(),
            } as ElementProps);
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
                id: elementId,
              },
              source: {
                relClassName: "BisCore:ElementIsFromSource",
                id: externalSourceId,
              },
              kind: "",
              identifier: "test identifier",
            } as ElementAspectProps);
            elementKey = { className: elementClassName, id: elementId };
          }
        );
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
        const descriptor = await Presentation.getManager().getContentDescriptor(
          {
            imodel,
            rulesetOrId: rules,
            displayType: DefaultContentDisplayTypes.PropertyPane,
            keys: new KeySet([elementKey!]),
          }
        );
        assert(!!descriptor);
        expect(descriptor.categories).to.not.containSubset([
          {
            label: "Source Information",
          },
        ]);
        expect(() => getFieldByLabel(descriptor.fields, "Name")).to.throw();
        expect(() => getFieldByLabel(descriptor.fields, "Path")).to.throw();
      });

      it("removes 'Source Information -> Secondary Sources' properties", async function () {
        let elementKey: InstanceKey | undefined;
        const { db: imodel } = buildTestIModelDb(
          this.test!.fullTitle(),
          (db) => {
            const partitionId = db.elements.insertElement({
              classFullName: "BisCore:PhysicalPartition",
              model: IModel.repositoryModelId,
              parent: {
                relClassName: "BisCore:SubjectOwnsPartitionElements",
                id: IModel.rootSubjectId,
              },
              code: new Code({
                spec: db.codeSpecs.getByName(
                  BisCodeSpec.informationPartitionElement
                ).id,
                scope: IModel.rootSubjectId,
                value: "physical model",
              }),
            });
            const modelId = db.models.insertModel({
              classFullName: "BisCore:PhysicalModel",
              modeledElement: { id: partitionId },
            });
            const categoryId = db.elements.insertElement({
              classFullName: "BisCore:SpatialCategory",
              model: IModel.dictionaryId,
              code: new Code({
                spec: db.codeSpecs.getByName(BisCodeSpec.spatialCategory).id,
                scope: IModel.dictionaryId,
                value: "spatial category",
              }),
            });
            const elementClassName = "Generic:PhysicalObject";
            const elementId = db.elements.insertElement({
              classFullName: elementClassName,
              model: modelId,
              category: categoryId,
              code: Code.createEmpty(),
            } as ElementProps);
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
                id: elementId,
              },
              source: {
                relClassName: "BisCore:ElementIsFromSource",
                id: externalSourceGroupId,
              },
              kind: "",
              identifier: "test identifier",
            } as ElementAspectProps);
            elementKey = { className: elementClassName, id: elementId };
          }
        );
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
        const descriptor = await Presentation.getManager().getContentDescriptor(
          {
            imodel,
            rulesetOrId: rules,
            displayType: DefaultContentDisplayTypes.PropertyPane,
            keys: new KeySet([elementKey!]),
          }
        );
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
