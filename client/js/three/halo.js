// Acessórios montados em código para os personagens (nenhum arquivo de arte). Recebem o THREE para servir também ao gerador de sprites.
// Auréola do Clérigo: um anel dourado sobre a cabeça, preso ao osso da cabeça (unidade do modelo KayKit: o osso fica na base do crânio e o topo
// da cabeça (com cabelo) está ~0,92 acima dele).
export function buildHalo(T) {
  const g = new T.Group();
  const gold = new T.MeshStandardMaterial({ color: 0xffd36a, emissive: 0xffb43c, emissiveIntensity: 0.9, roughness: 0.3, metalness: 0.7 });
  const ring = new T.Mesh(new T.TorusGeometry(0.4, 0.05, 8, 32), gold);
  ring.rotation.x = Math.PI / 2 - 0.16;
  ring.position.set(0, 1.12, -0.04);
  ring.userData.notint = true;
  ring.castShadow = false;
  g.add(ring);
  return g;
}

// acha o osso "head" do modelo e prende o acessório nele
export function attachToHead(model, acc) {
  let head = null;
  model.traverse((o) => { if (!head && o.name === 'head') head = o; });
  if (head) head.add(acc);
  return !!head;
}
