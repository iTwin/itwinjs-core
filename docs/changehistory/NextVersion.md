---
ignore: true
---
# NextVersion

## Tile compression

[IModelHostConfiguration.compressCachedTiles]($backend) specifies whether tiles uploaded to blob storage should be compressed using gzip. Previously, it defaulted to `false` if omitted. The default has now been switched to `true`. Compressing tiles conserves bandwidth; the tiles are transparently and efficiently decompressed by the browser.

## Breaking API changes

* The union type [Matrix3dProps]($geometry-core) inadvertently included [Matrix3d]($geometry-core). "Props" types are wire formats and so must be pure JavaScript primitives. To fix compilation errors where you are using `Matrix3d` where a `Matrix3dProps` is expected, simply call [Matrix3d.toJSON]($geometry-core) on your Matrix3d object. Also, since [TransformProps]($geometry-core) includes Matrix3dProps, you may need to call [Transform.toJSON]($geometry-core) on your Transform objects some places too.

* The type of [Texture.data]($backend) has been corrected from `string` to `Uint8Array` to match the type in the BIS schema. If you get compilation errors, simply remove calls to `Buffer.from(texture.data, "base64")` for read, and `texture.data.toString("base64")` if you create texture objects.

## Updated version of Electron

Updated version of electron used from 8.2.1 to 10.1.3. Note that Electron is specified as a peer dependency in the iModel.js stack - so it's recommended but not mandatory that applications migrate to this electron version.

## UI

### Filtering in Property Grid

Now it is possible to filter items(Records or Categories) in Property Grid using filterers and `FilteringPropertyDataProvider`, while also highlighting the part of an item which was matched. There are several different filterers that can be combined using `CompositePropertyDataFilterer`. The filterer which we want to use needs to be passed down to `FilteringPropertyDataProvider` which gives us access to the filtered data, found matches count, function to get a specific match information by index and also all types which were filtered by filtering data provider.

**Filterers:**

```list
CompositePropertyDataFilterer - used for combining filterers
DisplayValuePropertyDataFilterer - used for filtering `PropertyRecords` by display value
FavoritePropertiesDataFilterer - used for filtering 'Favorite' `PropertyRecords`
LabelPropertyDataFilterer - used for filtering `PropertyRecords` by label
PropertyCategoryLabelFilterer - used for filtering `PropertyCategories` by label
```

**Example:**

```JavaScript
const [activeHighlight, setActiveHighlight] = React.useState<HighlightInfo>();

const filteringDataProvider = useDisposable(React.useCallback(() => {
// Creating different filterers
const valueFilterer = new DisplayValuePropertyDataFilterer("Test");
const labelFilterer = new LabelPropertyDataFilterer("Test");
const categoryFilterer = new PropertyCategoryLabelFilterer("Test");
const favoriteFilterer = new FavoritePropertiesDataFilterer({ source: dataProvider, favoritesScope: FAVORITES_SCOPE, isActive: true });

// Combining filterers
const recordFilterer = new CompositePropertyDataFilterer(labelFilterer, CompositeFilterType.Or, valueFilterer);
const textFilterer = new CompositePropertyDataFilterer(recordFilterer, CompositeFilterType.Or, categoryFilterer);
/*
 * Created filterer will filter all records, which have "Test" in their label or displayValue and are 'Favorite' and all categories which have "Test" in their label and are 'Favorite'
 */
const favoriteTextFilterer = new CompositePropertyDataFilterer(textFilterer, CompositeFilterType.And, favoriteFilterer);

// Creating data provider with composed filterer
const filteringDataProv = new FilteringPropertyDataProvider(dataProvider, favoriteTextFilterer);
return filteringDataProv;
}, [dataProvider]));

// Getting results from FilteringDataProvider
const { value: filteringResult } = useDebouncedAsyncValue(React.useCallback(async () => {
  const result = await filteringDataProvider.getData();
  return result;

}, [filteringDataProvider]));

// Getting a match at index 10, which we want to actively highlight
React.useEffect(() => {
    if (filteringResult?.getMatchByIndex)
      setActiveHighlight(filteringResult.getMatchByIndex(10));
  }, [filteringDataProvider, filteringResult]);
```

```JavaScript
// In order to highlight filtered matches, we need to pass down HighlightingComponentProps with {filteredTypes?: FilteredType[]} to VirtualizedPropertyGridWithDataProvider
(<VirtualizedPropertyGridWithDataProvider
      dataProvider={filteringDataProvider}
      ...
      highlight={filterText && filterText.length !== 0 ?
        { highlightedText: "Test", activeHighlight, filteredTypes: filteringResult?.filteredTypes }:
        undefined
      }
    />)
```

### Breaking changes

Changed

```JavaScript
interface HighlightedRecordProps {
  activeMatch?: PropertyRecordMatchInfo;
  searchText: string;
}
```

To

```JavaScript
interface HighlightInfo {
  highlightedText: string;
  activeHighlight?: HighlightInfo;
}
```

To fix it, only naming should be changed. searchText -> highlightedText, activeMatch -> highlightedText.

Changed

```JavaScript
interface PropertyRecordMatchInfo {
  matchCounts: {
      label: number;
      value: number;
  };
  matchIndex: number;
  propertyName: string;
}
```

To

```JavaScript
interface HighlightInfo {
  highlightedItemIdentifier: string;
  highlightIndex: number;
}
```

To fix it, naming should be changed. matchIndex -> highlightedItemIdentifier, propertyName -> highlightedItemIdentifier. matchCounts property should be removed.

changed highlightProps?: HighlightedRecordProps property to highlight?: HighlightingComponentProps on PrimitiveRendererProps interface. To fix it, only naming should be changed.
changed highlightProps?: HighlightedRecordProps property to highlight?: HighlightingComponentProps on PropertyRendererProps interface. To fix it, only naming should be changed.
added highlight?: HighlightingComponentProps on PropertyCategoryBlockProps interface. Interface works as it used to, highlight is used for category highlighting.

In common/api/ui-core changed title: string property to title: string | JSX.Element and added property tooltip?: string on ExpandableBlockProps interface. Interface works as it used to, changes are used for some highlighting features.
