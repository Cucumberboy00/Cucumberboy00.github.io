
uniform sampler2DArray map;
uniform float lightFactor;
uniform float lightIntensity;
uniform vec3 skyLight;
uniform vec3 downLight;

varying float vAngle;
varying vec4 vColour;
varying vec3 vWorldPos;
varying float vLife;
varying float vAdditive;
varying float vIndex;

float saturate(float x) {
  return clamp(x, 0.0, 1.0);
}

void main() {
  vec2 uv = gl_PointCoord.xy;

  float x = uv.x - 0.5;
  float y = uv.y - 0.5;
  float z = sqrt(1.0 - x * x - y * y);
  vec3 normal = normalize(vec3(x, y, z * 0.5));
  normal.y = -normal.y;

  // Calculate lighting
  vec3 lightPos = vec3(0.0, 100.0, 0.0);
  lightPos = (viewMatrix * vec4(lightPos, 1.0)).xyz;

  vec3 up = vec3(0.0, 1.0, 0.0);
  up = (viewMatrix * vec4(up, 0.0)).xyz;

  vec3 viewPos = (viewMatrix * vec4(vWorldPos, 1.0)).xyz;
  vec3 lightDir = normalize(lightPos - viewPos);
  float lightDP = max(dot(normal, lightDir), 0.0);
  // lightDP = lightDP * 0.75 + 0.25;


  // Calculate light falloff
  vec3 light = mix(downLight, skyLight, saturate(dot(normal, up)));

  float c = cos(vAngle);
  float s = sin(vAngle);
  mat2 r = mat2(c, s, -s, c);

  uv = (uv - 0.5) * r + 0.5;
  
  vec4 texel = texture(map, vec3(uv, vIndex));

  vec4 finalColour = vColour * texel;
  float alphaFactor = vLife;

  // finalColour.rgb *= mix(vec3(1.0), light * lightIntensity, alphaFactor);
  finalColour.rgb *= light;
  finalColour.rgb *= finalColour.a;
  // finalColour.a *= (1.0 - vAdditive);

  gl_FragColor = finalColour;

  #include <tonemapping_fragment>
	#include <colorspace_fragment>
}