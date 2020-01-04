'use strict';

const { SourceTextModule } = require('vm');
const Threads = require('worker_threads');

const ModuleJob = require('./module_job');

class ResourceWorker {
  constructor(filename) {
    this.ref = new Threads.Worker(filename);
    this.ref.on('message', this._handleWorkerMessage.bind(this));
    this.ref.unref();
    this.lastCallId = 0;
    this.pending = new Map();
  }

  _handleWorkerMessage({ id, result, error }) {
    const future = this.pending.get(id);
    if (future === undefined) return;
    this.pending.delete(id);
    this.ref.unref();

    if (error) {
      future.reject(error);
    }
    future.resolve(result);
  }

  _send(method, args) {
    return new Promise((resolve, reject) => {
      const id = ++this.lastCallId;
      console.log('_send(%j, %d)', method, id, args);
      this.pending.set(id, { resolve, reject });

      this.ref.ref();
      this.ref.postMessage({ id, method, args });
    });
  }

  async resolveImportURL(specifier, referrerURL) {
    return this._send('resolveImportURL', [specifier, referrerURL]);
  }

  async fetchResource(request) {
    return this._send('fetchResource', [request]);
  }
}

class ModuleLoader {
  constructor() {
    /** @type {Map<string, ModuleJob>} */
    this.moduleMap = new Map();
    this.worker = new ResourceWorker(require.resolve('./resource_worker.js'));
  }

  async import(specifier, referrerURL) {
    return (await this._importModuleFromURL(specifier, referrerURL)).namespace;
  }

  async _getModule(url) {
    const request = { url };
    const response = await this.worker.fetchResource(request);
    if (response.headers.get('content-type') !== 'text/javascript') {
      throw new Error('Invalid content-type');
    }
    const source = response.text;
    const finalURL = response.url;

    const m = new SourceTextModule(source, {
      identifier: finalURL,
      initializeImportMeta: this._initializeImportMeta.bind(this),
      importModuleDynamically: this._importModuleDynamically.bind(this),
    });

    return m;
  }

  async getModuleJob(specifier, referrerURL) {
    const url = await this.worker.resolveImportURL(specifier, referrerURL);
    let job = this.moduleMap.get(url);
    if (job !== undefined) return job;

    job = new ModuleJob(this, url, this._getModule.bind(this));
    this.moduleMap.set(url, job);
    return job;
  }

  async _importModuleFromURL(specifier, referrerURL) {
    const job = await this.getModuleJob(specifier, referrerURL);
    const { module: m } = await job.run();
    return m;
  }

  _initializeImportMeta(meta, m) {
    meta.url = m.identifier;
  }

  async _importModuleDynamically(specifier, referrer) {
    return this._importModuleFromURL(specifier, referrer.identifier);
  }
}
module.exports = ModuleLoader;
