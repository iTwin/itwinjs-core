/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { Descriptor, DescriptorJSON } from "@itwin/presentation-common";
import { expect } from "chai";
import { createInstanceFilterPropertyInfos } from "../../presentation-components/instanceFilter/Utils";

// eslint-disable-next-line @typescript-eslint/no-var-requires
const descriptorJSON: DescriptorJSON = require("./testDescriptor.json");

describe.only("createInstanceFilterPropertyDefinitions", () => {

  it("creates property definitions from descriptor", () => {
    const descriptor = Descriptor.fromJSON(descriptorJSON);
    const input = createInstanceFilterPropertyInfos(descriptor!);
    expect(input).to.matchSnapshot();
  });

});
