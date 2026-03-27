param(
    [Parameter(Mandatory=$true)]
    [string]$AccessToken,

    [string]$BaseUrl = "http://localhost:8081",

    [string]$FilePath = "test-data/products_seed_36.json"
)

$headers = @{
    Authorization = "Bearer $AccessToken"
    "Content-Type" = "application/json"
}

$products = Get-Content -LiteralPath $FilePath -Raw | ConvertFrom-Json

$ok = 0
$failed = 0

foreach ($p in $products) {
    try {
        $body = $p | ConvertTo-Json -Depth 10
        Invoke-RestMethod -Uri "$BaseUrl/v1/products" -Method Post -Headers $headers -Body $body | Out-Null
        $ok++
        Write-Host "[OK] $($p.name)"
    }
    catch {
        $failed++
        $statusCode = "unknown"
        $errorBody = ""

        if ($_.Exception.Response) {
            try {
                $statusCode = [int]$_.Exception.Response.StatusCode
            } catch {
            }

            try {
                $stream = $_.Exception.Response.GetResponseStream()
                if ($stream) {
                    $reader = New-Object System.IO.StreamReader($stream)
                    $errorBody = $reader.ReadToEnd()
                    $reader.Close()
                }
            } catch {
            }
        }

        Write-Host "[FAIL] $($p.name) - HTTP $statusCode"
        if ($errorBody) {
            Write-Host "      Response: $errorBody"
        } else {
            Write-Host "      Error: $($_.Exception.Message)"
        }
    }
}

Write-Host "Done. Success=$ok, Failed=$failed"
