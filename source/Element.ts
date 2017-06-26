/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/

import { IModel } from './IModel'

export class Code {
  constructor(public specId: number, public scopeElementId: Id, public value?: string) { }
}

/** 
* A two-part id, containing a IModel id and a local id.
*/
export class Id {
  private readonly b: number;
  private readonly l: number;

  /**
   * constructor for Id
   * @param bId an integer identifying the IModel id
   * @param lId an integer with the local id 
  */
  constructor(bId?: number | Array<number>, lId?: number) {
    if (Array.isArray(bId)) {
      this.b = bId[0] | 0
      this.l = Math.trunc(bId[1])
    } else {
      this.b = bId ? bId | 0 : 0;
      this.l = lId ? Math.trunc(lId) : 0;
    }
  }

  /** Determine whether this Id is valid */
  public isValid(): boolean {
    return this.b !== 0 && this.l !== 0;
  }

  /** Test whether two Ids are the same
   * @param other the other id to test
   */
  public equals(other: Id): boolean {
    return this.b === other.b && this.l === other.l;
  }
}

/** the parent element of another element. Also includes the relationship between them */
export class Parent {
  id: Id
  relationshipClass: string
}

/** An element within an iModel */
export class Element {
  iModel: IModel;
  id?: Id;
  modelId: Id
  className: string;
  code: Code;
  parent?: Parent
  federationGuid?: string;
  userLabel?: string;
  jsonProps?: any;

  /** constructor for Element */
  constructor(opts: {
    iModel: IModel,
    className: string,
    modelId: Id,
    code: Code,
    id?: Id,
    parent?: Parent
    federationGuid?: string,
    userLabel?: string,
    jsonProps?: any
  }) {
    this.className = opts.className;
    this.id = opts.id
    this.code = opts.code
    this.iModel = opts.iModel
    this.modelId = opts.modelId
    this.parent = opts.parent
    this.federationGuid = opts.federationGuid
    this.userLabel = opts.userLabel
    this.jsonProps = opts.jsonProps
  }

  /** change parent */
  changeParent(newParent?: Parent): void {
    this.parent = newParent
  }
}

