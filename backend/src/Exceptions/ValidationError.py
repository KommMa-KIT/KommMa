
from dataclasses import dataclass
from EMail_Service import send_admin_email

@dataclass
class ValidationErrorDetail:
    code: str
    message: str
    path: str


class ValidationError(Exception):
    def __init__(self, errors: list[ValidationErrorDetail]):
        super().__init__("Validation failed")
        self.errors = errors
        send_admin_email(
            subject="Validation Error in KommMa Tool",
            body=(
                f"A Validation Error occurred in the KommMa Tool.\n\n"
                f"Message: Validation failed\n"
                f"Errors: {json.dumps([e.__dict__ for e in errors], indent=2)}\n\n"
                "Please check the logs for more information."
            )
        )

    def as_dict(self) -> dict:
        return {
            "ok": False,
            "errors": [
                {"code": e.code, "message": e.message, "path": e.path}
                for e in self.errors
            ],
        }


