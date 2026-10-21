param([string]$ProgramId = '', [string]$AssetsPath = 'dist\assets', [string]$TargetPath = 'extracted-programs')
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Runtime.WindowsRuntime
[Windows.Media.Ocr.OcrEngine, Windows.Foundation, ContentType=WindowsRuntime] | Out-Null
[Windows.Storage.StorageFile, Windows.Storage, ContentType=WindowsRuntime] | Out-Null
[Windows.Graphics.Imaging.BitmapDecoder, Windows.Graphics.Imaging, ContentType=WindowsRuntime] | Out-Null
[Windows.Globalization.Language, Windows.Globalization, ContentType=WindowsRuntime] | Out-Null
$asTask = [System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object { $_.Name -eq 'AsTask' -and $_.IsGenericMethodDefinition -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1' } | Select-Object -First 1
function AwaitResult($Operation, $ResultType) {
    $task = $asTask.MakeGenericMethod($ResultType).Invoke($null, @($Operation))
    $task.Wait()
    $task.Result
}
$engine = [Windows.Media.Ocr.OcrEngine]::TryCreateFromLanguage([Windows.Globalization.Language]::new('ru'))
$assets = Join-Path $PSScriptRoot $AssetsPath
$target = Join-Path $PSScriptRoot $TargetPath
New-Item -ItemType Directory -Path $target -Force | Out-Null
$images = Get-ChildItem -LiteralPath $assets -Filter 'program-*.jpg'
if ($ProgramId) { $images = $images | Where-Object { $_.BaseName -eq ('program-' + $ProgramId) } }
foreach ($image in $images) {
  try {
    $file = AwaitResult ([Windows.Storage.StorageFile]::GetFileFromPathAsync($image.FullName)) ([Windows.Storage.StorageFile])
    $stream = AwaitResult ($file.OpenReadAsync()) ([Windows.Storage.Streams.IRandomAccessStreamWithContentType])
    $decoder = AwaitResult ([Windows.Graphics.Imaging.BitmapDecoder]::CreateAsync($stream)) ([Windows.Graphics.Imaging.BitmapDecoder])
    $transform = [Windows.Graphics.Imaging.BitmapTransform]::new()
    $scale = [Math]::Min(2.5, 2500.0 / [Math]::Max($decoder.PixelWidth, $decoder.PixelHeight))
    $transform.ScaledWidth = [uint32]($decoder.PixelWidth * $scale)
    $transform.ScaledHeight = [uint32]($decoder.PixelHeight * $scale)
    $bitmap = AwaitResult ($decoder.GetSoftwareBitmapAsync([Windows.Graphics.Imaging.BitmapPixelFormat]::Bgra8, [Windows.Graphics.Imaging.BitmapAlphaMode]::Ignore, $transform, [Windows.Graphics.Imaging.ExifOrientationMode]::IgnoreExifOrientation, [Windows.Graphics.Imaging.ColorManagementMode]::DoNotColorManage)) ([Windows.Graphics.Imaging.SoftwareBitmap])
    $result = AwaitResult ($engine.RecognizeAsync($bitmap)) ([Windows.Media.Ocr.OcrResult])
    $lines = @($result.Lines | ForEach-Object {
        @{ text=$_.Text; words=@($_.Words | ForEach-Object { @{text=$_.Text;x=$_.BoundingRect.X;y=$_.BoundingRect.Y;width=$_.BoundingRect.Width;height=$_.BoundingRect.Height} }) }
    })
    @{text=$result.Text;lines=$lines;width=$bitmap.PixelWidth;height=$bitmap.PixelHeight} | ConvertTo-Json -Depth 9 | Set-Content -LiteralPath (Join-Path $target ($image.BaseName + '.json')) -Encoding utf8
    $bitmap.Dispose()
    $stream.Dispose()
  } catch {
    Write-Output ('FAILED ' + $image.Name + ': ' + $_.Exception.ToString())
  }
}
Write-Output ('Recognized ' + @($images).Count + ' cards with Windows OCR (Russian).')
