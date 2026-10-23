# Licenças dos assets de terceiros

Resumo do que o jogo usa, de onde veio e o que cada licença exige. Onde está escrito "verificado por busca", o .zip recebido não trazia
arquivo de licença e a informação vem da página do autor (resumo de busca): **confirme na página antes de publicar o jogo**.

## Usados no jogo

| Conteúdo | Autor / origem | Licença | O que exige |
|---|---|---|---|
| Personagens, cenário, armas, ferramentas, esqueletos, recursos, masmorra (KayKit) | Kay Lousberg — kaylousberg.com | CC0 (arquivo License.txt em cada pacote) | nada (crédito opcional) |
| Medieval Village MegaKit (prédios da capital) | Quaternius — quaternius.com | CC0 (arquivo no pacote) | nada |
| Zumbi (Animated Characters) | Kenney — kenney.nl, via pacote do Brackeys | CC0 | nada |
| Céu HDR (autumn_field_puresky) | Poly Haven — polyhaven.com | CC0 | nada |
| Efeitos de habilidades (shaders portados) | Binbun3D — bun3d.com ("Binbun VFX Vol. 2", pacotes Free) | CC0 (license.txt em cada pacote) | nada (o autor agradece a menção) |
| Weapons: Sword_Golden, Shield_Celtic_Golden, Dagger_2, Hammer_Small, Hammer_Double, Bow_Golden | Quaternius — "Medieval Weapons Pack" | CC0 (verificado por busca: página do pacote no itch.io) | nada |
| Weapons: Scimitar e Falchion | Alstra Infinite — "Medieval Swords - PolyPack" | **CC BY 4.0** (verificado por busca) | **crédito ao autor** (README e Ajuda do jogo); não republicar o pacote original |
| Torres em voxel de Zahrim (8 prédios) | monogon / Max Parata — "Voxel Desert Town" | **CC BY-ND 4.0** (verificado por busca) | **crédito ao autor**; **sem derivações**: o `voxel.glb` é uma versão convertida. Peça autorização por escrito ao autor ou troque os prédios antes de publicar |
| Música de abertura (`assets/music/theme.mp3`) | Criada no Suno pelo autor do projeto | Termos do Suno | Uso comercial só se a música foi gerada durante um plano pago (Pro/Premier); guardar o comprovante e conferir os termos antes de publicar |
| Motor 3D Three.js | mrdoob | MIT | manter a licença (client/vendor/three/LICENSE) |
| Login: Firebase JS SDK 10.14.1 (`client/vendor/firebase/firebase-auth.js`, módulos app e auth) | Google — firebase.google.com | Apache-2.0 | manter o texto da licença (client/vendor/firebase/LICENSE); o uso do serviço Firebase Authentication segue os Termos do Firebase (o plano gratuito Spark atende) |
| Fontes Cinzel e Alegreya Sans | Google Fonts | OFL | — |

## Recebidos e NÃO usados (motivo)

| Arquivo | Motivo |
|---|---|
| Ancient_Artifacts, Ancient_Treasure, PyramidShip, Ancient_Rock_Statues | Mesmo autor das torres (monogon, "Voxel Ancient Environment"), **CC BY-ND 4.0**: usar exigiria converter e redistribuir versões modificadas, que a licença não permite sem autorização |
| Package.zip (MountainRocks, voxel) | Origem e licença não identificadas |
| Rocks.zip (rocks.fbx + color_atlas.png) | Origem e licença não identificadas (arquivo do Blender sem autoria) |
| Sword_Scimitar/Katana/EuropeanBroad.fbx soltos | São do mesmo PolyPack (CC BY): só a cimitarra e a falcata do zip entraram |
| KayKit_FantasyWeaponsBits (repetido) | Já estava no jogo |
| DarkMagicFX, ElementalMagicFX, BattleFX, StatusFX, HitFX, ExplosionFX | Usados só como referência dos shaders (CC0); nenhum arquivo deles é distribuído. `guy.glb` (boneco de teste do StatusFX) e `suzanne.obj` não foram usados |

## Pendente
- Arquivos do pântano (ambiente e construção) não vieram no lote (provavelmente os que passaram de 30 MB). Conferir a licença de cada um antes de integrar.
