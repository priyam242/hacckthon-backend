from rest_framework.views import exception_handler
from rest_framework.response import Response

def problem_details_exception_handler(exc, context):
    response = exception_handler(exc, context)

    if response is not None:
        status_code = response.status_code
        request = context.get('request')
        instance = request.get_full_path() if request else ""
        detail = response.data

        problem = {
            "type": "about:blank",
            "title": "API Exception",
            "status": status_code,
            "detail": str(detail),
            "instance": instance,
        }
        response.data = problem
        response['Content-Type'] = 'application/problem+json'

    return response
