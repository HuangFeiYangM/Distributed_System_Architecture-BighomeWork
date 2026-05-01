$ErrorActionPreference = "Stop"

kubectl apply -f .\k3s-version\k8s\namespace.yaml
kubectl apply -f .\k3s-version\k8s\user.yaml
kubectl apply -f .\k3s-version\k8s\menu.yaml
kubectl apply -f .\k3s-version\k8s\order.yaml
kubectl apply -f .\k3s-version\k8s\pickup.yaml
kubectl apply -f .\k3s-version\k8s\gateway.yaml
kubectl apply -f .\k3s-version\k8s\web.yaml

Write-Host "K8S resources applied."
