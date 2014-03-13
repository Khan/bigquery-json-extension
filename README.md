bigquery-json-extension is a chrome extension that adds simulated functions for
regexp-based parsing of json string properties.

### Installation

- Clone the repository

- In chrome, go to: `chrome://extensions/`

- Check "Developer mode"

- Click "Load unpacked extension" and select the cloned folder

### Usage

The extension defines a function `JSON_PATH` that takes the name of a json
string property, a dotted path string, and an integer denoting the maximum
depth of nesting in the json.  It expands to a bigquery-friendly
`REGEXP_EXTRACT` expression that will extract the value from the json at a
location specified by the path string.

Example: if `my_json_prop` is a property whose value is `'{"a": {"b": "c"}}'`, then
`JSON_PATH(my_json_prop, "a.b", 2)` will expand to a `REGEXP_EXTRACT` expression
that will extract `"c"` out of the json.

If one nesting level contains an array instead of an object, specify the index
of the array to extract as part of the path.

Example: if `my_json_prop` is a property whose value is `'{"a":
[{"y": "z"}, {"b": "c"}]}'`, then `JSON_PATH(my_json_prop, "a.1.b", 3)` will
expand to a `REGEXP_EXTRACT` expression that will extract `"c"` out of the json.

If the innermost level of nesting is an array, you can also retrieve the entire
contents of the array by using a * character instead of an array index as part
of the path.  This does not work if objects or arrays appear inside the array
you're trying to retrieve.

Example: if `my_json_prop` is a property whose value is `'{"a": ["b", "c", "d"]}'`,
then `JSON_PATH(my_json_prop, "a.*", 2)` will expand to a `REGEXP_EXTRACT`
expression that will extract `"b", "c", "d"` out of the json.

The extension adds a button to the bigquery page `"Expand regexp helpers"` that
expands the `JSON_PATH` macro.  This button must be used to expand the query before
submitting.


