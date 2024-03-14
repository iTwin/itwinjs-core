/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { GenericInstanceFilterFromECSqlAstDeserializer } from "./GenericInstanceFilterFromECSqlAstDeserializer";
import { GenericInstanceFilterToECSqlAstSerializer } from "./GenericInstanceFilterToECSqlAstSerializer";
import { testClassName, testGenericInstanceFilter } from "./TestInstanceFiler";

describe.only("GenericInstanceSerializer", () => {
  it("Serializer", async () => {
    const exp = GenericInstanceFilterToECSqlAstSerializer.serialize(testGenericInstanceFilter, testClassName);
    const ecsql = exp.toECSql();
    console.log(ecsql);
    const filter = GenericInstanceFilterFromECSqlAstDeserializer.deserialize(exp);
    console.log(JSON.stringify(filter));
  });

});
