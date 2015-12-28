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
                newVal && (scope.c = newVal);
            });

            scope.$watch(prop('a'), (newVal, oldVal, scope)=> {
                newVal && (scope.b = newVal);
            });
            scope.$digest();
            expect(scope.c).toBe(10);
            expect(scope.b).toBe(10);
            scope.a = 20;
            scope.$digest();
            expect(scope.b).toBe(20);
            expect(scope.c).toBe(20);
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
            expect(()=>scope.$digest()).toThrow();
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
        //
        //it('should call watchers added inside other watchers', ()=>{
        //    var watchFn = jasmine.createSpy();
        //
        //    scope.$watch(prop('a'),(newVal, oldVal, scope)=>{
        //        scope.$watch(prop('b'), watchFn)
        //    });
        //});
    });
});