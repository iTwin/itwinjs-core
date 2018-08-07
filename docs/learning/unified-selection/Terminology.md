# Unified Selection -related Terminology

## Selection Level

Unified selection API allows having multiple nested selection levels. In all
cases lower levels are somehow related to their above level. As a result,
changing a level clears selection of all lower levels.

Example:
1. User selects a *Model* node in the tree. Thats **selection level 0**.
2. Content components react to selection change:
   - Grid shows all model *Elements*
   - Graphics view highlights all model *Elements*
   - Property pane shows selected *Model* properties
3. User selects one of the *Element* instances in the grid. That's
**selection level 1**.
4. Content components react to selection change:
   - Grid still shows all model *Elements* as it reacts only to top level
   selection.
   - Graphics view still highlights all model *Elements*, but the one in
   'selection level 1' is distinguished with a border or a different color.
   - Property pane shows properties of the *Element* selected with 'selection
   level 1'.
5. Selecting a different node in the tree changes 'selection level 0', thus
clearing 'selection level 1'.
