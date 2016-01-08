'use strict';
import $ParseProvider from './$ParseProvider';
import { constant } from 'lodash';
import $FilterProvider from '../filter';


describe('parse', ()=> {
    var register, parse;
    beforeEach(()=>{
        var cache = {};
        var $provide = {
            factory(name, factory){
                cache[name] = factory;
            }
        };
        var $injector = {
            get(name){
                return cache[name]();
            }
        };
        var filterProvider = new $FilterProvider($provide);
        var parseProvider = new $ParseProvider();
        register = filterProvider.register.bind(filterProvider);
        var filter = filterProvider.$get($injector);
        parse = parseProvider.$get(filter);

    });
    it('should parse an integer', ()=> {
        var fn = parse('42');
        expect(fn).toBeDefined();
        expect(fn()).toBe(42);
    });

    it('should make an integer both literal and constant', ()=> {
        var fn = parse('42');
        expect(fn.literal).toBe(true);
        expect(fn.constant).toBe(true);
    });

    it('should parse a floating point number', ()=> {
        var fn = parse('4.2');
        expect(fn()).toBe(4.2);
    });

    it('should parse a floating point number without an integer part', ()=> {
        var fn = parse('.2');
        expect(fn()).toBe(0.2);
    });
    it('should parse a number in scientific notation', ()=> {
        var fn = parse('42e3');
        expect(fn()).toBe(42000);
    });

    it('should parse a number in scientific notation with a float coefficient', ()=> {
        var fn = parse('.42e2');
        expect(fn()).toBe(42);
    });
    it('should parse a number in scientific notation with a negative exponent', ()=> {
        var fn = parse('42e-2');
        expect(fn()).toBe(.42);
    });

    it('should parse a number in scientific notation with the "+" sign', ()=> {
        var fn = parse('42e+3');
        expect(fn()).toBe(42000);
    });


    it('should parse a number with an upper case exponent in scientific notation', ()=> {
        var fn = parse('42E3');
        expect(fn()).toBe(42000);
    });


    it('should not parse invalid scientific notation', ()=> {
        expect(()=>parse('42e-')).toThrow();
        expect(()=>parse('42e-a')).toThrow();
    });

    it('should parse a string in single quotes', ()=> {
        var fn = parse("'42'");
        expect(fn()).toBe('42');
    });

    it('should parse a string in double quotes', ()=> {
        var fn = parse('"42"');
        expect(fn()).toBe('42');
    });


    it('should not parse an incorrect string', ()=> {
        expect(()=>parse('"42\'')).toThrow();
    });
    it('should mark a string as a literal and a constant', ()=> {
        var fn = parse('"42"');
        expect(fn.constant).toBe(true);
        expect(fn.literal).toBe(true);
    });

    it('should parse a string with escaped characters', ()=> {
        var fn = parse('"\\n\\r\\\\"');
        expect(fn()).toEqual('\n\r\\');
    });
    it('should parse a string with unicode escapes', ()=> {
        var fn = parse('"\\u00A0"');
        expect(fn()).toEqual('\u00A0');
    });
    it('should not parse a string with invalid unicode escapes', ()=> {
        expect(()=>parse('"\\u00T0"')).toThrow();
    });
    [null, true, false].forEach(lit=> {
        it(`should parse "${lit}"`, ()=> {
            var fn = parse('' + lit);
            expect(fn()).toBe(lit);
        });
    });

    [null, true, false].forEach(lit=> {
        it(`should mark "${lit}" as constant and literal`, ()=> {
            var fn = parse('' + lit);
            expect(fn.constant).toBe(true);
            expect(fn.literal).toBe(true);
        });
    });
    it('should ignore whitespace', ()=> {
        var fn = parse(' \n42 ');
        expect(fn()).toEqual(42);
    });
    it('should parse an empty array', ()=> {
        var fn = parse('[]');
        expect(fn()).toEqual([]);
    });
    it('should parse a non empty array', ()=> {
        var fn = parse('[1, "2", [3]]');
        expect(fn()).toEqual([1, '2', [3]]);
    });

    it('should parse an array with trailing comma', ()=> {
        var fn = parse('[1, 2, 3,]');
        expect(fn()).toEqual([1, 2, 3]);
    });

    it('should mark arrays as literal and constant', ()=> {
        var fn = parse('[1, 2, 3,]');
        expect(fn.constant).toBe(true);
        expect(fn.literal).toBe(true);
    });

    it('should parse an empty object', ()=> {
        var fn = parse('{}');
        expect(fn()).toEqual({});
    });

    it('should mark objects as literal and constant', ()=> {
        var fn = parse('{}');
        expect(fn.constant).toBe(true);
        expect(fn.literal).toBe(true);
    });

    it('should parse a non-empty object', ()=> {
        var fn = parse('{a:[1], b:2, c:"3", g:{a:10}}');
        expect(fn()).toEqual({a: [1], b: 2, c: '3', g: {a: 10}});
    });

    it('should parse an object with string keys', ()=> {
        var fn = parse('{"a key":1, \'another key\':20}');
        var res = fn();
        var expected = {"a key": 1, "another key": 20};
        expect(res).toEqual(expected);
    });
    it('should look up an attribute from scope passed', ()=> {
        var fn = parse('key');
        expect(fn({key: 10})).toBe(10);
        expect(fn({})).toBeUndefined();
        expect(fn()).toBeUndefined();
    });


    it('should look up a nested attribute from scope passed', ()=> {
        var fn = parse('key.key2');
        expect(fn({key: {key2: 10}})).toBe(10);
        expect(fn({key: {}})).toBeUndefined();
        expect(fn()).toBeUndefined();
    });

    it('should look up a 4-part path from scope passed', ()=> {
        var fn = parse('key.key2.key3.key4');
        expect(fn({key: {key2: {key3: {key4: 10}}}})).toBe(10);
        expect(fn({key: {key2: {key3: {}}}})).toBeUndefined();
        expect(fn({key: {}})).toBeUndefined();
        expect(fn()).toBeUndefined();
    });

    it('should use locals instead of scope if the key matched', ()=> {
        var fn = parse('key');
        expect(fn({key: 10}, {key: 20})).toBe(20);
    });

    it('should not use locals instead of scope if the key not matched', ()=> {
        var fn = parse('key');
        expect(fn({key: 10}, {key2: 20})).toBe(10);
    });

    it('should use locals instead of scope when a 2-part key matches in locals', ()=> {
        var fn = parse('key.key2');
        expect(fn({key: {key2: 10}}, {key: {key2: 20}})).toBe(20);
    });

    it('should not use locals instead of scope when a 2-part key does not match in locals', ()=> {
        var fn = parse('key.key2');
        expect(fn({key: {key2: 10}}, {key3: {key2: 20}})).toBe(10);
    });


    it('should use locals instead of scope when the first part key matches in locals', ()=> {
        var fn = parse('key.key2');
        expect(fn({key: {key2: 10}}, {key: {}})).toBeUndefined();
    });

    it('should use locals instead of scope when a 4-part key matches in locals', ()=> {
        var fn = parse('key.key2.key3.key4');
        expect(fn(
            {key: {key2: {key3: {key4: 10}}}},
            {key: {key2: {key3: {key4: 20}}}}
        )).toBe(20);
    });

    it('should not use locals instead of scope when a 4-part key does not match in locals', ()=> {
        var fn = parse('key.key2.key3.key4');
        expect(fn(
            {key: {key2: {key3: {key4: 10}}}},
            {key2: {key2: {key3: {key4: 20}}}}
        )).toBe(10);
    });


    it('should use locals instead of scope when the first part key matches in locals for > 2-part key', ()=> {
        var fn = parse('key.key2.key3.key4');
        expect(fn(
            {key: {key2: {key3: {key4: 10}}}},
            {key: {key2: {key3: {}}}}
        )).toBeUndefined();
    });


    it('should parse a simple property access', ()=> {
        var fn = parse('key["key"]');
        expect(fn({key: {key: 10}})).toBe(10);
    });
    it('should parse a numeric array access', ()=> {
        var fn = parse('array[1]');
        expect(fn({array: [0, 1]})).toBe(1);
    });

    it('should parse a property access with another property', ()=> {
        var fn = parse('key[key2]');
        expect(fn({key: {key: 10}, key2: 'key'})).toBe(10);
    });

    it('should parse a property access with another property as property', ()=> {
        var fn = parse('key[keys["key2"]]');
        expect(fn({key: {key: 10}, keys: {key2: 'key'}})).toBe(10);
    });

    it('should parse several property access back to back', ()=> {
        var fn = parse('key["a"]["b"]');
        expect(fn({key: {a: {b: 10}}})).toBe(10);
    });

    it('should parse field access after property access', ()=> {
        var fn = parse('key["a"].b');
        expect(fn({key: {a: {b: 10}}})).toBe(10);
    });

    it('should parse a chain of property and field accesses', ()=> {
        var fn = parse('key["a"].b["c"]');
        expect(fn({key: {a: {b: {c: 10}}}})).toBe(10);
    });

    it('should parse a function call', ()=> {
        var fn = parse('fn()');
        expect(fn({fn: ()=>10})).toBe(10);
    });
    it('should parse a function call with an argument', ()=> {
        var fn = parse('fn(10)');
        expect(fn({fn: (n)=>n})).toBe(10);
    });

    it('should parse a function call with an argument identifier', ()=> {
        var fn = parse('fn(n)');
        expect(fn({fn: (n)=>n, n: 10})).toBe(10);
    });
    it('should parse a function call with a function call as an argument', ()=> {
        var fn = parse('fn(n())');
        expect(fn({fn: (n)=>n, n: constant(10)})).toBe(10);
    });

    it('should parse a function call with multiple arguments', ()=> {
        var fn = parse('fn(n(), 10, a)');
        expect(fn({
            fn: (a, b, c)=>a + b + c,
            a: 10,
            n: constant(10)
        })).toBe(30);
    });
    ['constructor', '__defineGetter__', '__proto__', '__lookupSetter__', '__lookupGetter__'].forEach(field=> {
        it(`should throw exception when call parsed expression with a ${field}`, ()=> {
            expect(()=> {
                var fn = parse(`obj.${field}`);
                fn({obj: {}});
            }).toThrow();
        });
    });
    it('should call a function with "this" inside', ()=> {
        var fn = parse('obj["func"]()');
        expect(fn({
            obj: {
                func: function () {
                    return this.a;
                },
                a: 10
            }
        })).toBe(10);
    });

    it('should call a function with "this" inside with a field access', ()=> {
        var fn = parse('obj.func()');
        expect(fn({
            obj: {
                func: function () {
                    return this.a;
                },
                a: 10
            }
        })).toBe(10);
    });

    it('should call method with whitespaces between function name and parenthesis', ()=> {
        var fn = parse('obj.func    ()');
        expect(fn({
            obj: {
                func: function () {
                    return this.a;
                },
                a: 10
            }
        })).toBe(10);
    });
    it('will parse this', function() {
        var fn = parse('this');
        var scope = {};
        expect(fn(scope)).toBe(scope);
        expect(fn()).toBeUndefined();
    });
    it('binds bare functions to the scope', function() {
        var scope = {
            aFunction: function() {
                return this;
            }
        };
        var fn = parse('aFunction()');
        expect(fn(scope)).toBe(scope);
    });
    it('binds bare functions on locals to the locals', function() {
        var scope = {};
        var locals = {
            aFunction: function() {
                return this;
            }
        };
        var fn = parse('aFunction()');
        expect(fn(scope, locals)).toBe(locals);
    });
    it('should clear "this" context on function call', ()=> {
        var fn = parse('obj.func()()');
        expect(fn({
            obj: {
                func: function () {
                    return function () {
                        return this;
                    };
                }
            }
        })).toBeUndefined();
    });

    it('should not allow accessing an alias of window as a property', ()=> {
        var fn = parse('obj["wnd"]');
        expect(()=>fn({obj: {wnd: window}})).toThrow();
    });
    it('should not allow calling functions on window', ()=> {
        var fn = parse('obj.wnd.scroll(500,0)');
        expect(()=>fn({obj: {wnd: window}})).toThrow();
    });
    it('should not allow returning window from a function', ()=> {
        var fn = parse('obj.wnd()');
        expect(()=>fn({obj: {wnd: ()=>window}})).toThrow();
    });
    it('should not allow calling constructor aliases', ()=> {
        var fn = parse('obj.c("return window;")');
        expect(()=>fn(
            {
                obj: {
                    c: (function () {

                    }).constructor
                }
            }
        )).toThrow();
    });

    it('should not allow calling functions on Object', ()=> {
        var fn = parse('obj.create({})');
        expect(()=>fn({obj: Object})).toThrow();
    });
    ['apply', 'call', 'bind'].forEach(method=> {
        it(`should not allow calling function "${method}"`, ()=> {
            var fn = parse(`fn.${method}({})`);
            expect(()=>fn({
                fn: function () {
                }
            })).toThrow();
        });
    });

    it('should parse a property assigning', ()=> {
        var fn = parse('p = 20');
        var scope = {};
        fn(scope);
        expect(scope.p).toBe(20);
    });
    it('should assign any primary expression', ()=> {
        var fn = parse('p = f()');
        var scope = {f: ()=>20};
        fn(scope);
        expect(scope.p).toBe(20);
    });

    it('should parse a nested attribute assignment', ()=> {
        var fn = parse('p.a = f()');
        var scope = {f: ()=>20, p: {}};
        fn(scope);
        expect(scope.p.a).toBe(20);
    });
    it('should create object on fly when assign', ()=> {
        var fn = parse('p.a.d.e = 10');
        var scope = {};
        fn(scope);
        expect(scope.p.a.d.e).toBe(10);
    });

    it('should parse an assignment through attribute access', ()=> {
        var fn = parse('p["a"] = 20');
        var scope = {p: {}};
        fn(scope);
        expect(scope.p.a).toBe(20);
    });

    it('should parse a field assignment after something else', ()=> {
        var fn = parse('p["a"].d = 20');
        var scope = {p: {a: {}}};
        fn(scope);
        expect(scope.p.a.d).toBe(20);
    });
    it('should parse an array with non-literals', ()=> {
        var fn = parse('[a,c()]');
        expect(fn({a: 1, c: constant(2)})).toEqual([1, 2]);
    });

    it('should parse an object with non-literals', ()=> {
        var fn = parse('{a:a,c:obj.c()}');
        expect(fn({a: 1, obj: {c: constant(2)}})).toEqual({a: 1, c: 2});
    });

    it('should make an array constant if it contains only constants', ()=> {
        var fn = parse('[1,2,[3]]');
        expect(fn.constant).toBe(true);
    });

    it('should make an array non constant if it contains not only constants', ()=> {
        var fn = parse('[1,2,[b]]');
        expect(fn.constant).toBe(false);
    });

    it('should make an object constant if it contains only constants', ()=> {
        var fn = parse('{a:10, b:20}');
        expect(fn.constant).toBe(true);
    });

    it('should make an object non constant if it contains not only constants', ()=> {
        var fn = parse('{a:20,c:{c:c}}');
        expect(fn.constant).toBe(false);
    });

    it('should allow an array element to be an assignment ', ()=> {
        var fn = parse('[a =10]');
        var scope = {};
        expect(fn(scope)).toEqual([10]);
        expect(scope.a).toBe(10);
    });

    it('should allow an object value to be an assignment ', ()=> {
        var fn = parse('{a:a=10}');
        var scope = {};
        expect(fn(scope)).toEqual({a: 10});
        expect(scope.a).toBe(10);
    });

    it('should parse an unary +', ()=> {
        expect(parse('+42')()).toBe(42);
        expect(parse('+a')({a: 42})).toBe(42);
    });
    it('should parse an unary !', ()=> {
        expect(parse('!true')()).toBe(false);
        expect(parse('!false')()).toBe(true);
        expect(parse('!a')({a: true})).toBe(false);
        expect(parse('!!a')({a: true})).toBe(true);
        expect(parse('!42')()).toBe(false);
    });
    it('should be constant if negate operator applied to constant', ()=> {
        expect(parse('!true').constant).toBe(true);
        expect(parse('!a').constant).toBeFalsy();
    });

    it('should parse an unary -', ()=> {
        expect(parse('-42')()).toBe(-42);
        expect(parse('-a')({a: 42})).toBe(-42);
        expect(parse('--a')({a: -42})).toBe(-42);
        expect(parse('-a')({a: -42})).toBe(42);
    });

    it('should be constant if minus operator applied to constant', ()=> {
        expect(parse('-10').constant).toBe(true);
        expect(parse('-a').constant).toBeFalsy();
    });
    it('should fill missing value in unary - with 0', ()=> {
        expect(parse('-a')()).toBe(0);
    });
    it('should parse multiplication', ()=> {
        expect(parse('1 * a')({a: 10})).toBe(10);
    });

    it('should parse division', ()=> {
        expect(parse('10 / a')({a: 10})).toBe(1);
    });

    it('should parse remainder', ()=> {
        expect(parse('10 % a')({a: 8})).toBe(2);
    });
    it('should parse several multiplicatives', ()=> {
        expect(parse('10 % a * 2')({a: 8})).toBe(4);
    });

    it('should parse addition', ()=> {
        expect(parse('10 + a')({a: 10})).toBe(20);
    });

    it('should parse subtraction', ()=> {
        expect(parse('10 - a')({a: 8})).toBe(2);
    });

    it('should parse multiplicatives with higher precedence than additives', ()=> {
        expect(parse('1 + a * 3 - 4')({a: 2})).toBe(3);
    });

    it('should treat missing operand as zero when subtract', ()=> {
        expect(parse('1 - a')({})).toBe(1);
    });

    it('should treat missing operand as zero when subtract', ()=> {
        expect(parse('1 + a')({})).toBe(1);
    });
    it('should return 0 if all operands are absent', ()=> {
        expect(parse('d + a')({})).toBe(0);
    });

    it('should parse relational operators', ()=> {
        expect(parse('1 < 2')({})).toBe(true);
        expect(parse('3 < 2')({})).toBe(false);
        expect(parse('1 <= 2')({})).toBe(true);
        expect(parse('2 <= 2')({})).toBe(true);
        expect(parse('3 <= 2')({})).toBe(false);
        expect(parse('1 >= 2')({})).toBe(false);
        expect(parse('2 >= 2')({})).toBe(true);
        expect(parse('3 >= 2')({})).toBe(true);
    });

    it('should parse equality operators', ()=> {
        expect(parse('2 == 2')({})).toBe(true);
        expect(parse('2 == "2"')({})).toBe(true);
        expect(parse('2 != 2')({})).toBe(false);
        expect(parse('2 === 2')({})).toBe(true);
        expect(parse('3 === 2')({})).toBe(false);
        expect(parse('"2" === 2')({})).toBe(false);
        expect(parse('3 !== 2')({})).toBe(true);
    });

    it('should parse relationals on a higher precedence then equality', ()=> {
        expect(parse('2 == "2" > 2 === 2')({})).toBe(false);
    });

    it('should parse additives on a higher precedence then relationals', ()=> {
        expect(parse('2 + 3 < 6 - 2')({})).toBe(false);
    });

    it('should parse logical "and"', ()=> {
        expect(parse('true && true')()).toBe(true);
        expect(parse('true && false')()).toBe(false);
    });

    it('should parse logical "or"', ()=> {
        expect(parse('true || true')()).toBe(true);
        expect(parse('false || false')()).toBe(false);
        expect(parse('false || true')()).toBe(true);
    });

    it('should parse multi "and"', ()=> {
        expect(parse('true && true && true')()).toBe(true);
        expect(parse('true && true && false')()).toBe(false);
    });

    it('should parse multi "or"', ()=> {
        expect(parse('false || false || true')()).toBe(true);
        expect(parse('false || false || false')()).toBe(false);
        expect(parse('false || true && false')()).toBe(false);
    });

    it('should short-circuit "and"', ()=> {
        expect(parse('true && fn()')({fn: constant(10)})).toBe(10);
        expect(parse('true && true && a')({a: 10})).toBe(10);
    });

    it('should short-circuit "or"', ()=> {
        expect(parse('fn() || 20 ')({fn: constant(10)})).toBe(10);
        expect(parse('a || 10')({a: 0})).toBe(10);
    });

    it('should parse "and" with a higher precedence then "or"', ()=> {
        expect(parse('false && true || true')()).toBe(true);
    });

    it('should parse "or" with a lower precedence then equality', ()=> {
        expect(parse('1 === 2 || 2 === 2')()).toBeTruthy();
    });

    it('should parse a ternary operator', ()=> {
        expect(parse('1 === 2 ? true : false')()).toBe(false);
        expect(parse('2 === 2 ? true : false')()).toBe(true);
    });

    it('should parse "or" with higher precedence then ternary operator', ()=> {
        expect(parse('0 || 1 ? true : false')()).toBe(true);
    });

    it('should parse nested ternary operators', ()=> {
        expect(parse('0 || 1 ? 0 || 0 ? 10 : 20 : false')()).toBe(20);
    });

    it('should make ternary constant if all operands constant', ()=> {
        expect(parse('0 || 1 ? true : false').constant).toBe(true);
        expect(parse('0 || 1 ? true : a').constant).toBeFalsy();
    });
    it('should parse parentheses altering precedence order', ()=> {
        expect(parse('2 * (1 + 2)')()).toBe(6);
        expect(parse('-(2 - 4 * 1)')()).toBe(2);
    });
    it('should parse several statements', ()=> {
        var scope = {};
        parse('a = 10; b = 20; c = 30')(scope);
        expect(scope).toEqual({a: 10, b: 20, c: 30});
    });
    it('should return the last result of the statements', ()=> {
        expect(parse('a = 10; b = 20; c = 30')({})).toBe(30);
    });
    it('should parse a filter expression', ()=> {
        register('upcase', ()=>str=>str.toUpperCase());
        expect(parse('a | upcase')({a: 'b'})).toEqual('B');
    });


    it('should parse a filter chain', ()=> {
        register('upcase', ()=>str=>str.toUpperCase());
        register('append', ()=>str=>str + '2');
        expect(parse('a | upcase | append')({a: 'b'})).toEqual('B2');
    });

    it('should parse filter arguments', ()=> {
        register('append', ()=>(str, ...args)=>str + args.join(''));
        expect(parse('a | append:c:50:"d"')({a: 'b', c: 40})).toEqual('b4050d');
    });
    it('should filter an array with a predicate function', ()=> {
        expect(parse('[1,2,3,4] | filter:isOdd')({
            isOdd: (v)=> v % 2 !== 0
        })).toEqual([1, 3]);
    });
    it('should filter an array with a string', ()=> {
        expect(parse('arr | filter:s')({
            s: 'a',
            arr: ["a", "b", "a"]
        })).toEqual(["a", "a"]);
    });

    it('should filter an array with substring matching', ()=> {
        expect(parse('arr | filter:s')({
            s: 'a',
            arr: ["aaa", "ba", "cd"]
        })).toEqual(["aaa", "ba"]);
    });

    it('should filter an array with ignoring case', ()=> {
        expect(parse('arr | filter:s')({
            s: 'a',
            arr: ["aaa", "BA", "cd"]
        })).toEqual(["aaa", "BA"]);
    });

    it('should filter an array of objects where any value matches', ()=> {
        expect(parse('arr | filter:s')({
            s: 'a',
            arr: [{a: 'aa', b: 'cc'}, {a: 'bb', b: 'dd'}, {a: 'bb', c: 'ad'}]
        })).toEqual([{a: 'aa', b: 'cc'}, {a: 'bb', c: 'ad'}]);
    });


    it('should filter an array of objects where any nested value matches', ()=> {
        expect(parse('arr | filter:s')({
            s: 'a',
            arr: [
                {a: 'aa', b: 'cc'},
                {a: 'bb', b: 'dd'},
                {a: 'bb', c: {g: 'ad'}}
            ]
        })).toEqual([{a: 'aa', b: 'cc'}, {a: 'bb', c: {g: 'ad'}}]);
    });

    it('should filter an array of arrays where any nested value matches', ()=> {
        expect(parse('arr | filter:s')({
            s: 'a',
            arr: [
                [{a: 'aa', b: 'cc'}],
                [{a: 'bb', b: 'dd'}],
                [{a: 'bb', c: 'ad'}]
            ]
        })).toEqual([[{a: 'aa', b: 'cc'}], [{a: 'bb', c: 'ad'}]]);
    });

    it('should filter an array with a number', ()=> {
        expect(parse('arr | filter:s')({
            s: 10,
            arr: [10, 20]
        })).toEqual([10]);
    });

    it('should filter an array with a boolean', ()=> {
        expect(parse('arr | filter:s')({
            s: false,
            arr: [true, false]
        })).toEqual([false]);
    });

    it('should filter with a substring numeric value', ()=> {
        expect(parse('arr | filter:s')({
            s: 10,
            arr: ['10 aaa']
        })).toEqual(['10 aaa']);
    });

    it('should filter matching null', ()=> {
        expect(parse('arr | filter:s')({
            s: null,
            arr: [null, '10 null']
        })).toEqual([null]);
    });
    it('should not match null as a string null', ()=> {
        expect(parse('arr | filter:s')({
            s: "null",
            arr: [null, '10 null']
        })).toEqual(['10 null']);
    });
    it('should not match undefined as a string undefined', ()=> {
        expect(parse('arr | filter:s')({
            s: "undefined",
            arr: [undefined, '10 undefined']
        })).toEqual(['10 undefined']);
    });
    it('should allow negating string filter', ()=> {
        expect(parse('arr | filter:s')({
            s: '!a',
            arr: ['10 aaa']
        })).toEqual([]);
    });
    it('should allow using an object as a filter', ()=> {
        expect(parse('arr | filter:s')({
            s: {b: 'a'},
            arr: [
                {a: 10, b: 'abb'},
                {a: 10, b: 'bb'}
            ]
        })).toEqual([{a: 10, b: 'abb'}]);
    });


    it('should match all if the filter object is empty one', ()=> {
        expect(parse('arr | filter:s')({
            s: {},
            arr: [
                {a: 10, b: 'abb'},
                {a: 10, b: 'bb'}
            ]
        })).toEqual([{a: 10, b: 'abb'}, {a: 10, b: 'bb'}]);
    });

    it('should match all if the filter object is empty one', ()=> {
        expect(parse('arr | filter:s')({
            s: {},
            arr: [
                {a: 10, b: 'abb'},
                {a: 10, b: 'bb'}
            ]
        })).toEqual([{a: 10, b: 'abb'}, {a: 10, b: 'bb'}]);
    });
    it('should ignore undefined properties while filtering', ()=> {
        expect(parse('arr | filter:s')({
            arr: [
                {a: 10, b: 'abb'},
                {a: 10, b: 'bb'}
            ]
        })).toEqual([{a: 10, b: 'abb'}, {a: 10, b: 'bb'}]);
    });
    it('filters with a nested object in array', function () {
        var fn = parse('arr | filter:{users: {name: {first: "o"}}}');
        expect(fn({
            arr: [
                {
                    users: [{name: {first: 'Joe'}, role: 'admin'},
                        {name: {first: 'Jane'}, role: 'moderator'}]
                },
                {users: [{name: {first: 'Mary'}, role: 'admin'}]}
            ]
        })).toEqual([
            {
                users: [{name: {first: 'Joe'}, role: 'admin'},
                    {name: {first: 'Jane'}, role: 'moderator'}]
            }
        ]);
    });
    it('filters with nested objects on the same level only', function () {
        var items = [{user: 'Bob'},
            {user: {name: 'Bob'}},
            {user: {name: {first: 'Bob', last: 'Fox'}}}];
        var fn = parse('arr | filter:{user: {name: "Bob"}}');
        expect(fn({
            arr: items
        })).toEqual([
            {user: {name: 'Bob'}}
        ]);
    });
    it('filters with a wildcard property', function () {
        var fn = parse('arr | filter:{$: "o"}');
        expect(fn({
            arr: [
                {name: 'Joe', role: 'admin'},
                {name: 'Jane', role: 'moderator'},
                {name: 'Mary', role: 'admin'}
            ]
        })).toEqual([
            {name: 'Joe', role: 'admin'},
            {name: 'Jane', role: 'moderator'}
        ]);
    });

    it('filters nested objects with a wildcard property', function () {
        var fn = parse('arr | filter:{$: "o"}');
        expect(fn({
            arr: [
                {name: {first: 'Joe'}, role: 'admin'},
                {name: {first: 'Jane'}, role: 'moderator'},
                {name: {first: 'Mary'}, role: 'admin'}
            ]
        })).toEqual([
            {name: {first: 'Joe'}, role: 'admin'},
            {name: {first: 'Jane'}, role: 'moderator'}
        ]);
    });
    it('filters wildcard properties scoped to parent', function () {
        var fn = parse('arr | filter:{name: {$: "o"}}');
        expect(fn({
            arr: [
                {name: {first: 'Joe', last: 'Fox'}, role: 'admin'},
                {name: {first: 'Jane', last: 'Quick'}, role: 'moderator'},
                {name: {first: 'Mary', last: 'Brown'}, role: 'admin'}
            ]
        })).toEqual([
            {name: {first: 'Joe', last: 'Fox'}, role: 'admin'},
            {name: {first: 'Mary', last: 'Brown'}, role: 'admin'}
        ]);
    });
    it('filters primitives with a wildcard property', function () {
        var fn = parse('arr | filter:{$: "o"}');
        expect(fn({arr: ['Joe', 'Jane', 'Mary']})).toEqual(['Joe']);
    });
    it('filters with a nested wildcard property', function () {
        var fn = parse('arr | filter:{$: {$: "o"}}');
        expect(fn({
            arr: [
                {name: {first: 'Joe'}, role: 'admin'},
                {name: {first: 'Jane'}, role: 'moderator'},
                {name: {first: 'Mary'}, role: 'admin'}
            ]
        })).toEqual([
            {name: {first: 'Joe'}, role: 'admin'}
        ]);
    });
    it('allows using a custom comparator', function () {
        var fn = parse('arr | filter:{$: "o"}:myComparator');
        expect(fn({
            arr: ['o', 'oo', 'ao', 'aa'],
            myComparator: function (left, right) {
                return left === right;
            }
        })).toEqual(['o']);
    });
    it('allows using an equality comparator', function () {
        var fn = parse('arr | filter:{name: "Jo"}:true');
        expect(fn({
            arr: [
                {name: "Jo"},
                {name: "Joe"}
            ]
        })).toEqual([
            {name: "Jo"}
        ]);
    });
    it('returns the function itself when given one', function () {
        expect(parse(Function.prototype)).toBe(Function.prototype);
    });
    it('still returns a function when given no argument', function () {
        expect(parse()).toEqual(jasmine.any(Function));
    });
    it('marks integers literal', function () {
        var fn = parse('42');
        expect(fn.literal).toBe(true);
    });
    it('marks strings literal', function () {
        var fn = parse('"abc"');
        expect(fn.literal).toBe(true);
    });
    it('marks booleans literal', function () {
        var fn = parse('true');
        expect(fn.literal).toBe(true);
    });
    it('marks arrays literal', function () {
        var fn = parse('[1, 2, aVariable]');
        expect(fn.literal).toBe(true);
    });
    it('marks objects literal', function () {
        var fn = parse('{a: 1, b: aVariable}');
        expect(fn.literal).toBe(true);
    });
    it('marks unary expressions non-literal', function () {
        var fn = parse('!false');
        expect(fn.literal).toBe(false);
    });
    it('marks binary expressions non-literal', function () {
        var fn = parse('1 + 2');
        expect(fn.literal).toBe(false);
    });
    it('marks identifiers non-constant', function () {
        var fn = parse('a');
        expect(fn.constant).toBeFalsy();
    });

    it('marks this as non-constant', function () {
        var scope = {};
        expect(parse('this')(scope)).toBe(scope);
    });
    it('marks this as non-constant', function () {
        expect(parse('this').constant).toBeFalsy();
    });
    it('marks computed lookup constant when object and key are', function () {
        expect(parse('obj[something]').constant).toBeFalsy();
    });
    it('marks filters constant if arguments are', function () {
        register('aFilter', function () {
            return _.identity;
        });
        expect(parse('[1, 2, 3] | aFilter').constant).toBe(true);
        expect(parse('[1, 2, a] | aFilter').constant).toBe(false);
        expect(parse('[1, 2, 3] | aFilter:42').constant).toBe(true);
        expect(parse('[1, 2, 3] | aFilter:a').constant).toBe(false);
    });
    it('marks unaries constant when arguments are constant', function () {
        expect(parse('+42').constant).toBe(true);
        expect(parse('+a').constant).toBeFalsy();
    });

    it('marks binaries constant when both arguments are constant', function () {
        expect(parse('1 + 2').constant).toBe(true);
        expect(parse('1 + 2').literal).toBeFalsy(false);
        expect(parse('1 + a').constant).toBeFalsy(false);
        expect(parse('a + 1').constant).toBeFalsy(false);
        expect(parse('a + a').constant).toBeFalsy(false);
    });
    it('marks logicals constant when both arguments are constant', function () {
        expect(parse('true && false').constant).toBe(true);
        expect(parse('true && false').literal).toBeFalsy(false);
        expect(parse('true && a').constant).toBeFalsy(false);
        expect(parse('a && false').constant).toBeFalsy(false);
        expect(parse('a && b').constant).toBeFalsy(false);
    });
    it('marks ternaries constant when all arguments are', function () {
        expect(parse('true ? 1 : 2').constant).toBe(true);
        expect(parse('a ? 1 : 2').constant).toBeFalsy(false);
        expect(parse('true ? a : 2').constant).toBeFalsy(false);
        expect(parse('true ? 1 : b').constant).toBeFalsy(false);
        expect(parse('a ? b : c').constant).toBeFalsy(false);
    });

    it('allows calling assign on identifier expressions', function() {
        var fn = parse('anAttribute');
        expect(fn.assign).toBeDefined();
        var scope = {};
        fn.assign(scope, 42);
        expect(scope.anAttribute).toBe(42);
    });
    it('allows calling assign on member expressions', function() {
        var fn = parse('anObject.anAttribute');
        expect(fn.assign).toBeDefined();
        var scope = {};
        fn.assign(scope, 42);
        expect(scope.anObject).toEqual({anAttribute: 42});
    });
});