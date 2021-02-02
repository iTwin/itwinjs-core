/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/**
 * @packageDocumentation
 * @module Properties
 */

import * as React from "react";
import { Primitives, PrimitiveValue, PropertyRecord, PropertyValueFormat } from "@bentley/ui-abstract";
import { IPropertyValueRenderer, PropertyValueRendererContext, TypeConverterManager, useAsyncValue } from "@bentley/ui-components";
import { UnderlinedButton } from "@bentley/ui-core";
import { translate } from "../common/Utils";
import { useUnifiedSelectionContext } from "../unified-selection/UnifiedSelectionContext";

/**
 * Property value renderer for instance keys. If application provides a [[UnifiedSelectionContext]] and this value is
 * clicked, the current selection is replaced with the instance pointed by the key. The selection changes at the default
 * selection level as provided by the context.
 * @beta
 */
export class InstanceKeyValueRenderer implements IPropertyValueRenderer {
  public canRender(record: PropertyRecord) {
    return record.value.valueFormat === PropertyValueFormat.Primitive
      && (record.value.value === undefined || isInstanceKey(record.value.value));
  }

  public render(record: PropertyRecord, context?: PropertyValueRendererContext) {
    return <InstanceKeyValueRendererImpl record={record} context={context} />;
  }
}

interface InstanceKeyValueRendererImplProps {
  record: PropertyRecord;
  context?: PropertyValueRendererContext;
}

const InstanceKeyValueRendererImpl: React.FC<InstanceKeyValueRendererImplProps> = (props) => {
  const stringValue = useAsyncValue(convertRecordToString(props.record));
  const valueElement = stringValue ?? props.context?.defaultValue;

  const selectionContext = useUnifiedSelectionContext();
  const instanceKey = (props.record.value as PrimitiveValue).value as Primitives.InstanceKey | undefined;

  if (instanceKey === undefined || selectionContext === undefined) {
    return <span style={props.context?.style} title={stringValue}>{valueElement}</span>;
  }

  const title = translate("instance-key-value-renderer.select-instance");
  const handleClick = () => selectionContext.replaceSelection([instanceKey]);
  return <UnderlinedButton title={title} onClick={handleClick}>{valueElement}</UnderlinedButton>;
};

function isInstanceKey(value: Primitives.Value): value is Primitives.InstanceKey {
  const { className, id } = value as Primitives.InstanceKey;
  return typeof className === "string" && typeof id === "string";
}

function convertRecordToString(record: PropertyRecord): string | Promise<string> {
  const primitive = record.value as PrimitiveValue;
  return primitive.displayValue ?? TypeConverterManager.getConverter(
    record.property.typename,
    record.property.converter?.name,
  ).convertPropertyToString(record.property, primitive.value);
}
