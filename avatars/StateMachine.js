import {Vector3, Object3D} from 'three';

/** container for state data
 * @param {Object} stateData - the general state definition
 * @param {Number} stateData.time - the playback time for the state
 * @param {Object} stateData.target - the target object for the animationFn
 * @param {Vector3} stateData.direction - directional data for this state
 * @param {Boolean} stateData.active - is the state currently active or not
 * @param {Function} stateData.animationFn - the function to call when the state is active
 * @param {String} stateData.animation - the name of the animation
 *
 */
class StateObj {
  constructor({time = NaN, target, direction = new Vector3(), active = false, animationFn, animation} = {}) {
    this.time = time;
    this.animation = animation;
    this.animationFn = animationFn;
    this.target = target;
    this.direction = direction;
    this.active = active;
  }
}

/**
 * graph nodes are used for queing order tasks when a state is triggered
 * @param {Array} states - array of states to be queued.  second and further elements are set as sibling
 * @param {Array} peers - array of existing graph nodes which run concurrently with this node
 * @param {Boolean} directed - is this node directed or undirected
 */
class GraphNode {
  constructor(states = [], peers = [], directed = true) {
    this.state = states.shift();
    // these aren't yet implimented
    this.siblings = states.map(d => {
      return new GraphNode(d);
    });
    this.peers = peers;
    this.directed = directed;
  }
}

/** StateMachine is a singlton that tracks all registered object's current state */
class StateMachine {
  constructor() {
    // global state can be stored here
    this.tracking = new Map();
    this.states = {};
    this.graph = new Map();
  }

  // add object to state machine
  registerObj(name, obj) {
    this.tracking.has(name) || this.tracking.set(name, {
      id: crypto.randomUUID(),
      obj: obj,
      graph: {},
      //   graphRoot: null,
      states: new Map(),
      registerState: function(params) { // assign a state to a tracked object
        if (!params) return;
        const {name: stateName} = params;
        const state = this.states.has(stateName) ? {...this.states.get(stateName), ...params} : new StateObj(params);
        this.states.set(stateName, state);
        // add straight into graph if it's already active
        if (this.states.get(stateName).active) {
          const node = new GraphNode([stateName]);
          const nodeName = this.graph.length + node.state;
          this.graph[nodeName] = {name: stateName, node};
        }
      },
      getState: function(state, active = false) {
        // console.log(this.states.get(state)?.time)
        return active ? this.states.get(state)?.active : this.states.get(state);
      },
      deactivate: function(state) {
        if (this.states.has(state)) this.states.get(state).active = false;
      },
      activate: function(state) {
        if (this.states.has(state)) this.states.get(state).active = true;
      },
      addToGraph: function(states = []) {
        const node = new GraphNode(states);
        const nodeName = this.graph.length + node.state;
        this.graph[nodeName] = {name: node.state, node};
        // do we want to add siblings to the graph var, or just look through their sublings list?
        // node.siblings.forEach(n => {
        //     this.graph.set(n)
        // }, this)
      },
    });
    obj.tracker = this.getTracked(name);
  }

  // access a tracked object
  getTracked(name) {
    return name ? this.tracking.get(name) : this.tracking;
  }

  // remove object from state machine
  untrack(name) {
    return this.tracking.delete(name);
  }

  // get stateObj for tracked object
  getState(name, state) {
    const current = this.tracking.get(name);
    return current.states.get(state);
  }

  // add a state to the animation graph
  queueState(states = []) {
    const node = new GraphNode(states);
    const nodeName = this.graph.length + node.state;
    this.graph[nodeName] = {name: node.state, node};
  }

  // incomplete
  update(timestamp, timeDiff) {
    const funcs = [];
    const processNode = (node, curState) => {
      if (!curState.active) return;
      funcs.push({fn: curState.animationFn, name: node.state});
      node.siblings.forEach(processNode);
    };

    this.tracking.forEach(tracked => {
      for (const key in tracked.graph) {
        if (Object.hasOwnProperty.call(tracked.graph, key)) {
          const {node, name} = tracked.graph[key];

          const curState = tracked.getState(name); // this may not work in arrow func

          processNode(node, curState);
        }
      }
    });

    while (funcs.length > 0) {
      const {fn, name} = funcs.shift();
    //   try {
    //     // curState.animationFn?.();
        fn?.call();
    //   } catch (error) {
    //     console.log(`could not run animation function for ${name}`, error);
    //   }
    }
  }
}

const stateMachine = new StateMachine();

export default stateMachine;
