'use strict';
import Scope from './index';
import { prop, times, range } from 'ramda';

describe('scope', ()=> {
    it('should create an scope', ()=> {
        var scope = new Scope();
        scope.prop = 1;
        expect(scope.prop).toBe(1)
    });
    describe('digest', ()=> {
        var scope;
        beforeEach(()=>scope = new Scope());

        it('should call watchFn after digest was called', ()=> {
            var watchFn = Function.prototype;
            var listenerFn = jasmine.createSpy('watch fn call');

            scope.$watch(watchFn, listenerFn);
            scope.$digest();
            expect(listenerFn).toHaveBeenCalled();
        });
        it('should call watchFn with predefined scope', ()=> {
            var watchFn = jasmine.createSpy('watch fn scope arg');
            var listenerFn = Function.prototype;
            scope.$watch(watchFn, listenerFn);
            scope.$digest();

            expect(watchFn).toHaveBeenCalledWith(scope);
        });
        it('should call listener only if the watched value was changed', ()=> {
            var listenerFn = jasmine.createSpy('dirty');
            var watchFn = (scope)=>scope.prop;
            scope.$watch(watchFn, listenerFn);
            expect(listenerFn.calls.count()).toBe(0);
            scope.prop = 10;
            scope.$digest();
            expect(listenerFn.calls.count()).toBe(1);
            scope.prop = 10;
            scope.$digest();
            expect(listenerFn.calls.count()).toBe(1);
            scope.prop = 11;
            scope.$digest();
            expect(listenerFn.calls.count()).toBe(2);
        });
        it('should use firstly set new value as old one', ()=> {
            var listenerFn = jasmine.createSpy();
            var watchFn = (scope)=>scope.prop;
            scope.prop = 10;
            scope.$watch(watchFn, listenerFn);
            scope.$digest();
            expect(listenerFn).toHaveBeenCalledWith(10, 10, scope);
        });
        it('should correctly handle absence of listener function', ()=> {
            var watchFn = jasmine.createSpy();
            scope.$watch(watchFn);
            scope.$digest();
            expect(watchFn).toHaveBeenCalled();
        });

        it('should trigger chained watchers in the same digest', ()=> {
            scope.a = 10;

            scope.$watch(prop('b'), (newVal, oldVal, scope)=> {
                newVal && (scope.c = 1);
            });

            scope.$watch(prop('a'), (newVal, oldVal, scope)=> {
                newVal && (scope.b = 2);
            });
            scope.$digest();
            expect(scope.c).toBe(1);
            expect(scope.b).toBe(2);
            scope.a = 20;
            scope.$digest();
            expect(scope.b).toBe(2);
            expect(scope.c).toBe(1);
        });

        it('should have limited number of digest circles', ()=> {
            scope.countA = 0;
            scope.countB = 0;
            scope.$watch(prop('countA'), (newVal, oldVal, scope)=> {
                scope.countB++
            });
            scope.$watch(prop('countB'), (newVal, oldVal, scope)=> {
                scope.countA++
            });
            expect(scope.$digest.bind(scope)).toThrow();
        });

        it('should end $digest when last watcher is clean', ()=> {
            scope.data = range(100);
            var watchExecs = 0;
            times((n)=> {
                scope.$watch((scope)=> {
                    watchExecs++;
                    return scope.data[n];
                }, Function.prototype)
            }, 100);

            scope.$digest();
            expect(watchExecs).toBe(200);
            scope.data[0] = 400;
            scope.$digest();
            expect(watchExecs).toBe(301);
        });

        it('should call watchers added inside other watchers', ()=> {
            var watchFn = jasmine.createSpy();

            scope.$watch(prop('a'), (newVal, oldVal, scope)=> {
                scope.$watch(prop('b'), watchFn)
            });
            scope.$digest();
            expect(watchFn).toHaveBeenCalled();
        });

        it('should trigger listener when inner fields of object have been changed', ()=> {
            var listener = jasmine.createSpy();
            scope.data = [];
            scope.$watch(prop('data'), listener, true);
            scope.$digest();
            expect(listener.calls.count()).toBe(1);
            scope.data.push(1);
            scope.$digest();
            expect(listener.calls.count()).toBe(2);
        });

        it('should correctly handle NaN', ()=> {
            var listener = jasmine.createSpy();
            scope.a = +'dddddd';
            scope.$watch(prop('a'), listener);
            scope.$digest();
            expect(listener.calls.count()).toBe(1);
            scope.$digest();
            expect(listener.calls.count()).toBe(1);
        });

        it('should call $eval and return result', ()=> {
            scope.a = 10;
            var fn = scope=> scope.a;
            var res = scope.$eval(fn);
            expect(res).toBe(10);
        });

        it('should pass additional parameter to the function', ()=> {
            scope.a = 10;
            var fn = (scope, arg)=> scope.a + arg;
            var res = scope.$eval(fn, 2);
            expect(res).toBe(12);
        });


        it('should should run digest circle after $apply', ()=> {
            var listener = jasmine.createSpy();

            scope.$watch(prop('a'), listener);
            scope.$digest();
            expect(listener.calls.count()).toBe(1);
            scope.$apply(scope=>scope.a = 10);
            expect(listener.calls.count()).toBe(2);
        });

        it('should execute fn via $evalAsync in the same digest circle', ()=> {
            scope.asyncEvaluated = false;
            scope.$watch(prop('a'), (newVal, oldVal, scope)=> {
                scope.$evalAsync((scope)=> {
                    scope.asyncEvaluated = true;
                });
                scope.asyncEvaluatedImmideatly = scope.asyncEvaluated;
            });
            scope.$digest();
            expect(scope.asyncEvaluated).toBe(true);
            expect(scope.asyncEvaluatedImmideatly).toBe(false);
        });

        it('should evaluate $evalAsync function added in a watch function', ()=> {
            scope.a = 20;
            scope.$watch(scope=> {
                if (!scope.evaled) {
                    scope.$evalAsync(scope=> {
                        scope.evaled = true;
                    });
                }
                return scope.a;
            }, Function.prototype);
            scope.$digest();
            expect(scope.evaled).toBe(true);
        });
        it('should execute $evalAsync even not dirty', ()=> {
            scope.a = 20;
            scope.count = 0;
            scope.$watch(scope=> {
                if (scope.count < 2) {
                    scope.$evalAsync(scope=> {
                        scope.count++;
                    });
                }
                return scope.a;
            }, Function.prototype);
            scope.$digest();
            expect(scope.count).toBe(2);
        });

        it('should stop call $digest when ttl is reached', ()=> {
            scope.a = 20;
            scope.$watch(scope=> {
                scope.$evalAsync(scope=> {
                });
                return scope.a;
            }, Function.prototype);
            expect(scope.$digest.bind(scope)).toThrow();
        });

        it('should change $$phase on different steps', ()=> {
            var inApply, inDigest, inWatch;
            scope.$watch((scope)=> {
                inWatch = scope.$$phase;
                return scope.a;
            }, (newVal, oldVal, scope)=> {
                inDigest = scope.$$phase;
            });

            scope.$apply(scope=> {
                inApply = scope.$$phase;
            });
            expect(inApply).toBe('$apply');
            expect(inDigest).toBe('$digest');
            expect(inWatch).toBe('$digest');
        });

        it('should schedule a $digest circle in $evalAsync', (done)=> {
            var listener = jasmine.createSpy();

            scope.$watch(prop('a'), listener);
            scope.$evalAsync((scope)=> {
            });

            expect(listener.calls.count()).toBe(0);
            setTimeout(()=> {
                expect(listener.calls.count()).toBe(1);
                done();
            })
        });

        it('should allow $apply with $applyAsync', (done)=> {
            var listener = jasmine.createSpy();
            scope.$watch(prop('a'), listener);
            scope.$digest();
            expect(listener.calls.count()).toBe(1);
            scope.$applyAsync(scope=> {
                scope.a = 20;
            });
            expect(listener.calls.count()).toBe(1);
            setTimeout(()=> {
                expect(listener.calls.count()).toBe(2);
                expect(scope.a).toBe(20);
                done()
            }, 50);
        });

        it('should execute $applyAsync in another $digest circle', (done)=> {
            var val = false;
            scope.$watch(prop('a'), (newVal, oldVal, scope)=> {
                scope.$applyAsync(()=> {
                    val = true;
                });
            });

            scope.$digest();
            expect(val).toBe(false);
            setTimeout(()=> {
                expect(val).toBe(true);
                done();
            });
        });
        it('should coalesce $digest circles', (done)=> {
            scope.counter = 0;
            var watchFn = scope=> {
                scope.counter++;
                return scope.a;
            };
            scope.$watch(watchFn, Function.prototype);
            scope.$applyAsync(scope=> {
                scope.a = 20;
            });
            scope.$applyAsync(scope=> {
                scope.a = 30;
            });
            setTimeout(()=> {
                expect(scope.counter).toBe(2);
                done()
            }, 50)
        });

        it('should cancel $applyAsync iteration if $digest called', (done)=> {
            scope.count = 0;
            scope.$watch(scope=> {
                scope.count++;
                return scope.a;
            }, Function.prototype);

            scope.$applyAsync(scope=> {
                scope.a = 10;
            });

            scope.$applyAsync(scope=> {
                scope.a = 20;
            });

            scope.$digest();
            expect(scope.a).toBe(20);
            expect(scope.count).toBe(2);
            setTimeout(()=> {
                expect(scope.count).toBe(2);
                done();
            });
        });

        it('should call $$postDigest after each $digest circle', ()=> {
            var postDigest = jasmine.createSpy();
            scope.$watch(Function.prototype);
            scope.$$postDigest(postDigest);

            expect(postDigest.calls.count()).toBe(0);
            scope.$digest();
            expect(postDigest.calls.count()).toBe(1);
            scope.$digest();
            expect(postDigest.calls.count()).toBe(1);
        });
        it('should not include $$postDigest changes into $digest circle', ()=> {
            scope.a = 10;
            scope.$$postDigest(()=> {
                scope.a = 20;
            });
            scope.$watch(prop('a'), (newVal, oldVal, scope)=> {
                scope.dg = newVal;
            });

            scope.$digest();
            expect(scope.a).toBe(20);
            expect(scope.dg).toBe(10);

            scope.$digest();
            expect(scope.dg).toBe(20);
        });

        it('should catch exception inside a watch function and keep going', ()=> {
            var watchFn = jasmine.createSpy().and.throwError('watcher');
            var listener = jasmine.createSpy();
            scope.$watch(watchFn);
            scope.$watch(prop('a'), listener);
            scope.$digest();
            expect(listener.calls.count()).toBe(1);
        });

        it('should catch exception inside listener and keep going', ()=> {
            var listenerThrowable = jasmine.createSpy().and.throwError('listener');
            var listener = jasmine.createSpy();
            scope.$watch(prop('a'), listenerThrowable);
            scope.$watch(prop('a'), listener);
            scope.$digest();
            expect(listener.calls.count()).toBe(1);
        });

        it('should catch exception in $evalAsync', (done)=> {
            var throwable = jasmine.createSpy().and.throwError('$evalAsync');
            var listener = jasmine.createSpy();
            scope.$watch(prop('a'), listener);
            scope.$evalAsync(throwable);
            setTimeout(()=> {
                expect(listener.calls.count()).toBe(1);
                done();
            });
        });

        it('should catch exception in $applyAsync', (done)=> {
            var throwable = jasmine.createSpy().and.throwError('$applyAsync');
            var asyncExpr = jasmine.createSpy();
            scope.$applyAsync(throwable);
            scope.$applyAsync(throwable);
            scope.$applyAsync(asyncExpr);
            setTimeout(()=> {
                expect(throwable.calls.count()).toBe(2);
                expect(asyncExpr.calls.count()).toBe(1);
                done();
            });
        });

        it('should catch exception in $$postDigest', ()=> {
            var throwable = jasmine.createSpy().and.throwError('$$postDigest');

            scope.$$postDigest(throwable);
            scope.$$postDigest(()=> {
                scope.a = 20;
            });
            scope.$digest();

            expect(throwable.calls.count()).toBe(1);
            expect(scope.a).toBe(20);
        });
        it('should not call listener when watcher was destroyed', ()=> {
            var listener = jasmine.createSpy();
            var disableWatcher = scope.$watch(prop('a'), listener);
            scope.$digest();
            expect(listener.calls.count()).toBe(1);
            disableWatcher();
            scope.a = 20;
            scope.$digest();
            expect(listener.calls.count()).toBe(1);
        });

        it('should allow watcher to destroy itself from $digest', ()=> {
            var callSequence = [];
            scope.$watch((scope)=> {
                callSequence.push('first');
                return scope.a;
            }, Function.prototype);

            var disableWatcher = scope.$watch(()=> {
                callSequence.push('second');
                disableWatcher();
            }, Function.prototype);
            scope.$watch(()=> {
                callSequence.push('third');
                return scope.a;
            }, Function.prototype);

            scope.$digest();

            expect(callSequence).toEqual(['first', 'second', 'third', 'first', 'third']);
        });

        it('should allow a watcher delete another watcher from $digest', ()=> {
            var listener = jasmine.createSpy();
            scope.a = 10;
            scope.$watch(prop('a'), ()=> {
                destroyWatch();
            });
            var destroyWatch = scope.$watch(Function.prototype, Function.prototype);
            scope.$watch(prop('a'), listener);
            scope.$digest();
            expect(listener.calls.count()).toBe(1);
        });
        it('should allow destroying several watcher during $digest', ()=> {
            var listener = jasmine.createSpy();
            var w1 = scope.$watch(()=> {
                w1();
                w2();
            });

            var w2 = scope.$watch(prop('a'), listener);
            scope.$digest();
            expect(listener.calls.count()).toBe(0);

        });
    });

    describe('$watchGroup', ()=> {
        var scope;
        beforeEach(()=> {
            scope = new Scope();
        });

        it('should take watches as an array and call the listener with the array of values watched', ()=> {
            var listener = jasmine.createSpy();

            scope.a = 10;
            scope.b = 20;

            scope.$watchGroup([
                prop('a'),
                prop('b')
            ], listener);

            scope.$digest();
            expect(listener).toHaveBeenCalledWith([10, 20], jasmine.anything(), scope);
        });
        it('should call a listener for $watchGroup only once', ()=> {
            var listener = jasmine.createSpy();

            scope.a = 10;
            scope.b = 20;

            scope.$watchGroup([
                prop('a'),
                prop('b')
            ], listener);

            scope.$digest();
            expect(listener.calls.count()).toBe(1);
        });

        it('should use the same array for old and new values at first call', ()=> {
            var oldVals, newVals;
            scope.a = 10;
            scope.b = 20;
            scope.$watchGroup([
                scope=>scope.a,
                scope=>scope.b
            ], (nv, ov)=> {
                newVals = nv;
                oldVals = ov;
            });
            scope.$digest();
            expect(newVals).toBe(oldVals);
        });

        it('should use different arrays for old and new values for subsequent calls', ()=> {
            var oldVals, newVals;
            scope.a = 10;
            scope.b = 20;
            scope.$watchGroup([
                scope=>scope.a,
                scope=>scope.b
            ], (nv, ov)=> {
                newVals = nv;
                oldVals = ov;
            });
            scope.$digest();
            scope.a = 30;
            scope.$digest();
            expect(newVals).not.toBe(oldVals);
            expect(newVals).toEqual([30, 20]);
        });

        it('should call only once if array of watchers is empty', ()=> {
            var listener = jasmine.createSpy();

            scope.$watchGroup([], listener);
            scope.$digest();
            scope.$digest();

            expect(listener).toHaveBeenCalledWith([], [], scope);
            expect(listener.calls.count()).toBe(1);
        });

        it('should be able deregistered', ()=> {
            var listener = jasmine.createSpy();
            var dg = scope.$watchGroup([
                scope=>scope.a,
                scope=>scope.b
            ], listener);

            scope.$digest();
            dg();
            scope.$digest();

            expect(listener.calls.count()).toBe(1);
        });
        it('should not call listener function for zero-length watchers group, if deregistered first', ()=> {
            var listener = jasmine.createSpy();
            var dg = scope.$watchGroup([], listener);
            dg();
            scope.$digest();
            expect(listener.calls.count()).toBe(0);
        });
    });
    describe('inheritance', ()=> {
        var parent;
        var child;
        var spy;
        var watcher;
        beforeEach(()=> {
            parent = new Scope();
            child = parent.$new();
            spy = jasmine.createSpy();
            watcher = jasmine.createSpy();
        });
        it('should inherit parent scope', ()=> {
            parent.a = 20;
            expect(child.a).toBe(20);
        });
        it('should not inherit fields from child', ()=> {
            child.a = 20;
            expect(parent.a).toBeUndefined();
        });
        it('should be able to manipulate parent scope properties', ()=> {
            parent.a = [];
            child.a.push(1);
            expect(child.a).toEqual([1]);
            expect(parent.a).toEqual([1]);
        });

        it('should be able to watch parent properties', ()=> {
            parent.a = [];
            child.$watch(scope=>scope.a, spy, true);
            child.$digest();
            expect(spy.calls.count()).toBe(1);
            parent.a.push(1);
            child.$digest();
            expect(spy.calls.count()).toBe(2);
        });
        it('should be nested at any depth', ()=> {
            var a = new Scope();
            var aa = a.$new();
            var aaa = aa.$new();
            var aaaa = aaa.$new();
            a.v = 10;
            expect(a.v).toBe(10);
            expect(aa.v).toBe(10);
            expect(aaa.v).toBe(10);
            expect(aaaa.v).toBe(10);
            aaa.b = 10;

            expect(a.b).toBeUndefined();
            expect(aa.b).toBeUndefined();
            expect(aaa.b).toBe(10);
            expect(aaaa.b).toBe(10);
        });

        it('should shadow parent`s field', ()=> {
            parent.a = 10;
            child.a = 20;
            expect(parent.a).toBe(10);
            expect(child.a).toBe(20);
        });

        it('should not shadow members of parent`s scope attribute', ()=> {
            parent.user = {name: 'a'};
            child.user.name = 'b';
            expect(parent.user.name).toBe('b');
            expect(child.user.name).toBe('b');
        });

        it('should not digest its parents', ()=> {
            parent.$watch(prop('a'), spy);
            child.$digest();
            expect(spy.calls.count()).toBe(0);
        });

        it('should keep child scopes inside $$children field', ()=> {
            var child2 = child.$new();
            expect(parent.$$children[0]).toBe(child);
            expect(child.$$children[0]).toBe(child2);
            expect(child2.$$children).toEqual([]);
        });

        it('should digest its children', ()=> {
            child.a = 10;
            child.$watch(prop('a'), spy);
            parent.$digest();
            expect(spy).toHaveBeenCalled();
        });
        it('should $digest from root if $apply', ()=> {
            parent.$watch(prop('a'), spy);
            child.$apply();
            expect(spy).toHaveBeenCalled();
        });
        it('should schedule $digest at root scope after $evalAsync', (done)=> {
            parent.$watch(prop('a'), spy);
            child.$evalAsync(Function.prototype);
            setTimeout(()=> {
                expect(spy).toHaveBeenCalled();
                done();
            });
        });

        it('should not have access to parent scope when isolated', ()=> {
            child = parent.$new(true);
            parent.a = 10;
            expect(child.a).toBeUndefined();
        });

        it('should $digest children when isolated', ()=> {
            child = parent.$new(true);
            child.$watch(prop('a'), spy);
            parent.$digest();
            expect(spy).toHaveBeenCalled();
        });
        it('should digest from root on $apply when isolated', ()=> {
            child = parent.$new(true);
            parent.$watch(prop('a'), spy);
            child.$apply();
            expect(spy).toHaveBeenCalled();
        });
        it('should digest from root on $evalAsync when isolated', (done)=> {
            child = parent.$new(true);
            parent.$watch(prop('a'), spy);
            child.$evalAsync(Function.prototype);
            setTimeout(()=> {
                expect(spy).toHaveBeenCalled();
                done();
            });
        });

        it('should call $evalAsync on isolated scope', (done)=> {
            child = parent.$new(true);
            child.$evalAsync(spy);
            setTimeout(()=> {
                expect(spy).toHaveBeenCalled();
                done();
            });
        });

        it('should call $$postDigest on isolated scope', ()=> {
            child = parent.$new(true);
            child.$$postDigest(spy);
            parent.$digest();
            expect(spy).toHaveBeenCalled();
        });

        it('should call $applyAsync on isolated scope', (done)=> {
            child = parent.$new(true);
            child.$applyAsync(spy);
            setTimeout(()=> {
                expect(spy).toHaveBeenCalledWith(child);
                done();
            });
        });
    });
    describe('hierarchical inheritance', ()=> {

        it('should take another scope as parent', ()=> {
            var spy = jasmine.createSpy();
            var prototypeParent = new Scope();
            var hierarchyParent = new Scope();
            var child = prototypeParent.$new(false, hierarchyParent);

            prototypeParent.a = 10;
            expect(child.a).toBe(10);
            child.counter = 0;
            child.$watch(spy);

            prototypeParent.$digest();
            expect(spy.calls.count()).toBe(0);
            hierarchyParent.$digest();
            expect(spy.calls.count()).toBe(1);
        });
    });
    describe('$destroy', ()=> {
        it('should not digest if destroyed', ()=> {
            var spy = jasmine.createSpy();
            var parent = new Scope();
            var child = parent.$new();
            child.$watch(prop('a'), spy);
            parent.$digest();
            expect(spy.calls.count()).toBe(1);
            child.a = 20;
            child.$destroy();
            parent.$digest();
            expect(spy.calls.count()).toBe(1);
        });
    });

    describe('$watchCollection', ()=> {
        var scope;
        var spy;
        beforeEach(()=> {
            scope = new Scope();
            spy = jasmine.createSpy();
        });
        it('should use general $watch if non object or array watched', ()=> {
            scope.$watchCollection(prop('a'), spy);
            scope.$digest();
            expect(spy.calls.count()).toBe(1);

            scope.a = 20;
            scope.$digest();
            expect(spy.calls.count()).toBe(2);

            scope.$digest();
            expect(spy.calls.count()).toBe(2);

        });
        it('should work correctly for NaN', ()=> {
            scope.a = 0 / 0;
            scope.$watchCollection(prop('a'), spy);
            scope.$digest();
            expect(spy.calls.count()).toBe(1);

            scope.$digest();
            expect(spy.calls.count()).toBe(1);
        });

        it('should notice when value becomes an array', ()=> {
            scope.$watchCollection(prop('a'), spy);
            scope.$digest();
            expect(spy.calls.count()).toBe(1);
            scope.a = [1, 2, 3];
            scope.$digest();
            expect(spy.calls.count()).toBe(2);
            scope.$digest();
            expect(spy.calls.count()).toBe(2);
        });
        it('should notice elem added into an array', ()=> {
            scope.a = [];
            scope.$watchCollection(prop('a'), spy);
            scope.$digest();
            expect(spy.calls.count()).toBe(1);
            scope.a.push(1);
            scope.$digest();
            expect(spy.calls.count()).toBe(2);
            scope.$digest();
            expect(spy.calls.count()).toBe(2);
        });

        it('should notice an element removed from an array', ()=> {
            scope.a = [1];
            scope.$watchCollection(prop('a'), spy);
            scope.$digest();
            expect(spy.calls.count()).toBe(1);
            scope.a.shift();
            scope.$digest();
            expect(spy.calls.count()).toBe(2);
            scope.$digest();
            expect(spy.calls.count()).toBe(2);
        });

        it('should notice an item replace in an array', ()=> {
            scope.a = [1, 2, 3];
            scope.$watchCollection(prop('a'), spy);
            scope.$digest();
            expect(spy.calls.count()).toBe(1);
            scope.a[0] = 10;
            scope.$digest();
            expect(spy.calls.count()).toBe(2);
            scope.$digest();
            expect(spy.calls.count()).toBe(2);
        });

        it('should notice items reordered in an array', ()=> {
            scope.a = [3, 2, 5, 3];
            scope.$watchCollection(prop('a'), spy);
            scope.$digest();
            expect(spy.calls.count()).toBe(1);
            scope.a.sort();
            scope.$digest();
            expect(spy.calls.count()).toBe(2);
            scope.$digest();
            expect(spy.calls.count()).toBe(2);
        });
        it('should correctly handle NaNs in arrays', ()=> {
            scope.a = [3, NaN, 5, 3];
            scope.$watchCollection(prop('a'), spy);
            scope.$digest();
            expect(spy.calls.count()).toBe(1);
        });

        it('should notice an item replaced in an arguments object', ()=> {
            (function () {
                scope.a = arguments;
            })(1, 2, 3, 4);
            scope.$watchCollection(prop('a'), spy);
            scope.$digest();
            expect(spy.calls.count()).toBe(1);
            scope.a[0] = 10;
            scope.$digest();
            expect(spy.calls.count()).toBe(2);
            scope.$digest();
            expect(spy.calls.count()).toBe(2);
        });
        it('should notice an item replaced in an NodeList object', ()=> {
            document.documentElement.appendChild(document.createElement('div'));
            scope.a = document.getElementsByTagName('div');
            scope.$watchCollection(prop('a'), spy);
            scope.$digest();
            expect(spy.calls.count()).toBe(1);
            document.documentElement.appendChild(document.createElement('div'));
            scope.$digest();
            expect(spy.calls.count()).toBe(2);
            scope.$digest();
            expect(spy.calls.count()).toBe(2);
        });

        it('should notice when the value becomes an object', ()=> {
            scope.$watchCollection(prop('a'), spy);
            scope.$digest();
            expect(spy.calls.count()).toBe(1);
            scope.a = {};
            scope.$digest();
            expect(spy.calls.count()).toBe(2);
            scope.$digest();
            expect(spy.calls.count()).toBe(2);
        });

        it('should notice an attribute added to an object', ()=> {
            scope.a = {};
            scope.$watchCollection(prop('a'), spy);
            scope.$digest();
            expect(spy.calls.count()).toBe(1);

            scope.a.b = 10;
            scope.$digest();
            expect(spy.calls.count()).toBe(2);

            scope.$digest();
            expect(spy.calls.count()).toBe(2);

        });

        it('should notice an attribute changed in an object', ()=> {
            scope.a = {b: 20};
            scope.$watchCollection(prop('a'), spy);
            scope.$digest();
            expect(spy.calls.count()).toBe(1);

            scope.a.b = 10;
            scope.$digest();
            expect(spy.calls.count()).toBe(2);

            scope.$digest();
            expect(spy.calls.count()).toBe(2);

        });
        it('should correctly handle NaN inside an object', ()=> {
            scope.a = {b: 20, c: NaN};
            scope.$watchCollection(prop('a'), spy);
            scope.$digest();
            expect(spy.calls.count()).toBe(1);

            scope.a.b = 10;
            scope.$digest();
            expect(spy.calls.count()).toBe(2);

            scope.$digest();
            expect(spy.calls.count()).toBe(2);
        });
        it('should notice an attribute removed from an object', ()=> {
            scope.a = {b: 20, c: 40};
            scope.$watchCollection(prop('a'), spy);
            scope.$digest();
            expect(spy.calls.count()).toBe(1);

            delete scope.a.c;
            scope.$digest();
            expect(spy.calls.count()).toBe(2);

            scope.$digest();
            expect(spy.calls.count()).toBe(2);
        });
        it('should not consider any object with a length attribute to be an array', ()=> {
            scope.a = {b: 20, length: 50};
            scope.$watchCollection(prop('a'), spy);
            scope.$digest();
            expect(spy.calls.count()).toBe(1);
            scope.a.c = 10;
            scope.$digest();
            expect(spy.calls.count()).toBe(2);

            scope.$digest();
            expect(spy.calls.count()).toBe(2);
        });

        it('should give the old non-collection value to listeners', ()=> {
            scope.a = 40;
            var oldValue;
            scope.$watchCollection(prop('a'), (n, o)=> {
                oldValue = o;
            });
            scope.$digest();
            scope.a = 50;
            scope.$digest();
            expect(oldValue).toBe(40);
        });

        it('should give the old array value to listeners', ()=> {
            scope.a = [40];
            var oldValue;
            scope.$watchCollection(prop('a'), (n, o)=> {
                oldValue = o;
            });
            scope.$digest();
            scope.a.push(50);
            scope.$digest();
            expect(oldValue).toEqual([40]);
        });

        it('should give the old array value to listeners', ()=> {
            scope.a = {b: 40};
            var oldValue;
            scope.$watchCollection(prop('a'), (n, o)=> {
                oldValue = o;
            });
            scope.$digest();
            scope.a.c = 50;
            scope.$digest();
            expect(oldValue).toEqual({b: 40});
        });

        it('should new values as old in the first call', ()=> {
            scope.a = {b: 40};
            var oldValue;
            scope.$watchCollection(prop('a'), (n, o)=> {
                oldValue = o;
            });
            scope.$digest();
            expect(oldValue).toBe(scope.a);
        });
    });


    describe('events', ()=> {
        var parent, scope, child, isolatedChild,
            listener1, listener2, listener3;
        beforeEach(()=> {
            parent = new Scope();
            scope = parent.$new();
            child = scope.$new();
            isolatedChild = scope.$new(true);
            listener1 = jasmine.createSpy();
            listener2 = jasmine.createSpy();
            listener3 = jasmine.createSpy();
        });
        it('should allow registering listeners', ()=> {
            scope.$on('event', listener1);
            scope.$on('event', listener2);
            scope.$on('event2', listener3);
            expect(scope.$$listeners).toEqual({
                event: [listener1, listener2],
                event2: [listener3]
            });
        });
        it('should not share the same $$listeners for different scopes', ()=> {
            scope.$on('event', listener1);
            child.$on('event', listener2);
            parent.$on('event3', listener3);
            isolatedChild.$on('event4', listener1);
            expect(isolatedChild.$$listeners).toEqual({
                event4: [listener1]
            });
            expect(scope.$$listeners).toEqual({
                event: [listener1]
            });

            expect(child.$$listeners).toEqual({
                event: [listener2]
            });
            expect(parent.$$listeners).toEqual({
                event3: [listener3]
            });
        });
        ['$emit', '$broadcast'].forEach(method=> {
            it(`should call the listener of the matching event on ${method}`, ()=> {
                scope.$on('event', listener1);
                scope.$on('event2', listener2);
                scope[method]('event');

                expect(listener1).toHaveBeenCalled();
                expect(listener2).not.toHaveBeenCalled();
            });
        });
        ['$emit', '$broadcast'].forEach(method=> {
            it(`should call the listener of the matching event on ${method} with an event object`, ()=> {
                scope.$on('event', listener1);
                scope[method]('event');

                expect(listener1).toHaveBeenCalled();
                expect(listener1.calls.mostRecent().args[0].name).toBe('event');
            });
        });
        ['$emit', '$broadcast'].forEach(method=> {
            it(`should pass the same event object on ${method} for all listeners`, ()=> {
                scope.$on('event', listener1);
                scope.$on('event', listener2);
                scope[method]('event');

                expect(listener1).toHaveBeenCalled();
                expect(listener2).toHaveBeenCalled();
                var event1 = listener1.calls.mostRecent().args[0];
                var event2 = listener2.calls.mostRecent().args[0];
                expect(event1).toBe(event2);
            });
        });
        ['$emit', '$broadcast'].forEach(method=> {
            it(`should pass additional arguments on ${method} to the listener`, ()=> {
                var eventName = 'event';
                scope.$on(eventName, listener1);
                scope[method](eventName, 'arg1', ['arg2'], 'arg3');

                expect(listener1).toHaveBeenCalledWith(
                    jasmine.anything(),
                    'arg1',
                    ['arg2'],
                    'arg3'
                );
            });
        });
        ['$emit', '$broadcast'].forEach(method=> {
            it(`should return an event object on ${method}`, ()=> {
                var eventObj = scope[method]('event');

                expect(eventObj.name).toBe('event');
            });
        });
        ['$emit', '$broadcast'].forEach(method=> {
            it(`should be able to deregister listener for ${method}`, ()=> {
                var dereg = scope.$on('event', listener1);
                scope[method]('event');
                expect(listener1.calls.count()).toBe(1);
                dereg();
                scope[method]('event');
                expect(listener1.calls.count()).toBe(1);
            });
        });
        ['$emit', '$broadcast'].forEach(method=> {
            it(`should not skip the next listener when removed on ${method}`, ()=> {
                var dereg;
                var listener = ()=> {
                    dereg();
                };
                dereg = scope.$on('event', listener);
                scope.$on('event', listener1);
                scope[method]('event');
                expect(listener1).toHaveBeenCalled();
            });
        });


        it('should propagate event up the scope on $emit', ()=> {
            parent.$on('event', listener1);
            scope.$on('event', listener2);
            scope.$emit('event');
            expect(listener1).toHaveBeenCalled();
            expect(listener2).toHaveBeenCalled();
        });


        it('should propagate the same event object up the scope on $emit', ()=> {
            parent.$on('event', listener1);
            scope.$on('event', listener2);
            scope.$emit('event');
            var event1 = listener1.calls.mostRecent().args[0];
            var event2 = listener2.calls.mostRecent().args[0];
            expect(event1).toBe(event2);
        });


        it('should propagate event down the scope on $broadcast', ()=> {
            parent.$on('event', listener1);
            scope.$on('event', listener2);
            isolatedChild.$on('event', listener3);
            parent.$broadcast('event');
            expect(listener1).toHaveBeenCalled();
            expect(listener2).toHaveBeenCalled();
            expect(listener3).toHaveBeenCalled();
        });


        it('should propagate the same event object down the scope on $broadcast', ()=> {
            parent.$on('event', listener1);
            scope.$on('event', listener2);
            isolatedChild.$on('event', listener3);
            parent.$broadcast('event');
            var event1 = listener1.calls.mostRecent().args[0];
            var event2 = listener2.calls.mostRecent().args[0];
            var event3 = listener3.calls.mostRecent().args[0];
            expect(event1).toBe(event2);
            expect(event2).toBe(event3);

        });

        it('should attach the target scope on $emit', ()=> {
            parent.$on('event', listener1);
            scope.$on('event', listener2);
            scope.$emit('event');
            expect(listener1.calls.mostRecent().args[0].targetScope).toBe(scope);
            expect(listener2.calls.mostRecent().args[0].targetScope).toBe(scope);
        });


        it('should attach the target scope on $broadcast', ()=> {
            parent.$on('event', listener1);
            scope.$on('event', listener2);
            parent.$broadcast('event');
            expect(listener1.calls.mostRecent().args[0].targetScope).toBe(parent);
            expect(listener2.calls.mostRecent().args[0].targetScope).toBe(parent);
        });


        ['$emit', '$broadcast'].forEach(method=> {
            it(`should attach the current scope on ${method}`, ()=> {
                listener1 = event=> {
                    expect(event.currentScope).toBe(parent);
                };
                listener2 = event=> {
                    expect(event.currentScope).toBe(scope);
                };
                parent.$on('event', listener1);
                scope.$on('event', listener2);
                (method === '$emit' ? scope : parent)[method]('event');
            });
        });


        ['$emit', '$broadcast'].forEach(method=> {
            it(`should set the current scope on null after ${method} propagation`, ()=> {
                var event;
                listener1 = e=> event = e;
                parent.$on('event', listener1);
                scope.$on('event', listener2);
                (method === '$emit' ? scope : parent)[method]('event');
                expect(event.currentScope).toBe(null);
            });
        });

        it(`should keep on propagating event to children when stopPropagation is called on $broadcast`, ()=> {
            listener1 = event=> event.stopPropagation();
            parent.$on('event', listener1);
            scope.$on('event', listener2);
            parent.$broadcast('event');
            expect(listener2).toHaveBeenCalled();
        });


        it(`should stop propagation to parent when stopPropagation is called on $emit`, ()=> {
            listener1 = event=> event.stopPropagation();
            scope.$on('event', listener1);
            parent.$on('event', listener2);
            scope.$emit('event');
            expect(listener2).not.toHaveBeenCalled();
        });


        it(`should call all listeners on current scope when stopPropagation is called on $emit`, ()=> {
            listener1 = event=> event.stopPropagation();
            scope.$on('event', listener1);
            scope.$on('event', listener2);
            scope.$emit('event');
            expect(listener2).toHaveBeenCalled();
        });

        ['$emit', '$broadcast'].forEach(method=> {
            it(`should set defaultPrevented to true when .preventDefault called on ${method}`, ()=> {
                listener1 = event=> event.preventDefault();
                scope.$on('event', listener1);
                var event = scope.$emit('event');
                expect(event.defaultPrevented).toBe(true);
            });
        });


        it('should fire $destroy event when $destroy called', ()=> {
            scope.$on('$destroy', listener1);
            scope.$destroy();
            expect(listener1).toHaveBeenCalled();
        });

        it('should fire $destroy event on children when $destroy called', ()=> {
            child.$on('$destroy', listener1);
            scope.$destroy();
            expect(listener1).toHaveBeenCalled();
        });

        ['$emit', '$broadcast'].forEach(method=> {
            it(`should not stop calling listeners when exception occurred on ${method}`, ()=> {
                listener1 = listener1.and.throwError(`event listener error on ${method}`);
                scope.$on('event', listener1);
                scope.$on('event', listener2);
                scope[method]('event');
                expect(listener1).toHaveBeenCalled();
                expect(listener2).toHaveBeenCalled();
            });
        });
    });
});