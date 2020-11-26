# ARM Templates

The application defined and deployed here waits for telemetry packages sent by the `devices-simulator` app to arrive. These events contain temperature and power level measurements for several devices. The objective is to have a service (I.e. Databricks or Azure Stream Analytics) process this measurements in almost-real-time and generate alarms if some predefined thresholds are crossed consistently.

This spike integrates multiple Azure Resource Manager templates using the linked template strategy to automatize the deployment.

## Deployment

1.  Create an Azure Storage Account with a container named `azuretemplates`.
2.  Add every standalone template from each of the sub-directories here (i.e. every ARM template excluding `globalTemplate.json`) to the `azuretemplates` container.
3.  Add the parameters required by the `globalTemplate.parameters.json` file (using `globalTemplate.parameters.template.json` as template).
4.  Create an `info.sh` file in this directory (using `info.template.sh` as template) and add the two required variables: `RESOURCE_GROUP_NAME` and `SUBSCRIPTION_NAME`.
5.  Run the `deploy.sh` script to have the global template deploy every standalone linked template.
6.  After the ARM templates finish being deployed, go to the `./function-apps` directory, fill up the `info.sh` (using `info.template.sh` as template) with the deployment's information and run the `deploy.sh` script in that directory (that will take care of deploying the Azure Functions):
    ```bash
    cd ./function-apps
    sh ./deploy.sh
    ```
7.  At this point in time, every resource should be deployed, although some set up steps remain, please see below.

## Setup

1. To set up the Databricks instance:
      - Launch the workspace and obtain the Databricks' workspace URL (I.e. the domain part of the URL; for instance: `https://adb-<workspace-id>.<random-number>.azuredatabricks.net`).
      - Create a Databricks [personal access token](https://docs.databricks.com/dev-tools/api/latest/authentication.html) from the `User Settings` tab inside the Databricks' instance in the browser.
      - Install the [Databricks CLI](https://docs.microsoft.com/en-us/azure/databricks/dev-tools/cli/) and login using `databricks configure --token`, you will need to put the workspace URL and personal access token obtained in previous steps.
      - Using the `databricks clusters list` command you can ensure you used the correct value in the previous step, since if not a 403 error will appear (yopu can simply run the previous command again with the correct data).
      - Go to `./databricks/setup` copy the file `info.template.sh`, rename it to `info.sh` and fill out the parameters of the Azure storage account.
      - Run the `./databricks/setup/setup.sh` script to create the Databricks cluster and upload the notebook.
      - A notebook named `process-historic-measurements.py` is available in Workspaces, attach it to the cluster created by the script and run every command cell.
2. To set up the IoT:
   a. Go to the IoT Hub and create the required devices.
   b. The devices' names, keys and the name of the IoT Hub is required in the `env.ts` file inside the `devices-simulator` app.
3. Set up App Insights in the Azure Function that reads alarms.
4. Go to the Logic App's `Logic app designer` tab, click on the `For each` block, and you'll see an exclamation mark to the left of the Office 365 connector which indicates an invalid connection: click it to authenticate and save.

At this point you should be able to run the `devices-simulator` app using `npm run dev` while being in said apps directory, and view the services working together: you can see in the IoT Hub how much activity there is, you can monitor the Azure Function that reads alarms to ensure they are received, yo can use the Azure Monitor service and finally you can also check the inside the Storage Account that both the Data Capture feature and the Databricks instance are doing their thing!

## Comments

-   Every standalone template's parameter's file is here so that the user can update single resources if required (the `deploy.sh` script also takes an optional parameter (through `info.sh`) where you can specify the path to said template and parameters file).
-   Each standalone template's parameter's file has the minimum required parameters; in other words, every value that could use defaults does so to simplify the initial set up to get going.
