/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { assert, Logger } from "@bentley/bentleyjs-core";
import { IModelToken, IModelError, IModelStatus } from "@bentley/imodeljs-common";
import { IModelDb, NativePlatformRegistry } from "@bentley/imodeljs-backend";
import { StructFieldMemberDescription, isStructDescription } from "@bentley/ecpresentation-common/lib/content/TypeDescription";
import { createDescriptorOverrides } from "@bentley/ecpresentation-common/lib/content/Descriptor";
import * as types from "@bentley/ecpresentation-common";
import * as responseTypes from "./AddonResponses";
import ECPresentationGateway from "./ECPresentationGateway";

// make sure the gateway gets registered (hopefully this is temporary)
ECPresentationGateway;

export interface Props {
  /** @hidden */
  addon?: NodeAddonDefinition;
  rulesetDirectories?: string[];
}

export default class ECPresentationManager implements types.ECPresentationManager {

  private _addon?: NodeAddonDefinition;

  constructor(props?: Props) {
    if (props && props.addon)
      this._addon = props.addon;
    if (props && props.rulesetDirectories)
      this.getNativePlatform().setupRulesetDirectories(props.rulesetDirectories);
  }

  /** @hidden */
  public getNativePlatform(): NodeAddonDefinition {
    if (!this._addon) {
      const addonImpl = createAddonImpl();
      this._addon = new addonImpl();
    }
    return this._addon!;
  }

  public async getRootNodes(token: IModelToken, pageOptions: types.PageOptions, options: object): Promise<Array<Readonly<types.NavNode>>> {
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

  public async getChildren(token: IModelToken, parent: types.NavNode, pageOptions: types.PageOptions, options: object): Promise<Array<Readonly<types.NavNode>>> {
    const params = this.createRequestParams(NodeAddonRequestTypes.GetChildren, {
      nodeKey: parent.key,
      pageOptions,
      options,
    });
    return this.request(token, params, Conversion.createNodesList);
  }

  public async getChildrenCount(token: IModelToken, parent: types.NavNode, options: object): Promise<number> {
    const params = this.createRequestParams(NodeAddonRequestTypes.GetChildrenCount, {
      nodeKey: parent.key,
      options,
    });
    return this.request(token, params);
  }

  public async getNodePaths(_token: IModelToken, _paths: types.NavNodeKeyPath[], _markedIndex: number, _options: object): Promise<Array<Readonly<types.NavNodePathElement>>> {
    throw new Error("Not implemented.");
  }

  public async getFilteredNodesPaths(_token: IModelToken, _filterText: string, _options: object): Promise<Array<Readonly<types.NavNodePathElement>>> {
    throw new Error("Not implemented.");
  }

  public async getContentDescriptor(token: IModelToken, displayType: string, keys: types.InstanceKeysList, selection: types.SelectionInfo | undefined, options: object): Promise<Readonly<types.Descriptor>> {
    const params = this.createRequestParams(NodeAddonRequestTypes.GetContentDescriptor, {
      displayType,
      keys,
      selection,
      options,
    });
    return this.request(token, params, Conversion.createContentDescriptor);
  }

  public async getContentSetSize(token: IModelToken, descriptor: types.Descriptor, keys: types.InstanceKeysList, options: object): Promise<number> {
    const params = this.createRequestParams(NodeAddonRequestTypes.GetContentSetSize, {
      keys,
      descriptorOverrides: createDescriptorOverrides(descriptor),
      options,
    });
    return this.request(token, params);
  }

  public async getContent(token: IModelToken, descriptor: types.Descriptor, keys: types.InstanceKeysList, pageOptions: types.PageOptions, options: object): Promise<Readonly<types.Content>> {
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

  public async saveValueChange(_token: IModelToken, _instancesInfo: types.ChangedECInstanceInfo[], _propertyAccessor: string, _value: any, _options: object): Promise<Array<Readonly<types.ECInstanceChangeResult>>> {
    // note: should probably handle this in typescript rather than forwarding to node addon
    throw new Error("Not implemented.");
  }

  private request(token: IModelToken, params: string, responseHandler?: (response: any) => any) {
    const imodelAddon = this.getNativePlatform().getImodelAddon(token);
    const serializedResponse = this.getNativePlatform().handleRequest(imodelAddon, params);
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
  const nativeAddon = (NativePlatformRegistry.getNativePlatform()).NativeECPresentationManager;
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
  export function createNodesList(r: responseTypes.Node[]): types.NavNode[] {
    if (!r)
      throw new Error("Invalid nodes' response");
    const nodes = new Array<types.NavNode>();
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

  function createNavNodeKey(r: responseTypes.NodeKey): types.NavNodeKey {
    const key = {
      type: r.Type,
      pathFromRoot: r.PathFromRoot,
      classId: r.ECClassId,
    } as types.NavNodeKey;
    if (isECInstanceNodeKey(r))
      return { ...key, instanceId: r.ECInstanceId } as types.ECInstanceNodeKey;
    return key;
  }

  function createClassInfo(r: responseTypes.ClassInfo): types.ClassInfo {
    return {
      id: r.Id,
      name: r.Name,
      label: r.Label,
    };
  }

  function createInstanceKey(r: responseTypes.ECInstanceKey): types.InstanceKey {
    return {
      classId: r.ECClassId,
      instanceId: r.ECInstanceId,
    };
  }

  function createInstanceKeyList(r: responseTypes.ECInstanceKey[]): types.InstanceKey[] {
    return r.map((k: responseTypes.ECInstanceKey) => createInstanceKey(k));
  }

  function createContentItem(descriptor: types.Descriptor, r: responseTypes.ContentSetItem): types.Item {
    let classInfo: types.ClassInfo | undefined;
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
    } as types.Item;
    return item;
  }

  export function createContent(r: responseTypes.Content): types.Content {
    if (!r)
      throw new Error("Invalid content response");
    const descriptor = createContentDescriptor(r.Descriptor);
    const cont: types.Content = {
      descriptor,
      contentSet: [],
    };
    for (const itemResp of r.ContentSet)
      cont.contentSet.push(createContentItem(descriptor, itemResp));
    return cont;
  }

  function createItemValueKeys(_descriptor: types.Descriptor, _fieldValueKeysResp: { [fieldName: string]: any[] }): types.FieldPropertyValueKeys {
    const result: types.FieldPropertyValueKeys = {};
    /*for (const field of descriptor.fields) {
      if (!field.isPropertiesField || field.description.isArrayDescription || field.description.isStructDescription) {
        // only property-based fields have value keys
        // WIP: structs and arrays don't have value keys either
        continue;
      }

      const itemValueKeys = new Array<types.PropertyValueKeys>();
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
        itemValueKeys.push(new types.PropertyValueKeys(field, fieldProperty, propertyKeys.Keys));
      }
      result[field.name] = itemValueKeys;
    }*/
    return result;
  }

  export function createContentDescriptor(r: responseTypes.Descriptor): types.Descriptor {
    if (!r)
      throw new Error("Invalid descriptor response");

    const selectClasses = new Array<types.SelectClassInfo>();
    for (const respClass of r.SelectClasses)
      selectClasses.push(createSelectClassInfo(respClass));

    const categories: { [name: string]: types.CategoryDescription } = {};
    const fields = new Array<types.Field>();
    for (const respField of r.Fields)
      fields.push(createField(respField, categories));

    let sortingField: types.Field | undefined;
    const sortDirection = r.SortDirection as types.SortDirection;
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
    } as types.Descriptor;
    return descriptor;
  }

  function createFieldType(r: responseTypes.FieldTypeDescription): types.TypeDescription {
    switch (r.ValueFormat) {
      case "Primitive":
        return {
          valueFormat: types.PropertyValueFormat.Primitive,
          typeName: r.TypeName,
        } as types.PrimitiveTypeDescription;
      case "Array":
        return {
          valueFormat: types.PropertyValueFormat.Array,
          typeName: r.TypeName,
          memberType: createFieldType((r as responseTypes.FieldArrayTypeDescription).MemberType),
        } as types.ArrayTypeDescription;
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
          valueFormat: types.PropertyValueFormat.Struct,
          typeName: r.TypeName,
          members: structMembers,
        } as types.StructTypeDescription;
    }
    assert(false, "Unknown value format");
    return {
      valueFormat: types.PropertyValueFormat.Primitive,
      typeName: r.TypeName,
    } as types.PrimitiveTypeDescription;
  }

  function createSelectClassInfo(r: responseTypes.SelectClassInfo): types.SelectClassInfo {
    const relatedPropertyPaths = new Array<types.RelationshipPathInfo>();
    for (const pr of r.RelatedPropertyPaths)
      relatedPropertyPaths.push(createRelationshipPath(pr));
    const info = {
      selectClassInfo: createClassInfo(r.SelectClassInfo),
      isSelectPolymorphic: r.IsPolymorphic,
      pathToPrimaryClass: createRelationshipPath(r.PathToPrimaryClass),
      relatedPropertyPaths,
    } as types.SelectClassInfo;
    return info;
  }

  function createFieldEditor(_r: responseTypes.Editor): types.EditorDescription | undefined {
    return undefined;
    /* todo:
    if (!r)
      return null;
    const editor = new types.EditorDescription(r.Name);
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

  function createCategory(r: responseTypes.Category, categories: { [name: string]: types.CategoryDescription }): types.CategoryDescription {
    if (categories.hasOwnProperty(r.Name))
      return categories[r.Name];
    const category = {
      name: r.Name,
      label: r.DisplayLabel,
      description: r.Description,
      priority: r.Priority,
      expand: r.Expand,
    } as types.CategoryDescription;
    categories[category.name] = category;
    return category;
  }

  function createChoices(r: responseTypes.EnumerationChoice[]): types.EnumerationChoice[] {
    const choices = new Array<types.EnumerationChoice>();
    for (const choice of r)
      choices.push({ label: choice.Label, value: choice.Value });
    return choices;
  }

  function createECPropertyInfo(r: responseTypes.ECProperty): types.PropertyInfo {
    const propertyInfo: types.PropertyInfo = {
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

  function createRelatedClassInfo(r: responseTypes.RelatedClass): types.RelatedClassInfo {
    return {
      sourceClassInfo: createClassInfo(r.SourceClassInfo),
      targetClassInfo: createClassInfo(r.TargetClassInfo),
      relationshipInfo: createClassInfo(r.RelationshipInfo),
      isForwardRelationship: r.IsForwardRelationship,
    };
  }

  function createRelationshipPath(r: responseTypes.RelatedClassPath): types.RelationshipPathInfo {
    const path = new Array<types.RelatedClassInfo>();
    for (const pr of r)
      path.push(createRelatedClassInfo(pr));
    return path;
  }

  function createFieldProperty(r: responseTypes.FieldProperty): types.Property {
    const propertyInfo = createECPropertyInfo(r.Property);
    const relatedClassPath = new Array<types.RelatedClassInfo>();
    for (const pr of r.RelatedClassPath)
      relatedClassPath.push(createRelatedClassInfo(pr));
    const property = {
      property: propertyInfo,
      relatedClassPath,
    } as types.Property;
    return property;
  }

  function createPropertiesField(r: responseTypes.ECPropertiesField, type: types.TypeDescription, editor: types.EditorDescription | undefined,
    category: types.CategoryDescription, parent: types.NestedContentField | undefined): types.PropertiesField {
    const properties = new Array<types.Property>();
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
    } as types.PropertiesField;
  }

  function createNestedContentField(r: responseTypes.NestedContentField, type: types.TypeDescription, editor: types.EditorDescription | undefined,
    categories: { [name: string]: types.CategoryDescription }, parent?: types.NestedContentField): types.NestedContentField {
    assert(isStructDescription(type), "Nested content fields' type should be 'struct'");
    const category = categories[r.Category.Name];
    const nestedFields = new Array<types.Field>();
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
    } as types.NestedContentField;
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

  function createField(r: responseTypes.Field, categories: { [name: string]: types.CategoryDescription }, parent?: types.NestedContentField): types.Field {
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
    } as types.Field;
  }
}
