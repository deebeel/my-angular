'use strict';
import $QFactory from './q';
import $RootScopeProvider from '../scope';
import $ParseProvider from '../parse';
import $FilterProvider from '../filter';
import _ from 'lodash';

function newScope() {

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
    var filter = filterProvider.$get($injector);
    return new $RootScopeProvider().$get(parseProvider.$get(filter));
}

describe('$q', ()=> {
    var d, spy, $rootScope, $$q,$q;
    beforeEach(()=> {
        spy = jasmine.createSpy();
        $rootScope = newScope();
        $q = $QFactory($rootScope.$evalAsync.bind($rootScope));
        $$q = $QFactory(setTimeout);
        d = $q.defer();
    });
    it('can create a Deferred', function () {
        var d = $q.defer();
        expect(d).toBeDefined();
    });
    it('has a promise for each Deferred', function () {
        var d = $q.defer();
        expect(d.promise).toBeDefined();
    });
    it('can resolve a promise', function (done) {
        var promise = d.promise;
        promise.then(spy);
        d.resolve('a-ok');
        setTimeout(function () {
            expect(spy).toHaveBeenCalledWith('a-ok');
            done();
        }, 1);
    });
    it('works when resolved before promise listener', function (done) {
        d.resolve(42);
        d.promise.then(spy);
        setTimeout(function () {
            expect(spy).toHaveBeenCalledWith(42);
            done();
        }, 0);
    });
    it('does not resolve promise immediately', function () {
        d.promise.then(spy);
        d.resolve(42);
        expect(spy).not.toHaveBeenCalled();
    });
    it('resolves promise at next digest', function () {
        d.promise.then(spy);
        d.resolve(42);
        $rootScope.$apply();
        expect(spy).toHaveBeenCalledWith(42);
    });
    it('may only be resolved once', function () {
        d.promise.then(spy);
        d.resolve(42);
        d.resolve(43);
        $rootScope.$apply();
        expect(spy.calls.count()).toEqual(1);
        expect(spy).toHaveBeenCalledWith(42);
    });
    it('may only ever be resolved once', function () {
        d.promise.then(spy);
        d.resolve(42);
        $rootScope.$apply();
        expect(spy).toHaveBeenCalledWith(42);
        d.resolve(43);
        $rootScope.$apply();
        expect(spy.calls.count()).toEqual(1);
    });
    it('resolves a listener added after resolution', function () {
        d.resolve(42);
        $rootScope.$apply();
        d.promise.then(spy);
        $rootScope.$apply();
        expect(spy).toHaveBeenCalledWith(42);
    });
    it('may have multiple callbacks', function () {
        var firstSpy = jasmine.createSpy();
        var secondSpy = jasmine.createSpy();
        d.promise.then(firstSpy);
        d.promise.then(secondSpy);
        d.resolve(42);
        $rootScope.$apply();
        expect(firstSpy).toHaveBeenCalledWith(42);
        expect(secondSpy).toHaveBeenCalledWith(42);
    });
    it('invokes callbacks once', function () {
        var firstSpy = jasmine.createSpy();
        var secondSpy = jasmine.createSpy();
        d.promise.then(firstSpy);
        d.resolve(42);
        $rootScope.$apply();
        expect(firstSpy.calls.count()).toBe(1);
        expect(secondSpy.calls.count()).toBe(0);
        d.promise.then(secondSpy);
        expect(firstSpy.calls.count()).toBe(1);
        expect(secondSpy.calls.count()).toBe(0);
        $rootScope.$apply();
        expect(firstSpy.calls.count()).toBe(1);
        expect(secondSpy.calls.count()).toBe(1);
    });

    it('can reject a deferred', function () {
        var fulfillSpy = jasmine.createSpy();
        var rejectSpy = jasmine.createSpy();
        d.promise.then(fulfillSpy, rejectSpy);
        d.reject('fail');
        $rootScope.$apply();
        expect(fulfillSpy).not.toHaveBeenCalled();
        expect(rejectSpy).toHaveBeenCalledWith('fail');
    });
    it('can reject just once', function () {
        var rejectSpy = jasmine.createSpy();
        d.promise.then(null, rejectSpy);
        d.reject('fail');
        $rootScope.$apply();
        expect(rejectSpy.calls.count()).toBe(1);
        d.reject('fail again');
        $rootScope.$apply();
        expect(rejectSpy.calls.count()).toBe(1);
    });
    it('cannot fulfill a promise once rejected', function () {
        var fulfillSpy = jasmine.createSpy();
        var rejectSpy = jasmine.createSpy();
        d.promise.then(fulfillSpy, rejectSpy);
        d.reject('fail');
        $rootScope.$apply();
        d.resolve('success');
        $rootScope.$apply();
        expect(fulfillSpy).not.toHaveBeenCalled();
    });
    it('does not require a failure handler each time', function () {
        var fulfillSpy = jasmine.createSpy();
        var rejectSpy = jasmine.createSpy();
        d.promise.then(fulfillSpy);
        d.promise.then(null, rejectSpy);
        d.reject('fail');
        $rootScope.$apply();
        expect(rejectSpy).toHaveBeenCalledWith('fail');
    });
    it('does not require a success handler each time', function () {
        var fulfillSpy = jasmine.createSpy();
        var rejectSpy = jasmine.createSpy();
        d.promise.then(fulfillSpy);
        d.promise.then(null, rejectSpy);
        d.resolve('ok');
        $rootScope.$apply();
        expect(fulfillSpy).toHaveBeenCalledWith('ok');
    });
    it('can register rejection handler with catch', function () {
        var rejectSpy = jasmine.createSpy();
        d.promise.catch(rejectSpy);
        d.reject('fail');
        $rootScope.$apply();
        expect(rejectSpy).toHaveBeenCalled();
    });
    it('invokes a finally handler when fulfilled', function () {
        var finallySpy = jasmine.createSpy();
        d.promise.finally(finallySpy);
        d.resolve(42);
        $rootScope.$apply();
        expect(finallySpy).toHaveBeenCalledWith();
    });
    it('invokes a finally handler when rejected', function () {
        var finallySpy = jasmine.createSpy();
        d.promise.finally(finallySpy);
        d.reject('fail');
        $rootScope.$apply();
        expect(finallySpy).toHaveBeenCalledWith();
    });
    it('allows chaining handlers', function () {
        var fulfilledSpy = jasmine.createSpy();
        d.promise.then(function (result) {
            return result + 1;
        }).then(function (result) {
            return result * 2;
        }).then(fulfilledSpy);
        d.resolve(20);
        $rootScope.$apply();
        expect(fulfilledSpy).toHaveBeenCalledWith(42);
    });
    it('does not modify original resolution in chains', function () {
        var fulfilledSpy = jasmine.createSpy();
        d.promise.then(function (result) {
            return result + 1;
        }).then(function (result) {
            return result * 2;
        });
        d.promise.then(fulfilledSpy);
        d.resolve(20);
        $rootScope.$apply();
        expect(fulfilledSpy).toHaveBeenCalledWith(20);
    });
    it('catches rejection on chained handler', function () {
        var rejectedSpy = jasmine.createSpy();
        d.promise.then(_.noop).catch(rejectedSpy);
        d.reject('fail');
        $rootScope.$apply();
        expect(rejectedSpy).toHaveBeenCalledWith('fail');
    });
    it('fulfills on chained handler', function () {
        var fulfilledSpy = jasmine.createSpy();
        d.promise.catch(_.noop).then(fulfilledSpy);
        d.resolve(42);
        $rootScope.$apply();
        expect(fulfilledSpy).toHaveBeenCalledWith(42);
    });
    it('treats catch return value as resolution', function () {
        var fulfilledSpy = jasmine.createSpy();
        d.promise
            .catch(function () {
                return 42;
            })
            .then(fulfilledSpy);
        d.reject('fail');
        $rootScope.$apply();
        expect(fulfilledSpy).toHaveBeenCalledWith(42);
    });
    it('rejects chained promise when handler throws', function () {
        var rejectedSpy = jasmine.createSpy();
        d.promise.then(function () {
            throw 'fail';
        }).catch(rejectedSpy);
        d.resolve(42);
        $rootScope.$apply();
        expect(rejectedSpy).toHaveBeenCalledWith('fail');
    });
    it('does not reject current promise when handler throws', function () {
        var rejectedSpy = jasmine.createSpy();
        d.promise.then(function () {
            throw 'fail';
        });
        d.promise.catch(rejectedSpy);
        d.resolve(42);
        $rootScope.$apply();
        expect(rejectedSpy).not.toHaveBeenCalled();
    });
    it('waits on promise returned from handler', function () {
        var fulfilledSpy = jasmine.createSpy();
        d.promise.then(function (v) {
            var d2 = $q.defer();
            d2.resolve(v + 1);
            return d2.promise;
        }).then(function (v) {
            return v * 2;
        }).then(fulfilledSpy);
        d.resolve(20);
        $rootScope.$apply();
        expect(fulfilledSpy).toHaveBeenCalledWith(42);
    });

    it('waits on promise given to resolve', function () {
        var d2 = $q.defer();
        var fulfilledSpy = jasmine.createSpy();
        d.promise.then(fulfilledSpy);
        d2.resolve(42);
        d.resolve(d2.promise);
        $rootScope.$apply();
        expect(fulfilledSpy).toHaveBeenCalledWith(42);
    });
    it('rejects when promise returned from handler rejects', function () {
        var rejectedSpy = jasmine.createSpy();
        d.promise.then(function () {
            var d2 = $q.defer();
            d2.reject('fail');
            return d2.promise;
        }).catch(rejectedSpy);
        d.resolve('ok');
        $rootScope.$apply();
        expect(rejectedSpy).toHaveBeenCalledWith('fail');
    });
    it('allows chaining handlers on finally, with original value', function () {
        var fulfilledSpy = jasmine.createSpy();
        d.promise.then(function (result) {
            return result + 1;
        }).finally(function (result) {
            return result * 2;
        }).then(fulfilledSpy);
        d.resolve(20);
        $rootScope.$apply();
        expect(fulfilledSpy).toHaveBeenCalledWith(21);
    });
    it('allows chaining handlers on finally, with original rejection', function () {
        var rejectedSpy = jasmine.createSpy();
        d.promise.then(function (result) {
            throw 'fail';
        }).finally(function () {
        }).catch(rejectedSpy);
        d.resolve(20);
        $rootScope.$apply();
        expect(rejectedSpy).toHaveBeenCalledWith('fail');
    });
    it('resolves to orig value when nested promise resolves', function () {
        var fulfilledSpy = jasmine.createSpy();
        var resolveNested;
        d.promise.then(function (result) {
            return result + 1;
        }).finally(function (result) {
            var d2 = $q.defer();
            resolveNested = function () {
                d2.resolve('abc');
            };
            return d2.promise;
        }).then(fulfilledSpy);
        d.resolve(20);
        $rootScope.$apply();
        expect(fulfilledSpy).not.toHaveBeenCalled();
        resolveNested();
        $rootScope.$apply();
        expect(fulfilledSpy).toHaveBeenCalledWith(21);
    });
    it('rejects to original value when nested promise resolves', function () {
        var rejectedSpy = jasmine.createSpy();
        var resolveNested;
        d.promise.then(function (result) {
            throw 'fail';
        }).finally(function (result) {
            var d2 = $q.defer();
            resolveNested = function () {
                d2.resolve('abc');
            };
            return d2.promise;
        }).catch(rejectedSpy);
        d.resolve(20);
        $rootScope.$apply();
        expect(rejectedSpy).not.toHaveBeenCalled();
        resolveNested();
        $rootScope.$apply();
        expect(rejectedSpy).toHaveBeenCalledWith('fail');
    });
    it('rejects when nested promise rejects in finally', function () {
        var fulfilledSpy = jasmine.createSpy();
        var rejectedSpy = jasmine.createSpy();
        var rejectNested;
        d.promise.then(function (result) {
            return result + 1;
        }).finally(function (result) {
            var d2 = $q.defer();
            rejectNested = function () {
                d2.reject('fail');
            };
            return d2.promise;
        }).then(fulfilledSpy, rejectedSpy);
        d.resolve(20);
        $rootScope.$apply();
        expect(fulfilledSpy).not.toHaveBeenCalled();
        rejectNested();
        $rootScope.$apply();
        expect(fulfilledSpy).not.toHaveBeenCalled();
        expect(rejectedSpy).toHaveBeenCalledWith('fail');
    });
    it('can report progress', function () {
        var progressSpy = jasmine.createSpy();
        d.promise.then(null, null, progressSpy);
        d.notify('working...');
        $rootScope.$apply();
        expect(progressSpy).toHaveBeenCalledWith('working...');
    });
    it('can report progress many times', function () {
        var progressSpy = jasmine.createSpy();
        d.promise.then(null, null, progressSpy);
        d.notify('40%');
        $rootScope.$apply();
        d.notify('80%');
        d.notify('100%');
        $rootScope.$apply();
        expect(progressSpy.calls.count()).toBe(3);
    });
    it('does not notify progress after being resolved', function () {
        var progressSpy = jasmine.createSpy();
        d.promise.then(null, null, progressSpy);
        d.resolve('ok');
        d.notify('working...');
        $rootScope.$apply();
        expect(progressSpy).not.toHaveBeenCalled();
    });
    it('does not notify progress after being rejected', function () {
        var progressSpy = jasmine.createSpy();
        d.promise.then(null, null, progressSpy);
        d.reject('fail');
        d.notify('working...');
        $rootScope.$apply();
        expect(progressSpy).not.toHaveBeenCalled();
    });
    it('can notify progress through chain', function () {
        var progressSpy = jasmine.createSpy();
        d.promise
            .then(_.noop)
            .catch(_.noop)
            .then(null, null, progressSpy);
        d.notify('working...');
        $rootScope.$apply();
        expect(progressSpy).toHaveBeenCalledWith('working...');
    });
    it('transforms progress through handlers', function () {
        var d = $q.defer();
        var progressSpy = jasmine.createSpy();
        d.promise
            .then(_.noop)
            .then(null, null, function (progress) {
                return '***' + progress + '***';
            })
            .catch(_.noop)
            .then(null, null, progressSpy);
        d.notify('working...');
        $rootScope.$apply();
        expect(progressSpy).toHaveBeenCalledWith('***working...***');
    });
    it('recovers from progressback exceptions', function () {
        var d = $q.defer();
        var progressSpy = jasmine.createSpy();
        var fulfilledSpy = jasmine.createSpy();
        d.promise.then(null, null, function (progress) {
            throw 'fail';
        });
        d.promise.then(fulfilledSpy, null, progressSpy);
        d.notify('working...');
        d.resolve('ok');
        $rootScope.$apply();
        expect(progressSpy).toHaveBeenCalledWith('working...');
        expect(fulfilledSpy).toHaveBeenCalledWith('ok');
    });
    it('can notify progress through promise returned from handler', function () {
        var d = $q.defer();
        var progressSpy = jasmine.createSpy();
        d.promise.then(null, null, progressSpy);
        var d2 = $q.defer();
// Resolve original with nested promise
        d.resolve(d2.promise);
// Notify on the nested promise
        d2.notify('working...');
        $rootScope.$apply();
        expect(progressSpy).toHaveBeenCalledWith('working...');
    });
    it('allows attaching progressback in finally', function () {
        var d = $q.defer();
        var progressSpy = jasmine.createSpy();
        d.promise.finally(null, progressSpy);
        d.notify('working...');
        $rootScope.$apply();
        expect(progressSpy).toHaveBeenCalledWith('working...');
    });
    it('can make an immediately rejected promise', function () {
        var fulfilledSpy = jasmine.createSpy();
        var rejectedSpy = jasmine.createSpy();
        var promise = $q.reject('fail');
        promise.then(fulfilledSpy, rejectedSpy);
        $rootScope.$apply();
        expect(fulfilledSpy).not.toHaveBeenCalled();
        expect(rejectedSpy).toHaveBeenCalledWith('fail');
    });
    it('can wrap a foreign promise', function () {
        var fulfilledSpy = jasmine.createSpy();
        var rejectedSpy = jasmine.createSpy();
        var promise = $q.when({
            then: function (handler) {
                $rootScope.$evalAsync(function () {
                    handler('ok');
                });
            }
        });
        promise.then(fulfilledSpy, rejectedSpy);
        $rootScope.$apply();
        expect(fulfilledSpy).toHaveBeenCalledWith('ok');
        expect(rejectedSpy).not.toHaveBeenCalled();
    });
    it('takes callbacks directly when wrapping', function () {
        var fulfilledSpy = jasmine.createSpy();
        var rejectedSpy = jasmine.createSpy();
        var progressSpy = jasmine.createSpy();
        var wrapped = $q.defer();
        $q.when(
            wrapped.promise,
            fulfilledSpy,
            rejectedSpy,
            progressSpy
        );
        wrapped.notify('working...');
        wrapped.resolve('ok');
        $rootScope.$apply();
        expect(fulfilledSpy).toHaveBeenCalledWith('ok');
        expect(rejectedSpy).not.toHaveBeenCalled();
        expect(progressSpy).toHaveBeenCalledWith('working...');
    });
    it('makes an immediately resolved promise with resolve', function () {
        var fulfilledSpy = jasmine.createSpy();
        var rejectedSpy = jasmine.createSpy();
        var promise = $q.resolve('ok');
        promise.then(fulfilledSpy, rejectedSpy);
        $rootScope.$apply();
        expect(fulfilledSpy).toHaveBeenCalledWith('ok');
        expect(rejectedSpy).not.toHaveBeenCalled();
    });

    describe('all', function () {
        it('can resolve an array of promises to array of results', function () {
            var promise = $q.all([$q.when(1), $q.when(2), $q.when(3)]);
            var fulfilledSpy = jasmine.createSpy();
            promise.then(fulfilledSpy);
            $rootScope.$apply();
            expect(fulfilledSpy).toHaveBeenCalledWith([1, 2, 3]);
        });
        it('can resolve an object of promises to an object of results', function () {
            var promise = $q.all({a: $q.when(1), b: $q.when(2)});
            var fulfilledSpy = jasmine.createSpy();
            promise.then(fulfilledSpy);
            $rootScope.$apply();
            expect(fulfilledSpy).toHaveBeenCalledWith({a: 1, b: 2});
        });
        it('resolves an empty array of promises immediately', function () {
            var promise = $q.all([]);
            var fulfilledSpy = jasmine.createSpy();
            promise.then(fulfilledSpy);
            $rootScope.$apply();
            expect(fulfilledSpy).toHaveBeenCalledWith([]);
        });
        it('resolves an empty object of promises immediately', function () {
            var promise = $q.all({});
            var fulfilledSpy = jasmine.createSpy();
            promise.then(fulfilledSpy);
            $rootScope.$apply();
            expect(fulfilledSpy).toHaveBeenCalledWith({});
        });
        it('rejects when any of the promises rejects', function () {
            var promise = $q.all([$q.when(1), $q.when(2), $q.reject('fail')]);
            var fulfilledSpy = jasmine.createSpy();
            var rejectedSpy = jasmine.createSpy();
            promise.then(fulfilledSpy, rejectedSpy);
            $rootScope.$apply();
            expect(fulfilledSpy).not.toHaveBeenCalled();
            expect(rejectedSpy).toHaveBeenCalledWith('fail');
        });
        it('wraps non-promises in the input collection', function () {
            var promise = $q.all([$q.when(1), 2, 3]);
            var fulfilledSpy = jasmine.createSpy();
            promise.then(fulfilledSpy);
            $rootScope.$apply();
            expect(fulfilledSpy).toHaveBeenCalledWith([1, 2, 3]);
        });
    });
    describe('ES6 style', function () {
        it('is a function', function () {
            expect($q instanceof Function).toBe(true);
        });
        it('expects a function as an argument', function () {
            expect($q).toThrow();
            $q(_.noop); // Just checking that this doesn't throw
        });
        it('returns a promise', function () {
            expect($q(_.noop)).toBeDefined();
            expect($q(_.noop).then).toBeDefined();
        });
        it('calls function with a resolve function', function () {
            var fulfilledSpy = jasmine.createSpy();
            $q(function (resolve) {
                resolve('ok');
            }).then(fulfilledSpy);
            $rootScope.$apply();
            expect(fulfilledSpy).toHaveBeenCalledWith('ok');
        });
        it('calls function with a reject function', function () {
            var fulfilledSpy = jasmine.createSpy();
            var rejectedSpy = jasmine.createSpy();
            $q(function (resolve, reject) {
                reject('fail');
            }).then(fulfilledSpy, rejectedSpy);
            $rootScope.$apply();
            expect(fulfilledSpy).not.toHaveBeenCalled();
            expect(rejectedSpy).toHaveBeenCalledWith('fail');
        });
    });
    describe('$$q', function() {

        it('uses deferreds that do not resolve at digest', function() {
            var d = $$q.defer();
            var fulfilledSpy = jasmine.createSpy();
            d.promise.then(fulfilledSpy);
            d.resolve('ok');
            $rootScope.$apply();
            expect(fulfilledSpy).not.toHaveBeenCalled();
        });
        it('uses deferreds that resolve later', function(done) {
            var d = $$q.defer();
            var fulfilledSpy = jasmine.createSpy();
            d.promise.then(fulfilledSpy);
            d.resolve('ok');
            setTimeout(()=>{
                expect(fulfilledSpy).toHaveBeenCalledWith('ok');
                done();
            });
        });
    });
});
