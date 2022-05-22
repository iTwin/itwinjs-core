/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { Content, Item, LabelCompositeValue, LabelDefinition, Node } from "@itwin/presentation-common";
import { Presentation } from "./Presentation";

const NAMESPACES = ["BisCore", "ECPresentation", "RulesEngine"];

const KEY_PATTERN = /@[\w\d\-_]+:[\w\d\-\._]+?@/g;

/** @internal */
export class LocalizationHelper {
  public static async registerNamespaces() {
    const localizationPromises = NAMESPACES.map(async (namespace) => Presentation.localization.registerNamespace(namespace));
    await Promise.all(localizationPromises);
  }

  public static unregisterNamespaces() {
    NAMESPACES.map((namespace) => Presentation.localization.unregisterNamespace(namespace));
  }

  public getLocalizedString(text: string) {
    return text.replace(KEY_PATTERN, (key) => Presentation.localization.getLocalizedString(key.replace(/^@|@$/g, ""), { defaultValue: key }));
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
    return content;
  }

  private translateContentItem(item: Item) {
    this.translateLabelDefinition(item.label);
  }

  private translateNode(node: Node) {
    this.translateLabelDefinition(node.label);
  }

  private translateLabelDefinition(labelDefinition: LabelDefinition) {
    const translateComposite = (compositeValue: LabelCompositeValue) => {
      compositeValue.values.map((value) => this.translateLabelDefinition(value));
    };

    if (labelDefinition.typeName === LabelDefinition.COMPOSITE_DEFINITION_TYPENAME)
      translateComposite(labelDefinition.rawValue as LabelCompositeValue);
    else if (labelDefinition.typeName === "string")
      labelDefinition.rawValue = this.getLocalizedString(labelDefinition.rawValue as string);
  }

}
