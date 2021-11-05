/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Properties
 */

import { PropertyRecord, PropertyValueFormat } from "@itwin/appui-abstract";
import { UiComponents } from "../../../UiComponents";
import { IPropertyValueRenderer, PropertyValueRendererContext } from "../../ValueRendererManager";
import { withContextStyle } from "./WithContextStyle";

/** Default Merged Property Renderer
 * @public
 */
export class MergedPropertyValueRenderer implements IPropertyValueRenderer {

  /** Checks if the renderer can handle given property */
  public canRender(record: PropertyRecord) {
    return !!record.isMerged && record.value.valueFormat === PropertyValueFormat.Primitive;
  }

  /** Method that returns a JSX representation of PropertyRecord */
  public render(_record: PropertyRecord, context?: PropertyValueRendererContext) {
    return withContextStyle(UiComponents.translate("property.varies"), context);
  }
}
