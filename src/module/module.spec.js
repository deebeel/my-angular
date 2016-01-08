'use strict';
import Core from './core';


describe('setupModuleLoader', ()=> {
    var core;
    beforeEach(()=> {
        core = new Core();
    });
    it('should be defined', ()=> {
        expect(core).toBeDefined();
    });
    it('exposes the core module function', function() {
        expect(core.module).toBeDefined();
    });
});
describe('modules', ()=>{
    var core;
    beforeEach(()=> {
        core = new Core();
    });
    it('allows registering a module', function() {
        var myModule = core.module('myModule', []);
        expect(myModule).toBeDefined();
        expect(myModule.name).toEqual('myModule');
    });
    it('replaces a module when registered with same name again', function() {
        var myModule = core.module('myModule', []);
        var myNewModule = core.module('myModule', []);
        expect(myNewModule).not.toBe(myModule);
    });

    it('attaches the requires array to the registered module', function() {
        var myModule = core.module('myModule', ['myOtherModule']);
        expect(myModule.requires).toEqual(['myOtherModule']);
    });

    it('allows getting a module', function() {
        var myModule = core.module('myModule', []);
        var gotModule = core.module('myModule');
        expect(gotModule).toBeDefined();
        expect(gotModule).toBe(myModule);
    });
    it('throws when trying to get a nonexistent module', function() {
        expect(function() {
            core.module('myModule');
        }).toThrow();
    });

    it('does not allow a module to be called hasOwnProperty', function() {
        expect(function() {
            core.module('hasOwnProperty', []);
        }).toThrow();
    });
});