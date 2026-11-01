# API

Base: `/api`. Respostas em JSON. Perfil de demonstração pelo cabeçalho `X-Demo-User`; sem ele, usa `u-mecanico-1`.

Erros seguem `{ "error": { "code", "message", "details" } }`. Em validação, `details` traz `{ field, message }`.

## Geral

| Método | Rota | Descrição |
|---|---|---|
| GET | `/overview` | Contagens reais e últimas manutenções |
| GET | `/search?q=` | Busca geral |
| GET | `/users`, `/me` | Perfis e permissões |

## Equipamentos

| Método | Rota | Permissão |
|---|---|---|
| GET | `/equipment?q=&category=&status=&location=` | Todos |
| GET | `/equipment/facets` | Todos |
| GET | `/equipment/:id` (perfil completo) | Todos |
| POST, PATCH, DELETE | `/equipment`, `/equipment/:id` | Supervisor |
| GET | `/equipment/:id/components` | Todos |
| POST | `/equipment/:id/components` | Supervisor |
| PATCH, DELETE | `/components/:id` | Supervisor |

Equipamento com histórico não pode ser excluído (409).

## Manutenção

| Método | Rota | Permissão |
|---|---|---|
| GET | `/maintenance?q=&equipmentId=&technicianId=&from=&to=&page=&pageSize=` | Todos |
| GET | `/maintenance/:id` | Todos |
| POST | `/maintenance` | Todos |
| PATCH | `/maintenance/:id` | Todos |
| DELETE | `/maintenance/:id` | Supervisor |
| POST | `/maintenance/:id/photos` (`photo`, `stage`, `caption`) | Todos |
| DELETE | `/maintenance/:id/photos/:photoId` | Todos |

`POST /maintenance` aceita JSON ou multipart com `data` (JSON), `photos` (arquivos) e `photoMeta` (JSON na mesma ordem). Fotos: JPG, PNG ou WEBP, até 8 MB.

## Documentos

| Método | Rota | Permissão |
|---|---|---|
| GET | `/documents?q=&type=&equipmentId=` | Todos |
| GET | `/documents/:id` | Todos |
| POST | `/documents` (multipart: `file`, `title`, `docType`, `summary`, `equipmentIds`) | Supervisor |
| DELETE | `/documents/:id` | Supervisor |

Com `q`, a resposta é `{ kind: "excerpts", items }`, com o termo entre `[[` e `]]`. Sem `q`, é `{ kind: "documents", items }`.

## Estoque

`GET /inventory?q=` e `GET /inventory/:sku`. Somente leitura.

## Assistente

| Método | Rota | Permissão |
|---|---|---|
| POST | `/ai/ask` (`question`, `equipmentId` opcional) | Todos |
| GET | `/ai/recurring/:equipmentId` | Todos |
| POST | `/ai/confirmations` (`equipmentId`, `ruleId`, `conclusion`, `recordId` opcional) | Supervisor |

A resposta traz `mode`, `notice`, `insufficientData` e `blocks`. Cada bloco tem `type` (`FATO_HISTORICO`, `HIPOTESE_IA`, `INSPECAO_RECOMENDADA` ou `CONCLUSAO_HUMANA`), `text`, `why` e `citations`.

## Relatórios

Os relatórios são calculados dos registros gravados, com o dia no fuso da planta (UTC−3).

- `GET /api/reports/days`: últimos 60 dias com serviço e a contagem de cada um.
- `GET /api/reports/daily?date=AAAA-MM-DD`: total, peças instaladas, contagens por mecânico, local, máquina e resultado, e a lista de serviços.
- `GET /api/reports/daily.pdf?date=AAAA-MM-DD`: o mesmo relatório em PDF, para baixar.

Registros aceitam `workArea` (ETI, ETA, Fabricação, Linha 1 a Linha 6).
