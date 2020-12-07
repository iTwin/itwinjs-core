---
ignore: true
---
# NextVersion

## Tile compression

[IModelHostConfiguration.compressCachedTiles]($backend) specifies whether tiles uploaded to blob storage should be compressed using gzip. Previously, it defaulted to `false` if omitted. The default has now been switched to `true`. Compressing tiles conserves bandwidth; the tiles are transparently and efficiently decompressed by the browser.

## Updated version of Electron

Updated version of electron used from 8.2.1 to 10.1.3. Note that Electron is specified as a peer dependency in the iModel.js stack - so it's recommended but not mandatory that applications migrate to this electron version.

## Filtering in Property Grid

Now it is possible to filter property grid items (Records or Categories) using `FilteringPropertyDataProvider`. In addition, support for highlighting parts of items that matched the search criteria has also been added.

![Property Filtering](./assets/property-filtering.png "Property Filtering")


Filtering is done by `FilteringPropertyDataProvider` and `IPropertyDataFilterer` that is passed to the provider. We provide a number of read-to-use filterers:
- `CompositePropertyDataFilterer` combines two other filterers
- `PropertyCategoryLabelFilterer` filters `PropertyCategories` by label
- `DisplayValuePropertyDataFilterer` filters `PropertyRecords` by display value
- `LabelPropertyDataFilterer` filters `PropertyRecords` by property label
- `FavoritePropertiesDataFilterer` (in `@bentley/presentation-components`) filters `PropertyRecords` by whether the property is favorite or not.

**Example:**

```ts
const searchString = "Test";

const filteringDataProvider = useDisposable(React.useCallback(() => {
  // Combine a filterer that filters out favorite properties having `searchString` in their category label,
  // property label or display value
  const valueFilterer = new DisplayValuePropertyDataFilterer(searchString);
  const labelFilterer = new LabelPropertyDataFilterer(searchString);
  const categoryFilterer = new PropertyCategoryLabelFilterer(searchString);
  const recordFilterer = new CompositePropertyDataFilterer(labelFilterer, CompositeFilterType.Or, valueFilterer);
  const recordAndCategoryFilterer = new CompositePropertyDataFilterer(recordFilterer, CompositeFilterType.Or, categoryFilterer);
  const favoritesFilterer = new FavoritePropertiesDataFilterer({ source: dataProvider, favoritesScope: FAVORITES_SCOPE, isActive: true });
  const combinedFilterer = new CompositePropertyDataFilterer(recordAndCategoryFilterer, CompositeFilterType.And, favoritesFilterer);
  // Create the provider
  return new FilteringPropertyDataProvider(dataProvider, combinedFilterer);
}, [dataProvider]));

// Getting results from FilteringDataProvider
const { value: filteringResult } = useDebouncedAsyncValue(React.useCallback(async () => {
  return await filteringDataProvider.getData();
}, [filteringDataProvider]));

// Getting a match at index 10, which we want to actively highlight
const [activeHighlight, setActiveHighlight] = React.useState<HighlightInfo>();
React.useEffect(() => {
    if (filteringResult?.getMatchByIndex)
      setActiveHighlight(filteringResult.getMatchByIndex(10));
}, [filteringDataProvider, filteringResult]);

// Set up props for highlighting matches
const highlightProps: HighlightingComponentProps = {
  highlightedText: searchString,
  activeHighlight,
  filteredTypes: filteringResult?.filteredTypes,
};

// Render the component with filtering data provider and highlight props
return (
  <VirtualizedPropertyGridWithDataProvider
    dataProvider={filteringDataProvider}
    highlight={highlightProps}
    ...
  />
);
```

## Breaking API changes

* The union type [Matrix3dProps]($geometry-core) inadvertently included [Matrix3d]($geometry-core). "Props" types are wire formats and so must be pure JavaScript primitives. To fix compilation errors where you are using `Matrix3d` where a `Matrix3dProps` is expected, simply call [Matrix3d.toJSON]($geometry-core) on your Matrix3d object. Also, since [TransformProps]($geometry-core) includes Matrix3dProps, you may need to call [Transform.toJSON]($geometry-core) on your Transform objects some places too.

* The type of [Texture.data]($backend) has been corrected from `string` to `Uint8Array` to match the type in the BIS schema. If you get compilation errors, simply remove calls to `Buffer.from(texture.data, "base64")` for read, and `texture.data.toString("base64")` if you create texture objects.

* Changed
  ```ts
  interface HighlightedRecordProps {
    activeMatch?: PropertyRecordMatchInfo;
    searchText: string;
  }
  ```
  to
  ```ts
  interface HighlightInfo {
    highlightedText: string;
    activeHighlight?: HighlightInfo;
  }
  ```
  This is just a terminology change, so reacting to the change is as simple as renaming `searchText` -> `highlightedText` and `activeMatch` -> `highlightedText`.

* Changed
  ```ts
  interface PropertyRecordMatchInfo {
    matchCounts: {
        label: number;
        value: number;
    };
    matchIndex: number;
    propertyName: string;
  }
  ```
  to
  ```ts
  interface HighlightInfo {
    highlightedItemIdentifier: string;
    highlightIndex: number;
  }
  ```
  This is just a terminology change, so reacting to the change is as simple as renaming `matchIndex` -> `highlightedItemIdentifier` and `propertyName` -> `highlightedItemIdentifier`.

* Changed `highlightProps?: HighlightedRecordProps` property to `highlight?: HighlightingComponentProps` on [PrimitiveRendererProps]($ui-components) interface. To react to this change, simply rename `highlightProps` -> `highlight`.

* Changed `highlightProps?: HighlightedRecordProps` property to `highlight?: HighlightingComponentProps` on [PropertyRendererProps]($ui-components) interface. To react to this change, simply rename `highlightProps` -> `highlight`.
