
# RangeTree structures

A Range Tree is

* a set of RangeTreeNode objects forming a tree structure, i.e.
  * From any of the range tree nodes one can move other nodes which are children in the tree structure.
  * The "node to children" references are an acyclic graph structure.
  * The root node has no parent
  * Each non-root node has a single parent
* Each node (leaf level or internal) can have zero, one, or many application data items.
  * The application items are not part of the tree structure
* Each node has a Range3d
  * In a leaf node the Range3d is the range of its child application data items.
  * In an interior node the Range3d is the range containing both
    * the range of the application data items directly in the node
    * the ranges of all the child nodes in the tree.

It is expected that a range tree will contain _many_ children among its nodes.

# Class structure

The overall class structure for a specialized range tree object is as in this figure

![>](./figs/RangeTree/RangeTreeClassStructure.png)

## RangeTreeNode

* The class type for a node of the range tree is RangeTreeNode.
* The RangeTreeNode is an internal type.
* The RangeTreeNode class is parameterized with AppDataType.
  * The AppDataType is the type of appData entries in leaf and interior nodes.
  * All nodes have the same AppDataType.

## AppDataType

* This type parameter on the RangeTreeNode controls what data type is present as appData items in the nodes.
* This type is typically known only to the context and RangeTreeNode's.

## XXXRangeTreeContext

* An XXXRangeTreeContext
  * Is a single master object for a category of searches
  * Has a reference to a RangeTreeNode
  * Is the only public class among the classes within a range tree implementation.
* There are two typical patterns:
  * Independent children.
    * The children are of some standalone type (e.g. CurvePrimitive)
    * Hence a search may return the child pointer of type AppDataType
  * Indexed children
    * the AppDataType in for the RangeTreeNode is number, and the numbers are indices into another structure
    * the context has a reference to the structure. Examples of this are:
      * A polyface (PolyfaceRangeTreeContext)
        * Tree searches aim to identify particular facets within the polyface
        * The context holds a pointer to a visitor for the polyface
        * the appData in leaf nodes is indices (readIndex) into the polyface
      * A linestring (LineString3dRangeTreeContext)
        * Tree searches aim to identify individual edges (line segments) within the polyline
      * the data for the linestring is a LineString3d
      * the returned CurveLocationDetail data indcates a fraction position of a point on the LineStrint3d.
        * Recall that that "fractional position" is encoded so that the segment index and intra-segment fraction are in a single number.

## Handlers

In order for the same range tree (in some XXXRangeTreeContext) to be searchable multiple times and with varying search goals,
the detail search logic such as

* Distance from leaf node to spacePoint
* Distance between leaf nodes of a pair of trees
exists in specialized "handler" objects that are aware of (a) the type of search (b) the child AppDataType (c) any data (such as a polyface)
carried in the context.

A single search will involve multiple calls to its handler -- but due to the range logic in the tree this is typically a significant factor (10 to 20) times
smaller than the number of AppDataType items in the tree.

There are two root types for handlers:

* SingleTreeSearchHandler
  * called during a search that involves only one tree.
  * The parameter to each call is an AppDataType item.
  * The handler will carry references to required data (such as a space point and a polyface or point array being searched) in the calling XXXRangeTreeContext
* TwoTreeSearchHandler
  * called during a search that involves two trees.
  * The parameter to each call is an AppDataType item from each tree.
  * The handler will carry references to required data (such polyfaces or point arrays being searched) in the calling XXXRangeTreeContext

In a common case of searching a single tree for an AppDataItem "closest to spacePoint"

* the handler has a "best item so far" and its minimum distance from the spacePoint to the item.
* search logic in the RangeTreeNode offers a range (from a tree node) to the handler's isRangeActive() method
  * If the range is clearly too far away from the spacePoint to contain a "better" AppDataType item, the isRangeActive() method returns false and the children of that RangeTreeNode are not explored.
  * If some or all of the range is closer to the spacePoint, the search continues, i.e.
    * each AppDatType item directly in the node is offered to the processAppData() method of the handler
      * A ever-closer AppDataType items are detected, the "best item so far" and its minimum distance are updated
      * The decreased value of the minimum distance increases the chance of rejecting uninteresting nodes later in the search.
    * The search recurses into the child nodes of the RangeTreeNode.
