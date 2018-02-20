/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { assert } from "@bentley/bentleyjs-core/lib/Assert";
import * as responseTypes from "./AddonResponses";
import * as ec from "../common/EC";
import { NavNode, NavNodeKey, NavNodeKeyPath, NavNodePathElement, ECInstanceNodeKey } from "../common/Hierarchy";
import * as content from "../common/content";
import { createDescriptorOverrides } from "../common/content/Descriptor";
import { StructFieldMemberDescription, isStructDescription } from "../common/content/TypeDescription";
import { ChangedECInstanceInfo, ECInstanceChangeResult } from "../common/Changes";
import { PageOptions, ECPresentationManager as ECPInterface } from "../common/ECPresentationManager";
import { Logger } from "@bentley/bentleyjs-core/lib/Logger";
import { NodeAddonRegistry } from "@bentley/imodeljs-backend/lib/backend/NodeAddonRegistry";
import { IModelToken } from "@bentley/imodeljs-backend/lib/common/IModel";
import { IModelError, IModelStatus } from "@bentley/imodeljs-backend/lib/common/IModelError";
import { IModelDb } from "@bentley/imodeljs-backend/lib/backend/IModelDb";
import ECPresentationGateway from "./ECPresentationGateway";

// make sure the gateway gets registered (hopefully this is temporary)
ECPresentationGateway;

export interface Props {
  /** @hidden */
  addon?: NodeAddonDefinition;
  rulesetDirectories?: string[];
}

export default class ECPresentationManager implements ECPInterface {

  private _addon?: NodeAddonDefinition;

  constructor(props?: Props) {
    if (props && props.addon)
      this._addon = props.addon;
    if (props && props.rulesetDirectories)
      this.getAddon().setupRulesetDirectories(props.rulesetDirectories);
  }

  /** @hidden */
  public getAddon(): NodeAddonDefinition {
    if (!this._addon) {
      const addonImpl = createAddonImpl();
      this._addon = new addonImpl();
    }
    return this._addon!;
  }

  public async getRootNodes(token: IModelToken, pageOptions: PageOptions, options: object): Promise<NavNode[]> {
    const params = this.createRequestParams(NodeAddonRequestTypes.GetRootNodes, {
      pageOptions,
      options,
    });
    return this.request(token, params, Conversion.createNodesList);
  }

  public async getRootNodesCount(token: IModelToken, options: object): Promise<number> {
    const params = this.createRequestParams(NodeAddonRequestTypes.GetRootNodesCount, {
      options,
    });
    return this.request(token, params);
  }

  public async getChildren(token: IModelToken, parent: NavNode, pageOptions: PageOptions, options: object): Promise<NavNode[]> {
    const params = this.createRequestParams(NodeAddonRequestTypes.GetChildren, {
      nodeId: parent.nodeId,
      pageOptions,
      options,
    });
    return this.request(token, params, Conversion.createNodesList);
  }

  public async getChildrenCount(token: IModelToken, parent: NavNode, options: object): Promise<number> {
    const params = this.createRequestParams(NodeAddonRequestTypes.GetChildrenCount, {
      nodeId: parent.nodeId,
      options,
    });
    return this.request(token, params);
  }

  public async getNodePaths(_token: IModelToken, _paths: NavNodeKeyPath[], _markedIndex: number, _options: object): Promise<NavNodePathElement[]> {
    throw new Error("Not implemented.");
  }

  public async getFilteredNodesPaths(_token: IModelToken, _filterText: string, _options: object): Promise<NavNodePathElement[]> {
    throw new Error("Not implemented.");
  }

  public async getContentDescriptor(token: IModelToken, displayType: string, keys: ec.InstanceKeysList, selection: content.SelectionInfo | undefined, options: object): Promise<content.Descriptor> {
    const params = this.createRequestParams(NodeAddonRequestTypes.GetContentDescriptor, {
      displayType,
      keys,
      selection,
      options,
    });
    return this.request(token, params, Conversion.createContentDescriptor);
  }

  public async getContentSetSize(token: IModelToken, descriptor: content.Descriptor, keys: ec.InstanceKeysList, options: object): Promise<number> {
    const params = this.createRequestParams(NodeAddonRequestTypes.GetContentSetSize, {
      keys,
      descriptorOverrides: createDescriptorOverrides(descriptor),
      options,
    });
    return this.request(token, params);
  }

  public async getContent(token: IModelToken, descriptor: content.Descriptor, keys: ec.InstanceKeysList, pageOptions: PageOptions, options: object): Promise<content.Content> {
    const params = this.createRequestParams(NodeAddonRequestTypes.GetContent, {
      keys,
      descriptorOverrides: createDescriptorOverrides(descriptor),
      pageOptions,
      options,
    });
    return this.request(token, params, Conversion.createContent);
  }

  public async getDistinctValues(_token: IModelToken, _displayType: string, _fieldName: string, _maximumValueCount: number, _options: object): Promise<string[]> {
    throw new Error("Not implemented.");
  }

  public async saveValueChange(_token: IModelToken, _instancesInfo: ChangedECInstanceInfo[], _propertyAccessor: string, _value: any, _options: object): Promise<ECInstanceChangeResult[]> {
    // note: should probably handle this in typescript rather than forwarding to node addon
    throw new Error("Not implemented.");
  }

  private request(token: IModelToken, params: string, responseHandler?: (response: any) => any) {
    const imodelAddon = this.getAddon().getImodelAddon(token);
    const serializedResponse = this.getAddon().handleRequest(imodelAddon, params);
    if (!serializedResponse)
      throw new Error("Received invalid response from the addon: " + serializedResponse);
    const response = JSON.parse(serializedResponse);
    if (responseHandler)
      return responseHandler(response);
    return response;
  }

  private createRequestParams(requestId: string, requestParams: object): string {
    const request = {
      requestId,
      params: requestParams,
    };
    return JSON.stringify(request);
  }
}

/** @hidden */
export interface NodeAddonDefinition {
  handleRequest(db: any, options: string): string;
  setupRulesetDirectories(directories: string[]): void;
  getImodelAddon(token: IModelToken): any;
}

const createAddonImpl = () => {
  const nativeAddon = (NodeAddonRegistry.getAddon()).AddonECPresentationManager;
  // note the implementation is constructed here to make ECPresentationManager
  // usable without loading the actual addon (if addon is set to something other)
  return class extends nativeAddon implements NodeAddonDefinition {
    public handleRequest(db: any, options: string): string {
      return super.handleRequest(db, options);
    }
    public setupRulesetDirectories(directories: string[]): void {
      return super.setupRulesetDirectories(directories);
    }
    public getImodelAddon(token: IModelToken): any {
      const imodel = IModelDb.find(token);
      if (!imodel || !imodel.nativeDb)
        throw new IModelError(IModelStatus.NotOpen, "IModelDb not open", Logger.logError, undefined, () => ({ iModelId: token.iModelId }));
      return imodel.nativeDb;
    }
  };
};

/** @hidden */
export enum NodeAddonRequestTypes {
  GetRootNodes = "GetRootNodes",
  GetRootNodesCount = "GetRootNodesCount",
  GetChildren = "GetChildren",
  GetChildrenCount = "GetChildrenCount",
  GetFilteredNodesPaths = "GetFilteredNodesPaths",
  GetNodePaths = "GetNodePaths",
  GetContentDescriptor = "GetContentDescriptor",
  GetContentSetSize = "GetContentSetSize",
  GetContent = "GetContent",
  GetDistinctValues = "GetDistinctValues",
}

namespace Conversion {
  export function createNodesList(r: responseTypes.Node[]): NavNode[] {
    const nodes = new Array<NavNode>();
    for (const rNode of r) {
      nodes.push({
        nodeId: rNode.NodeId,
        parentNodeId: rNode.ParentNodeId || undefined,
        key: createNavNodeKey(rNode.Key),
        label: rNode.Label,
        description: rNode.Description,
        imageId: rNode.ExpandedImageId || undefined,
        foreColor: rNode.ForeColor || undefined,
        backColor: rNode.BackColor || undefined,
        fontStyle: rNode.FontStyle || undefined,
        hasChildren: rNode.HasChildren,
        isSelectable: rNode.IsSelectable,
        isEditable: rNode.IsEditable,
        isChecked: rNode.IsChecked,
        isExpanded: rNode.IsExpanded,
        isCheckboxVisible: rNode.IsCheckboxVisible,
        isCheckboxEnabled: rNode.IsCheckboxEnabled,
      });
    }
    return nodes;
  }

  function isECInstanceNodeKey(key: responseTypes.NodeKey): key is responseTypes.ECInstanceNodeKey {
    return key.Type === "ECInstanceNode";
  }

  /*function toHex(s: string): string {
    if (s.substr(0, 2).toLowerCase() === "0x")
      return s;
    const l = "0123456789ABCDEF";
    let o = "";
    for (let i = 0; i < s.length; i++) {
      const c = s.charCodeAt(i);
      o = o + l.substr((c >> 4), 1) + l.substr((c & 0x0f), 1);
    }
    return "0x" + o;
  }

  function id64FromString(strId: string): Id64 {
    // note: this won't always work when the numbers are higher
    // return parseInt(id.toString().slice(2), 16).toString();
    return new Id64(toHex(strId));
  }*/

  function createNavNodeKey(r: responseTypes.NodeKey): NavNodeKey {
    // WIP:
    if (isECInstanceNodeKey(r))
      return { type: r.Type, classId: r.ECClassId, instanceId: r.ECInstanceId } as ECInstanceNodeKey;
    return { type: r.Type };
  }

  function createClassInfo(r: responseTypes.ClassInfo): ec.ClassInfo {
    return {
      id: r.Id,
      name: r.Name,
      label: r.Label,
    };
  }

  function createInstanceKey(r: responseTypes.ECInstanceKey): ec.InstanceKey {
    return {
      classId: r.ECClassId,
      instanceId: r.ECInstanceId,
    };
  }

  function createInstanceKeyList(r: responseTypes.ECInstanceKey[]): ec.InstanceKey[] {
    return r.map((k: responseTypes.ECInstanceKey) => createInstanceKey(k));
  }

  function createContentItem(descriptor: content.Descriptor, r: responseTypes.ContentSetItem): content.Item {
    let classInfo: ec.ClassInfo | undefined;
    if (r.ClassInfo)
      classInfo = createClassInfo(r.ClassInfo);
    const item = {
      primaryKeys: createInstanceKeyList(r.PrimaryKeys!),
      label: r.DisplayLabel,
      imageId: r.ImageId,
      classInfo,
      values: r.Values,
      displayValues: r.DisplayValues,
      mergedFieldNames: r.MergedFieldNames || [],
      fieldPropertyValueKeys: createItemValueKeys(descriptor, r.FieldValueKeys || {}),
    } as content.Item;
    return item;
  }

  export function createContent(r: responseTypes.Content): content.Content {
    const descriptor = createContentDescriptor(r.Descriptor);
    if (!descriptor)
      throw new Error("Invalid content descriptor");

    const cont: content.Content = {
      descriptor,
      contentSet: [],
    };
    for (const itemResp of r.ContentSet)
      cont.contentSet.push(createContentItem(descriptor, itemResp));
    return cont;
  }

  function createItemValueKeys(_descriptor: content.Descriptor, _fieldValueKeysResp: { [fieldName: string]: any[] }): content.FieldPropertyValueKeys {
    const result: content.FieldPropertyValueKeys = {};
    /*for (const field of descriptor.fields) {
      if (!field.isPropertiesField || field.description.isArrayDescription || field.description.isStructDescription) {
        // only property-based fields have value keys
        // WIP: structs and arrays don't have value keys either
        continue;
      }

      const itemValueKeys = new Array<content.PropertyValueKeys>();
      const propertyKeysArr = fieldValueKeysResp[field.name];
      if (!propertyKeysArr) {
        continue;
      }
      for (const propertyKeys of propertyKeysArr) {
        const fieldProperty = field.asPropertiesField()!.properties[propertyKeys.PropertyIndex];
        if (!fieldProperty) {
          assert(false);
          continue;
        }
        itemValueKeys.push(new content.PropertyValueKeys(field, fieldProperty, propertyKeys.Keys));
      }
      result[field.name] = itemValueKeys;
    }*/
    return result;
  }

  export function createContentDescriptor(r: responseTypes.Descriptor): content.Descriptor {
    const selectClasses = new Array<content.SelectClassInfo>();
    for (const respClass of r.SelectClasses)
      selectClasses.push(createSelectClassInfo(respClass));

    const categories: { [name: string]: content.CategoryDescription } = {};
    const fields = new Array<content.Field>();
    for (const respField of r.Fields)
      fields.push(createField(respField, categories));

    let sortingField: content.Field | undefined;
    const sortDirection = r.SortDirection as content.SortDirection;
    if (r.SortingFieldIndex > 0 && r.SortingFieldIndex < fields.length)
      sortingField = fields[r.SortingFieldIndex];

    const descriptor = {
      displayType: r.PreferredDisplayType,
      contentFlags: r.ContentFlags,
      selectClasses,
      fields,
      sortingField,
      sortDirection,
      filterExpression: r.FilterExpression,
    } as content.Descriptor;
    return descriptor;
  }

  function createFieldType(r: responseTypes.FieldTypeDescription): content.TypeDescription {
    switch (r.ValueFormat) {
      case "Primitive":
        return {
          valueFormat: content.PropertyValueFormat.Primitive,
          typeName: r.TypeName,
        } as content.PrimitiveTypeDescription;
      case "Array":
        return {
          valueFormat: content.PropertyValueFormat.Array,
          typeName: r.TypeName,
          memberType: createFieldType((r as responseTypes.FieldArrayTypeDescription).MemberType),
        } as content.ArrayTypeDescription;
      case "Struct":
        const structMembers = new Array<StructFieldMemberDescription>();
        for (const member of (r as responseTypes.FieldStructTypeDescription).Members) {
          structMembers.push({
            name: member.Name,
            label: member.Label,
            type: createFieldType(member.Type),
          });
        }
        return {
          valueFormat: content.PropertyValueFormat.Struct,
          typeName: r.TypeName,
          members: structMembers,
        } as content.StructTypeDescription;
    }
    assert(false, "Unknown value format");
    return {
      valueFormat: content.PropertyValueFormat.Primitive,
      typeName: r.TypeName,
    } as content.PrimitiveTypeDescription;
  }

  function createSelectClassInfo(r: responseTypes.SelectClassInfo): content.SelectClassInfo {
    const relatedPropertyPaths = new Array<ec.RelationshipPathInfo>();
    for (const pr of r.RelatedPropertyPaths)
      relatedPropertyPaths.push(createRelationshipPath(pr));
    const info = {
      selectClassInfo: createClassInfo(r.SelectClassInfo),
      isSelectPolymorphic: r.IsPolymorphic,
      pathToPrimaryClass: createRelationshipPath(r.PathToPrimaryClass),
      relatedPropertyPaths,
    } as content.SelectClassInfo;
    return info;
  }

  function createFieldEditor(_r: responseTypes.Editor): content.EditorDescription | undefined {
    return undefined;
    /* todo:
    if (!r)
      return null;
    const editor = new content.EditorDescription(r.Name);
    for (const paramsName in r.Params) {
      let unknownParams: any = r.Params[paramsName];
      switch (paramsName) {
        case EditorParamsTypes.Json:
          {
            editor.Params.MiscJsonParams = unknownParams;
            break;
          }
        case EditorParamsTypes.Multiline:
          {
            let params: IContentDescriptorFieldEditorMultilineParamsResponse = unknownParams;
            editor.Params.SupportsMultilineTex = { HeightInRows: params.HeightInRows };
            break;
          }
        case EditorParamsTypes.Range:
          {
            let params: IContentDescriptorFieldEditorRangeParamsResponse = unknownParams;
            editor.Params.SupportsRange = {
              Minimum: params.Minimum,
              Maximum: params.Maximum
            };
            break;
          }
        case EditorParamsTypes.Slider:
          {
            let params: IContentDescriptorFieldEditorSliderParamsResponse = unknownParams;
            editor.Params.SupportsSliderParams = {
              Minimum: params.Minimum,
              Maximum: params.Maximum,
              Intervals: (1 != params.IntervalsCount),
              NumButtons: params.IntervalsCount,
              ValueFactor: params.ValueFactor,
              Vertical: params.IsVertical
            };
            break;
          }
        default:
          {
            BeAssert(false, "Unrecognized field editor");
          }
      }
    }
    return editor;*/
  }

  function createCategory(r: responseTypes.Category, categories: { [name: string]: content.CategoryDescription }): content.CategoryDescription {
    if (categories.hasOwnProperty(r.Name))
      return categories[r.Name];
    const category = {
      name: r.Name,
      label: r.DisplayLabel,
      description: r.Description,
      priority: r.Priority,
      expand: r.Expand,
    } as content.CategoryDescription;
    categories[category.name] = category;
    return category;
  }

  function createChoices(r: responseTypes.EnumerationChoice[]): ec.EnumerationChoice[] {
    const choices = new Array<ec.EnumerationChoice>();
    for (const choice of r)
      choices.push({ label: choice.Label, value: choice.Value });
    return choices;
  }

  function createECPropertyInfo(r: responseTypes.ECProperty): ec.PropertyInfo {
    const propertyInfo: ec.PropertyInfo = {
      classInfo: createClassInfo(r.ActualClassInfo),
      name: r.Name,
      type: r.Type,
    };
    if (r.Choices) {
      propertyInfo.enumerationInfo = {
        choices: createChoices(r.Choices),
        isStrict: r.IsStrict ? true : false,
      };
    }
    /* todo:
    if (r.KindOfQuantity)
      propertyInfo.KindOfQuantity = CreateECKindOfQuantityInfo(r.KindOfQuantity);*/

    return propertyInfo;
  }

  function createRelatedClassInfo(r: responseTypes.RelatedClass): ec.RelatedClassInfo {
    return {
      sourceClassInfo: createClassInfo(r.SourceClassInfo),
      targetClassInfo: createClassInfo(r.TargetClassInfo),
      relationshipInfo: createClassInfo(r.RelationshipInfo),
      isForwardRelationship: r.IsForwardRelationship,
    };
  }

  function createRelationshipPath(r: responseTypes.RelatedClassPath): ec.RelationshipPathInfo {
    const path = new Array<ec.RelatedClassInfo>();
    for (const pr of r)
      path.push(createRelatedClassInfo(pr));
    return path;
  }

  function createFieldProperty(r: responseTypes.FieldProperty): content.Property {
    const propertyInfo = createECPropertyInfo(r.Property);
    const relatedClassPath = new Array<ec.RelatedClassInfo>();
    for (const pr of r.RelatedClassPath)
      relatedClassPath.push(createRelatedClassInfo(pr));
    const property = {
      property: propertyInfo,
      relatedClassPath,
    } as content.Property;
    return property;
  }

  function createPropertiesField(r: responseTypes.ECPropertiesField, type: content.TypeDescription, editor: content.EditorDescription | undefined,
    category: content.CategoryDescription, parent: content.NestedContentField | undefined): content.PropertiesField {
    const properties = new Array<content.Property>();
    for (const pr of r.Properties)
      properties.push(createFieldProperty(pr));
    return {
      category,
      name: r.Name,
      label: r.DisplayLabel,
      description: type,
      properties,
      editor,
      priority: r.Priority,
      isReadOnly: r.IsReadOnly,
      parent,
    } as content.PropertiesField;
  }

  function createNestedContentField(r: responseTypes.NestedContentField, type: content.TypeDescription, editor: content.EditorDescription | undefined,
    categories: { [name: string]: content.CategoryDescription }, parent?: content.NestedContentField): content.NestedContentField {
    assert(isStructDescription(type), "Nested content fields' type should be 'struct'");
    const category = categories[r.Category.Name];
    const nestedFields = new Array<content.Field>();
    const field = {
      category,
      name: r.Name,
      label: r.DisplayLabel,
      description: type,
      contentClassInfo: createClassInfo(r.ContentClassInfo),
      pathToPrimaryClass: createRelationshipPath(r.PathToPrimary),
      nestedFields,
      editor,
      priority: r.Priority,
      isReadOnly: r.IsReadOnly,
      parent,
    } as content.NestedContentField;
    for (const nestedField of r.NestedFields)
      nestedFields.push(createField(nestedField, categories, field));
    return field;
  }

  function isPropertiesField(field: responseTypes.Field): field is responseTypes.ECPropertiesField {
    return (field as any).Properties;
  }

  function isNestedContentField(field: responseTypes.Field): field is responseTypes.NestedContentField {
    return (field as any).ContentClassInfo;
  }

  function createField(r: responseTypes.Field, categories: { [name: string]: content.CategoryDescription }, parent?: content.NestedContentField): content.Field {
    const type = createFieldType(r.Type);
    const editor = createFieldEditor(r.Editor!);
    const category = createCategory(r.Category, categories);
    if (isPropertiesField(r))
      return createPropertiesField(r as responseTypes.ECPropertiesField, type, editor, category, parent);
    if (isNestedContentField(r)) {
      return createNestedContentField(r as responseTypes.NestedContentField, type, editor, categories, parent);
    }
    return {
      category,
      name: r.Name,
      label: r.DisplayLabel,
      description: type,
      editor,
      priority: r.Priority,
      isReadOnly: r.IsReadOnly,
      parent,
    } as content.Field;
  }
}
