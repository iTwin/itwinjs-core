/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import * as faker from "faker";
import {
  fromJSON, StandardNodeTypes, BaseNodeKey,
  ECInstanceNodeKeyJSON, ECClassGroupingNodeKey,
  ECPropertyGroupingNodeKey, LabelGroupingNodeKey,
} from "../../lib/hierarchy/Key";
import { createRandomId } from "../_helpers/random";

describe("NodeKey fromJSON", () => {

  it("creates BaseNodeKey", () => {
    const json: BaseNodeKey = {
      type: faker.random.word(),
      pathFromRoot: [faker.random.uuid()],
    };
    const key = fromJSON(json);
    expect(key).to.matchSnapshot();
  });

  it("creates ECInstanceNodeKey", () => {
    const json: ECInstanceNodeKeyJSON = {
      type: StandardNodeTypes.ECInstanceNode,
      pathFromRoot: [faker.random.uuid()],
      instanceKey: {
        className: faker.random.word(),
        id: createRandomId().toString(),
      },
    };
    const key = fromJSON(json);
    expect(key).to.matchSnapshot();
  });

  it("creates ECClassGroupingNodeKey", () => {
    const json: ECClassGroupingNodeKey = {
      type: StandardNodeTypes.ECClassGroupingNode,
      pathFromRoot: [faker.random.uuid()],
      className: faker.random.word(),
    };
    const key = fromJSON(json);
    expect(key).to.matchSnapshot();
  });

  it("creates ECPropertyGroupingNodeKey", () => {
    const json: ECPropertyGroupingNodeKey = {
      type: StandardNodeTypes.ECPropertyGroupingNode,
      pathFromRoot: [faker.random.uuid()],
      className: faker.random.word(),
      propertyName: faker.random.word(),
      groupingValue: faker.random.number(),
    };
    const key = fromJSON(json);
    expect(key).to.matchSnapshot();
  });

  it("creates LabelGroupingNodeKey", () => {
    const json: LabelGroupingNodeKey = {
      type: StandardNodeTypes.DisplayLabelGroupingNode,
      pathFromRoot: [faker.random.uuid()],
      label: faker.random.words(),
    };
    const key = fromJSON(json);
    expect(key).to.matchSnapshot();
  });

});
