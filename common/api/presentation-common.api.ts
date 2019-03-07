// @public
interface AllInstanceNodesSpecification extends ChildNodeSpecificationBase, DefaultGroupingPropertiesContainer {
  specType: RuleSpecificationTypes.AllInstanceNodes;
  supportedSchemas?: SchemasSpecification;
}

// @public
interface AllRelatedInstanceNodesSpecification extends ChildNodeSpecificationBase, DefaultGroupingPropertiesContainer {
  requiredDirection?: RelationshipDirection;
  skipRelatedLevel?: number;
  specType: RuleSpecificationTypes.AllRelatedInstanceNodes;
  supportedSchemas?: SchemasSpecification;
}

// @public
interface ArrayTypeDescription extends BaseTypeDescription {
  // (undocumented)
  memberType: TypeDescription;
  // (undocumented)
  valueFormat: PropertyValueFormat.Array;
}

// @public
interface BaseFieldJSON {
  // (undocumented)
  category: CategoryDescription;
  // (undocumented)
  editor?: EditorDescription;
  // (undocumented)
  isReadonly: boolean;
  // (undocumented)
  label: string;
  // (undocumented)
  name: string;
  // (undocumented)
  priority: number;
  // (undocumented)
  type: TypeDescription;
}

// @public
interface BaseNodeKey {
  pathFromRoot: string[];
  // (undocumented)
  type: string;
}

// @public
interface CalculatedPropertiesSpecification {
  label: string;
  priority?: number;
  value: string;
}

// @public
interface CategoryDescription {
  description: string;
  expand: boolean;
  label: string;
  name: string;
  priority: number;
}

// @public
interface CheckBoxRule extends RuleBase, ConditionContainer {
  condition?: string;
  defaultValue?: boolean;
  isEnabled?: string | boolean;
  propertyName?: string;
  ruleType: RuleTypes.CheckBox;
  useInversedPropertyValue?: boolean;
}

// @public
interface ChildNodeRule extends NavigationRuleBase, ConditionContainer {
  condition?: string;
  ruleType: RuleTypes.ChildNodes;
}

// @public
interface ClassGroup extends GroupingSpecificationBase {
  baseClass?: SingleSchemaClassSpecification;
  createGroupForSingleItem?: boolean;
  specType: GroupingSpecificationTypes.Class;
}

// @public
interface ClassInfo {
  // (undocumented)
  id: ClassId;
  // (undocumented)
  label: string;
  // (undocumented)
  name: string;
}

// @public
interface ClassInfoJSON {
  // (undocumented)
  id: string;
  // (undocumented)
  label: string;
  // (undocumented)
  name: string;
}

// @public
class Content {
  contentSet: Array<Readonly<Item>>;
  descriptor: Readonly<Descriptor>;
  static fromJSON(json: ContentJSON | string | undefined): Content | undefined;
  static reviver(key: string, value: any): any;
}

// @public
enum ContentFlags {
  DistinctValues = 16,
  KeysOnly = 1,
  MergeResults = 8,
  NoFields = 32,
  ShowImages = 2,
  ShowLabels = 4
}

// @public
interface ContentInstancesOfSpecificClassesSpecification extends ContentSpecificationBase {
  arePolymorphic?: boolean;
  classes: MultiSchemaClassesSpecification | MultiSchemaClassesSpecification[];
  instanceFilter?: string;
  specType: RuleSpecificationTypes.ContentInstancesOfSpecificClasses;
}

// @public
interface ContentJSON {
  // (undocumented)
  contentSet: ItemJSON[];
  // (undocumented)
  descriptor: DescriptorJSON;
}

// @public
interface ContentModifier extends RuleBase {
  calculatedProperties?: CalculatedPropertiesSpecification[];
  class?: SingleSchemaClassSpecification;
  propertiesDisplay?: PropertiesDisplaySpecification[];
  propertyEditors?: PropertyEditorsSpecification[];
  relatedProperties?: RelatedPropertiesSpecification[];
  ruleType: RuleTypes.ContentModifier;
}

// @public
interface ContentRelatedInstancesSpecification extends ContentSpecificationBase {
  instanceFilter?: string;
  isRecursive?: boolean;
  relatedClasses?: MultiSchemaClassesSpecification | MultiSchemaClassesSpecification[];
  relationships?: MultiSchemaClassesSpecification | MultiSchemaClassesSpecification[];
  requiredDirection?: RelationshipDirection;
  skipRelatedLevel?: number;
  specType: RuleSpecificationTypes.ContentRelatedInstances;
}

// @public
interface ContentRequestOptions<TIModel> extends RequestOptions<TIModel> {
}

// @public
interface ContentRule extends RuleBase, ConditionContainer {
  condition?: string;
  ruleType: RuleTypes.Content;
  specifications: ContentSpecification[];
}

// @public
interface CustomNodeSpecification extends ChildNodeSpecificationBase {
  description?: string;
  imageId?: string;
  label: string;
  specType: RuleSpecificationTypes.CustomNode;
  type: string;
}

// @public
interface CustomQueryInstanceNodesSpecification extends ChildNodeSpecificationBase, DefaultGroupingPropertiesContainer {
  queries?: QuerySpecification[];
  specType: RuleSpecificationTypes.CustomQueryInstanceNodes;
}

// WARNING: UNDEFINED has incomplete type information
// WARNING: GRID has incomplete type information
// WARNING: PROPERTY_PANE has incomplete type information
// WARNING: LIST has incomplete type information
// WARNING: VIEWPORT has incomplete type information
// @public
class DefaultContentDisplayTypes {
}

// @public
class Descriptor {
  connectionId: string;
  contentFlags: number;
  contentOptions: any;
  // WARNING: The type "DescriptorOverrides" needs to be exported by the package (e.g. added to index.ts)
  // (undocumented)
  createDescriptorOverrides(): DescriptorOverrides;
  // (undocumented)
  createStrippedDescriptor(): Descriptor;
  displayType: string;
  fields: Field[];
  filterExpression?: string;
  static fromJSON(json: DescriptorJSON | string | undefined): Descriptor | undefined;
  getFieldByName(name: string, recurse?: boolean): Field | undefined;
  inputKeysHash: string;
  // (undocumented)
  rebuildParentship(): void;
  // (undocumented)
  resetParentship(): void;
  static reviver(key: string, value: any): any;
  selectClasses: SelectClassInfo[];
  selectionInfo?: SelectionInfo;
  sortDirection?: SortDirection;
  sortingField?: Field;
}

// @public
interface DescriptorJSON {
  // (undocumented)
  connectionId: string;
  // (undocumented)
  contentFlags: number;
  // (undocumented)
  contentOptions: any;
  // (undocumented)
  displayType: string;
  // (undocumented)
  fields: FieldJSON[];
  // (undocumented)
  filterExpression?: string;
  // (undocumented)
  inputKeysHash: string;
  // (undocumented)
  selectClasses: SelectClassInfoJSON[];
  // (undocumented)
  selectionInfo?: SelectionInfo;
  // (undocumented)
  sortDirection?: SortDirection;
  // (undocumented)
  sortingFieldName?: string;
}

// @public (undocumented)
export function displayValueFromJSON(json: DisplayValueJSON): DisplayValue;

// @public (undocumented)
interface DisplayValuesArray extends Array<DisplayValue> {
}

// @public (undocumented)
export function displayValuesArrayFromJSON(json: DisplayValuesArrayJSON): DisplayValuesArray;

// @public (undocumented)
interface DisplayValuesArrayJSON extends Array<DisplayValueJSON> {
}

// @public (undocumented)
interface DisplayValuesMap extends ValuesDictionary<DisplayValue> {
}

// @public (undocumented)
export function displayValuesMapFromJSON(json: DisplayValuesMapJSON): DisplayValuesMap;

// @public (undocumented)
interface DisplayValuesMapJSON extends ValuesDictionary<DisplayValueJSON> {
}

// @public
interface ECClassGroupingNodeKey extends GroupingNodeKey {
  className: string;
  // (undocumented)
  type: StandardNodeTypes.ECClassGroupingNode;
}

// @public
interface ECInstanceNodeKey extends BaseNodeKey {
  instanceKey: InstanceKey;
  // (undocumented)
  type: StandardNodeTypes.ECInstanceNode;
}

// @public
interface ECInstanceNodeKeyJSON extends BaseNodeKey {
  // (undocumented)
  instanceKey: InstanceKeyJSON;
  // (undocumented)
  type: StandardNodeTypes.ECInstanceNode;
}

// @public
interface ECPropertyGroupingNodeKey extends GroupingNodeKey {
  className: string;
  groupingValue: any;
  propertyName: string;
  // (undocumented)
  type: StandardNodeTypes.ECPropertyGroupingNode;
}

// @public
interface ECPropertyValueQuerySpecification extends QuerySpecificationBase {
  parentPropertyName: string;
  specType: QuerySpecificationTypes.ECPropertyValue;
}

// @public
interface EditorDescription {
  name: string;
  params: any;
}

// @public
interface EnumerationChoice {
  // (undocumented)
  label: string;
  // (undocumented)
  value: string | number;
}

// @public
interface EnumerationInfo {
  // (undocumented)
  choices: EnumerationChoice[];
  // (undocumented)
  isStrict: boolean;
}

// @public
class Field {
  constructor(category: CategoryDescription, name: string, label: string, type: TypeDescription, isReadonly: boolean, priority: number, editor?: EditorDescription);
  category: Readonly<CategoryDescription>;
  editor?: Readonly<EditorDescription>;
  static fromJSON(json: FieldJSON | string | undefined): Field | undefined;
  isNestedContentField(): this is NestedContentField;
  isPropertiesField(): this is PropertiesField;
  isReadonly: boolean;
  label: string;
  name: string;
  // (undocumented)
  readonly parent: Readonly<NestedContentField> | undefined;
  priority: number;
  // (undocumented)
  rebuildParentship(parentField?: NestedContentField): void;
  // (undocumented)
  resetParentship(): void;
  static reviver(key: string, value: any): any;
  type: Readonly<TypeDescription>;
}

// @public
interface GroupingRule extends RuleBase, ConditionContainer {
  class: SingleSchemaClassSpecification;
  condition?: string;
  groups: GroupingSpecification[];
  ruleType: RuleTypes.Grouping;
}

// @public
enum GroupingSpecificationTypes {
  // (undocumented)
  Class = "Class",
  // (undocumented)
  Property = "Property",
  // (undocumented)
  SameLabelInstance = "SameLabelInstance"
}

// @public
interface HierarchyRequestOptions<TIModel> extends RequestOptions<TIModel> {
}

// @public
interface IClientStateHolder<TState> {
  // (undocumented)
  key: string;
  // (undocumented)
  onStateChanged: BeEvent<() => void>;
  // (undocumented)
  state: TState | undefined;
}

// @public
interface ImageIdOverride extends RuleBase, ConditionContainer {
  condition?: string;
  imageIdExpression: string;
  ruleType: RuleTypes.ImageIdOverride;
}

// @public
interface InstanceKey {
  // (undocumented)
  className: string;
  // (undocumented)
  id: InstanceId;
}

// @public
interface InstanceKeyJSON {
  // (undocumented)
  className: string;
  // (undocumented)
  id: string;
}

// @public
interface InstanceLabelOverride extends RuleBase {
  class: SingleSchemaClassSpecification;
  propertyNames: string[];
  ruleType: RuleTypes.InstanceLabelOverride;
}

// @public
interface InstanceNodesOfSpecificClassesSpecification extends ChildNodeSpecificationBase, DefaultGroupingPropertiesContainer {
  arePolymorphic?: boolean;
  classes: MultiSchemaClassesSpecification | MultiSchemaClassesSpecification[];
  instanceFilter?: string;
  specType: RuleSpecificationTypes.InstanceNodesOfSpecificClasses;
}

// @public (undocumented)
export function isArray(v: Value | ValueJSON | DisplayValue | DisplayValueJSON): v is ValuesArray | ValuesArrayJSON | DisplayValuesArray | DisplayValuesArrayJSON;

// @public (undocumented)
export function isMap(v: Value | ValueJSON | DisplayValue | DisplayValueJSON): v is ValuesMap | ValuesMapJSON | DisplayValuesMap | DisplayValuesMapJSON;

// @public (undocumented)
export function isNestedContentValue(v: Value | ValueJSON): v is NestedContentValue[] | NestedContentValueJSON[];

// @public (undocumented)
export function isPrimitive(v: Value | DisplayValue): v is string | number | boolean | undefined;

// @public
class Item {
  constructor(primaryKeys: ec.InstanceKey[], label: string, imageId: string, classInfo: ec.ClassInfo | undefined, values: ValuesDictionary<Value>, displayValues: ValuesDictionary<DisplayValue>, mergedFieldNames: string[]);
  classInfo?: Readonly<ec.ClassInfo>;
  displayValues: Readonly<ValuesDictionary<DisplayValue>>;
  static fromJSON(json: ItemJSON | string | undefined): Item | undefined;
  imageId: string;
  isFieldMerged(fieldName: string): boolean;
  label: string;
  mergedFieldNames: string[];
  primaryKeys: Array<Readonly<ec.InstanceKey>>;
  static reviver(key: string, value: any): any;
  values: Readonly<ValuesDictionary<Value>>;
}

// @public
interface ItemJSON {
  // (undocumented)
  classInfo?: ec.ClassInfoJSON;
  // (undocumented)
  displayValues: ValuesDictionary<DisplayValueJSON>;
  // (undocumented)
  imageId: string;
  // (undocumented)
  label: string;
  // (undocumented)
  mergedFieldNames: string[];
  // (undocumented)
  primaryKeys: ec.InstanceKeyJSON[];
  // (undocumented)
  values: ValuesDictionary<ValueJSON>;
}

// @public
class KeySet {
  constructor(source?: Keys);
  // WARNING: The type "Key" needs to be exported by the package (e.g. added to index.ts)
  add(value: Keys | Key): KeySet;
  clear(): KeySet;
  // WARNING: The type "Key" needs to be exported by the package (e.g. added to index.ts)
  delete(value: Keys | Key): KeySet;
  readonly guid: GuidString;
  // WARNING: The type "Key" needs to be exported by the package (e.g. added to index.ts)
  has(value: Key): boolean;
  hasAll(keys: Keys): boolean;
  hasAny(keys: Keys): boolean;
  readonly instanceKeys: Map<string, Set<InstanceId>>;
  readonly instanceKeysCount: number;
  readonly isEmpty: boolean;
  readonly nodeKeys: Set<NodeKey>;
  readonly nodeKeysCount: number;
  readonly size: number;
  // WARNING: The type "KeySetJSON" needs to be exported by the package (e.g. added to index.ts)
  toJSON(): KeySetJSON;
}

// @public
interface KindOfQuantityInfo {
  // (undocumented)
  currentFormatId: string;
  // (undocumented)
  label: string;
  // (undocumented)
  name: string;
  // (undocumented)
  persistenceUnit: string;
}

// @public
interface LabelGroupingNodeKey extends GroupingNodeKey {
  label: string;
  // (undocumented)
  type: StandardNodeTypes.DisplayLabelGroupingNode;
}

// @public
interface LabelOverride extends RuleBase, ConditionContainer {
  condition?: string;
  description?: string;
  label?: string;
  ruleType: RuleTypes.LabelOverride;
}

// @public
enum LoggingNamespaces {
  // (undocumented)
  ECObjects = "ECObjects",
  // (undocumented)
  ECObjects_ECExpressions = "ECObjects.ECExpressions",
  // (undocumented)
  ECObjects_ECExpressions_Evaluate = "ECObjects.ECExpressions.Evaluate",
  // (undocumented)
  ECObjects_ECExpressions_Parse = "ECObjects.ECExpressions.Parse",
  // (undocumented)
  ECPresentation = "ECPresentation",
  // (undocumented)
  ECPresentation_Connections = "ECPresentation.Connections",
  // (undocumented)
  ECPresentation_RulesEngine = "ECPresentation.RulesEngine",
  // (undocumented)
  ECPresentation_RulesEngine_Content = "ECPresentation.RulesEngine.Content",
  // (undocumented)
  ECPresentation_RulesEngine_Localization = "ECPresentation.RulesEngine.Localization",
  // (undocumented)
  ECPresentation_RulesEngine_Navigation = "ECPresentation.RulesEngine.Navigation",
  // (undocumented)
  ECPresentation_RulesEngine_Navigation_Cache = "ECPresentation.RulesEngine.Navigation.Cache",
  // (undocumented)
  ECPresentation_RulesEngine_RulesetVariables = "ECPresentation.RulesEngine.RulesetVariables",
  // (undocumented)
  ECPresentation_RulesEngine_Threads = "ECPresentation.RulesEngine.Threads",
  // (undocumented)
  ECPresentation_RulesEngine_Update = "ECPresentation.RulesEngine.Update"
}

// @public
interface MultiSchemaClassesSpecification {
  classNames: string[];
  schemaName: string;
}

// @public
class NestedContentField extends Field {
  constructor(category: CategoryDescription, name: string, label: string, description: TypeDescription, isReadonly: boolean, priority: number, contentClassInfo: ec.ClassInfo, pathToPrimaryClass: ec.RelationshipPathInfo, nestedFields: Field[], editor?: EditorDescription);
  contentClassInfo: ec.ClassInfo;
  static fromJSON(json: NestedContentFieldJSON | string | undefined): NestedContentField | undefined;
  nestedFields: Array<Readonly<Field>>;
  pathToPrimaryClass: ec.RelationshipPathInfo;
  // (undocumented)
  rebuildParentship(parentField?: NestedContentField): void;
  // (undocumented)
  resetParentship(): void;
}

// @public
interface NestedContentFieldJSON extends BaseFieldJSON {
  // (undocumented)
  contentClassInfo: ec.ClassInfoJSON;
  // (undocumented)
  nestedFields: FieldJSON[];
  // (undocumented)
  pathToPrimaryClass: ec.RelationshipPathInfoJSON;
}

// @public
interface NestedContentValue {
  // (undocumented)
  displayValues: ValuesDictionary<DisplayValue>;
  // (undocumented)
  mergedFieldNames: string[];
  // (undocumented)
  primaryKeys: InstanceKey[];
  // (undocumented)
  values: ValuesDictionary<Value>;
}

// @public (undocumented)
export function nestedContentValueFromJSON(json: NestedContentValueJSON): NestedContentValue;

// @public
interface NestedContentValueJSON {
  // (undocumented)
  displayValues: ValuesDictionary<DisplayValueJSON>;
  // (undocumented)
  mergedFieldNames: string[];
  // (undocumented)
  primaryKeys: InstanceKeyJSON[];
  // (undocumented)
  values: ValuesDictionary<ValueJSON>;
}

// @public
interface Node {
  backColor?: string;
  description?: string;
  // (undocumented)
  fontStyle?: string;
  foreColor?: string;
  hasChildren?: boolean;
  // (undocumented)
  imageId?: string;
  isCheckboxEnabled?: boolean;
  isCheckboxVisible?: boolean;
  isChecked?: boolean;
  isEditable?: boolean;
  isExpanded?: boolean;
  isSelectionDisabled?: boolean;
  key: NodeKey;
  label: string;
}

// @public
interface NodeJSON {
  // (undocumented)
  backColor?: string;
  // (undocumented)
  description?: string;
  // (undocumented)
  fontStyle?: string;
  // (undocumented)
  foreColor?: string;
  // (undocumented)
  hasChildren?: boolean;
  // (undocumented)
  imageId?: string;
  // (undocumented)
  isCheckboxEnabled?: boolean;
  // (undocumented)
  isCheckboxVisible?: boolean;
  // (undocumented)
  isChecked?: boolean;
  // (undocumented)
  isEditable?: boolean;
  // (undocumented)
  isExpanded?: boolean;
  // (undocumented)
  isSelectionDisabled?: boolean;
  // (undocumented)
  key: NodeKeyJSON;
  // (undocumented)
  label: string;
}

// @public
interface NodePathElement {
  // (undocumented)
  children: NodePathElement[];
  // (undocumented)
  filteringData?: NodePathFilteringData;
  // (undocumented)
  index: number;
  // (undocumented)
  isMarked: boolean;
  // (undocumented)
  node: Node;
}

// @public
interface PageOptions {
  size?: number;
  start?: number;
}

// @public
interface PersistentKeysContainer {
  // (undocumented)
  elements: Id64String[];
  // (undocumented)
  models: Id64String[];
  // (undocumented)
  nodes: NodeKey[];
}

// @public
class PresentationError extends BentleyError {
  constructor(errorNumber: PresentationStatus, message?: string, log?: LogFunction, getMetaData?: GetMetaDataFunction);
  protected _initName(): string;
}

// @public
class PresentationRpcInterface extends RpcInterface {
  // WARNING: The type "SelectionScopeRpcRequestOptions" needs to be exported by the package (e.g. added to index.ts)
  // (undocumented)
  computeSelection(_token: IModelToken, _options: SelectionScopeRpcRequestOptions, _keys: Readonly<EntityProps[]>, _scopeId: string): Promise<KeySet>;
  getChildren(_token: IModelToken, _options: Paged<HierarchyRpcRequestOptions>, _parentKey: Readonly<NodeKey>): Promise<Node[]>;
  getChildrenCount(_token: IModelToken, _options: HierarchyRpcRequestOptions, _parentKey: Readonly<NodeKey>): Promise<number>;
  // WARNING: The type "ContentRpcRequestOptions" needs to be exported by the package (e.g. added to index.ts)
  getContent(_token: IModelToken, _options: ContentRpcRequestOptions, _descriptor: Readonly<Descriptor>, _keys: Readonly<KeySet>): Promise<Content>;
  // WARNING: The type "ContentRpcRequestOptions" needs to be exported by the package (e.g. added to index.ts)
  getContentDescriptor(_token: IModelToken, _options: ContentRpcRequestOptions, _displayType: string, _keys: Readonly<KeySet>, _selection: Readonly<SelectionInfo> | undefined): Promise<Descriptor | undefined>;
  // WARNING: The type "ContentRpcRequestOptions" needs to be exported by the package (e.g. added to index.ts)
  getContentSetSize(_token: IModelToken, _options: ContentRpcRequestOptions, _descriptor: Readonly<Descriptor>, _keys: Readonly<KeySet>): Promise<number>;
  // WARNING: The type "ContentRpcRequestOptions" needs to be exported by the package (e.g. added to index.ts)
  getDistinctValues(_token: IModelToken, _options: ContentRpcRequestOptions, _descriptor: Readonly<Descriptor>, _keys: Readonly<KeySet>, _fieldName: string, _maximumValueCount: number): Promise<string[]>;
  getFilteredNodePaths(_token: IModelToken, _options: HierarchyRpcRequestOptions, _filterText: string): Promise<NodePathElement[]>;
  getNodePaths(_token: IModelToken, _options: HierarchyRpcRequestOptions, _paths: InstanceKey[][], _markedIndex: number): Promise<NodePathElement[]>;
  getRootNodes(_token: IModelToken, _options: Paged<HierarchyRpcRequestOptions>): Promise<Node[]>;
  getRootNodesCount(_token: IModelToken, _options: HierarchyRpcRequestOptions): Promise<number>;
  // WARNING: The type "SelectionScopeRpcRequestOptions" needs to be exported by the package (e.g. added to index.ts)
  // (undocumented)
  getSelectionScopes(_token: IModelToken, _options: SelectionScopeRpcRequestOptions): Promise<SelectionScope[]>;
  // (undocumented)
  syncClientState(_token: IModelToken, _options: ClientStateSyncRequestOptions): Promise<void>;
  static types: () => (typeof Field | typeof PropertiesField | typeof NestedContentField | typeof Descriptor | typeof Item | typeof Content)[];
  static version: string;
}

// @public
enum PresentationStatus {
  // (undocumented)
  BackendOutOfSync = 65542,
  // (undocumented)
  Error = 65536,
  // (undocumented)
  InvalidArgument = 65539,
  // (undocumented)
  InvalidResponse = 65540,
  // (undocumented)
  NoContent = 65541,
  // (undocumented)
  NotInitialized = 65537,
  // (undocumented)
  Success = 0,
  // (undocumented)
  UseAfterDisposal = 65538
}

// @public
interface PrimitiveTypeDescription extends BaseTypeDescription {
  // (undocumented)
  valueFormat: PropertyValueFormat.Primitive;
}

// @public
interface PropertiesDisplaySpecification {
  isDisplayed?: boolean;
  priority?: number;
  propertyNames: string[];
}

// @public
class PropertiesField extends Field {
  constructor(category: CategoryDescription, name: string, label: string, description: TypeDescription, isReadonly: boolean, priority: number, properties: Property[], editor?: EditorDescription);
  static fromJSON(json: PropertiesFieldJSON | string | undefined): PropertiesField | undefined;
  properties: Array<Readonly<Property>>;
}

// @public
interface PropertiesFieldJSON extends BaseFieldJSON {
  // (undocumented)
  properties: PropertyJSON[];
}

// @public
interface Property {
  property: Readonly<ec.PropertyInfo>;
  relatedClassPath: Readonly<ec.RelationshipPathInfo>;
}

// @public
interface PropertyEditorJsonParameters extends PropertyEditorParametersBase {
  json: any;
  paramsType: PropertyEditorParameterTypes.Json;
}

// @public
interface PropertyEditorMultilineParameters extends PropertyEditorParametersBase {
  height?: number;
  paramsType: PropertyEditorParameterTypes.Multiline;
}

// @public
enum PropertyEditorParameterTypes {
  // (undocumented)
  Json = "Json",
  // (undocumented)
  Multiline = "Multiline",
  // (undocumented)
  Range = "Range",
  // (undocumented)
  Slider = "Slider"
}

// @public
interface PropertyEditorRangeParameters extends PropertyEditorParametersBase {
  max?: number;
  min?: number;
  paramsType: PropertyEditorParameterTypes.Range;
}

// @public
interface PropertyEditorSliderParameters extends PropertyEditorParametersBase {
  intervalsCount?: number;
  isVertical?: boolean;
  max: number;
  min: number;
  paramsType: PropertyEditorParameterTypes.Slider;
}

// @public
interface PropertyEditorsSpecification {
  editorName: string;
  parameters?: PropertyEditorParameters[];
  propertyName: string;
}

// @public
interface PropertyGroup extends GroupingSpecificationBase {
  createGroupForSingleItem?: boolean;
  createGroupForUnspecifiedValues?: boolean;
  groupingValue?: PropertyGroupingValue;
  imageId?: string;
  propertyName: string;
  ranges?: PropertyRangeGroupSpecification[];
  sortingValue?: PropertyGroupingValue;
  specType: GroupingSpecificationTypes.Property;
}

// @public
enum PropertyGroupingValue {
  DisplayLabel = "DisplayLabel",
  PropertyValue = "PropertyValue"
}

// @public
interface PropertyInfo {
  // (undocumented)
  classInfo: ClassInfo;
  // (undocumented)
  enumerationInfo?: EnumerationInfo;
  // (undocumented)
  kindOfQuantity?: KindOfQuantityInfo;
  // (undocumented)
  name: string;
  // (undocumented)
  type: string;
}

// @public
interface PropertyInfoJSON {
  // (undocumented)
  classInfo: ClassInfoJSON;
  // (undocumented)
  enumerationInfo?: EnumerationInfo;
  // (undocumented)
  kindOfQuantity?: KindOfQuantityInfo;
  // (undocumented)
  name: string;
  // (undocumented)
  type: string;
}

// @public
interface PropertyJSON {
  // (undocumented)
  property: ec.PropertyInfoJSON;
  // (undocumented)
  relatedClassPath: ec.RelationshipPathInfoJSON;
}

// @public
interface PropertyRangeGroupSpecification {
  fromValue: string;
  imageId?: string;
  label?: string;
  toValue: string;
}

// @public
enum PropertyValueFormat {
  // (undocumented)
  Array = "Array",
  // (undocumented)
  Primitive = "Primitive",
  // (undocumented)
  Struct = "Struct"
}

// @public
enum QuerySpecificationTypes {
  // (undocumented)
  ECPropertyValue = "ECPropertyValue",
  // (undocumented)
  String = "String"
}

// @public
class RegisteredRuleset implements IDisposable, Ruleset {
  constructor(ruleset: Ruleset, uniqueIdentifier: string, disposeFunc: (ruleset: RegisteredRuleset) => void);
  // (undocumented)
  dispose(): void;
  // (undocumented)
  readonly id: string;
  // (undocumented)
  readonly rules: Rule[];
  // (undocumented)
  readonly supplementationInfo: SupplementationInfo | undefined;
  // (undocumented)
  readonly supportedSchemas: SchemasSpecification | undefined;
  // (undocumented)
  toJSON(): Ruleset;
  // (undocumented)
  readonly uniqueIdentifier: string;
  // (undocumented)
  readonly vars: VariablesGroup[] | undefined;
}

// @public
interface RelatedClassInfo {
  isForwardRelationship: boolean;
  isPolymorphicRelationship: boolean;
  relationshipInfo: ClassInfo;
  sourceClassInfo: ClassInfo;
  targetClassInfo: ClassInfo;
}

// @public
interface RelatedClassInfoJSON {
  // (undocumented)
  isForwardRelationship: boolean;
  // (undocumented)
  isPolymorphicRelationship: boolean;
  // (undocumented)
  relationshipInfo: ClassInfoJSON;
  // (undocumented)
  sourceClassInfo: ClassInfoJSON;
  // (undocumented)
  targetClassInfo: ClassInfoJSON;
}

// @public
interface RelatedInstanceNodesSpecification extends ChildNodeSpecificationBase, DefaultGroupingPropertiesContainer {
  instanceFilter?: string;
  relatedClasses?: MultiSchemaClassesSpecification | MultiSchemaClassesSpecification[];
  relationships?: MultiSchemaClassesSpecification | MultiSchemaClassesSpecification[];
  requiredDirection?: RelationshipDirection;
  skipRelatedLevel?: number;
  specType: RuleSpecificationTypes.RelatedInstanceNodes;
  supportedSchemas?: string[];
}

// @public
interface RelatedInstanceSpecification {
  alias: string;
  class: SingleSchemaClassSpecification;
  isRequired?: boolean;
  relationship: SingleSchemaClassSpecification;
  requiredDirection: RelationshipDirection.Forward | RelationshipDirection.Backward;
}

// @public
interface RelatedPropertiesSpecification {
  isPolymorphic?: boolean;
  nestedRelatedProperties?: RelatedPropertiesSpecification[];
  propertyNames?: string[] | RelatedPropertiesSpecialValues;
  relatedClasses?: MultiSchemaClassesSpecification | MultiSchemaClassesSpecification[];
  relationshipMeaning?: RelationshipMeaning;
  relationships?: MultiSchemaClassesSpecification | MultiSchemaClassesSpecification[];
  requiredDirection?: RelationshipDirection;
}

// @public
enum RelationshipDirection {
  Backward = "Backward",
  Both = "Both",
  Forward = "Forward"
}

// @public
enum RelationshipMeaning {
  RelatedInstance = "RelatedInstance",
  SameInstance = "SameInstance"
}

// @public
interface RequestOptions<TIModel> {
  imodel: TIModel;
  locale?: string;
  rulesetId: string;
}

// @public
interface RootNodeRule extends NavigationRuleBase {
  autoExpand?: boolean;
  ruleType: RuleTypes.RootNodes;
}

// @public (undocumented)
interface RpcRequestOptions {
  // (undocumented)
  clientId?: string;
  // (undocumented)
  clientStateId?: string;
}

// @public
class RpcRequestsHandler implements IDisposable {
  // WARNING: The type "Props" needs to be exported by the package (e.g. added to index.ts)
  constructor(props?: Props);
  readonly clientId: string;
  readonly clientStateId: string | undefined;
  // (undocumented)
  computeSelection(options: SelectionScopeRequestOptions<IModelToken>, keys: EntityProps[], scopeId: string): Promise<KeySet>;
  // (undocumented)
  dispose(): void;
  // (undocumented)
  getChildren(options: Paged<HierarchyRequestOptions<IModelToken>>, parentKey: Readonly<NodeKey>): Promise<Node[]>;
  // (undocumented)
  getChildrenCount(options: HierarchyRequestOptions<IModelToken>, parentKey: Readonly<NodeKey>): Promise<number>;
  // (undocumented)
  getContent(options: ContentRequestOptions<IModelToken>, descriptor: Readonly<Descriptor>, keys: Readonly<KeySet>): Promise<Content>;
  // (undocumented)
  getContentDescriptor(options: ContentRequestOptions<IModelToken>, displayType: string, keys: Readonly<KeySet>, selection: Readonly<SelectionInfo> | undefined): Promise<Descriptor | undefined>;
  // (undocumented)
  getContentSetSize(options: ContentRequestOptions<IModelToken>, descriptor: Readonly<Descriptor>, keys: Readonly<KeySet>): Promise<number>;
  // (undocumented)
  getDistinctValues(options: ContentRequestOptions<IModelToken>, descriptor: Readonly<Descriptor>, keys: Readonly<KeySet>, fieldName: string, maximumValueCount: number): Promise<string[]>;
  // (undocumented)
  getFilteredNodePaths(options: HierarchyRequestOptions<IModelToken>, filterText: string): Promise<NodePathElement[]>;
  // (undocumented)
  getNodePaths(options: HierarchyRequestOptions<IModelToken>, paths: InstanceKey[][], markedIndex: number): Promise<NodePathElement[]>;
  // (undocumented)
  getRootNodes(options: Paged<HierarchyRequestOptions<IModelToken>>): Promise<Node[]>;
  // (undocumented)
  getRootNodesCount(options: HierarchyRequestOptions<IModelToken>): Promise<number>;
  // (undocumented)
  getSelectionScopes(options: SelectionScopeRequestOptions<IModelToken>): Promise<SelectionScope[]>;
  // (undocumented)
  registerClientStateHolder(holder: IClientStateHolder<any>): void;
  request<TResult, TOptions extends RpcRequestOptions & {
          imodel: IModelToken;
      }, TArg>(context: any, func: (token: IModelToken, options: Omit<TOptions, "imodel">, ...args: TArg[]) => Promise<TResult>, options: TOptions, ...args: TArg[]): Promise<TResult>;
  sync(token: IModelToken): Promise<void>;
  // (undocumented)
  unregisterClientStateHolder(holder: IClientStateHolder<any>): void;
}

// @public
interface Ruleset {
  id: string;
  rules: Rule[];
  supplementationInfo?: SupplementationInfo;
  supportedSchemas?: SchemasSpecification;
  vars?: VariablesGroup[];
}

// WARNING: Unsupported export: STATE_ID
// @public (undocumented)
module RulesetManagerState {
}

// @public
class RulesetsFactory {
  createSimilarInstancesRuleset: {
    description: string;
    ruleset: Ruleset;
  }
}

// @public (undocumented)
interface RulesetVariablesState {
}

// @public
enum RuleSpecificationTypes {
  // (undocumented)
  AllInstanceNodes = "AllInstanceNodes",
  // (undocumented)
  AllRelatedInstanceNodes = "AllRelatedInstanceNodes",
  // (undocumented)
  ContentInstancesOfSpecificClasses = "ContentInstancesOfSpecificClasses",
  // (undocumented)
  ContentRelatedInstances = "ContentRelatedInstances",
  // (undocumented)
  CustomNode = "CustomNode",
  // (undocumented)
  CustomQueryInstanceNodes = "CustomQueryInstanceNodes",
  // (undocumented)
  InstanceNodesOfSpecificClasses = "InstanceNodesOfSpecificClasses",
  // (undocumented)
  RelatedInstanceNodes = "RelatedInstanceNodes",
  // (undocumented)
  SelectedNodeInstances = "SelectedNodeInstances"
}

// @public
enum RuleTypes {
  // (undocumented)
  CheckBox = "CheckBox",
  // (undocumented)
  ChildNodes = "ChildNodes",
  // (undocumented)
  Content = "Content",
  // (undocumented)
  ContentModifier = "ContentModifier",
  // (undocumented)
  DisabledSorting = "DisabledSorting",
  // (undocumented)
  Grouping = "Grouping",
  // (undocumented)
  ImageIdOverride = "ImageIdOverride",
  // (undocumented)
  InstanceLabelOverride = "InstanceLabelOverride",
  // (undocumented)
  LabelOverride = "LabelOverride",
  // (undocumented)
  PropertySorting = "PropertySorting",
  // (undocumented)
  RootNodes = "RootNodes",
  // (undocumented)
  StyleOverride = "StyleOverride"
}

// @public
interface SameLabelInstanceGroup extends GroupingSpecificationBase {
  specType: GroupingSpecificationTypes.SameLabelInstance;
}

// @public
interface SchemasSpecification {
  isExclude?: boolean;
  schemaNames: string[];
}

// @public
interface SelectClassInfo {
  isSelectPolymorphic: boolean;
  pathToPrimaryClass: ec.RelationshipPathInfo;
  relatedPropertyPaths: ec.RelationshipPathInfo[];
  selectClassInfo: ec.ClassInfo;
}

// @public
interface SelectClassInfoJSON {
  // (undocumented)
  isSelectPolymorphic: boolean;
  // (undocumented)
  pathToPrimaryClass: ec.RelationshipPathInfoJSON;
  // (undocumented)
  relatedPropertyPaths: ec.RelationshipPathInfoJSON[];
  // (undocumented)
  selectClassInfo: ec.ClassInfoJSON;
}

// @public
interface SelectedNodeInstancesSpecification extends ContentSpecificationBase {
  acceptableClassNames?: string;
  acceptablePolymorphically?: boolean;
  acceptableSchemaName?: string;
  onlyIfNotHandled?: boolean;
  specType: RuleSpecificationTypes.SelectedNodeInstances;
}

// @public
interface SelectionInfo {
  // (undocumented)
  level?: number;
  // (undocumented)
  providerName: string;
}

// @public
interface SelectionScope {
  // (undocumented)
  description?: string;
  // (undocumented)
  id: string;
  // (undocumented)
  label: string;
}

// @public
interface SelectionScopeRequestOptions<TIModel> {
  imodel: TIModel;
  locale?: string;
}

// @public
interface SingleSchemaClassSpecification {
  className: string;
  schemaName: string;
}

// @public
enum SortDirection {
  // (undocumented)
  Ascending = 0,
  // (undocumented)
  Descending = 1
}

// @public
enum StandardNodeTypes {
  // (undocumented)
  DisplayLabelGroupingNode = "DisplayLabelGroupingNode",
  // (undocumented)
  ECClassGroupingNode = "ECClassGroupingNode",
  // (undocumented)
  ECInstanceNode = "ECInstanceNode",
  // (undocumented)
  ECPropertyGroupingNode = "ECPropertyGroupingNode"
}

// @public
interface StringQuerySpecification extends QuerySpecificationBase {
  query: string;
  specType: QuerySpecificationTypes.String;
}

// @public
interface StructTypeDescription extends BaseTypeDescription {
  // (undocumented)
  members: StructFieldMemberDescription[];
  // (undocumented)
  valueFormat: PropertyValueFormat.Struct;
}

// @public
interface StyleOverride extends RuleBase, ConditionContainer {
  backColor?: string;
  condition?: string;
  fontStyle?: FontStyle;
  foreColor?: string;
  ruleType: RuleTypes.StyleOverride;
}

// @public
interface SubCondition extends ConditionContainer {
  condition?: string;
  specifications?: ChildNodeSpecification[];
  subConditions?: SubCondition[];
}

// @public
interface SupplementationInfo {
  supplementationPurpose: string;
}

// @public (undocumented)
export function valueFromJSON(json: ValueJSON): Value;

// @public (undocumented)
interface ValuesArray extends Array<Value> {
}

// @public (undocumented)
export function valuesArrayFromJSON(json: ValuesArrayJSON): ValuesArray;

// @public (undocumented)
interface ValuesArrayJSON extends Array<ValueJSON> {
}

// @public
interface ValuesDictionary<T> {
  // (undocumented)
  [key: string]: T;
}

// @public (undocumented)
interface ValuesMap extends ValuesDictionary<Value> {
}

// @public (undocumented)
export function valuesMapFromJSON(json: ValuesMapJSON): ValuesMap;

// @public (undocumented)
interface ValuesMapJSON extends ValuesDictionary<ValueJSON> {
}

// @public
interface Variable {
  defaultValue?: string;
  id: string;
  label: string;
  type?: VariableValueType;
}

// @public
interface VariablesGroup {
  label: string;
  nestedGroups?: VariablesGroup[];
  vars: Variable[];
}

// @public
enum VariableValueType {
  Int = "IntValue",
  ShowHide = "ShowHide",
  String = "StringValue",
  YesNo = "YesNo"
}

// @public
enum VariableValueTypes {
  Bool = "bool",
  Id64 = "id64",
  Id64Array = "id64[]",
  Int = "int",
  IntArray = "int[]",
  String = "string"
}

// WARNING: Unsupported export: Keys
// WARNING: Unsupported export: HierarchyRpcRequestOptions
// WARNING: Unsupported export: ClientStateSyncRequestOptions
// WARNING: Unsupported export: VariableValue
// WARNING: Unsupported export: FieldJSON
// WARNING: Unsupported export: TypeDescription
// WARNING: Unsupported export: Value
// WARNING: Unsupported export: DisplayValue
// WARNING: Unsupported export: NodeKey
// WARNING: Unsupported export: NodeKeyPath
// WARNING: Unsupported export: NodeKeyJSON
// WARNING: Unsupported export: nodeKeyFromJSON
// WARNING: Unsupported export: isInstanceNodeKey
// WARNING: Unsupported export: isClassGroupingNodeKey
// WARNING: Unsupported export: isPropertyGroupingNodeKey
// WARNING: Unsupported export: isLabelGroupingNodeKey
// WARNING: Unsupported export: isGroupingNodeKey
// WARNING: Unsupported export: SortingRule
// WARNING: Unsupported export: GroupingSpecification
// WARNING: Unsupported export: Rule
// WARNING: Unsupported export: ClassId
// WARNING: Unsupported export: InstanceId
// WARNING: Unsupported export: instanceKeyFromJSON
// WARNING: Unsupported export: InstanceKeysList
// WARNING: Unsupported export: classInfoFromJSON
// WARNING: Unsupported export: propertyInfoFromJSON
// WARNING: Unsupported export: relatedClassInfoFromJSON
// WARNING: Unsupported export: RelationshipPathInfo
// WARNING: Unsupported export: RelationshipPathInfoJSON
// WARNING: Unsupported export: ValueJSON
// WARNING: Unsupported export: DisplayValueJSON
// WARNING: Unsupported export: Paged
// WARNING: Unsupported export: Omit
// WARNING: Unsupported export: Subtract
// WARNING: Unsupported export: getInstancesCount
// (No @packagedocumentation comment for this package)
