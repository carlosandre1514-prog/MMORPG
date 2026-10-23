// Maça do clérigo, montada em código (nenhum arquivo de arte): cabo na origem e cabeça em +Y, como as armas KayKit, então
// entra na mão do personagem do mesmo jeito. Recebe o THREE para servir também ao gerador de sprites (tools/bake).
export function buildMace(T) {
  const g = new T.Group();
  const wood = new T.MeshStandardMaterial({ color: 0x7a5230, roughness: 0.85, metalness: 0 });
  const gold = new T.MeshStandardMaterial({ color: 0xf0cf6a, roughness: 0.32, metalness: 0.75, flatShading: true });
  const steel = new T.MeshStandardMaterial({ color: 0xd9dee6, roughness: 0.4, metalness: 0.6, flatShading: true });
  const add = (geo, mat, x, y, z, rx = 0, ry = 0, rz = 0) => {
    const m = new T.Mesh(geo, mat);
    m.position.set(x, y, z); m.rotation.set(rx, ry, rz);
    m.castShadow = true;
    m.userData.notint = true; // a cor do clérigo não pinta o metal da maça
    g.add(m);
    return m;
  };
  add(new T.CylinderGeometry(0.05, 0.058, 1.2, 8), wood, 0, 0.32, 0); // cabo
  add(new T.SphereGeometry(0.085, 8, 6), gold, 0, -0.3, 0); // pomo
  add(new T.CylinderGeometry(0.075, 0.062, 0.1, 8), gold, 0, 0.93, 0); // gola
  add(new T.SphereGeometry(0.19, 10, 8), gold, 0, 1.13, 0); // cabeça
  for (let i = 0; i < 6; i++) { // aletas
    const a = (i / 6) * Math.PI * 2;
    add(new T.BoxGeometry(0.05, 0.3, 0.17), steel, Math.cos(a) * 0.2, 1.13, Math.sin(a) * 0.2, 0, -a, 0);
  }
  add(new T.ConeGeometry(0.075, 0.2, 8), gold, 0, 1.4, 0); // ponta
  return g;
}
