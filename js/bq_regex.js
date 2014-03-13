/**
 * Functions for querying json strings using bigquery.
 * 
 * Currently implemented:
 *
 *     1. JSON_PATH: a function that takes the name of a json string property,
 *     a dotted path string, and an integer denoting the maximum depth of
 *     nesting in the json.  It expands to a bigquery-friendly REGEXP_EXTRACT
 *     expression that will extract the value from the json at a location
 *     specified by the path string.
 *
 *     Example: if my_json_prop is a property whose value is '{"a": {"b":
 *     "c"}}', then JSON_PATH(my_json_prop, "a.b", 2) will expand to a
 *     REGEXP_EXTRACT expression that will extract "c" out of the json.
 *
 *     If one nesting level contains an array instead of an object, specify the
 *     index of the array to extract as part of the path.
 *
 *     Example: if my_json_prop is a property whose value is '{"a": [{"y":
 *     "z"}, {"b": "c"}]}', then JSON_PATH(my_json_prop, "a.1.b", 3) will
 *     expand to a REGEXP_EXTRACT expression that will extract "c" out of the
 *     json.
 *
 *     If the innermost level of nesting is an array, you can also retrieve the
 *     entire contents of the array by using a * character instead of an array
 *     index as part of the path.  This does not work if objects or arrays
 *     appear inside the array you're trying to retrieve.
 *
 *     Example: if my_json_prop is a property whose value is '{"a": ["b", "c",
 *     "d"]}', then JSON_PATH(my_json_prop, "a.*", 2) will expand to a
 *     REGEXP_EXTRACT expression that will extract "b", "c", "d" out of the
 *     json.
 *
 *     The maximum depth of nesting is equal to the largest number of elements
 *     that could be in a path string to extract any value out of the json.  In
 *     both these examples, this happens to be equal to the number of path
 *     components, but this may not always be the case.
 * 
 *     Note also that these regular expressions grow exponentially with nesting
 *     depth, so make sure to set the maximum depth parameter as small as
 *     possible == exactly the deepest level of nesting in the json.
 *
 * JQUERY NOTE: this file uses jQuery instead of $ because the bigquery page
 * defines $ to be something else that is not jQuery.
 */

/**
 * Wrapper function.  This will be hackily inserted into a script element on
 * the page because chrome extensions can't directly interact with javascript
 * in the page, and the functions inside need to interact with the editor
 * objects.
 */
function scriptWrapper() {

    /**
     * Makes a regular expression that will match the value associated with the
     * specified key path.
     * @param [String] pathstring a dot-separated path.  See the toplevel
     *     comments for examples.
     * @param [int] maxDepth the maximum possible depth of nesting in the json.
     * @return [String] a regular expression string that will match the desired
     *     value.
     */
    function valueByPath(pathstring, maxDepth) {
        var path = pathstring.split(".").reverse();
        return matchWithKeypath(path, 0, maxDepth, true);
    }

    /**
     * Does the supplied string consist solely of numbers?
     * @param [String] str the string to test.
     * @return [Array] a regular expression match usable as a boolean test.
     */
    function isDigital(str) {
        return str.match(/^\d+$/);
    }

    /**
     * Get a regular expression string matching a JSON-serialized javascript
     * object with the specified parameters.
     * @param [String] currKey the key to match at the current depth
     * @param [String] innerKeyed a regular expression string matching the
     *     portion of the keypath to the interior of the currentKey, including
     *     inner keys.
     * @param [String] innerNonkeyed a regular expression string matching
     *     objects/arrays of the same form as the keypath to the interior of
     *     the currentKey, but without any keys.  (These match siblings of the
     *     desired objects/arrays.)
     * @param [boolean] keyed an indicator of whether the returned regular
     *     expression should include the keyed expressions.  (If it shouldn't,
     *     this is being called to build the interior of a sibling of the keyed
     *     expression at a lower depth.)
     */
    function matchObject(currKey, innerKeyed, innerNonkeyed, keyed) {
        if (keyed) {
            return ('{(?:"\\w+":\\s?' + innerNonkeyed + ',?\\s?)*"' + currKey +
                    '":\\s?' + innerKeyed + ',?\\s?(?:"\\w+":\\s?' +
                    innerNonkeyed + ',?\\s?)*}');
        } else {
            return ('{(?:"\\w+":\\s?' + innerNonkeyed + ',?\\s?)*}');
        }
    }

    /**
     * Get regular expression strings that extract objects/arrays matching the
     * form of the keypath at greater depth than the current key, both keyed
     * and nonkeyed.
     * @param [String] nextKey the key to be extracted at the next depth or
     *     undefined if at innermost depth.
     * @param [Array] keypath the remainder of the keypath, including nextKey.
     * @param [int] currDepth the current depth of nesting in the json.
     * @param [int] maxDepth the maximum depth of nesting in the json.
     * @return [Array] a two-element array containing the keyed and nonkeyed
     *     regular expression strings in that order.
     */
    function matchInner(nextKey, keypath, currDepth, maxDepth) {
        var innerKeyed = null;
        var innerNonkeyed = null;
        if (!nextKey) {
            innerKeyed = '"?([^,{}\\[\\]"\\s][^,{}\\[\\]"]*)"?';
            if (currDepth >= maxDepth) {
                innerNonkeyed = '"?[^,{}\\[\\]"\\s][^,{}\\[\\]"]*"?';
            } else {
                innerNonkeyed = matchWithKeypath(keypath, currDepth,
                                                 maxDepth, false);
            }
        } else {
            innerNonkeyed = matchWithKeypath(keypath, currDepth,
                                             maxDepth, false);
            if (nextKey === "*") {
                innerKeyed = '\\[((?:"?[^,{}\\[\\]"]+"?,?\\s?)*)\\]';
            } else {
                innerKeyed = matchWithKeypath(keypath, currDepth, maxDepth, true);
            }
        }
        return [innerKeyed, innerNonkeyed];
    }

    /**
     * Get a regular expression string matching a JSON-serialized javascript
     * array with the specified parameters.
     * @param [String] currKey the key to match at the current depth
     * @param [String] innerKeyed a regular expression string matching the
     *     portion of the keypath to the interior of the currentKey, including
     *     inner keys.
     * @param [String] innerNonkeyed a regular expression string matching
     *     objects/arrays of the same form as the keypath to the interior of
     *     the currentKey, but without any keys.  (These match siblings of the
     *     desired objects/arrays.)
     * @param [boolean] keyed an indicator of whether the returned regular
     *     expression should include the keyed expressions.  (If it shouldn't,
     *     this is being called to build the interior of a sibling of the keyed
     *     expression at a lower depth.)
     */
    function matchArray(currKey, innerKeyed, innerNonkeyed, keyed) {
        if (keyed) {
            return ('\\[(?:' + innerNonkeyed + ',?\\s?){' + currKey + '}' +
                    innerKeyed + ',?\\s?(?:' + innerNonkeyed + ',?\\s?)*\\]');
        } else {
            return '\\[(?:' + innerNonkeyed + ',?\\s?)*\\]';
        }
    }

    /**
     * Get a regular expression string matching a JSON-serialized javascript
     * object or array matching the specified keypath.
     * @param [Array] keypath an array containing the elements of the keypath,
     *     0 = innermost, length-1 = outermost.  Note that this is the reverse
     *     order in which this would be specified as a keypath string.  keypath
     *     string "a.b.3.c" => keypath ["c", "3", "b", "a"]
     * @param [int] currDepth the current depth of nesting in the json.  Set to
     *     0 if not calling recursively.
     * @param [int] maxDepth the maximum depth of nesting in the json.
     * @param [boolean] keyed whether the expression should include the keys
     *     themselves or just match siblings.  If calling non-recursively, this
     *     should probably be true.
     * @return [String] a regular expression string that will extract as the
     *     sole capturing group the value at the specified keypath.
     */
    function matchWithKeypath(keypath, currDepth, maxDepth, keyed) {
        keypath = keypath.slice(0, keypath.length);  //shallow copy
        var currKey = keypath.pop();
        var nextKey = keypath[keypath.length - 1];
        var innerExpressions = matchInner(nextKey, keypath, currDepth+1,
                                          maxDepth);
        var innerKeyed = innerExpressions[0];
        var innerNonkeyed = innerExpressions[1];
        if (keyed) {
            if (isDigital(currKey) || currKey === "*") {
                return matchArray(currKey, innerKeyed, innerNonkeyed, keyed);
            } else {
                return matchObject(currKey, innerKeyed, innerNonkeyed, keyed);
            }
        } else {
            var arr = matchArray(currKey, innerKeyed, innerNonkeyed, keyed);
            var obj = matchObject(currKey, innerKeyed, innerNonkeyed, keyed);
            // a nonkeyed innermost value like a string or int
            var value = matchInner(null, [], 0, 0)[1];
            return "(?:" + arr + "|" + obj + "|" + value + ")";
        }
    }

    //keywords used by this extension that should be highlighted in the
    //bigquery editor
    var additionalKeywords = ["JSON_PATH"];

    /**
     * Check a token in the CodeMirror editor to see if it's one of the
     * keywords being added by the extension.
     * @param [String] token a string containing a single token parsed from the
     *     editor
     * @return [boolean] whether or not this is a keyword for this extension.
     */
    function checkToken(token) {
        for (var i = 0; i < additionalKeywords.length; i++) {
            if (additionalKeywords[i] === token) {
                return true;
            }
        }
        return false;
    }

    /**
     * A CodeMirror mode overlay that will syntax highlight the keywords for
     * the extension, making the macros look like built-in functions.
     */
    var cmMode = {
        token: function(stream, state) {
            stream.eatSpace();
            var match = stream.match(/^[A-Za-z0-9_-]+/);
            if (!match) {
                stream.skipToEnd();
                return null;
            }
            if (!checkToken(match[0])) {
                stream.eatWhile(/[^A-Za-z0-9_-]/);
                return null;
            }
            return 'keyword';
        }
    };


    var cmInstance = null;

    /**
     * Function to save the most recently created CodeMirror instance (which
     * will be the query editor).
     *
     * @param [CodeMirror] instance the CodeMirror instance.
     */
    function registerCmInstance(instance) {
        cmInstance = instance;
        cmInstance.addOverlay(cmMode);
    }

    /**
     * Setup functions for buttons, syntax highlighting, and grabbing the
     * editor.
     */
    function load() {
        setInterval(addRegexButton, 500);
        setInterval(highlightKeywords, 1000);
        window.CodeMirror.defineInitHook(registerCmInstance);
    }

    /**
     * Adds a button to the button bar below the editor that will expand the
     * helper functions into actual regexps.
     */
    function addRegexButton() {
        var addRegexButtonName = "#regex-button";
        if (jQuery(addRegexButtonName).length == 0) {
            jQuery("#query-button-bar").children().filter(
                "#query-options-toggle").after(
                    "<div id=regex-button>Expand Regexp Helpers</div>");
        }
        var btn = jQuery(addRegexButtonName);
        btn.addClass("jfk-button jfk-button-standard goog-inline-block");
        btn.attr("role", "button");
        btn.click(expandJsonPathElement);
    }

    /**
     * Expands the JSON_PATH helper function into a valid-for-bigquery
     * REGEXP_EXTRACT function.
     */
    function expandJsonPathElement() {
        var jsonPathKwName = "JSON_PATH";
        var regexFct = "REGEXP_EXTRACT";
        var kwClass = 'cm-keyword';
        var kws = jQuery('.' + kwClass);
        for (var i = 0; i < kws.length; i++) {
            if (kws[i].textContent === jsonPathKwName) {
                // next is the field; leave this unchanged.
                // after that is the path
                var cmdRegex = (jsonPathKwName + 
                        "\\(\\s*[^,]+\\s*,\\s*[^)]+\\s*,\\s*\\d+\\s*\\)");
                //parentheses get different styling depending on cursor
                //position; deal with this.
                //TODO(colinfuller): surely this is possible in a single query?
                var fieldEl = jQuery(kws[i]).nextUntil(".cm-variable," + 
                    ".cm-recognized-field").next();  // skip styled parentheses
                if (fieldEl.length == 0) {  //parentheses weren't styled
                    fieldEl = jQuery(kws[i]).next();
                }
                var pathEl = jQuery(fieldEl).next();
                var depthEl = jQuery(pathEl).next();
                var field = jQuery(fieldEl).text();
                var pathspec = pathEl.text().slice(1,-1);
                // bigquery doesn't like table columns beginning with what look
                // like floating point numbers; convert to underscores so this
                // always works as part of an AS statement
                var underscoredPathspec = pathspec.replace(
                    new RegExp("\\.", "g"), "_");
                // bigquery also doesn't like an asterisk
                underscoredPathspec = underscoredPathspec.replace(
                    new RegExp("\\*", "g"), "glob");
                var maxDepth = parseInt(depthEl.text());
                var replacementRegex = valueByPath(pathspec, maxDepth);
                var query = cmInstance.getValue();
                query = query.replace(new RegExp(cmdRegex), regexFct +
                                      '(' + field + ", r'" + replacementRegex +
                                      "') AS " + "json_" + 
                                      underscoredPathspec);
                cmInstance.setValue(query);
                return;
            }
        }
    }

    /**
     * HACK: while the cm mode addition correctly adds the highlighting, it
     * doesn't remove bigquery's designation as a variable.  Remove this class
     * manually.
     */
    function highlightKeywords() {
        var varClass = "cm-variable";

        var vars = jQuery("." + varClass);

        for (var i = 0; i < vars.length; i++) {
            if (checkToken(vars[i].textContent)) {
                jQuery(vars[i]).removeClass(varClass);
            }
        }
    }

    // don't set up the document ready handler if running in node for testing
    if (typeof document !== 'undefined') {
        jQuery(document).ready(load);
    }

    // return functions to export for testing
    return {valueByPath: valueByPath,
            isDigital: isDigital,
            matchObject: matchObject,
            matchInner: matchInner,
            matchArray: matchArray,
            matchWithKeypath: matchWithKeypath,
            checkToken: checkToken};
}

/**
 * A hack to insert the code in this file into the page in a script element.
 * This is necessary because otherwise chrome prevents the extension from
 * interacting directly with the text editor.
 */
if (typeof document !== 'undefined') {  // insert only if there's a document so tests using node work
    var script = document.createElement('script');
    script.setAttribute("type", "text/javascript");
    script.appendChild(document.createTextNode("(" + scriptWrapper + ")();"));
    var docEl = (document.body || document.head || document.documentElement);
    docEl.appendChild(script);
} else {
    module.exports = scriptWrapper();
}

