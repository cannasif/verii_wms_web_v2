pipeline {
    agent any

    tools {
        nodejs 'Node24'
    }

    environment {
        DEPLOY_PATH                   = 'C:\\inetpub\\wwwroot\\wms2-ui'
        API_URL                       = 'https://wms2api.v3rii.com'
        APP_BASE_PATH                 = '/'
        REALTIME_NOTIFICATIONS_ENABLED = 'false'
    }

    stages {
        stage('Kodu Al') {
            steps {
                git branch: 'main',
                    url: 'https://github.com/cannasif/verii_wms_web_v2.git'
            }
        }

        stage('Paketleri Kur') {
            steps {
                bat 'npm ci'
            }
        }

        stage('Build Al (Vite)') {
            steps {
                bat 'npm run build'
            }
        }

        stage('Runtime Ayarlarını Üret') {
            steps {
                powershell '''
                Set-StrictMode -Version Latest
                $ErrorActionPreference = "Stop"

                $apiUri = $null
                if (
                    -not [Uri]::TryCreate($env:API_URL, [UriKind]::Absolute, [ref]$apiUri) -or
                    $apiUri.Scheme -ne "https"
                ) {
                    throw "API_URL mutlak bir HTTPS adresi olmalıdır."
                }

                $realtimeEnabled = $false
                if (-not [bool]::TryParse($env:REALTIME_NOTIFICATIONS_ENABLED, [ref]$realtimeEnabled)) {
                    throw "REALTIME_NOTIFICATIONS_ENABLED true veya false olmalıdır."
                }

                $settings = [ordered]@{
                    schemaVersion = 1
                    baseUrl = $env:APP_BASE_PATH
                    apiUrl = $apiUri.AbsoluteUri.TrimEnd("/")
                    realtimeNotificationsEnabled = $realtimeEnabled
                    generatedAtUtc = [DateTime]::UtcNow.ToString("o")
                }

                $target = Join-Path $env:WORKSPACE "dist\\runtime-settings.json"
                $json = $settings | ConvertTo-Json
                $utf8WithoutBom = New-Object System.Text.UTF8Encoding($false)
                [System.IO.File]::WriteAllText($target, $json, $utf8WithoutBom)

                Write-Host "Runtime settings generated for $($settings.apiUrl)"
                '''
            }
        }

        stage('IIS Deploy') {
            steps {
                bat '''
                if exist "%DEPLOY_PATH%" (
                    rmdir /S /Q "%DEPLOY_PATH%"
                )
                mkdir "%DEPLOY_PATH%"
                xcopy dist "%DEPLOY_PATH%" /E /I /Y
                '''
            }
        }
    }
}
