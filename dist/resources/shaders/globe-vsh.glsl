
varying vec3 vWorldPosition;
varying vec3 vViewPosition;
varying vec3 vViewNormal;

void main() {
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  vWorldPosition = (modelMatrix * vec4(position, 1.0)).xyz;
  vViewPosition = (modelViewMatrix * vec4(position, 1.0)).xyz;
  vViewNormal = (modelViewMatrix * vec4(normalize(vWorldPosition), 0.0)).xyz;
}