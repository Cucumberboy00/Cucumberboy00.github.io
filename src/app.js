import * as THREE from "../node_modules/three/build/three.module.js"
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';
import { Pane } from 'tweakpane';

import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { SMAAPass } from 'three/addons/postprocessing/SMAAPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { BrightnessContrastShader } from 'three/addons/shaders/BrightnessContrastShader.js';

import { LUTPass } from 'three/addons/postprocessing/LUTPass.js';
import { LUTCubeLoader } from 'three/addons/loaders/LUTCubeLoader.js';

import { BloomPass } from './bloomPass.js';


class App {

  #threejs_ = null;
  #camera_ = null;
  #scene_ = null;
  #clock_ = null;

  #debugUI_ = null;

  #composer_ = null;

  constructor() {
  }

  async initialize() {
    this.#clock_ = new THREE.Clock(true);

    window.addEventListener('resize', () => {
      this.#onWindowResize_();
    }, false);

    await this.#setupProject_();

    this.#onWindowResize_();
    this.#raf_();
  }

  async #setupProject_() {
    await this.#setupRenderer_();

    // Initialize project
    const projectFolder = this.#debugUI_.addFolder({ title: 'Project', expanded: true });

    await this.onSetupProject(projectFolder);
  }

  async #setupRenderer_() {
    this.#threejs_ = new THREE.WebGLRenderer( { antialias: true } );
    this.#threejs_.shadowMap.enabled = true;
    this.#threejs_.shadowMap.type = THREE.PCFSoftShadowMap;
    this.#threejs_.toneMapping = THREE.ACESFilmicToneMapping;
    this.#threejs_.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(this.#threejs_.domElement);

    this.#debugUI_ = new Pane();

    const fov = 60;
    const aspect = window.innerWidth / window.innerHeight;
    const near = 0.1;
    const far = 1000;
    this.#camera_ = new THREE.PerspectiveCamera(fov, aspect, near, far);
    this.#camera_.position.set(-2, 0.5, 1);
    this.#camera_.lookAt(new THREE.Vector3(0, 0, 0));

    const controls = new OrbitControls(this.#camera_, this.#threejs_.domElement);
    controls.enableDamping = true;
    controls.target.set(0, 0, 0);
    controls.minDistance = 2.25;
    controls.maxDistance = 5;
    controls.minPolarAngle = Math.PI / 4;
    controls.maxPolarAngle = Math.PI / 2;
    controls.update();

    this.#scene_ = new THREE.Scene();
    this.#scene_.background = new THREE.Color(0x000000);

    // Scene tweaks
    this.#scene_.backgroundBlurriness = 0.0;
    this.#scene_.backgroundIntensity = 1;
    this.#scene_.environmentIntensity = 1;
    const sceneFolder = this.#debugUI_.addFolder({ title: 'Scene', expanded: false });
    sceneFolder.addBinding(this.#scene_, 'backgroundBlurriness', { min: 0.0, max: 1.0 });
    sceneFolder.addBinding(this.#scene_, 'backgroundIntensity', { min: 0.0, max: 1.0 });
    sceneFolder.addBinding(this.#scene_, 'environmentIntensity', { min: 0.0, max: 1.0 });

    const postFXFolder = this.#debugUI_.addFolder({ title: 'Post FX', expanded: false });

    await this.#setupPostprocessing_(postFXFolder);
  }

  async #setupPostprocessing_(pane) {

    const halfFloatOptions = {
      type: THREE.FloatType,
    };
    const halfFloatTarget = new THREE.WebGLRenderTarget(window.innerWidth, window.innerHeight, halfFloatOptions);

    this.#composer_ = new EffectComposer(this.#threejs_);
    const renderPass = new RenderPass(this.#scene_, this.#camera_);
    const outputPass = new OutputPass();

    const smaaPass = new SMAAPass(window.innerWidth, window.innerHeight);
    const smaaFolder = pane.addFolder({ title: 'SMAA' });
    smaaFolder.addBinding(smaaPass, 'enabled');

    // LUTS
    const lutPass = new LUTPass();

    const luts = {
      'Rec709_Fujifilm_3510_D65': './resources/luts/Rec709_Fujifilm_3510_D65.cube',
      'Rec709_Kodak_2383_D65': './resources/luts/Rec709_Kodak_2383_D65.cube',
      'Rec709_Kodak_2393_D65': './resources/luts/Rec709_Kodak_2393_D65.cube',
    };

    const lutPathToTexture = {};
    const lutManager = new THREE.LoadingManager();
    for (const key in luts) {
      const lutPath = luts[key];

      const loader = new LUTCubeLoader(lutManager);
      loader.load(lutPath, (texture) => {
        lutPathToTexture[lutPath] = texture;
      });
    }
    const lutFolder = pane.addFolder({ title: 'LUT' });

    lutManager.onLoad = () => {
      const options = {
        lut: luts['Rec709_Fujifilm_3510_D65'],
      };
      lutPass.intensity = 0.5;
      lutPass.lut = lutPathToTexture[options.lut].texture3D;
      lutFolder.addBinding(lutPass, 'enabled');
      lutFolder.addBinding(lutPass, 'intensity', { min: 0.0, max: 1.0 });
      lutFolder.addBinding(options, 'lut', {
        options: luts,
      }).on('change', (e) => {
        const lut = lutPathToTexture[e.value];

        lutPass.lut = lut.texture3D;
      });
    };

    // Shader pass
    const vsh = await fetch('resources/shaders/vignette-vsh.glsl');
    const fsh = await fetch('resources/shaders/vignette-fsh.glsl');

    const vshText = await vsh.text();
    const fshText = await fsh.text();

    const shaderData = {
      vertexShader: vshText,
      fragmentShader: fshText,
      uniforms: {
        tDiffuse: { value: null },
        time: { value: 0.0 },
        intensity: { value: 0.4 },
        dropoff: { value: 0.25 },
      },
    };
    const vignettePass = new ShaderPass(shaderData);

    const shaderOptions = {
      intensity: shaderData.uniforms.intensity.value,
      dropoff: shaderData.uniforms.dropoff.value,
    };
    const shaderFolder = pane.addFolder({ title: 'vignette' });
    shaderFolder.addBinding(vignettePass, 'enabled');
    shaderFolder.addBinding(shaderOptions, 'intensity', { min: 0.0, max: 1.0 }).on('change', (e) => {
      vignettePass.material.uniforms.intensity.value = e.value;
    });
    shaderFolder.addBinding(shaderOptions, 'dropoff', { min: 0.0, max: 1.0 }).on('change', (e) => {
      vignettePass.material.uniforms.dropoff.value = e.value;
    });

    const colorCorrectionFolder = pane.addFolder({ title: 'Color Correction' });

    const colorCorrectionParams = {
      brightness: 0.0,
      contrast: 0.0,
      hue: 0.0,
      saturation: 1.0,
    };
    const brightnessContrastPass = new ShaderPass(BrightnessContrastShader);
    colorCorrectionFolder.addBinding(brightnessContrastPass, 'enabled');
    colorCorrectionFolder.addBinding(colorCorrectionParams, 'brightness', { min: 0.0, max: 2.0 }).on('change', (e) => {
      brightnessContrastPass.material.uniforms.brightness.value = e.value;
    });
    colorCorrectionFolder.addBinding(colorCorrectionParams, 'contrast', { min: 0.0, max: 2.0 }).on('change', (e) => {
      brightnessContrastPass.material.uniforms.contrast.value = e.value;
    });

    const simonBloom = new BloomPass();
    const simonFolder = pane.addFolder({ title: 'Bloom' });
    simonFolder.addBinding(simonBloom, 'enabled');
    const prefilterFolder = simonFolder.addFolder({ title: 'Prefilter', expanded: false });
    prefilterFolder.addBinding(simonBloom.Settings.render, 'brightness', { min: 0.0, max: 2.0 });
    prefilterFolder.addBinding(simonBloom.Settings.render, 'contrast', { min: 0.0, max: 2.0 });
    prefilterFolder.addBinding(simonBloom.Settings.render, 'saturation', { min: 0.0, max: 2.0 });
    simonFolder.addBinding(simonBloom.Settings.composite, 'strength', { min: 0.0, max: 2.0 });
    simonFolder.addBinding(simonBloom.Settings.composite, 'mixFactor', { min: 0.0, max: 1.0 });


    this.#composer_.addPass(renderPass);
    this.#composer_.addPass(smaaPass);
    this.#composer_.addPass(brightnessContrastPass);
    this.#composer_.addPass(lutPass);
    this.#composer_.addPass(simonBloom);
    this.#composer_.addPass(vignettePass);
    this.#composer_.addPass(outputPass);
  }


  #onWindowResize_() {
    // Intentionally ignoring DPR for now
    // const dpr = window.devicePixelRatio;
    const dpr = 1;

    const canvas = this.#threejs_.domElement;
    canvas.style.width = window.innerWidth + 'px';
    canvas.style.height = window.innerHeight + 'px';
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;

    const aspect = w / h;

    this.#threejs_.setSize(w, h, false);
    this.#camera_.aspect = aspect;
    this.#camera_.updateProjectionMatrix();

    this.#composer_.setSize(w * dpr, h * dpr);

    this.onResize(w * dpr, h * dpr);
  }

  #raf_() {
    requestAnimationFrame((t) => {
      const timeElapsed = Math.min(this.#clock_.getDelta(), 0.1);
      this.#step_(timeElapsed);
      this.#render_();
      this.#raf_();
    });
  }

  #render_() {
    this.onRender();
    // this.#threejs_.render(this.#scene_, this.#camera_);
    this.#composer_.render();
  }

  #step_(timeElapsed) {
    this.onStep(timeElapsed, this.#clock_.getElapsedTime());
  }

  async loadRGBE(path) {
    return new Promise((resolve, reject) => {
      const rgbeLoader = new RGBELoader();
      rgbeLoader.load(path , (hdrTexture) => {
        hdrTexture.mapping = THREE.EquirectangularReflectionMapping;
        resolve(hdrTexture);
      });
    });
  }

  // Override these methods
  async onSetupProject() {
  }

  onResize(x, y) {

  }

  onRender() {
  }

  onStep(timeElapsed, totalTimeElapsed) {
  }

  onResize() {
  }

  // Getters
  get Scene() { return this.#scene_; }
  get Camera() { return this.#camera_; }
  get Renderer() { return this.#threejs_; }
}


export { App };