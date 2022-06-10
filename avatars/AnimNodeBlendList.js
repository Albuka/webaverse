import {MathUtils} from 'three';
import {AnimMixer} from './AnimMixer';
import {AnimNode} from './AnimNode';

class AnimNodeBlendList extends AnimNode {
  constructor(name, mixer) {
    super(name, mixer);
    this.isAnimNodeBlendList = true;
  }

  addChild(node) {
    this.children.push(node);
  }

  update(spec) {
    // do blend
    const result = []; // todo: resultBuffer ( refer to threejs );
    // let result;
    let nodeIndex = 0;
    let currentWeight = 0;
    for (let i = 0; i < this.children.length; i++) {
      const childNode = this.children[i];
      if (childNode.weight > 0) {
        const value = this.mixer.doBlend(childNode, spec);
        if (nodeIndex === 0) {
          // result = value; // todo: will change original data?
          AnimMixer.copyArray(result, value);

          nodeIndex++;
          currentWeight = childNode.weight;
        } else if (childNode.weight > 0) { // todo: handle weight < 0 ?
          const t = childNode.weight / (currentWeight + childNode.weight);
          AnimMixer.interpolateFlat(result, result, value, t);

          nodeIndex++;
          currentWeight += childNode.weight;
        }
      }
    }
    // if (nodeIndex === 0) { // use children[0]'s value, if all weights are zero
    //   const value = this.mixer.doBlend(this.children[0], spec);
    //   AnimMixer.copyArray(result, value);
    // }
    return result;
  }
}

export {AnimNodeBlendList};
