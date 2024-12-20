
precision highp float;

in vec2 vUv;

uniform sampler2D tDiffuse;
uniform float time;
uniform float intensity;
uniform float dropoff;

float inverseLerp(float v, float minValue, float maxValue) {
  return (v - minValue) / (maxValue - minValue);
}

float remap(float v, float inMin, float inMax, float outMin, float outMax) {
  float t = inverseLerp(v, inMin, inMax);
  return mix(outMin, outMax, t);
}

vec2 fisheyeDistortion(vec2 uv, float strength) {
  vec2 centeredUV = uv * 2.0 - 1.0;
  
  float r = length(centeredUV);
  
  float theta = atan(centeredUV.y, centeredUV.x);
  float distortedR = pow(r, strength);
  
  vec2 distortedUV = vec2(cos(theta), sin(theta)) * distortedR;
  
  distortedUV = (distortedUV + 1.0) * 0.5;
  
  return distortedUV;
}

float vignette(vec2 uvs) {
  float v1 = smoothstep(0.5, 0.3, abs(uvs.x - 0.5));
  float v2 = smoothstep(0.5, 0.3, abs(uvs.y - 0.5));
  float v = v1 * v2;
  v = pow(v, dropoff);
  v = remap(v, 0.0, 1.0, intensity, 1.0);
  return v;
}

void main() {
  // vec2 uv = fisheyeDistortion(vUv, 1.5);
  vec2 uv = vUv;
  vec4 texel = texture(tDiffuse, uv);
  
  // float t1 = remap(sin(uv.y * 400.0 + time * 10.0), -1.0, 1.0, 0.9, 1.0);
  // float t2 = remap(sin(uv.y * 50.0 - time * 2.0), -1.0, 1.0, 0.9, 1.0);

  // float darkening = t1 * t2;
  float darkening = vignette(uv);

  pc_fragColor = vec4(texel.xyz * darkening, 1.0);
}