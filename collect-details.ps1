$ErrorActionPreference = 'Stop'
$dataFile = Join-Path $PSScriptRoot 'dist\data.json'
$data = Get-Content -Raw -LiteralPath $dataFile -Encoding utf8 | ConvertFrom-Json
foreach ($program in $data.programs) {
    $detail = (Invoke-WebRequest -Uri 'https://2504.mkgtu.ru/index.php' -Method Post -Body @{ajdes='show_modal'; id=$program.id}).Content | ConvertFrom-Json
    $imagePath = [regex]::Match($detail.body, '<img[^>]+src="([^"]+)').Groups[1].Value
    $imageUrl = [uri]::new([uri]'https://2504.mkgtu.ru/', $imagePath).AbsoluteUri
    $hrefs = [regex]::Matches($detail.body, 'href="([^"]+)') | ForEach-Object { [uri]::new([uri]'https://2504.mkgtu.ru/', $_.Groups[1].Value).AbsoluteUri }
    $relative = 'assets/program-' + $program.id + '.jpg'
    $imageTarget = Join-Path $PSScriptRoot ('dist/' + $relative)
    if (-not (Test-Path -LiteralPath $imageTarget)) { Invoke-WebRequest -Uri $imageUrl -OutFile $imageTarget }
    $program | Add-Member -Force NoteProperty image $relative
    $program | Add-Member -Force NoteProperty document ($hrefs | Where-Object { $_ -match '\.pdf' } | Select-Object -First 1)
    $program | Add-Member -Force NoteProperty cost 'https://mkgtu.ru/sveden/paid_edu/'
    $program.PSObject.Properties.Remove('error')
}
$data | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath $dataFile -Encoding utf8
Write-Output ('Collected ' + $data.programs.Count + ' program documents and images.')
