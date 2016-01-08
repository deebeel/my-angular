'use strict';
import _ from 'lodash';

var filterFilter = ()=>(array, expr, comparator)=> {
    var predicateFn;
    if (_.isFunction(expr)) {
        predicateFn = expr;
    } else if (_.isString(expr) ||
        _.isNumber(expr) ||
        _.isBoolean(expr) ||
        _.isNull(expr) ||
        _.isObject(expr)) {
        predicateFn = createPredicateFn(expr, comparator);
    } else {
        return array;
    }
    return _.filter(array, predicateFn);
};
var deepCompare = (actual, expected, comparator, matchAnyProp, isWildcard)=> {
    if (_.isString(expected) && _.startsWith(expected, '!')) {
        return !deepCompare(actual, expected.substring(1), comparator, matchAnyProp);
    }
    if (_.isArray(actual)) {
        return _.any(actual, (item)=>deepCompare(item, expected, comparator, matchAnyProp));
    }
    if (_.isObject(actual)) {
        if (_.isObject(expected) && !isWildcard) {
            return _.every(
                _.toPlainObject(expected),
                (val, key)=> {
                    if (_.isUndefined(val)) {
                        return true;
                    }
                    var isWildcard = (key === '$');
                    var actualVal = isWildcard ? actual : actual[key];
                    return deepCompare(actualVal, val, comparator, isWildcard, isWildcard);
                }
            )
        } else if (matchAnyProp) {
            return _.some(actual, value=>deepCompare(value, expected, comparator, matchAnyProp));
        }
    }
    return comparator(actual, expected);
};
var createPredicateFn = (expr, comparator)=> {
    var shouldMatchPrimitives = _.isObject(expr) && ('$' in expr);
    if (comparator === true) {
        comparator = _.isEqual;
    } else if (!_.isFunction(comparator)) {
        comparator = (actual, expected)=> {

            if (_.isUndefined(actual)) {
                return false;
            }
            if (_.isNull(actual) || _.isNull(expected)) {
                return actual === expected;
            }
            actual = ('' + actual).toUpperCase();
            expected = ('' + expected).toUpperCase();

            return actual.indexOf(expected) !== -1;
        };
    }
    return item=> {
        if (shouldMatchPrimitives && !_.isObject(item)) {
            return deepCompare(item, expr.$, comparator);
        }
        return deepCompare(item, expr, comparator, true);
    };
};

class $FilterProvider {
    constructor($provide) {
        this.$provide = $provide;
        this.register('filter', filterFilter);
        this.$get = filter;
    }

    register(obj, factory) {
        if (typeof obj === 'object') {
            return Object.keys(obj).map(name=>this.register(name, obj[name]));
        }
        return this.$provide.factory(`${obj}Filter`, factory);
    }

    static $inject = ['$provide'];
}
function filter($injector) {
    return (name) => {
        return $injector.get(`${name}Filter`);
    };
}
filter.$inject = ['$injector'];

export default $FilterProvider;