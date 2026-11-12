import {
  BackSide,
  Color,
  DirectionalLight,
  Mesh,
  MeshBasicMaterial,
  ShaderMaterial,
  SphereGeometry,
} from "three";

const DAY_LENGTH_SECONDS = 20 * 60;

const SKY_VERTEX_SHADER = `
varying vec2 vUv;
varying vec3 vDirection;

void main() {
  vUv = uv;
  vDirection = normalize(position);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const SKY_FRAGMENT_SHADER = `
precision mediump float;

uniform vec3 uHorizonColor;
uniform vec3 uZenithColor;
uniform float uTime;
uniform bool uCloudsEnabled;
varying vec2 vUv;
varying vec3 vDirection;

float hash2(vec2 point) {
  return fract(52.9829189 * fract(dot(point, vec2(0.06711056, 0.00583715))));
}

float noise2(vec2 point) {
  vec2 cell = floor(point);
  vec2 local = fract(point);
  local = local * local * (3.0 - 2.0 * local);
  float lower = mix(hash2(cell), hash2(cell + vec2(1.0, 0.0)), local.x);
  float upper = mix(hash2(cell + vec2(0.0, 1.0)), hash2(cell + vec2(1.0)), local.x);
  return mix(lower, upper, local.y);
}

void main() {
  float skyHeight = clamp(vDirection.y, 0.0, 1.0);
  vec3 color = mix(uHorizonColor, uZenithColor, skyHeight);

  if (uCloudsEnabled) {
    vec2 cloudUv = vUv * vec2(10.0, 5.0) + vec2(uTime * 0.008, uTime * 0.002);
    float cloud = smoothstep(0.56, 0.72, noise2(cloudUv));
    color = mix(color, vec3(0.88, 0.93, 1.0), cloud * 0.32);
  }

  gl_FragColor = vec4(color, 1.0);
}
`;

function smoothstep(edge0, edge1, value) {
  const t = Math.max(0, Math.min(1, (value - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

export class Sky {
  constructor(scene, ambientLight) {
    this.scene = scene;
    this.ambientLight = ambientLight;
    this.scene.background = new Color(0x9bd9ff);
    this.time = 0.34;
    this.cloudTime = 0;
    this.skyMaterial = new ShaderMaterial({
      uniforms: {
        uHorizonColor: { value: new Color(0x9bd9ff) },
        uZenithColor: { value: new Color(0x3977bf) },
        uTime: { value: this.cloudTime },
        uCloudsEnabled: { value: !window.gameSettings?.lowQuality },
      },
      vertexShader: SKY_VERTEX_SHADER,
      fragmentShader: SKY_FRAGMENT_SHADER,
      side: BackSide,
      depthWrite: false,
      fog: false,
    });
    this.sky = new Mesh(new SphereGeometry(150, 16, 12), this.skyMaterial);
    this.sky.frustumCulled = false;
    this.sky.renderOrder = -1;
    scene.add(this.sky);

    this.sunlight = new DirectionalLight(0xffe6bd, 2.2);
    this.sunlight.position.set(0, 60, 0);
    scene.add(this.sunlight);

    this.sun = new Mesh(
      new SphereGeometry(2.4, 12, 8),
      new MeshBasicMaterial({ color: 0xffe6aa, fog: false }),
    );
    this.moon = new Mesh(
      new SphereGeometry(1.7, 12, 8),
      new MeshBasicMaterial({ color: 0xc8d7ff, fog: false }),
    );
    scene.add(this.sun, this.moon);
  }

  update(deltaSeconds, focusPosition, elapsedSeconds = this.cloudTime) {
    this.time = (this.time + deltaSeconds / DAY_LENGTH_SECONDS) % 1;
    this.cloudTime = elapsedSeconds;
    const angle = this.time * Math.PI * 2 - Math.PI / 2;
    const horizontal = Math.cos(angle);
    const altitude = Math.sin(angle);
    const daylight = smoothstep(-0.12, 0.18, altitude);
    const twilight = 1 - smoothstep(0.08, 0.48, Math.abs(altitude));
    const dayColor = new Color(0x9bd9ff);
    const sunsetColor = new Color(0xf19a69);
    const nightColor = new Color(0x101a3c);
    const skyColor = nightColor.clone().lerp(dayColor, daylight).lerp(sunsetColor, twilight * 0.62);
    const zenithColor = nightColor.clone()
      .lerp(new Color(0x3977bf), daylight)
      .lerp(new Color(0x9b5578), twilight * 0.45);
    const lightColor = new Color(0x9db7ff)
      .lerp(new Color(0xfff0d7), daylight)
      .lerp(new Color(0xffa05e), twilight * 0.45);

    this.sky.position.copy(focusPosition);
    this.skyMaterial.uniforms.uHorizonColor.value.copy(skyColor);
    this.skyMaterial.uniforms.uZenithColor.value.copy(zenithColor);
    this.skyMaterial.uniforms.uTime.value = this.cloudTime;
    this.skyMaterial.uniforms.uCloudsEnabled.value = !window.gameSettings?.lowQuality;
    this.scene.background.copy(skyColor);
    if (this.scene.fog) this.scene.fog.color.copy(skyColor);
    this.sunlight.color.copy(lightColor);
    this.sunlight.intensity = 0.12 + daylight * 2.05;
    this.ambientLight.color.copy(new Color(0x51618f).lerp(new Color(0xffffff), daylight));
    this.ambientLight.intensity = 0.3 + daylight * 0.75;

    const orbitRadius = 85;
    const centerY = 35;
    this.sun.position.set(
      focusPosition.x + horizontal * orbitRadius,
      centerY + altitude * orbitRadius,
      focusPosition.z + Math.sin(angle * 0.5) * 24,
    );
    this.moon.position.set(
      focusPosition.x - horizontal * orbitRadius,
      centerY - altitude * orbitRadius,
      focusPosition.z - Math.sin(angle * 0.5) * 24,
    );
    this.sunlight.position.copy(this.sun.position);
    this.sunlight.target.position.set(focusPosition.x, 0, focusPosition.z);
    this.sunlight.target.updateMatrixWorld();
  }

  isNight() {
    const angle = this.time * Math.PI * 2 - Math.PI / 2;
    return Math.sin(angle) <= 0;
  }

  isDay() {
    return !this.isNight();
  }

  skipToMorning(focusPosition) {
    this.time = 0.26;
    this.update(0, focusPosition);
  }

  dispose() {
    this.scene.remove(this.sky, this.sun, this.moon, this.sunlight);
    this.sky.geometry.dispose();
    this.skyMaterial.dispose();
    this.sun.geometry.dispose();
    this.sun.material.dispose();
    this.moon.geometry.dispose();
    this.moon.material.dispose();
  }
}
