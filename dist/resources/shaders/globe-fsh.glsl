
uniform samplerCube reflectionTexture;
uniform sampler2D refractionTexture;
uniform vec2 resolution;

varying vec3 vWorldPosition;
varying vec3 vViewPosition;
varying vec3 vViewNormal;

float inverseLerp(float v, float minValue, float maxValue) {
  return (v - minValue) / (maxValue - minValue);
}

float remap(float v, float inMin, float inMax, float outMin, float outMax) {
  float t = inverseLerp(v, inMin, inMax);
  return mix(outMin, outMax, t);
}

float saturate(float x) {
  return clamp(x, 0.0, 1.0);
}

void main() {
  vec3 viewDir = vViewPosition;
  float viewDirMagnitude = length(viewDir);
  viewDir = normalize(viewDir);

  vec3 normal = normalize(vViewNormal);

  vec3 viewDirWS = normalize(vWorldPosition - cameraPosition);
  vec3 normalWS = normalize(vWorldPosition);

  // Reflection
  vec3 reflectDir = reflect(viewDirWS, normalWS);
  vec4 reflectionSample = textureCube(reflectionTexture, reflectDir);

  // Fresnel
  float fresnel = saturate(dot(-viewDirWS, normalWS));
  fresnel = pow(1.0 - fresnel, 4.0);
  fresnel = remap(fresnel, 0.0, 1.0, 0.05, 1.0);
  reflectionSample *= fresnel;

  // Refraction
  vec3 refractDir = refract(viewDir, normal, 1.0 / 1.5);
  vec2 uvOffset = refractDir.xy * 0.25 / max(1.0, (viewDirMagnitude));
  vec2 uv = (gl_FragCoord.xy / resolution.xy) + uvOffset;

  vec4 refractionSample = texture2D(refractionTexture, uv);

  gl_FragColor = (refractionSample + reflectionSample);

  #include <tonemapping_fragment>
	#include <colorspace_fragment>
}