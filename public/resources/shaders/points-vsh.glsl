
attribute vec2 particleData;

varying float vAngle;
varying vec4 vColour;
varying vec3 vWorldPos;
varying float vLife;
varying float vAdditive;
varying float vIndex;

uniform sampler2D sizeOverLife;
uniform sampler2D colourOverLife;
uniform sampler2D twinkleOverLife;
uniform sampler2D additiveOverLife;
uniform float time;
uniform float spinSpeed;
uniform float numSnowTextures; 

// Virtually all of these were taken from: https://www.shadertoy.com/view/ttc3zr

uvec3 murmurHash31(uint src) {
    const uint M = 0x5bd1e995u;
    uvec3 h = uvec3(1190494759u, 2147483647u, 3559788179u);
    src *= M; src ^= src>>24u; src *= M;
    h *= M; h ^= src;
    h ^= h>>13u; h *= M; h ^= h>>15u;
    return h;
}

// 3 outputs, 1 input
vec3 hash31(float src) {
  uvec3 h = murmurHash31(floatBitsToUint(src));
  vec3 v = uintBitsToFloat(h & 0x007fffffu | 0x3f800000u) - 1.0;
  return v * 2.0 - 1.0;
}

vec3 noise31(float p) {
  float i = floor(p);

  float f = fract(p);
  float u = smoothstep(0.0, 1.0, f);

	vec3 val = mix( hash31(i + 0.0),
                  hash31(i + 1.0), u);
  return val * 2.0 - 1.0;
}

void main() {

  float life = particleData.x;
  float id = particleData.y;

  float additiveOverLifeSample = texture2D(additiveOverLife, vec2(life, 0.5)).x;

  float sizeSample = texture2D(sizeOverLife, vec2(life, 0.5)).x;
  vec4 colourSample = texture2D(colourOverLife, vec2(life, 0.5));
  float twinkleSample = texture2D(twinkleOverLife, vec2(life, 0.5)).x;
  float twinkle = mix(1.0, sin(time * 20.0 + id * 6.28) * 0.5 + 0.5, twinkleSample);

  vec3 localPosition = position + noise31(id * 1000.0 + time * 0.5) * 0.2;

  vec3 mvPosition = (modelViewMatrix * vec4(localPosition, 1.0)).xyz;
  gl_Position = projectionMatrix * vec4(mvPosition, 1.0);
  gl_PointSize = sizeSample * 300.0 / -mvPosition.z;
  vAngle = spinSpeed * time + id * 6.28;
  vColour = colourSample;
  vColour.a *= twinkle;
  vWorldPos = (modelMatrix * vec4(localPosition, 1.0)).xyz;
  vLife = life;
  vAdditive = additiveOverLifeSample;
  vIndex = mod(floor(id * 1000.0), numSnowTextures);
}