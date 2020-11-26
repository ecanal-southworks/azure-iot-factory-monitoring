#!/bin/bash
# This script publishes all the ARM templates that are linked in the globalTemplate

# Exit immediately when a command fails
# Only exit with zero if all commands of the pipeline exit successfully
set -xeuo pipefail

. ./info.sh

if [ ! -x "./info.sh" ]; then
    echo "No info.sh file with resource information, you have to create it manually and give it execution permissions; there's a template meant as a starter file."
    exit 1
fi

# Default values for templates is the global templates - In case one wants to update a single resource
TEMPLATE_PATH="./globalTemplate.json"
PARAMETERS_PATH="./globalTemplate.parameters.json"

az deployment group create --resource-group "$RESOURCE_GROUP_NAME" --mode "Incremental" --subscription "$SUBSCRIPTION_NAME" --template-file "$TEMPLATE_PATH" --parameters "$PARAMETERS_PATH" --verbose
