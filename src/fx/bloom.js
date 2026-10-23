// Thresholded additive bloom for the main camera (WebGL only).
// Phaser's built-in postFX bloom outputs mix(original, blurred, 0.5): it halves contrast and softens every pixel.
// Here the original passes through untouched and only pixels above a brightness threshold contribute a faint
// halo, so pixel art stays crisp and just the hottest neon (bullet cores, explosions) gets kissed by light.
import Phaser from 'phaser';

const FRAG = `
precision mediump float;
uniform sampler2D uMainSampler;
uniform vec2 uTexel;
uniform float uStrength;
uniform float uThreshold;
varying vec2 outTexCoord;

vec3 hot(vec2 uv) {
    vec3 c = texture2D(uMainSampler, uv).rgb;
    float l = max(c.r, max(c.g, c.b));
    return c * smoothstep(uThreshold, 1.0, l);
}

void main() {
    vec4 base = texture2D(uMainSampler, outTexCoord);
    vec3 sum = vec3(0.0);
    for (int i = 0; i < 8; i++) {
        float a = float(i) * 0.785398 + 0.39;
        vec2 d = vec2(cos(a), sin(a)) * uTexel;
        sum += hot(outTexCoord + d * 1.5) * 0.07;
        sum += hot(outTexCoord + d * 3.5) * 0.04;
        sum += hot(outTexCoord + d * 6.0) * 0.02;
    }
    gl_FragColor = vec4(base.rgb + sum * uStrength, base.a);
}`;

export class NeonBloom extends Phaser.Renderer.WebGL.Pipelines.PostFXPipeline {
    constructor(game) {
        super({ game, name: 'NeonBloom', fragShader: FRAG });
        this.strength = 0.8;
        this.threshold = 0.85;
    }
    onPreRender() {
        this.set1f('uStrength', this.strength);
        this.set1f('uThreshold', this.threshold);
        this.set2f('uTexel', 1 / this.renderer.width, 1 / this.renderer.height);
    }
}

/** attach to a camera; returns false when post-pipelines are unavailable (canvas renderer) */
export function addBloom(camera) {
    const pipes = camera.scene.sys.game.renderer.pipelines;
    if (!pipes) return false;
    if (!pipes.postPipelineClasses.has('NeonBloom')) pipes.addPostPipeline('NeonBloom', NeonBloom);
    camera.setPostPipeline(NeonBloom);
    return true;
}

export function removeBloom(camera) { camera.removePostPipeline('NeonBloom'); }
