// Sinalização do caminho da missão no mundo 3D: setas douradas no chão, raio de luz e anel no destino.
import * as THREE from 'three';

const MAX = 60; // setas desenhadas à frente do jogador
const SPACING = 1.7; // tiles entre setas
const GOLD = 0xffd34d, BLUE = 0x5dade2;

function arrowGeometry() {
  // seta em "V" achatada no chão, apontando para +Z
  const s = new THREE.Shape();
  s.moveTo(0, 0.42); s.lineTo(0.34, -0.12); s.lineTo(0.34, -0.36); s.lineTo(0, -0.08); s.lineTo(-0.34, -0.36); s.lineTo(-0.34, -0.12); s.closePath();
  const g = new THREE.ShapeGeometry(s);
  g.rotateX(-Math.PI / 2); // o shape (x, y) vira (x, -z): o "y" positivo aponta para -z; refletimos abaixo
  g.scale(1, 1, -1);
  return g;
}

export class GuideFx {
  constructor(scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    this.group.visible = false;
    scene.add(this.group);
    this.arrowMat = new THREE.MeshBasicMaterial({ color: GOLD, transparent: true, opacity: 0.95, depthWrite: false, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
    this.arrows = new THREE.InstancedMesh(arrowGeometry(), this.arrowMat, MAX);
    this.arrows.frustumCulled = false;
    this.arrows.count = 0;
    this.group.add(this.arrows);
    // destino: raio de luz, anel e losango flutuante
    this.beacon = new THREE.Group();
    this.beamMat = new THREE.MeshBasicMaterial({ color: GOLD, transparent: true, opacity: 0.32, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
    this.beam = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.5, 16, 14, 1, true), this.beamMat);
    this.beam.position.y = 8;
    this.ringMat = new THREE.MeshBasicMaterial({ color: GOLD, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
    this.ring = new THREE.Mesh(new THREE.RingGeometry(0.85, 1.0, 40).rotateX(-Math.PI / 2), this.ringMat);
    this.ring.position.y = 0.08;
    this.area = new THREE.Mesh(new THREE.RingGeometry(0.97, 1.0, 64).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: GOLD, transparent: true, opacity: 0.45, depthWrite: false, side: THREE.DoubleSide }));
    this.area.position.y = 0.07;
    this.gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.32), new THREE.MeshBasicMaterial({ color: 0xfff1a8 }));
    this.beacon.add(this.beam, this.ring, this.area, this.gem);
    this.group.add(this.beacon);
    this.ver = -1;
    this.pts = [];
    this.tmp = new THREE.Matrix4();
    this.q = new THREE.Quaternion();
    this.up = new THREE.Vector3(0, 1, 0);
  }

  // Amostra o caminho a cada SPACING tiles a partir do jogador
  rebuild(guide, me) {
    this.ver = guide.ver;
    const pts = [];
    let px = me.x, py = me.y, carry = 1.1; // a primeira seta fica um pouco à frente do jogador
    const path = guide.path;
    for (let i = 0; i < path.length && pts.length < MAX; i++) {
      const p = path[i];
      let seg = Math.hypot(p.x - px, p.y - py);
      const dx = (p.x - px) / (seg || 1), dy = (p.y - py) / (seg || 1);
      let cx = px, cy = py;
      while (seg >= carry && pts.length < MAX) {
        cx += dx * carry; cy += dy * carry; seg -= carry; carry = SPACING;
        pts.push({ x: cx, y: cy, a: Math.atan2(dx, dy) });
      }
      carry -= seg;
      px = p.x; py = p.y;
    }
    this.pts = pts;
  }

  update(guide, me, t, zoneId) {
    const on = guide.active && guide.wp && (guide.path.length || guide.dest);
    this.group.visible = !!on;
    if (!on) return;
    if (guide.ver !== this.ver) this.rebuild(guide, me);
    const portal = guide.wp.portal;
    const col = portal ? BLUE : GOLD;
    this.arrowMat.color.setHex(col);
    this.beamMat.color.setHex(col);
    this.ringMat.color.setHex(col);
    this.arrows.count = this.pts.length;
    const sx = (i) => 0.55 + 0.45 * Math.max(0, Math.sin(t * 5 - i * 0.8)); // pulso que corre na direção do destino
    this.pts.forEach((p, i) => {
      const s = sx(i);
      this.q.setFromAxisAngle(this.up, p.a);
      this.tmp.compose(new THREE.Vector3(p.x, 0.07, p.y), this.q, new THREE.Vector3(0.9 * s + 0.1, 1, 0.9 * s + 0.1));
      this.arrows.setMatrixAt(i, this.tmp);
    });
    this.arrows.instanceMatrix.needsUpdate = true;
    // destino
    this.beacon.position.set(guide.wp.x, 0, guide.wp.y);
    this.ring.rotation.y = t * 1.4;
    this.ring.scale.setScalar(1 + Math.sin(t * 3) * 0.08);
    this.gem.position.y = 3.2 + Math.sin(t * 2.4) * 0.25;
    this.gem.rotation.y = t * 2;
    this.beamMat.opacity = 0.26 + Math.sin(t * 2.6) * 0.07;
    const d = guide.dest;
    const showArea = d && !portal && d.kind === 'hunt' && d.zone === zoneId;
    this.area.visible = !!showArea;
    if (showArea) this.area.scale.setScalar(d.r);
  }
}
