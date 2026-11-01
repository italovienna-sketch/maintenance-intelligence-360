# Arquitetura

## Visão geral

- **API:** Hono sobre Node 24.
- **Banco:** `node:sqlite` com FTS5, sem servidor nem compilação nativa. A API ainda é experimental no Node 24 e emite um aviso ao iniciar.
- **Validação:** Zod em `shared/schemas.ts`. A interface em `public/` não importa esses schemas: não há build, e a validação final é sempre a da API.
- **Arquivos:** fotos e PDFs enviados ficam em `data/uploads`, e o conteúdo fixo em `public/`.

## Módulos

| Módulo | Pasta | Responsabilidade |
|---|---|---|
| Equipamentos e componentes | `server/modules/equipment` | Cadastro, perfil, busca e filtros |
| Manutenção | `server/modules/maintenance` | Histórico, registro, peças e fotos |
| Documentação | `server/modules/documents` | Biblioteca, seções e busca por trecho |
| Assistente | `server/modules/ai` | `AiProvider`, `DemoProvider` e regras |
| Estoque | `server/modules/inventory` | `InventoryProvider` com catálogo local |
| Usuários e permissões | `server/modules/users` | Perfis de demo e `can()` |
| Busca | `server/modules/search` | Índice FTS5 compartilhado |

## Decisões

**Registro atômico.** Registro, peças, documentos, fotos, situação do equipamento e índice são gravados em uma transação. Se falhar, os arquivos já salvos são apagados.

**Fotos validadas pelo conteúdo.** O tipo vem dos bytes iniciais do arquivo, não do nome.

**Sem autenticação real.** O cabeçalho `X-Demo-User` escolhe o perfil de demonstração. Isso não serve para produção.

**Assistente determinístico.** O `DemoProvider` não usa LLM. Fatos e citações vêm do banco, e hipóteses vêm de `rules.ts`, escritas à mão. Uma integração real implementaria `AiProvider`.

**Estoque só para consulta.** Registrar uma peça instalada não baixa o estoque, pois a integração real ficaria com outro sistema.

## Assets

- `public/models/bc-101.glb` é um modelo conceitual do próprio autor, baseado em envelope público de bomba de catálogo. Não representa uma bomba real ou certificada.
- Os demais modelos saem de `assets-pipeline/blender/build_families.py`.
- Renders Cycles e imagens SDXL rodam no Colab com `assets-pipeline/colab/`.

## Interface

`public/` é servido direto pelo Hono, em JavaScript puro, sem build. Esta é a base entregue com o design e substitui o React + Vite previsto no plano.

- `app.js`: templates com escape automático (`h```), rotas por hash e eventos delegados em `data-act`.
- `viewer3d.js`: Three.js local em `public/vendor`, com queda para a imagem se o WebGL ou o GLB falharem.
- `styles.css`: tokens e componentes do design, seguidos pelas regras de estados e responsividade.
