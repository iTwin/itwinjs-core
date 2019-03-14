// @public
interface ISelectionProvider {
  getSelection(imodel: IModelConnection, level: number): Readonly<KeySet>;
  selectionChange: SelectionChangeEvent;
}

// @public
class PersistenceHelper {
  static createKeySet(imodel: IModelConnection, container: PersistentKeysContainer): Promise<KeySet>;
  static createPersistentKeysContainer(imodel: IModelConnection, keyset: KeySet): Promise<PersistentKeysContainer>;
}

// @public
class Presentation {
  // (undocumented)
  static i18n: I18N;
  // WARNING: The type "PresentationManagerProps" needs to be exported by the package (e.g. added to index.ts)
  static initialize(props?: PresentationManagerProps): void;
  // (undocumented)
  static presentation: PresentationManager;
  // (undocumented)
  static selection: SelectionManager;
  static terminate(): void;
}

// @public
class PresentationManager implements IDisposable {
  activeLocale: string | undefined;
  // WARNING: The type "Props" needs to be exported by the package (e.g. added to index.ts)
  static create(props?: Props): PresentationManager;
  // (undocumented)
  dispose(): void;
  getContent(requestOptions: Paged<ContentRequestOptions<IModelConnection>>, descriptorOrOverrides: Readonly<Descriptor> | DescriptorOverrides, keys: Readonly<KeySet>): Promise<Readonly<Content> | undefined>;
  getContentAndSize(requestOptions: Paged<ContentRequestOptions<IModelConnection>>, descriptorOrOverrides: Readonly<Descriptor> | DescriptorOverrides, keys: Readonly<KeySet>): Promise<Readonly<ContentResponse>>;
  getContentDescriptor(requestOptions: ContentRequestOptions<IModelConnection>, displayType: string, keys: Readonly<KeySet>, selection: Readonly<SelectionInfo> | undefined): Promise<Readonly<Descriptor> | undefined>;
  getContentSetSize(requestOptions: ContentRequestOptions<IModelConnection>, descriptorOrOverrides: Readonly<Descriptor> | DescriptorOverrides, keys: Readonly<KeySet>): Promise<number>;
  getDistinctValues(requestOptions: ContentRequestOptions<IModelConnection>, descriptor: Readonly<Descriptor>, keys: Readonly<KeySet>, fieldName: string, maximumValueCount?: number): Promise<string[]>;
  getFilteredNodePaths(requestOptions: HierarchyRequestOptions<IModelConnection>, filterText: string): Promise<NodePathElement[]>;
  getNodePaths(requestOptions: HierarchyRequestOptions<IModelConnection>, paths: InstanceKey[][], markedIndex: number): Promise<NodePathElement[]>;
  getNodes(requestOptions: Paged<HierarchyRequestOptions<IModelConnection>>, parentKey?: Readonly<NodeKey>): Promise<ReadonlyArray<Readonly<Node>>>;
  getNodesAndCount(requestOptions: Paged<HierarchyRequestOptions<IModelConnection>>, parentKey?: Readonly<NodeKey>): Promise<Readonly<NodesResponse>>;
  getNodesCount(requestOptions: HierarchyRequestOptions<IModelConnection>, parentKey?: Readonly<NodeKey>): Promise<number>;
  // (undocumented)
  readonly rpcRequestsHandler: RpcRequestsHandler;
  // WARNING: The type "RulesetManager" needs to be exported by the package (e.g. added to index.ts)
  rulesets(): RulesetManager;
  vars(rulesetId: string): RulesetVariablesManager;
}

// @public (undocumented)
class RulesetVariablesManager implements IClientStateHolder<RulesetVariablesState> {
  constructor(rulesetId: string);
  getBool(variableId: string): Promise<boolean>;
  getId64(variableId: string): Promise<Id64String>;
  getId64s(variableId: string): Promise<Id64String[]>;
  getInt(variableId: string): Promise<number>;
  getInts(variableId: string): Promise<number[]>;
  getString(variableId: string): Promise<string>;
  // (undocumented)
  key: string;
  // (undocumented)
  onStateChanged: BeEvent<() => void>;
  setBool(variableId: string, value: boolean): Promise<void>;
  setId64(variableId: string, value: Id64String): Promise<void>;
  setId64s(variableId: string, value: Id64String[]): Promise<void>;
  setInt(variableId: string, value: number): Promise<void>;
  setInts(variableId: string, value: number[]): Promise<void>;
  setString(variableId: string, value: string): Promise<void>;
  // (undocumented)
  readonly state: RulesetVariablesState;
}

// @public
class SelectionChangeEvent extends BeEvent<SelectionChangesListener> {
}

// @public
interface SelectionChangeEventArgs {
  changeType: SelectionChangeType;
  imodel: IModelConnection;
  keys: Readonly<KeySet>;
  level: number;
  rulesetId?: string;
  source: string;
  timestamp: Date;
}

// @public
enum SelectionChangeType {
  Add = 0,
  Clear = 3,
  Remove = 1,
  Replace = 2
}

// @public
class SelectionHandler implements IDisposable {
  constructor(manager: SelectionManager, name: string, imodel: IModelConnection, rulesetId?: string, onSelect?: SelectionChangesListener);
  addToSelection(keys: Keys, level?: number): void;
  clearSelection(level?: number): void;
  dispose(): void;
  getSelection(level?: number): Readonly<KeySet>;
  getSelectionLevels(): number[];
  // (undocumented)
  imodel: IModelConnection;
  // (undocumented)
  readonly manager: SelectionManager;
  // (undocumented)
  name: string;
  // (undocumented)
  onSelect?: SelectionChangesListener;
  protected onSelectionChanged: (evt: SelectionChangeEventArgs, provider: ISelectionProvider) => void;
  removeFromSelection(keys: Keys, level?: number): void;
  replaceSelection(keys: Keys, level?: number): void;
  // (undocumented)
  rulesetId?: string;
  protected shouldHandle(evt: SelectionChangeEventArgs): boolean;
}

// @public
class SelectionManager implements ISelectionProvider {
  // WARNING: The type "SelectionManagerProps" needs to be exported by the package (e.g. added to index.ts)
  constructor(props: SelectionManagerProps);
  addToSelection(source: string, imodel: IModelConnection, keys: Keys, level?: number, rulesetId?: string): void;
  addToSelectionWithScope(source: string, imodel: IModelConnection, ids: Id64Arg, scope: SelectionScope | string, level?: number, rulesetId?: string): Promise<void>;
  clearSelection(source: string, imodel: IModelConnection, level?: number, rulesetId?: string): void;
  getSelection(imodel: IModelConnection, level?: number): Readonly<KeySet>;
  getSelectionLevels(imodel: IModelConnection): number[];
  removeFromSelection(source: string, imodel: IModelConnection, keys: Keys, level?: number, rulesetId?: string): void;
  removeFromSelectionWithScope(source: string, imodel: IModelConnection, ids: Id64Arg, scope: SelectionScope | string, level?: number, rulesetId?: string): Promise<void>;
  replaceSelection(source: string, imodel: IModelConnection, keys: Keys, level?: number, rulesetId?: string): void;
  replaceSelectionWithScope(source: string, imodel: IModelConnection, ids: Id64Arg, scope: SelectionScope | string, level?: number, rulesetId?: string): Promise<void>;
  // WARNING: The type "SelectionScopesManager" needs to be exported by the package (e.g. added to index.ts)
  readonly scopes: SelectionScopesManager;
  readonly selectionChange: SelectionChangeEvent;
  setSyncWithIModelToolSelection(imodel: IModelConnection, sync?: boolean): void;
}

// WARNING: Unsupported export: SelectionChangesListener
// (No @packagedocumentation comment for this package)
