/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { Id64, Guid } from "@bentley/bentleyjs-core/lib/Id";
import { JsonUtils } from "@bentley/bentleyjs-core/lib/JsonUtils";
import { CodeProps } from "./Code";
import { EntityProps } from "./EntityProps";

/** The Id and relationship class of an Element that is related to another Element */
export class RelatedElement {
  public readonly id: Id64;
  constructor(id?: Id64 | string, public relClass?: string) { this.id = (id instanceof Id64 ? id : new Id64(id)); }
  public static fromJSON(json?: any): RelatedElement | undefined {
    return json ? new RelatedElement(json.id, JsonUtils.asString(json.relClass)) : undefined;
  }
}

/** The properties that define an Element */
export interface ElementProps extends EntityProps {
  model: Id64 | string;
  code: CodeProps;
  id: Id64 | string;
  parent?: RelatedElement;
  federationGuid?: Guid | string;
  userLabel?: string;
  jsonProperties?: any;
}
