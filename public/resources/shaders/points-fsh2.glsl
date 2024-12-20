
uniform sampler2D map;
uniform float lightFactor;
uniform float lightIntensity;

varying float vAngle;
varying vec4 vColour;
varying vec3 vWorldPos;

void main() {
  vec2 uv = gl_PointCoord.xy;

  float x = uv.x - 0.5;
  float y = uv.y - 0.5;
  float z = sqrt(1.0 - x * x - y * y);
  vec3 normal = normalize(vec3(x, y, z * 0.5));

  // Calculate lighting
  vec3 lightPos = vec3(0.0, 4.0, 0.0);
  lightPos = (viewMatrix * vec4(lightPos, 1.0)).xyz;
  vec3 viewPos = (viewMatrix * vec4(vWorldPos, 1.0)).xyz;
  vec3 lightDir = normalize(lightPos - viewPos);
  lightDir.y = -lightDir.y;
  float lightDP = max(dot(normal, lightDir), 0.0);

  // Calculate light falloff
  float falloff = smoothstep(8.0, 12.0, length(lightPos - viewPos));
  vec3 fakeColour = mix(vec3(1.0, 0.6, 0.2), vec3(1.0), falloff);

  float c = cos(vAngle);
  float s = sin(vAngle);
  mat2 r = mat2(c, s, -s, c);

  uv = (uv - 0.5) * r + 0.5;
  
  vec4 texel = texture2D(map, uv);

  vec4 finalColour = vColour * texel;

  finalColour.rgb *= mix(vec3(1.0), lightDP * fakeColour * lightIntensity, lightFactor);
  finalColour.rgb *= finalColour.a;
  finalColour.a *= mix(0.0, falloff, lightFactor);

  // vec4 alphaBlended = vec4(finalColour.rgb * finalColour.a, finalColour.a);
  // vec4 additiveBlended = vec4(finalColour.rgb * finalColour.a, 0.0);

  gl_FragColor = finalColour;
}