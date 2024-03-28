# JSON1 virtual classes

This EC wrapper for [JSON1 SQLite extension](https://sqlite.org/json1.html#jeach). It allow you to enumerate json document as table.

## json_tree()

Recursively iterate over all items in json.

```sql
select s.* from json1.json_tree('{
        "planet": "mars",
        "gravity": "3.721 m/s²",
        "surface_area": "144800000 km²",
        "distance_from_sun":"227900000 km",
        "radius" : "3389.5 km",
        "orbital_period" : "687 days",
        "moons": ["Phobos", "Deimos"]
    }') s;
```

| key               | value                                                                                                                                                                                   | type   | atom          | parent | fullkey               | path    |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | ------------- | ------ | --------------------- | ------- |
| NULL              | {"planet":"mars","gravity":"3.721 m/sy","surface_area":"144800000 kmy","distance_from_sun":"227900000 km","radius":"3389.5 km","orbital_period":"687 days","moons":["Phobos","Deimos"]} | object | NULL          | NULL   | $                     | $       |
| planet            | mars                                                                                                                                                                                    | text   | mars          | 0      | $.planet              | $       |
| gravity           | 3.721 m/sy                                                                                                                                                                              | text   | 3.721 m/sy    | 0      | $.gravity             | $       |
| surface_area      | 144800000 kmy                                                                                                                                                                           | text   | 144800000 kmy | 0      | $."surface_area"      | $       |
| distance_from_sun | 227900000 km                                                                                                                                                                            | text   | 227900000 km  | 0      | $."distance_from_sun" | $       |
| radius            | 3389.5 km                                                                                                                                                                               | text   | 3389.5 km     | 0      | $.radius              | $       |
| orbital_period    | 687 days                                                                                                                                                                                | text   | 687 days      | 0      | $."orbital_period"    | $       |
| moons             | ["Phobos","Deimos"]                                                                                                                                                                     | array  | NULL          | 0      | $.moons               | $       |
| 0                 | Phobos                                                                                                                                                                                  | text   | Phobos        | 14     | $.moons[0]            | $.moons |
| 1                 | Deimos                                                                                                                                                                                  | text   | Deimos        | 14     | $.moons[1]            | $.moons |

## json_each()

Iterate top level json and return each entry as row.

```sql
select s.* from json1.json_each('{
        "planet": "mars",
        "gravity": "3.721 m/s²",
        "surface_area": "144800000 km²",
        "distance_from_sun":"227900000 km",
        "radius" : "3389.5 km",
        "orbital_period" : "687 days",
        "moons": ["Phobos", "Deimos"]
    }') s;
```

outputs following result

| key               | value               | type  | atom          | parent | fullkey               | path |
| ----------------- | ------------------- | ----- | ------------- | ------ | --------------------- | ---- |
| planet            | mars                | text  | mars          | NULL   | $.planet              | $    |
| gravity           | 3.721 m/sy          | text  | 3.721 m/sy    | NULL   | $.gravity             | $    |
| surface_area      | 144800000 kmy       | text  | 144800000 kmy | NULL   | $."surface_area"      | $    |
| distance_from_sun | 227900000 km        | text  | 227900000 km  | NULL   | $."distance_from_sun" | $    |
| radius            | 3389.5 km           | text  | 3389.5 km     | NULL   | $.radius              | $    |
| orbital_period    | 687 days            | text  | 687 days      | NULL   | $."orbital_period"    | $    |
| moons             | ["Phobos","Deimos"] | array | NULL          | NULL   | $.moons               | $    |

[ECSql Syntax](./index.md)
