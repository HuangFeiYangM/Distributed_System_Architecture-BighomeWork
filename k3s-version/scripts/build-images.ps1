$ErrorActionPreference = "Stop"

Write-Host "Building backend images for k3s-version..."

docker build -t canteen-gateway:v1 -f .\k3s-version\dockerfiles\gateway.Dockerfile .\smart-canteen\canteen-gateway
docker build -t canteen-user-service:v1 -f .\k3s-version\dockerfiles\user.Dockerfile .\smart-canteen\canteen-user-service
docker build -t canteen-menu-service:v1 -f .\k3s-version\dockerfiles\menu.Dockerfile .\smart-canteen\canteen-menu-service
docker build -t canteen-order-service:v1 -f .\k3s-version\dockerfiles\order.Dockerfile .\smart-canteen\canteen-order-service
docker build -t canteen-pickup-service:v1 -f .\k3s-version\dockerfiles\pickup.Dockerfile .\smart-canteen\canteen-pickup-service
docker build -t smart-canteen-web:v1 -f .\k3s-version\dockerfiles\web.Dockerfile .

Write-Host "Build finished."
