import {MathUtils} from 'three';
import {AnimMixer} from './AnimMixer';
import {AnimNode} from './AnimNode';

class AnimNodeUnitary extends AnimNode {
  constructor(name, mixer) {
    super(name, mixer);
    this.isAnimNodeBlend2 = true;
    this.activeNode = null;

    this.isCrossFade = false;
    this.crossFadeDuration = 0;
    this.crossFadeStartTime = 0;
  }

  addChild(node) {
    this.children.push(node);
    if (this.children.length === 1) {
      this.activeNode = node;
      node.weight = 1;
    } else {
      node.weight = 0;
    }
  }

  update(spec) {
    // do fade
    if (this.isCrossFade) {
      let factor = (AnimMixer.timeS - this.crossFadeStartTime) / this.crossFadeDuration;
      factor = MathUtils.clamp(factor, 0, 1);
      const factorReverse = 1 - factor;

      for (let i = 0; i < this.children.length; i++) {
        const childNode = this.children[i];
        if (childNode === this.activeNode) {
          childNode.weight = factor;
        // } else if (childNode === this.lastActiveNode) {
        //   childNode.weight = factorReverse;
        } else { // ensure unitary
          childNode.weight = Math.min(childNode.weight, factorReverse);
        }
      }

      if (factor === 1) {
        this.isCrossFade = false;
      }
    }

    // do blend
    const result = []; // todo: resultBuffer ( refer to threejs );
    // let result;
    let nodeIndex = 0;
    let currentWeight = 0;
    for (let i = 0; i < this.children.length; i++) {
      const childNode = this.children[i];
      const value = this.mixer.doBlend(childNode, spec);
      if (childNode.weight > 0) {
        if (nodeIndex === 0) {
          // result = value; // todo: will change original data?
          AnimMixer.copyArray(result, value);

          nodeIndex++;
          currentWeight = childNode.weight;
        } else {
          const t = childNode.weight / (currentWeight + childNode.weight);
          AnimMixer.interpolateFlat(result, result, value, t);

          nodeIndex++;
          currentWeight += childNode.weight;
        }
      }
    }
    return result;
  }

  crossFadeTo(duration, targetNode) {
    if (targetNode === this.activeNode) return;
    this.isCrossFade = true;
    this.crossFadeDuration = duration;
    this.crossFadeStartTime = AnimMixer.timeS;

    // this.lastActiveNode = this.activeNode;
    this.activeNode = targetNode;
  }
}

export {AnimNodeUnitary};
