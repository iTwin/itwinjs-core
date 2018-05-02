"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
// __PUBLISH_EXTRACT_START__ Element.subclass
const imodeljs_backend_1 = require("@bentley/imodeljs-backend");
/**
 * An example of defining a subclass of InformationPartitionElement.
 * Normally, you would define an entity class like this
 * by first generating an ECSchema and then generating a class definition
 * like this from it. You would then hand-edit it to add methods.
 */
class TestPartitionElement extends imodeljs_backend_1.InformationPartitionElement {
    constructor(parentOrProps, iModel) {
        if (!(parentOrProps instanceof imodeljs_backend_1.Subject)) {
            super(parentOrProps, iModel);
            return;
        }
        const props = {
            parent: parentOrProps,
            model: parentOrProps.model,
            classFullName: "TestSchema:TestPartitionElement",
        };
        super(props, parentOrProps.iModel);
    }
    // You can write methods to implement business logic that apps can call.
    someBusinessLogic() {
        if ((this.testProperty === "something") && this.isPrivate) {
            // ... do something ...
        }
    }
}
exports.TestPartitionElement = TestPartitionElement;
// __PUBLISH_EXTRACT_END__
//# sourceMappingURL=TestPartitionElement.js.map