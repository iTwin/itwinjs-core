/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { I18NNamespace } from "@bentley/imodeljs-i18n";
import { Node, LabelCompositeValue, LabelDefinition, Content, Item } from "@bentley/presentation-common";
import { Presentation } from "./Presentation";

const NAMESPACES = ["BisCore", "ECPresentation", "RulesEngine"];

/** @internal */
export class LocalizationHelper {
  private _localizationNamespaces: I18NNamespace[] | undefined = undefined;

  public async translate(stringId: string) {
    await this.registerNameSpaces();
    const key = stringId.replace(/^@|@$/g, "");
    return Presentation.i18n.translate(key, { defaultValue: stringId });
  }

  public async getLocalizedNodes(nodes: Node[]): Promise<Node[]> {
    for (const node of nodes)
      await this.translateNode(node);
    return nodes;
  }

  public async getLocalizedLabelDefinition(labelDefinition: LabelDefinition): Promise<LabelDefinition> {
    await this.translateLabelDefinition(labelDefinition);
    return labelDefinition;
  }

  public async getLocalizedLabelDefinitions(labelDefinitions: LabelDefinition[]): Promise<LabelDefinition[]> {
    for (const labelDefinition of labelDefinitions)
      await this.translateLabelDefinition(labelDefinition);
    return labelDefinitions;
  }

  public async getLocalizedContent(content: Content | undefined): Promise<Content | undefined> {
    if (content !== undefined) {
      for (const contentItem of content.contentSet)
        await this.translateContentItem(contentItem);
    }
    return content;
  }

  private async translateContentItem(item: Item) {
    await this.translateLabelDefinition(item.labelDefinition!);
  }

  private async translateNode(node: Node) {
    await this.translateLabelDefinition(node.labelDefinition!);
  }

  private async translateLabelDefinition(labelDefinition: LabelDefinition) {
    const translateComposite = async (compositeValue: LabelCompositeValue) => {
      for (const value of compositeValue.values)
        await this.translateLabelDefinition(value);
    };

    if (labelDefinition.typeName === "composite")
      await translateComposite(labelDefinition.rawValue as LabelCompositeValue);
    else if (labelDefinition.typeName === "string")
      labelDefinition.rawValue = await this.translate(labelDefinition.rawValue as string);
  }

  private async registerNameSpaces() {
    if (this._localizationNamespaces === undefined) {
      const localizationNamespaces: I18NNamespace[] = [];
      for (const namespace of NAMESPACES) {
        try {
          localizationNamespaces.push(Presentation.i18n.registerNamespace(namespace));
        } catch (_err) {
          // namespace is already registered
        }
      }

      this._localizationNamespaces = localizationNamespaces;
    }

    await Promise.all(this._localizationNamespaces.map((namespace) => namespace.readFinished)); // tslint:disable-line: promise-function-async
  }

}
