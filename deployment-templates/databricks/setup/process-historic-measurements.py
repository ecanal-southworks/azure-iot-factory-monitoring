# Databricks notebook source
# DBTITLE 1,Import libraries
from pyspark.sql import *
from pyspark.sql.types import *
from pyspark.sql.functions import col, from_json, to_timestamp, count, avg, lag, explode
from pyspark.sql.window import Window
from time import time

# COMMAND ----------

# DBTITLE 1,Connect to Blob Storage
BLOB_ACCOUNT_NAME = dbutils.secrets.get(scope="secretScope", key="storageAccountName")
BLOB_ACCOUNT_KEY = dbutils.secrets.get(scope="secretScope", key="storageAccountKey")
EVENT_HUB_NAMESPACE = dbutils.secrets.get(scope="secretScope", key="eventHubNamespace")

SAMPLES_CONTAINER_NAME = "samples-container"
SAMPLES_DIRECTORY = f"{EVENT_HUB_NAMESPACE}/alarm-event-hub/0"
SAMPLES_CONTAINER = f"wasbs://{SAMPLES_CONTAINER_NAME}@{BLOB_ACCOUNT_NAME}.blob.core.windows.net/"
SAMPLES_PATH = f"{SAMPLES_CONTAINER}/{SAMPLES_DIRECTORY}"

REPORTS_CONTAINER_NAME = "csv-reports"
REPORTS_DIRECTORY = f"report-{int(time())}"
REPORTS_CONTAINER = f"wasbs://{REPORTS_CONTAINER_NAME}@{BLOB_ACCOUNT_NAME}.blob.core.windows.net/"
REPORTS_PATH = f"{REPORTS_CONTAINER}/{REPORTS_DIRECTORY}"

spark.conf.set(
    f"fs.azure.account.key.{BLOB_ACCOUNT_NAME}.blob.core.windows.net",
    BLOB_ACCOUNT_KEY,
)

# COMMAND ----------

# DBTITLE 1,Load AVRO input files from Blob
dfAvroInput = (spark.read.format("avro")
                    .option("recursiveFileLookup", "true")
                    .load(SAMPLES_PATH))

display(dfAvroInput)

# COMMAND ----------

# DBTITLE 1,Parse the body contents from each EventHub event
contentSchema = ArrayType(StructType([
                    StructField("factoryArea", StringType(), True),
                    StructField("machineType", StringType(), True),
                    StructField("deviceId", StringType(), True),
                    StructField("type", StringType(), True),
                    StructField("status", StringType(), True),
                    StructField("timestamp", StringType(), True),
                ]))

dfParsedContents = dfAvroInput.withColumn("Body", from_json(col("Body").cast("string"), contentSchema))
dfExplodedParsedContents = dfParsedContents.withColumn("Body", explode("Body").alias("key"))

display(dfExplodedParsedContents)

# COMMAND ----------

# DBTITLE 1,Convert EnqueuedTime and unwrap body contents
dfFormatedTime = dfExplodedParsedContents.withColumn("EnqueuedTimeUtc", to_timestamp("EnqueuedTimeUtc", 'M/d/yyyy h:mm:ss a'))

dfUnwrappedContents = dfFormatedTime.withColumn("EventTimestamp", to_timestamp(col("Body").getItem("timestamp")))
dfUnwrappedContents = dfUnwrappedContents.withColumn("FactoryArea", col("Body").getItem("factoryArea"))
dfUnwrappedContents = dfUnwrappedContents.withColumn("MachineType", col("Body").getItem("machineType"))
dfUnwrappedContents = dfUnwrappedContents.withColumn("DeviceID", col("Body").getItem("deviceId"))
dfUnwrappedContents = dfUnwrappedContents.withColumn("type", col("Body").getItem("type"))
dfUnwrappedContents = dfUnwrappedContents.withColumn("Status", col("Body").getItem("status"))
dfUnwrappedContents = dfUnwrappedContents.drop("Body")

display(dfUnwrappedContents)

# COMMAND ----------

# DBTITLE 1,Keep only event information
dfAlarmEvents = dfUnwrappedContents.select("EventTimestamp", "FactoryArea", "MachineType", "DeviceID", "type", "Status")

# COMMAND ----------

# DBTITLE 1,Alternative override of input data
# Uncomment this command code to override the input data for testing purposes
# columns = ["EventTimestamp", "FactoryArea", "MachineType", "DeviceID", "type", "Status"]

# data = [
#   (1603723962, "AssemblyLine", "Engine", "device-1", "temperature", "off"),
#   (1603723967, "AssemblyLine", "Engine", "device-1", "temperature", "on"),
#   (1603723972, "AssemblyLine", "Engine", "device-1", "temperature", "on"),
#   (1603723977, "AssemblyLine", "Engine", "device-1", "power", "on"),
#   (1603723987, "ConveyorBelt", "Turbine", "device-2", "temperature", "on"),
#   (1603723997, "ConveyorBelt", "Turbine", "device-2", "power", "on"),
#   (1603724007, "ConveyorBelt", "Turbine", "device-2", "temperature", "off"),
#   (1603724017, "ConveyorBelt", "Turbine", "device-2", "power", "off"),
#   (1603724027, "AssemblyLine", "Engine", "device-1", "power", "off"),
#   (1603724037, "AssemblyLine", "Engine", "device-1", "temperature", "off"),
#   (1603724047, "ConveyorBelt", "Turbine", "device-3", "power", "on"),
#   (1603724057, "ConveyorBelt", "Turbine", "device-2", "temperature", "on"),
#   (1603724067, "ConveyorBelt", "Turbine", "device-2", "power", "on"),
#   (1603724077, "AssemblyLine", "Turbine", "device-3", "temperature", "on"),
#   (1603724087, "AssemblyLine", "Turbine", "device-3", "temperature", "off"),
#   (1603724097, "AssemblyLine", "Turbine", "device-3", "power", "off"),
#   (1603724107, "ConveyorBelt", "Turbine", "device-2", "power", "off"),
#   (1603724117, "ConveyorBelt", "Turbine", "device-2", "temperature", "off"),
#   (1603724127, "AssemblyLine", "Engine", "device-1", "temperature", "on"),
#   (1603724137, "AssemblyLine", "Engine", "device-1", "temperature", "off"),
# ]

# dfFromData1 = spark.createDataFrame(data).toDF(*columns)

# # Make EventTimestamp have the same input format as real data.
# dfAlarmEvents = dfFromData1.withColumn("EventTimestamp", (col("EventTimestamp").cast("timestamp")))

# display(dfAlarmEvents)

# COMMAND ----------

# DBTITLE 1,Calculate alarm durations
w = Window().partitionBy("DeviceID", "type").orderBy("EventTimestamp")

# For the same alarm type of the same device the status should always alternate between "on" and "off". Discard alarms with repeated Status values.
dfDiscardRepeatedStatus = (dfAlarmEvents
    .withColumn("prevStatus", lag(col("Status"), 1).over(w))
    .where((col("Status") != col("prevStatus")) | (col("prevStatus").isNull())))

# Calculate duration of each alarm.
dfAlarmDurations = (dfDiscardRepeatedStatus
    .withColumn("AlarmDuration", (col("EventTimestamp").cast("long") - lag(col("EventTimestamp"), 1).over(w).cast("long")))
    .where((col("Status") == "off") & (col("prevStatus") == "on"))
    .orderBy("EventTimestamp")
    .drop("Status", "prevStatus"))

display(dfAlarmDurations)

# COMMAND ----------

# DBTITLE 1,Calculate Historical Data Analytics per Factory area
dfAlarmStatisticsPerFactoryArea = (dfAlarmDurations
    .groupBy("FactoryArea", "type")
    .agg(
        count("*").alias("AlarmAmount"),
        avg("AlarmDuration").alias("AverageAlarmDuration"),
    )
    .orderBy("FactoryArea", "type"))

# write the dataframe as a single file to blob storage
(dfAlarmStatisticsPerFactoryArea
    .coalesce(1)
    .write
    .mode("overwrite")
    .option("header", "true")
    .format("com.databricks.spark.csv")
    .save(f"{REPORTS_PATH}-factoryArea"))

display(dfAlarmStatisticsPerFactoryArea)

# COMMAND ----------

# DBTITLE 1,Calculate Historical Data Analytics per Machine type
dfAlarmStatisticsPerMachineType = (dfAlarmDurations
    .groupBy("MachineType", "type")
    .agg(
        count("*").alias("AlarmAmount"),
        avg("AlarmDuration").alias("AverageAlarmDuration"),
    )
    .orderBy("MachineType", "type"))

# write the dataframe as a single file to blob storage
(dfAlarmStatisticsPerMachineType
    .coalesce(1)
    .write
    .mode("overwrite")
    .option("header", "true")
    .format("com.databricks.spark.csv")
    .save(f"{REPORTS_PATH}-machineType"))

display(dfAlarmStatisticsPerMachineType)

# COMMAND ----------

# DBTITLE 1,Correlation plot of AlarmAmount VS AlarmDuration
dfAlarmsPerDevice = (dfAlarmDurations
    .groupBy("DeviceID", "type")
    .agg(
        count("*").alias("AlarmAmount"),
        avg("AlarmDuration").alias("AverageAlarmDuration"),
    )
    .orderBy("AlarmAmount"))

# To see the correlation chart select type "Q-Q Plot" and select "AverageAlarmDuration" and "AlarmAmount" as Values and "type" as a Key in "Plot options..."
display(dfAlarmsPerDevice)
