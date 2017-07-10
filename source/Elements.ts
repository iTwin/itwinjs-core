/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
// import { Element, Id } from "./Element";
import { IModel  } from "./IModel";

/** The collection of Elements in an iModel  */
export class Elements {
  private imodel: IModel;

  /** Constructor */
  public constructor(iModel: IModel) {
    this.imodel = iModel;
  }

/*
  public getElementById(id: Id): Element {
    const json = this.imodel.getDgnNativeDb().getElementById(id.toString());

    //let el = new Element({className: }
  }
  */
}
