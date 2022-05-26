import {EventDispatcher} from 'three';
import {AnimMotion} from './AnimMotion.js';

class AnimMixer extends EventDispatcher {
  constructor(avatar) {
    super();
    this.avatar = avatar;
    this.motion = null;
    this.yBias = 0;
  }

  createMotion(clip) {
    const motion = new AnimMotion(this, clip);
    return motion;
  }

  update(timeSeconds = performance.now() / 1000) {
    for (const spec of this.avatar.animationMappings) {
      const {
        animationTrackName: k,
        dst,
        // isTop,
        isPosition,
      } = spec;

      const clip = this.motion.clip;
      const src = clip.interpolants[k];
      const value = src.evaluate(timeSeconds % clip.duration);

      if (isPosition) { // _clearXZ
        value[0] = 0;
        value[2] = 0;
      }

      dst.fromArray(value);

      // applyFn(spec);
      // _blendFly(spec);
      // _blendActivateAction(spec);

      // ignore all animation position except y
      if (isPosition) {
        if (!this.avatar.jumpState) {
          // animations position is height-relative
          dst.y *= this.avatar.height; // XXX avatar could be made perfect by measuring from foot to hips instead
        } else {
          // force height in the jump case to overide the animation
          dst.y = this.avatar.height * 0.55;
        }
      }
    }
  }
}

export {AnimMixer};
