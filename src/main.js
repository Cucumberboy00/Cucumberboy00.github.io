import * as THREE from "../node_modules/three/build/three.module.js"
import { GLTFLoader } from '../node_modules/three/examples/jsm/loaders/GLTFLoader.js';

import { App } from './app.js';
import { GlobeCamera } from './globe-camera.js';
import * as MATH from './math.js';
import * as PARTICLES from './particle-system.js';
import * as NOISE from './noise.js';

import { EffectComposer } from '../node_modules/three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from '../node_modules/three/examples/jsm/postprocessing/RenderPass.js';
import { GTAOPass } from '../node_modules/three/examples/jsm/postprocessing/GTAOPass.js';


import { TextureArrayLoader } from './texture-atlas.js';


async function loadAtlas(names) {
  const loader = new TextureArrayLoader();
  return new Promise((resolve, reject) => {
    loader.load(names, (textureArray) => {
      resolve(textureArray);
    });
  });
}

class PlaneShape extends PARTICLES.EmitterShape {
  #transform_ = new THREE.Matrix4();
  #dimensions_ = new THREE.Vector2(1, 1);

  constructor(dimensions, transform) {
    super();

    this.#transform_.copy(transform);
    this.#dimensions_.copy(dimensions);
  }

  emit() {
    const p = new PARTICLES.Particle();

    p.position.set(
        MATH.randomRange(-this.#dimensions_.x, this.#dimensions_.x),
        0,
        MATH.randomRange(-this.#dimensions_.y, this.#dimensions_.y));
    p.position.applyMatrix4(this.#transform_);

    return p;
  }
};



class ParticleProject extends App {

  #globeScene_ = null;
  #snowGlobeReflectionCamera_ = null;
  #globeRT_ = null;
  #currentPosition_ = new THREE.Vector3(1, 1.5, 0.2);
  #snowGlobeMesh_ = null;
  #snowSceneComposer_ = null;
  #snowSceneCamera_ = null;
  #particleSystem_ = null;
  sled;

  constructor() {
    super();
  }

  async onSetupProject(pane) {
    this.Scene.background = await this.loadRGBE('./resources/skybox/rosendal_park_sunset_1k.hdr');
 
    await this.#setupSnowScene_(pane);
    await this.#setupSnowGlobe_(pane);
  }

  async #setupSnowGlobe_(pane) {
    // Create a sphere to act as the snow globe
    const folder = pane.addFolder({ title: 'Material', expanded: false });

    const sphereGeo = new THREE.SphereGeometry(1, 32, 32);
    const sphereMat = await this.loadShader('globe', {
      reflectionTexture: { value: this.#globeRT_.texture },
      refractionTexture: { value: null },
      resolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) },
    });

    const sphereMesh = new THREE.Mesh(sphereGeo, sphereMat);
    this.Scene.add(sphereMesh);
    this.#snowGlobeMesh_ = sphereMesh;
  }

  async #setupSnowScene_(pane) {
    const options = {
      magFilter: THREE.LinearFilter,
      minFilter: THREE.LinearMipmapLinearFilter,
      generateMipmaps: true,
      format: THREE.RGBAFormat,
      type: THREE.HalfFloatType,
    };
    this.#globeRT_ = new THREE.WebGLCubeRenderTarget(128, options);
  
    this.#globeScene_ = new THREE.Scene();
    this.#globeScene_.background = await this.loadRGBE('./resources/skybox/snow_in_the_woods_2k.hdr');
    this.#globeScene_.backgroundIntensity = 0.25;
    this.#snowGlobeReflectionCamera_ = new THREE.CubeCamera(0.1, 100, this.#globeRT_);

    // In case you want to change anything about the camera
    this.#snowSceneCamera_ = new THREE.PerspectiveCamera(80, window.innerWidth / window.innerHeight, 0.1, 100);

    this.#snowSceneComposer_ = new EffectComposer(this.Renderer);
    this.#snowSceneComposer_.renderToScreen = false;

    const gtaoPass = new GTAOPass(this.#globeScene_, this.#snowSceneCamera_);
    gtaoPass.output = GTAOPass.OUTPUT.Default;

    const aoParameters = {
      radius: 0.1,
      distanceExponent: 1.,
      thickness: 1.,
      scale: 1.,
      samples: 4,
      distanceFallOff: 1.,
      screenSpaceRadius: false,
    };
    const pdParameters = {
      lumaPhi: 10.,
      depthPhi: 2.,
      normalPhi: 3.,
      radius: 4.,
      radiusExponent: 1.,
      rings: 2.,
      samples: 4,
    };
    gtaoPass.blendIntensity = 0.5;
    gtaoPass.updateGtaoMaterial( aoParameters );
    gtaoPass.updatePdMaterial( pdParameters );

    const gtaoFolder = pane.addFolder({ title: 'GTAO', expanded: false });
    gtaoFolder.addBinding(gtaoPass, 'enabled');
    gtaoFolder.addBinding(gtaoPass, 'output', {
      options: {
        'Default': GTAOPass.OUTPUT.Default,
        'Diffuse': GTAOPass.OUTPUT.Diffuse,
        'AO Only': GTAOPass.OUTPUT.AO,
        'AO Only + Denoise': GTAOPass.OUTPUT.Denoise,
        'Depth': GTAOPass.OUTPUT.Depth,
        'Normal': GTAOPass.OUTPUT.Normal
      }
    });
    gtaoFolder.addBinding(gtaoPass, 'blendIntensity', { min: 0.0, max: 1.0 });
    gtaoFolder.addBinding(aoParameters, 'samples', { min: 1, max: 32, step: 1 }).on('change', (e) => {
      gtaoPass.updateGtaoMaterial( aoParameters );
    });
    gtaoFolder.addBinding(aoParameters, 'radius', { min: 0.0, max: 1.0 }).on('change', (e) => {
      gtaoPass.updateGtaoMaterial( aoParameters );
    });

    const renderPass = new RenderPass(this.#globeScene_, this.#snowSceneCamera_);

    this.#snowSceneComposer_.addPass(renderPass);
    this.#snowSceneComposer_.addPass(gtaoPass);


    const whiteSquareTexture = new THREE.TextureLoader().load('resources/textures/image.png');
    whiteSquareTexture.wrapS = THREE.RepeatWrapping;
    whiteSquareTexture.wrapT = THREE.RepeatWrapping;
    whiteSquareTexture.repeat.set(16, 16);
    whiteSquareTexture.anisotropy = 16;
    const groundGeo = new THREE.PlaneGeometry(2, 2);
    const groundMat = new THREE.MeshStandardMaterial({
      color: 0xFFFFFF,
      map: whiteSquareTexture,
      metalness: 0.5,
      roughness: 0.6,
    });
    const groundMesh = new THREE.Mesh(groundGeo, groundMat);
    groundMesh.rotation.x = -Math.PI / 2;
    groundMesh.receiveShadow = true;
    groundMesh.position.y -= 0.5;
    this.#globeScene_.add(groundMesh);

    // Sun light
    const sunLight = new THREE.DirectionalLight(0xFFFFFF, 2);
    sunLight.position.set(-1, 1, -1);
    sunLight.target.position.set(0, 0, 0);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.setScalar(1024);
    sunLight.shadow.camera.left = -5;
    sunLight.shadow.camera.right = 5;
    sunLight.shadow.camera.top = 5;
    sunLight.shadow.camera.bottom = -5;
    this.#globeScene_.add(sunLight);
    this.#globeScene_.add(sunLight.target);

    // Hemi light
    const hemiLight = new THREE.HemisphereLight(0xFFFFFF, 0x808020, 1);
    this.#globeScene_.add(hemiLight);

    // Add a tree
    const glbTree = await this.loadGLB('./resources/models/snowman/snowman.glb');
    glbTree.scene.traverse(c => {
      c.castShadow = true;
      c.receiveShadow = true;
    });
    glbTree.scene.scale.setScalar(0.2);

    
    const positions = [
      new THREE.Vector3(0, -0.5, 0),
    ];

    for (let i = 0; i < positions.length; i++) {
      const tree = glbTree.scene.clone();
      tree.position.copy(positions[i]);
      this.#globeScene_.add(tree);
    }

    const glbSled = await this.loadGLB('./resources/models/sled/sled.gltf')
   
    glbSled.scene.traverse(c => {
      c.castShadow = true;
      c.receiveShadow = true;
    });
    glbSled.scene.scale.setScalar(0.05);

    const sledPositions = [
      new THREE.Vector3(0, 0.5, 0),
    ];
    for (let i = 0; i < sledPositions.length; i++) { 
      this.sled = glbSled.scene.clone();
      this.sled.position.copy(sledPositions[i]);
      this.#globeScene_.add(this.sled);
    }

    const glbLamp = await this.loadGLB('./resources/models/lamp/lamp.glb')
   
    glbLamp.scene.traverse(c => {
      c.castShadow = true;
      c.receiveShadow = true;
    });

    glbLamp.scene.scale.setScalar(200.0);
    this.lamp = glbLamp.scene.clone();
    this.lamp.position.copy(0,0,0);
    this.#globeScene_.add(this.lamp);

    await this.#createParticleSystem_();
  }

  async #createParticleSystem_() {

    const atlasTextures = [
      './resources/textures/snowflake1.png',
      './resources/textures/snowflake2.png',
      './resources/textures/snowflake3.png',      
    ];
    const snowflakeAtlas = await loadAtlas(atlasTextures);

    const textureLoader = new THREE.TextureLoader();
    const sledTexture = textureLoader.load('./resources/textures/magic_05.png');

    const vsh = await fetch('./resources/shaders/points-vsh.glsl');
    const fsh = await fetch('./resources/shaders/points-fsh.glsl');
    const vshText = await vsh.text();
    const fshText = await fsh.text();

    const vsh2 = await fetch('./resources/shaders/points-vsh2.glsl');
    const fsh2 = await fetch('./resources/shaders/points-fsh2.glsl');
    const vshText2 = await vsh2.text();
    const fshText2 = await fsh2.text();


    this.#particleSystem_ = new PARTICLES.ParticleSystem();
      
    const sledRendererParams = new PARTICLES.ParticleRendererParams();
    sledRendererParams.maxParticles = 1000;
    const snowRendererParams = new PARTICLES.ParticleRendererParams();
    snowRendererParams.maxParticles = 1000;

        // Sled Trail
    {
      const sizeOverLife = new MATH.FloatInterpolant([
        { time: 0, value: 0.1 },
        { time: 4, value: 0.2 },
      ]);
  
      const twinkleOverLife = new MATH.FloatInterpolant([
        { time: 0, value: 1 },
        { time: 1, value: 1 },
      ]);
  
      const alphaOverLife = new MATH.FloatInterpolant([
        { time: 0, value: 1 },
        { time: 0.25, value: 0 },
        { time: 3, value: 1 },
        { time: 4, value: 0 },
      ]);
  
      const colourOverLife = new MATH.ColorInterpolant([
        { time: 0, value: new THREE.Color(0, 0.9, 0.11).convertSRGBToLinear() },
        { time: 2, value: new THREE.Color(0.3, 0.7, 0.11).convertSRGBToLinear() },
        { time: 4, value: new THREE.Color(1, 0, 0).convertSRGBToLinear() },
      ]);

      const additiveOverLife = new MATH.FloatInterpolant([
        { time: 0, value: 0 },
        { time: 1, value: 0 },
        { time: 2.5, value: 0 },
        { time: 4, value: 0 },
      ]);

      const sledparticleMaterial = new THREE.ShaderMaterial({
        uniforms: {
          time: { value: 0 },
          map: { value: sledTexture },
          sizeOverLife: { value: sizeOverLife.toTexture() },
          colourOverLife: { value: colourOverLife.toTexture(alphaOverLife) },
          twinkleOverLife: { value: twinkleOverLife.toTexture() },
          additiveOverLife: { value: additiveOverLife.toTexture() },
          lineVariance: { value: 0.4 },
          spinSpeed: { value: 0 },
          lightFactor: { value: 1 },
          lightIntensity: { value: 2 },
          skyLight: { value: new THREE.Color(0.86, 0.93, 0.98).convertSRGBToLinear() },
          downLight: { value: new THREE.Color(0.91, 0.88, 0.84).convertSRGBToLinear() },
        },
        vertexShader: vshText2,
        fragmentShader: fshText2,
        transparent: true,
        depthWrite: false,
        depthTest: true,
        // blending: THREE.AdditiveBlending,
        blending: THREE.CustomBlending,
        blendEquation: THREE.AddEquation,
        blendSrc: THREE.OneFactor,
        blendDst: THREE.OneMinusSrcAlphaFactor,
      });
  
      
      this.sledEmitterParams = new PARTICLES.EmitterParams();
      this.sledEmitterParams.shape = new PARTICLES.PointShape();
      this.sledEmitterParams.shape.position.set(this.#currentPosition_.x, this.#currentPosition_.y, this.#currentPosition_.z)
      this.sledEmitterParams.shape.positionRadiusVariance = 0.0;
      this.sledEmitterParams.shape.lineVariance = 0.05;
      this.sledEmitterParams.maxLife = 1;
      this.sledEmitterParams.maxLifeVariance = 1;
      this.sledEmitterParams.maxParticles = 2000;
      this.sledEmitterParams.emissionRate = 500;
      this.sledEmitterParams.maxEmission = Number.MAX_SAFE_INTEGER;
      this.sledEmitterParams.gravity = false;
      this.sledEmitterParams.velocityMagnitude = 0;
      this.sledEmitterParams.rotation = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), -Math.PI/2);
      this.sledEmitterParams.spinSpeed = Math.PI / 2;
      this.sledEmitterParams.camera = this.Camera;
      this.sledEmitterParams.dragCoefficient = 0.0;
  
      this.sledrenderer = new PARTICLES.ParticleRenderer(); 
      this.sledrenderer.initialize(sledparticleMaterial, sledRendererParams);
      this.sledEmitterParams.renderer = this.sledrenderer;

      
      this.#particleSystem_.addEmitter(new PARTICLES.Emitter(this.sledEmitterParams));
      this.#globeScene_.add(sledRendererParams.group);
    }

    // Falling snow
    {
      const sizeOverLife = new MATH.FloatInterpolant([
        { time: 0, value: 0.05 },
        { time: 4, value: 0.1 },
      ]);
  
      const twinkleOverLife = new MATH.FloatInterpolant([
        { time: 0, value: 1 },
        { time: 1, value: 1 },
      ]);
  
      const alphaOverLife = new MATH.FloatInterpolant([
        { time: 0, value: 0 },
        { time: 0.25, value: 1 },
        { time: 3, value: 1 },
        { time: 4, value: 0 },
      ]);
  
      const colourOverLife = new MATH.ColorInterpolant([
        { time: 0, value: new THREE.Color(1, 1, 1).convertSRGBToLinear() },
        { time: 4, value: new THREE.Color(1, 1, 1).convertSRGBToLinear() },
      ]);

      const additiveOverLife = new MATH.FloatInterpolant([
        { time: 0, value: 0 },
        { time: 1, value: 0 },
        { time: 2.5, value: 0 },
        { time: 4, value: 0 },
      ]);

      const snowflakeMaterial = new THREE.ShaderMaterial({
        uniforms: {
          time: { value: 0 },
          map: { value: snowflakeAtlas },
          sizeOverLife: { value: sizeOverLife.toTexture() },
          colourOverLife: { value: colourOverLife.toTexture(alphaOverLife) },
          twinkleOverLife: { value: twinkleOverLife.toTexture() },
          additiveOverLife: { value: additiveOverLife.toTexture() },
          spinSpeed: { value: 0 },
          lightFactor: { value: 1 },
          lightIntensity: { value: 2 },
          skyLight: { value: new THREE.Color(0.86, 0.93, 0.98).convertSRGBToLinear() },
          downLight: { value: new THREE.Color(0.91, 0.88, 0.84).convertSRGBToLinear() },
          numSnowTextures: { value: atlasTextures.length },
        },
        vertexShader: vshText,
        fragmentShader: fshText,
        transparent: true,
        depthWrite: false,
        depthTest: true,
        // blending: THREE.AdditiveBlending,
        blending: THREE.CustomBlending,
        blendEquation: THREE.AddEquation,
        blendSrc: THREE.OneFactor,
        blendDst: THREE.OneMinusSrcAlphaFactor,
      });
  
      const snowPlaneTransform =  new THREE.Matrix4().compose(
          new THREE.Vector3(0, 1.5, 0),
          new THREE.Quaternion(),
          new THREE.Vector3(1, 1, 1));
      const snowPlane = new PlaneShape(new THREE.Vector2(2, 2), snowPlaneTransform);

      const snowEmitterParams = new PARTICLES.EmitterParams();
      snowEmitterParams.shape = snowPlane;
      snowEmitterParams.maxLife = 5;
      snowEmitterParams.maxLifeVariance = 1;
      snowEmitterParams.maxParticles = 1000;
      snowEmitterParams.emissionRate = 200;
      snowEmitterParams.maxEmission = Number.MAX_SAFE_INTEGER;
      snowEmitterParams.gravity = true;
      snowEmitterParams.spinSpeed = 5.0;
      snowEmitterParams.camera = this.Camera;
      snowEmitterParams.dragCoefficient = 20.0;
  
      this.snowRenderer = new PARTICLES.ParticleRenderer(); 
      this.snowRenderer.initialize(snowflakeMaterial, snowRendererParams);
      snowEmitterParams.renderer = this.snowRenderer;

      this.#particleSystem_.addEmitter(new PARTICLES.Emitter(snowEmitterParams));
      this.#globeScene_.add(snowRendererParams.group);
    }
  }

  async loadGLB(path) {
    return new Promise((resolve, reject) => {
      const loader = new GLTFLoader();
      loader.load(path, resolve, undefined, reject);

    });
  }

  async loadShader(name, uniforms) {
    const vert = await fetch(`./resources/shaders/${name}-vsh.glsl`).then((r) => r.text());
    const frag = await fetch(`./resources/shaders/${name}-fsh.glsl`).then((r) => r.text());

    return new THREE.ShaderMaterial({
      uniforms: uniforms,
      vertexShader: vert,
      fragmentShader: frag,
    });
  }

  onResize(width, height) {
    this.#snowSceneComposer_.setSize(width, height);
    this.#snowGlobeMesh_.material.uniforms.resolution.value.set(width, height);

    this.#snowSceneCamera_.aspect = width / height;
    this.#snowSceneCamera_.updateProjectionMatrix();
  }

  onRender() {
    if (this.#snowGlobeMesh_ === undefined) {
      return;
    }

    // We're going to render anything around the snow globe into a cube map.
    // This will be used to simulate reflections on the globe.
    // Note: If you don't add anything else to the scene, you can skip this step
    // and just use the skybox as the reflection.
    this.#snowGlobeMesh_.visible = false;
    this.#snowGlobeReflectionCamera_.update(this.Renderer, this.Scene);
    this.#snowGlobeMesh_.visible = true;

    // So what happens here is that we copy the camera's transform to the
    // snow scene's camera. This is because we're going to render the scene using
    // the snowSceneComposer, which will render the scene into a texture. That
    // texture will be used as the refraction texture for the snow globe.
    // We're using a full effect composer here because we want to apply post fx,
    // like GTAO, to the scene inside the globe.
    this.#snowSceneCamera_.position.copy(this.Camera.position);
    this.#snowSceneCamera_.quaternion.copy(this.Camera.quaternion);
    this.#snowSceneComposer_.render();

    // Now that we've rendered the refraction texture, we can set it on the snow globe.
    this.#snowGlobeMesh_.material.uniforms.refractionTexture.value = this.#snowSceneComposer_.readBuffer.texture;
  }

  onStep(timeElapsed, totalTime) {
    if (this.#particleSystem_ === null) {
      return;
    }
    this.sled.position.x = Math.sin(totalTime) * 0.8; // Example animation
    this.sled.position.z = Math.cos(totalTime) * 0.8; // Example animation
    this.sled.rotation.y = Math.atan2(this.sled.position.x, this.sled.position.z)+ Math.PI;
    // this.sled.rotation.x = Math.sin(totalTime * 2) * 0.1;
    // this.sled.rotation.z = Math.sin(totalTime * 2) * 0.1;
   
    
   
    if(this.sledEmitterParams.shape){
      let currentPosition = new THREE.Vector3();
      currentPosition.copy(this.sled.position);
      let behindPosition = new THREE.Vector3(0.15, 0, 0);
      behindPosition.applyQuaternion(this.sled.quaternion);
      currentPosition.add(behindPosition);
      this.#currentPosition_ = currentPosition;
      this.sledEmitterParams.shape.position.set(this.#currentPosition_.x, this.#currentPosition_.y, this.#currentPosition_.z);
      let emitterRotation = new THREE.Quaternion();
      emitterRotation.copy(this.sled.quaternion);
      emitterRotation.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), -Math.PI/2)); // Rotate 180 degrees around the X-axis
      this.sledEmitterParams.rotation.copy(emitterRotation);
    }
    
    this.#particleSystem_.step(timeElapsed, totalTime);
  }
}


let APP_ = new ParticleProject();

window.addEventListener('DOMContentLoaded', async () => {
  await APP_.initialize();
});
