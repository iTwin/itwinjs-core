/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { assert } from "@bentley/bentleyjs-core/lib/Assert";
import * as ec from "../common/EC";
import { NavNode, NavNodeKey, NavNodeKeyPath, NavNodePathElement } from "../common/Hierarchy";
import * as content from "../common/Content";
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

/** @hidden */
export interface ECPresentationManagerNodeAddonDefinition {
  handleRequest(db: any, options: string): string;
}

export default class ECPresentationManager implements ECPInterface {

  private _manager: ECPresentationManagerNodeAddonDefinition | null = null;

  private getManager(): ECPresentationManagerNodeAddonDefinition {
    if (!this._manager)
      this._manager = new (NodeAddonRegistry.getAddon()).NodeAddonECPresentationManager();
    return this._manager!;
  }

  public async getRootNodes(token: IModelToken, pageOptions: PageOptions, options: object): Promise<NavNode[]> {
    const params = this.createRequestParams("GetRootNodes", {
      pageOptions,
      options,
    });
    return this.request(token, params, this.createNodesList);
  }

  public async getRootNodesCount(token: IModelToken, options: object): Promise<number> {
    const params = this.createRequestParams("GetRootNodesCount", {
      options,
    });
    return this.request(token, params);
  }

  public async getChildren(token: IModelToken, parent: NavNode, pageOptions: PageOptions, options: object): Promise<NavNode[]> {
    const params = this.createRequestParams("GetChildren", {
      nodeId: parent.nodeId,
      pageOptions,
      options,
    });
    return this.request(token, params, this.createNodesList);
  }

  public async getChildrenCount(token: IModelToken, parent: NavNode, options: object): Promise<number> {
    const params = this.createRequestParams("GetChildrenCount", {
      nodeId: parent.nodeId,
      options,
    });
    return this.request(token, params);
  }

  public async getNodePaths(_token: IModelToken, _paths: NavNodeKeyPath[], _markedIndex: number, _options: object): Promise<NavNodePathElement[]> {
    return [];
  }

  public async getFilteredNodesPaths(_token: IModelToken, _filterText: string, _options: object): Promise<NavNodePathElement[]> {
    return [];
  }

  public async getContentDescriptor(token: IModelToken, displayType: string, keys: ec.InstanceKeysList, selection: content.SelectionInfo | null, options: object): Promise<content.Descriptor | null> {
    const params = this.createRequestParams("GetContentDescriptor", {
      displayType,
      keys,
      selection,
      options,
    });
    return this.request(token, params, this.createContentDescriptor);
  }

  public async getContentSetSize(token: IModelToken, _descriptor: content.Descriptor, keys: ec.InstanceKeysList, options: object): Promise<number> {
    const params = this.createRequestParams("GetContent", {
      keys,
      options,
    });
    return this.request(token, params);
  }

  public async getContent(token: IModelToken, _descriptor: content.Descriptor, keys: ec.InstanceKeysList, pageOptions: PageOptions, options: object): Promise<content.Content> {
    const params = this.createRequestParams("GetContent", {
      keys,
      pageOptions,
      options,
    });
    return this.request(token, params, this.createContent);
  }

  public async getDistinctValues(_token: IModelToken, _displayType: string, _fieldName: string, _maximumValueCount: number, _options: object): Promise<string[]> {
    return [];
  }

  public async saveValueChange(_token: IModelToken, _instancesInfo: ChangedECInstanceInfo[], _propertyAccessor: string, _value: any, _options: object): Promise<ECInstanceChangeResult[]> {
    // note: should probably handle this in typescript rather than forwarding to node addon
    return [];
  }

  private request(token: IModelToken, params: string, responseHandler?: (response: any) => any) {
    const imodel = IModelDb.find(token);
    if (!imodel || !imodel.nativeDb)
      throw new IModelError(IModelStatus.NotOpen, "IModelDb not open", Logger.logError, () => ({ iModelId: token.iModelId }));

    const serializedResponse = this.getManager().handleRequest(imodel.nativeDb, params);
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

  // tslint:disable-next-line:naming-convention
  private createNodesList = (r: any[]): NavNode[] => {
    const nodes = new Array<NavNode>();
    for (const rNode of r) {
      nodes.push({
        nodeId: rNode.NodeId,
        parentNodeId: rNode.ParentNodeId,
        key: this.createNavNodeKey(rNode.Key),
        label: rNode.Label,
        description: rNode.Description,
        imageId: rNode.ExpandedImageId,
        foreColor: rNode.ForeColor,
        backColor: rNode.BackColor,
        fontStyle: rNode.FontStyle,
        type: rNode.Type,
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

  // tslint:disable-next-line:naming-convention
  private createNavNodeKey = (r: any): NavNodeKey => {
    /* todo:
    switch (r.Type) {
    }
    assert(false, "Unknown node key type");*/
    return {type: r.Type};
  }

  // tslint:disable-next-line:naming-convention
  private createContent = (r: any): content.Content | null => {
    if (!r)
      return null;

    const descriptor = this.createContentDescriptor(r.Descriptor);
    if (!descriptor)
      return null;

    const cont = new content.Content(descriptor);

    for (const itemResp of r.ContentSet) {
      let classInfo: ec.ClassInfo | null = null;
      if (itemResp.ClassInfo) {
        classInfo = {
          id: itemResp.ClassInfo.Id,
          name: itemResp.ClassInfo.Name,
          label: itemResp.ClassInfo.Label,
        };
      }
      const item = new content.ContentSetItem(itemResp.PrimaryKeys, itemResp.DisplayLabel, itemResp.ImageId, classInfo,
        itemResp.Values, itemResp.DisplayValues, itemResp.MergedFieldNames,
        this.createItemValueKeys(descriptor, itemResp.FieldValueKeys));
      cont.contentSet.push(item);
    }

    return cont;
  }

  // tslint:disable-next-line:naming-convention
  private createItemValueKeys = (descriptor: content.Descriptor, fieldValueKeysResp: { [fieldName: string]: any[] }): content.FieldPropertyValueKeys => {
    const result: content.FieldPropertyValueKeys = {};
    for (const field of descriptor.fields) {
      if (!field.isPropertiesField || field.description.isArrayDescription || field.description.isStructDescription) {
        // only property-based fields have value keys
        // WIP: structs and arrays don't have value keys either
        continue;
      }

      const itemValueKeys = new Array<content.PropertyValueKeys>();
      const propertyKeysArr = fieldValueKeysResp[field.name];
      if (!propertyKeysArr) {
        assert(false, "Property-based fields should always have property value keys");
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
    }
    return result;
  }

  // tslint:disable-next-line:naming-convention
  private createContentDescriptor = (r: any): content.Descriptor | null => {
    if (!r)
      return null;

    const selectClasses = new Array<content.SelectClassInfo>();
    for (const respClass of r.SelectClasses)
      selectClasses.push(this.createSelectClassInfo(respClass));

    const categories: { [name: string]: content.CategoryDescription } = {};
    const fields = new Array<content.Field>();
    for (const respField of r.Fields)
      fields.push(this.createField(respField, categories, null));

    let sortingField: content.Field | null = null;
    const sortingDirection = r.SortDirection as content.SortDirection;
    if (r.SortingFieldIndex > 0 && r.SortingFieldIndex < fields.length)
      sortingField = fields[r.SortingFieldIndex];

    const descriptor = new content.Descriptor(r.PreferredDisplayType, selectClasses, fields, r.ContentFlags);
    descriptor.sortingField = sortingField;
    descriptor.sortDirection = sortingDirection;
    descriptor.filterExpression = r.FilterExpression;
    return descriptor;
  }

  // tslint:disable-next-line:naming-convention
  private createFieldType = (r: any): content.TypeDescription => {
    switch (r.ValueFormat) {
      case "Primitive":
        return new content.PrimitiveTypeDescription(r.TypeName);
      case "Array":
        return new content.ArrayTypeDescription(r.TypeName, this.createFieldType(r.MemberType));
      case "Struct":
        const structDescription = new content.StructTypeDescription(r.TypeName);
        for (const member of r.Members) {
          structDescription.members.push({
            name: member.Name,
            label: member.Label,
            type: this.createFieldType(member.Type),
          });
        }
        return structDescription;
    }
    assert(false, "Unknown value format");
    return new content.PrimitiveTypeDescription("string");
  }

  // tslint:disable-next-line:naming-convention
  private createSelectClassInfo = (r: any): content.SelectClassInfo => {
    const classInfo = {
      id: r.SelectClassInfo.Id,
      name: r.SelectClassInfo.Name,
      label: r.SelectClassInfo.Label,
    };
    const info = new content.SelectClassInfo(classInfo, r.IsPolymorphic,
      this.createRelationshipPath(r.PathToPrimaryClass));
    for (const pr of r.RelatedPropertyPaths)
      info.relatedPropertyPaths.push(this.createRelationshipPath(pr));
    return info;
  }

  // tslint:disable-next-line:naming-convention
  private createFieldEditor = (_r: any): content.EditorDescription | null => {
    return null;
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

  // tslint:disable-next-line:naming-convention
  private createCategory = (r: any, categories: { [name: string]: content.CategoryDescription }): content.CategoryDescription => {
    if (categories.hasOwnProperty(r.Name))
      return categories[r.Name];

    const category = new content.CategoryDescription(r.Name, r.DisplayLabel, r.Description, r.Priority, r.Expand);
    categories[category.name] = category;
    return category;
  }

  // tslint:disable-next-line:naming-convention
  private createChoices = (r: any): ec.EnumerationChoice[] => {
    const choices = new Array<ec.EnumerationChoice>();
    for (const choice of r)
      choices.push({ label: choice.Label, value: choice.Value });
    return choices;
  }

  // tslint:disable-next-line:naming-convention
  private createECPropertyInfo = (r: any): ec.PropertyInfo => {
    const propertyInfo: ec.PropertyInfo = {
      classInfo: {
        id: r.ActualClassInfo.Id,
        name: r.ActualClassInfo.Name,
        label: r.ActualClassInfo.Label,
      },
      name: r.Name,
      type: r.Type,
    };
    if (r.Choices) {
      propertyInfo.enumerationInfo = {
        choices: this.createChoices(r.Choices),
        isStrict: r.IsStrict ? true : false,
      };
    }
    /* todo:
    if (r.KindOfQuantity)
      propertyInfo.KindOfQuantity = CreateECKindOfQuantityInfo(r.KindOfQuantity);*/

    return propertyInfo;
  }

  // tslint:disable-next-line:naming-convention
  private createRelatedClassInfo = (r: any): ec.RelatedClassInfo => {
    return {
      sourceClassInfo: {
        id: r.SourceClassInfo.Id,
        name: r.SourceClassInfo.Name,
        label: r.SourceClassInfo.Label,
      },
      targetClassInfo: {
        id: r.TargetClassInfo.Id,
        name: r.TargetClassInfo.Name,
        label: r.TargetClassInfo.Label,
      },
      relationshipInfo: {
        id: r.RelationshipInfo.Id,
        name: r.RelationshipInfo.Name,
        label: r.RelationshipInfo.Label,
      },
      isForwardRelationship: r.IsForwardRelationship,
    };
  }

  // tslint:disable-next-line:naming-convention
  private createRelationshipPath = (r: any[]): ec.RelationshipPathInfo => {
    const path = new Array<ec.RelatedClassInfo>();
    for (const pr of r)
      path.push(this.createRelatedClassInfo(pr));
    return path;
  }

  // tslint:disable-next-line:naming-convention
  private createFieldProperty = (r: any): content.Property => {
    const propertyInfo = this.createECPropertyInfo(r.Property);
    const property = new content.Property(propertyInfo);
    for (const pr of r.RelatedClassPath)
      property.relatedClassPath.push(this.createRelatedClassInfo(pr));
    return property;
  }

  // tslint:disable-next-line:naming-convention
  private createField = (r: any, categories: { [name: string]: content.CategoryDescription }, parent: content.NestedContentField | null): content.Field => {
    const type = this.createFieldType(r.Type);
    const editor = this.createFieldEditor(r.Editor);
    const category = this.createCategory(r.Category, categories);
    if (r.Properties) {
      // ecproperties-based field
      const field = new content.PropertiesField(category, r.Name, r.DisplayLabel, type,
        r.IsReadOnly, r.Priority, editor, parent);
      for (const pr of r.Properties)
        field.properties.push(this.createFieldProperty(pr));
      return field;
    }
    if (r.ContentClassInfo) {
      // nested content field
      assert(type.isStructDescription, "Nested content fields' type should be 'struct'");
      const classInfo = {
        id: r.ContentClassInfo.Id,
        name: r.ContentClassInfo.Name,
        label: r.ContentClassInfo.Label,
      };
      const field = new content.NestedContentField(category, r.Name, r.DisplayLabel, type.asStructDescription()!,
        classInfo, this.createRelationshipPath(r.PathToPrimary), r.IsReadOnly, r.Priority, editor, parent);
      for (const nestedField of r.NestedFields)
        field.nestedFields.push(this.createField(nestedField, categories, field));
      return field;
    }
    // generic field (display label, calculated, etc.)
    return new content.Field(category, r.Name, r.DisplayLabel, type,
      r.IsReadOnly, r.Priority, editor, parent);
  }
}
