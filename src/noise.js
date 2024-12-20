import { createNoise2D } from "simplex-noise";

const NOISE_2D_ = createNoise2D();

function noise1D(x) {
  return NOISE_2D_(x, x);
}

function noise2D(x, y) {
  return NOISE_2D_(x, y);
}

export { noise1D, noise2D };