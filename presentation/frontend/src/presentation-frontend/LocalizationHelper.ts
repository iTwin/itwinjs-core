/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { Node, LabelCompositeValue, LabelDefinition, Content, Item } from "@bentley/presentation-common";
import { Presentation } from "./Presentation";

const NAMESPACES = ["BisCore", "ECPresentation", "RulesEngine"];

/** @internal */
export class LocalizationHelper {
  public static async registerNamespaces() {
    const localizationPromises = NAMESPACES.map(async (namespace) => Presentation.i18n.registerNamespace(namespace).readFinished);
    await Promise.all(localizationPromises);
  }

  public static unregisterNamespaces() {
    NAMESPACES.map((namespace) => Presentation.i18n.unregisterNamespace(namespace));
  }

  public translate(stringId: string) {
    const key = stringId.replace(/^@|@$/g, "");
    return Presentation.i18n.translate(key, { defaultValue: stringId });
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

  public getLocalizedContent(content: Content | undefined) {
    if (content !== undefined)
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

    if (labelDefinition.typeName === "composite")
      translateComposite(labelDefinition.rawValue as LabelCompositeValue);
    else if (labelDefinition.typeName === "string")
      labelDefinition.rawValue = this.translate(labelDefinition.rawValue as string);
  }

}
