param(
  [string]$ClusterName = "mycluster"
)

$ErrorActionPreference = "Stop"

Write-Host "Importing images to k3d cluster: $ClusterName"

k3d image import canteen-gateway:v1 -c $ClusterName
k3d image import canteen-user-service:v1 -c $ClusterName
k3d image import canteen-menu-service:v1 -c $ClusterName
k3d image import canteen-order-service:v1 -c $ClusterName
k3d image import canteen-pickup-service:v1 -c $ClusterName
k3d image import smart-canteen-web:v1 -c $ClusterName

Write-Host "Import finished."
