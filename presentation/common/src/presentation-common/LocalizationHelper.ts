/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Core
 */

import { CategoryDescription } from "./content/Category.js";
import { Content } from "./content/Content.js";
import { Descriptor } from "./content/Descriptor.js";
import { Field } from "./content/Fields.js";
import { Item } from "./content/Item.js";
import { DisplayValue, DisplayValueGroup, Value } from "./content/Value.js";
import { ElementProperties } from "./ElementProperties.js";
import { Node } from "./hierarchy/Node.js";
import { NodePathElement } from "./hierarchy/NodePathElement.js";
import { COMPOSITE_LABEL_DEFINITION_TYPENAME, LabelCompositeValue, LabelDefinition } from "./LabelDefinition.js";

const KEY_PATTERN = /@[\w\d\-_]+:[\w\d\-\._]+?@/g;

interface LocalizationHelperProps {
  getLocalizedString: (key: string) => string;
}

/**
 * Localizes presentation data structures **in place**. Callers must pass a mutable graph owned by the current
 * operation and must not reuse it as untranslated data for another locale.
 * @internal
 */
export class LocalizationHelper {
  private _getLocalizedString: (key: string) => string;

  constructor(props: LocalizationHelperProps) {
    this._getLocalizedString = props.getLocalizedString;
  }

  public getLocalizedString(text: string) {
    return text.replace(KEY_PATTERN, (key) => this._getLocalizedString(key.replace(/^@|@$/g, "")));
  }

  /* eslint-disable @typescript-eslint/no-deprecated */
  public localizeNodes(nodes: Node[]): Node[] {
    nodes.forEach((n) => this.localizeNode(n));
    return nodes;
  }

  public localizeNode(node: Node): Node {
    this.localizeLabelDefinition(node.label);
    if (node.description) {
      node.description = this.getLocalizedString(node.description);
    }
    return node;
  }

  public localizeNodePathElement(npe: NodePathElement): NodePathElement {
    this.localizeNode(npe.node);
    npe.children.forEach((c) => this.localizeNodePathElement(c));
    return npe;
  }
  /* eslint-enable @typescript-eslint/no-deprecated */

  public localizeDisplayValueGroup(group: DisplayValueGroup): DisplayValueGroup {
    group.displayValue = this.localizeDisplayValue(group.displayValue);
    return group;
  }

  public localizeLabelDefinition(labelDefinition: LabelDefinition): LabelDefinition {
    if (labelDefinition.typeName === COMPOSITE_LABEL_DEFINITION_TYPENAME) {
      (labelDefinition.rawValue as LabelCompositeValue).values.forEach((value) => this.localizeLabelDefinition(value));
    } else if (labelDefinition.typeName === "string") {
      labelDefinition.rawValue = this.getLocalizedString(labelDefinition.rawValue as string);
      labelDefinition.displayValue = this.getLocalizedString(labelDefinition.displayValue);
    }
    return labelDefinition;
  }

  public localizeLabelDefinitions(labelDefinitions: LabelDefinition[]) {
    labelDefinitions.forEach((labelDefinition) => this.localizeLabelDefinition(labelDefinition));
    return labelDefinitions;
  }

  public localizeContentDescriptor(descriptor: Descriptor) {
    descriptor.fields.forEach((field) => this.localizeContentField(field));
    descriptor.categories.forEach((category) => this.localizeCategoryDescription(category));
    return descriptor;
  }

  public localizeContentItems(items: Item[]): Item[] {
    items.forEach((item) => this.localizeContentItem(item));
    return items;
  }

  public localizeContent(content: Content): Content {
    this.localizeContentDescriptor(content.descriptor);
    this.localizeContentItems(content.contentSet);
    return content;
  }

  public localizeElementProperties(elem: ElementProperties): ElementProperties {
    elem.label = this.getLocalizedString(elem.label);
    return elem;
  }

  private localizeContentItem(item: Item): Item {
    this.localizeLabelDefinition(item.label);
    this.localizeRawValuesDictionary(item.values);
    this.localizeDisplayValuesDictionary(item.displayValues);
    return item;
  }

  private localizeRawValuesDictionary(values: { [key: string]: Value }) {
    for (const key of Object.keys(values)) {
      values[key] = this.localizeRawValue(values[key]);
    }
  }

  private localizeDisplayValuesDictionary(values: { [key: string]: DisplayValue }) {
    for (const key of Object.keys(values)) {
      values[key] = this.localizeDisplayValue(values[key]);
    }
  }

  private localizeRawValue(value: Value): Value {
    if (typeof value === "string") {
      return this.getLocalizedString(value);
    }
    if (Value.isNavigationValue(value)) {
      this.localizeLabelDefinition(value.label);
      return value;
    }
    if (Value.isNestedContent(value)) {
      value.forEach((item) => {
        this.localizeRawValuesDictionary(item.values);
        this.localizeDisplayValuesDictionary(item.displayValues);
      });
      return value;
    }
    if (Value.isArray(value)) {
      for (let i = 0; i < value.length; ++i) {
        value[i] = this.localizeRawValue(value[i]);
      }
      return value;
    }
    if (Value.isMap(value)) {
      this.localizeRawValuesDictionary(value);
    }
    return value;
  }

  private localizeContentField(field: Field) {
    field.label = this.getLocalizedString(field.label);
    if (field.isPropertiesField()) {
      if (field.isStructPropertiesField()) {
        field.memberFields.forEach((m) => this.localizeContentField(m));
      } else if (field.isArrayPropertiesField()) {
        this.localizeContentField(field.itemsField);
      }
    } else if (field.isNestedContentField()) {
      field.nestedFields.forEach((m) => this.localizeContentField(m));
    }
    return field;
  }

  private localizeCategoryDescription(category: CategoryDescription) {
    category.label = this.getLocalizedString(category.label);
    category.description = this.getLocalizedString(category.description);
    return category;
  }

  private localizeDisplayValue(value: DisplayValue): DisplayValue {
    if (typeof value === "undefined") {
      return undefined;
    }
    if (typeof value === "string") {
      return this.getLocalizedString(value);
    }
    if (DisplayValue.isArray(value)) {
      for (let i = 0; i < value.length; ++i) {
        value[i] = this.localizeDisplayValue(value[i]);
      }
      return value;
    }
    this.localizeDisplayValuesDictionary(value);
    return value;
  }
}
