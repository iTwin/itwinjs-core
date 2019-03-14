// @public
class ContentBuilder {
  static createPropertyDescription(field: Field): PropertyDescription;
  static createPropertyRecord(field: Field, item: Item, path?: Field[]): PropertyRecord;
}

// @public
class ContentDataProvider implements IContentDataProvider {
  constructor(imodel: IModelConnection, ruleset: string | Ruleset, displayType: string);
  protected configureContentDescriptor(descriptor: Readonly<Descriptor>): Descriptor;
  readonly displayType: string;
  // (undocumented)
  dispose(): void;
  getContent(pageOptions?: PageOptions): Promise<Readonly<Content> | undefined>;
  getContentDescriptor: (() => Promise<Readonly<Descriptor> | undefined>) & _.MemoizedFunction;
  getContentSetSize(): Promise<number>;
  protected getDescriptorOverrides(): DescriptorOverrides;
  imodel: IModelConnection;
  // WARNING: The type "CacheInvalidationProps" needs to be exported by the package (e.g. added to index.ts)
  protected invalidateCache(props: CacheInvalidationProps): void;
  protected isFieldHidden(_field: Field): boolean;
  keys: Readonly<KeySet>;
  pagingSize: number | undefined;
  rulesetId: string;
  selectionInfo: Readonly<SelectionInfo> | undefined;
  protected shouldConfigureContentDescriptor(): boolean;
  protected shouldExcludeFromDescriptor(field: Field): boolean;
}

// @public
class DataProvidersFactory {
  constructor(props?: DataProvidersFactoryProps);
  // WARNING: The type "PresentationTableDataProviderProps" needs to be exported by the package (e.g. added to index.ts)
  createSimilarInstancesTableDataProvider(propertiesProvider: IPresentationPropertyDataProvider, record: PropertyRecord, props: Omit<PresentationTableDataProviderProps, "imodel" | "ruleset">): Promise<IPresentationTableDataProvider & {
          description: string;
      }>;
}

// @public
interface DataProvidersFactoryProps {
  // (undocumented)
  rulesetsFactory?: RulesetsFactory;
}

// @public
interface IPresentationTreeDataProvider extends ITreeDataProvider, IPresentationDataProvider {
  getFilteredNodePaths(filter: string): Promise<NodePathElement[]>;
  getNodeKey(node: TreeNodeItem): NodeKey;
}

// @public
class PresentationPropertyDataProvider extends ContentDataProvider, implements IPresentationPropertyDataProvider {
  constructor(imodel: IModelConnection, rulesetId: string);
  getData(): Promise<PropertyData>;
  protected getDescriptorOverrides(): DescriptorOverrides;
  protected getMemoizedData: (() => Promise<PropertyData>) & _.MemoizedFunction;
  includeFieldsWithNoValues: boolean;
  // WARNING: The type "CacheInvalidationProps" needs to be exported by the package (e.g. added to index.ts)
  // (undocumented)
  protected invalidateCache(props: CacheInvalidationProps): void;
  protected isFieldFavorite(_field: Field): boolean;
  protected isFieldHidden(field: Field): boolean;
  // (undocumented)
  onDataChanged: PropertyDataChangeEvent;
  protected shouldConfigureContentDescriptor(): boolean;
  protected sortCategories(categories: CategoryDescription[]): void;
  protected sortFields(_category: CategoryDescription, fields: Field[]): void;
}

// @public
class PresentationTableDataProvider extends ContentDataProvider, implements IPresentationTableDataProvider {
  // WARNING: The type "PresentationTableDataProviderProps" needs to be exported by the package (e.g. added to index.ts)
  constructor(props: PresentationTableDataProviderProps);
  protected configureContentDescriptor(descriptor: Readonly<Descriptor>): Descriptor;
  filterExpression: string | undefined;
  getColumns: (() => Promise<ColumnDescription[]>) & _.MemoizedFunction;
  getLoadedRow(rowIndex: number): Readonly<RowItem> | undefined;
  getRow(rowIndex: number): Promise<RowItem>;
  getRowsCount(): Promise<number>;
  // WARNING: The type "CacheInvalidationProps" needs to be exported by the package (e.g. added to index.ts)
  // (undocumented)
  protected invalidateCache(props: CacheInvalidationProps): void;
  // (undocumented)
  onColumnsChanged: TableDataChangeEvent;
  // (undocumented)
  onRowsChanged: TableDataChangeEvent;
  sort(columnIndex: number, sortDirection: UiSortDirection): Promise<void>;
  readonly sortColumn: Promise<ColumnDescription | undefined>;
  readonly sortColumnKey: string | undefined;
  readonly sortDirection: UiSortDirection;
}

// @public
class PresentationTreeDataProvider implements IPresentationTreeDataProvider {
  constructor(imodel: IModelConnection, rulesetId: string);
  getFilteredNodePaths: (filter: string) => Promise<NodePathElement[]>;
  getNodeKey(node: TreeNodeItem): NodeKey;
  getNodes(parentNode?: TreeNodeItem, pageOptions?: PageOptions): Promise<DelayLoadedTreeNodeItem[]>;
  getNodesCount(parentNode?: TreeNodeItem): Promise<number>;
  readonly imodel: IModelConnection;
  pagingSize: number | undefined;
  readonly rulesetId: string;
}

// @public
export function propertyGridWithUnifiedSelection<P extends PropertyGridProps>(PropertyGridComponent: React.ComponentType<P>): React.ComponentType<Subtract<P, Props> & Props>;

// @public
export function tableWithUnifiedSelection<P extends TableProps>(TableComponent: React.ComponentType<P>): React.ComponentType<Subtract<P, Props> & Props>;

// @public
export function treeWithFilteringSupport<P extends TreeProps>(TreeComponent: React.ComponentType<P>): React.ComponentType<P & Props>;

// @public
export function treeWithUnifiedSelection<P extends TreeProps>(TreeComponent: React.ComponentType<P>): React.ComponentType<Subtract<Omit<P, "selectedNodes">, Props> & Props>;

// @public
export function viewWithUnifiedSelection<P extends ViewportProps>(ViewportComponent: React.ComponentType<P>): {
    new (props: Readonly<P & Props>): {
        viewportSelectionHandler?: ViewportSelectionHandler | undefined;
        readonly selectionHandler: SelectionHandler | undefined;
        readonly imodel: (P & Props)["imodel"];
        readonly rulesetId: string;
        componentDidMount(): void;
        componentWillUnmount(): void;
        componentDidUpdate(): void;
        render(): JSX.Element;
        context: any;
        setState<K extends never>(state: {} | ((prevState: Readonly<{}>, props: Readonly<P & Props>) => {} | Pick<{}, K> | null) | Pick<{}, K> | null, callback?: (() => void) | undefined): void;
        forceUpdate(callBack?: (() => void) | undefined): void;
        readonly props: Readonly<{
            children?: React.ReactNode;
        }> & Readonly<P & Props>;
        state: Readonly<{}>;
        refs: {
            [key: string]: React.ReactInstance;
        };
    };
    new (props: P & Props, context?: any): {
        viewportSelectionHandler?: ViewportSelectionHandler | undefined;
        readonly selectionHandler: SelectionHandler | undefined;
        readonly imodel: (P & Props)["imodel"];
        readonly rulesetId: string;
        componentDidMount(): void;
        componentWillUnmount(): void;
        componentDidUpdate(): void;
        render(): JSX.Element;
        context: any;
        setState<K extends never>(state: {} | ((prevState: Readonly<{}>, props: Readonly<P & Props>) => {} | Pick<{}, K> | null) | Pick<{}, K> | null, callback?: (() => void) | undefined): void;
        forceUpdate(callBack?: (() => void) | undefined): void;
        readonly props: Readonly<{
            children?: React.ReactNode;
        }> & Readonly<P & Props>;
        state: Readonly<{}>;
        refs: {
            [key: string]: React.ReactInstance;
        };
    };
    defaultProps: {
        ruleset: Ruleset;
    };
    readonly displayName: string;
    contextType?: React.Context<any> | undefined;
};

// WARNING: Unsupported export: IPresentationPropertyDataProvider
// WARNING: Unsupported export: IPresentationTableDataProvider
// (No @packagedocumentation comment for this package)
