/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { Id64, Guid } from "@bentley/bentleyjs-core/lib/Id";
import { JsonUtils } from "@bentley/bentleyjs-core/lib/JsonUtils";
import { CodeProps } from "./Code";
import { EntityProps } from "./EntityProps";

/** The Id and relationship class of an Element that is related to another Element */
export class RelatedElement {
  constructor(public id: Id64, public relClass?: string) { }
  public static fromJSON(json?: any): RelatedElement | undefined {
    return json ? new RelatedElement(new Id64(json.id), JsonUtils.asString(json.relClass)) : undefined;
  }
}

/** The properties that define an Element */
export interface ElementProps extends EntityProps {
  model: Id64 | string;
  code: CodeProps;
  id: Id64 | string;
  parent?: RelatedElement;
  federationGuid?: Guid;
  userLabel?: string;
  jsonProperties?: any;
}
