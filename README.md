# VPS Monitor (front)

Painel web do **VPS Monitor**: acompanha um servidor em tempo real (CPU, RAM, disco, GPU, temperaturas, rede, pods do Kubernetes, processos do host, sites, banco e alertas). Só leitura; os dados vêm da VPS Monitor API (repositório `vps-monitor-api`).

## Stack
- Angular 22 (standalone, zoneless, signals) + TypeScript
- Gráficos em SVG próprio (sem biblioteca)
- nginx sem root na porta 8080, health em `/healthz`

## Telas
| Rota | Conteúdo |
|---|---|
| `/` | Medidores de CPU, RAM, disco e GPU, números rápidos e histórico (1h, 6h, 24h, 7d) |
| `/apps` | Consumo por app: namespaces do k8s, serviços systemd e processos sem dono (aviso para nomear) |
| `/pods` | Pods por namespace: estado, reinícios, CPU, RAM e limite |
| `/servicos` | Alertas ativos, sites testados e PostgreSQL |

Atualiza sozinho (15 s a 30 s) e pausa quando a aba fica escondida.

## Segurança
- Login com usuário, senha e código do app autenticador. O token fica no `sessionStorage` (fechou a aba, sai).
- CSP restrita: scripts só do próprio site, conexões só com a API.
- `noindex` e `robots.txt` bloqueando indexação.

## Desenvolvimento
```bash
npm ci
npm start            # http://localhost:4200, API em http://localhost:18080 (src/environments/environment.ts)
npx ng build         # produção (API em src/environments/environment.production.ts)
```

Teste de PR
