/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Core
 */

import { Node } from "./hierarchy/Node";
import { Content } from "./content/Content";
import { Item } from "./content/Item";
import { LabelCompositeValue, LabelDefinition } from "./LabelDefinition";
import { DisplayValue, Value } from "./content/Value";
import { Field } from "./content/Fields";
import { CategoryDescription } from "./content/Category";
import { ElementProperties } from "./ElementProperties";

const KEY_PATTERN = /@[\w\d\-_]+:[\w\d\-\._]+?@/g;

/** @internal */
export interface LocalizationHelperProps {
  getLocalizedString: (key: string) => string;
}

/** @internal */
export class LocalizationHelper {
  private _getLocalizedString: (key: string) => string;

  constructor(props: LocalizationHelperProps) {
    this._getLocalizedString = props.getLocalizedString;
  }

  public getLocalizedString(text: string) {
    return text.replace(KEY_PATTERN, (key) => this._getLocalizedString(key.replace(/^@|@$/g, "")));
  }

  public getLocalizedNodes(nodes: Node[]): Node[] {
    for (const node of nodes)
      this.translateNode(node);
    return nodes;
  }

  public getLocalizedLabelDefinition(labelDefinition: LabelDefinition): LabelDefinition {
    this.translateLabelDefinition(labelDefinition);
    return labelDefinition;
  }

  public getLocalizedLabelDefinitions(labelDefinitions: LabelDefinition[]) {
    labelDefinitions.forEach((labelDefinition) => this.translateLabelDefinition(labelDefinition));
    return labelDefinitions;
  }

  public getLocalizedContent(content: Content) {
    content.contentSet.forEach((item) => this.translateContentItem(item));
    content.descriptor.fields.forEach((field) => this.translateContentDescriptorField(field));
    content.descriptor.categories.forEach((category) => this.translateContentDescriptorCategory(category));
    return content;
  }

  public getLocalizedElementProperties(elem: ElementProperties) {
    elem.label = this.getLocalizedString(elem.label);
    return elem;
  }

  private translateContentItem(item: Item) {
    for (const key in item.displayValues) {
      // istanbul ignore else
      if (key)
        item.displayValues[key] = this.translateContentItemDisplayValue(item.displayValues[key]);
    }
    for (const key in item.values) {
      // istanbul ignore else
      if (key)
        item.values[key] = this.translateContentItemValue(item.values[key]);
    }
    this.translateLabelDefinition(item.label);
  }

  private translateContentItemDisplayValue(value: DisplayValue): DisplayValue {
    // istanbul ignore else
    if (typeof value === "string") {
      value = this.getLocalizedString(value);
    }
    return value;
  }

  private translateContentItemValue(value: Value): Value {
    if (typeof value === "string") {
      value = this.getLocalizedString(value);
    } else if (Value.isNestedContent(value)) {
      for (const nestedValue of value) {
        for (const key in nestedValue.values) {
          // istanbul ignore else
          if (key)
            nestedValue.values[key] = this.translateContentItemValue(nestedValue.values[key]);
        }
        for (const key in nestedValue.displayValues) {
          // istanbul ignore else
          if (key)
            nestedValue.displayValues[key] = this.translateContentItemDisplayValue(nestedValue.displayValues[key]);
        }
      }
    }
    return value;
  }

  private translateContentDescriptorField(field: Field) {
    field.label = this.getLocalizedString(field.label);
  }

  private translateContentDescriptorCategory(category: CategoryDescription) {
    category.label = this.getLocalizedString(category.label);
    category.description = this.getLocalizedString(category.description);
  }

  private translateNode(node: Node) {
    this.translateLabelDefinition(node.label);
    // istanbul ignore else
    if (node.description)
      node.description = this.getLocalizedString(node.description);
  }

  private translateLabelDefinition(labelDefinition: LabelDefinition) {
    const translateComposite = (compositeValue: LabelCompositeValue) => {
      compositeValue.values.map((value) => this.translateLabelDefinition(value));
    };

    if (labelDefinition.typeName === LabelDefinition.COMPOSITE_DEFINITION_TYPENAME)
      translateComposite(labelDefinition.rawValue as LabelCompositeValue);
    else if (labelDefinition.typeName === "string") {
      labelDefinition.rawValue = this.getLocalizedString(labelDefinition.rawValue as string);
      labelDefinition.displayValue = this.getLocalizedString(labelDefinition.displayValue);
    }
  }

}
