import {
  Color,
  DirectionalLight,
  Mesh,
  MeshBasicMaterial,
  SphereGeometry,
} from "three";

const DAY_LENGTH_SECONDS = 20 * 60;

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

  update(deltaSeconds, focusPosition) {
    this.time = (this.time + deltaSeconds / DAY_LENGTH_SECONDS) % 1;
    const angle = this.time * Math.PI * 2 - Math.PI / 2;
    const horizontal = Math.cos(angle);
    const altitude = Math.sin(angle);
    const daylight = smoothstep(-0.12, 0.18, altitude);
    const twilight = 1 - smoothstep(0.08, 0.48, Math.abs(altitude));
    const dayColor = new Color(0x9bd9ff);
    const sunsetColor = new Color(0xf19a69);
    const nightColor = new Color(0x101a3c);
    const skyColor = nightColor.clone().lerp(dayColor, daylight).lerp(sunsetColor, twilight * 0.62);
    const lightColor = new Color(0x9db7ff)
      .lerp(new Color(0xfff0d7), daylight)
      .lerp(new Color(0xffa05e), twilight * 0.45);

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

  dispose() {
    this.scene.remove(this.sun, this.moon, this.sunlight);
    this.sun.geometry.dispose();
    this.sun.material.dispose();
    this.moon.geometry.dispose();
    this.moon.material.dispose();
  }
}
