#!/bin/bash
# This script publishes the Azure Function App

# Exit immediately when a command fails
# Only exit with zero if all commands of the pipeline exit successfully
set -xeuo pipefail

if [ ! -x "./info.sh" ]; then
    echo "No info.sh file with resource information, you have to create it manually and give it execution permissions; there's a template meant as a starter file."
    exit 1
fi

. ./info.sh

# Fetching the Azure Storage Account connection string
AZURE_STORAGE_CONNECTION_STRING=$(az storage account show-connection-string --resource-group $RESOURCE_GROUP_NAME --name $AZURE_STORAGE_ACCOUNT_NAME --output tsv)

# Function to publish each Azure Function
function deployAzureFunction() {
    FUNCTION_APP_NAME=$1
    FUNCTION_NAME=$2

    # Publishing the Azure Function App (retry logic is used because sometimes it failes because Azure hasn't finished deploying the app)
    # Using a subshell to run command in function app's root dir without changing current working directory
    (
        cd $FUNCTION_NAME
        cat requirements.txt
        printf "Publishing $FUNCTION_NAME to Function App '$FUNCTION_APP_NAME'"
        for i in 1 2 3 4 5; do func azure functionapp publish $FUNCTION_APP_NAME --python && break || sleep 5; done
        exit 0
    )
}

deployAzureFunction $REDIRECTION_FUNCTION_APP_NAME "RedirectAlarmToWebhook"
deployAzureFunction $READ_ALARM_FUNCTION_APP_NAME "WebhookToReadAlarms"

# Getting the invocation URL of the Azure Function with an HTTP trigger
WEBHOOK_URL=$(
    echo $(func azure functionapp list-functions $READ_ALARM_FUNCTION_APP_NAME --show-keys | grep "Invoke url: " | sed 's/.*: //')
    exit 0
)

# Configuring the Azure Function App to connect it to the Azure Storage Account (and adding the webhook's URL to the redirection Function App's environment vairables (hardcoded))
az functionapp config appsettings set --name="$REDIRECTION_FUNCTION_APP_NAME" --resource-group="$RESOURCE_GROUP_NAME" --settings "EVENT_HUB_CONNECTION_STRING=$EVENT_HUB_CONNECTION_STRING" "WEBHOOK_URL=$WEBHOOK_URL" "EVENT_HUB_NAME=$EVENT_HUB_NAME" "EVENT_HUB_CONSUMER_GROUP=$EVENT_HUB_CONSUMER_GROUP"

# List the Azure Function in the Azure Function App
func azure functionapp list-functions $READ_ALARM_FUNCTION_APP_NAME --show-keys

if [[ -z ${WEBHOOK_URL} ]]; then
    echo "The webhook's URL wasn't found!"

    az functionapp function show --resource-group="$RESOURCE_GROUP_NAME" --name="$READ_ALARM_FUNCTION_APP_NAME" --function-name="WebhookToReadAlarms"
fi
