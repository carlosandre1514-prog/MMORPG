// Gera versões simplificadas (LOD) das peças pesadas do Medieval Village e grava de volta em assets/village/village.glb.
// Cada peça com mais de MIN_TRIS triângulos ganha uma irmã "<nome>@lod" com a mesma geometria de vértices e menos
// triângulos (simplificação por quádricas do meshoptimizer). O cliente usa a irmã nos prédios distantes.
// Uso: cd tools/village && npm install && node lod.mjs   (pode rodar de novo: as irmãs antigas são recriadas)
import { NodeIO } from '@gltf-transform/core';
import { MeshoptSimplifier } from 'meshoptimizer';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const FILE = path.join(path.dirname(fileURLToPath(import.meta.url)), '../../assets/village/village.glb');
const MIN_TRIS = 100; // peças menores que isso não precisam de LOD
const RATIO = 0.18; // fração dos triângulos que sobra (mínimo de 24)
const SKIP = /^Door_1_/; // a folha da porta se mexe e é pequena: sempre inteira
// peças decorativas (telhado, moldura, janela, chaminé) podem perder os pedaços miúdos e soltos (Sparse + Prune)
const DECOR = /^(Roof_|Window_|DoorFrame_|Prop_Chimney)/;

await MeshoptSimplifier.ready;
const io = new NodeIO();
const doc = await io.read(FILE);
const scene = doc.getRoot().listScenes()[0];

// remove LODs antigos
for (const n of scene.listChildren()) if (n.getName().endsWith('@lod')) { for (const c of n.listChildren()) { const m = c.getMesh(); c.dispose(); if (m) m.dispose(); } n.dispose(); }

const trisOf = (node) => node.listChildren().reduce((a, c) => a + (c.getMesh() ? c.getMesh().listPrimitives().reduce((s, p) => s + p.getIndices().getCount() / 3, 0) : 0), 0);
let made = 0, before = 0, after = 0;
const rows = [];
for (const node of scene.listChildren()) {
  const name = node.getName();
  const tris = trisOf(node);
  if (tris < MIN_TRIS || SKIP.test(name)) continue;
  const lod = doc.createNode(name + '@lod');
  lod.setTranslation(node.getTranslation()); lod.setRotation(node.getRotation()); lod.setScale(node.getScale());
  let lodTris = 0;
  for (const child of node.listChildren()) {
    const mesh = child.getMesh();
    if (!mesh) continue;
    const m2 = doc.createMesh(mesh.getName() + '@lod');
    for (const prim of mesh.listPrimitives()) {
      const pos = prim.getAttribute('POSITION');
      const idx = prim.getIndices();
      const indices = new Uint32Array(idx.getArray());
      const positions = new Float32Array(pos.getArray());
      const decor = DECOR.test(name);
      const target = Math.min(indices.length, Math.max(decor ? 18 : 24 * 3, Math.floor((indices.length * (decor ? 0.08 : RATIO)) / 3) * 3));
      // erro relativo ao tamanho da peça; nas paredes a borda é preservada para não abrir frestas
      const [out] = MeshoptSimplifier.simplify(indices, positions, 3, target, decor ? 0.5 : 0.08, decor ? ['Sparse', 'Prune'] : ['LockBorder']);
      const p2 = doc.createPrimitive();
      for (const sem of prim.listSemantics()) p2.setAttribute(sem, prim.getAttribute(sem));
      p2.setMaterial(prim.getMaterial());
      p2.setMode(prim.getMode());
      const acc = doc.createAccessor().setType('SCALAR').setArray(new Uint32Array(out)).setBuffer(idx.getBuffer());
      p2.setIndices(acc);
      m2.addPrimitive(p2);
      lodTris += out.length / 3;
    }
    const c2 = doc.createNode(child.getName() + '@lod').setMesh(m2);
    c2.setTranslation(child.getTranslation()); c2.setRotation(child.getRotation()); c2.setScale(child.getScale());
    lod.addChild(c2);
  }
  scene.addChild(lod);
  made++; before += tris; after += lodTris;
  rows.push(`${name}: ${tris} -> ${lodTris}`);
}
await io.write(FILE, doc);
console.log(rows.join('\n'));
console.log(`${made} peças com LOD: ${before} -> ${after} triângulos`);
