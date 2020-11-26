import logging
import json
import azure.functions as func


def WebhookToReadAlarms(req: func.HttpRequest) -> func.HttpResponse:
    logging.info('Python HTTP trigger function processed a request.')

    try:
        postreqdata = req.get_json()

        logging.info(postreqdata)

        return func.HttpResponse('Webhook triggered', status_code=200)
    except ValueError:
        pass
