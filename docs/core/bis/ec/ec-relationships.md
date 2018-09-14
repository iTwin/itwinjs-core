# ECRelationships

This section discusses *relationships* in general in the EC Information Model.

"Relationships" in the EC Information Model are a higher-level concept than simple object references in OO programming. For example, ECRelationships can be many-to-many, and they can have their own business properties that are applied directly to the instances of the relationship. Of course, you can accomplish a many-to-many relationship with business properties in an OO language via a class that has one ‘source’ object reference and one ‘target’ object reference. However, ECObjects raises these relationship-oriented ‘patterns’ that you might find in OO schemas and raises them to a first-class concept. Making ECRelationship a first-class concept simplifies things for the user and developer for whom the business objects and the relationships between them need to be handled and viewed differently. If you are working in a pure OO world of objects and object references, it is not inherently obvious (from inspecting the schema) which classes are playing the role of relationships, and which are the real business objects.

ECRelationships are closer to relationships in the RDBMS world. If your relationships are ultimately persisted in a relational database, thinking of them in OO terms can be semantically misleading in terms of the "effort" required to traverse a relationship. In the OO world, traversing a simple object reference "feels" like a very fast and efficient operation, when in reality, in the database, it may require an expensive search of a table to find the related key. Also, object references are not bi-directional (they can only be traversed in one direction) whereas ECRelationships may be traversed in either direction (though one direction is sometimes more expensive to traverse.) Managing ECRelationships as first-class concepts also tends to make Object-Relational mapping more straightforward, as discussed in ECDb documentation.

## Data and Metadata

Metadata is information about data or other information. The EC Information Model organizes concepts according to whether they are part of the data (the "value system") or metadata (the "type system"). Thus an ECClass is part of the type system and an ECInstance is part of the value system.

Similarly, *relationship* *class* and *relationship* *instance* belong to the type and value systems respectively. The *relationship class* defines how two classes relate, and the *relationship instance* represents a specific relation between specific instances of business objects. In this paper, we spell out *relationship* *class* but sometimes just use *relationship* as shorthand for *relationship* *instance*.

## Relationship Classes are Business Classes

The *relationships* belonging to a given *relationship class* may be persisted in their own table, have their own properties, and be visible as a top-level objects in the schema. For these reasons, it makes sense for an ECRelationshipClass to be a specialization of an ECClass.

## Relationship instances are Binary

Though ternary *relationships* are conceptually possible, we only deal with binary relations—those between two instances. Though the true nature of the *relationship* will vary, ‘source’ and ‘target’ were chosen as the names for the endpoints.

## Relationship "Strengths"

Sometimes a relationship simply represents a reference from one object to another, and at other times, it can mean that one object "owns" another, or at least shares ownership of it.

### Referencing

"Referencing" relationships imply no ownership and no cascading deletes when the object on either end of the relationship is deleted. It can be represented in UML as a simple association. For example, a Document object may have a reference to the User that last modified it.

### Holding

"Holding" relationships imply shared ownership. A given object can be "held" by many different objects, and the object will not get deleted unless all of the objects holding it are first deleted (or the relationships severed.) It can be represented as "aggregation" in UML, an association with an open diamond on the *source* end of the relationship. For example, an Equipment component may have been imported from two different documents (each document held different business properties that were extracted) and so Each document "holds" the Equipment. If both documents are removed, the Equipment goes is also removed. You could also think of "holding" as "grouping".

### Embedding

"Embedding" relationships imply exclusive ownership and cascading deletes. An object that is the target of an "embedding" relationship may also be the target of other "referencing" relationships, but cannot be the target of any "holding" relationships (the ownership is exclusive, remember.) "Embedding" relationships can be represented by "composition" in UML, an association with a closed diamond on the *source* end. For example, a Folder "embeds" the Documents that it contains. You could also think of "embedding" as "containment".

## Strength Direction

Relationships can also have a "strengthDirection" which indicates, for example, whether the source is "holding" the target, or vice versa.

A direction of "forward" indicates that the Source is the Parent (i.e. the "holder") and "backward" indicates that the Target is the Parent (i.e. the "holder"), with respect to "holding" or "embedding."

It is easy to get confused about this. It is never safe to assume that the source is always the child, the parent, the master, the detail. Code always must take the strengthDirection into account.

## Persisting Relationships

The *relationships* must ultimately be persisted in a relational database and/or in XML, and there are a number of ways to do so. The persistent data may be stored in its own table or the table of the *source* and/or *target* class. The *relationships* belonging to a given *relationship class* may be persisted in a table all their own, or many *relationship* *classes* may share a single table.

## ECRelationshipInstances and InstanceIds

Though ECRelationshipInstances have InstanceId, generally, stable InstanceIds on relationship instances *cannot* be supported. Imagine the case where the relationship is persisted as a simple foreign-key relationship in the database… there is no place to store a stable ID for the relationship instance itself. Concatenating IDs from the source and target will not work, because a relationship ID may change when one of its endpoints is changed.
