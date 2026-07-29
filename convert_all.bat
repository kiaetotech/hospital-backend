@echo off
echo ========================================
echo Converting ai-core files to CommonJS...
echo ========================================
echo.

for /r ai-core %%f in (*.js) do (
    echo Processing: %%f
    powershell -Command "$c = Get-Content '%%f' -Raw; $c = $c -replace 'import\s+{([^}]+)}\s+from\s+[''\"]([^''\""]+)[''\""];', 'const {$1} = require(''$2'');'; $c = $c -replace 'export\s+{([^}]+)}', 'module.exports = { $1 };'; $c = $c -replace 'export\s+default\s+(\w+)', 'module.exports = { default: $1 };'; $c = $c -replace 'export\s+const\s+(\w+)\s*=\s*', 'const $1 = '; Set-Content '%%f' -Value $c"
)

echo.
echo ========================================
echo ✅ Conversion Complete!
echo ========================================
pause