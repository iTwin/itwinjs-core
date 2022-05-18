# Overlapping Systems

During design workflows, multiple responsible parties may collaborate on the design of a single physical Entity. There are a wide variety of potential collaboration workflows involving the `PhysicalElement` modeling that physical Entity. We examine how BIS addresses this issue using the example of an architect and a structural engineer collaborating on the design of a load-bearing wall.

There are situations in which both the architect and structural engineer must be able to express differing “opinions” regarding the wall’s design. When using iModels, we intend to solve most of these cases via “branching” and a “pull-request” workflow—each party can make “suggested changes” to a given `Element` in their own branch and then make a “pull-request” for the other party to review, approve, pull, and merge the suggested changes.

There may still be cases where we need to temporarily allow the architect and the structural engineer to each have their own `LoadBearingWall` `Element` in their own Model, both modeling the same physical load-bearing wall Entity. The architect can use his/her `Element` to represent a “suggestion” to the structural engineer.

We must maintain clarity on which `Element` is the authoritative `LoadBearingWall` (in this case, the one in the structural Model). The authoritative `LoadBearingWall` may have a non-null FederationGUID and CodeValue, while the non-authoritative one should have NULL for those properties.

There is an as-yet-unimplemented proposal to have a `PhysicalElementIsANonAuthoritativeDuplicateOfPhysicalElement` relationship to indicate which `LoadBearingWall` is a Non-Authoritative Duplicate (NAD) of the other.

When the collaboration is “done”, and both `Element`s are consistent, the non-authoritative `LoadBearingWall` should be deleted. The `LoadBearingWall` in the structural `Model` would be related to the architectural System via `PhysicalSystemGroupsMembers` and related to a `CompoundWall` via `PhysicalElementAssemblesElements`. Any relationships that were pointing to the non-authoritative `LoadBearingWall` should be re-mapped to the authoritative one.

Consistency checks can ensure that all NADs are eliminated before designs are finalized and published for use in construction or operations, where redundant modeling of the same physical Entity creates problems.

---
| Next: [Organizing Repository-global Definition Elements](./organizing-definition-elements.md)
|:---
