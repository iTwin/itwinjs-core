/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { CustomAttribute, Property } from "@bentley/ecschema-metadata";

export abstract class MutableProperty extends Property {
  public abstract addCustomAttribute(customAttribute: CustomAttribute): void;
}
