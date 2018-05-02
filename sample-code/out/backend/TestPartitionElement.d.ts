import { InformationPartitionElement, IModelDb, Subject } from "@bentley/imodeljs-backend";
import { InformationPartitionElementProps } from "@bentley/imodeljs-common";
/**
 * An example of defining a subclass of InformationPartitionElement.
 * Normally, you would define an entity class like this
 * by first generating an ECSchema and then generating a class definition
 * like this from it. You would then hand-edit it to add methods.
 */
export declare class TestPartitionElement extends InformationPartitionElement {
    testProperty?: string;
    constructor(parent: Subject);
    constructor(props: InformationPartitionElementProps, iModel: IModelDb);
    someBusinessLogic(): void;
}
