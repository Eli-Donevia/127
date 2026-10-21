// The free website builder's particle swarm (door.js swarmLib): a module, so browsers without modules never load it.
import { particleSwarm } from '/js/vendor/particle-swarm.js';

window.K127.swarm = particleSwarm;
window.dispatchEvent(new Event('k127-swarm'));
