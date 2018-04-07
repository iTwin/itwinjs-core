/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
// __PUBLISH_EXTRACT_START__ Element.subclass
import { InformationPartitionElement, IModelDb, Subject } from "@bentley/imodeljs-backend";
import { InformationPartitionElementProps } from "@bentley/imodeljs-common";

/**
 * An example of defining a subclass of InformationPartitionElement.
 * Normally, you would define an entity class like this
 * by first generating an ECSchema and then generating a class definition
 * like this from it. You would then hand-edit it to add methods.
 */
export class TestPartitionElement extends InformationPartitionElement {
  //  Define the properties added by this subclass
  public testProperty?: string;

  // You do not have to re-define the constructor. The base class constructor
  // will take care of defining testProperty when loading an instance of
  // this new class. You would re-define the constructor if you want to provide "overrides"
  // for apps to use. For example, you might define a constructor that takes just the
  // parent Subject. Note that you must *always* define a constructor that takes a ElementProps
  // (or a subclass of it) and an IModel.
  public constructor(parent: Subject);
  public constructor(props: InformationPartitionElementProps, iModel: IModelDb);
  public constructor(parentOrProps: InformationPartitionElementProps | Subject, iModel?: IModelDb) {
    if (!(parentOrProps instanceof Subject)) {
      super(parentOrProps, iModel!);
      return;
    }

    const props: InformationPartitionElementProps = {
      parent: parentOrProps,
      model: parentOrProps.model,
      classFullName: "TestSchema:TestPartitionElement",
    };
    super(props, parentOrProps.iModel);
  }

  // You can write methods to implement business logic that apps can call.
  public someBusinessLogic(): void {
    if ((this.testProperty === "something") && this.isPrivate) {
      // ... do something ...
    }
  }
}
// __PUBLISH_EXTRACT_END__
