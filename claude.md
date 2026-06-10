# Omega — Full-Stack MERN DevOps Project

A product-inventory style MERN application wired end-to-end through a modern
DevOps toolchain: containerization, CI scanning, code-quality gating, GitOps
delivery, Kubernetes orchestration, IaC, and observability.

> Region target: AWS `us-west-2` (Oregon). Cluster name: `mega`, app
> namespace: `omega`. DockerHub user: `mdjahidhasan6544`. GitHub repo:
> `mdjahidhasan6544-ctrl/omega-kubernate-automation`.

---

## 1. High-Level Architecture

```
                    ┌──────────────────────────────────────────────┐
                    │           AWS EKS (mega cluster)             │
                    │                                              │
   Internet ──►     │   ┌─────────────┐      ┌────────────────┐    │
 (NodePort 31000)   │   │  Frontend   │ ───► │    Backend     │    │
                    │   │ React+Vite  │      │ Express/Mongoose│   │
                    │   │ :5173       │      │ :8080          │    │
                    │   └─────────────┘      └───────┬────────┘    │
                    │                                │             │
                    │                        ┌───────▼────────┐    │
                    │                        │   MongoDB      │    │
                    │                        │   :27017       │    │
                    │                        │   (PVC)        │    │
                    │                        └────────────────┘    │
                    │                                              │
                    │  Monitoring: kube-prometheus-stack (Helm)    │
                    │  Prometheus + Grafana on `prometheus` ns     │
                    └──────────────────────────────────────────────┘
                                    ▲
                                    │   ArgoCD (GitOps pull)
                                    │
                            GitHub (omega-kubernate-automation, `main`)
                                    ▲
                                    │   GitOps/Jenkinsfile updates
                                    │   kubernetes/*.yaml image tags
                                    │
                        ┌───────────────────────────────┐
                        │  Jenkins CI (master machine)  │
                        │  ─ Trivy filesystem scan      │
                        │  ─ OWASP dependency check     │
                        │  ─ SonarQube analysis + QG    │
                        │  ─ Docker build & push        │
                        │   mdjahidhasan6544/omega-*-beta│
                        └───────────────────────────────┘
                                    ▲
                                    │
                              GitHub (code)
```

---

## 2. Tech Stack

| Layer              | Tool / Tech                                         |
| ------------------ | --------------------------------------------------- |
| Frontend           | React 19, React Router 6, MUI v5, Axios, Vite 6     |
| Backend            | Node.js 21, Express 4, Mongoose 8                   |
| Database           | MongoDB (image: `mongo`); standalone via `db-setup.sh` (MongoDB Enterprise 8.0) |
| Containers         | Docker (Dockerfiles per service)                    |
| Local stack        | `docker-compose.yml` (mongo + backend + frontend)   |
| CI                 | Jenkins (`Jenkinsfile` + `bongodev/jenkins-shared-library`) |
| Security scans     | OWASP Dependency-Check, Trivy filesystem scan       |
| Code quality       | SonarQube (analysis + Quality Gate)                 |
| Registry           | DockerHub — `mdjahidhasan6544/omega-backend-beta`, `mdjahidhasan6544/omega-frontend-beta` |
| CD                 | ArgoCD (auto-sync, prune, self-heal)                |
| Orchestration      | AWS EKS (Kubernetes 1.30) + NodePort services       |
| IaC                | Terraform (EC2 master + security group)             |
| Observability      | Helm → kube-prometheus-stack (Prometheus + Grafana) |
| Notifications      | Jenkins `emailext` (gmail SMTP) to `mdjahidhasan494349@gmail.com` |

---

## 3. Repository Layout

```
omega-kubernate-automation/
├── Jenkinsfile                 # CI pipeline (scans, analysis, build/push)
├── docker-compose.yml          # Local dev: mongo + backend + frontend
├── db-setup.sh                 # MongoDB Enterprise 8.0 install + seed
├── backend/                    # Express + Mongoose API
│   ├── Dockerfile              # node:21 → node:21-slim, EXPOSE 8080
│   ├── server.mjs              # App entry, CORS + JSON + routes
│   ├── config/{db.mjs,utils.mjs}
│   ├── controllers/productController.mjs
│   ├── models/product.mjs
│   └── routes/{router.mjs,productRoutes.mjs}
├── frontend/                   # React 19 + Vite 6 + MUI
│   ├── Dockerfile              # node:21 → node:21-slim, EXPOSE 5173
│   ├── vite.config.js
│   ├── src/
│   │   ├── App.jsx
│   │   ├── routes/index.jsx    # /, /create, /test
│   │   ├── pages/{ProductPage.jsx, ProductForm.jsx}
│   │   ├── components/ProductCard.jsx
│   │   ├── axios/invAxios.js   # baseURL = appConfig.API_PATH (VITE_API_PATH)
│   │   └── config/index.js     # appConfig.API_PATH from VITE_API_PATH
├── database/Dockerfile         # Mongo image variant (mongod entrypoint)
├── kubernetes/                 # EKS manifests (namespace: omega)
│   ├── backend.yaml            # Deployment + NodePort 31100
│   ├── frontend.yaml           # Deployment + NodePort 31000
│   ├── mongodb.yaml            # Deployment + ClusterIP + PVC
│   ├── persistentVolume.yaml
│   ├── persistentVolumeClaim.yaml
│   └── kubeadm.md              # Local K8s bootstrap reference notes
├── GitOps/Jenkinsfile          # CD pipeline: sed image tags → push
├── Automations/
│   ├── updatebackendnew.sh     # Writes FRONTEND_URL into backend/.env.docker
│   └── updatefrontendnew.sh    # Writes VITE_API_PATH into frontend/.env.docker
├── terraform/                  # EC2 master, SG, key pair (us-west-2)
└── files/index.html            # (currently empty placeholder)
```

---

## 4. Application Layer

### 4.1 Backend (`backend/`)

- **Runtime:** Node 21 (ESM, `"type": "module"`).
- **Entry:** `backend/server.mjs` — loads `dotenv`, enables `cors()` for all
  origins, parses JSON, calls `connectDatabase()`, and mounts:
  - `router` — health/test (`/_status`, `/test`).
  - `productRouter` — `GET /api/products`, `POST /api/products`.
- **Persistence:** Mongoose connection string from
  `backend/config/utils.mjs` (`MONGODB_URI`, `PORT`).
- **Models:** `Product` (`name` String required, `price` Number required,
  `quantity` Number default `0`).
- **No auth / no validation layer** beyond Mongoose defaults.

### 4.2 Frontend (`frontend/`)

- **Stack:** React 19 + Vite 6 + MUI 5 + React Router 6 + Axios.
- **Routes** (`src/routes/index.jsx`):
  - `/` → `ProductPage` (list view, "Add Product" button → `/create`)
  - `/create` → `ProductForm` (name / price / quantity)
  - `/test` → trivial test page
- **HTTP client:** `src/axios/invAxios.js` reads `appConfig.API_PATH` from
  `import.meta.env.VITE_API_PATH` (baked in at build time).
- **Build/start:** `npm run dev`, `npm run build`, `npm run preview`.
  `vite.config.js` pins dev port to `3000`.
- **Container:** Dockerfile runs `npm run dev -- --host 0.0.0.0 --port 5173`
  (dev server, not the production build).

> **Note:** The frontend container ships a dev server (Vite). For production
> it should run `vite build` and serve `dist/` via a static server or move to
> an `nginx` stage.

### 4.3 Local Dev Stack (`docker-compose.yml`)

| Service  | Port mapping       | Notes                                  |
| -------- | ------------------ | -------------------------------------- |
| mongo    | `27017:27017`      | Volume `./backend/data:/data`          |
| backend  | `31100:8080`       | Built from `./backend`, env file used  |
| frontend | `5173:5173`        | Built from `./frontend`, env file used |

`db-setup.sh` is a standalone helper that installs MongoDB Enterprise 8.0
on Ubuntu (`noble`), seeds a `product` database with three sample products
(`iPhone 18 pro`, `Samsung Pro`, `Tesla Pi`) and prints them. Intended for
the host / non-containerized DB scenarios.

---

## 5. CI Pipeline (`Jenkinsfile`)

Pipeline uses `@Library('Shared') _` → shared library
`https://github.com/bongodev/jenkins-shared-library`.

Agent label: `Node`.

Required parameters:
- `FRONTEND_DOCKER_TAG`
- `BACKEND_DOCKER_TAG`

Stages:

1. **Validate Parameters** — fail build if tags are empty.
2. **Workspace cleanup** — `cleanWs()`.
3. **Git: Code Checkout** —
   `code_checkout("https://github.com/mdjahidhasan6544-ctrl/omega-kubernate-automation.git","main")`.
4. **Trivy: Filesystem scan** — `trivy_scan()`.
5. **OWASP: Dependency check** — `owasp_dependency()`.
6. **SonarQube: Code Analysis** —
   `sonarqube_analysis("Sonar","omega","omega")`.
7. **SonarQube: Code Quality Gates** — `sonarqube_code_quality()` (blocks
   downstream stages on failure).
8. **Exporting environment variables** (parallel):
   - `Automations/updatebackendnew.sh` (writes `FRONTEND_URL` into
     `backend/.env.docker` using the EKS node public IP).
   - `Automations/updatefrontendnew.sh` (writes `VITE_API_PATH` into
     `frontend/.env.docker`).
9. **Docker: Build Images** —
   `docker_build("omega-backend-beta", tag, "mdjahidhasan6544")` and same
   for frontend.
10. **Docker: Push to DockerHub** — `docker_push(...)` for both.
11. **Post success** — archive `*.xml`, trigger downstream **omega-CD** job
    with the same tags (`propagate: false`).

---

## 6. CD Pipeline (`GitOps/Jenkinsfile`)

Triggered by the CI job with the docker tag parameters. Steps:

1. Clean workspace and checkout the same repo
   (`mdjahidhasan6544-ctrl/omega-kubernate-automation`, branch `main`).
2. Echo incoming `FRONTEND_DOCKER_TAG` and `BACKEND_DOCKER_TAG`.
3. **Update Kubernetes manifests** with `sed`:
   - `kubernetes/backend.yaml` → `mdjahidhasan6544/omega-backend-beta:${BACKEND_DOCKER_TAG}`
   - `kubernetes/frontend.yaml` → `mdjahidhasan6544/omega-frontend-beta:${FRONTEND_DOCKER_TAG}`
4. `git add .` → `git commit -m "Updated environment variables"` → `git push`
   to `main` using credential `Github-cred` (`gitUsernamePassword`).
5. **ArgoCD** (configured to watch `kubernetes/` in `main` on cluster
   `mega-ekscluster`, namespace `omega`) detects the change and auto-syncs.
6. Email notification (success/failure) via Jenkins `emailext` from
   `mdjahidhasan494349@gmail.com` to `mdjahidhasan494349@gmail.com`.

> The manifest image tag is overwritten **in place** with `sed -i`. A cleaner
> pattern would use `kustomize` or `yq` to avoid string-fragile regex
> matching.

---

## 7. Kubernetes Manifests (`kubernetes/`)

All resources live in namespace `omega` (must be created — ArgoCD is configured
with **Auto-Create Namespace**).

- **mongodb.yaml** — 1 replica `mongo` Deployment, `ClusterIP` Service on
  `27017`, mounts PVC `mongo-pvc` at `/data/db`.
- **persistentVolume.yaml / persistentVolumeClaim.yaml** — backing storage
  for Mongo (`mongo-pvc`).
- **backend.yaml** — 1 replica of `mdjahidhasan6544/omega-backend-beta:<tag>`
  (currently `v6.1`), port `8080`, exposed via NodePort `31100`.
- **frontend.yaml** — 1 replica of `mdjahidhasan6544/omega-frontend-beta:<tag>`
  (currently `v6.1`), port `5173`, exposed via NodePort `31000`.
- **kubeadm.md** — local `kubeadm` bootstrap notes (not deployed to EKS).

Security-group rules (master + worker) must allow:
- `22` (SSH), `80` (HTTP), `443` (HTTPS), `465`/`25` (SMTP).
- `6443` (Kubernetes API).
- `3000–10000` and `30000–32767` (NodePort range).
- Worker SG must allow backend `31100` and frontend `31000`.

### Gaps / Improvement Opportunities
- No `livenessProbe` / `readinessProbe` on any Deployment.
- No `resources.requests/limits` defined.
- No `imagePullSecrets`, no `ServiceAccount`, no `NetworkPolicy`.
- No `HorizontalPodAutoscaler`.
- MongoDB has no auth / no TLS, and the PVC is single-replica (single point of
  failure).
- Frontend container runs Vite dev server (HMR, slow, not prod).

---

## 8. Infrastructure as Code (`terraform/`)

`terraform/ec2.tf` provisions the Jenkins master host:

- `aws_key_pair.deployer` — `terra-automate-key` (public key from
  `${path.module}/terra-key.pub` — file is not committed; supply your own).
- `aws_default_vpc.default` — uses the account's default VPC.
- `aws_security_group.allow_user_to_connect` — ingress on `22`, `80`, `443`
  from `0.0.0.0/0`; egress all. Tagged `Name = "mysecurity"`.
- `aws_instance.testinstance` — `t2.large` (29 GB gp3 root volume), tags
  `Name = "Automate"`.

`variables.tf` exposes `aws_region` (default `us-west-2`), `ami_id`, and
`instance_type` (default `t2.large`). `terraform.tf` pins the AWS provider to
`5.65.0`.

> **Caveat:** The key file referenced in `ec2.tf` is **not checked in**; you
> must drop your own `terra-key.pub` next to it. State file location and
> backend aren't declared; assume local state.

---

## 9. Observability — Prometheus + Grafana (Helm)

Installed in the `prometheus` namespace via
`prometheus-community/kube-prometheus-stack`. After install, both the
Prometheus and Grafana `ClusterIP` services are patched to `NodePort` with
`kubectl edit svc`, then opened in the worker node's security group.

Grafana admin password:
```
kubectl get secret -n prometheus stable-grafana \
  -o jsonpath="{.data.admin-password}" | base64 --decode ; echo
```

Dashboards are then available on `http://<worker-node-ip>:<grafana-nodeport>`.

---

## 10. Required Environment Variables

### `backend/.env.docker` (and `.env` for local)
- `MONGODB_URI` — connection string (Compose default points at `mongodb://mongo:27017/...`).
- `PORT` — backend port; container exposes `8080`.
- `FRONTEND_URL` — written by `Automations/updatebackendnew.sh` from the
  worker node's public IP (`http://<ip>:5173`).

### `frontend/.env.docker`
- `VITE_API_PATH` — backend base URL consumed by `axios`
  (`http://<worker-ip>:31100`). Written by `Automations/updatefrontendnew.sh`.

Both files are written **at CI time** by the Automation scripts using the
EC2 worker instance public IP queried via AWS CLI from the Jenkins host
(`INSTANCE_ID` is hard-coded in each script — update before running).

---

## 11. Operational Runbook (Quick Reference)

### Bootstrap master
1. `terraform apply` (or create `t2.large` EC2 manually, 30 GB gp3, us-west-2).
2. Open the SG ports listed in §7.
3. Install Docker, Jenkins, `kubectl`, `eksctl`, Trivy, Helm.
4. `eksctl create cluster --name=mega --region=us-west-2 --version=1.30 --without-nodegroup`
5. Associate OIDC, add nodegroup (`t2.large`, 1–2 nodes).
6. Run SonarQube container, install Jenkins plugins
   (OWASP, SonarQube Scanner, Docker, Pipeline Stage View, Blue Ocean).
7. Add credentials in Jenkins: GitHub PAT, DockerHub PAT, Sonar token,
   shared library, `Github-cred`, Gmail SMTP.
8. Install ArgoCD in `argocd` ns, expose as NodePort, get initial password,
   register the cluster (`argocd cluster add … --name mega-ekscluster`).
9. Create the ArgoCD app pointing at the repo, `path: kubernetes`,
   namespace `omega`, auto-sync + prune + self-heal.

### Build / deploy
1. Edit `Automations/updatebackendnew.sh` and `Automations/updatefrontendnew.sh`
   and set `INSTANCE_ID` to the EKS worker EC2 instance ID.
2. Build the **omega-CI** job with `FRONTEND_DOCKER_TAG` and
   `BACKEND_DOCKER_TAG`.
3. CI finishes → triggers **omega-CD** → updates `kubernetes/*.yaml` → pushes
   to `main` → ArgoCD syncs.
4. Verify: `kubectl get pods -n omega`, hit
   `http://<worker>:31000` (frontend) and `http://<worker>:31100/api/products`
   (backend).

### Local dev
```bash
docker compose up --build
# Frontend: http://localhost:5173
# Backend:  http://localhost:31100
# Mongo:    mongodb://localhost:27017
```

If running Mongo outside Compose, `db-setup.sh` will install MongoDB
Enterprise 8.0 on Ubuntu and seed the `product` database with sample rows.

---

## 12. Known Risks / TODO

- **Secrets in env files** — `MONGODB_URI`, DockerHub creds, GitHub PAT
  handled in plain text; should move to Kubernetes Secrets / Jenkins
  credential bindings.
- **CORS wide open** — `cors()` with no origin filter; tighten in prod.
- **No input validation** on `POST /api/products`.
- **No tests** — `npm test` in both `frontend` and `backend` is a stub
  `echo`.
- **Sed-based manifest patching** in `GitOps/Jenkinsfile` is fragile; prefer
  `kustomize edit set image …` or `yq`.
- **No health/ready probes, no resource limits, no HPA** on any workload.
- **Frontend runs dev server in container** — switch to a production build
  served by `nginx` or similar.
- **ArgoCD application not committed** — only the upstream `kubernetes/`
  manifests; the Argo `Application` resource is created imperatively from
  the UI.
- **Single-replica Mongo + single PVC** — no HA, no backups visible.
- **Terraform state** not declared (no backend block); key file
  (`terra-key.pub`) is not committed.
- **Hard-coded `INSTANCE_ID`** in `Automations/update*.sh` — must be updated
  per worker.

---

## 13. Glossary of Important Names

- **Cluster:** `mega` (EKS, `us-west-2`).
- **Namespaces:** `omega` (apps), `argocd`, `prometheus`.
- **Images:** `mdjahidhasan6544/omega-backend-beta`,
  `mdjahidhasan6544/omega-frontend-beta`.
- **Jenkins jobs:** `omega-CI`, `omega-CD`.
- **Shared library:** `bongodev/jenkins-shared-library` (alias `Shared`).
- **NodePorts:** backend `31100`, frontend `31000`, ArgoCD `~30000+`,
  Grafana/Prometheus patched dynamically.
- **Notification email:** `mdjahidhasan494349@gmail.com`.
