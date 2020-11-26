#!/bin/bash
# This script sets up the Databricks instance/workspace using a Node script and databricks REST API 2.0

# Exit immediately when a command fails
set -xeu

. ./info.sh

if [ ! -x "./info.sh" ]; then
    echo "No info.sh file with resource information, you have to create it manually and give it execution permissions; there's a template meant as a starter file."
    exit 1
fi

CLUSTER_NAME="process-historic-measurements"
SPARK_VERSION="7.1.x-scala2.12"
NODE_TYPE="Standard_F4s"
NUM_WORKERS=null
MIN_WORKERS=1
MAX_WORKERS=2

# Clean up the cluster, secret scope and notebook in case they were left from previous run(s)
CLUSTER_ID=`databricks clusters list | grep " $CLUSTER_NAME " | cut -d' ' -f1`
if [[ $CLUSTER_ID != '' ]]; then
    databricks clusters permanent-delete --cluster-id $CLUSTER_ID
fi

databricks secrets delete-scope --scope secretScope || true 2> /dev/null
# MSYS_NO_PATHCONV is necessary on Windows to prevent Bash from converting the remote path to Windows format.
MSYS_NO_PATHCONV=1 databricks workspace rm /Shared/process-historic-measurements.py || true 2> /dev/null

# Create Databricks cluster
databricks clusters create --json "{ \"cluster_name\": \"$CLUSTER_NAME\",
                                    \"spark_version\": \"$SPARK_VERSION\",
                                    \"node_type_id\": \"$NODE_TYPE\",
                                    \"spark_conf\": { \
                                        \"spark.speculation\": true
                                    },
                                    \"num_workers\": $NUM_WORKERS,
                                    \"autoscale\": {
                                        \"min_workers\": $MIN_WORKERS,
                                        \"max_workers\": $MAX_WORKERS
                                    }
                                }"

# Get Storage Account name and key and store them in the secret scope
STORAGE_ACCOUNT_CONNECTION_STRING=`az storage account show-connection-string --name $STORAGE_ACCOUNT_NAME --resource-group $RESOURCE_GROUP -o tsv`
STORAGE_ACCOUNT_KEY=`echo $STORAGE_ACCOUNT_CONNECTION_STRING | cut -d';' -f4 | cut -d'=' -f2-`

databricks secrets create-scope --scope secretScope --initial-manage-principal users --scope-backend-type DATABRICKS
databricks secrets put --scope secretScope --key storageAccountName --string-value $STORAGE_ACCOUNT_NAME
databricks secrets put --scope secretScope --key storageAccountKey --string-value $STORAGE_ACCOUNT_KEY
databricks secrets put --scope secretScope --key eventHubNamespace --string-value $EVENT_HUB_NAMESPACE

# Upload the notebook.
# MSYS_NO_PATHCONV is necessary on Windows to prevent Bash from converting the remote path to Windows format.
MSYS_NO_PATHCONV=1 databricks workspace import -l PYTHON -f SOURCE -o process-historic-measurements.py /Shared/process-historic-measurements.py
