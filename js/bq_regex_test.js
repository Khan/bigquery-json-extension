var bq_regex = require("./bq_regex.js");
var expect = require("chai").expect;

describe('JSON_regexps', function() {
    describe('#isDitigal', function() {
        it('should not say a letter is digital', function() {
            expect(bq_regex.isDigital("a")).not.to.be.ok;
        });
        it('should say a string of numbers is digital', function() {
            expect(bq_regex.isDigital("0123")).to.be.ok;
        });
    });

    describe('#checkToken', function() {
        it('should see JSON_PATH as a token', function() {
            expect(bq_regex.checkToken("JSON_PATH")).to.be.true;
        });
        it('should not see REGEXP_EXTRACT as a token', function() {
            expect(bq_regex.checkToken("REGEXP_EXTRACT")).to.be.false;
        });
    });

    describe('#matchInner', function() {
        it('should match a string literal', function() {
            expect((new RegExp(bq_regex.matchInner(null, [], 0, 0)[0]))
                   .test('"str"')).to.be.true;
        });
        it('should match a number literal', function() {
            expect((new RegExp(bq_regex.matchInner(null, [], 0, 0)[0]))
                   .test('1.78')).to.be.true;
        });
        it('should match a boolean literal', function() {
            expect((new RegExp(bq_regex.matchInner(null, [], 0, 0)[0]))
                   .test('true')).to.be.true;
        });
    });

    describe('#matchObject', function() {
        var inners = null;
        beforeEach(function() {
            inners = bq_regex.matchInner(null, [], 0, 0);
        });
        it('should match an appropriate object string with keys when keyed',
           function() {
               var objString = '{"a": "b"}';
               expect((new RegExp(bq_regex.matchObject("a",
                   inners[0], inners[1], true))).test(objString)).to.be.true;
           });
        it('should not match an array with similar content',
           function() {
               var arrString = '["a", "b"]';
               expect((new RegExp(bq_regex.matchObject("a",
                   inners[0], inners[1], true))).test(arrString)).to.be.false;
               expect((new RegExp(bq_regex.matchObject("a",
                   inners[0], inners[1], false))).test(arrString)).to.be.false;
           });
        it('should not match an object without the correct key when keyed',
           function() {
               var objString = '{"c": "d"}';
               expect((new RegExp(bq_regex.matchObject("a",
                   inners[0], inners[1], true))).test(objString)).to.be.false;
           });
        it('should match an object without the key when not keyed',
           function() {
               var objString = '{"c": "d"}';
               expect((new RegExp(bq_regex.matchObject("a",
                   inners[0], inners[1], false))).test(objString)).to.be.true;
           });
        it('should not match an object of incorrect nesting depth when keyed',
           function() {
               var objString = '{"a": {"b": "c"}}';
               expect((new RegExp(bq_regex.matchObject("a",
                   inners[0], inners[1], true))).test(objString)).to.be.false;
           });
    });

    describe('#matchArray', function() {
        var inners = null;
        beforeEach(function() {
            inners = bq_regex.matchInner(null, [], 0, 0);
        });
        it('should match an appropriate array string with keys when keyed',
           function() {
               var arrString = '["a", "b"]';
               expect((new RegExp(bq_regex.matchArray("1",
                   inners[0], inners[1], true))).test(arrString)).to.be.true;
           });
        it('should not match an object with similar content',
           function() {
               var objString = '{"a": "b"}';
               expect((new RegExp(bq_regex.matchArray("a",
                   inners[0], inners[1], true))).test(objString)).to.be.false;
               expect((new RegExp(bq_regex.matchArray("a",
                   inners[0], inners[1], false))).test(objString)).to.be.false;
           });
        it('should not match an array without the correct key when keyed',
           function() {
               var arrString = '["a", "b"]';
               expect((new RegExp(bq_regex.matchArray("2",
                   inners[0], inners[1], true))).test(arrString)).to.be.false;
           });
        it('should match an array without the key when not keyed',
           function() {
               var arrString = '["a", "b"]';
               expect((new RegExp(bq_regex.matchArray("2",
                   inners[0], inners[1], false))).test(arrString)).to.be.true;
           });
    });

    describe('#valueByPath', function() {
        var complexJSON = null;
        beforeEach(function() {
            complexJSON = '{"a": [{"f": "g"}, 7, {"h": "i"}, {"j": {"k":' +
                '"z"}, "q": 3, "nnnn": [0, 1, 2, 3]}, {"l": "m"}], "b": true}';
        });
        it('should extract a deeply nested string value', function() {
            var keypath = "a.3.j.k";
            expect((new RegExp(bq_regex.valueByPath(keypath, 4)))
                   .exec(complexJSON)[1]).to.equal("z");
        });
        it('should extract a moderately nested integer value', function() {
            var keypath = "a.1";
            expect((new RegExp(bq_regex.valueByPath(keypath, 4)))
                   .exec(complexJSON)[1]).to.equal("7");
        });
        it('should extract a shallowly nested value', function() {
            var keypath = "b";
            expect((new RegExp(bq_regex.valueByPath(keypath, 4)))
                   .exec(complexJSON)[1]).to.equal("true");
        });
        it('should extract an array at innermost level by glob', function() {
            var keypath = "a.3.nnnn.*";
            expect((new RegExp(bq_regex.valueByPath(keypath, 4)))
                   .exec(complexJSON)[1]).to.equal("0, 1, 2, 3");
        });
        it('should not match a path that is not present', function() {
            var keypath = "c.3.j.k";
            expect((new RegExp(bq_regex.valueByPath(keypath, 4)))
                   .exec(complexJSON)).to.be.null;
            keypath = "a.3.j.k.o";
            expect((new RegExp(bq_regex.valueByPath(keypath, 5)))
                   .exec(complexJSON)).to.be.null;
            keypath = "a.7";
            expect((new RegExp(bq_regex.valueByPath(keypath, 4)))
                   .exec(complexJSON)).to.be.null;
        });
    });
});


