param(
  [string]$ClusterName = "mycluster",
  [string]$ImageTag = "v1"
)

$ErrorActionPreference = "Stop"

Write-Host "Loading offline images from .\k3s-version\images ..."

docker load -i ".\k3s-version\images\canteen-gateway-$ImageTag.tar"
docker load -i ".\k3s-version\images\canteen-user-service-$ImageTag.tar"
docker load -i ".\k3s-version\images\canteen-menu-service-$ImageTag.tar"
docker load -i ".\k3s-version\images\canteen-order-service-$ImageTag.tar"
docker load -i ".\k3s-version\images\canteen-pickup-service-$ImageTag.tar"
docker load -i ".\k3s-version\images\smart-canteen-web-$ImageTag.tar"

Write-Host "Importing images into k3d cluster: $ClusterName"

k3d image import canteen-gateway:$ImageTag -c $ClusterName
k3d image import canteen-user-service:$ImageTag -c $ClusterName
k3d image import canteen-menu-service:$ImageTag -c $ClusterName
k3d image import canteen-order-service:$ImageTag -c $ClusterName
k3d image import canteen-pickup-service:$ImageTag -c $ClusterName
k3d image import smart-canteen-web:$ImageTag -c $ClusterName

Write-Host "Applying Kubernetes manifests..."

kubectl apply -f .\k3s-version\k8s\namespace.yaml
kubectl apply -f .\k3s-version\k8s\user.yaml
kubectl apply -f .\k3s-version\k8s\menu.yaml
kubectl apply -f .\k3s-version\k8s\order.yaml
kubectl apply -f .\k3s-version\k8s\pickup.yaml
kubectl apply -f .\k3s-version\k8s\gateway.yaml
kubectl apply -f .\k3s-version\k8s\web.yaml

if ($ImageTag -ne "v1") {
  Write-Host "Updating deployment images to tag: $ImageTag"
  kubectl set image deployment/canteen-gateway canteen-gateway=canteen-gateway:$ImageTag -n canteen-offline
  kubectl set image deployment/canteen-user-service canteen-user-service=canteen-user-service:$ImageTag -n canteen-offline
  kubectl set image deployment/canteen-menu-service canteen-menu-service=canteen-menu-service:$ImageTag -n canteen-offline
  kubectl set image deployment/canteen-order-service canteen-order-service=canteen-order-service:$ImageTag -n canteen-offline
  kubectl set image deployment/canteen-pickup-service canteen-pickup-service=canteen-pickup-service:$ImageTag -n canteen-offline
  kubectl set image deployment/smart-canteen-web smart-canteen-web=smart-canteen-web:$ImageTag -n canteen-offline
}

Write-Host "Offline deployment finished."
