pipeline {
    agent any

    tools {
        nodejs 'Node24'
    }

    environment {
        DEPLOY_PATH = 'C:\\inetpub\\wwwroot\\wms2-ui'
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

        stage('IIS Deploy') {
            steps {
                bat '''
                if not exist "dist\\runtime-settings.json" (
                    echo DEPLOYMENT BLOCKED: dist\\runtime-settings.json bulunamadi.
                    exit /b 1
                )
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
