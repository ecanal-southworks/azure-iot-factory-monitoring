import logging
import requests
import os
import azure.functions as func


def RedirectAlarmToWebhook(event: func.EventHubEvent):
    logging.info('Python Event Hub trigger function processed a request.')

    try:
        logging.info(os.environ)

        webhookUrl = os.environ['WEBHOOK_URL']

        eventData = event.get_body()

        logging.info(eventData)

        sendRequestToWebhook = requests.post(webhookUrl, data=eventData)

        logging.info(sendRequestToWebhook)
    except ValueError:
        pass
