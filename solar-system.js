/**
 * ULTRON 2 — HIGH PERFORMANCE THREE.JS 3D SOLAR ENGINE
 * Features: Emissive Star Sun, Real-Time Planetary Orbits, Semi-Transparent Paths,
 * 2000+ Galaxy Starfield Particle Matrix, Mouse Interaction, OrbitControls.
 */

class UltronCosmosEngine {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    if (!this.container || typeof THREE === 'undefined') return;

    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.controls = null;
    this.planets = [];
    this.orbitRings = [];
    this.starfield = null;
    this.sunMesh = null;
    this.sunGlow = null;
    this.animationFrameId = null;

    this.mouse = { x: 0, y: 0, targetX: 0, targetY: 0 };

    try {
      this.init();
    } catch (e) {
      console.warn("Three.js cosmos initialized with fallback:", e);
    }
  }

  init() {
    const width = this.container.clientWidth || window.innerWidth;
    const height = this.container.clientHeight || 192;

    // 1. Scene Setup
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0x000000, 0.0035);

    // 2. Camera Setup
    this.camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    this.camera.position.set(0, 45, 80);

    // 3. Hardware Accelerated WebGL Renderer
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.container.appendChild(this.renderer.domElement);

    // 4. Orbit Controls Setup
    if (typeof THREE.OrbitControls !== 'undefined') {
      this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
      this.controls.enableDamping = true;
      this.controls.dampingFactor = 0.05;
      this.controls.maxDistance = 180;
      this.controls.minDistance = 15;
      this.controls.maxPolarAngle = Math.PI / 2 + 0.1;
    }

    // 5. Illumination Engine
    const ambientLight = new THREE.AmbientLight(0x222222);
    this.scene.add(ambientLight);

    const sunPointLight = new THREE.PointLight(0xffffff, 2.5, 300, 0.5);
    this.scene.add(sunPointLight);

    // 6. Build Celestial Bodies & Cosmos Starfield
    this.buildStarfield(2500);
    this.buildSunCore();
    this.buildPlanetarySystem();

    // 7. Event Listeners
    window.addEventListener('resize', this.onWindowResize.bind(this));
    this.container.addEventListener('mousemove', this.onMouseMove.bind(this));
    this.container.addEventListener('dblclick', this.resetCamera.bind(this));

    // 8. Start Rendering Loop
    this.animate();
  }

  buildStarfield(particleCount) {
    try {
      const geometry = new THREE.BufferGeometry();
      const positions = new Float32Array(particleCount * 3);
      const colors = new Float32Array(particleCount * 3);

      for (let i = 0; i < particleCount * 3; i += 3) {
        positions[i] = (Math.random() - 0.5) * 400;
        positions[i + 1] = (Math.random() - 0.5) * 400;
        positions[i + 2] = (Math.random() - 0.5) * 400;

        const shade = 0.5 + Math.random() * 0.5;
        colors[i] = shade;
        colors[i + 1] = shade;
        colors[i + 2] = shade;
      }

      geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

      const material = new THREE.PointsMaterial({
        size: 0.8,
        vertexColors: true,
        transparent: true,
        opacity: 0.85
      });

      this.starfield = new THREE.Points(geometry, material);
      this.scene.add(this.starfield);
    } catch (e) {}
  }

  buildSunCore() {
    try {
      const sunGeometry = new THREE.SphereGeometry(4.2, 32, 32);
      const sunMaterial = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        wireframe: false
      });
      this.sunMesh = new THREE.Mesh(sunGeometry, sunMaterial);
      this.scene.add(this.sunMesh);

      const coronaGeo = new THREE.SphereGeometry(5.2, 32, 32);
      const coronaMat = new THREE.MeshBasicMaterial({
        color: 0x999999,
        transparent: true,
        opacity: 0.25,
        side: THREE.BackSide
      });
      this.sunGlow = new THREE.Mesh(coronaGeo, coronaMat);
      this.scene.add(this.sunGlow);
    } catch (e) {}
  }

  buildPlanetarySystem() {
    const planetData = [
      { name: "Mercury", radius: 0.8, distance: 9, speed: 0.035, color: 0x888888, tilt: 0.05 },
      { name: "Venus", radius: 1.2, distance: 14, speed: 0.024, color: 0xcccccc, tilt: 0.03 },
      { name: "Earth", radius: 1.4, distance: 20, speed: 0.018, color: 0xffffff, tilt: 0.41 },
      { name: "Mars", radius: 1.0, distance: 26, speed: 0.014, color: 0xaaaaaa, tilt: 0.44 },
      { name: "Jupiter", radius: 2.8, distance: 35, speed: 0.009, color: 0xdddddd, tilt: 0.05 },
      { name: "Saturn", radius: 2.2, distance: 45, speed: 0.006, color: 0x999999, tilt: 0.47, hasRings: true },
      { name: "Uranus", radius: 1.8, distance: 54, speed: 0.004, color: 0xbbbbbb, tilt: 1.7 },
      { name: "Neptune", radius: 1.7, distance: 62, speed: 0.003, color: 0x777777, tilt: 0.5 }
    ];

    planetData.forEach((data) => {
      try {
        const ringGeo = new THREE.RingGeometry(data.distance - 0.08, data.distance + 0.08, 64);
        const ringMat = new THREE.MeshBasicMaterial({
          color: 0x333333,
          side: THREE.DoubleSide,
          transparent: true,
          opacity: 0.4
        });
        const orbitRing = new THREE.Mesh(ringGeo, ringMat);
        orbitRing.rotation.x = Math.PI / 2;
        this.scene.add(orbitRing);
        this.orbitRings.push(orbitRing);

        const planetGeo = new THREE.SphereGeometry(data.radius, 24, 24);
        const planetMat = new THREE.MeshStandardMaterial({
          color: data.color,
          roughness: 0.6,
          metalness: 0.2
        });
        const planetMesh = new THREE.Mesh(planetGeo, planetMat);
        planetMesh.rotation.z = data.tilt;
        this.scene.add(planetMesh);

        if (data.hasRings) {
          const saturnRingGeo = new THREE.RingGeometry(data.radius + 1.0, data.radius + 2.4, 32);
          const saturnRingMat = new THREE.MeshBasicMaterial({
            color: 0x555555,
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.6
          });
          const saturnRing = new THREE.Mesh(saturnRingGeo, saturnRingMat);
          saturnRing.rotation.x = Math.PI / 2;
          planetMesh.add(saturnRing);
        }

        this.planets.push({
          mesh: planetMesh,
          distance: data.distance,
          speed: data.speed,
          angle: Math.random() * Math.PI * 2,
          rotationSpeed: 0.02
        });
      } catch (e) {}
    });
  }

  onMouseMove(event) {
    if (!this.container) return;
    const rect = this.container.getBoundingClientRect();
    this.mouse.targetX = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.targetY = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  }

  resetCamera() {
    if (!this.camera) return;
    this.camera.position.set(0, 45, 80);
    if (this.controls) this.controls.target.set(0, 0, 0);
  }

  onWindowResize() {
    if (!this.container || !this.camera || !this.renderer) return;
    const width = this.container.clientWidth || window.innerWidth;
    const height = this.container.clientHeight || 192;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  animate() {
    this.animationFrameId = requestAnimationFrame(this.animate.bind(this));

    this.mouse.x += (this.mouse.targetX - this.mouse.x) * 0.05;
    this.mouse.y += (this.mouse.targetY - this.mouse.y) * 0.05;

    if (this.starfield) {
      this.starfield.rotation.y += 0.0003;
      this.starfield.rotation.x = this.mouse.y * 0.05;
      this.starfield.rotation.z = this.mouse.x * 0.05;
    }

    if (this.sunMesh && this.sunGlow) {
      this.sunMesh.rotation.y += 0.004;
      const pulseScale = 1 + Math.sin(Date.now() * 0.002) * 0.03;
      this.sunGlow.scale.set(pulseScale, pulseScale, pulseScale);
    }

    this.planets.forEach((p) => {
      p.angle += p.speed * 0.5;
      p.mesh.position.x = Math.cos(p.angle) * p.distance;
      p.mesh.position.z = Math.sin(p.angle) * p.distance;
      p.mesh.rotation.y += p.rotationSpeed;
    });

    if (this.controls) this.controls.update();
    if (this.renderer && this.scene && this.camera) {
      this.renderer.render(this.scene, this.camera);
    }
  }

  destroy() {
    if (this.animationFrameId) cancelAnimationFrame(this.animationFrameId);
    window.removeEventListener('resize', this.onWindowResize);
    if (this.renderer && this.renderer.domElement && this.container) {
      this.container.removeChild(this.renderer.domElement);
    }
  }
}

// Global hook with safety check
let ultronCosmos = null;
document.addEventListener('DOMContentLoaded', () => {
  try {
    ultronCosmos = new UltronCosmosEngine('three-canvas-wrapper');

    const btnToggleHero = document.getElementById('btn-toggle-hero');
    const heroContainer = document.getElementById('hero-cosmos-container');
    let isMinimized = false;

    btnToggleHero?.addEventListener('click', () => {
      isMinimized = !isMinimized;
      if (isMinimized) {
        heroContainer?.classList.remove('h-48');
        heroContainer?.classList.add('h-10');
        btnToggleHero.textContent = 'Expand 3D Orbit';
      } else {
        heroContainer?.classList.remove('h-10');
        heroContainer?.classList.add('h-48');
        btnToggleHero.textContent = 'Minimize 3D Orbit';
      }
      setTimeout(() => {
        ultronCosmos?.onWindowResize();
      }, 320);
    });
  } catch (e) {
    console.warn("Cosmos bootstrap handled safely:", e);
  }
});
