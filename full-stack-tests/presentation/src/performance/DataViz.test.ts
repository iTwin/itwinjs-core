/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
/* eslint-disable no-console */

import { assert, Guid, Id64String, OrderedId64Iterable, StopWatch } from "@itwin/core-bentley";
import { QueryBinder } from "@itwin/core-common";
import { IModelApp, IModelConnection } from "@itwin/core-frontend";
import {
  ClassInfo,
  Content,
  ContentSpecificationTypes,
  DefaultContentDisplayTypes,
  Descriptor,
  Field,
  KeySet,
  PropertiesField,
  PropertiesFieldDescriptor,
  Ruleset,
  RuleTypes,
  Value,
} from "@itwin/presentation-common";
import { Presentation } from "@itwin/presentation-frontend";
import { parseFullClassName } from "@itwin/presentation-shared";
import { initialize, terminate, testLocalization } from "../IntegrationTests.js";
import { collect, getFieldsByLabel } from "../Utils.js";
import { TestIModelConnection } from "../IModelSetupUtils.js";
import { SchemaFormatsProvider } from "@itwin/ecschema-metadata";

/**
 * The below specifies what iModel to use and what Fields (properties) to use for simulating DataViz
 * component behavior. The fields should be picked based on the iModel.
 */

// Recommended iModel - the "Bay Town Process Plant" sample
const PATH_TO_IMODEL = "BayTownProcessPlant.bim";
const TESTED_PROPERTY_LABELS = [
  // good for testing direct property
  "Active Item",

  // good for testing property that's on both - direct and related - instances
  "Total Weight",
];

describe("#performance DataViz requests", () => {
  let iModel: IModelConnection;
  let descriptor: Descriptor;

  before(async () => {
    await initialize({
      imodelAppProps: {
        localization: testLocalization,
      },
      presentationFrontendProps: {
        presentation: {
          activeLocale: "en",
        },
      },
    });
    iModel = TestIModelConnection.openFile(PATH_TO_IMODEL);
    descriptor = (await Presentation.presentation.getContentDescriptor({
      imodel: iModel,
      rulesetOrId: {
        id: `BIG`,
        rules: [
          {
            ruleType: RuleTypes.Content,
            specifications: [
              {
                specType: ContentSpecificationTypes.ContentInstancesOfSpecificClasses,
                classes: {
                  schemaName: "BisCore",
                  classNames: ["GeometricElement"],
                  arePolymorphic: true,
                },
                handlePropertiesPolymorphically: true,
              },
            ],
          },
        ],
      },
      displayType: DefaultContentDisplayTypes.PropertyPane,
      keys: new KeySet(),
    }))!;
    IModelApp.formatsProvider = new SchemaFormatsProvider(iModel.schemaContext);
  });

  after(async () => {
    await iModel.close();
    await terminate();
  });

  TESTED_PROPERTY_LABELS.forEach((filteredFieldLabel) => {
    describe(`Property: "${filteredFieldLabel}"`, () => {
      let filteredFields: PropertiesField[];

      before(async () => {
        // There may be multiple fields with the same label. E.g. a direct field and several fields from related instances
        filteredFields = getFieldsByLabel(descriptor.fields, filteredFieldLabel) as PropertiesField[];
        console.log(`Using ${filteredFields.length} fields for filtering`);
      });

      it("gets distinct values", async () => {
        const {
          requestsCount: suggestedRequestsCount,
          requestsTime: suggestedRequestsTime,
          distinctValues: suggestedDistinctValues,
        } = await getDistinctValuesSuggested();
        console.log(`Suggested implementation took ${suggestedRequestsTime} s. with ${suggestedRequestsCount} requests.`);
        console.log(`Total distinct values: ${suggestedDistinctValues.size}`);
      });

      /**
       * The suggested approach:
       * 1. find the fields that're going to be used for DataViz by label (done at the `before` step)
       * 2. find all root classes
       * 3. create a single ruleset that covers all classes found at step #2
       * 4. make a `getPagedDistinctValues` request for every filtered field
       *
       * The amount of `getPagedDistinctValues` requests made is: `{filtered fields count}`
       */
      async function getDistinctValuesSuggested() {
        // get all unique root class names
        const classNames = new Set<string>();
        for (const filteredField of filteredFields) {
          const { rootField } = getRootField(filteredField);
          if (rootField.isNestedContentField()) {
            const path = rootField.pathToPrimaryClass;
            classNames.add(path[path.length - 1].targetClassInfo.name);
          } else if (rootField.isPropertiesField()) {
            rootField.properties.forEach((p) => classNames.add(p.property.classInfo.name));
          }
        }

        // create a ruleset that covers all root classes
        const ruleset: Ruleset = {
          id: `DataViz/DistinctValues/${Guid.createValue()}`,
          rules: [
            {
              ruleType: RuleTypes.Content,
              specifications: [
                {
                  specType: ContentSpecificationTypes.ContentInstancesOfSpecificClasses,
                  classes: [...classNames].map(parseFullClassName).map(({ schemaName, className }) => ({
                    schemaName,
                    classNames: [className],
                    arePolymorphic: true,
                  })),
                },
              ],
            },
          ],
        };

        let requestsCount = 0;
        const timer = new StopWatch("", true);

        // make a `getPagedDistinctValues` request with the above ruleset for every filtered field
        const distinctValues = new Map<string, Set<Value>>();
        for (const filteredField of filteredFields) {
          const { items } = await Presentation.presentation.getDistinctValuesIterator({
            imodel: iModel,
            rulesetOrId: ruleset,
            keys: new KeySet(),
            descriptor: descriptor.createDescriptorOverrides(),
            fieldDescriptor: filteredField.getFieldDescriptor(),
          });

          for await (const dv of items) {
            // eslint-disable-next-line @typescript-eslint/no-base-to-string
            const displayValue = dv.displayValue ? dv.displayValue.toString() : "";
            pushValues(distinctValues, displayValue, dv.groupedRawValues);
          }
          ++requestsCount;
        }

        return { requestsCount, requestsTime: timer.currentSeconds, distinctValues };
      }

      it("get grouped element IDs", async () => {
        // this is needed as input for the tasks we test
        const { distinctValues } = await getDistinctValuesSuggested();
        const {
          requestsCount: suggestedRequestsCount,
          requestsTime: suggestedRequestsTime,
          entries: suggestedEntries,
        } = await getGroupedElementIdsSuggested(distinctValues);
        console.log(
          `Suggested implementation took ${suggestedRequestsTime} s. with ${suggestedRequestsCount.elementIds} requests for direct element IDs and ${suggestedRequestsCount.childElementIds} for child element IDs.`,
        );

        const totals = [...suggestedEntries.values()].reduce<{ e: number; c: number }>(
          (t, curr) => ({ e: t.e + curr.elementIds.length, c: t.c + curr.childIds.length }),
          { e: 0, c: 0 },
        );
        console.log(`Total ${suggestedEntries.size} distinct values with ${totals.e} elements and ${totals.c} child elements.`);

        // list element IDs that are associated with multiple distinct value entries
        detectIntersections(suggestedEntries);
      });

      /**
       * The suggested approach:
       * 1. Group all filtered fields based on their root content class.
       * 2. For every unique root content class:
       *    2.1. Build a single content ruleset that polymorphically selects from the class
       *    2.2. Make a `getContent` request to get IDs + filtered field values (may want to do this in pages).
       *    2.3. Read the result row by row and put ID associated with the row into a distinct value bucked based on field value.
       * 3. Make a `getChildElementIds` request for every distinct value entry.
       *
       * The amount of requests made is: `{number of unique filtered field classes} + {number of distinct values}`.
       */
      async function getGroupedElementIdsSuggested(distinctValues: Map<string, Set<Value>>) {
        const requestsCount = {
          elementIds: 0,
          childElementIds: 0,
        };
        const timer = new StopWatch("", true);

        // group filtered fields by their root content classes
        const selectClasses = new Map<Id64String, { class: ClassInfo; fields: Array<{ rootField: Field; filteredField: Field; stack: Field[] }> }>();
        for (const filteredField of filteredFields) {
          const { rootField, path: stack } = getRootField(filteredField);
          if (rootField.isNestedContentField()) {
            const targetClassInfo = rootField.pathToPrimaryClass[rootField.pathToPrimaryClass.length - 1].targetClassInfo;
            const entry = selectClasses.get(targetClassInfo.id);
            if (entry) {
              entry.fields.push({ filteredField, rootField, stack });
            } else {
              selectClasses.set(targetClassInfo.id, { class: targetClassInfo, fields: [{ filteredField, rootField, stack }] });
            }
          } else if (rootField.isPropertiesField()) {
            rootField.properties.forEach((p) => {
              const propertyClass = p.property.classInfo;
              const entry = selectClasses.get(propertyClass.id);
              if (entry) {
                entry.fields.push({ filteredField, rootField, stack });
              } else {
                selectClasses.set(propertyClass.id, { class: propertyClass, fields: [{ filteredField, rootField, stack }] });
              }
            });
          }
        }

        const elementEntries = new Map<string, Set<Id64String>>();

        // read the content once for every unique class
        for (const selectClassEntry of selectClasses.values()) {
          const { class: selectClass, fields: classFields } = selectClassEntry;
          const [schemaName, className] = selectClass.name.split(":");
          const ruleset: Ruleset = {
            id: `DataVizLegend/Elements/${selectClass.name}`,
            rules: [
              {
                ruleType: RuleTypes.Content,
                specifications: [
                  {
                    specType: ContentSpecificationTypes.ContentInstancesOfSpecificClasses,
                    classes: {
                      schemaName,
                      classNames: [className],
                      arePolymorphic: true,
                    },
                  },
                ],
              },
            ],
          };

          // retrieve the content with just the filtered properties
          const content = await Presentation.presentation
            .getContentIterator({
              imodel: iModel,
              rulesetOrId: ruleset,
              descriptor: {
                fieldsSelector: {
                  type: "include",
                  fields: classFields.map((classField) => classField.filteredField.getFieldDescriptor()),
                },
              },
              keys: new KeySet(),
            })
            .then(async (x) => x && new Content(x.descriptor, await collect(x.items)));
          assert(!!content);
          ++requestsCount.elementIds;

          // field names might be different in the newly retrieved content - need to map old ones to new ones
          const remappedClassFields = classFields.map(({ filteredField }) => {
            const remappedField = content.descriptor.getFieldByDescriptor(filteredField.getFieldDescriptor(), true)!;
            return {
              filteredField: remappedField,
              path: createFieldsPathFromRootToTarget(remappedField),
            };
          });

          // associate element IDs with correct distinct value entry based on property value
          for (const { filteredField, path: fieldsStack } of remappedClassFields) {
            for (const item of content.contentSet) {
              let containsValue = true;
              let rawValues = item.values;
              let displayValues = item.displayValues;
              for (let i = 0; i < fieldsStack.length - 1; ++i) {
                const nestedContent = rawValues[fieldsStack[i].name];
                if (nestedContent === undefined || (Value.isNestedContent(nestedContent) && nestedContent.length === 0)) {
                  containsValue = false;
                  break;
                }
                assert(Value.isNestedContent(nestedContent));
                rawValues = nestedContent[0].values;
                displayValues = nestedContent[0].displayValues;
              }
              if (!containsValue) {
                continue;
              }
              if (!displayValues.hasOwnProperty(filteredField.name)) {
                continue;
              }

              // eslint-disable-next-line @typescript-eslint/no-base-to-string
              const displayValue = (displayValues[filteredField.name] ?? "").toString();
              assert(
                distinctValues.has(displayValue),
                () =>
                  `Unexpected distinct value "${displayValue}" for field "${filteredField.name}. Available distinct values are: [${[...distinctValues.keys()].join(", ")}]"`,
              );
              pushValues(
                elementEntries,
                displayValue,
                item.primaryKeys.map((k) => k.id),
              );
            }
          }
        }

        // Similar to the "current" approach, we need to recursively get child element IDs. But in this case
        // we request them per display value entry rather than per every unique class for the entry.
        const entries = new Map<string, { elementIds: Id64String[]; childIds: Id64String[] }>();
        await Promise.all(
          [...elementEntries].map(async (entry) => {
            const [displayValue, elementIds] = entry;
            let childIds: Id64String[] = [];
            if (elementIds.size > 0) {
              ++requestsCount.childElementIds;
              childIds = await loadChildElementIds(iModel, [...elementIds]);
            }
            entries.set(displayValue, { elementIds: [...elementIds], childIds });
          }),
        );

        return { requestsCount, requestsTime: timer.currentSeconds, entries };
      }
    });
  });
});

function pushValues<TValue>(target: Map<string, Set<TValue>>, key: string, values: TValue[]) {
  const entry = target.get(key);
  if (entry) {
    values.forEach((v) => entry.add(v));
  } else {
    target.set(key, new Set(values));
  }
}

async function loadChildElementIds(iModel: IModelConnection, parentIds: Id64String[]) {
  const childIds: Id64String[] = [];
  const childElementIdsQuery = `
    with recursive children(id) as (
        select ECInstanceId from bis.Element where InVirtualSet(?, Parent.Id)
        union all
        select ECInstanceId from bis.Element join children on children.id = Parent.Id
    )
    select * from children
  `;
  for await (const row of iModel.createQueryReader(childElementIdsQuery, new QueryBinder().bindIdSet(1, OrderedId64Iterable.sortArray(parentIds)))) {
    childIds.push(row[0]);
  }
  return childIds;
}

function createFieldsPathFromRootToTarget(target: Field) {
  const path: Field[] = [target];
  let rootField: Field = target;
  while (rootField.parent) {
    rootField = rootField.parent;
    path.push(rootField);
  }
  path.reverse();
  return path;
}

function getRootField(field: PropertiesField) {
  const path = createFieldsPathFromRootToTarget(field);
  return {
    rootField: path[0],
    pathFromRootToPropertiesField: (field.getFieldDescriptor() as PropertiesFieldDescriptor).pathFromSelectToPropertyClass,
    path,
  };
}

function detectIntersections(distinctValueElementIds: Map<string, { elementIds: Id64String[]; childIds: Id64String[] }>) {
  const arr = [...distinctValueElementIds];
  for (let i = 0; i < arr.length; ++i) {
    for (let j = i + 1; j < arr.length; ++j) {
      const [lhsDistinctValue, lhsIds] = arr[i];
      const [rhsDistinctValue, rhsIds] = arr[j];
      const commonIds = intersectIds(lhsIds.elementIds, rhsIds.elementIds);
      if (commonIds.length > 0) {
        console.warn(`Detected IDs intersection between "${lhsDistinctValue}" and "${rhsDistinctValue}": ${commonIds.toString()}`);
      }
    }
  }
}

function intersectIds(lhs: Id64String[], rhs: Id64String[]) {
  return lhs.filter((lhsId) => rhs.includes(lhsId));
}
