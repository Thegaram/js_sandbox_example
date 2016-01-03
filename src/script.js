import ace     from 'brace';
import _       from 'brace/mode/javascript'; // name doesnt matter
import Sandbox from './Sandbox';

// initial user code
// must define functions init, react, cleanup
let workerjs =
`class AI {
  constructor() {
    this.count         = 0;
    this.countInterval = 500;
  }

  init() {
    // register listeners, etc.
    setInterval(this.step.bind(this), this.countInterval);
  }

  cleanup() {
    // deregister listeners, etc.
    // note: most of this is handled automatically when terminating sandbox code
  }

  react(msg) {
    switch(msg.type) {
      case 'STATE':
        this.count = msg.payload.count;
        break;
      default:
        throw 'Unexpected message ' + msg.type;
    }
  }

  step() {
    this.count = this.count + 1;
    sendCount(this.count);
  }
}

var agent = new AI();
const init    = ()    => agent.init();
const react   = (msg) => agent.react(msg);
const cleanup = ()    => agent.cleanup();
`;

// initialize editor
var editor = ace.edit('editor');
editor.getSession().setMode('ace/mode/javascript');
editor.setValue(workerjs);

// handler for msgs from sandbox
function messageHandler(e) {
  var msg = JSON.parse(e.data);

  switch (msg.type) {
    case 'COUNT':
      document.getElementById('counter').innerHTML = 'Count: ' + msg.payload.count;
      break;

    default:
      throw 'Unexpected message ' + msg.type;
  }
};

// handler for msgs in sandbox
function errorHandler(error) {
  console.log(error);

  let div = document.getElementById('msgbox');
  div.appendChild(document.createTextNode(error.message));
  div.appendChild(document.createElement('br'));
  div.scrollTop = div.scrollHeight;
}

var sandbox = new Sandbox(messageHandler, errorHandler);

// button click handlers
document.getElementById('start').onclick = function () {
  sandbox.setCode(editor.getValue());
  sandbox.start();
};

document.getElementById('stop').onclick  = function () {
  sandbox.stop()
};

document.getElementById('reset').onclick = function () {
  sandbox.postMessage(JSON.stringify({
    type: 'STATE',
    payload: {
      count: 0,
    },
  }));
};
