/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/* eslint-disable no-console */
import { expect } from "chai";
import type { Id64String} from "@itwin/core-bentley";
import { assert, Guid, OrderedId64Iterable, StopWatch } from "@itwin/core-bentley";
import { QueryBinder, QueryRowFormat } from "@itwin/core-common";
import type { IModelConnection} from "@itwin/core-frontend";
import { SnapshotConnection } from "@itwin/core-frontend";
import type { ClassInfo, Descriptor, Field, InstanceKey,
  PropertiesField, PropertiesFieldDescriptor, PropertyInfo, Ruleset, StrippedRelationshipPath} from "@itwin/presentation-common";
import {
  ChildNodeSpecificationTypes, ContentSpecificationTypes, DefaultContentDisplayTypes, KeySet, NodeKey, RelationshipDirection, RuleTypes, Value,
} from "@itwin/presentation-common";
import { Presentation } from "@itwin/presentation-frontend";
import type { ECClassInfo } from "../ECClasHierarchy";
import { ECClassHierarchy } from "../ECClasHierarchy";
import { initialize, terminate } from "../IntegrationTests";
import { getFieldsByLabel } from "../Utils";

/**
 * The below specifies what iModel to use and what Fields (properties) to use for simulating DataViz
 * component behavior. The fields should be picked based on the iModel.
 */

// Recommended iModel:
// https://qa-connect-imodelhubwebsite.bentley.com/Context/892aa2c9-5be8-4865-9f37-7d4c7e75ebbf/iModel/ed0c408b-add2-496e-ac58-5a7e853cbc0b
const iModelFileName = "S - Bayer - Plantsight connection_dtr-27be16d959645985fca80cff502bd237b82f0f84.bim";
const testedPropertyLabels = [
  // good for testing direct property
  "Active Item",

  // good for testing property that's on both - direct and related - instances
  "Total Weight",
];

describe("#performance DataViz requests", () => {
  let iModel: IModelConnection;
  let classHierarchy: ECClassHierarchy;
  let descriptor: Descriptor;

  before(async () => {
    await initialize();
    iModel = await SnapshotConnection.openFile(`assets/datasets/${iModelFileName}`);
    classHierarchy = await ECClassHierarchy.create(iModel);
    descriptor = (await Presentation.presentation.getContentDescriptor({
      imodel: iModel,
      rulesetOrId: {
        id: `BIG`,
        rules: [{
          ruleType: RuleTypes.Content,
          specifications: [{
            specType: ContentSpecificationTypes.ContentInstancesOfSpecificClasses,
            classes: {
              schemaName: "BisCore",
              classNames: ["GeometricElement"],
              arePolymorphic: true,
            },
            handlePropertiesPolymorphically: true,
          }],
        }],
      },
      displayType: DefaultContentDisplayTypes.PropertyPane,
      keys: new KeySet(),
    }))!;
  });

  after(async () => {
    await iModel.close();
    await terminate();
  });

  testedPropertyLabels.forEach((filteredFieldLabel) => {

    describe(`Property: "${filteredFieldLabel}"`, () => {
      let filteredFields: PropertiesField[];

      before(async () => {
        // There may be multiple fields with the same label. E.g. a direct field and several fields from related instances
        filteredFields = getFieldsByLabel(descriptor.fields, filteredFieldLabel) as PropertiesField[];
        console.log(`Using ${filteredFields.length} fields for filtering`);
      });

      it("gets distinct values", async () => {
        const { requestsCount: currentRequestsCount, requestsTime: currentRequestsTime, distinctValues: currentDistinctValues } = await getDistinctValuesCurrent();
        console.log(`Current implementation took ${currentRequestsTime} s. with ${currentRequestsCount} requests.`);

        const { requestsCount: suggestedRequestsCount, requestsTime: suggestedRequestsTime, distinctValues: suggestedDistinctValues } = await getDistinctValuesSuggested();
        console.log(`Suggested implementation took ${suggestedRequestsTime} s. with ${suggestedRequestsCount} requests.`);

        console.log(`Total distinct values: ${suggestedDistinctValues.size}`);

        // ensure both approaches produce the same result
        expect(suggestedDistinctValues).to.deep.eq(currentDistinctValues);
      });

      /**
       * Here's how this works in DR:
       * 1. find the fields that're going to be used for DataViz by label (done at the `before` step)
       * 2. find classes of all filtered fields
       * 3. create a non-polymorphic ruleset for every class found in step #2
       * 4. make a `getPagedDistinctValues` request for every ruleset created in step #3
       *
       * The amount of `getPagedDistinctValues` requests made is: `{filtered fields count} * {properties count per field}`
       */
      async function getDistinctValuesCurrent() {
        const timer = new StopWatch("", true);
        const distinctValues = new Map<string, Set<Value>>();
        let requestsCount = 0;

        // every field is handled separately
        for (const filteredField of filteredFields) {
          // for every property in the properties field, run a query to get a list of classes
          const classes: ECClassInfo[] = [];
          for (const { property: filteredProperty } of filteredField.properties) {
            if (filteredField.parent) {
              const { rootField } = getRootField(filteredField);
              assert(rootField.isNestedContentField());
              classes.push(await classHierarchy.getClassInfoById(rootField.contentClassInfo.id));
            } else {
              // this simulates DR's behavior:
              // 1. find all subclasses of property class that have instances
              // 2. take all their base classes up until the bis.GeometricElement
              // I don't understand the purpose of the second step, because the rulesets are set up to select non-polymorphically
              // and using any class that has no instances is just a waste of time.
              const [schemaName, className] = filteredProperty.classInfo.name.split(":");
              const classesQuery = `
              select hh.SourceECInstanceId as classId
              from meta.classhasallbaseclasses hh
              join meta.ecclassdef bc on bc.ecinstanceid = hh.targetecinstanceid
              join meta.ecschemadef bs on bs.ecinstanceid = bc.schema.id
              where bs.name = '${schemaName}' and bc.name = '${className}'
                and hh.sourceecinstanceid in (
                  select h.targetecinstanceid
                  from meta.classhasallbaseclasses h
                  where h.sourceecinstanceid in (select ECClassId from BisCore.GeometricElement)
                )
            `;
              for await (const { classId } of iModel.query(classesQuery, undefined, { rowFormat: QueryRowFormat.UseJsPropertyNames })) {
                classes.push(await classHierarchy.getClassInfoById(classId));
              }
            }
          }

          // create a ruleset for every class we found
          const rulesets = classes.map((classInfo): Ruleset => ({
            id: `DataViz/${classInfo.schemaName}/${classInfo.name}/${filteredField.label}`,
            rules: [{
              ruleType: RuleTypes.Content,
              specifications: [{
                specType: ContentSpecificationTypes.ContentInstancesOfSpecificClasses,
                classes: {
                  schemaName: classInfo.schemaName,
                  classNames: [classInfo.name],
                  arePolymorphic: false,
                },
              }],
            }],
          }));

          // make a `getPagedDistinctValues` request for every ruleset and merge the values into a single map
          await Promise.all(rulesets.map(async (ruleset) => {
            ++requestsCount;
            const res = await Presentation.presentation.getPagedDistinctValues({
              imodel: iModel,
              rulesetOrId: ruleset,
              descriptor: {},
              keys: new KeySet(),
              fieldDescriptor: filteredField.getFieldDescriptor(),
            });
            res.items.map((dv) => {
              const displayValue = dv.displayValue ? dv.displayValue.toString() : "";
              pushValues(distinctValues, displayValue, dv.groupedRawValues);
            });
          }));
        }
        return { requestsCount, requestsTime: timer.currentSeconds, distinctValues };
      }

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
        // get all unique root class IDs
        const classIds = new Set<Id64String>();
        for (const filteredField of filteredFields) {
          const { rootField } = getRootField(filteredField);
          if (rootField.isNestedContentField()) {
            const path = rootField.pathToPrimaryClass;
            classIds.add(path[path.length - 1].targetClassInfo.id);
          } else if (rootField.isPropertiesField()) {
            rootField.properties.forEach((p) => classIds.add(p.property.classInfo.id));
          }
        }
        // get all root class infos
        const classes = await Promise.all([...classIds].map(async (classId) => classHierarchy.getClassInfoById(classId)));

        // create a ruleset that covers all root classes
        const ruleset: Ruleset = {
          id: `DataViz/DistinctValues/${Guid.createValue()}`,
          rules: [{
            ruleType: RuleTypes.Content,
            specifications: [{
              specType: ContentSpecificationTypes.ContentInstancesOfSpecificClasses,
              classes: classes.map((classInfo) => ({
                schemaName: classInfo.schemaName,
                classNames: [classInfo.name],
                arePolymorphic: true,
              })),
            }],
          }],
        };

        let requestsCount = 0;
        const timer = new StopWatch("", true);

        // make a `getPagedDistinctValues` request with the above ruleset for every filtered field
        const distinctValues = new Map<string, Set<Value>>();
        for (const filteredField of filteredFields) {
          const res = await Presentation.presentation.getPagedDistinctValues({
            imodel: iModel,
            rulesetOrId: ruleset,
            keys: new KeySet(),
            descriptor: descriptor.createDescriptorOverrides(),
            fieldDescriptor: filteredField.getFieldDescriptor(),
          });
          res.items.map((dv) => {
            const displayValue = dv.displayValue ? dv.displayValue.toString() : "";
            pushValues(distinctValues, displayValue, dv.groupedRawValues);
          });
          ++requestsCount;
        }

        return { requestsCount, requestsTime: timer.currentSeconds, distinctValues };
      }

      it("get grouped element IDs", async () => {
        // this is needed as input for the tasks we test
        const { distinctValues } = await getDistinctValuesSuggested();

        const { requestsCount: currentRequestsCount, requestsTime: currentRequestsTime, entries: currentEntries } = await getGroupedElementIdsCurrent(distinctValues);
        console.log(`Current implementation took ${currentRequestsTime} s. with ${currentRequestsCount.elementIds} requests for direct element IDs and ${currentRequestsCount.childElementIds} for child element IDs.`);

        const { requestsCount: suggestedRequestsCount, requestsTime: suggestedRequestsTime, entries: suggestedEntries } = await getGroupedElementIdsSuggested(distinctValues);
        console.log(`Suggested implementation took ${suggestedRequestsTime} s. with ${suggestedRequestsCount.elementIds} requests for direct element IDs and ${suggestedRequestsCount.childElementIds} for child element IDs.`);

        const totals = [...suggestedEntries.values()].reduce<{ e: number, c: number }>((t, curr) => ({ e: t.e + curr.elementIds.length, c: t.c + curr.childIds.length }), { e: 0, c: 0 });
        console.log(`Total ${suggestedEntries.size} distinct values with ${totals.e} elements and ${totals.c} child elements.`);

        // ensure both approaches produce the same result
        expect(suggestedEntries.size).to.eq(currentEntries.size);
        for (const [label, ids] of suggestedEntries) {
          const currentEntry = currentEntries.get(label);
          expect(currentEntry).to.not.be.undefined;
          expect(ids.elementIds.sort()).to.deep.eq(currentEntry!.elementIds.sort());
          expect(ids.childIds.sort()).to.deep.eq(currentEntry!.childIds.sort());
        }

        // list element IDs that are associated with multiple distinct value entries
        detectIntersections(currentEntries);
      });

      /**
       * Here's how this works in DR:
       * (precondition) When getting distinct values, classes that contains those values are also retrieved. Each of
       * those classes gets a hierarchy ruleset and each of those rulesets are associated with the distinct value entry.
       *
       * When the legend is opened, DR needs to get IDs of elements for every distinct value entry. To do that, it:
       * 1. loads all hierarchies for all rulesets associated with the distinct value entry
       * 2. gets element IDs from loaded hierarchies
       * 3. for every hierarchy, sends a request to get child element IDs.
       *
       * The amount of requests made is: `{filtered properties count} * {number of leaf class containing the property} * 3`.
       *
       * The multiplier `3` is used because hierarchy depth is `2` (at least 2 requests are needed to get the hierarchy) plus every hierarchy
       * containing nodes gets a `getChildNodeIds` request.
       */
      async function getGroupedElementIdsCurrent(distinctValues: Map<string, Set<Value>>) {
        // creating rulesets for each distinct value is not included in the measured time as DR does that when
        // getting distinct values
        const distinctValueRulesets = new Map<string, Set<Ruleset>>();
        const createWhereClause = (propertyClassAlias: string, filteredProperty: PropertyInfo, values: Value[]) => {
          return values.reduce((filter, rawValue) => {
            if (filter !== "")
              filter += " OR ";
            filter += `${propertyClassAlias}.${filteredProperty.name}`;
            if (rawValue === undefined || rawValue === null)
              filter += " IS NULL";
            else
              filter += ` = ${filteredProperty.type.toLowerCase() === "string" ? `'${rawValue}'` : rawValue}`;
            return filter;
          }, "");
        };
        // every field is handled separately
        for (const filteredField of filteredFields) {
          // find and group all classes that have instances with each individual distinct value
          const displayValueEntries = new Map<string, Set<{ contentClassId: Id64String, pathFromContentToPropertyClass: StrippedRelationshipPath, filteredProperty: PropertyInfo, rawValues: Value[] }>>();
          const readEntries = async (queryBase: string, propertyClassAlias: string, filteredProperty: PropertyInfo, pathFromContentToPropertyClass: StrippedRelationshipPath) => {
            for (const distinctValuesEntry of distinctValues) {
              const [displayValue, rawValues] = distinctValuesEntry;
              const filteredClassesQuery = `${queryBase}${createWhereClause(propertyClassAlias, filteredProperty, [...rawValues])}`;
              for await (const { classId } of iModel.query(filteredClassesQuery, undefined, { rowFormat: QueryRowFormat.UseJsPropertyNames })) {
                pushValues(displayValueEntries, displayValue, [{ contentClassId: classId, pathFromContentToPropertyClass, filteredProperty, rawValues: [...rawValues] }]);
              }
            }
          };
          // create a different query based on whether the filtered field is root or related field
          const { rootField, pathFromRootToPropertiesField } = getRootField(filteredField);
          if (rootField.isPropertiesField()) {
            for (const { property: filteredProperty } of filteredField.properties) {
              const [schemaName, className] = filteredProperty.classInfo.name.split(":");
              const classesQueryBase = `
                select DISTINCT e.ECClassId classId
                from ${schemaName}.${className} e
                where
              `;
              await readEntries(classesQueryBase, "e", filteredProperty, []);
            }
          } else if (rootField.isNestedContentField()) {
            const filteredProperty = filteredField.properties[0].property;
            const contentClass = rootField.pathToPrimaryClass[rootField.pathToPrimaryClass.length - 1].targetClassInfo;
            const [schemaName, className] = contentClass.name.split(":");
            let classesQueryBase = `
              select DISTINCT e.ECClassId classId
              from ${schemaName}.${className} e
            `;
            let propertyClassAlias = "e";
            pathFromRootToPropertiesField.forEach((step, i) => {
              classesQueryBase += `
                join ${step.relationshipName.replace(":", ".")} r${i} on r${i}.sourceecinstanceid = ${i === 0 ? "e" : `c${i - 1}`}.ecinstanceid
                join ${step.targetClassName.replace(":", ".")} c${i} on c${i}.ecinstanceid = r${i}.targetecinstanceid
              `;
              propertyClassAlias = `c${i}`;
            });
            classesQueryBase += " where ";
            await readEntries(classesQueryBase, propertyClassAlias, filteredProperty, pathFromRootToPropertiesField);
          }

          // Create ruleset for each distinct values entry. Each entry has rulesets for every class that contains the property.
          for (const [displayValue, entries] of displayValueEntries) {
            const rulesets: Ruleset[] = [];
            for (const { contentClassId, pathFromContentToPropertyClass, filteredProperty, rawValues } of entries) {
              const contentClassInfo = await classHierarchy.getClassInfoById(contentClassId);
              const propertyClassAlias = pathFromContentToPropertyClass.length === 0 ? "this" : "related";
              rulesets.push({
                id: `DataVizLegend/${contentClassInfo.schemaName}:${contentClassInfo.name}/${filteredProperty.name}=${displayValue}`,
                rules: [{
                  ruleType: RuleTypes.RootNodes,
                  specifications: [{
                    specType: ChildNodeSpecificationTypes.InstanceNodesOfSpecificClasses,
                    classes: { schemaName: contentClassInfo.schemaName, classNames: [contentClassInfo.name], arePolymorphic: false },
                    relatedInstances: pathFromContentToPropertyClass.length > 0 ? [{
                      relationshipPath: pathFromContentToPropertyClass.map((step) => {
                        const [relationshipSchemaName, relationshipClassName] = step.relationshipName.split(":");
                        const [targetSchemaName, targetClassName] = step.targetClassName.split(":");
                        return {
                          relationship: { schemaName: relationshipSchemaName, className: relationshipClassName },
                          direction: step.isForwardRelationship ? RelationshipDirection.Forward : RelationshipDirection.Backward,
                          targetClass: { schemaName: targetSchemaName, className: targetClassName },
                        };
                      }),
                      isRequired: true,
                      alias: propertyClassAlias,
                    }] : [],
                    instanceFilter: rawValues.reduce<string>((filter, rawValue) => {
                      if (filter !== "")
                        filter += " OR ";
                      filter += `${propertyClassAlias}.${filteredProperty.name} = `;
                      if (rawValue === undefined || rawValue === null)
                        filter += "NULL";
                      else if (filteredProperty.type.toLowerCase() === "string")
                        filter += `'${rawValue}'`;
                      else
                        filter += rawValue;
                      return filter;
                    }, ""),
                    groupByClass: true,
                    groupByLabel: false,
                    doNotSort: true,
                  }],
                }],
              });
            }
            pushValues(distinctValueRulesets, displayValue, rulesets);
          }
        }
        for (const [label, rulesets] of distinctValueRulesets)
          console.log(`Created ${rulesets.size} rulesets for "${label}"`);

        // Load all hierarchies and capture all element IDs. Then for every hierarchy send a request to
        // recursively get child element IDs.
        const timer = new StopWatch("", true);
        const requestsCount = {
          elementIds: 0,
          childElementIds: 0,
        };
        const idEntries = new Map<string, { elementIds: Id64String[], childIds: Id64String[] }>();
        async function loadHierarchy(ruleset: Ruleset, parentKey?: NodeKey): Promise<InstanceKey[]> {
          ++requestsCount.elementIds;
          const nodes = await Presentation.presentation.getNodes({
            imodel: iModel,
            rulesetOrId: ruleset,
            parentKey,
          });
          const keysPerNode = await Promise.all(nodes.map(async (node) => {
            const keys: InstanceKey[] = [];
            const key = node.key;
            if (NodeKey.isInstancesNodeKey(key)) {
              keys.push(...key.instanceKeys);
            }
            if (node.hasChildren)
              keys.push(...await loadHierarchy(ruleset, key));
            return keys;
          }));
          return keysPerNode.reduce((keys, curr) => [...keys, ...curr], []);
        }
        await Promise.all([...distinctValueRulesets].map(async (entry) => {
          const [label, rulesets] = entry;
          await Promise.all([...rulesets].map(async (ruleset) => {
            const elementKeys = await loadHierarchy(ruleset, undefined);
            const elementIds = elementKeys.map((k) => k.id);
            let childIds: Id64String[] = [];
            if (elementKeys.length > 0) {
              ++requestsCount.childElementIds;
              childIds = await loadChildElementIds(iModel, elementIds);
            }
            const target = idEntries.get(label);
            if (target) {
              target.elementIds.push(...elementIds);
              target.childIds.push(...childIds);
            } else {
              idEntries.set(label, { elementIds, childIds });
            }
          }));
        }));
        return { requestsCount, requestsTime: timer.currentSeconds, entries: idEntries };
      }

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
        const selectClasses = new Map<Id64String, { class: ClassInfo, fields: Array<{ rootField: Field, filteredField: Field, stack: Field[] }> }>();
        for (const filteredField of filteredFields) {
          const { rootField, stack } = getRootField(filteredField);
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
            rules: [{
              ruleType: RuleTypes.Content,
              specifications: [{
                specType: ContentSpecificationTypes.ContentInstancesOfSpecificClasses,
                classes: {
                  schemaName,
                  classNames: [className],
                  arePolymorphic: true,
                },
              }],
            }],
          };

          // retrieve the content with just the filtered properties
          const content = await Presentation.presentation.getContent({
            imodel: iModel,
            rulesetOrId: ruleset,
            descriptor: {
              fieldsSelector: {
                type: "include",
                fields: classFields.map((classField) => classField.filteredField.getFieldDescriptor()),
              },
            },
            keys: new KeySet(),
          });
          ++requestsCount.elementIds;

          // associate element IDs with correct distinct value entry based on property value
          for (const { filteredField, stack: fieldsStack } of classFields) {
            for (const item of content!.contentSet) {
              let containsValue = true;
              let rawValues = item.values;
              let displayValues = item.displayValues;
              for (let i = 0; i < fieldsStack.length - 1; ++i) {
                const nestedContent = rawValues[fieldsStack[i].name];
                if (nestedContent === undefined || Value.isNestedContent(nestedContent) && nestedContent.length === 0) {
                  containsValue = false;
                  break;
                }
                assert(Value.isNestedContent(nestedContent));
                rawValues = nestedContent[0]!.values;
                displayValues = nestedContent[0]!.displayValues;
              }
              if (!containsValue)
                continue;
              if (!displayValues.hasOwnProperty(filteredField.name))
                continue;

              const displayValue = (displayValues[filteredField.name] ?? "").toString();
              assert(distinctValues.has(displayValue));
              pushValues(elementEntries, displayValue, item.primaryKeys.map((k) => k.id));
            }
          }
        }

        // Similar to the "current" approach, we need to recursively get child element IDs. But in this case
        // we request them per display value entry rather than per every unique class for the entry.
        const entries = new Map<string, { elementIds: Id64String[], childIds: Id64String[] }>();
        await Promise.all([...elementEntries].map(async (entry) => {
          const [displayValue, elementIds] = entry;
          let childIds: Id64String[] = [];
          if (elementIds.size > 0) {
            ++requestsCount.childElementIds;
            childIds = await loadChildElementIds(iModel, [...elementIds]);
          }
          entries.set(displayValue, { elementIds: [...elementIds], childIds });
        }));

        return { requestsCount, requestsTime: timer.currentSeconds, entries };
      }

    });

  });

});

function pushValues<TValue>(target: Map<string, Set<TValue>>, key: string, values: TValue[]) {
  const entry = target.get(key);
  if (entry)
    values.forEach((v) => entry.add(v));
  else
    target.set(key, new Set(values));
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
  for await (const [childId] of iModel.query(childElementIdsQuery, (new QueryBinder()).bindIdSet(1, OrderedId64Iterable.sortArray(parentIds))))
    childIds.push(childId);
  return childIds;
}

function getRootField(field: PropertiesField) {
  const stack: Field[] = [field];
  let rootField: Field = field;
  while (rootField.parent) {
    rootField = rootField.parent;
    stack.push(rootField);
  }
  stack.reverse();
  return {
    rootField,
    pathFromRootToPropertiesField: (field.getFieldDescriptor() as PropertiesFieldDescriptor).pathFromSelectToPropertyClass,
    stack,
  };
}

function detectIntersections(distinctValueElementIds: Map<string, { elementIds: Id64String[], childIds: Id64String[] }>) {
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
