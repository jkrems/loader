'use strict';

const resolvedPromise = Promise.resolve();

function noop() {}

/* A ModuleJob tracks the loading of a single Module, and the ModuleJobs of
 * its dependencies, over time. */
class ModuleJob {
  // `loader` is the Loader instance used for loading dependencies.
  // `moduleProvider` is a function
  constructor(loader, url, moduleProvider, isMain, inspectBrk) {
    this.loader = loader;
    this.isMain = isMain;
    this.inspectBrk = inspectBrk;

    // This is a Promise<{ module, reflect }>, whose fields will be copied
    // onto `this` by `link()` below once it has been resolved.
    this.modulePromise = moduleProvider.call(loader, url, isMain);
    this.module = undefined;

    // Wait for the ModuleWrap instance being linked with all dependencies.
    const link = async () => {
      this.module = await this.modulePromise;

      const dependencyJobs = [];
      const promises = this.module.link(async specifier => {
        const jobPromise = this.loader.getModuleJob(specifier, url);
        dependencyJobs.push(jobPromise);
        return (await jobPromise).modulePromise;
      });

      if (promises !== undefined) {
        if (promises.then) {
          await promises;
        } else {
          await Promise.all(promises);
        }
      }

      return Promise.all(dependencyJobs);
    };
    // Promise for the list of all dependencyJobs.
    this.linked = link();
    // This promise is awaited later anyway, so silence
    // 'unhandled rejection' warnings.
    this.linked.catch(noop);

    // instantiated == deep dependency jobs wrappers instantiated,
    // module wrapper instantiated
    this.instantiated = undefined;
  }

  async instantiate() {
    if (!this.instantiated) {
      return (this.instantiated = this._instantiate());
    }
    await this.instantiated;
    return this.module;
  }

  // This method instantiates the module associated with this job and its
  // entire dependency graph, i.e. creates all the module namespaces and the
  // exported/imported variables.
  async _instantiate() {
    const jobsInGraph = new Set();

    const addJobsToDependencyGraph = async moduleJob => {
      if (jobsInGraph.has(moduleJob)) {
        return;
      }
      jobsInGraph.add(moduleJob);
      const dependencyJobs = await moduleJob.linked;
      await Promise.all(dependencyJobs.map(addJobsToDependencyGraph));
    };
    await addJobsToDependencyGraph(this);
    try {
      // this.module.instantiate(true);
    } catch (e) {
      throw e;
    }
    for (const dependencyJob of jobsInGraph) {
      // Calling `this.module.instantiate()` instantiates not only the
      // ModuleWrap in this module, but all modules in the graph.
      dependencyJob.instantiated = resolvedPromise;
    }
    return this.module;
  }

  async run() {
    const module = await this.instantiate();
    return { module, result: module.evaluate() };
  }
}
module.exports = ModuleJob;
