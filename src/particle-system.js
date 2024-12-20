import * as THREE from 'three';
import * as MATH from './math.js';

const GRAVITY = new THREE.Vector3(0, -9.8, 0);
const DRAG = 0.5;


// ParticleSystem will contain a bunch of emitters
class ParticleSystem {
  #emitters_ = [];
  
  constructor() {
  }

  dispose() {
    for (let i = 0; i < this.#emitters_.length; ++i) {
      this.#emitters_[i].dispose();
    }
  }

  get StillActive() {
    for (let i = 0; i < this.#emitters_.length; ++i) {
      if (this.#emitters_[i].StillActive) {
        return true;
      }
    }

    return false;
  }

  addEmitter(emitter) {
    this.#emitters_.push(emitter);
  }

  step(timeElapsed, totalTimeElapsed) {
    for (let i = 0; i < this.#emitters_.length; ++i) {
      const e = this.#emitters_[i];

      e.step(timeElapsed, totalTimeElapsed);

      if (!e.StillActive) {
        e.dispose();
      }
    }

    this.#emitters_ = this.#emitters_.filter(e => e.StillActive);
  }
};

class ParticleRendererParams {
  maxParticles = 100;
  group = new THREE.Group();

  constructor() {
  }
};

// ParticleRenderer will render particles
class ParticleRenderer {
  #particleGeometry_ = null;
  #particlePoints_ = null;
  #material_ = null;

  constructor() {
  }

  dispose() {
    this.#particlePoints_.removeFromParent();
    this.#particleGeometry_.dispose();
    this.#material_.dispose();

    this.#particlePoints_ = null;
    this.#particleGeometry_ = null;
    this.#material_ = null;
  }

  initialize(material, params) {
    this.#particleGeometry_ = new THREE.BufferGeometry();

    const positions = new Float32Array(params.maxParticles * 3);
    const particleData = new Float32Array(params.maxParticles * 2);

    this.#particleGeometry_.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    this.#particleGeometry_.setAttribute('particleData', new THREE.Float32BufferAttribute(particleData, 2));

    // Set dynamic draw usage on every attribute we plan on updating
    this.#particleGeometry_.attributes.position.setUsage(THREE.DynamicDrawUsage);
    this.#particleGeometry_.attributes.particleData.setUsage(THREE.DynamicDrawUsage);
    this.#particleGeometry_.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1000);

    this.#particlePoints_ = new THREE.Points(this.#particleGeometry_, material);

    this.#material_ = material;

    params.group.add(this.#particlePoints_);
  }

  updateFromParticles(particles, params, totalTimeElapsed) {
    this.#material_.uniforms.time.value = totalTimeElapsed;
    this.#material_.uniforms.spinSpeed.value = params.spinSpeed;

    const positions = new Float32Array(particles.length * 3);
    const particleData = new Float32Array(particles.length * 2);

    for (let i = 0; i < particles.length; ++i) {
      const p = particles[i];
      positions[i * 3 + 0] = p.position.x;
      positions[i * 3 + 1] = p.position.y;
      positions[i * 3 + 2] = p.position.z;
      particleData[i * 2 + 0] = p.life / p.maxLife;
      particleData[i * 2 + 1] = p.id;
    }
    
    this.#particleGeometry_.attributes.position.copyArray(positions);
    this.#particleGeometry_.attributes.particleData.copyArray(particleData);

    this.#particleGeometry_.attributes.position.needsUpdate = true;
    this.#particleGeometry_.attributes.particleData.needsUpdate = true;

    this.#particleGeometry_.setDrawRange(0, particles.length);
  }
};


class Particle {
  position = new THREE.Vector3();
  velocity = new THREE.Vector3();
  life = 0;
  maxLife = 5;
  id = MATH.random();

  constructor() {
  }
};


// EmitterShape will define the volume where particles are created
class EmitterShape {
  constructor() {
  }

  emit() {
    return new Particle();
  }
};

class PointShape extends EmitterShape {
  position = new THREE.Vector3();
  positionRadiusVariance = 0;
  lineVariance = 0;

  constructor() {
    super();
  }

  emit() {
    const p = new Particle();
    p.position.copy(this.position);
    if (this.lineVariance > 0) {
      const offset = (MATH.random() * 2 - 1) * this.lineVariance;
      p.position.z += offset; // Vary position on the x-axis
    } else {
      const phi = MATH.random() * Math.PI * 2;
      const theta = MATH.random() * Math.PI;
      const radius = MATH.random() * this.positionRadiusVariance;

      const dir = new THREE.Vector3(
        Math.sin(theta) * Math.cos(phi),
        Math.cos(theta),
        Math.sin(theta) * Math.sin(phi)
      );
      dir.multiplyScalar(radius);
      p.position.add(dir);
    }
    return p;
  }
};


class ParticleAttractor {
  position = new THREE.Vector3();
  intensity = 1;
  radius = 1;

  constructor() {
  }
};


class EmitterParams {
  currentPosition_ = new THREE.Vector3();
  assignedPosition_ = false;
  maxLife = 5;
  velocityMagnitude = 0;
  velocityMagnitudeVariance = 0;
  rotation = new THREE.Quaternion();
  rotationAngularVariance = 0;

  maxParticles = 100;
  maxEmission = 100;
  emissionRate = 1;
  gravity = false;
  gravityStrength = 1;
  dragCoefficient = DRAG;
  renderer = null;
  spinSpeed = 0;

  attractors = [];

  shape = new PointShape();

  onCreated = null;
  onStep = null;
  onDestroy = null;

  constructor() {
  }
};


// Emitter will make particles
class Emitter {
  #particles_ = [];
  #emissionTime_ = 0;
  #numParticlesEmitted_ = 0;
  #params_ = null;

  #dead_ = false;

  constructor(params) {
    this.#params_ = params;
  }

  dispose() {
    if (this.#params_.onDestroy) {
      for (let i = 0; i < this.#particles_.length; ++i) {
        this.#params_.onDestroy(this.#particles_[i]);
      }
    }
    this.#particles_ = [];

    if (this.#params_.renderer) {
      this.#params_.renderer.dispose();
    }
  }

  get StillActive() {
    if (this.#dead_) {
      return false;
    }

    return (
      this.#numParticlesEmitted_ < this.#params_.maxEmission ||
      this.#particles_.length > 0
    );
  }

  stop() {
    this.#params_.maxEmission = 0;
  }

  kill() {
    this.#dead_ = true
  }

  #canCreateParticle_() {
    if (this.#dead_) {
      return false;
    }

    const secondsPerParticle = 1 / this.#params_.emissionRate;

    return (
        this.#emissionTime_ >= secondsPerParticle &&
        this.#particles_.length < this.#params_.maxParticles &&
        this.#numParticlesEmitted_ < this.#params_.maxEmission);
  }

  #emitParticle_() {
    const p = this.#params_.shape.emit();

    p.maxLife = this.#params_.maxLife;

    const phi = MATH.random() * Math.PI * 2;
    const theta = MATH.random() * this.#params_.rotationAngularVariance;

    p.velocity = new THREE.Vector3(
        Math.sin(theta) * Math.cos(phi),
        Math.cos(theta),
        Math.sin(theta) * Math.sin(phi)
    );

    const velocity = (
        this.#params_.velocityMagnitude +
        (MATH.random() * 2 - 1) * this.#params_.velocityMagnitudeVariance);

    p.velocity.multiplyScalar(velocity);
    p.velocity.applyQuaternion(this.#params_.rotation);

    if (this.#params_.onCreated) {
      this.#params_.onCreated(p);
    }

    return p;
  }

  #updateEmission_(timeElapsed) {
    if (this.#dead_) {
      return;
    }

    this.#emissionTime_ += timeElapsed;
    const secondsPerParticle = 1 / this.#params_.emissionRate;

    while (this.#canCreateParticle_()) {
      this.#emissionTime_ -= secondsPerParticle;
      this.#numParticlesEmitted_++;
      const particle = this.#emitParticle_();

      this.#particles_.push(particle);
    }
  }

  #updateParticle_(p, timeElapsed) {
    p.life += timeElapsed;
    p.life = Math.min(p.life, p.maxLife);

    // Update position based on velocity and gravity
    const forces = this.#params_.gravity ? GRAVITY.clone() : new THREE.Vector3();
    forces.multiplyScalar(this.#params_.gravityStrength);
    forces.add(p.velocity.clone().multiplyScalar(-this.#params_.dragCoefficient));

    for (let i = 0; i < this.#params_.attractors.length; ++i) {
      const attractor = this.#params_.attractors[i];
      const direction = attractor.position.clone().sub(p.position);
      const distance = direction.length();
      direction.normalize();

      const attractorForce = attractor.intensity / (1 + (distance / attractor.radius) ** 2);
      forces.add(direction.multiplyScalar(attractorForce));
    }

    p.velocity.add(forces.multiplyScalar(timeElapsed));

    const displacement = p.velocity.clone().multiplyScalar(timeElapsed);
    p.position.add(displacement);

    if (this.#params_.onStep) {
      this.#params_.onStep(p);
    }

    if (p.life >= p.maxLife) {
      if (this.#params_.onDestroy) {
        this.#params_.onDestroy(p);
      }
    }
  }

  #updateParticles_(timeElapsed) {
    for (let i = 0; i < this.#particles_.length; ++i) {
      const p = this.#particles_[i];
      this.#updateParticle_(p, timeElapsed);
    }

    this.#particles_ = this.#particles_.filter(p => p.life < p.maxLife);
  }

  step(timeElapsed, totalTimeElapsed) {
    this.#updateEmission_(timeElapsed);
    this.#updateParticles_(timeElapsed);

    if (this.#params_.renderer) {
      this.#params_.renderer.updateFromParticles(
        this.#particles_, this.#params_, totalTimeElapsed);
    }
  }
};


export {
    ParticleSystem, ParticleRenderer, ParticleRendererParams,
    PointShape, ParticleAttractor,
    Emitter, EmitterParams,
    Particle, EmitterShape
};