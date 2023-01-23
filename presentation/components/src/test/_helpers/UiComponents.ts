/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import * as faker from "faker";
import * as moq from "typemoq";
import { PrimitiveValue, PropertyDescription, PropertyRecord, PropertyValueFormat } from "@itwin/appui-abstract";
import { BeEvent } from "@itwin/core-bentley";
import { NodeKey, RegisteredRuleset, Ruleset, VariableValue } from "@itwin/presentation-common";
import { createRandomECInstancesNodeKey } from "@itwin/presentation-common/lib/cjs/test";
import {
  IModelContentChangeEventArgs, IModelHierarchyChangeEventArgs, PresentationManager, RulesetManager, RulesetVariablesManager,
} from "@itwin/presentation-frontend";
import { PresentationTreeNodeItem } from "../../presentation-components/tree/PresentationTreeNodeItem";

/**
 * @internal Used for testing only.
 */
export const createRandomTreeNodeItem = (key?: NodeKey, parentId?: string): PresentationTreeNodeItem => {
  const node = {
    id: faker.random.uuid(),
    parentId,
    label: PropertyRecord.fromString(faker.random.word()),
    description: faker.random.words(),
    hasChildren: faker.random.boolean(),
    key: key ? key : createRandomECInstancesNodeKey(),
  };
  return node;
};

/**
 * @internal Used for testing only.
 */
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

/**
 * @internal Used for testing only.
 */
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
