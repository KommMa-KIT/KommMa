from EMail_Service import send_admin_email

import inspect
import os


class MissingDependencyError(RuntimeError):
    """Raised when a required dependency wasn't provided/initialized."""

    pass


def _raise_missing_dependency(message: str) -> None:
    frame = inspect.currentframe()
    caller = frame.f_back if frame else None

    filename = "<unknown>"
    lineno = -1
    func = "<unknown>"

    if caller is not None:
        filename = os.path.basename(caller.f_code.co_filename)
        lineno = caller.f_lineno
        func = caller.f_code.co_name
    
    send_admin_email(
        subject="KommMa Tool does not work at all! Missing Dependency Error in KommMa Tool",
        body=(
            "A Missing Dependency Error occurred in the KommMa Tool.\n\n",
            "This error indicates that a required dependency was not provided or initialized.\n",
            "Please check the logs for more information and ensure that all necessary dependencies are properly set up.\n\n",
            f"Message: {message}\n",
            f"Location: {filename}:{lineno} in {func}()\n\n"
        )
    )

    raise MissingDependencyError(f"{message} (at {filename}:{lineno} in {func}())")
