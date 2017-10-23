<# :
@echo off
copy/b "%~f0" "%temp%\%~n0.ps1" >nul
powershell -Version 2 -ExecutionPolicy bypass -noprofile "%temp%\%~n0.ps1" "%cd% " "%~1"
del "%temp%\%~n0.ps1"
exit /b
#>
function main {
    ('HKLM', 'HKCU') | %{ $hive = $_
        ('', '\Wow6432Node') | %{
            $key = "${hive}:\SOFTWARE$_\Google\Update\Clients"
            gci -ea silentlycontinue $key -r | gp | ?{ $_.CommandLine } | %{
                $path = $_.CommandLine -replace '"(.+?\\)\d+\.\d+\.\d+\.\d+\\.+', '$1chrome.exe'
                $file = (Get-Item -Path ".\index.html" -Verbose).FullName -replace '\\', '/'
                Start-Process -FilePath $path -ArgumentList "--disable-web-security --user-data-dir file:///$file"
            }
        }
    }
}

main
