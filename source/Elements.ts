/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { Element, Code } from "./Element";
import { IModel, Id  } from "./IModel";

/** The collection of Elements in an iModel  */
export class Elements {
  private imodel: IModel;

  /** Constructor */
  public constructor(iModel: IModel) {
    this.imodel = iModel;
  }

  private reviveElemFromJson(json: string): Element {
    // *** TBD
    if (!json)
      json = "";
    const i = new Id(0);
    const mid = new Id(0);
    const c = Code.createDefault();
    const cl = "TBD";
    return new Element({className: cl, iModel: this.imodel, modelId: mid, code: c, id: i});
  }
  /**
   * Look up an element by Id.
   * @param id  The element Id to look up
   * @return the element or null if the Id is not found
   */
  public async getElementById(id: Id): Promise<Element> {
      const json = await this.imodel.getDgnDbNative().getElementById(id.toString());
      return this.reviveElemFromJson(json);
  }
}
