from EMail_Service import send_admin_email

class ExternalConnection(RuntimeError):
    """
    Raised when GENESIS returns a login error.
    Author: Jonas Dorner (@OilersLD)
    """

    def __init__(self, message: str, *, genesis_code: str | None = None, details: str | None = None):
        super().__init__(message)
        self.genesis_code = genesis_code
        self.details = details
        send_admin_email(
            subject="External Connection Error in KommMa Tool",
            body=(
                f"An External Connection Error occurred in the KommMa Tool.\n\n"
                f"Message: {message}\n"
                f"Genesis Code: {genesis_code}\n"
                f"Details: {details}\n\n"
                "Please check the logs for more information."
            )
        )


def raise_externalConnection_error(genesis_message: str, *, genesis_code: str | None = None, details: str | None = None) -> None:
    msg = f"External Connection failed: {genesis_message}"
    if genesis_code:
        msg += f" (code: {genesis_code})"
    raise ExternalConnection(msg, genesis_code=genesis_code, details=details)
