/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Core
 */

import { CategoryDescription } from "./content/Category";
import { Content } from "./content/Content";
import { Descriptor } from "./content/Descriptor";
import { Field } from "./content/Fields";
import { Item } from "./content/Item";
import { DisplayValue, DisplayValueGroup, Value } from "./content/Value";
import { ElementProperties } from "./ElementProperties";
import { Node } from "./hierarchy/Node";
import { NodePathElement } from "./hierarchy/NodePathElement";
import { LabelCompositeValue, LabelDefinition } from "./LabelDefinition";

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
    return nodes.map((n) => this.getLocalizedNode(n));
  }

  public getLocalizedNodePathElement(npe: NodePathElement): NodePathElement {
    return {
      ...npe,
      node: this.getLocalizedNode(npe.node),
      children: npe.children.map((c) => this.getLocalizedNodePathElement(c)),
    };
  }

  public getLocalizedDisplayValueGroup(group: DisplayValueGroup): DisplayValueGroup {
    return {
      ...group,
      displayValue: this.getLocalizedDisplayValue(group.displayValue),
    };
  }

  public getLocalizedLabelDefinition(labelDefinition: LabelDefinition): LabelDefinition {
    const getLocalizedComposite = (compositeValue: LabelCompositeValue) => ({
      ...compositeValue,
      values: compositeValue.values.map((value) => this.getLocalizedLabelDefinition(value)),
    });

    if (labelDefinition.typeName === LabelDefinition.COMPOSITE_DEFINITION_TYPENAME) {
      return {
        ...labelDefinition,
        rawValue: getLocalizedComposite(labelDefinition.rawValue as LabelCompositeValue),
      };
    }
    if (labelDefinition.typeName === "string") {
      return {
        ...labelDefinition,
        rawValue: this.getLocalizedString(labelDefinition.rawValue as string),
        displayValue: this.getLocalizedString(labelDefinition.displayValue),
      };
    }
    return labelDefinition;
  }

  public getLocalizedLabelDefinitions(labelDefinitions: LabelDefinition[]) {
    return labelDefinitions.map((labelDefinition) => this.getLocalizedLabelDefinition(labelDefinition));
  }

  public getLocalizedContentDescriptor(descriptor: Descriptor) {
    const clone = new Descriptor(descriptor);
    clone.fields.forEach((field) => this.getLocalizedContentField(field));
    clone.categories.forEach((category) => this.getLocalizedCategoryDescription(category));
    return clone;
  }

  public getLocalizedContentItems(items: Item[]): Item[] {
    return items.map((item) => this.getLocalizedContentItem(item));
  }

  public getLocalizedContent(content: Content): Content {
    return new Content(this.getLocalizedContentDescriptor(content.descriptor), this.getLocalizedContentItems(content.contentSet));
  }

  public getLocalizedElementProperties(elem: ElementProperties): ElementProperties {
    return {
      ...elem,
      label: this.getLocalizedString(elem.label),
    };
  }

  // warning: this function mutates the item
  private getLocalizedContentItem(item: Item): Item {
    item.label = this.getLocalizedLabelDefinition(item.label);
    item.values = Object.entries(item.values).reduce((o, [k, v]) => ({ ...o, [k]: this.getLocalizedRawValue(v) }), {});
    item.displayValues = Object.entries(item.displayValues).reduce((o, [k, v]) => ({ ...o, [k]: this.getLocalizedDisplayValue(v) }), {});
    return item;
  }

  private getLocalizedRawValue(value: Value): Value {
    if (typeof value === "string") {
      return this.getLocalizedString(value);
    }
    if (Value.isNavigationValue(value)) {
      return {
        ...value,
        label: this.getLocalizedLabelDefinition(value.label),
      };
    }
    if (Value.isNestedContent(value)) {
      return value.map((item) => ({
        ...item,
        values: Object.entries(item.values).reduce((o, [k, v]) => ({ ...o, [k]: this.getLocalizedRawValue(v) }), {}),
        displayValues: Object.entries(item.displayValues).reduce((o, [k, v]) => ({ ...o, [k]: this.getLocalizedDisplayValue(v) }), {}),
      }));
    }
    if (Value.isArray(value)) {
      return value.map((v) => this.getLocalizedRawValue(v));
    }
    if (Value.isMap(value)) {
      return Object.entries(value).reduce((o, [k, v]) => ({ ...o, [k]: this.getLocalizedRawValue(v) }), {});
    }
    return value;
  }

  // warning: this function mutates the field
  private getLocalizedContentField<TField extends Field>(field: TField) {
    field.label = this.getLocalizedString(field.label);
    if (field.isPropertiesField()) {
      if (field.isStructPropertiesField()) {
        field.memberFields = field.memberFields.map((m) => this.getLocalizedContentField(m));
      } else if (field.isArrayPropertiesField()) {
        field.itemsField = this.getLocalizedContentField(field.itemsField);
      }
    } else if (field.isNestedContentField()) {
      field.nestedFields = field.nestedFields.map((m) => this.getLocalizedContentField(m));
    }
    return field;
  }

  // warning: this function mutates the category
  private getLocalizedCategoryDescription(category: CategoryDescription) {
    category.label = this.getLocalizedString(category.label);
    category.description = this.getLocalizedString(category.description);
    return category;
  }

  public getLocalizedNode(node: Node): Node {
    return {
      ...node,
      label: this.getLocalizedLabelDefinition(node.label),
      ...(node.description ? { description: this.getLocalizedString(node.description) } : undefined),
    };
  }

  private getLocalizedDisplayValue(value: DisplayValue): DisplayValue {
    if (typeof value === "undefined") {
      return undefined;
    }
    if (typeof value === "string") {
      return this.getLocalizedString(value);
    }
    if (DisplayValue.isArray(value)) {
      return value.map((v) => this.getLocalizedDisplayValue(v));
    }
    return Object.entries(value).reduce((o, [k, v]) => ({ ...o, [k]: this.getLocalizedDisplayValue(v) }), {});
  }
}
