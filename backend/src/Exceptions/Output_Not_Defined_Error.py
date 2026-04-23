from EMail_Service import send_admin_email

class OutputNotDefinedError(RuntimeError):
    """
    Raised when no output target is configured (e.g., missing output path/file/location).
    Author: Jonas Dorner (@OilersLD)
    """

    def __init__(
        self,
        message: str,
        *,
        output_target: str | None = None,
        details: str | None = None,
    ):
        super().__init__(message)
        self.output_target = output_target
        self.details = details
        send_admin_email(
            subject="Output Not Defined Error in KommMa Tool",
            body=(
                f"An Output Not Defined Error occurred in the KommMa Tool.\n\n"
                f"Message: {message}\n"
                f"Output Target: {output_target}\n"
                f"Details: {details}\n\n"
                "Please check the logs for more information."
            )
        )


def raise_output_not_defined_error(
    output_target: str | None = None,
    details: str | None = None,
) -> None:
    msg = "Output target is not defined"
    if output_target:
        msg += f": {output_target}"
    raise OutputNotDefinedError(msg, output_target=output_target, details=details)
