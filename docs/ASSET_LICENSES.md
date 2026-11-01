# Origem e licença dos assets

| Asset | Origem | Situação |
|---|---|---|
| `public/models/bc-101.glb` | Geometria conceitual do próprio autor, baseada em envelope público de bomba de catálogo | Exibir como "Modelo conceitual" |
| `assets-pipeline/render-input/*.glb` | Modelos paramétricos criados para esta demo | Formas genéricas, sem cotas de fabricante |
| `public/docs/*.pdf` | Texto escrito para esta demo | Marcados como documento ilustrativo |
| `public/images/equipment/*` | Render Cycles dos modelos acima (WEBP com fundo transparente) | Prontos. Exibir como "Modelo conceitual" |
| `public/images/maintenance/*` | SDXL 1.0 (licença CreativeML Open RAIL++-M) | Prontas e revisadas uma a uma. Exibir como "Imagem ilustrativa" |
| `public/vendor/three/*` | Three.js 0.170.0 | Licença MIT, cópia em `public/vendor/three/LICENSE` |

## Imagens ilustrativas

Geradas com SDXL 1.0 (40 passos, CFG 6,5, 1152×864). Estilo e prompt negativo de cada rodada estão em `assets-pipeline/colab/`. Nenhuma é foto real de equipamento.

| Imagem | Rodada | Seed | Prompt |
|---|---|---|---|
| `rolamento-gasto.webp` | maintenance2 | 3804 | single deep groove ball bearing lying on a workbench, visible steel balls and cage, rusty pitted raceway, black dirty grease, close up |
| `rolamento-novo.webp` | maintenance2 | 4220 | single new deep groove ball bearing lying on a clean workbench, visible shiny steel balls and cage, close up |
| `selo-gasto.webp` | maintenance | 3708 | close up of a used mechanical pump seal with worn scratched carbon face, oily residue, on a workbench |
| `selo-novo.webp` | maintenance | 3609 | close up of a clean new mechanical pump shaft seal on a clean workbench |
| `rotor-entupido.webp` | maintenance | 3816 | semi open cast iron pump impeller clogged with wet fibers and rags, dirty, on a concrete floor |
| `rotor-limpo.webp` | maintenance3 | 7812 | freshly cleaned cast iron centrifugal pump impeller with curved vanes, smooth clean grey metal, lying on a clean steel workbench, close up |
| `placa-gasta.webp` | maintenance2 | 3718 | flat round steel disc lying on a workbench, deep circular scratches and rust on its flat face, close up |
| `placa-nova.webp` | maintenance | 3621 | new circular machined steel pump wear plate, clean surface, on a workbench |
| `correia-gasta.webp` | maintenance2 | 4236 | single frayed black rubber V-belt installed in the groove of a cast iron pulley, cracked rubber with loose cords, close up |
| `correia-nova.webp` | maintenance2 | 3632 | two new black rubber V-belts running in the grooves of a cast iron pulley, close up |
| `motor-sujo.webp` | maintenance2 | 3640 | side view of a blue painted industrial electric motor with parallel horizontal cooling fins, fins coated with thick grey dust and grime, in a factory |
| `motor-limpo.webp` | maintenance3 | 7210 | side view of a clean blue painted industrial electric motor on a workshop bench, glossy intact paint, straight parallel horizontal cooling fins, spotless |
