
out vec3 vNormal;
out vec3 vWorldPosition;
out vec2 vUv;

void main() {
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  vUv = uv;
}