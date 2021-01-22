/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import * as faker from "faker";
import * as moq from "typemoq";
import { BeEvent } from "@bentley/bentleyjs-core";
import { NodeKey, RegisteredRuleset, Ruleset, VariableValue } from "@bentley/presentation-common";
import { createRandomECInstancesNodeKey } from "@bentley/presentation-common/lib/test/_helpers/random";
import { IModelContentChangeEventArgs, IModelHierarchyChangeEventArgs, PresentationManager, RulesetManager, RulesetVariablesManager } from "@bentley/presentation-frontend";
import { PrimitiveValue, PropertyDescription, PropertyRecord, PropertyValueFormat } from "@bentley/ui-abstract";
import { DelayLoadedTreeNodeItem } from "@bentley/ui-components";
import { PRESENTATION_TREE_NODE_KEY } from "../../presentation-components/tree/Utils";

export const createRandomTreeNodeItem = (key?: NodeKey, parentId?: string): DelayLoadedTreeNodeItem => {
  const node = {
    id: faker.random.uuid(),
    parentId,
    label: PropertyRecord.fromString(faker.random.word()),
    description: faker.random.words(),
    hasChildren: faker.random.boolean(),
  };
  (node as any)[PRESENTATION_TREE_NODE_KEY] = key ? key : createRandomECInstancesNodeKey();
  return node;
};

export const createRandomPropertyRecord = (): PropertyRecord => {
  const value: PrimitiveValue = {
    valueFormat: PropertyValueFormat.Primitive,
    value: faker.random.word(),
    displayValue: faker.random.words(),
  };
  const descr: PropertyDescription = {
    typename: "string",
    name: faker.random.word(),
    displayLabel: faker.random.word(),
  };
  return new PropertyRecord(value, descr);
};

export const mockPresentationManager = () => {
  const onRulesetModified = new BeEvent<(curr: RegisteredRuleset, prev: Ruleset) => void>();
  const rulesetManagerMock = moq.Mock.ofType<RulesetManager>();
  rulesetManagerMock.setup((x) => x.onRulesetModified).returns(() => onRulesetModified);

  const onRulesetVariableChanged = new BeEvent<(variableId: string, prevValue: VariableValue, currValue: VariableValue) => void>();
  const rulesetVariablesManagerMock = moq.Mock.ofType<RulesetVariablesManager>();
  rulesetVariablesManagerMock.setup((x) => x.onVariableChanged).returns(() => onRulesetVariableChanged);

  const onIModelHierarchyChanged = new BeEvent<(args: IModelHierarchyChangeEventArgs) => void>();
  const onIModelContentChanged = new BeEvent<(args: IModelContentChangeEventArgs) => void>();
  const presentationManagerMock = moq.Mock.ofType<PresentationManager>();
  presentationManagerMock.setup((x) => x.onIModelHierarchyChanged).returns(() => onIModelHierarchyChanged);
  presentationManagerMock.setup((x) => x.onIModelContentChanged).returns(() => onIModelContentChanged);
  presentationManagerMock.setup((x) => x.rulesets()).returns(() => rulesetManagerMock.object);
  presentationManagerMock.setup((x) => x.vars(moq.It.isAny())).returns(() => rulesetVariablesManagerMock.object);

  return {
    rulesetsManager: rulesetManagerMock,
    rulesetVariablesManager: rulesetVariablesManagerMock,
    presentationManager: presentationManagerMock,
  };
};
