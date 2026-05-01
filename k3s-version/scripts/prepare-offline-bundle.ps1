param(
  [string]$ImageTag = "v1"
)

$ErrorActionPreference = "Stop"

Write-Host "Preparing offline bundle artifacts..."

$root = (Resolve-Path ".").Path
$bundle = Join-Path $root "k3s-version"
$backendDir = Join-Path $bundle "artifacts/backend"
$webDir = Join-Path $bundle "artifacts/web/dist"
$imagesDir = Join-Path $bundle "images"

New-Item -ItemType Directory -Force -Path $backendDir | Out-Null
New-Item -ItemType Directory -Force -Path $webDir | Out-Null
New-Item -ItemType Directory -Force -Path $imagesDir | Out-Null

Write-Host "Building backend jars..."
Push-Location (Join-Path $root "smart-canteen")
mvn -DskipTests clean package
Pop-Location

function Copy-AppJar {
  param(
    [string]$ServiceDir,
    [string]$OutName
  )
  $jar = Get-ChildItem ".\smart-canteen\$ServiceDir\target\*.jar" |
    Where-Object { $_.Name -notmatch "original" } |
    Sort-Object LastWriteTime -Descending |
    Select-Object -First 1

  if (-not $jar) {
    throw "No runnable jar found for $ServiceDir"
  }

  Copy-Item $jar.FullName ".\k3s-version\artifacts\backend\$OutName" -Force
}

Copy-AppJar -ServiceDir "canteen-gateway" -OutName "canteen-gateway.jar"
Copy-AppJar -ServiceDir "canteen-user-service" -OutName "canteen-user-service.jar"
Copy-AppJar -ServiceDir "canteen-menu-service" -OutName "canteen-menu-service.jar"
Copy-AppJar -ServiceDir "canteen-order-service" -OutName "canteen-order-service.jar"
Copy-AppJar -ServiceDir "canteen-pickup-service" -OutName "canteen-pickup-service.jar"

Write-Host "Building frontend dist..."
Push-Location (Join-Path $root "smart-canteen-web")
npm install
npm run build
Pop-Location

Remove-Item ".\k3s-version\artifacts\web\dist\*" -Recurse -Force -ErrorAction SilentlyContinue
Copy-Item ".\smart-canteen-web\dist\*" ".\k3s-version\artifacts\web\dist" -Recurse -Force

Write-Host "Building images from k3s-version artifacts..."
docker build -t canteen-gateway:$ImageTag -f .\k3s-version\dockerfiles\gateway.artifact.Dockerfile .\k3s-version
docker build -t canteen-user-service:$ImageTag -f .\k3s-version\dockerfiles\user.artifact.Dockerfile .\k3s-version
docker build -t canteen-menu-service:$ImageTag -f .\k3s-version\dockerfiles\menu.artifact.Dockerfile .\k3s-version
docker build -t canteen-order-service:$ImageTag -f .\k3s-version\dockerfiles\order.artifact.Dockerfile .\k3s-version
docker build -t canteen-pickup-service:$ImageTag -f .\k3s-version\dockerfiles\pickup.artifact.Dockerfile .\k3s-version
docker build -t smart-canteen-web:$ImageTag -f .\k3s-version\dockerfiles\web.artifact.Dockerfile .\k3s-version

Write-Host "Saving images to tar files..."
docker save -o ".\k3s-version\images\canteen-gateway-$ImageTag.tar" canteen-gateway:$ImageTag
docker save -o ".\k3s-version\images\canteen-user-service-$ImageTag.tar" canteen-user-service:$ImageTag
docker save -o ".\k3s-version\images\canteen-menu-service-$ImageTag.tar" canteen-menu-service:$ImageTag
docker save -o ".\k3s-version\images\canteen-order-service-$ImageTag.tar" canteen-order-service:$ImageTag
docker save -o ".\k3s-version\images\canteen-pickup-service-$ImageTag.tar" canteen-pickup-service:$ImageTag
docker save -o ".\k3s-version\images\smart-canteen-web-$ImageTag.tar" smart-canteen-web:$ImageTag

Write-Host "Offline bundle is ready under .\k3s-version"
