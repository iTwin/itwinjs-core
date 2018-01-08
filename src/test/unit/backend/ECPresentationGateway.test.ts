/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { assert } from "chai";
import ECPresentationGateway from "@bentley/ecpresentation-backend/lib/backend/ECPresentationGateway";
import ECPresentationGatewayDefinition from "@bentley/ecpresentation-backend/lib/common/ECPresentationGatewayDefinition";
import { Gateway } from "@bentley/imodeljs-backend/lib/common/Gateway";

describe("ECPresentationGatewayImpl", () => {

  it("Is registered after including module", () => {
    Gateway.initialize(ECPresentationGateway);
    const impl = Gateway.getImplementationForGateway(ECPresentationGatewayDefinition);
    assert.isNotNull(impl);
    assert.instanceOf(impl, ECPresentationGateway);
  });

});
