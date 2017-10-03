/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { Id64 } from "@bentley/bentleyjs-core/lib/Id";
import { JsonUtils } from "@bentley/bentleyjs-core/lib/JsonUtils";

/** Properties that define a Code */
export interface CodeProps {
  spec: Id64 | string;
  scope: string;
  value?: string;
}

/** A three part Code that identifies an Element */
export class Code implements CodeProps {
  public spec: Id64;
  public scope: string;
  public value?: string;

  constructor(val: CodeProps) {
    this.spec = new Id64(val.spec);
    this.scope = JsonUtils.asString(val.scope, "");
    this.value = JsonUtils.asString(val.value);
  }

  /** Create an empty, non-unique code with no special meaning. */
  public static createEmpty(): Code { const id: Id64 = new Id64([1, 0]); return new Code({ spec: id, scope: id.toString() }); }
  public getValue(): string { return this.value ? this.value : ""; }
  public equals(other: Code): boolean { return this.spec.equals(other.spec) && this.scope === other.scope && this.value === other.value; }
}
