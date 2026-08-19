$p = "backend\functions\batch-complete\index.js"

$c = Get-Content $p -Raw

$c = $c.Replace(
    "const archiver = require('archiver');",
    ""
)

$c = $c.Replace(
    "exports.handler = async (event) => {",
    "exports.handler = async (event) => {`r`n  const { default: archiver } = await import('archiver');"
)

Set-Content $p $c

Write-Host "archiver fix applied."