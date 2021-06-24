/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { AnyEnumerator, Enumeration } from "@bentley/ecschema-metadata";

/** @internal
 * An abstract class used for schema editing.
 */
export abstract class MutableEnumeration extends Enumeration {
  public abstract addEnumerator(enumerator: AnyEnumerator): void;
  public abstract setIsStrict(isStrict: boolean): void;
  public abstract setDisplayLabel(displayLabel: string): void;
}
