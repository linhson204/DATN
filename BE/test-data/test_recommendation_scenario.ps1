param(
    [Parameter(Mandatory=$true)]
    [string]$AccessToken,

    [string]$BaseUrl = "http://localhost:8081",

    [string]$SeedProductName = "Ao thun basic cotton nam 01"
)

$ErrorActionPreference = "Stop"

$headers = @{
    Authorization = "Bearer $AccessToken"
    "Content-Type" = "application/json"
}

function Get-ProductMap {
    param(
        [string]$ApiBaseUrl
    )

    $uri = "$ApiBaseUrl/v1/products?page=0&size=200&sortBy=createdAt&sortDir=desc"
    $resp = Invoke-RestMethod -Uri $uri -Method Get

    $products = @()
    if ($resp.data -and $resp.data.items) {
        $products = $resp.data.items
    }
    elseif ($resp.data -and $resp.data.content) {
        $products = $resp.data.content
    }

    $map = @{}
    foreach ($p in $products) {
        $map[$p.name] = $p.id
    }
    return $map
}

function Post-ViewLog {
    param(
        [string]$ApiBaseUrl,
        [hashtable]$RequestHeaders,
        [string]$ProductId,
        [string]$ViewType = "DETAIL_VIEW"
    )

    $uri = "$ApiBaseUrl/v1/products/$ProductId/view?viewType=$ViewType"
    Invoke-RestMethod -Uri $uri -Method Post -Headers $RequestHeaders | Out-Null
}

function Require-ProductId {
    param(
        [hashtable]$ProductMap,
        [string]$Name
    )

    if (-not $ProductMap.ContainsKey($Name)) {
        throw "Product not found by name: $Name"
    }

    return $ProductMap[$Name]
}

try {
    Write-Host "[1/4] Loading products from API..."
    $productMap = Get-ProductMap -ApiBaseUrl $BaseUrl

    if ($productMap.Count -lt 6) {
        throw "Need at least 6 products in database to run scenario."
    }

    $resolvedSeedName = $SeedProductName
    if ($productMap.ContainsKey($SeedProductName)) {
        $seedId = $productMap[$SeedProductName]
    }
    else {
        $firstPair = $productMap.GetEnumerator() | Select-Object -First 1
        $resolvedSeedName = $firstPair.Key
        $seedId = $firstPair.Value
        Write-Host "Preferred seed not found. Fallback seed: $resolvedSeedName"
    }

    $scenarioNames = @(
        "Ao thun basic cotton nam 02",
        "So mi linen tay dai 01",
        "So mi linen tay dai 02",
        "Sneaker canvas low 01",
        "Mu bucket cotton 02"
    )

    $scenarioIds = @()
    foreach ($name in $scenarioNames) {
        if ($productMap.ContainsKey($name)) {
            $scenarioIds += $productMap[$name]
        }
    }

    if ($scenarioIds.Count -lt 5) {
        foreach ($pair in $productMap.GetEnumerator()) {
            if ($pair.Value -eq $seedId) {
                continue
            }
            if ($scenarioIds -contains $pair.Value) {
                continue
            }
            $scenarioIds += $pair.Value
            if ($scenarioIds.Count -ge 5) {
                break
            }
        }
    }

    if ($scenarioIds.Count -lt 5) {
        throw "Could not prepare enough scenario products (need 5)."
    }

    Write-Host "[2/4] Generating co-view pattern..."
    # Pattern A: Seed + first 3 items
    for ($i = 0; $i -lt 5; $i++) {
        Post-ViewLog -ApiBaseUrl $BaseUrl -RequestHeaders $headers -ProductId $seedId -ViewType "DETAIL_VIEW"
        Post-ViewLog -ApiBaseUrl $BaseUrl -RequestHeaders $headers -ProductId $scenarioIds[0] -ViewType "DETAIL_VIEW"
        Post-ViewLog -ApiBaseUrl $BaseUrl -RequestHeaders $headers -ProductId $scenarioIds[1] -ViewType "SEARCH_CLICK"
        Post-ViewLog -ApiBaseUrl $BaseUrl -RequestHeaders $headers -ProductId $scenarioIds[2] -ViewType "DETAIL_VIEW"
    }

    # Pattern B: Seed + price-near and material-near items
    for ($i = 0; $i -lt 3; $i++) {
        Post-ViewLog -ApiBaseUrl $BaseUrl -RequestHeaders $headers -ProductId $seedId -ViewType "DETAIL_VIEW"
        Post-ViewLog -ApiBaseUrl $BaseUrl -RequestHeaders $headers -ProductId $scenarioIds[3] -ViewType "QUICK_VIEW"
        Post-ViewLog -ApiBaseUrl $BaseUrl -RequestHeaders $headers -ProductId $scenarioIds[4] -ViewType "DETAIL_VIEW"
    }

    Write-Host "[3/4] Calling recommendation candidates API..."
    $recUri = "$BaseUrl/v1/recommendations/candidates/$seedId"
    $rec = Invoke-RestMethod -Uri $recUri -Method Get

    Write-Host "[4/4] Summary"
    Write-Host "SeedProductName: $resolvedSeedName"
    Write-Host "SeedProductId: $seedId"
    Write-Host "TotalCandidates: $($rec.totalCandidates)"

    $sourceStats = @{}
    foreach ($c in $rec.candidates) {
        foreach ($s in $c.sources) {
            if (-not $sourceStats.ContainsKey($s)) {
                $sourceStats[$s] = 0
            }
            $sourceStats[$s]++
        }
    }

    Write-Host "Source distribution:"
    foreach ($k in ($sourceStats.Keys | Sort-Object)) {
        Write-Host " - ${k}: $($sourceStats[$k])"
    }

    Write-Host "Top 10 candidates:"
    $index = 1
    foreach ($c in ($rec.candidates | Select-Object -First 10)) {
        $sources = ($c.sources -join ",")
        Write-Host "$index. $($c.productName) | brand=$($c.brand) | price=$($c.salePrice) | material=$($c.materialCode) | sources=$sources"
        $index++
    }
}
catch {
    Write-Host "Scenario failed: $($_.Exception.Message)"
    throw
}
