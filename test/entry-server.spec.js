import { isEqual } from 'lodash';

import { useRouteVuexModulesServer, useFetchDataServer } from '../src/entry-server';

describe('entry-server utils', () => {
    const logger = { info: () => {} };

    describe('useRouteVuexModulesServer', () => {

        it('should register route-level vuex modules', () => {
            const testModule = {
                namespaced: true,
                state: {
                    count: 1,
                },
            };
            const router = {
                currentRoute: {
                    value: {
                        matched: [{
                            components: [{
                                vuex: {
                                    moduleName: 'test',
                                    module: testModule,
                                },
                            }],
                        }],
                    },
                },
            };
            const store = {
                hasModule: () => false,
                registerModule: jest.fn(),
            };
            useRouteVuexModulesServer(router, store, logger);
            expect(store.registerModule).toHaveBeenCalledWith(['test'], testModule, {
                preserveState: false,
            });
        });

        it('should ignore modules which do not specify a vuex key', () => {
            const router = {
                currentRoute: {
                    value: {
                        matched: [{
                            components: [{
                                name: '1',
                            }, {
                                name: '1',
                            }],
                        }],
                    },
                },
            };
            const store = {
                hasModule: jest.fn(),
                registerModule: jest.fn(),
            };
            useRouteVuexModulesServer(router, store, logger);
            expect(store.hasModule).not.toHaveBeenCalled();
            expect(store.registerModule).not.toHaveBeenCalled();
        });

        it('should handle nested routes', () => {
            const testModule1 = {
                namespaced: true,
                state: {
                    count: 1,
                },
            };
            const testModule2 = {
                namespaced: true,
                state: {
                    count: 2,
                },
            };
            const router = {
                currentRoute: {
                    value: {
                        matched: [{
                            components: [{
                                vuex: {
                                    moduleName: 'test1',
                                    module: testModule1,
                                },
                            }, {
                                // No vuex module on this component
                            }, {
                                vuex: {
                                    moduleName: 'test2',
                                    module: testModule2,
                                },
                            }],
                        }],
                    },
                },
            };
            const store = {
                hasModule: () => false,
                registerModule: jest.fn(),
            };
            useRouteVuexModulesServer(router, store, logger);
            expect(store.registerModule).toHaveBeenCalledWith(['test1'], testModule1, {
                preserveState: false,
            });
            expect(store.registerModule).toHaveBeenCalledWith(['test2'], testModule2, {
                preserveState: false,
            });
        });

        it('should preserve state if it already exists', () => {
            const testModule = {
                namespaced: true,
                state: {
                    count: 1,
                },
            };
            const router = {
                currentRoute: {
                    value: {
                        matched: [{
                            components: [{
                                vuex: {
                                    moduleName: 'test',
                                    module: testModule,
                                },
                            }],
                        }],
                    },
                },
            };
            const store = {
                hasModule: () => false,
                registerModule: jest.fn(),
                state: {
                    test: {
                        count: 2,
                    },
                },
            };
            useRouteVuexModulesServer(router, store, logger);
            expect(store.registerModule).toHaveBeenCalledWith(['test'], testModule, {
                preserveState: true,
            });
        });

        it('should not re-register modules that are already registered', () => {
            const testModule = {
                namespaced: true,
                state: {
                    count: 1,
                },
            };
            const router = {
                currentRoute: {
                    value: {
                        matched: [{
                            components: [{
                                vuex: {
                                    moduleName: 'test',
                                    module: testModule,
                                },
                            }],
                        }],
                    },
                },
            };
            const store = {
                hasModule: () => jest.fn(name => isEqual(name, ['test'])),
                registerModule: jest.fn(),
                state: {
                    test: {
                        count: 2,
                    },
                },
            };
            useRouteVuexModulesServer(router, store, logger);
            expect(store.registerModule).not.toHaveBeenCalled();
        });

        it('should support function to specify module name', () => {
            const testModule = {
                namespaced: true,
                state: {
                    count: 1,
                },
            };
            const router = {
                currentRoute: {
                    value: {
                        params: {
                            slug: 'foo',
                        },
                        matched: [{
                            components: [{
                                vuex: {
                                    moduleName: ({ $route }) => `test-${$route.params.slug}`,
                                    module: testModule,
                                },
                            }],
                        }],
                    },
                },
            };
            const store = {
                hasModule: () => false,
                registerModule: jest.fn(),
            };
            useRouteVuexModulesServer(router, store, logger);
            expect(store.registerModule).toHaveBeenCalledWith(['test-foo'], testModule, {
                preserveState: false,
            });
        });

        it('should support nested modules', () => {
            const testModule = {
                namespaced: true,
                state: {
                    count: 1,
                },
            };
            const router = {
                currentRoute: {
                    value: {
                        params: {
                            slug: 'foo',
                        },
                        matched: [{
                            components: [{
                                vuex: {
                                    moduleName: 'foo/bar/baz',
                                    module: testModule,
                                },
                            }],
                        }],
                    },
                },
            };
            const store = {
                hasModule: () => false,
                registerModule: jest.fn(),
            };
            useRouteVuexModulesServer(router, store, logger);
            expect(store.registerModule).toHaveBeenCalledWith(['foo', 'bar', 'baz'], testModule, {
                preserveState: false,
            });
        });

    });

    describe('useFetchDataServer', () => {

        it('should fetchData for matched components', async () => {
            const ssrContext = { url: '/' };
            const app = { name: 'App' };
            const component = {
                fetchData: jest.fn(),
            };
            const router = {
                currentRoute: {
                    value: {
                        path: '/',
                        matched: [{
                            components: [component],
                        }],
                    },
                },
            };
            const store = { state: {} };
            await useFetchDataServer(ssrContext, app, router, store);
            expect(component.fetchData).toHaveBeenCalledWith({
                ssrContext,
                app,
                router,
                store,
                route: router.currentRoute.value,
            });
        });

        it('should fetchData for matched nested components', async () => {
            const ssrContext = { url: '/' };
            const app = { name: 'App' };
            const component1 = {
                fetchData: jest.fn(),
            };
            const component2 = {
                // No fetchData
            };
            const component3 = {
                fetchData: jest.fn(),
            };
            const router = {
                currentRoute: {
                    value: {
                        path: '/',
                        matched: [{
                            components: [component1],
                        }, {
                            components: [component2],
                        }, {
                            components: [component3],
                        }],
                    },
                },
            };
            const store = { state: {} };
            await useFetchDataServer(ssrContext, app, router, store);
            const expectedArg = {
                ssrContext,
                app,
                router,
                store,
                route: router.currentRoute.value,
            };
            expect(component1.fetchData).toHaveBeenCalledWith(expectedArg);
            expect(component3.fetchData).toHaveBeenCalledWith(expectedArg);
        });

        it('should call middlewares if specified', async () => {
            const ssrContext = { url: '/' };
            const app = { name: 'App' };
            const component = {
                fetchData: jest.fn(),
            };
            const router = {
                currentRoute: {
                    value: {
                        path: '/',
                        matched: [{
                            components: [component],
                        }],
                    },
                },
            };
            const store = { state: {} };
            const globalFetchData = jest.fn();
            const middleware = jest.fn();
            const postMiddleware = jest.fn();
            await useFetchDataServer(ssrContext, app, router, store, {
                globalFetchData,
                middleware,
                postMiddleware,
            });
            const expectedArg = {
                ssrContext,
                app,
                router,
                store,
                route: router.currentRoute.value,
            };
            expect(middleware).toHaveBeenCalledWith(expectedArg);
            expect(globalFetchData).toHaveBeenCalledWith(expectedArg);
            expect(component.fetchData).toHaveBeenCalledWith(expectedArg);
            expect(postMiddleware).toHaveBeenCalledWith(expectedArg);
        });

        it('should reject on any failures', async () => {
            const ssrContext = { url: '/' };
            const app = { name: 'App' };
            const component = {
                fetchData: jest.fn(() => Promise.reject('error')),
            };
            const router = {
                currentRoute: {
                    value: {
                        path: '/',
                        matched: [{
                            components: [component],
                        }],
                    },
                },
            };
            const store = { state: {} };
            expect.assertions(1);
            try {
                await useFetchDataServer(ssrContext, app, router, store);
            } catch (e) {
                expect(e).toBe('error');
            }
        });

    });

});
