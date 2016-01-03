import { transform } from 'babel-core';
import es2015 from 'babel-preset-es2015';

class Sandbox {
  constructor(onmessage, onerror) {
    Sandbox._checkSupport();

    this.code      = '';        // user code
    this.onerror   = onerror;   // handler for error in worker (and sandbox)
    this.onmessage = onmessage; // handler for msgs from worker
    this.codeReady = false;     // indicates that code is ready to run
    this.worker    = undefined;
  }

  setCode(newCode) {
    this.codeReady = false;

    // check user code
    try {
      Sandbox._compile(newCode);
    } catch (e) {
      this.onerror(e);
      return;
    }

    let js = Sandbox._embedCode(newCode);

    // transpile
    try {
      this.code = Sandbox._compile(js);
      this.codeReady = true;
    } catch (e) {
      // TODO: figure out how to handle this
      // if we reach here, there's a problem on our side (probably)
      throw e;
    }
  }

  start() {
    if (!this.codeReady) {
      this.onerror(new Error('Code not ready'));
      return;
    }

    // create blob to be run on worker
    let blob = Sandbox._createBlob(this.code);

    if (this.worker) {
      this.onerror(new Error('Worker already running'));
      return;
    }

    this.worker = new Worker(URL.createObjectURL(blob));
    this.worker.onmessage = this.onmessage;
    this.worker.onerror   = this.onerror;
  }

  stop() {
    if (!this.worker) {
      this.onerror(new Error('Worker already stopped'));
      return;
    }

    // let the worker clean up first
    this.postMessage(JSON.stringify({
      type: 'TERMINATE',
      payload: {},
    }));

    setTimeout(() => this._hardStop(), 500);
  }

  postMessage(msg) {
    if (!this.worker) {
      this.onerror(new Error('Cannot send msg to uninitialized worker'));
      return;
    }

    this.worker.postMessage(msg);
  }

  static _checkSupport() {
    if (!window.Worker) {
      // TODO: figure out how to handle this
      throw new Error('Workers not supported');
    }

    window.URL = window.URL || window.webkitURL;
    if (!window.URL) {
      // TODO: figure out how to handle this
      throw new Error('URL API not supported');
    }
  }

  static _compile(code) {
    return transform(code, {
      presets: [es2015],
    }).code;
  }

  static _createBlob(code) {
    var blob;
    try {
      blob = new Blob([code], {type: 'application/javascript'});
    } catch (e) { // Backwards-compatibility
      window.BlobBuilder = window.BlobBuilder || window.WebKitBlobBuilder || window.MozBlobBuilder;
      blob = new BlobBuilder();
      blob.append(code);
      blob = blob.getBlob();
    }

    return blob;
  }

  static _embedCode(code) {
    return `
      "use strict";

      // example for function provided to user by us
      function sendCount(count) {
        postMessage(JSON.stringify({
          type: 'COUNT',
          payload: {
            count,
          },
        }));
      }

      // wrapper for adding custom functions and hiding globals
      // TODO: handle missing method
      var { init, react, cleanup } = function(sendCount) {
        ${code}

        return {
          init,
          react,
          cleanup,
        }
      }(sendCount);

      // handles special messages
      // delegates the rest to user code
      self.onmessage = (e) => {
        var msg = JSON.parse(e.data);

        switch (msg.type) {
          case 'TERMINATE':
            cleanup();
            self.close();
            break;
          // ...
          default:
            react(msg);
        }
      }

      init();
    `;
  }

  _hardStop() {
    if (this.worker) {
      this.worker.terminate();
      this.worker = undefined;
    }
  }
}

export default Sandbox;
