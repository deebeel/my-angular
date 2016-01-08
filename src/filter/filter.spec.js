'use strict';
import $FilterProvider from './filter';

describe('filter', ()=> {
    var register, filter;
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
        filter = filterProvider.$get($injector);
        register = filterProvider.register.bind(filterProvider);
    });
    it('should register and obtain', ()=> {
        var f = ()=> {
        };
        var factory = ()=> f;
        register('name', factory);
        expect(filter('name')).toBe(f);
    });
    it('should allow registering multiple filters', ()=> {
        var f = ()=> {
        };
        var f2 = ()=> {
        };
        var factory1 = ()=> f;
        var factory2 = ()=> f2;
        register({
            name1: factory1,
            name2: factory2
        });
        expect(filter('name2')).toBe(f2);
        expect(filter('name1')).toBe(f);
    });
    it('should have filter "filter"', ()=>{
        expect(filter('filter')).toBeDefined();
    });
});