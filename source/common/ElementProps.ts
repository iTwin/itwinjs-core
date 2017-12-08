/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { Id64, Guid } from "@bentley/bentleyjs-core/lib/Id";
import { CodeProps } from "./Code";
import { EntityProps } from "./EntityProps";

export interface RelatedElementProps {
  id: Id64 | string;
  relClass?: string;
}

/** The properties that define an Element */
export interface ElementProps extends EntityProps {
  model: Id64 | string;
  code: CodeProps;
  parent?: RelatedElementProps;
  federationGuid?: Guid | string;
  userLabel?: string;
  jsonProperties?: any;
}

/** The Id and relationship class of an Element that is related to another Element */
export class RelatedElement implements RelatedElementProps {
  public readonly id: Id64;
  public readonly relClass?: string;
  constructor(props: RelatedElementProps) { this.id = (props.id instanceof Id64 ? props.id : new Id64(props.id)); this.relClass = props.relClass; }
  public static fromJSON(json?: any): RelatedElement | undefined {
    return json ? new RelatedElement(json) : undefined;
  }
}
