
attribute vec2 particleData;

varying float vAngle;
varying vec4 vColour;
varying vec3 vWorldPos;
varying vec3 vLocalPos;	

uniform sampler2D sizeOverLife;
uniform sampler2D colourOverLife;
uniform sampler2D twinkleOverLife;
uniform float lineVariance;
uniform float time;
uniform float spinSpeed;

void main() {

  float life = particleData.x;
  float id = particleData.y;

  float sizeSample = texture2D(sizeOverLife, vec2(life, 0.5)).x;
  vec4 colourSample = texture2D(colourOverLife, vec2(life, 0.5));
  
  float twinkleSample = texture2D(twinkleOverLife, vec2(life, 0.5)).x;
  float twinkle = mix(1.0, sin(time * 20.0 + id * 6.28) * 0.5 + 0.5, twinkleSample);

  vec3 mvPosition = (modelViewMatrix * vec4(position, 1.0)).xyz;

  vLocalPos = position;
  vWorldPos = (modelMatrix * vec4(position, 1.0)).xyz;
  gl_Position = projectionMatrix * vec4(mvPosition, 1.0);

  vec3 referencePos = vec3(0.0, 0.5, 0.0);
  // Calculate the distance from the reference position
  float distance = length(vWorldPos - referencePos);

  // Normalize the distance to a range [0, 1] (you may need to adjust the scaling factor)
  float normalizedDistance = clamp(distance/1.4, 0.0, 1.0); // Adjust the divisor as needed
   // Define the colors of the rainbow
  vec3 color1 = vec3(1.0, 0.0, 0.0); // Red
  vec3 color2 = vec3(1.0, 0.5, 0.0); // Orange
  vec3 color3 = vec3(1.0, 1.0, 0.0); // Yellow
  vec3 color4 = vec3(0.0, 1.0, 0.0); // Green
  vec3 color5 = vec3(0.0, 0.0, 1.0); // Blue
  vec3 color6 = vec3(0.29, 0.0, 0.51); // Indigo
  vec3 color7 = vec3(0.56, 0.0, 1.0); // Violet

  // Mix between the colors based on the normalized distance
  vec3 distanceColor;
  if (distance < 0.81) {
    distanceColor = mix(color1, color2, smoothstep(0.8, 0.81, distance));
  } else if (distance < 0.82) {
    distanceColor = mix(color2, color3, smoothstep(0.81, 0.82, distance));
  } else if (distance < 0.83) {
    distanceColor = mix(color3, color4, smoothstep(0.82, 0.83, distance));
  } else if (distance < 0.84) {
    distanceColor = mix(color4, color5, smoothstep(0.83, 0.84, distance));
  } else if (distance < 0.85) {
    distanceColor = mix(color5, color6, smoothstep(0.84, 0.85, distance));
  } else {
    distanceColor = mix(color6, color7, smoothstep(0.85, 0.86, distance));
  }
  
  gl_PointSize = sizeSample * 300.0 / -mvPosition.z;
  vAngle = spinSpeed * time + id * 6.28;
  vColour = vec4(distanceColor, vec2(life, 0.5));
  vColour.a *= twinkle;
  
}