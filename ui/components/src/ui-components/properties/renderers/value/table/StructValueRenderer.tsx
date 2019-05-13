/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Properties */

import * as React from "react";
import { TableNonPrimitiveValueRenderer as TableValueRenderer, TableSpecificValueRendererProps } from "./NonPrimitiveValueRenderer";
import { NonPrimitivePropertyRenderer } from "../../NonPrimitivePropertyRenderer";

/** A react component which renders struct property value as a button with text
 * @public
 */
export class TableStructValueRenderer extends React.PureComponent<TableSpecificValueRendererProps> {
  private getButtonLabel(props: TableSpecificValueRendererProps) {
    return `{${props.propertyRecord.property.typename}}`;
  }

  private getDialogContents() {
    return (
      <NonPrimitivePropertyRenderer
        uniqueKey={`table_struct_${this.props.propertyRecord.property.name}`}
        orientation={this.props.orientation}
        propertyRecord={this.props.propertyRecord}
      />
    );
  }

  /** @internal */
  public render() {
    return (
      <TableValueRenderer
        buttonLabel={this.getButtonLabel(this.props)}
        dialogTitle={`Struct of type "${this.props.propertyRecord.property.typename}"`}
        dialogContents={this.getDialogContents()}
        onDialogOpen={this.props.onDialogOpen}
      />
    );
  }
}
